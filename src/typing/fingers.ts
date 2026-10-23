import type {RenderKey} from '@/definitions/geometry';
import {isDeadStroke, type HostLayout} from '@/keycodes/host-layouts';

/**
 * Touch typing: which finger owns which key, a standard ISO keyboard to draw
 * the guide on, and where each character lives on the computer's layout.
 */

export type Finger = 'L5' | 'L4' | 'L3' | 'L2' | 'R2' | 'R3' | 'R4' | 'R5' | 'T';

export const fingerNames: Record<Finger, string> = {
  L5: 'sol serçe parmak',
  L4: 'sol yüzük parmağı',
  L3: 'sol orta parmak',
  L2: 'sol işaret parmağı',
  R2: 'sağ işaret parmağı',
  R3: 'sağ orta parmak',
  R4: 'sağ yüzük parmağı',
  R5: 'sağ serçe parmak',
  T: 'başparmak',
};

// Same colour for the same finger of either hand, as typing charts usually do.
export const fingerColors: Record<Finger, string> = {
  L5: 'rgb(167 139 250 / 0.42)',
  L4: 'rgb(96 165 250 / 0.42)',
  L3: 'rgb(52 211 153 / 0.4)',
  L2: 'rgb(251 191 36 / 0.4)',
  R2: 'rgb(251 191 36 / 0.4)',
  R3: 'rgb(52 211 153 / 0.4)',
  R4: 'rgb(96 165 250 / 0.42)',
  R5: 'rgb(167 139 250 / 0.42)',
  T: 'rgb(148 163 184 / 0.32)',
};

const fingerKeys: Record<Finger, string[]> = {
  L5: ['KC_GRV', 'KC_1', 'KC_Q', 'KC_A', 'KC_Z', 'KC_NUBS', 'KC_TAB', 'KC_CAPS', 'KC_LSFT', 'KC_LCTL'],
  L4: ['KC_2', 'KC_W', 'KC_S', 'KC_X'],
  L3: ['KC_3', 'KC_E', 'KC_D', 'KC_C'],
  L2: ['KC_4', 'KC_5', 'KC_R', 'KC_T', 'KC_F', 'KC_G', 'KC_V', 'KC_B'],
  R2: ['KC_6', 'KC_7', 'KC_Y', 'KC_U', 'KC_H', 'KC_J', 'KC_N', 'KC_M'],
  R3: ['KC_8', 'KC_I', 'KC_K', 'KC_COMM'],
  R4: ['KC_9', 'KC_O', 'KC_L', 'KC_DOT'],
  R5: ['KC_0', 'KC_MINS', 'KC_EQL', 'KC_P', 'KC_LBRC', 'KC_RBRC', 'KC_BSLS', 'KC_NUHS', 'KC_SCLN', 'KC_QUOT', 'KC_SLSH', 'KC_ENT', 'KC_RSFT', 'KC_BSPC'],
  T: ['KC_SPC'],
};

export const fingerOf = new Map<string, Finger>(
  Object.entries(fingerKeys).flatMap(([finger, keys]) => keys.map((key) => [key, finger as Finger] as const)),
);

export const isLeftHand = (finger: Finger) => finger.startsWith('L');

/** Home row keys, where the fingers rest. */
export const homeKeys = ['KC_A', 'KC_S', 'KC_D', 'KC_F', 'KC_J', 'KC_K', 'KC_L', 'KC_SCLN'];

type Row = [key: string, width: number][];

// A 60% ISO board: every keyboard of the user is ISO, and the finger chart only
// needs the alphanumeric block.
const isoRows: Row[] = [
  [['KC_GRV', 1], ['KC_1', 1], ['KC_2', 1], ['KC_3', 1], ['KC_4', 1], ['KC_5', 1], ['KC_6', 1], ['KC_7', 1], ['KC_8', 1], ['KC_9', 1], ['KC_0', 1], ['KC_MINS', 1], ['KC_EQL', 1], ['KC_BSPC', 2]],
  [['KC_TAB', 1.5], ['KC_Q', 1], ['KC_W', 1], ['KC_E', 1], ['KC_R', 1], ['KC_T', 1], ['KC_Y', 1], ['KC_U', 1], ['KC_I', 1], ['KC_O', 1], ['KC_P', 1], ['KC_LBRC', 1], ['KC_RBRC', 1]],
  [['KC_CAPS', 1.75], ['KC_A', 1], ['KC_S', 1], ['KC_D', 1], ['KC_F', 1], ['KC_G', 1], ['KC_H', 1], ['KC_J', 1], ['KC_K', 1], ['KC_L', 1], ['KC_SCLN', 1], ['KC_QUOT', 1], ['KC_NUHS', 1]],
  [['KC_LSFT', 1.25], ['KC_NUBS', 1], ['KC_Z', 1], ['KC_X', 1], ['KC_C', 1], ['KC_V', 1], ['KC_B', 1], ['KC_N', 1], ['KC_M', 1], ['KC_COMM', 1], ['KC_DOT', 1], ['KC_SLSH', 1], ['KC_RSFT', 2.75]],
  [['KC_LCTL', 1.25], ['KC_LGUI', 1.25], ['KC_LALT', 1.25], ['KC_SPC', 6.25], ['KC_RALT', 1.25], ['KC_RGUI', 1.25], ['KC_APP', 1.25], ['KC_RCTL', 1.25]],
];

const alphaKey = /^KC_([A-Z0-9]|GRV|MINS|EQL|LBRC|RBRC|NUHS|NUBS|SCLN|QUOT|COMM|DOT|SLSH|BSLS|SPC)$/;

export type StandardKey = RenderKey & {code: string};

const makeKey = (code: string, x: number, y: number, w: number, col: number, extra: Partial<RenderKey> = {}): StandardKey => ({
  code,
  id: `std-${code}`,
  x,
  y,
  w,
  h: 1,
  r: 0,
  rx: 0,
  ry: 0,
  row: y,
  col,
  d: false,
  color: (alphaKey.test(code) ? 'alpha' : 'mod') as RenderKey['color'],
  isEncoder: false,
  hasMatrix: true,
  ...extra,
});

/** The standard ISO keyboard as drawable keys; `code` is the key's position name. */
export const standardKeys: StandardKey[] = (() => {
  const keys: StandardKey[] = [];
  isoRows.forEach((row, y) => {
    let x = 0;
    row.forEach(([code, w], col) => {
      keys.push(makeKey(code, x, y, w, col));
      x += w;
    });
  });
  // ISO Enter: 1.5 wide on the top row, 1.25 wide on the home row.
  keys.push(makeKey('KC_ENT', 13.75, 1, 1.25, 13, {h: 2, x2: -0.25, y2: 0, w2: 1.5, h2: 1}));
  return keys;
})();

export const standardKeyByCode = new Map(standardKeys.map((k) => [k.code, k]));

/** "row,col" position of a key on the standard board, as KeyboardView expects. */
export const standardPosition = (code: string) => {
  const key = standardKeyByCode.get(code === 'KC_BSLS' ? 'KC_NUHS' : code);
  return key ? `${key.row},${key.col}` : undefined;
};

export type CharKey = {key: string; shift: boolean; altgr: boolean; finger?: Finger};

const levels: [index: number, shift: boolean, altgr: boolean][] = [
  [0, false, false],
  [1, true, false],
  [2, false, true],
  [3, true, true],
];

/** Where a character is typed on the computer's layout (ISO keys preferred). */
export const charKey = (host: HostLayout, char: string): CharKey | null => {
  if (char === ' ') return {key: 'KC_SPC', shift: false, altgr: false, finger: 'T'};
  if (char === '\n') return {key: 'KC_ENT', shift: false, altgr: false, finger: 'R5'};
  if (char === '\t') return {key: 'KC_TAB', shift: false, altgr: false, finger: 'L5'};
  for (const [index, shift, altgr] of levels) {
    let found: string | null = null;
    for (const [key, out] of Object.entries(host.keys)) {
      if (out[index] !== char || isDeadStroke(host, key, index)) continue;
      if (key === 'KC_BSLS' && host.keys.KC_NUHS?.[index] === char) continue;
      found = key;
      break;
    }
    if (found) return {key: found, shift, altgr, finger: fingerOf.get(found)};
  }
  return null;
};

/** Keys to light up for a character: the key itself plus the Shift of the other hand. */
export const keysToPress = (host: HostLayout, char: string): string[] => {
  const where = charKey(host, char);
  if (!where) return [];
  const keys = [where.key];
  if (where.shift) keys.push(where.finger && isLeftHand(where.finger) ? 'KC_RSFT' : 'KC_LSFT');
  if (where.altgr) keys.push('KC_RALT');
  return keys;
};
