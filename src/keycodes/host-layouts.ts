/**
 * What the operating system types for each physical key, per keyboard layout.
 * Keyboards only send key positions, so these tables decide both the legends we
 * draw and how macro text gets converted into key presses.
 *
 * Turkish tables follow QMK's keymap_extras (Windows layouts).
 */

export type HostLayoutId = 'us' | 'us-mac' | 'us-mac-iso' | 'tr-q' | 'tr-f';

/** [base, shift, altGr, shift+altGr]; empty string = nothing. */
export type KeyOutput = [string, string, string?, string?];

export type HostLayout = {
  id: HostLayoutId;
  label: string;
  short: string;
  os: 'any' | 'mac';
  keys: Record<string, KeyOutput>;
  /** Dead strokes: key name -> output indexes (0 base, 1 shift, 2 AltGr/Option, 3 both). */
  dead: Record<string, number[]>;
  /** Characters typed as a dead key followed by a base character, e.g. ü = ¨ + u. */
  compose: Record<string, [string, string]>;
};

/** Builds a compose table from accent -> {base: result} groups. */
const composeTable = (groups: Record<string, string>): Record<string, [string, string]> =>
  Object.fromEntries(
    Object.entries(groups).flatMap(([accent, pairs]) =>
      pairs.split(' ').map((pair) => [[...pair][1], [accent, [...pair][0]]] as [string, [string, string]]),
    ),
  );

const letters = (pairs: string, locale: string): Record<string, KeyOutput> =>
  Object.fromEntries(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, i) => {
      const lower = pairs[i];
      return [`KC_${letter}`, [lower, lower.toLocaleUpperCase(locale)] as KeyOutput];
    }),
  );

const us: HostLayout = {
  id: 'us',
  label: 'US · Windows / Linux',
  short: 'US',
  os: 'any',
  dead: {},
  compose: {},
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

// Accents Turkish layouts can compose with their dead keys (â î û as in "kâğıt").
const trCompose = composeTable({
  '^': 'aâ eê iî oô uû AÂ EÊ IÎ OÔ UÛ',
  '´': 'eé aá oó uú EÉ AÁ',
  '`': 'aà eè oò uù AÀ EÈ',
  '~': 'nñ aã oõ NÑ',
  '¨': 'aä eë AÄ EË',
});

const trQ: HostLayout = {
  id: 'tr-q',
  label: 'Türkçe Q',
  short: 'TR-Q',
  os: 'any',
  dead: {KC_3: [1], KC_LBRC: [2], KC_RBRC: [2], KC_SCLN: [2], KC_NUHS: [2], KC_BSLS: [2]},
  compose: trCompose,
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
  os: 'any',
  dead: {KC_3: [1], KC_LBRC: [2], KC_RBRC: [2], KC_SCLN: [2], KC_NUHS: [2], KC_BSLS: [2]},
  compose: trCompose,
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


// macOS "U.S." layout: Option (either side; we send right Option) gives a
// second and third character on most keys.
const macOption: Record<string, [string, string]> = {
  KC_1: ['¡', '⁄'],
  KC_2: ['™', '€'],
  KC_3: ['£', '‹'],
  KC_4: ['¢', '›'],
  KC_5: ['∞', 'ﬁ'],
  KC_6: ['§', 'ﬂ'],
  KC_7: ['¶', '‡'],
  KC_8: ['•', '°'],
  KC_9: ['ª', '·'],
  KC_0: ['º', '‚'],
  KC_MINS: ['–', '—'],
  KC_EQL: ['≠', '±'],
  KC_Q: ['œ', 'Œ'],
  KC_W: ['∑', '„'],
  KC_E: ['´', '´'],
  KC_R: ['®', '‰'],
  KC_T: ['†', 'ˇ'],
  KC_Y: ['¥', 'Á'],
  KC_U: ['¨', '¨'],
  KC_I: ['ˆ', 'ˆ'],
  KC_O: ['ø', 'Ø'],
  KC_P: ['π', '∏'],
  KC_LBRC: ['“', '”'],
  KC_RBRC: ['‘', '’'],
  KC_BSLS: ['«', '»'],
  KC_NUHS: ['«', '»'],
  KC_A: ['å', 'Å'],
  KC_S: ['ß', 'Í'],
  KC_D: ['∂', 'Î'],
  KC_F: ['ƒ', 'Ï'],
  KC_G: ['©', '˝'],
  KC_H: ['˙', 'Ó'],
  KC_J: ['∆', 'Ô'],
  KC_L: ['¬', 'Ò'],
  KC_SCLN: ['…', 'Ú'],
  KC_QUOT: ['æ', 'Æ'],
  KC_Z: ['Ω', '¸'],
  KC_X: ['≈', '˛'],
  KC_C: ['ç', 'Ç'],
  KC_V: ['√', '◊'],
  KC_B: ['∫', 'ı'],
  KC_N: ['˜', '˜'],
  KC_M: ['µ', 'Â'],
  KC_COMM: ['≤', '¯'],
  KC_DOT: ['≥', '˘'],
  KC_SLSH: ['÷', '¿'],
};

const macCompose = composeTable({
  '¨': 'uü oö aä eë iï yÿ UÜ OÖ AÄ EË IÏ',
  '´': 'eé aá ií oó uú EÉ AÁ IÍ OÓ UÚ',
  'ˆ': 'aâ eê iî oô uû AÂ EÊ IÎ OÔ UÛ',
  '˜': 'nñ aã oõ NÑ AÃ OÕ',
  '`': 'aà eè iì oò uù AÀ EÈ IÌ OÒ UÙ',
});

const macKeys = (iso: boolean): Record<string, KeyOutput> => {
  const keys: Record<string, KeyOutput> = {};
  for (const [key, [base, shift]] of Object.entries(us.keys)) {
    const option = macOption[key];
    keys[key] = option ? [base, shift, option[0], option[1]] : [base, shift];
  }
  // Option+` is the grave dead key; its key moves next to left Shift on ISO boards.
  if (iso) {
    keys.KC_GRV = ['§', '±'];
    keys.KC_NUBS = ['`', '~', '`', '`'];
  } else {
    keys.KC_GRV = ['`', '~', '`', '`'];
    keys.KC_NUBS = ['§', '±'];
  }
  return keys;
};

const macDead = (iso: boolean): Record<string, number[]> => ({
  KC_E: [2],
  KC_U: [2],
  KC_I: [2],
  KC_N: [2],
  [iso ? 'KC_NUBS' : 'KC_GRV']: [2],
});

const usMac: HostLayout = {
  id: 'us-mac',
  label: 'US · macOS (ANSI klavye tipi)',
  short: 'US-Mac',
  os: 'mac',
  keys: macKeys(false),
  dead: macDead(false),
  compose: macCompose,
};

// macOS swaps the § and ` keys when the keyboard type is ISO.
const usMacIso: HostLayout = {
  id: 'us-mac-iso',
  label: 'US · macOS (ISO klavye)',
  short: 'US-Mac ISO',
  os: 'mac',
  keys: macKeys(true),
  dead: macDead(true),
  compose: macCompose,
};

export const hostLayouts: Record<HostLayoutId, HostLayout> = {us, 'us-mac': usMac, 'us-mac-iso': usMacIso, 'tr-q': trQ, 'tr-f': trF};

export const hostLayoutList = [us, usMacIso, usMac, trQ, trF];

export const isDeadStroke = (layout: HostLayout, key: string, index: number) => layout.dead[key]?.includes(index) ?? false;

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

/**
 * Character produced by a basic key with modifiers. Mod bits: 0x01 Ctrl,
 * 0x02 Shift, 0x04 Alt, 0x08 GUI, 0x10 right-hand. On Windows layouts only
 * AltGr (right Alt, or Ctrl+Alt) reaches the third level; on macOS either Option does.
 */
export const hostCharFor = (layout: HostLayout, keyName: string, mods: number): string | null => {
  const output = layout.keys[keyName];
  if (!output) return null;
  const shift = (mods & 0x02) !== 0;
  const alt = (mods & 0x04) !== 0;
  const right = (mods & 0x10) !== 0;
  const ctrl = (mods & 0x01) !== 0;
  const gui = (mods & 0x08) !== 0;
  const altGr = layout.os === 'mac' ? alt && !ctrl : alt && (right || ctrl);
  if (gui || (ctrl && !(altGr && layout.os !== 'mac'))) return null;
  if (alt && !altGr) return null;
  const index = (altGr ? 2 : 0) + (shift ? 1 : 0);
  return output[index] || null;
};

/**
 * Best guess of the active OS layout using the Keyboard Map API (Chromium only).
 * Returns null when the API is unavailable or the layout is unknown.
 */
export const detectHostLayout = async (os: 'mac' | 'other' = 'other'): Promise<HostLayoutId | null> => {
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
    if (semicolon === ';') {
      if (os !== 'mac') return 'us';
      return map.get('Backquote') === '§' ? 'us-mac-iso' : 'us-mac';
    }
  } catch {
    // Not permitted (e.g. inside an iframe).
  }
  return null;
};
