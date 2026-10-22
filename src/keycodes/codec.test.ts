import {describe, expect, it} from 'vitest';
import {KeycodeCodec} from './codec';
import {getKeycodeTable} from './dictionary';

describe('KeycodeCodec', () => {
  for (const protocol of [9, 10, 11, 12, 13]) {
    it(`round-trips every named keycode for protocol ${protocol}`, () => {
      const codec = KeycodeCodec.forProtocol(protocol);
      for (const [name, value] of Object.entries(getKeycodeTable(protocol))) {
        if (name.startsWith('_')) continue;
        expect(codec.parse(codec.format(value)), name).toBe(value);
      }
    });

    it(`round-trips advanced keycodes for protocol ${protocol}`, () => {
      const codec = KeycodeCodec.forProtocol(protocol);
      const expressions = [
        'MO(1)',
        'TG(3)',
        'TO(2)',
        'DF(1)',
        'OSL(4)',
        'TT(2)',
        'LT(1,KC_SPC)',
        'LT(15,KC_ESC)',
        'MT(MOD_LCTL,KC_A)',
        'MT(MOD_LCTL|MOD_LSFT,KC_ESC)',
        'MT(MOD_RALT,KC_ENT)',
        'OSM(MOD_LSFT)',
        'LM(2,MOD_LCTL)',
        'MACRO(0)',
        'MACRO(15)',
        'CUSTOM(3)',
        'C(KC_C)',
        'S(KC_2)',
        'C(S(KC_T))',
        'RALT(KC_Q)',
        'HYPR(KC_F13)',
        'MEH(KC_A)',
        'LSG(KC_S)',
      ];
      for (const expression of expressions) {
        const value = codec.parse(expression);
        expect(value, expression).not.toBeNull();
        expect(codec.parse(codec.format(value!)), expression).toBe(value);
      }
    });
  }

  it('encodes protocol 12 values exactly like QMK', () => {
    const codec = KeycodeCodec.forProtocol(12);
    expect(codec.parse('MO(1)')).toBe(0x5221);
    expect(codec.parse('LT(2,KC_SPC)')).toBe(0x422c);
    expect(codec.parse('MT(MOD_LCTL,KC_A)')).toBe(0x2104);
    expect(codec.parse('MACRO(3)')).toBe(0x7703);
    expect(codec.parse('C(S(KC_T))')).toBe(0x0317);
    expect(codec.parse('LCTL(LSFT(KC_T))')).toBe(0x0317);
    expect(codec.parse('ALGR(KC_Q)')).toBe(0x1414);
    expect(codec.parse('PDF(1)')).toBe(0x52e1);
    expect(codec.parse('CW_TOGG')).toBe(0x7c73);
    expect(codec.parse('QK_BOOT')).toBe(0x7c00);
    expect(codec.parse('0x7C77')).toBe(0x7c77);
  });

  it('formats like VIA so save files stay compatible', () => {
    const codec = KeycodeCodec.forProtocol(12);
    expect(codec.format(0x0317)).toBe('C(S(KC_T))');
    expect(codec.format(0x1414)).toBe('RALT(KC_Q)');
    expect(codec.format(0x0f68)).toBe('HYPR(KC_F13)');
    expect(codec.format(0x2304)).toBe('MT(MOD_LCTL|MOD_LSFT,KC_A)');
    expect(codec.format(0x5221)).toBe('MO(1)');
    expect(codec.format(0x7c77)).toBe('FN_MO13');
    expect(codec.format(0x5a00)).toBe('0x5a00');
  });

  it('accepts deprecated aliases and rejects nonsense', () => {
    const codec = KeycodeCodec.forProtocol(12);
    expect(codec.parse('KC_EXLM')).toBe(codec.parse('S(KC_1)'));
    expect(codec.parse('kc_a')).toBe(4);
    expect(codec.parse('MO(99)')).toBeNull();
    expect(codec.parse('LT(1,MO(2))')).toBeNull();
    expect(codec.parse('C(RALT(KC_A))')).toBeNull();
    expect(codec.parse('FOO')).toBeNull();
    expect(codec.parse('')).toBeNull();
  });

  it('decodes legacy protocol layer and macro ranges', () => {
    const codec = KeycodeCodec.forProtocol(10);
    expect(codec.format(0x5101)).toBe('MO(1)');
    expect(codec.format(0x5f12)).toBe('MACRO(0)');
    expect(codec.decode(0x5f13)).toEqual({kind: 'macro', index: 1});
  });
});
