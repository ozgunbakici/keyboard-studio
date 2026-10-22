import {Command, REPORT_SIZE, VIA_USAGE, VIA_USAGE_PAGE} from './constants';

/**
 * A raw HID channel to one keyboard. Implemented by WebHID devices and by the
 * in-browser virtual keyboard, so everything above this layer is transport
 * agnostic and testable.
 */
export interface HidTransport {
  readonly kind: 'webhid' | 'virtual';
  readonly id: string;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  /** Sends exactly one 32 byte report (without report ID). */
  send(report: Uint8Array): Promise<void>;
  onReport(handler: (report: Uint8Array) => void): () => void;
}

export class UnhandledCommandError extends Error {
  constructor(readonly request: number[]) {
    super(`Klavye bu komutu desteklemiyor (0x${request[0].toString(16)})`);
    this.name = 'UnhandledCommandError';
  }
}

export class CommandTimeoutError extends Error {
  constructor(readonly request: number[]) {
    super(`Klavye yanıt vermedi (komut 0x${request[0].toString(16)})`);
    this.name = 'CommandTimeoutError';
  }
}

type Pending = {
  request: number[];
  echoLength: number;
  resolve: (response: Uint8Array) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type QueueItem = {
  request: number[];
  echoLength: number;
  resolve: (response: Uint8Array) => void;
  reject: (error: Error) => void;
};

export type UnsolicitedHandler = (report: Uint8Array) => void;

/**
 * Serialises VIA commands over a transport. The firmware answers every report
 * with the same buffer, so a response is matched by checking that it echoes the
 * request's leading bytes. Only one command is in flight at a time, as with VIA.
 */
export class ViaChannel {
  private queue: QueueItem[] = [];
  private pending: Pending | null = null;
  private unsubscribe: (() => void) | null = null;
  private unsolicited = new Set<UnsolicitedHandler>();
  private closed = false;

  constructor(
    readonly transport: HidTransport,
    private readonly timeoutMs = 1500,
  ) {}

  async open() {
    await this.transport.open();
    this.unsubscribe = this.transport.onReport((report) => this.handleReport(report));
  }

  async close() {
    this.closed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    const error = new Error('Bağlantı kapatıldı');
    this.pending?.reject(error);
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
    this.queue.splice(0).forEach((item) => item.reject(error));
    await this.transport.close();
  }

  onUnsolicited(handler: UnsolicitedHandler): () => void {
    this.unsolicited.add(handler);
    return () => this.unsolicited.delete(handler);
  }

  /**
   * Sends `request` (command id followed by arguments) and resolves with the full
   * 32 byte response. `echoLength` is how many leading bytes the firmware echoes
   * back unchanged; by default the whole request.
   */
  command(request: number[], echoLength = request.length): Promise<Uint8Array> {
    if (this.closed) return Promise.reject(new Error('Bağlantı kapalı'));
    if (request.length > REPORT_SIZE) {
      return Promise.reject(new Error(`Komut çok uzun: ${request.length} bayt`));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({request, echoLength, resolve, reject});
      this.pump();
    });
  }

  /** Resolves once every queued command has completed. */
  async idle(): Promise<void> {
    if (!this.pending && this.queue.length === 0) return;
    await this.command([Command.GetProtocolVersion], 1).catch(() => undefined);
  }

  private pump() {
    if (this.pending || this.queue.length === 0) return;
    const item = this.queue.shift()!;
    const report = new Uint8Array(REPORT_SIZE);
    report.set(item.request);
    const timer = setTimeout(() => {
      if (this.pending?.timer === timer) {
        this.pending = null;
        item.reject(new CommandTimeoutError(item.request));
        this.pump();
      }
    }, this.timeoutMs);
    this.pending = {...item, timer};
    this.transport.send(report).catch((error: unknown) => {
      if (this.pending?.timer === timer) {
        clearTimeout(timer);
        this.pending = null;
        item.reject(error instanceof Error ? error : new Error(String(error)));
        this.pump();
      }
    });
  }

  private handleReport(report: Uint8Array) {
    const pending = this.pending;
    if (pending && this.matches(pending, report)) {
      clearTimeout(pending.timer);
      this.pending = null;
      if (report[0] === Command.Unhandled) {
        pending.reject(new UnhandledCommandError(pending.request));
      } else {
        pending.resolve(report);
      }
      this.pump();
      return;
    }
    // Anything else is either a late answer to a timed-out command or a
    // device-initiated message such as a UI sync request.
    if (report[0] !== Command.Unhandled) {
      this.unsolicited.forEach((handler) => handler(report));
    }
  }

  private matches(pending: Pending, report: Uint8Array): boolean {
    if (report[0] === Command.Unhandled) {
      // Unhandled replies overwrite the command byte but keep the arguments.
      for (let i = 1; i < pending.echoLength; i++) {
        if (report[i] !== pending.request[i]) return false;
      }
      return true;
    }
    for (let i = 0; i < pending.echoLength; i++) {
      if (report[i] !== pending.request[i]) return false;
    }
    return true;
  }
}

let webHidCounter = 0;
const webHidIds = new WeakMap<HIDDevice, string>();

/** Stable per-page identifier for a WebHID device object. */
export const webHidDeviceId = (device: HIDDevice): string => {
  let id = webHidIds.get(device);
  if (!id) {
    id = `hid-${device.vendorId.toString(16)}-${device.productId.toString(16)}-${++webHidCounter}`;
    webHidIds.set(device, id);
  }
  return id;
};

export const isViaInterface = (device: HIDDevice) =>
  device.collections?.some((c) => c.usagePage === VIA_USAGE_PAGE && c.usage === VIA_USAGE) ?? false;

export class WebHidTransport implements HidTransport {
  readonly kind = 'webhid' as const;
  readonly id: string;
  private listeners = new Set<(report: Uint8Array) => void>();
  private readonly onInput = (event: HIDInputReportEvent) => {
    const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    const copy = new Uint8Array(REPORT_SIZE);
    copy.set(data.subarray(0, REPORT_SIZE));
    this.listeners.forEach((listener) => listener(copy));
  };

  constructor(readonly device: HIDDevice) {
    this.id = webHidDeviceId(device);
  }

  get vendorId() {
    return this.device.vendorId;
  }
  get productId() {
    return this.device.productId;
  }
  get productName() {
    return this.device.productName;
  }

  async open() {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener('inputreport', this.onInput);
  }

  async close() {
    this.device.removeEventListener('inputreport', this.onInput);
    if (this.device.opened) await this.device.close().catch(() => undefined);
  }

  async send(report: Uint8Array) {
    await this.device.sendReport(0, report as Uint8Array<ArrayBuffer>);
  }

  onReport(handler: (report: Uint8Array) => void) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
}
