import type {KeycodeCodec} from '@/keycodes/codec';
import {hostLayouts, type HostLayout} from '@/keycodes/host-layouts';
import type {Macro, MacroAction} from '@/via/macro-bytes';

/**
 * Bridges "the text I want on screen" and what a QMK macro actually sends.
 *
 * The firmware types plain macro text through a US lookup table, so on a
 * Turkish Q computer "@" comes out as "'" and "i" as "ı". These helpers convert
 * intended text into key presses for the computer's layout, simulate what a
 * stored macro will type, and recover intended text from a stored macro.
 */

const SHIFT = 0x02;
const ALTGR = 0x14; // Right Alt / AltGr / right Option

const KC = {
  LSFT: 0xe1,
  RSFT: 0xe5,
  RALT: 0xe6,
  SPC: 0x2c,
  ENT: 0x28,
  TAB: 0x2b,
  BSPC: 0x2a,
};

type Stroke = {key: string; mods: number; dead: boolean};

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

/** What the firmware sends for one plain ASCII character (QMK's US send_string table). */
const usStroke = (() => {
  const map = new Map<string, Stroke>();
  for (const [key, output] of Object.entries(hostLayouts.us.keys)) {
    if (key === 'KC_NUHS' || key === 'KC_NUBS') continue; // QMK maps \ and | to KC_BSLS
    if (output[0] && !map.has(output[0])) map.set(output[0], {key, mods: 0, dead: false});
    if (output[1] && !map.has(output[1])) map.set(output[1], {key, mods: SHIFT, dead: false});
  }
  return map;
})();

const specialChars: Record<string, number> = {'\n': KC.ENT, '\t': KC.TAB, ' ': KC.SPC};

/** Where a character lives on a host layout, preferring the simplest combination. */
const findOnHost = (host: HostLayout, char: string): Stroke | null => {
  for (const [index, mods] of [
    [0, 0],
    [1, SHIFT],
    [2, ALTGR],
    [3, SHIFT | ALTGR],
  ] as const) {
    for (const [key, output] of Object.entries(host.keys)) {
      if (output[index] === char && basicValues[key] !== undefined) {
        // ANSI keyboards have no NUHS/NUBS key mapping issue for taps: the firmware sends the code regardless.
        return {key, mods, dead: host.dead.has(char)};
      }
    }
  }
  return null;
};

const hostOutput = (host: HostLayout, key: string, mods: number): string | null => {
  const output = host.keys[key];
  if (!output) return null;
  const shift = (mods & SHIFT) !== 0;
  const altGr = (mods & ALTGR) === ALTGR;
  if (mods & ~(SHIFT | ALTGR)) return null;
  return output[(altGr ? 2 : 0) + (shift ? 1 : 0)] || null;
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
  // Pending strokes that share the same modifiers are wrapped in one down/up pair.
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

  for (const char of text) {
    if (specialChars[char] !== undefined) {
      flush();
      pushText(char);
      continue;
    }
    const viaFirmware = usStroke.get(char);
    if (viaFirmware && hostOutput(host, viaFirmware.key, viaFirmware.mods) === char) {
      flush();
      pushText(char);
      continue;
    }
    const stroke = findOnHost(host, char);
    if (!stroke) {
      flush();
      unsupported.push(char);
      continue;
    }
    const keycode = basicValues[stroke.key];
    if (stroke.dead) {
      // Dead keys wait for the next key; a space makes them print themselves.
      if (group?.mods !== stroke.mods) flush();
      group ??= {mods: stroke.mods, keys: []};
      group.keys.push(keycode);
      flush();
      actions.push({type: 'tap', keycode: KC.SPC});
      continue;
    }
    if (group && group.mods !== stroke.mods) flush();
    group ??= {mods: stroke.mods, keys: []};
    group.keys.push(keycode);
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

const modTokens: [number, string][] = [
  [0xe0, 'Ctrl'],
  [0xe1, 'Shift'],
  [0xe2, 'Alt'],
  [0xe3, 'Win'],
  [0xe4, 'Ctrl'],
  [0xe5, 'Shift'],
  [0xe6, 'AltGr'],
  [0xe7, 'Win'],
];

const modBits: Record<number, number> = {0xe0: 0x01, 0xe1: 0x02, 0xe2: 0x04, 0xe3: 0x08, 0xe4: 0x11, 0xe5: 0x12, 0xe6: 0x14, 0xe7: 0x18};

/**
 * Text a stored macro produces on `host`. Shortcuts and special keys appear as
 * [Ctrl+C] style tokens, delays as [250 ms].
 */
export const simulateMacro = (macro: Macro, host: HostLayout, codec?: KeycodeCodec): string => {
  let held = 0;
  const heldKeys = new Set<number>();
  let out = '';
  const typeStroke = (key: string | undefined, keycode: number, extraMods: number) => {
    const mods = held | extraMods;
    const char = key ? hostOutput(host, key, mods) : null;
    if (char) {
      out += char;
      return;
    }
    if (!(mods & ~(SHIFT | ALTGR)) && specialToken(keycode)) {
      out += keyToken(keycode, codec);
      return;
    }
    const names = modTokens.filter(([code]) => heldKeys.has(code)).map(([, name]) => name);
    if (extraMods & SHIFT && !names.includes('Shift')) names.push('Shift');
    const base = key ? (hostOutput(host, key, 0)?.toLocaleUpperCase('tr-TR') ?? key.replace(/^KC_/, '')) : keyToken(keycode, codec).replace(/[[\]]/g, '');
    out += `[${[...new Set(names), base].join('+')}]`;
  };
  const specialToken = (keycode: number) => keycode === KC.ENT || keycode === KC.TAB || keycode === KC.SPC || keycode === KC.BSPC;

  for (const action of macro) {
    switch (action.type) {
      case 'text':
        for (const char of action.text) {
          if (specialChars[char] !== undefined) {
            typeStroke(undefined, specialChars[char], 0);
            continue;
          }
          const stroke = usStroke.get(char);
          if (stroke) typeStroke(stroke.key, basicValues[stroke.key], stroke.mods);
          else out += '�';
        }
        break;
      case 'tap':
        typeStroke(basicNames.get(action.keycode), action.keycode, 0);
        break;
      case 'down':
        if (modBits[action.keycode]) {
          held |= modBits[action.keycode];
          heldKeys.add(action.keycode);
        } else {
          typeStroke(basicNames.get(action.keycode), action.keycode, 0);
        }
        break;
      case 'up':
        if (modBits[action.keycode]) {
          heldKeys.delete(action.keycode);
          held = [...heldKeys].reduce((acc, code) => acc | modBits[code], 0);
        }
        break;
      case 'delay':
        out += `[${action.ms} ms]`;
        break;
    }
  }
  // Dead key + space collapses to the accent itself on screen.
  for (const dead of host.dead) out = out.split(`${dead} `).join(dead);
  return out;
};

/**
 * Recovers editable text from a stored macro: key presses that type a
 * character on `host` become text again, everything else stays an action.
 */
export const decompileMacro = (macro: Macro, host: HostLayout): Macro => {
  const out: MacroAction[] = [];
  const pushText = (text: string) => {
    const last = out[out.length - 1];
    if (last?.type === 'text') last.text += text;
    else out.push({type: 'text', text});
  };
  let held = 0;
  // Count of held keys other than Shift/AltGr (Ctrl, Win, letters...): while any
  // is held, presses are shortcuts, not text.
  let heldNonText = 0;
  const pendingDowns: MacroAction[] = [];
  const skip = new Set<number>();
  for (let i = 0; i < macro.length; i++) {
    if (skip.has(i)) continue;
    const action = macro[i];
    if (action.type === 'text') {
      for (const char of action.text) {
        if (specialChars[char] !== undefined) {
          pushText(char);
          continue;
        }
        const stroke = usStroke.get(char);
        const shown = stroke ? hostOutput(host, stroke.key, stroke.mods | held) : null;
        if (shown && !heldNonText) pushText(shown);
        else pushText(char);
      }
      continue;
    }
    if (action.type === 'down' && (action.keycode === KC.LSFT || action.keycode === KC.RSFT || action.keycode === KC.RALT)) {
      held |= action.keycode === KC.RALT ? ALTGR : SHIFT;
      pendingDowns.push(action);
      continue;
    }
    if (action.type === 'up' && (action.keycode === KC.LSFT || action.keycode === KC.RSFT || action.keycode === KC.RALT)) {
      held &= action.keycode === KC.RALT ? ~ALTGR : ~SHIFT;
      // Remove the matching pending down if nothing used the modifier.
      const index = pendingDowns.findIndex((d) => d.type === 'down' && d.keycode === action.keycode);
      if (index >= 0) pendingDowns.splice(index, 1);
      else out.push(action);
      continue;
    }
    if (action.type === 'tap') {
      const name = basicNames.get(action.keycode);
      const char = name ? hostOutput(host, name, held) : null;
      if (char && !heldNonText) {
        pushText(char);
        // A dead key followed by a space prints the accent: drop that space,
        // looking past the Shift/AltGr releases in between.
        if (host.dead.has(char)) {
          let j = i + 1;
          while (macro[j]?.type === 'up' && [KC.LSFT, KC.RSFT, KC.RALT].includes((macro[j] as {keycode: number}).keycode)) j++;
          const space = macro[j];
          if (space?.type === 'tap' && space.keycode === KC.SPC) skip.add(j);
        }
        continue;
      }
      if (!held && (action.keycode === KC.ENT || action.keycode === KC.TAB || action.keycode === KC.SPC)) {
        pushText(keyToken(action.keycode));
        continue;
      }
    }
    if (action.type === 'down') heldNonText++;
    if (action.type === 'up') heldNonText = Math.max(0, heldNonText - 1);
    // Not text: flush held modifiers as real actions and keep the action.
    out.push(...pendingDowns.splice(0));
    out.push({...action});
  }
  out.push(...pendingDowns);
  return out;
};

/** Whether plain macro text would be typed differently on this host layout. */
export const textNeedsConversion = (text: string, host: HostLayout) =>
  [...text].some((char) => {
    if (specialChars[char] !== undefined) return false;
    const stroke = usStroke.get(char);
    return !stroke || hostOutput(host, stroke.key, stroke.mods) !== char;
  });
