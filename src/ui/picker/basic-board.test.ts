import {describe, expect, it} from 'vitest';
import {staticGroups} from '@/keycodes/catalog';
import {KeycodeCodec} from '@/keycodes/codec';
import {basicBoard} from './basic-board';

const codec = KeycodeCodec.forProtocol(12);
const basicCodes = new Set(staticGroups.basic.sections.flatMap((s) => s.keys.map((k) => k.code)));

describe('picker keyboard', () => {
  for (const shape of ['ansi', 'iso'] as const) {
    for (const wide of [true, false]) {
      it(`${shape}, ${wide ? 'wide' : 'narrow'}: every key is a basic keycode, inside the board, without overlaps`, () => {
        const board = basicBoard(shape, wide);
        for (const k of board.keys) {
          expect(basicCodes.has(k.code), k.code).toBe(true);
          expect(codec.parse(k.code), k.code).not.toBeNull();
          expect(k.x + k.w).toBeLessThanOrEqual(board.width);
          expect(k.y + k.h).toBeLessThanOrEqual(board.height);
        }
        expect(new Set(board.keys.map((k) => k.code)).size).toBe(board.keys.length);
        for (const a of board.keys) {
          for (const b of board.keys) {
            if (a === b) continue;
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            expect(overlap, `${a.code} / ${b.code}`).toBe(false);
          }
        }
      });
    }
  }

  it('has the keys of each shape', () => {
    const ansi = new Set(basicBoard('ansi', true).keys.map((k) => k.code));
    const iso = new Set(basicBoard('iso', true).keys.map((k) => k.code));
    expect(ansi.has('KC_BSLS') && !ansi.has('KC_NUBS') && !ansi.has('KC_NUHS')).toBe(true);
    expect(iso.has('KC_NUBS') && iso.has('KC_NUHS') && !iso.has('KC_BSLS')).toBe(true);
    // A full-size board: 104 keys on ANSI, 105 on ISO.
    expect(ansi.size).toBe(104);
    expect(iso.size).toBe(105);
  });
});
