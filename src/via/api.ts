import {array16ToBytes, bytesTo16Array, from16, from32, to16, to32} from '@/lib/bytes';
import {BUFFER_CHUNK, Command, KeyboardValue, Protocol} from './constants';
import type {ViaChannel} from './transport';

/** Number of 16-bit keycodes that fit in one buffer read. */
const KEYCODES_PER_CHUNK = BUFFER_CHUNK / 2;

export type MatrixSize = {rows: number; cols: number};

/**
 * Typed wrapper around the VIA command set. All methods are thin: they encode
 * arguments, send one or more commands and decode the response.
 */
export class ViaApi {
  constructor(readonly channel: ViaChannel) {}

  private async cmd(request: number[], echoLength?: number) {
    return this.channel.command(request, echoLength);
  }

  async getProtocolVersion(): Promise<number> {
    const res = await this.cmd([Command.GetProtocolVersion], 1);
    return to16(res[1], res[2]);
  }

  async getLayerCount(protocol: number): Promise<number> {
    if (protocol < Protocol.Beta) return 4;
    const res = await this.cmd([Command.DynamicKeymapGetLayerCount], 1);
    return res[1];
  }

  /** Reads a keyboard value; returns `length` bytes following the echoed request. */
  async getKeyboardValue(id: number, params: number[] = [], length = 1): Promise<number[]> {
    const request = [Command.GetKeyboardValue, id, ...params];
    const res = await this.cmd(request);
    return Array.from(res.slice(request.length, request.length + length));
  }

  async setKeyboardValue(id: number, ...bytes: number[]) {
    await this.cmd([Command.SetKeyboardValue, id, ...bytes]);
  }

  async getUptime(): Promise<number> {
    return to32(await this.getKeyboardValue(KeyboardValue.Uptime, [], 4));
  }

  async getLayoutOptions(): Promise<number> {
    return to32(await this.getKeyboardValue(KeyboardValue.LayoutOptions, [], 4));
  }

  async setLayoutOptions(value: number) {
    await this.setKeyboardValue(KeyboardValue.LayoutOptions, ...from32(value));
  }

  async getFirmwareVersion(): Promise<number> {
    return to32(await this.getKeyboardValue(KeyboardValue.FirmwareVersion, [], 4));
  }

  /** QMK keycodes version in BCD (protocol 13+). */
  async getKeycodesVersion(): Promise<number> {
    return to32(await this.getKeyboardValue(KeyboardValue.KeycodesVersion, [], 4));
  }

  /** Asks the firmware to blink its LEDs so the user can spot which board is selected. */
  async deviceIndication(step: number) {
    await this.setKeyboardValue(KeyboardValue.DeviceIndication, step);
  }

  async getKeycode(layer: number, row: number, col: number): Promise<number> {
    const res = await this.cmd([Command.DynamicKeymapGetKeycode, layer, row, col]);
    return to16(res[4], res[5]);
  }

  async setKeycode(layer: number, row: number, col: number, keycode: number) {
    await this.cmd([Command.DynamicKeymapSetKeycode, layer, row, col, ...from16(keycode)]);
  }

  /** Reads raw bytes from the dynamic keymap buffer (layer-major, row, col, 2 bytes each). */
  async getKeymapBuffer(offset: number, size: number): Promise<number[]> {
    const request = [Command.DynamicKeymapGetBuffer, ...from16(offset), size];
    const res = await this.cmd(request);
    return Array.from(res.slice(4, 4 + size));
  }

  async setKeymapBuffer(offset: number, bytes: number[]) {
    await this.cmd([Command.DynamicKeymapSetBuffer, ...from16(offset), bytes.length, ...bytes]);
  }

  async readLayer(layer: number, {rows, cols}: MatrixSize, protocol: number): Promise<number[]> {
    const length = rows * cols;
    if (protocol < Protocol.Beta) {
      const keys: number[] = [];
      for (let i = 0; i < length; i++) {
        keys.push(await this.getKeycode(layer, Math.floor(i / cols), i % cols));
      }
      return keys;
    }
    const keys: number[] = [];
    const base = layer * length * 2;
    for (let start = 0; start < length; start += KEYCODES_PER_CHUNK) {
      const count = Math.min(KEYCODES_PER_CHUNK, length - start);
      const bytes = await this.getKeymapBuffer(base + start * 2, count * 2);
      keys.push(...bytesTo16Array(bytes));
    }
    return keys;
  }

  async readKeymap(layerCount: number, matrix: MatrixSize, protocol: number): Promise<number[][]> {
    const layers: number[][] = [];
    for (let layer = 0; layer < layerCount; layer++) {
      layers.push(await this.readLayer(layer, matrix, protocol));
    }
    return layers;
  }

  /** Writes whole layers in one go (used by restore). */
  async writeKeymap(keymap: number[][], matrix: MatrixSize, protocol: number) {
    if (protocol < Protocol.Beta) {
      for (const [layer, keys] of keymap.entries()) {
        for (const [i, keycode] of keys.entries()) {
          await this.setKeycode(layer, Math.floor(i / matrix.cols), i % matrix.cols, keycode);
        }
      }
      return;
    }
    const bytes = array16ToBytes(keymap.flat());
    for (let offset = 0; offset < bytes.length; offset += BUFFER_CHUNK) {
      await this.setKeymapBuffer(offset, bytes.slice(offset, offset + BUFFER_CHUNK));
    }
  }

  /** Restores the keymap stored in firmware flash (factory default keymap). */
  async resetKeymap() {
    await this.cmd([Command.DynamicKeymapReset]);
  }

  async getEncoder(layer: number, encoder: number, clockwise: boolean): Promise<number> {
    const res = await this.cmd([Command.DynamicKeymapGetEncoder, layer, encoder, clockwise ? 1 : 0]);
    return to16(res[4], res[5]);
  }

  async setEncoder(layer: number, encoder: number, clockwise: boolean, keycode: number) {
    await this.cmd([Command.DynamicKeymapSetEncoder, layer, encoder, clockwise ? 1 : 0, ...from16(keycode)]);
  }

  /** Returns the value bytes for a custom menu command ([channel, valueId, ...extra]). */
  async getCustomValue(command: number[]): Promise<number[]> {
    const request = [Command.CustomGetValue, ...command];
    const res = await this.cmd(request);
    return Array.from(res.slice(request.length));
  }

  async setCustomValue(command: number[], value: number[]) {
    await this.cmd([Command.CustomSetValue, ...command, ...value]);
  }

  async saveCustomValues(channel: number) {
    await this.cmd([Command.CustomSave, channel]);
  }

  async getMacroCount(): Promise<number> {
    const res = await this.cmd([Command.MacroGetCount], 1);
    return res[1];
  }

  async getMacroBufferSize(): Promise<number> {
    const res = await this.cmd([Command.MacroGetBufferSize], 1);
    return to16(res[1], res[2]);
  }

  async readMacroBuffer(bufferSize: number): Promise<number[]> {
    const bytes: number[] = [];
    for (let offset = 0; offset < bufferSize; offset += BUFFER_CHUNK) {
      const size = Math.min(BUFFER_CHUNK, bufferSize - offset);
      const res = await this.cmd([Command.MacroGetBuffer, ...from16(offset), size]);
      bytes.push(...res.slice(4, 4 + size));
    }
    return bytes;
  }

  /**
   * Rewrites the macro buffer. The last byte is set to 0xFF while writing so the
   * firmware refuses to play half-written macros, exactly as VIA does.
   */
  async writeMacroBuffer(data: number[], bufferSize: number) {
    if (data.length > bufferSize) {
      throw new Error(`Makrolar klavyenin hafızasına sığmıyor (${data.length}/${bufferSize} bayt)`);
    }
    const last = bufferSize - 1;
    await this.resetMacros();
    try {
      await this.cmd([Command.MacroSetBuffer, ...from16(last), 1, 0xff]);
      for (let offset = 0; offset < data.length; offset += BUFFER_CHUNK) {
        const chunk = data.slice(offset, offset + BUFFER_CHUNK);
        await this.cmd([Command.MacroSetBuffer, ...from16(offset), chunk.length, ...chunk]);
      }
    } finally {
      await this.cmd([Command.MacroSetBuffer, ...from16(last), 1, 0x00]);
    }
  }

  async resetMacros() {
    await this.cmd([Command.MacroReset]);
  }

  /**
   * Returns the pressed-switch bitmap, `ceil(cols/8)` big-endian bytes per row.
   * Firmware built without VIA_INSECURE reports all zeros.
   */
  async getMatrixState({rows, cols}: MatrixSize, protocol: number): Promise<number[]> {
    const bytesPerRow = Math.ceil(cols / 8);
    const rowsPerQuery = Math.floor(BUFFER_CHUNK / bytesPerRow);
    if (protocol < Protocol.MatrixOffset) {
      return this.getKeyboardValue(KeyboardValue.SwitchMatrixState, [], rows * bytesPerRow);
    }
    const flat: number[] = [];
    for (let offset = 0; offset < rows; offset += rowsPerQuery) {
      const count = Math.min(rowsPerQuery, rows - offset) * bytesPerRow;
      flat.push(...(await this.getKeyboardValue(KeyboardValue.SwitchMatrixState, [offset], count)));
    }
    return flat;
  }

  async jumpToBootloader() {
    // The board reboots immediately, so a reply may never arrive.
    await this.cmd([Command.BootloaderJump]).catch(() => undefined);
  }

  async eepromReset() {
    await this.cmd([Command.EepromReset]);
  }
}

/** Decodes a matrix bitmap into a set of "row,col" strings that are pressed. */
export const pressedFromMatrix = (flat: number[], {rows, cols}: MatrixSize): Set<string> => {
  const pressed = new Set<string>();
  const bytesPerRow = Math.ceil(cols / 8);
  for (let row = 0; row < rows; row++) {
    for (let b = 0; b < bytesPerRow; b++) {
      const byte = flat[row * bytesPerRow + b] ?? 0;
      if (!byte) continue;
      const colOffset = 8 * (bytesPerRow - 1 - b);
      for (let bit = 0; bit < 8; bit++) {
        const col = colOffset + bit;
        if (col < cols && (byte >> bit) & 1) pressed.add(`${row},${col}`);
      }
    }
  }
  return pressed;
};
