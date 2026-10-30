import type {BoardShape} from '@/typing/fingers';

/** A key of the picker's keyboard; position and size in key units. */
export type BoardSpot = {code: string; x: number; y: number; w: number; h: number};

const spot = (code: string, x: number, y: number, w = 1, h = 1): BoardSpot => ({code, x, y, w, h});
const run = (names: string, x: number, y: number) => names.split(' ').map((name, i) => spot(`KC_${name}`, x + i, y));

/** Esc, the F-row and the alphanumeric block: 15 units wide. */
const mainBlock = (shape: BoardShape): BoardSpot[] => {
  const y = 1.25;
  const keys = [
    spot('KC_ESC', 0, 0),
    ...run('F1 F2 F3 F4', 2, 0),
    ...run('F5 F6 F7 F8', 6.5, 0),
    ...run('F9 F10 F11 F12', 11, 0),
    ...run('GRV 1 2 3 4 5 6 7 8 9 0 MINS EQL', 0, y),
    spot('KC_BSPC', 13, y, 2),
    spot('KC_TAB', 0, y + 1, 1.5),
    ...run('Q W E R T Y U I O P LBRC RBRC', 1.5, y + 1),
    spot('KC_CAPS', 0, y + 2, 1.75),
    ...run('A S D F G H J K L SCLN QUOT', 1.75, y + 2),
    ...run('Z X C V B N M COMM DOT SLSH', 2.25, y + 3),
    spot('KC_RSFT', 12.25, y + 3, 2.75),
    spot('KC_LCTL', 0, y + 4, 1.25),
    spot('KC_LGUI', 1.25, y + 4, 1.25),
    spot('KC_LALT', 2.5, y + 4, 1.25),
    spot('KC_SPC', 3.75, y + 4, 6.25),
    spot('KC_RALT', 10, y + 4, 1.25),
    spot('KC_RGUI', 11.25, y + 4, 1.25),
    spot('KC_APP', 12.5, y + 4, 1.25),
    spot('KC_RCTL', 13.75, y + 4, 1.25),
  ];
  if (shape === 'ansi') {
    keys.push(spot('KC_BSLS', 13.5, y + 1, 1.5), spot('KC_ENT', 12.75, y + 2, 2.25), spot('KC_LSFT', 0, y + 3, 2.25));
  } else {
    // ISO: a two-row Enter, a key left of it and one left of Z.
    keys.push(spot('KC_ENT', 13.75, y + 1, 1.25, 2), spot('KC_NUHS', 12.75, y + 2), spot('KC_LSFT', 0, y + 3, 1.25), spot('KC_NUBS', 1.25, y + 3));
  }
  return keys;
};

const navBlock: BoardSpot[] = [
  ...run('PSCR SLCK PAUS', 0, 0),
  ...run('INS HOME PGUP', 0, 1.25),
  ...run('DEL END PGDN', 0, 2.25),
  spot('KC_UP', 1, 4.25),
  ...run('LEFT DOWN RGHT', 0, 5.25),
];

const numpadBlock: BoardSpot[] = [
  ...run('NLCK PSLS PAST PMNS', 0, 1.25),
  ...run('P7 P8 P9', 0, 2.25),
  spot('KC_PPLS', 3, 2.25, 1, 2),
  ...run('P4 P5 P6', 0, 3.25),
  ...run('P1 P2 P3', 0, 4.25),
  spot('KC_PENT', 3, 4.25, 1, 2),
  spot('KC_P0', 0, 5.25, 2),
  spot('KC_PDOT', 2, 5.25),
];

const moved = (keys: BoardSpot[], dx: number, dy: number) => keys.map((k) => ({...k, x: k.x + dx, y: k.y + dy}));
// Under the main block there is room to make the small navigation keys a little wider.
const widened = (keys: BoardSpot[], by: number) => keys.map((k) => ({...k, x: k.x * by, w: k.w * by}));

/**
 * A full-size keyboard of the given shape. `wide` puts the navigation keys and
 * the numpad beside the main block, as on a real board; otherwise they go below it.
 */
export const basicBoard = (shape: BoardShape, wide: boolean) =>
  wide
    ? {keys: [...mainBlock(shape), ...moved(navBlock, 15.25, 0), ...moved(numpadBlock, 18.5, 0)], width: 22.5, height: 6.25}
    : {keys: [...mainBlock(shape), ...moved(widened(navBlock, 1.25), 0, 6.75), ...moved(numpadBlock, 4.5, 6.75)], width: 15, height: 13};
