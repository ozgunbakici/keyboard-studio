import {describe, expect, it} from 'vitest';
import {KeycodeCodec} from './codec';
import {hostLayouts} from './host-layouts';
import {keyLabel, type LabelContext} from './labels';

const codec = KeycodeCodec.forProtocol(12);
const ctx = (host: keyof typeof hostLayouts, os: 'mac' | 'other' = 'other'): LabelContext => ({
  codec,
  host: hostLayouts[host],
  os,
});
const label = (code: string, c = ctx('tr-q')) => keyLabel(codec.parse(code)!, c);

describe('key labels', () => {
  it('shows what Turkish Q actually types', () => {
    expect(label('KC_SCLN').main).toBe('Ş');
    expect(label('KC_I').main).toBe('I');
    expect(label('KC_QUOT').main).toBe('İ');
    expect(label('KC_DOT').main).toBe('Ç');
    expect(label('KC_2')).toMatchObject({main: '2', top: "'"});
    expect(label('KC_SLSH')).toMatchObject({main: '.', top: ':'});
  });

  it('resolves shortcuts to characters on the host layout', () => {
    expect(label('RALT(KC_Q)').main).toBe('@');
    expect(label('RALT(KC_7)').main).toBe('{');
    expect(label('S(KC_2)').main).toBe("'");
    expect(label('S(KC_2)', ctx('us')).main).toBe('@');
    expect(label('C(KC_C)')).toMatchObject({main: 'C', top: 'Ctrl', tone: 'special'});
    expect(label('G(KC_C)', ctx('us', 'mac')).top).toBe('⌘');
  });

  it('labels layers, mod-taps and macros', () => {
    expect(label('MO(1)')).toMatchObject({main: 'MO 1', tone: 'layer'});
    expect(label('LT(2,KC_SPC)')).toMatchObject({main: 'Boşluk', sub: 'K2 tut'});
    expect(label('MT(MOD_LCTL,KC_A)')).toMatchObject({main: 'A', sub: 'Ctrl tut'});
    expect(keyLabel(codec.parse('MACRO(2)')!, {...ctx('tr-q'), macroNames: [, , 'İmza']})).toMatchObject({
      main: 'M2',
      sub: 'İmza',
      tone: 'macro',
    });
    expect(label('KC_TRNS').tone).toBe('transparent');
    expect(label('KC_NO').main).toBe('');
  });
});

describe('symbol group', () => {
  it('lists Turkish Q AltGr symbols as single keycodes', async () => {
    const {buildSymbolGroup} = await import('./catalog');
    const group = buildSymbolGroup(hostLayouts['tr-q']);
    const all = group.sections.flatMap((s) => s.keys);
    const find = (char: string) => all.find((key) => key.label === char)?.code;
    expect(find('@')).toBe('RALT(KC_Q)');
    expect(find('{')).toBe('RALT(KC_7)');
    expect(find('|')).toBe('RALT(KC_EQL)');
    expect(find('>')).toBe('S(KC_NUBS)');
    expect(find('?')).toBe('S(KC_MINS)');
    expect(all.every((key) => codec.parse(key.code) !== null)).toBe(true);
    expect(keyLabel(codec.parse(find('@')!)!, ctx('tr-q')).main).toBe('@');
  });
});
