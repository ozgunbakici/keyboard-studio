import {Protocol} from './constants';

/**
 * One step of a firmware macro. Keycodes are 8-bit basic keycodes because the
 * QMK send_string interpreter only understands those.
 *
 * `text` is typed by the firmware's US ASCII lookup table, so the host's
 * keyboard layout decides which characters actually appear.
 */
export type MacroAction =
  | {type: 'text'; text: string}
  | {type: 'tap'; keycode: number}
  | {type: 'down'; keycode: number}
  | {type: 'up'; keycode: number}
  | {type: 'delay'; ms: number};

export type Macro = MacroAction[];

// QMK send_string magic codes.
const PREFIX = 0x01;
const TAP = 0x01;
const DOWN = 0x02;
const UP = 0x03;
const DELAY = 0x04;
const DELAY_TERMINATOR = 0x7c; // '|'
const TERMINATOR = 0x00;

export const MAX_DELAY_MS = 9999;

export const supportsDelays = (protocol: number) => protocol >= Protocol.V3Definitions;

/** Characters the firmware can type from plain text: printable ASCII, newline and tab. */
export const isFirmwareTypeable = (char: string) => {
  const code = char.charCodeAt(0);
  return char.length === 1 && (code === 0x0a || code === 0x09 || (code >= 0x20 && code <= 0x7e));
};

export class MacroEncodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MacroEncodeError';
  }
}

/** Parses the raw macro buffer into `count` macros. */
export const decodeMacros = (bytes: number[], count: number, protocol: number): Macro[] => {
  const macros: Macro[] = [];
  let current: Macro = [];
  const pushText = (char: string) => {
    const last = current[current.length - 1];
    if (last?.type === 'text') last.text += char;
    else current.push({type: 'text', text: char});
  };
  const legacy = !supportsDelays(protocol);
  let i = 0;
  while (i < bytes.length && macros.length < count) {
    const byte = bytes[i];
    if (byte === TERMINATOR) {
      macros.push(current);
      current = [];
      i++;
      continue;
    }
    // Protocol < 11 stores actions without the 0x01 prefix.
    const action = legacy ? byte : byte === PREFIX ? bytes[i + 1] : undefined;
    if (action !== undefined && (legacy ? action >= TAP && action <= UP : true)) {
      const at = legacy ? i + 1 : i + 2;
      switch (action) {
        case TAP:
        case DOWN:
        case UP: {
          const keycode = bytes[at] ?? 0;
          current.push({type: action === TAP ? 'tap' : action === DOWN ? 'down' : 'up', keycode});
          i = at + 1;
          continue;
        }
        case DELAY: {
          let j = at;
          let digits = '';
          while (j < bytes.length && bytes[j] !== DELAY_TERMINATOR && bytes[j] !== TERMINATOR) {
            digits += String.fromCharCode(bytes[j]);
            j++;
          }
          current.push({type: 'delay', ms: Number.parseInt(digits, 10) || 0});
          i = bytes[j] === DELAY_TERMINATOR ? j + 1 : j;
          continue;
        }
        default:
          // Unknown magic code: skip prefix and code, as the firmware would.
          i = at;
          continue;
      }
    }
    pushText(String.fromCharCode(byte));
    i++;
  }
  // A buffer can be shorter than expected (fresh EEPROM); pad with empties.
  while (macros.length < count) macros.push([]);
  return macros;
};

/** Serialises one macro (without terminator). */
export const encodeMacro = (macro: Macro, protocol: number): number[] => {
  const legacy = !supportsDelays(protocol);
  const out: number[] = [];
  for (const action of macro) {
    switch (action.type) {
      case 'text':
        for (const char of action.text) {
          if (!isFirmwareTypeable(char)) {
            throw new MacroEncodeError(`"${char}" karakteri doğrudan metin olarak yazılamaz`);
          }
          out.push(char.charCodeAt(0));
        }
        break;
      case 'tap':
      case 'down':
      case 'up': {
        if (action.keycode < 0 || action.keycode > 0xff) {
          throw new MacroEncodeError('Makrolarda yalnızca temel tuş kodları kullanılabilir');
        }
        const code = action.type === 'tap' ? TAP : action.type === 'down' ? DOWN : UP;
        if (!legacy) out.push(PREFIX);
        out.push(code, action.keycode);
        break;
      }
      case 'delay': {
        if (legacy) throw new MacroEncodeError('Bu klavyenin firmware sürümü makro beklemelerini desteklemiyor');
        const ms = Math.max(0, Math.min(MAX_DELAY_MS, Math.round(action.ms)));
        out.push(PREFIX, DELAY, ...String(ms).split('').map((c) => c.charCodeAt(0)), DELAY_TERMINATOR);
        break;
      }
    }
  }
  return out;
};

export const encodeMacros = (macros: Macro[], protocol: number): number[] =>
  macros.flatMap((macro) => [...encodeMacro(macro, protocol), TERMINATOR]);

export const macroByteLength = (macro: Macro, protocol: number) => encodeMacro(macro, protocol).length + 1;
