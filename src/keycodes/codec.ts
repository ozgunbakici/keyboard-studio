import {hex} from '@/lib/bytes';
import {getKeycodeTable, keycodeAliases, type KeycodeTable} from './dictionary';

/** Modifier bits as used inside QK_MODS keycodes (bits 8-12). */
export const ModBit = {
  CTRL: 0x01,
  SHIFT: 0x02,
  ALT: 0x04,
  GUI: 0x08,
  RIGHT: 0x10,
} as const;

/** MOD_* masks used by MT(), OSM() and LM(). Same bit layout as ModBit. */
const modMasks: Record<string, number> = {
  MOD_LCTL: 0x01,
  MOD_LSFT: 0x02,
  MOD_LALT: 0x04,
  MOD_LGUI: 0x08,
  MOD_RCTL: 0x11,
  MOD_RSFT: 0x12,
  MOD_RALT: 0x14,
  MOD_RGUI: 0x18,
  MOD_MEH: 0x07,
  MOD_HYPR: 0x0f,
};

/** Wrapper functions that apply modifiers to a basic keycode, e.g. C(KC_C). */
const modWrappers: Record<string, number> = {
  LCTL: 0x01,
  C: 0x01,
  LSFT: 0x02,
  S: 0x02,
  LALT: 0x04,
  A: 0x04,
  LOPT: 0x04,
  LGUI: 0x08,
  G: 0x08,
  LCMD: 0x08,
  LWIN: 0x08,
  RCTL: 0x11,
  RSFT: 0x12,
  RALT: 0x14,
  ALGR: 0x14,
  ROPT: 0x14,
  RGUI: 0x18,
  RCMD: 0x18,
  RWIN: 0x18,
  LCS: 0x03,
  LCA: 0x05,
  LCG: 0x09,
  LSA: 0x06,
  LSG: 0x0a,
  SGUI: 0x0a,
  SCMD: 0x0a,
  SWIN: 0x0a,
  LAG: 0x0c,
  RCS: 0x13,
  RCA: 0x15,
  RCG: 0x19,
  RSA: 0x16,
  SAGR: 0x16,
  RSG: 0x1a,
  RAG: 0x1c,
  LCSG: 0x0b,
  LCAG: 0x0d,
  LSAG: 0x0e,
  MEH: 0x07,
  HYPR: 0x0f,
};

// Preferred output names for modifier combinations (VIA-compatible output).
const singleLeftMods: [number, string][] = [
  [0x01, 'C'],
  [0x02, 'S'],
  [0x04, 'A'],
  [0x08, 'G'],
];
const singleRightMods: [number, string][] = [
  [0x01, 'RCTL'],
  [0x02, 'RSFT'],
  [0x04, 'RALT'],
  [0x08, 'RGUI'],
];
const comboNames: Record<number, string> = {
  0x0a: 'LSG',
  0x0c: 'LAG',
  0x1a: 'RSG',
  0x1c: 'RAG',
  0x05: 'LCA',
  0x06: 'LSA',
  0x16: 'RSA',
  0x13: 'RCS',
  0x0d: 'LCAG',
  0x07: 'MEH',
  0x0f: 'HYPR',
};

type LayerFn = 'TO' | 'MO' | 'DF' | 'TG' | 'OSL' | 'TT' | 'PDF';

const layerFnRanges: [LayerFn, string][] = [
  ['TO', '_QK_TO'],
  ['MO', '_QK_MOMENTARY'],
  ['DF', '_QK_DEF_LAYER'],
  ['TG', '_QK_TOGGLE_LAYER'],
  ['OSL', '_QK_ONE_SHOT_LAYER'],
  ['TT', '_QK_LAYER_TAP_TOGGLE'],
  ['PDF', '_QK_PERSISTENT_DEF_LAYER'],
];

export type DecodedKeycode =
  | {kind: 'basic'; name: string}
  | {kind: 'named'; name: string}
  | {kind: 'mods'; mods: number; key: number}
  | {kind: 'layer'; fn: LayerFn; layer: number}
  | {kind: 'layerTap'; layer: number; key: number}
  | {kind: 'modTap'; mods: number; key: number}
  | {kind: 'layerMod'; layer: number; mods: number}
  | {kind: 'oneShotMod'; mods: number}
  | {kind: 'macro'; index: number}
  | {kind: 'custom'; index: number}
  | {kind: 'unknown'};

/**
 * Converts between 16-bit keycodes and their textual names for one protocol
 * version. The text form is compatible with VIA's save files and "Any" key.
 */
export class KeycodeCodec {
  private byValue = new Map<number, string>();

  constructor(readonly table: KeycodeTable) {
    for (const [name, value] of Object.entries(table)) {
      if (name.startsWith('_')) continue;
      // Keep the first name for duplicate values (e.g. KC_CLR / KC_CLEAR).
      if (!this.byValue.has(value)) this.byValue.set(value, name);
    }
  }

  static forProtocol(protocol: number) {
    return new KeycodeCodec(getKeycodeTable(protocol));
  }

  private range(name: string): [number, number] | null {
    const start = this.table[name];
    const end = this.table[`${name}_MAX`];
    return start === undefined || end === undefined ? null : [start, end];
  }

  private inRange(value: number, name: string) {
    const r = this.range(name);
    return r !== null && value >= r[0] && value <= r[1];
  }

  /** Name of a basic (8-bit) keycode, or a hex literal. */
  basicName(value: number): string {
    return this.byValue.get(value) ?? hex(value, 2);
  }

  value(name: string): number | undefined {
    return this.table[name];
  }

  get macroBase(): number {
    return this.table._QK_MACRO;
  }

  get customBase(): number {
    return this.table._QK_KB;
  }

  decode(value: number): DecodedKeycode {
    const named = this.byValue.get(value);
    if (named !== undefined) return value <= 0xff ? {kind: 'basic', name: named} : {kind: 'named', name: named};
    for (const [fn, rangeName] of layerFnRanges) {
      if (this.inRange(value, rangeName)) return {kind: 'layer', fn, layer: value - this.table[rangeName]};
    }
    if (this.inRange(value, '_QK_MACRO')) return {kind: 'macro', index: value - this.table._QK_MACRO};
    if (this.inRange(value, '_QK_KB')) return {kind: 'custom', index: value - this.table._QK_KB};
    if (this.inRange(value, '_QK_MODS')) return {kind: 'mods', mods: (value >> 8) & 0x1f, key: value & 0xff};
    if (this.inRange(value, '_QK_MOD_TAP')) {
      return {kind: 'modTap', mods: (value >> 8) & 0x1f, key: value & 0xff};
    }
    if (this.inRange(value, '_QK_LAYER_TAP')) {
      return {kind: 'layerTap', layer: (value >> 8) & 0x0f, key: value & 0xff};
    }
    if (this.inRange(value, '_QK_LAYER_MOD')) {
      const mask = this.table._QK_LAYER_MOD_MASK;
      const shift = Math.log2(mask + 1);
      const rest = value - this.table._QK_LAYER_MOD;
      return {kind: 'layerMod', layer: rest >> shift, mods: rest & mask};
    }
    if (this.inRange(value, '_QK_ONE_SHOT_MOD')) {
      return {kind: 'oneShotMod', mods: value - this.table._QK_ONE_SHOT_MOD};
    }
    return {kind: 'unknown'};
  }

  /** Canonical text form, e.g. "KC_A", "MO(1)", "LT(2,KC_SPC)", "C(S(KC_T))". */
  format(value: number): string {
    const d = this.decode(value);
    switch (d.kind) {
      case 'basic':
      case 'named':
        return d.name;
      case 'layer':
        return `${d.fn}(${d.layer})`;
      case 'macro':
        return `MACRO(${d.index})`;
      case 'custom':
        return `CUSTOM(${d.index})`;
      case 'mods':
        return formatModWrapped(d.mods, this.basicName(d.key));
      case 'modTap':
        return `MT(${formatModMask(d.mods)},${this.basicName(d.key)})`;
      case 'layerTap':
        return `LT(${d.layer},${this.basicName(d.key)})`;
      case 'layerMod':
        return `LM(${d.layer},${formatModMask(d.mods)})`;
      case 'oneShotMod':
        return `OSM(${formatModMask(d.mods)})`;
      case 'unknown':
        return hex(value);
    }
  }

  /** Parses a keycode expression. Returns null when it is not valid for this protocol. */
  parse(input: string): number | null {
    const raw = input.trim().replace(/\s+/g, '');
    // A few names are mixed case (MIDI sharps such as MI_Cs), so try verbatim first.
    if (raw && !raw.startsWith('_') && this.table[raw] !== undefined) return this.table[raw];
    const text = raw.toUpperCase();
    if (!text) return null;
    if (/^0X[0-9A-F]{1,4}$/.test(text)) return Number.parseInt(text.slice(2), 16);
    const direct = this.table[text];
    if (direct !== undefined && !text.startsWith('_')) return direct;
    const alias = keycodeAliases[text];
    if (alias && alias !== text) return this.parse(alias);

    const call = /^([A-Z_]+)\((.*)\)$/.exec(text);
    if (!call) return null;
    const [, fn, argText] = call;
    const args = splitArgs(argText);

    const layerFn = layerFnRanges.find(([name]) => name === fn);
    if (layerFn) {
      const range = this.range(layerFn[1]);
      const layer = parseIndex(args[0]);
      if (!range || layer === null || args.length !== 1 || range[0] + layer > range[1]) return null;
      return range[0] + layer;
    }

    switch (fn) {
      case 'MACRO':
      case 'M':
      case 'CUSTOM':
      case 'USER': {
        const rangeName = fn === 'MACRO' || fn === 'M' ? '_QK_MACRO' : '_QK_KB';
        const range = this.range(rangeName);
        const index = parseIndex(args[0]);
        if (!range || index === null || range[0] + index > range[1]) return null;
        return range[0] + index;
      }
      case 'LT': {
        const layer = parseIndex(args[0]);
        const key = this.parseBasic(args[1]);
        if (layer === null || layer > 15 || key === null || args.length !== 2) return null;
        return this.table._QK_LAYER_TAP | (layer << 8) | key;
      }
      case 'MT': {
        const mods = parseModMask(args[0]);
        const key = this.parseBasic(args[1]);
        if (!mods || key === null || args.length !== 2) return null;
        return this.table._QK_MOD_TAP | ((mods & 0x1f) << 8) | key;
      }
      case 'LM': {
        const layer = parseIndex(args[0]);
        const mods = parseModMask(args[1]);
        const mask = this.table._QK_LAYER_MOD_MASK;
        if (layer === null || !mods || args.length !== 2) return null;
        const shift = Math.log2(mask + 1);
        const value = this.table._QK_LAYER_MOD + (layer << shift) + (mods & mask);
        return value <= this.table._QK_LAYER_MOD_MAX ? value : null;
      }
      case 'OSM': {
        const mods = parseModMask(args[0]);
        if (!mods || args.length !== 1) return null;
        return this.table._QK_ONE_SHOT_MOD + (mods & 0x1f);
      }
    }

    const wrapper = modWrappers[fn];
    if (wrapper !== undefined && args.length === 1) {
      const inner = this.parse(args[0]);
      if (inner === null) return null;
      // Nested wrappers accumulate; the innermost must be a basic keycode.
      if (inner <= 0xff) return (wrapper << 8) | inner;
      if (inner >= 0x0100 && inner <= 0x1fff) {
        const innerMods = (inner >> 8) & 0x1f;
        const combined = combineMods(wrapper, innerMods);
        return combined === null ? null : (combined << 8) | (inner & 0xff);
      }
    }
    return null;
  }

  private parseBasic(text: string | undefined): number | null {
    if (!text) return null;
    const value = this.parse(text);
    return value !== null && value <= 0xff ? value : null;
  }
}

const splitArgs = (text: string): string[] => {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      args.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current || args.length) args.push(current);
  return args;
};

const parseIndex = (text: string | undefined): number | null => {
  if (text === undefined || !/^\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
};

const parseModMask = (text: string | undefined): number => {
  if (!text) return 0;
  let mods = 0;
  for (const part of text.split('|')) {
    const mask = modMasks[part];
    if (mask === undefined) return 0;
    mods |= mask;
  }
  return mods;
};

/** Left and right modifiers cannot be mixed inside one QMK keycode. */
const combineMods = (a: number, b: number): number | null => {
  if ((a & ModBit.RIGHT) !== (b & ModBit.RIGHT)) return null;
  return a | b;
};

export const formatModMask = (mods: number): string => {
  const right = mods & ModBit.RIGHT;
  const names = (right ? ['MOD_RCTL', 'MOD_RSFT', 'MOD_RALT', 'MOD_RGUI'] : ['MOD_LCTL', 'MOD_LSFT', 'MOD_LALT', 'MOD_LGUI'])
    .filter((_, i) => mods & (1 << i));
  return names.join('|') || 'MOD_LCTL';
};

const formatModWrapped = (mods: number, inner: string): string => {
  const combo = comboNames[mods];
  if (combo) return `${combo}(${inner})`;
  const singles = mods & ModBit.RIGHT ? singleRightMods : singleLeftMods;
  const wrappers = singles.filter(([bit]) => mods & bit).map(([, name]) => name);
  if (wrappers.length === 0) return inner;
  return wrappers.reduceRight((acc, name) => `${name}(${acc})`, inner);
};

/** Human readable modifier names, e.g. ["Ctrl", "Shift"]. Right mods are prefixed with R. */
export const modNames = (mods: number, os: 'mac' | 'other' = 'other'): string[] => {
  const right = mods & ModBit.RIGHT ? 'R' : '';
  const labels = os === 'mac' ? ['⌃', '⇧', '⌥', '⌘'] : ['Ctrl', 'Shift', 'Alt', 'Win'];
  return labels.filter((_, i) => mods & (1 << i)).map((label) => (os === 'mac' ? label : right + label));
};
