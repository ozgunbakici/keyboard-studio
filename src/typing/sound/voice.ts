/** The envelope every layer shares: up in `attack`, held for `hold`, then an exponential fall over `decay` (to −80 dB). */
type Shape = {at: number; attack?: number; hold?: number; decay: number; gain: number; drive?: boolean};

/**
 * One layer of a key's sound, `at` seconds after the key moves: filtered noise (its filter may sweep to `to`
 * over `sweep` seconds) or a tone (its pitch falls or rises to `to`, over `glide` seconds or the whole layer;
 * `fm` adds a sine modulator at `ratio` × the pitch whose index fades with the layer). `drive` saturates the layer.
 */
export type Voice =
  | (Shape & {kind: 'noise'; filter: BiquadFilterType; freq: number; q: number; to?: number; sweep?: number})
  | (Shape & {kind: 'tone'; wave: OscillatorType; freq: number; to: number; glide?: number; fm?: {ratio: number; index: number}});

export const noise = (at: number, filter: BiquadFilterType, freq: number, q: number, decay: number, gain: number): Voice => ({
  kind: 'noise',
  at,
  filter,
  freq,
  q,
  decay,
  gain,
});
export const tone = (at: number, wave: OscillatorType, freq: number, to: number, decay: number, gain: number): Voice => ({
  kind: 'tone',
  at,
  wave,
  freq,
  to,
  decay,
  gain,
});

/** When a layer has died away, counted from the key press. */
export const voiceEnd = (v: Voice) => v.at + (v.attack ?? 0.0015) + (v.hold ?? 0) + v.decay;

const wideKeys = new Set(['Enter', 'Backspace', 'Shift', 'Tab', 'CapsLock']);

export type KeySize = 'normal' | 'wide' | 'space';
export const keySize = (key: string): KeySize => (key === ' ' ? 'space' : wideKeys.has(key) ? 'wide' : 'normal');

/** What a key does on the board; the fantasy packs give Space, Enter and Backspace their own sounds. */
export type KeyRole = 'normal' | 'space' | 'enter' | 'backspace' | 'wide';
export const keyRole = (key: string): KeyRole =>
  key === ' ' ? 'space' : key === 'Enter' ? 'enter' : key === 'Backspace' ? 'backspace' : wideKeys.has(key) ? 'wide' : 'normal';

/** A stable number for a key (FNV-1a), so the same key always picks the same note or pitch. */
export const keyHash = (key: string) => {
  let hash = 0x811c9dc5;
  for (const ch of key) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193);
  return hash >>> 0;
};
