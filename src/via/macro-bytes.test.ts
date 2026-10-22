import {describe, expect, it} from 'vitest';
import {decodeMacros, encodeMacro, encodeMacros, MacroEncodeError} from './macro-bytes';

describe('macro byte format', () => {
  it('matches the QMK send_string encoding used by VIA (protocol >= 11)', () => {
    expect(
      encodeMacro(
        [
          {type: 'down', keycode: 0xe0},
          {type: 'tap', keycode: 0x06},
          {type: 'up', keycode: 0xe0},
          {type: 'delay', ms: 120},
          {type: 'text', text: 'Hi\n'},
        ],
        12,
      ),
    ).toEqual([1, 2, 0xe0, 1, 1, 0x06, 1, 3, 0xe0, 1, 4, 0x31, 0x32, 0x30, 0x7c, 0x48, 0x69, 0x0a]);
  });

  it('uses the legacy unprefixed format before protocol 11', () => {
    expect(encodeMacro([{type: 'tap', keycode: 0x28}], 10)).toEqual([1, 0x28]);
    expect(() => encodeMacro([{type: 'delay', ms: 10}], 10)).toThrow(MacroEncodeError);
    expect(decodeMacros([1, 0x28, 0x41, 0, 0], 2, 10)).toEqual([
      [
        {type: 'tap', keycode: 0x28},
        {type: 'text', text: 'A'},
      ],
      [],
    ]);
  });

  it('rejects characters the firmware cannot type', () => {
    expect(() => encodeMacro([{type: 'text', text: 'ğ'}], 12)).toThrow(MacroEncodeError);
  });

  it('decodes buffers with trailing garbage and missing macros', () => {
    const bytes = [...encodeMacros([[{type: 'text', text: 'x'}]], 12), 0, 0];
    expect(decodeMacros(bytes, 4, 12)).toEqual([[{type: 'text', text: 'x'}], [], [], []]);
  });
});
