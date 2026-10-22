import {from16, from32, to16, to32} from '@/lib/bytes';
import {Command, KeyboardValue, Protocol, REPORT_SIZE} from '@/via/constants';
import type {HidTransport} from '@/via/transport';

export type VirtualKeyboardConfig = {
  name: string;
  vendorId: number;
  productId: number;
  protocol: number;
  keycodesVersion?: number;
  firmwareVersion?: number;
  rows: number;
  cols: number;
  layers: number;
  encoders: number;
  macroCount: number;
  macroBufferSize: number;
  /** Initial keymap, layer-major, each layer rows*cols long. */
  keymap: number[][];
  /** Initial encoder map: [layer][encoder] = [ccw, cw]. */
  encoderMap?: [number, number][][];
  macroBytes?: number[];
  layoutOptions?: number;
  /** Initial custom values keyed by "channel:valueId". */
  customValues?: Record<string, number[]>;
};

/**
 * Software model of a VIA-enabled QMK keyboard. It answers raw HID reports the
 * way quantum/via.c does, which lets the whole app (and its tests) run without
 * hardware.
 */
export class VirtualKeyboard {
  readonly config: VirtualKeyboardConfig;
  private keymap: Uint16Array;
  private encoderMap: Uint16Array;
  private macroBuffer: Uint8Array;
  private layoutOptions: number;
  private custom = new Map<string, number[]>();
  private savedChannels: number[] = [];
  private pressed = new Set<string>();
  private readonly bootTime = Date.now();
  /** Firmware that is not built with VIA_INSECURE hides the switch matrix. */
  matrixVisible = true;
  indications: number[] = [];

  constructor(config: VirtualKeyboardConfig) {
    this.config = config;
    const {layers, rows, cols, encoders} = config;
    this.keymap = new Uint16Array(layers * rows * cols);
    config.keymap.forEach((layer, l) =>
      layer.slice(0, rows * cols).forEach((code, i) => (this.keymap[l * rows * cols + i] = code)),
    );
    this.encoderMap = new Uint16Array(layers * encoders * 2);
    config.encoderMap?.forEach((layer, l) =>
      layer.forEach(([ccw, cw], e) => {
        this.encoderMap[(l * encoders + e) * 2] = ccw;
        this.encoderMap[(l * encoders + e) * 2 + 1] = cw;
      }),
    );
    this.macroBuffer = new Uint8Array(config.macroBufferSize);
    config.macroBytes?.slice(0, config.macroBufferSize).forEach((b, i) => (this.macroBuffer[i] = b));
    this.layoutOptions = config.layoutOptions ?? 0;
    Object.entries(config.customValues ?? {}).forEach(([key, value]) => this.custom.set(key, [...value]));
  }

  /** Test helpers. */
  press(row: number, col: number) {
    this.pressed.add(`${row},${col}`);
  }
  release(row: number, col: number) {
    this.pressed.delete(`${row},${col}`);
  }
  keycodeAt(layer: number, row: number, col: number) {
    const {rows, cols} = this.config;
    return this.keymap[layer * rows * cols + row * cols + col];
  }
  get macroBytes() {
    return Array.from(this.macroBuffer);
  }
  get savedCustomChannels() {
    return [...this.savedChannels];
  }
  customValue(channel: number, valueId: number) {
    return this.custom.get(`${channel}:${valueId}`);
  }

  handle(input: Uint8Array): Uint8Array {
    const data = new Uint8Array(REPORT_SIZE);
    data.set(input.subarray(0, REPORT_SIZE));
    const cmd = data[0];
    const arg = data.subarray(1);
    const {rows, cols, layers, encoders, protocol} = this.config;
    const keymapBytes = layers * rows * cols * 2;

    switch (cmd) {
      case Command.GetProtocolVersion:
        arg.set(from16(protocol));
        break;
      case Command.GetKeyboardValue:
        if (!this.getValue(arg)) data[0] = Command.Unhandled;
        break;
      case Command.SetKeyboardValue:
        if (arg[0] === KeyboardValue.LayoutOptions) this.layoutOptions = to32(arg.subarray(1, 5));
        else if (arg[0] === KeyboardValue.DeviceIndication) this.indications.push(arg[1]);
        else data[0] = Command.Unhandled;
        break;
      case Command.DynamicKeymapGetKeycode: {
        const [layer, row, col] = arg;
        const code = layer < layers && row < rows && col < cols ? this.keycodeAt(layer, row, col) : 0;
        arg.set(from16(code), 3);
        break;
      }
      case Command.DynamicKeymapSetKeycode: {
        const [layer, row, col] = arg;
        if (layer < layers && row < rows && col < cols) {
          this.keymap[layer * rows * cols + row * cols + col] = to16(arg[3], arg[4]);
        }
        break;
      }
      case Command.DynamicKeymapReset:
        this.config.keymap.forEach((layer, l) =>
          layer.forEach((code, i) => (this.keymap[l * rows * cols + i] = code)),
        );
        break;
      case Command.DynamicKeymapGetLayerCount:
        arg[0] = layers;
        break;
      case Command.DynamicKeymapGetBuffer: {
        const offset = to16(arg[0], arg[1]);
        const size = Math.min(arg[2], 28);
        for (let i = 0; i < size; i++) {
          const byteIndex = offset + i;
          if (byteIndex >= keymapBytes) break;
          const code = this.keymap[byteIndex >> 1];
          arg[3 + i] = byteIndex % 2 === 0 ? code >> 8 : code & 0xff;
        }
        break;
      }
      case Command.DynamicKeymapSetBuffer: {
        const offset = to16(arg[0], arg[1]);
        const size = Math.min(arg[2], 28);
        for (let i = 0; i < size; i++) {
          const byteIndex = offset + i;
          if (byteIndex >= keymapBytes) break;
          const word = byteIndex >> 1;
          const current = this.keymap[word];
          this.keymap[word] =
            byteIndex % 2 === 0 ? (arg[3 + i] << 8) | (current & 0xff) : (current & 0xff00) | arg[3 + i];
        }
        break;
      }
      case Command.DynamicKeymapGetEncoder:
      case Command.DynamicKeymapSetEncoder: {
        if (encoders === 0) {
          data[0] = Command.Unhandled;
          break;
        }
        const [layer, encoder, clockwise] = arg;
        const index = (layer * encoders + encoder) * 2 + (clockwise ? 1 : 0);
        if (layer >= layers || encoder >= encoders) break;
        if (cmd === Command.DynamicKeymapGetEncoder) arg.set(from16(this.encoderMap[index]), 3);
        else this.encoderMap[index] = to16(arg[3], arg[4]);
        break;
      }
      case Command.CustomGetValue:
      case Command.CustomSetValue:
      case Command.CustomSave:
        this.customCommand(data);
        break;
      case Command.MacroGetCount:
        arg[0] = this.config.macroCount;
        break;
      case Command.MacroGetBufferSize:
        arg.set(from16(this.config.macroBufferSize));
        break;
      case Command.MacroGetBuffer: {
        const offset = to16(arg[0], arg[1]);
        const size = Math.min(arg[2], 28);
        for (let i = 0; i < size; i++) arg[3 + i] = this.macroBuffer[offset + i] ?? 0;
        break;
      }
      case Command.MacroSetBuffer: {
        const offset = to16(arg[0], arg[1]);
        const size = Math.min(arg[2], 28);
        for (let i = 0; i < size; i++) {
          if (offset + i < this.macroBuffer.length) this.macroBuffer[offset + i] = arg[3 + i];
        }
        break;
      }
      case Command.MacroReset:
        this.macroBuffer.fill(0);
        break;
      case Command.EepromReset:
        this.config.keymap.forEach((layer, l) =>
          layer.forEach((code, i) => (this.keymap[l * rows * cols + i] = code)),
        );
        this.macroBuffer.fill(0);
        this.layoutOptions = 0;
        break;
      case Command.BootloaderJump:
        break;
      default:
        data[0] = Command.Unhandled;
    }
    return data;
  }

  private getValue(arg: Uint8Array): boolean {
    const {protocol, rows, cols} = this.config;
    switch (arg[0]) {
      case KeyboardValue.Uptime:
        arg.set(from32(Date.now() - this.bootTime), 1);
        return true;
      case KeyboardValue.LayoutOptions:
        arg.set(from32(this.layoutOptions), 1);
        return true;
      case KeyboardValue.FirmwareVersion:
        arg.set(from32(this.config.firmwareVersion ?? 0), 1);
        return true;
      case KeyboardValue.KeycodesVersion:
        if (protocol < Protocol.KeycodesVersion) return false;
        arg.set(from32(this.config.keycodesVersion ?? 9), 1);
        return true;
      case KeyboardValue.SwitchMatrixState: {
        const bytesPerRow = Math.ceil(cols / 8);
        const withOffset = protocol >= Protocol.MatrixOffset;
        const offset = withOffset ? arg[1] : 0;
        const rowsPerQuery = Math.floor(28 / bytesPerRow);
        let i = withOffset ? 2 : 1;
        for (let r = 0; r < rowsPerQuery && r + offset < rows; r++) {
          let value = 0;
          if (this.matrixVisible) {
            for (let c = 0; c < cols; c++) if (this.pressed.has(`${r + offset},${c}`)) value |= 1 << c;
          }
          for (let b = bytesPerRow - 1; b >= 0; b--) arg[i++] = (value >>> (8 * b)) & 0xff;
        }
        return true;
      }
      default:
        return false;
    }
  }

  private customCommand(data: Uint8Array) {
    const [cmd, channel, valueId] = data;
    const key = `${channel}:${valueId}`;
    if (cmd === Command.CustomSave) {
      this.savedChannels.push(channel);
      return;
    }
    if (!this.custom.has(key)) {
      data[0] = Command.Unhandled;
      return;
    }
    if (cmd === Command.CustomGetValue) {
      data.set(this.custom.get(key)!.slice(0, REPORT_SIZE - 3), 3);
    } else {
      const length = this.custom.get(key)!.length;
      this.custom.set(key, Array.from(data.subarray(3, 3 + length)));
    }
  }
}

let virtualCounter = 0;

/** Transport that talks to a VirtualKeyboard with a small async delay like real USB. */
export class VirtualTransport implements HidTransport {
  readonly kind = 'virtual' as const;
  readonly id: string;
  private listeners = new Set<(report: Uint8Array) => void>();
  opened = false;

  constructor(
    readonly keyboard: VirtualKeyboard,
    private readonly latencyMs = 0,
  ) {
    this.id = `virtual-${++virtualCounter}`;
  }

  get vendorId() {
    return this.keyboard.config.vendorId;
  }
  get productId() {
    return this.keyboard.config.productId;
  }
  get productName() {
    return this.keyboard.config.name;
  }

  async open() {
    this.opened = true;
  }

  async close() {
    this.opened = false;
  }

  async send(report: Uint8Array) {
    if (!this.opened) throw new Error('Sanal klavye kapalı');
    const response = this.keyboard.handle(report);
    const deliver = () => this.listeners.forEach((listener) => listener(response));
    if (this.latencyMs > 0) setTimeout(deliver, this.latencyMs);
    else queueMicrotask(deliver);
  }

  onReport(handler: (report: Uint8Array) => void) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
}
