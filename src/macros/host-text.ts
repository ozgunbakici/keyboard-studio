import type {KeycodeCodec} from '@/keycodes/codec';
import {hostLayouts, isDeadStroke, type HostLayout} from '@/keycodes/host-layouts';
import type {Macro, MacroAction} from '@/via/macro-bytes';

/**
 * Bridges "the text I want on screen" and what a QMK macro actually sends.
 *
 * The firmware types plain macro text through a US lookup table, so on a
 * Turkish Q computer "@" comes out as "'" and "i" as "ı", and on a Mac with an
 * ISO keyboard "`" comes out as "§". These helpers convert intended text into
 * key presses for the computer's layout (including AltGr/Option levels and
 * dead-key accents), simulate what a stored macro will type, and recover the
 * intended text from a stored macro.
 */

const SHIFT = 0x02;
const ALTGR = 0x14; // Right Alt: AltGr on Windows, right Option on macOS

const KC = {
  LSFT: 0xe1,
  RSFT: 0xe5,
  RALT: 0xe6,
  SPC: 0x2c,
  ENT: 0x28,
  TAB: 0x2b,
  BSPC: 0x2a,
};

/** A key with Shift and/or AltGr; `index` is its level in the layout table. */
type Stroke = {key: string; mods: number; index: number};

// Basic keycode values for the names used in host layout tables.
const basicValues: Record<string, number> = {
  ...Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c, i) => [`KC_${c}`, 0x04 + i])),
  KC_1: 0x1e,
  KC_2: 0x1f,
  KC_3: 0x20,
  KC_4: 0x21,
  KC_5: 0x22,
  KC_6: 0x23,
  KC_7: 0x24,
  KC_8: 0x25,
  KC_9: 0x26,
  KC_0: 0x27,
  KC_MINS: 0x2d,
  KC_EQL: 0x2e,
  KC_LBRC: 0x2f,
  KC_RBRC: 0x30,
  KC_BSLS: 0x31,
  KC_NUHS: 0x32,
  KC_SCLN: 0x33,
  KC_QUOT: 0x34,
  KC_GRV: 0x35,
  KC_COMM: 0x36,
  KC_DOT: 0x37,
  KC_SLSH: 0x38,
  KC_NUBS: 0x64,
};
const basicNames = new Map(Object.entries(basicValues).map(([name, value]) => [value, name]));

const levels: [index: number, mods: number][] = [
  [0, 0],
  [1, SHIFT],
  [2, ALTGR],
  [3, SHIFT | ALTGR],
];

/** What the firmware sends for one plain ASCII character (QMK's US send_string table). */
const usStroke = (() => {
  const map = new Map<string, Stroke>();
  for (const [key, output] of Object.entries(hostLayouts.us.keys)) {
    if (key === 'KC_NUHS' || key === 'KC_NUBS') continue; // QMK maps \ and | to KC_BSLS
    if (output[0] && !map.has(output[0])) map.set(output[0], {key, mods: 0, index: 0});
    if (output[1] && !map.has(output[1])) map.set(output[1], {key, mods: SHIFT, index: 1});
  }
  return map;
})();

const specialChars: Record<string, number> = {'\n': KC.ENT, '\t': KC.TAB, ' ': KC.SPC};

const levelOf = (mods: number) => ((mods & ALTGR) === ALTGR ? 2 : 0) + (mods & SHIFT ? 1 : 0);

/** Output of a stroke on the host, or null when the modifiers are not text levels. */
const output = (host: HostLayout, key: string, mods: number): {char: string; dead: boolean} | null => {
  if (mods & ~(SHIFT | ALTGR)) return null;
  const index = levelOf(mods);
  const char = host.keys[key]?.[index];
  return char ? {char, dead: isDeadStroke(host, key, index)} : null;
};

/** Where a character lives on a host layout: plain strokes first, dead strokes last. */
const findStroke = (host: HostLayout, char: string, wantDead: boolean): Stroke | null => {
  for (const [index, mods] of levels) {
    for (const [key, out] of Object.entries(host.keys)) {
      if (out[index] === char && basicValues[key] !== undefined && isDeadStroke(host, key, index) === wantDead) {
        return {key, mods, index};
      }
    }
  }
  return null;
};

export type CompileResult = {macro: Macro; unsupported: string[]};

/** Converts intended text into macro actions that produce it on `host`. */
export const compileText = (text: string, host: HostLayout): CompileResult => {
  const actions: MacroAction[] = [];
  const unsupported: string[] = [];
  const pushText = (char: string) => {
    const last = actions[actions.length - 1];
    if (last?.type === 'text') last.text += char;
    else actions.push({type: 'text', text: char});
  };
  // Consecutive strokes that share modifiers are wrapped in one down/up pair.
  // "as" keeps TypeScript from narrowing to null: flush() reassigns it.
  let group = null as {mods: number; keys: number[]} | null;
  const flush = () => {
    if (!group) return;
    const mods: number[] = [];
    if (group.mods & SHIFT) mods.push(KC.LSFT);
    if ((group.mods & ALTGR) === ALTGR) mods.push(KC.RALT);
    mods.forEach((keycode) => actions.push({type: 'down', keycode}));
    group.keys.forEach((keycode) => actions.push({type: 'tap', keycode}));
    [...mods].reverse().forEach((keycode) => actions.push({type: 'up', keycode}));
    group = null;
  };
  const press = (stroke: Stroke) => {
    if (group && group.mods !== stroke.mods) flush();
    group ??= {mods: stroke.mods, keys: []};
    group.keys.push(basicValues[stroke.key]);
  };

  /** Types a character that needs no dead key; false when the layout has no plain stroke for it. */
  const typePlain = (char: string): boolean => {
    if (specialChars[char] !== undefined) {
      flush();
      pushText(char);
      return true;
    }
    // Cheapest: plain macro text, when the firmware's US stroke already types it.
    const firmware = usStroke.get(char);
    const typed = firmware ? output(host, firmware.key, firmware.mods) : null;
    if (typed && typed.char === char && !typed.dead) {
      flush();
      pushText(char);
      return true;
    }
    const plain = findStroke(host, char, false);
    if (!plain) return false;
    press(plain);
    return true;
  };

  for (const char of text) {
    if (typePlain(char)) continue;
    // A dead key prints its accent when followed by a space.
    const dead = findStroke(host, char, true);
    if (dead) {
      press(dead);
      flush();
      actions.push({type: 'tap', keycode: KC.SPC});
      continue;
    }
    // Accented letters: dead key, then the base letter (ü = ¨ then u on a Mac).
    const composed = host.compose[char];
    const accent = composed ? findStroke(host, composed[0], true) : null;
    if (composed && accent && findStroke(host, composed[1], false)) {
      press(accent);
      flush();
      typePlain(composed[1]);
      continue;
    }
    flush();
    unsupported.push(char);
  }
  flush();
  return {macro: actions, unsupported: [...new Set(unsupported)]};
};

/** Compiles every text action of an intended macro for the host layout. */
export const compileMacro = (macro: Macro, host: HostLayout): CompileResult => {
  const out: MacroAction[] = [];
  const unsupported: string[] = [];
  for (const action of macro) {
    if (action.type !== 'text') {
      out.push({...action});
      continue;
    }
    const compiled = compileText(action.text, host);
    unsupported.push(...compiled.unsupported);
    for (const a of compiled.macro) {
      const last = out[out.length - 1];
      if (a.type === 'text' && last?.type === 'text') last.text += a.text;
      else out.push(a);
    }
  }
  return {macro: out, unsupported: [...new Set(unsupported)]};
};

const keyToken = (keycode: number, codec?: KeycodeCodec) => {
  switch (keycode) {
    case KC.ENT:
      return '\n';
    case KC.TAB:
      return '\t';
    case KC.SPC:
      return ' ';
    case KC.BSPC:
      return '⌫';
    default:
      return `[${(codec?.basicName(keycode) ?? `0x${keycode.toString(16)}`).replace(/^KC_/, '')}]`;
  }
};

const modBits: Record<number, number> = {0xe0: 0x01, 0xe1: 0x02, 0xe2: 0x04, 0xe3: 0x08, 0xe4: 0x11, 0xe5: 0x12, 0xe6: 0x14, 0xe7: 0x18};
const modNames = (host: HostLayout): Record<number, string> =>
  host.os === 'mac'
    ? {0xe0: '⌃', 0xe1: '⇧', 0xe2: '⌥', 0xe3: '⌘', 0xe4: '⌃', 0xe5: '⇧', 0xe6: '⌥', 0xe7: '⌘'}
    : {0xe0: 'Ctrl', 0xe1: 'Shift', 0xe2: 'Alt', 0xe3: 'Win', 0xe4: 'Ctrl', 0xe5: 'Shift', 0xe6: 'AltGr', 0xe7: 'Win'};

/**
 * Replays key events against a host layout and its dead keys. Shared by the
 * simulator (what appears on screen) and the decompiler (intended text).
 */
class Typist {
  held = 0;
  heldKeys = new Set<number>();
  pendingDead: string | null = null;
  constructor(
    private host: HostLayout,
    private emitText: (text: string) => void,
  ) {}

  /** Returns false when the stroke is not text (a shortcut or special key). */
  stroke(key: string | undefined, extraMods = 0): boolean {
    const result = key ? output(this.host, key, this.held | extraMods) : null;
    if (!result) return false;
    if (result.dead) {
      if (this.pendingDead) this.emitText(this.pendingDead);
      this.pendingDead = result.char;
      return true;
    }
    this.emitChar(result.char);
    return true;
  }

  emitChar(char: string) {
    if (this.pendingDead) {
      const dead = this.pendingDead;
      this.pendingDead = null;
      if (char === ' ') {
        this.emitText(dead);
        return;
      }
      const combined = Object.entries(this.host.compose).find(([, [accent, base]]) => accent === dead && base === char)?.[0];
      this.emitText(combined ?? dead + char);
      return;
    }
    this.emitText(char);
  }

  flushDead() {
    if (this.pendingDead) this.emitText(this.pendingDead);
    this.pendingDead = null;
  }

  down(keycode: number) {
    this.held |= modBits[keycode];
    this.heldKeys.add(keycode);
  }

  up(keycode: number) {
    this.heldKeys.delete(keycode);
    this.held = [...this.heldKeys].reduce((acc, code) => acc | modBits[code], 0);
  }
}

/**
 * Text a stored macro produces on `host`. Shortcuts and special keys appear as
 * [Ctrl+C] style tokens, delays as [250 ms].
 */
export const simulateMacro = (macro: Macro, host: HostLayout, codec?: KeycodeCodec): string => {
  let out = '';
  const typist = new Typist(host, (text) => (out += text));
  const names = modNames(host);
  const special = (keycode: number) => {
    typist.flushDead();
    const nonText = typist.held & ~(SHIFT | ALTGR);
    if (!nonText && [KC.ENT, KC.TAB, KC.SPC, KC.BSPC].includes(keycode)) {
      if (keycode === KC.SPC) typist.emitChar(' ');
      else out += keyToken(keycode, codec);
      return;
    }
    const key = basicNames.get(keycode);
    const base = key ? (output(host, key, 0)?.char.toLocaleUpperCase('tr-TR') ?? key.replace(/^KC_/, '')) : keyToken(keycode, codec).replace(/[[\]]/g, '');
    const mods = [...new Set([...typist.heldKeys].sort().map((code) => names[code]))];
    out += `[${[...mods, base].join(host.os === 'mac' ? '' : '+')}]`;
  };
  const tap = (keycode: number, extraMods = 0) => {
    if (keycode === KC.SPC && !(typist.held & ~(SHIFT | ALTGR))) {
      typist.emitChar(' ');
      return;
    }
    if (!typist.stroke(basicNames.get(keycode), extraMods)) special(keycode);
  };

  for (const action of macro) {
    switch (action.type) {
      case 'text':
        for (const char of action.text) {
          if (specialChars[char] !== undefined) {
            tap(specialChars[char]);
            continue;
          }
          const stroke = usStroke.get(char);
          if (stroke) tap(basicValues[stroke.key], stroke.mods);
          else out += '�';
        }
        break;
      case 'tap':
        tap(action.keycode);
        break;
      case 'down':
        if (modBits[action.keycode]) typist.down(action.keycode);
        else tap(action.keycode);
        break;
      case 'up':
        if (modBits[action.keycode]) typist.up(action.keycode);
        break;
      case 'delay':
        typist.flushDead();
        out += `[${action.ms} ms]`;
        break;
    }
  }
  typist.flushDead();
  return out;
};

const isTextModifier = (keycode: number) => keycode === KC.LSFT || keycode === KC.RSFT || keycode === KC.RALT;

/**
 * Recovers editable text from a stored macro: key presses that type a
 * character on `host` become text again, everything else stays an action.
 */
export const decompileMacro = (macro: Macro, host: HostLayout): Macro => {
  const out: MacroAction[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += text;
    else out.push({type: 'text', text});
  };
  const typist = new Typist(host, pushText);
  // Shift/AltGr presses that only produced text are dropped; they are restored
  // in front of the first non-text action that happens while they are held.
  const pendingDowns: MacroAction[] = [];
  // Keys other than Shift/AltGr currently held (Ctrl, Win...): presses are shortcuts.
  let heldNonText = 0;

  const keep = (action: MacroAction) => {
    typist.flushDead();
    out.push(...pendingDowns.splice(0));
    out.push({...action});
  };

  for (const action of macro) {
    switch (action.type) {
      case 'text':
        for (const char of action.text) {
          if (specialChars[char] !== undefined && !heldNonText) {
            typist.emitChar(char);
            continue;
          }
          const stroke = usStroke.get(char);
          if (stroke && !heldNonText && typist.stroke(stroke.key, stroke.mods)) continue;
          typist.flushDead();
          pushText(char);
        }
        break;
      case 'down':
        if (isTextModifier(action.keycode) && !heldNonText) {
          typist.down(action.keycode);
          pendingDowns.push(action);
        } else {
          if (modBits[action.keycode]) heldNonText++;
          keep(action);
        }
        break;
      case 'up':
        if (isTextModifier(action.keycode) && pendingDowns.some((d) => d.type === 'down' && d.keycode === action.keycode)) {
          typist.up(action.keycode);
          pendingDowns.splice(
            pendingDowns.findIndex((d) => d.type === 'down' && d.keycode === action.keycode),
            1,
          );
        } else {
          if (isTextModifier(action.keycode)) typist.up(action.keycode);
          else if (modBits[action.keycode]) heldNonText = Math.max(0, heldNonText - 1);
          keep(action);
        }
        break;
      case 'tap': {
        if (!heldNonText) {
          if (action.keycode === KC.SPC || action.keycode === KC.ENT || action.keycode === KC.TAB) {
            if (!(typist.held & ~(SHIFT | ALTGR)) && !(typist.held & SHIFT && action.keycode !== KC.SPC)) {
              typist.emitChar(keyToken(action.keycode));
              break;
            }
          } else if (typist.stroke(basicNames.get(action.keycode))) {
            break;
          }
        }
        keep(action);
        break;
      }
      case 'delay':
        keep(action);
        break;
    }
  }
  typist.flushDead();
  out.push(...pendingDowns);
  return out;
};

/** Whether plain macro text would be typed differently on this host layout. */
export const textNeedsConversion = (text: string, host: HostLayout) =>
  [...text].some((char) => {
    if (specialChars[char] !== undefined) return false;
    const stroke = usStroke.get(char);
    const typed = stroke ? output(host, stroke.key, stroke.mods) : null;
    return !typed || typed.dead || typed.char !== char;
  });

/** Characters of `text` the host layout cannot type at all. */
export const untypeableChars = (text: string, host: HostLayout) => compileText(text, host).unsupported;
