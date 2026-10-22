import type {KeyboardDefinitionV3} from '@the-via/reader';
import {KeycodeCodec} from '@/keycodes/codec';
import {encodeMacros, type Macro} from '@/via/macro-bytes';
import {VirtualKeyboard} from './virtual-keyboard';

const A = '#cccccc';
const M = '#aaaaaa';
const X = '#777777';
const knob = (rowCol: string, encoder: number) => `${rowCol}\n\n\n\n\n\n\n\n\ne${encoder}`;

/**
 * A 75% board with a knob, a split-backspace option and an ISO left shift
 * option, so every part of the UI has something to show without hardware.
 */
export const demoDefinitionSource: KeyboardDefinitionV3 = {
  name: 'Klavye Stüdyo Demo 75',
  vendorId: '0x4B53',
  productId: '0x0075',
  matrix: {rows: 6, cols: 16},
  menus: ['qmk_rgb_matrix'],
  keycodes: ['qmk_lighting'] as KeyboardDefinitionV3['keycodes'],
  customKeycodes: [{name: 'OS modu', title: 'Mac / Windows modunu değiştir', shortName: 'OS'}],
  layouts: {
    labels: ['Bölünmüş Backspace', ['Sol Shift', 'ANSI (2.25u)', 'ISO (1.25u + < >)']],
    keymap: [
      [
        {c: X},
        '0,0',
        {x: 0.25, c: A},
        '0,1',
        '0,2',
        '0,3',
        '0,4',
        {x: 0.25, c: M},
        '0,5',
        '0,6',
        '0,7',
        '0,8',
        {x: 0.25, c: A},
        '0,9',
        '0,10',
        '0,11',
        '0,12',
        {x: 0.25, c: M},
        '0,13',
        {x: 0.25},
        knob('0,15', 0),
      ],
      [
        {y: 0.25, c: A},
        '1,0',
        '1,1',
        '1,2',
        '1,3',
        '1,4',
        '1,5',
        '1,6',
        '1,7',
        '1,8',
        '1,9',
        '1,10',
        '1,11',
        '1,12',
        {c: M, w: 2},
        '1,13\n\n\n0,0',
        {x: 0.25},
        '1,15',
        {x: 0.75},
        '1,13\n\n\n0,1',
        '1,14\n\n\n0,1',
      ],
      [
        {w: 1.5, c: M},
        '2,0',
        {c: A},
        '2,1',
        '2,2',
        '2,3',
        '2,4',
        '2,5',
        '2,6',
        '2,7',
        '2,8',
        '2,9',
        '2,10',
        '2,11',
        '2,12',
        {w: 1.5},
        '2,13',
        {x: 0.25, c: M},
        '2,15',
      ],
      [
        {w: 1.75, c: M},
        '3,0',
        {c: A},
        '3,1',
        '3,2',
        '3,3',
        '3,4',
        '3,5',
        '3,6',
        '3,7',
        '3,8',
        '3,9',
        '3,10',
        '3,11',
        {c: X, w: 2.25},
        '3,13',
        {x: 0.25, c: M},
        '3,15',
      ],
      [
        {c: M, w: 2.25},
        '4,0\n\n\n1,0',
        {c: A},
        '4,2',
        '4,3',
        '4,4',
        '4,5',
        '4,6',
        '4,7',
        '4,8',
        '4,9',
        '4,10',
        '4,11',
        {c: M, w: 1.75},
        '4,13',
        {x: 0.25, c: X},
        '4,14',
        {c: M},
        '4,15',
        {x: 0.75, w: 1.25},
        '4,0\n\n\n1,1',
        {c: A},
        '4,1\n\n\n1,1',
      ],
      [
        {c: M, w: 1.25},
        '5,0',
        {w: 1.25},
        '5,1',
        {w: 1.25},
        '5,2',
        {c: A, w: 6.25},
        '5,6',
        {c: M},
        '5,10',
        '5,11',
        '5,12',
        {x: 0.25, c: X},
        '5,13',
        '5,14',
        '5,15',
      ],
    ],
  },
};

const layer0 = [
  'KC_ESC KC_F1 KC_F2 KC_F3 KC_F4 KC_F5 KC_F6 KC_F7 KC_F8 KC_F9 KC_F10 KC_F11 KC_F12 KC_DEL KC_NO KC_MUTE',
  'KC_GRV KC_1 KC_2 KC_3 KC_4 KC_5 KC_6 KC_7 KC_8 KC_9 KC_0 KC_MINS KC_EQL KC_BSPC KC_DEL KC_HOME',
  'KC_TAB KC_Q KC_W KC_E KC_R KC_T KC_Y KC_U KC_I KC_O KC_P KC_LBRC KC_RBRC KC_BSLS KC_NO KC_PGUP',
  'KC_CAPS KC_A KC_S KC_D KC_F KC_G KC_H KC_J KC_K KC_L KC_SCLN KC_QUOT KC_NO KC_ENT KC_NO KC_PGDN',
  'KC_LSFT KC_NUBS KC_Z KC_X KC_C KC_V KC_B KC_N KC_M KC_COMM KC_DOT KC_SLSH KC_NO KC_RSFT KC_UP KC_END',
  'KC_LCTL KC_LGUI KC_LALT KC_NO KC_NO KC_NO KC_SPC KC_NO KC_NO KC_NO KC_RALT MO(1) KC_RCTL KC_LEFT KC_DOWN KC_RGHT',
];

const layer1 = [
  'KC_TRNS KC_BRID KC_BRIU KC_MCTL KC_LPAD RGB_VAD RGB_VAI KC_MPRV KC_MPLY KC_MNXT KC_MUTE KC_VOLD KC_VOLU KC_INS KC_NO RGB_TOG',
  'KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS',
  'KC_TRNS RGB_TOG RGB_MOD RGB_HUI RGB_SAI RGB_VAI RGB_SPI KC_TRNS KC_TRNS KC_TRNS KC_PSCR KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS',
  'KC_TRNS MACRO(0) MACRO(1) MACRO(2) KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS',
  'KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_CALC KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_PGUP KC_TRNS',
  'KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_TRNS KC_HOME KC_PGDN KC_END',
];

const transparentLayer = Array.from({length: 6}, () => Array(16).fill('KC_TRNS').join(' '));

export const demoMacros: Macro[] = [
  [{type: 'text', text: 'ad@gmail.com'}],
  [
    {type: 'down', keycode: 0xe0},
    {type: 'tap', keycode: 0x06},
    {type: 'up', keycode: 0xe0},
  ],
  [{type: 'text', text: 'git status\n'}],
];

export const DEMO_PROTOCOL = 12;

export const createDemoKeyboard = () => {
  const codec = KeycodeCodec.forProtocol(DEMO_PROTOCOL);
  const toCodes = (rows: string[]) =>
    rows.flatMap((row) =>
      row.split(' ').map((name) => {
        const value = codec.parse(name);
        if (value === null) throw new Error(`Demo keymap: bilinmeyen tuş ${name}`);
        return value;
      }),
    );
  const code = (name: string) => codec.parse(name)!;
  const macroCount = 16;
  return new VirtualKeyboard({
    name: 'Klavye Stüdyo Demo 75',
    vendorId: 0x4b53,
    productId: 0x0075,
    protocol: DEMO_PROTOCOL,
    firmwareVersion: 1,
    rows: 6,
    cols: 16,
    layers: 4,
    encoders: 1,
    macroCount,
    macroBufferSize: 1024,
    keymap: [toCodes(layer0), toCodes(layer1), toCodes(transparentLayer), toCodes(transparentLayer)],
    encoderMap: [
      [[code('KC_VOLD'), code('KC_VOLU')]],
      [[code('RGB_VAD'), code('RGB_VAI')]],
      [[code('KC_TRNS'), code('KC_TRNS')]],
      [[code('KC_TRNS'), code('KC_TRNS')]],
    ],
    macroBytes: encodeMacros([...demoMacros, ...Array.from({length: macroCount - demoMacros.length}, () => [])], DEMO_PROTOCOL),
    customValues: {
      '3:1': [180],
      '3:2': [4],
      '3:3': [127],
      '3:4': [170, 255],
    },
  });
};
