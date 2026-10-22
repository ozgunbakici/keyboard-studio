/**
 * What the operating system types for each physical key, per keyboard layout.
 * Keyboards only send key positions, so these tables decide both the legends we
 * draw and how macro text gets converted into key presses.
 *
 * Turkish tables follow QMK's keymap_extras (Windows layouts).
 */

export type HostLayoutId = 'us' | 'tr-q' | 'tr-f';

/** [base, shift, altGr, shift+altGr]; empty string = nothing. */
export type KeyOutput = [string, string, string?, string?];

export type HostLayout = {
  id: HostLayoutId;
  label: string;
  short: string;
  keys: Record<string, KeyOutput>;
  /** Characters produced by dead keys: they need a following space. */
  dead: Set<string>;
};

const letters = (pairs: string, locale: string): Record<string, KeyOutput> =>
  Object.fromEntries(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, i) => {
      const lower = pairs[i];
      return [`KC_${letter}`, [lower, lower.toLocaleUpperCase(locale)] as KeyOutput];
    }),
  );

const us: HostLayout = {
  id: 'us',
  label: 'US (ABD) QWERTY',
  short: 'US',
  dead: new Set(),
  keys: {
    ...letters('abcdefghijklmnopqrstuvwxyz', 'en-US'),
    KC_GRV: ['`', '~'],
    KC_1: ['1', '!'],
    KC_2: ['2', '@'],
    KC_3: ['3', '#'],
    KC_4: ['4', '$'],
    KC_5: ['5', '%'],
    KC_6: ['6', '^'],
    KC_7: ['7', '&'],
    KC_8: ['8', '*'],
    KC_9: ['9', '('],
    KC_0: ['0', ')'],
    KC_MINS: ['-', '_'],
    KC_EQL: ['=', '+'],
    KC_LBRC: ['[', '{'],
    KC_RBRC: [']', '}'],
    KC_BSLS: ['\\', '|'],
    KC_NUHS: ['\\', '|'],
    KC_SCLN: [';', ':'],
    KC_QUOT: ["'", '"'],
    KC_COMM: [',', '<'],
    KC_DOT: ['.', '>'],
    KC_SLSH: ['/', '?'],
    KC_NUBS: ['\\', '|'],
  },
};

// Turkish Q: letters stay in QWERTY positions except I (ı) and the extra letters.
const trQLetters = letters('abcdefghıjklmnopqrstuvwxyz', 'tr-TR');

const trQ: HostLayout = {
  id: 'tr-q',
  label: 'Türkçe Q',
  short: 'TR-Q',
  dead: new Set(['^', '¨', '~', '´', '`']),
  keys: {
    ...trQLetters,
    KC_Q: ['q', 'Q', '@'],
    KC_E: ['e', 'E', '€'],
    KC_T: ['t', 'T', '₺'],
    KC_GRV: ['"', 'é'],
    KC_1: ['1', '!'],
    KC_2: ['2', "'", '£'],
    KC_3: ['3', '^', '#'],
    KC_4: ['4', '+', '$'],
    KC_5: ['5', '%', '½'],
    KC_6: ['6', '&'],
    KC_7: ['7', '/', '{'],
    KC_8: ['8', '(', '['],
    KC_9: ['9', ')', ']'],
    KC_0: ['0', '=', '}'],
    KC_MINS: ['*', '?', '\\'],
    KC_EQL: ['-', '_', '|'],
    KC_LBRC: ['ğ', 'Ğ', '¨'],
    KC_RBRC: ['ü', 'Ü', '~'],
    KC_SCLN: ['ş', 'Ş', '´'],
    KC_QUOT: ['i', 'İ'],
    KC_NUHS: [',', ';', '`'],
    KC_BSLS: [',', ';', '`'],
    KC_NUBS: ['<', '>'],
    KC_COMM: ['ö', 'Ö'],
    KC_DOT: ['ç', 'Ç'],
    KC_SLSH: ['.', ':'],
  },
};

const trF: HostLayout = {
  id: 'tr-f',
  label: 'Türkçe F',
  short: 'TR-F',
  dead: new Set(['^', '¨', '~', '´', '`']),
  keys: {
    KC_Q: ['f', 'F', '@'],
    KC_W: ['g', 'G'],
    KC_E: ['ğ', 'Ğ'],
    KC_R: ['ı', 'I', '¶', '®'],
    KC_T: ['o', 'O'],
    KC_Y: ['d', 'D', '¥'],
    KC_U: ['r', 'R'],
    KC_I: ['n', 'N'],
    KC_O: ['h', 'H', 'ø', 'Ø'],
    KC_P: ['p', 'P', '£'],
    KC_LBRC: ['q', 'Q', '¨'],
    KC_RBRC: ['w', 'W', '~'],
    KC_A: ['u', 'U', 'æ', 'Æ'],
    KC_S: ['i', 'İ', 'ß', '§'],
    KC_D: ['e', 'E', '€'],
    KC_F: ['a', 'A', '', 'ª'],
    KC_G: ['ü', 'Ü'],
    KC_H: ['t', 'T', '₺'],
    KC_J: ['k', 'K'],
    KC_K: ['m', 'M'],
    KC_L: ['l', 'L'],
    KC_SCLN: ['y', 'Y', '´'],
    KC_QUOT: ['ş', 'Ş'],
    KC_NUHS: ['x', 'X', '`'],
    KC_BSLS: ['x', 'X', '`'],
    KC_NUBS: ['<', '>', '|', '¦'],
    KC_Z: ['j', 'J', '«'],
    KC_X: ['ö', 'Ö', '»'],
    KC_C: ['v', 'V', '¢', '©'],
    KC_V: ['c', 'C'],
    KC_B: ['ç', 'Ç'],
    KC_N: ['z', 'Z'],
    KC_M: ['s', 'S', 'µ', 'º'],
    KC_COMM: ['b', 'B', '×'],
    KC_DOT: ['.', ':', '÷'],
    KC_SLSH: [',', ';'],
    KC_GRV: ['+', '*', '¬'],
    KC_1: ['1', '!', '¹'],
    KC_2: ['2', '"', '²'],
    KC_3: ['3', '^', '#', '³'],
    KC_4: ['4', '$', '¼', '¤'],
    KC_5: ['5', '%', '½'],
    KC_6: ['6', '&', '¾'],
    KC_7: ['7', "'", '{'],
    KC_8: ['8', '(', '['],
    KC_9: ['9', ')', ']'],
    KC_0: ['0', '=', '}'],
    KC_MINS: ['/', '?', '\\', '¿'],
    KC_EQL: ['-', '_', '|'],
  },
};

export const hostLayouts: Record<HostLayoutId, HostLayout> = {us, 'tr-q': trQ, 'tr-f': trF};

export const hostLayoutList = [trQ, trF, us];

const isLetterLike = (s: string) => s.length === 1 && s.toLocaleLowerCase('tr-TR') !== s.toLocaleUpperCase('tr-TR');

/**
 * Legend for a basic keycode under a host layout.
 * Letters show a single uppercase glyph; symbol keys show shifted over base.
 */
export const hostLegend = (layout: HostLayout, keyName: string): {top?: string; main: string} | null => {
  const output = layout.keys[keyName];
  if (!output) return null;
  const [base, shift] = output;
  // Letters show their shifted (capital) form, which the table already knows per layout.
  if (isLetterLike(base)) return {main: shift || base};
  return shift ? {top: shift, main: base} : {main: base};
};

/** Character produced by a basic key with modifiers (bit 0x02 shift, 0x14 right alt). */
export const hostCharFor = (layout: HostLayout, keyName: string, mods: number): string | null => {
  const output = layout.keys[keyName];
  if (!output) return null;
  const shift = (mods & 0x02) !== 0;
  const altGr = (mods & 0x14) === 0x14 || ((mods & 0x04) !== 0 && (mods & 0x01) !== 0);
  const otherMods = mods & 0x09 & ~(altGr ? 0x01 : 0);
  if (otherMods) return null;
  const index = (altGr ? 2 : 0) + (shift ? 1 : 0);
  return output[index] || null;
};

/**
 * Best guess of the active OS layout using the Keyboard Map API (Chromium only).
 * Returns null when the API is unavailable or the layout is unknown.
 */
export const detectHostLayout = async (): Promise<HostLayoutId | null> => {
  const nav = navigator as Navigator & {
    keyboard?: {getLayoutMap?: () => Promise<Map<string, string>>};
  };
  if (!nav.keyboard?.getLayoutMap) return null;
  try {
    const map = await nav.keyboard.getLayoutMap();
    const q = map.get('KeyQ');
    const semicolon = map.get('Semicolon');
    if (q === 'f') return 'tr-f';
    if (semicolon === 'ş') return 'tr-q';
    if (semicolon === ';') return 'us';
  } catch {
    // Not permitted (e.g. inside an iframe).
  }
  return null;
};
