import {keyHash, keyRole, noise, tone, type KeyRole, type Voice} from './voice';

/**
 * The fantasy packs: every key a gunshot, a sword or a spell. Each recipe gets the key's role, the key itself
 * (for per-key pitches) and `p`, a small random pitch factor for this press; gains are balanced in `fantasyPacks`.
 */

export type FantasyPack = 'shotgun' | 'laser' | 'sword' | 'anvil' | 'magic' | 'wardrum' | 'typewriter' | 'arcade';

type Recipe = (role: KeyRole, key: string, p: number) => Voice[];

/** The layer with some of its optional fields set. */
const set = (v: Voice, extra: Partial<Voice> & {sweep?: number; glide?: number; fm?: {ratio: number; index: number}}): Voice => ({...v, ...extra}) as Voice;
/** A noise layer whose filter moves to `to` over `time` seconds. */
const sweep = (v: Voice, to: number, time: number, attack = 0.001) => set(v, {to, sweep: time, attack});

/** Struck metal: sine partials at inharmonic ratios, the higher ones dying sooner. */
const partials = (at: number, base: number, ratios: number[], gains: number[], decays: number[], attack = 0.001) =>
  ratios.map((r, i) => set(tone(at, 'sine', base * r, base * r, decays[i], gains[i]), {attack}));

/** C major pentatonic, C5–A6: any keys pressed together still sound in tune. */
export const pentatonic = [523.25, 587.33, 659.26, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

/** The note a key always plays in the bell and chiptune packs. */
export const keyNote = (key: string) => pentatonic[keyHash(key) % pentatonic.length];

// --- Pump-action shotgun -------------------------------------------------------------------------------------

/** One barrel: a saturated noise blast whose low-pass closes from bright to dull, over a falling low thump. */
const blast = (at: number, p: number, size: number, gain: number): Voice[] => [
  set(sweep(noise(at, 'lowpass', 6000 * p, 0.7, 0.5 * size, 1.4 * gain), 400 * p / size, 0.2 * size), {drive: true}),
  set(tone(at, 'sine', 150 * p / size, 55 * p / size, 0.45 * size, 0.9 * gain), {attack: 0.002, glide: 0.09 * size}),
];

/** The pump racked back and forth: two clacks with a bright metallic ping each, no shot. */
const rack = (p: number): Voice[] => [
  set(noise(0, 'bandpass', 1900 * p, 2.2, 0.04, 3), {attack: 0.0008}),
  set(tone(0, 'sine', 3300 * p, 3200 * p, 0.07, 0.5), {attack: 0.0008}),
  set(noise(0.12, 'bandpass', 1400 * p, 2.2, 0.05, 3.4), {attack: 0.0008}),
  set(tone(0.12, 'sine', 2600 * p, 2550 * p, 0.08, 0.5), {attack: 0.0008}),
];

const shotgun: Recipe = (role, _key, p) => {
  if (role === 'enter') return rack(p);
  // The second barrel adds its blast to the first one's thump.
  if (role === 'space') return [...blast(0, p * 0.85, 1.6, 1), blast(0.035, p * 0.75, 1.5, 0.6)[0]];
  const crack = set(noise(0, 'highpass', 2500, 0.7, 0.015, 0.5), {attack: 0.0005});
  return [...blast(0, role === 'normal' ? p : p * 0.9, role === 'normal' ? 1 : 1.1, 1), crack];
};

// --- Laser pistol -----------------------------------------------------------------------------------------------

/** "Pew": a pitch dive with a little saw edge and a hiss. */
const pew = (at: number, from: number, to: number, glide: number, gain: number): Voice[] => [
  set(tone(at, 'sine', from, to, glide + 0.04, 0.7 * gain), {attack: 0.002, glide}),
  set(tone(at, 'sawtooth', from, to, glide + 0.03, 0.12 * gain), {attack: 0.002, glide}),
];

const laser: Recipe = (role, _key, p) => {
  if (role === 'space') {
    // Charged shot: a slower, lower dive from a detuned pair, with a beam of noise behind it.
    return [
      set(tone(0, 'sine', 1700 * p, 130 * p, 0.45, 0.6), {attack: 0.004, glide: 0.35}),
      set(tone(0, 'sawtooth', 1700 * p, 130 * p, 0.4, 0.14), {attack: 0.004, glide: 0.35}),
      set(tone(0, 'sawtooth', 1750 * p, 134 * p, 0.4, 0.14), {attack: 0.004, glide: 0.35}),
      sweep(noise(0, 'bandpass', 2500 * p, 1.5, 0.3, 0.25), 300, 0.3, 0.004),
    ];
  }
  if (role === 'enter') return [...pew(0, 2500 * p, 300 * p, 0.12, 1), ...pew(0.09, 2300 * p, 260 * p, 0.12, 0.9)];
  // Backspace takes the shot back: the sweep runs upward.
  if (role === 'backspace') return pew(0, 300 * p, 2200 * p, 0.1, 0.9);
  const low = role === 'wide' ? 0.75 : 1;
  return [...pew(0, 2500 * p * low, 300 * p * low, 0.12, 1), set(noise(0, 'highpass', 4000, 0.7, 0.025, 0.12), {attack: 0.001})];
};

// --- Sword ------------------------------------------------------------------------------------------------------

const steel = [1, 2.76, 5.4];

/** A clash: steel partials over a short "tink" of noise around the next, higher partial. */
const clash = (at: number, base: number, length: number, gain: number): Voice[] => [
  ...partials(at, base, steel, [0.45 * gain, 0.3 * gain, 0.18 * gain], [1.1 * length, 0.75 * length, 0.45 * length]),
  set(noise(at, 'bandpass', Math.min(base * 8.9, 12000), 3, 0.04, 0.5 * gain), {attack: 0.0005}),
];

const sword: Recipe = (role, key, p) => {
  const base = (900 + (keyHash(key) % 11) * 50) * p;
  if (role === 'enter') {
    // Drawn from the sheath: rising scrape, then the blade rings.
    return [
      set(sweep(noise(0, 'bandpass', 1500, 4, 0.15, 0.5), 7000, 0.25, 0.22), {hold: 0.03}),
      ...partials(0.25, 1500 * p, steel, [0.4, 0.25, 0.15], [1.5, 1, 0.6]),
    ];
  }
  if (role === 'space') return clash(0, 720 * p, 1.4, 1.2);
  if (role === 'backspace') return clash(0, base * 1.3, 0.5, 0.8);
  return clash(0, role === 'wide' ? base * 0.85 : base, 1, 1);
};

// --- Dwarven anvil ----------------------------------------------------------------------------------------------

const anvilRatios = [1, 2.31, 4.1];

/** Hammer on anvil: a short, low metallic ping over a thud and the hammer's impact. */
const strike = (at: number, base: number, length: number, gain: number, thud: number): Voice[] => [
  ...partials(at, base, anvilRatios, [0.4 * gain, 0.3 * gain, 0.16 * gain], [0.5 * length, 0.32 * length, 0.18 * length]),
  set(tone(at, 'sine', thud * 1.3, thud, 0.18 * length, 0.8 * gain), {attack: 0.0015, glide: 0.03}),
  set(noise(at, 'lowpass', 1200, 0.7, 0.03, 0.45 * gain), {attack: 0.0008}),
];

const anvil: Recipe = (role, key, p) => {
  const base = (520 + (keyHash(key) % 7) * 30) * p;
  if (role === 'space') return strike(0, 380 * p, 1.35, 1.2, 75);
  // The hammer bounces once.
  if (role === 'enter') return [...strike(0, base, 1, 1, 100).slice(0, 4), ...partials(0.11, base, [1], [0.2], [0.4])];
  if (role === 'backspace') return strike(0, base * 1.25, 0.6, 0.8, 120);
  return strike(0, role === 'wide' ? base * 0.85 : base, 1, 1, 100);
};

// --- Magic ------------------------------------------------------------------------------------------------------

/** A glassy bell: FM with a fading index, plus a quiet octave. */
const bell = (at: number, note: number, gain: number, length = 1): Voice[] => [
  set(tone(at, 'sine', note, note, 1.2 * length, 0.35 * gain), {attack: 0.005, fm: {ratio: 3.5, index: 1.2}}),
  set(tone(at, 'sine', note * 2, note * 2, 0.6 * length, 0.1 * gain), {attack: 0.005}),
];
const chime = (at: number, note: number, decay: number, gain: number) => set(tone(at, 'sine', note, note, decay, gain), {attack: 0.005});

const magic: Recipe = (role, key) => {
  const note = keyNote(key);
  // An upward sparkle.
  if (role === 'space') return [1318.51, 1567.98, 1760, 2093].map((n, i) => chime(i * 0.045, n, 0.7, 0.2));
  if (role === 'enter') return [bell(0, 523.25, 1, 1.2)[0], ...[659.26, 783.99, 1046.5].map((n) => chime(0, n, 1.4, 0.13))];
  if (role === 'backspace') return [chime(0, 783.99, 0.5, 0.25), chime(0.07, 523.25, 0.7, 0.25)];
  return bell(0, role === 'wide' ? note / 2 : note, 1);
};

// --- War drum ---------------------------------------------------------------------------------------------------

/** A deep drum: a falling sine with a slap of noise on the skin. */
const drum = (at: number, from: number, to: number, length: number, gain: number, full = true): Voice[] => [
  set(tone(at, 'sine', from, to, 0.4 * length, 0.95 * gain), {attack: 0.002, glide: 0.12 * length}),
  set(noise(at, 'bandpass', 1100 * (from / 110), 0.8, 0.035, 0.4 * gain), {attack: 0.001}),
  ...(full ? [set(noise(at, 'lowpass', 260, 0.7, 0.12 * length, 0.45 * gain), {attack: 0.002})] : []),
];

const wardrum: Recipe = (role, _key, p) => {
  if (role === 'space') return drum(0, 80 * p, 40 * p, 1.4, 1.1);
  // A flam: a soft grace note just before the main hit.
  if (role === 'enter') return [...drum(0, 120 * p, 60 * p, 0.6, 0.5, false), ...drum(0.035, 110 * p, 55 * p, 1, 1, false)];
  // Backspace knocks on the rim.
  if (role === 'backspace') return [set(noise(0, 'bandpass', 2500, 2, 0.025, 4), {attack: 0.0008}), tone(0, 'triangle', 420 * p, 360 * p, 0.06, 2)];
  return role === 'wide' ? drum(0, 95 * p, 48 * p, 1.1, 1) : drum(0, 110 * p, 55 * p, 1, 1);
};

// --- Typewriter -------------------------------------------------------------------------------------------------

/** A type bar hitting the platen: a sharp clack over a low thunk. */
const clack = (at: number, p: number, gain: number): Voice[] => [
  set(noise(at, 'bandpass', 3500 * p, 1.2, 0.016, 0.8 * gain), {attack: 0.0005}),
  tone(at, 'sine', 140 * p, 90 * p, 0.05, 0.35 * gain),
  noise(at, 'lowpass', 600 * p, 0.7, 0.03, 0.3 * gain),
];

const typewriter: Recipe = (role, _key, p) => {
  // The space bar only moves the carriage: a muted thump.
  if (role === 'space') {
    return [noise(0, 'lowpass', 450 * p, 0.7, 0.05, 0.6), tone(0, 'sine', 110 * p, 80 * p, 0.06, 0.4), noise(0, 'bandpass', 1500, 1, 0.01, 0.15)];
  }
  if (role === 'enter') {
    // The bell, then the carriage zips back and knocks home.
    return [
      ...clack(0, p, 0.7).slice(0, 1),
      set(tone(0, 'sine', 2050, 2050, 1.3, 0.15), {attack: 0.001}),
      set(sweep(noise(0.12, 'bandpass', 700, 4, 0.08, 0.25), 2600, 0.25, 0.04), {hold: 0.15}),
      noise(0.42, 'lowpass', 500, 0.7, 0.05, 0.5),
    ];
  }
  if (role === 'backspace') return clack(0, p * 0.8, 0.9);
  return clack(0, role === 'wide' ? p * 0.85 : p, 1);
};

/** The key springing back: a soft tick. */
const typewriterRelease: Recipe = (role, _key, p) => (role === 'enter' ? [] : [noise(0, 'bandpass', 2200 * p, 1, 0.012, 0.18)]);

// --- 8-bit ------------------------------------------------------------------------------------------------------

/** A square-wave blip held for a moment, like a game console's pulse channel. */
const blip = (at: number, freq: number, to: number, hold: number, decay: number, gain = 0.2): Voice =>
  set(tone(at, 'square', freq, to, decay, gain), {attack: 0.002, hold, glide: to === freq ? undefined : hold + decay});

const arcade: Recipe = (role, key) => {
  if (role === 'space') return [blip(0, 987.77, 987.77, 0.06, 0.01), blip(0.07, 1318.51, 1318.51, 0.2, 0.2)];
  if (role === 'enter') return [523.25, 659.26, 783.99, 1046.5].map((n, i) => (i < 3 ? blip(i * 0.06, n, n, 0.045, 0.012) : blip(i * 0.06, n, n, 0.12, 0.12)));
  if (role === 'backspace') return [blip(0, 880, 220, 0.06, 0.03)];
  const note = keyNote(key);
  return [role === 'wide' ? blip(0, note / 2, note / 2, 0.05, 0.03) : blip(0, note, note, 0.04, 0.03)];
};

/** Each pack's press and release recipes, its loudness against the switches, and its reverb send. */
export const fantasyPacks: Record<FantasyPack, {press: Recipe; release?: Recipe; level: number; wet: number}> = {
  shotgun: {press: shotgun, level: 0.2, wet: 0.12},
  laser: {press: laser, level: 0.37, wet: 0.15},
  sword: {press: sword, level: 0.2, wet: 0.25},
  anvil: {press: anvil, level: 0.25, wet: 0},
  magic: {press: magic, level: 0.27, wet: 0.35},
  wardrum: {press: wardrum, level: 0.16, wet: 0.1},
  typewriter: {press: typewriter, release: typewriterRelease, level: 1, wet: 0},
  arcade: {press: arcade, level: 0.42, wet: 0},
};

export const isFantasyPack = (sound: string): sound is FantasyPack => Object.hasOwn(fantasyPacks, sound);

/**
 * A fantasy pack's layers for a key; `rand` varies pitch (±3%) and loudness (±10%) a little between presses.
 * The pack's `level` is applied after the layers are mixed, so saturated layers keep their drive.
 */
export const fantasyVoices = (sound: FantasyPack, phase: 'press' | 'release', key: string, rand: () => number): Voice[] => {
  const pack = fantasyPacks[sound];
  const recipe = phase === 'press' ? pack.press : pack.release;
  if (!recipe) return [];
  const p = 0.97 + rand() * 0.06;
  const loud = 0.9 + rand() * 0.2;
  return recipe(keyRole(key), key, p).map((v) => ({...v, gain: v.gain * loud}));
};
