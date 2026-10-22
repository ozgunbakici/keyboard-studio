import {describe, expect, it} from 'vitest';
import {VirtualKeyboard, VirtualTransport, type VirtualKeyboardConfig} from '@/emulator/virtual-keyboard';
import {ViaApi, pressedFromMatrix} from './api';
import {UnhandledCommandError, ViaChannel} from './transport';
import {decodeMacros, encodeMacros, type Macro} from './macro-bytes';

const baseConfig = (overrides: Partial<VirtualKeyboardConfig> = {}): VirtualKeyboardConfig => {
  const rows = 5;
  const cols = 15;
  return {
    name: 'Test',
    vendorId: 0x1234,
    productId: 0x5678,
    protocol: 12,
    rows,
    cols,
    layers: 4,
    encoders: 1,
    macroCount: 16,
    macroBufferSize: 512,
    keymap: Array.from({length: 4}, (_, l) => Array.from({length: rows * cols}, (_, i) => (l << 8) | (i + 4))),
    encoderMap: Array.from({length: 4}, () => [[0x00aa, 0x00a9]]),
    customValues: {'3:1': [128], '3:2': [1], '3:4': [10, 255]},
    ...overrides,
  };
};

const connect = async (config = baseConfig()) => {
  const keyboard = new VirtualKeyboard(config);
  const channel = new ViaChannel(new VirtualTransport(keyboard), 200);
  await channel.open();
  return {keyboard, api: new ViaApi(channel), channel};
};

describe('ViaApi against the virtual keyboard', () => {
  it('reads protocol version and layer count', async () => {
    const {api} = await connect();
    expect(await api.getProtocolVersion()).toBe(12);
    expect(await api.getLayerCount(12)).toBe(4);
    expect(await api.getLayerCount(7)).toBe(4);
  });

  it('reads the full keymap using buffer chunks', async () => {
    const config = baseConfig();
    const {api} = await connect(config);
    const keymap = await api.readKeymap(4, {rows: 5, cols: 15}, 12);
    expect(keymap).toEqual(config.keymap);
  });

  it('reads the keymap key by key on alpha protocol', async () => {
    const config = baseConfig({protocol: 7});
    const {api} = await connect(config);
    expect(await api.readLayer(1, {rows: 5, cols: 15}, 7)).toEqual(config.keymap[1]);
  });

  it('writes single keycodes and whole keymaps', async () => {
    const {api, keyboard} = await connect();
    await api.setKeycode(2, 3, 4, 0x5221);
    expect(keyboard.keycodeAt(2, 3, 4)).toBe(0x5221);
    expect(await api.getKeycode(2, 3, 4)).toBe(0x5221);

    const fresh = Array.from({length: 4}, (_, l) => Array.from({length: 75}, (_, i) => 0x1000 + l * 100 + i));
    await api.writeKeymap(fresh, {rows: 5, cols: 15}, 12);
    expect(await api.readKeymap(4, {rows: 5, cols: 15}, 12)).toEqual(fresh);
  });

  it('reads and writes layout options', async () => {
    const {api} = await connect();
    expect(await api.getLayoutOptions()).toBe(0);
    await api.setLayoutOptions(0x8000_0005);
    expect(await api.getLayoutOptions()).toBe(0x8000_0005);
  });

  it('reads and writes encoders', async () => {
    const {api} = await connect();
    expect(await api.getEncoder(0, 0, false)).toBe(0x00aa);
    expect(await api.getEncoder(0, 0, true)).toBe(0x00a9);
    await api.setEncoder(1, 0, true, 0x7827);
    expect(await api.getEncoder(1, 0, true)).toBe(0x7827);
  });

  it('rejects unsupported commands', async () => {
    const {api} = await connect(baseConfig({encoders: 0}));
    await expect(api.getEncoder(0, 0, true)).rejects.toBeInstanceOf(UnhandledCommandError);
    // The queue keeps working afterwards.
    expect(await api.getProtocolVersion()).toBe(12);
  });

  it('round-trips macros through the buffer', async () => {
    const {api, keyboard} = await connect();
    const macros: Macro[] = [
      [{type: 'text', text: 'Merhaba dunya'}],
      [{type: 'down', keycode: 0xe0}, {type: 'tap', keycode: 0x06}, {type: 'up', keycode: 0xe0}],
      [{type: 'text', text: 'a'}, {type: 'delay', ms: 250}, {type: 'text', text: 'b'}],
    ];
    const count = await api.getMacroCount();
    const size = await api.getMacroBufferSize();
    const padded = [...macros, ...Array.from({length: count - macros.length}, () => [] as Macro)];
    await api.writeMacroBuffer(encodeMacros(padded, 12), size);
    // Write-in-progress flag is cleared at the end.
    expect(keyboard.macroBytes[size - 1]).toBe(0);
    const read = decodeMacros(await api.readMacroBuffer(size), count, 12);
    expect(read).toEqual(padded);
  });

  it('refuses macros larger than the buffer', async () => {
    const {api} = await connect(baseConfig({macroBufferSize: 8}));
    await expect(api.writeMacroBuffer(new Array(9).fill(65), 8)).rejects.toThrow(/sığmıyor/);
  });

  it('reads custom menu values and saves them', async () => {
    const {api, keyboard} = await connect();
    expect(await api.getCustomValue([3, 4])).toEqual(expect.arrayContaining([10, 255]));
    expect((await api.getCustomValue([3, 4])).slice(0, 2)).toEqual([10, 255]);
    await api.setCustomValue([3, 1], [200]);
    expect(keyboard.customValue(3, 1)).toEqual([200]);
    await api.saveCustomValues(3);
    expect(keyboard.savedCustomChannels).toEqual([3]);
  });

  it('decodes matrix state with and without row offsets', async () => {
    for (const protocol of [11, 12]) {
      const {api, keyboard} = await connect(baseConfig({protocol}));
      keyboard.press(0, 0);
      keyboard.press(4, 14);
      keyboard.press(2, 9);
      const flat = await api.getMatrixState({rows: 5, cols: 15}, protocol);
      expect([...pressedFromMatrix(flat, {rows: 5, cols: 15})].sort()).toEqual(['0,0', '2,9', '4,14']);
    }
  });

  it('pages matrix state for tall matrices', async () => {
    const config = baseConfig({rows: 20, cols: 20, keymap: [[], [], [], []]});
    const {api, keyboard} = await connect(config);
    keyboard.press(19, 19);
    keyboard.press(10, 3);
    const flat = await api.getMatrixState({rows: 20, cols: 20}, 12);
    expect(flat).toHaveLength(60);
    expect([...pressedFromMatrix(flat, {rows: 20, cols: 20})].sort()).toEqual(['10,3', '19,19']);
  });

  it('keeps commands ordered when fired concurrently', async () => {
    const {api} = await connect();
    const results = await Promise.all([
      api.getKeycode(0, 0, 0),
      api.getKeycode(1, 0, 1),
      api.getProtocolVersion(),
      api.getKeycode(3, 4, 14),
    ]);
    expect(results).toEqual([4, (1 << 8) | 5, 12, (3 << 8) | (74 + 4)]);
  });
});
