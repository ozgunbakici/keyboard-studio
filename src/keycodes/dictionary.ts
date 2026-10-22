import legacyTable from './tables/default';
import v10Table from './tables/v10';
import v11Table from './tables/v11';
import v12Table from './tables/v12';
import v13Table from './tables/v13';

export type KeycodeTable = Record<string, number>;

/**
 * Keycodes added to QMK after VIA's v12 table was frozen. They are harmless on
 * older firmware (the keycode simply does nothing), and they matter for us:
 * PDF() lets a key switch the persistent default layer (Mac/Windows layers).
 */
const modernExtras: KeycodeTable = {
  _QK_PERSISTENT_DEF_LAYER: 0x52e0,
  _QK_PERSISTENT_DEF_LAYER_MAX: 0x52ff,
  QK_REBOOT: 0x7c01,
  CW_TOGG: 0x7c73,
  AC_ON: 0x7c74,
  AC_OFF: 0x7c75,
  AC_TOGG: 0x7c76,
  QK_REP: 0x7c79,
  QK_AREP: 0x7c7a,
  QK_LLCK: 0x7c7b,
};

const cache = new Map<string, KeycodeTable>();

/** Returns the keycode name -> value table matching the firmware's protocol. */
export const getKeycodeTable = (protocol: number): KeycodeTable => {
  const key = String(protocol >= 13 ? 13 : protocol);
  const cached = cache.get(key);
  if (cached) return cached;
  let table: KeycodeTable;
  if (protocol >= 13) table = {...v13Table, ...modernExtras};
  else if (protocol === 12) table = {...v12Table, ...modernExtras};
  else if (protocol === 11) table = v11Table;
  else if (protocol === 10) table = v10Table;
  else table = legacyTable;
  cache.set(key, table);
  return table;
};

/** Deprecated QMK names VIA accepts in save files, mapped to canonical expressions. */
export const keycodeAliases: Record<string, string> = {
  KC_TILD: 'S(KC_GRV)',
  KC_EXLM: 'S(KC_1)',
  KC_AT: 'S(KC_2)',
  KC_HASH: 'S(KC_3)',
  KC_DLR: 'S(KC_4)',
  KC_PERC: 'S(KC_5)',
  KC_CIRC: 'S(KC_6)',
  KC_AMPR: 'S(KC_7)',
  KC_ASTR: 'S(KC_8)',
  KC_LPRN: 'S(KC_9)',
  KC_RPRN: 'S(KC_0)',
  KC_UNDS: 'S(KC_MINS)',
  KC_PLUS: 'S(KC_EQL)',
  KC_LCBR: 'S(KC_LBRC)',
  KC_RCBR: 'S(KC_RBRC)',
  KC_PIPE: 'S(KC_BSLS)',
  KC_COLN: 'S(KC_SCLN)',
  KC_DQUO: 'S(KC_QUOT)',
  KC_LT: 'S(KC_COMM)',
  KC_GT: 'S(KC_DOT)',
  KC_QUES: 'S(KC_SLSH)',
  SPC_FN1: 'LT(1,KC_SPC)',
  SPC_FN2: 'LT(2,KC_SPC)',
  SPC_FN3: 'LT(3,KC_SPC)',
  KC_TRANSPARENT: 'KC_TRNS',
  _______: 'KC_TRNS',
  XXXXXXX: 'KC_NO',
  KC_ENTER: 'KC_ENT',
  KC_ESCAPE: 'KC_ESC',
  KC_BACKSPACE: 'KC_BSPC',
  KC_SPACE: 'KC_SPC',
  KC_DELETE: 'KC_DEL',
  KC_LEFT_CTRL: 'KC_LCTL',
  KC_LEFT_SHIFT: 'KC_LSFT',
  KC_LEFT_ALT: 'KC_LALT',
  KC_LEFT_GUI: 'KC_LGUI',
  KC_RIGHT_CTRL: 'KC_RCTL',
  KC_RIGHT_SHIFT: 'KC_RSFT',
  KC_RIGHT_ALT: 'KC_RALT',
  KC_RIGHT_GUI: 'KC_RGUI',
  KC_NONUS_BACKSLASH: 'KC_NUBS',
  KC_NONUS_HASH: 'KC_NUHS',
  KC_SCRL: 'KC_SLCK',
  KC_NUM: 'KC_NLCK',
  QK_BOOT: 'RESET',
  QK_BOOTLOADER: 'RESET',
  QK_GESC: 'KC_GESC',
  QK_RBT: 'QK_REBOOT',
  QK_CAPS_WORD_TOGGLE: 'CW_TOGG',
  QK_REPEAT_KEY: 'QK_REP',
  QK_ALT_REPEAT_KEY: 'QK_AREP',
  QK_LAYER_LOCK: 'QK_LLCK',
  EE_CLR: 'QK_CLEAR_EEPROM',
  NK_TOGG: 'MAGIC_TOGGLE_NKRO',
};
