import {describe, expect, it} from 'vitest';
import {hostLayouts} from '@/keycodes/host-layouts';
import {decodeMacros, encodeMacros} from '@/via/macro-bytes';
import {compileMacro, compileText, decompileMacro, simulateMacro, textNeedsConversion} from './host-text';

const trq = hostLayouts['tr-q'];
const trf = hostLayouts['tr-f'];
const us = hostLayouts.us;

describe('macro text on the host layout', () => {
  it('shows why plain VIA macros break on Turkish Q', () => {
    expect(simulateMacro([{type: 'text', text: 'ad@gmail.com'}], trq)).toBe("ad'gmaılçcom");
    expect(simulateMacro([{type: 'text', text: 'ad@gmail.com'}], us)).toBe('ad@gmail.com');
    expect(textNeedsConversion('ad@gmail.com', trq)).toBe(true);
    expect(textNeedsConversion('merhaba 123', trq)).toBe(false);
  });

  const samples = [
    'ad@gmail.com',
    'Şişli, Üsküdar; Çağlayan & Ödemiş!',
    'İyi günler: ığüşöç ĞÜŞİÖÇI',
    'if (a[0] == {x: 1}) { return "ok"; } // \\ | ~ ` ^',
    'Fiyat: 100₺ veya 5€ #etiket $değişken 50%',
    'satır 1\nsatır 2\tsekme',
  ];

  for (const host of [trq, trf, us]) {
    it(`types every sample exactly on ${host.short}`, () => {
      for (const text of samples) {
        const {macro, unsupported} = compileText(text, host);
        const expected = [...text].filter((c) => !unsupported.includes(c)).join('');
        expect(simulateMacro(macro, host), `${host.short}: ${text}`).toBe(expected);
      }
    });
  }

  it('keeps layout-neutral characters as cheap plain text', () => {
    const {macro} = compileText('merhaba 2024', trq);
    expect(macro).toEqual([{type: 'text', text: 'merhaba 2024'}]);
  });

  it('wraps runs of shifted keys in a single shift press', () => {
    const {macro} = compileText('ŞĞÜ', trq);
    expect(macro.filter((a) => a.type === 'down')).toHaveLength(1);
    expect(macro.filter((a) => a.type === 'tap')).toHaveLength(3);
  });

  it('reports characters the layout cannot type', () => {
    expect(compileText('selam 😀', trq).unsupported).toEqual(['😀']);
  });

  it('recovers the intended text from what is stored on the keyboard', () => {
    for (const host of [trq, trf]) {
      for (const text of samples) {
        const {macro, unsupported} = compileText(text, host);
        // Round-trip through the real byte format as well.
        const stored = decodeMacros(encodeMacros([macro], 12), 1, 12)[0];
        const recovered = decompileMacro(stored, host);
        const expected = [...text].filter((c) => !unsupported.includes(c)).join('');
        expect(recovered, `${host.short}: ${text}`).toEqual([{type: 'text', text: expected}]);
      }
    }
  });

  it('keeps shortcuts as actions when decompiling', () => {
    const ctrlC = [
      {type: 'down', keycode: 0xe0},
      {type: 'tap', keycode: 0x06},
      {type: 'up', keycode: 0xe0},
    ] as const;
    expect(decompileMacro([...ctrlC], trq)).toEqual([...ctrlC]);
    expect(simulateMacro([...ctrlC], trq)).toBe('[Ctrl+C]');
  });

  it('compiles mixed macros and leaves non-text actions alone', () => {
    const {macro} = compileMacro(
      [
        {type: 'text', text: 'ş'},
        {type: 'delay', ms: 100},
        {type: 'tap', keycode: 0x28},
      ],
      trq,
    );
    expect(macro).toEqual([
      {type: 'tap', keycode: 0x33},
      {type: 'delay', ms: 100},
      {type: 'tap', keycode: 0x28},
    ]);
  });
});
