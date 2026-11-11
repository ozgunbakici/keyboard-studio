import {keySize, noise, tone, type Voice} from './voice';

export type SwitchPack = 'linear' | 'tactile' | 'clicky' | 'thock';

const profiles: Record<SwitchPack, {press: Voice[]; release: Voice[]}> = {
  // Bottom-out clack: a bright tap over the body of the case.
  linear: {
    press: [noise(0, 'bandpass', 1900, 1.1, 0.025, 0.6), noise(0, 'lowpass', 650, 0.7, 0.04, 0.45), tone(0, 'triangle', 380, 280, 0.045, 0.25)],
    release: [noise(0, 'bandpass', 3200, 1, 0.015, 0.16)],
  },
  // The bump ticks first; the key bottoms out a moment later.
  tactile: {
    press: [
      noise(0, 'bandpass', 3600, 2, 0.008, 0.22),
      noise(0.018, 'bandpass', 2100, 1, 0.025, 0.55),
      noise(0.018, 'lowpass', 750, 0.7, 0.035, 0.4),
      tone(0.018, 'triangle', 400, 300, 0.04, 0.22),
    ],
    release: [noise(0, 'bandpass', 3400, 1, 0.014, 0.18)],
  },
  // The click jacket snaps before the bottom-out, and again, softer, on the way up.
  clicky: {
    press: [
      noise(0, 'highpass', 3500, 0.7, 0.006, 0.75),
      tone(0, 'sine', 4200, 3600, 0.012, 0.22),
      noise(0.014, 'bandpass', 2400, 0.9, 0.022, 0.42),
      noise(0.014, 'lowpass', 700, 0.7, 0.03, 0.25),
    ],
    release: [noise(0, 'highpass', 3800, 0.7, 0.005, 0.45), tone(0, 'sine', 4000, 3500, 0.01, 0.1)],
  },
  // Lubed switches in a foam-filled case: low and round, little high end.
  thock: {
    press: [noise(0, 'lowpass', 1100, 0.8, 0.05, 0.5), tone(0, 'sine', 210, 140, 0.07, 0.4), noise(0, 'bandpass', 1800, 1, 0.015, 0.12)],
    release: [noise(0, 'lowpass', 1400, 0.7, 0.02, 0.14)],
  },
};

export const isSwitchPack = (sound: string): sound is SwitchPack => Object.hasOwn(profiles, sound);

/** Each key gets its own small pitch offset (±6%), like the keys across a real board. */
const keyDetune = (key: string) => {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return 1 + ((((hash % 13) + 13) % 13) - 6) / 100;
};

/** A real switch's layers for a key; `rand` adds the small difference between two presses. */
export const switchVoices = (sound: SwitchPack, phase: 'press' | 'release', key: string, rand: () => number): Voice[] => {
  const size = keySize(key);
  // Bigger keys sound lower and ring longer; the space bar's stabilisers add a short rattle.
  const pitch = (size === 'space' ? 0.6 : size === 'wide' ? 0.86 : 1) * keyDetune(key) * (0.97 + rand() * 0.06);
  const length = size === 'space' ? 1.5 : size === 'wide' ? 1.2 : 1;
  const loud = 0.9 + rand() * 0.2;
  const voices = profiles[sound][phase].map(
    (v): Voice =>
      v.kind === 'tone'
        ? {...v, freq: v.freq * pitch, to: v.to * pitch, decay: v.decay * length, gain: v.gain * loud}
        : {...v, freq: v.freq * pitch, decay: v.decay * length, gain: v.gain * loud},
  );
  if (size === 'space' && phase === 'press') voices.push(noise(0.006, 'bandpass', 900, 3, 0.03, 0.14 * loud));
  return voices;
};
