import {useTyping} from './store';

/**
 * Keyboard switch sounds for the trainer, synthesised with the Web Audio API
 * from filtered noise and short falling tones, so no recordings are needed.
 */

export type SwitchSound = 'off' | 'linear' | 'tactile' | 'clicky' | 'thock';

export const switchSounds: {id: SwitchSound; label: string; hint: string}[] = [
  {id: 'off', label: 'Kapalı', hint: 'Ses yok'},
  {id: 'linear', label: 'Lineer', hint: 'Kırmızı, sarı: temiz, yumuşak vuruş'},
  {id: 'tactile', label: 'Tactile', hint: 'Kahverengi: hafif tümsek, ardından vuruş'},
  {id: 'clicky', label: 'Tıklı', hint: 'Mavi: keskin klik, bırakırken de'},
  {id: 'thock', label: 'Tok (thock)', hint: 'Yağlanmış lineer, köpüklü kasa: derin ve yuvarlak'},
];

/** One layer of a key's sound, `at` seconds after the key moves: filtered noise or a falling tone. */
export type Voice =
  | {kind: 'noise'; at: number; filter: BiquadFilterType; freq: number; q: number; decay: number; gain: number}
  | {kind: 'tone'; at: number; wave: OscillatorType; freq: number; to: number; decay: number; gain: number};

const noise = (at: number, filter: BiquadFilterType, freq: number, q: number, decay: number, gain: number): Voice => ({
  kind: 'noise',
  at,
  filter,
  freq,
  q,
  decay,
  gain,
});
const tone = (at: number, wave: OscillatorType, freq: number, to: number, decay: number, gain: number): Voice => ({
  kind: 'tone',
  at,
  wave,
  freq,
  to,
  decay,
  gain,
});

const profiles: Record<Exclude<SwitchSound, 'off'>, {press: Voice[]; release: Voice[]}> = {
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

const wideKeys = new Set(['Enter', 'Backspace', 'Shift', 'Tab', 'CapsLock']);

export type KeySize = 'normal' | 'wide' | 'space';
export const keySize = (key: string): KeySize => (key === ' ' ? 'space' : wideKeys.has(key) ? 'wide' : 'normal');

/** Each key gets its own small pitch offset (±6%), like the keys across a real board. */
const keyDetune = (key: string) => {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return 1 + ((((hash % 13) + 13) % 13) - 6) / 100;
};

/** The layers to play for a key; `rand` adds the small difference between two presses. */
export const voicesFor = (sound: SwitchSound, phase: 'press' | 'release', key: string, rand: () => number = Math.random): Voice[] => {
  if (sound === 'off') return [];
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

// ---------------------------------------------------------------------------
// Playback

let context: AudioContext | null = null;
let output: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** The audio graph, made on first use; browsers allow sound only after a key press or click. */
const audio = () => {
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!Context) return null;
    context = new Context({latencyHint: 'interactive'});
    // Fast typing stacks many sounds; the compressor keeps them from clipping.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 4;
    output = context.createGain();
    output.connect(compressor).connect(context.destination);
    noiseBuffer = noiseFor(context);
  }
  if (context.state === 'suspended') void context.resume();
  return context;
};

/** White noise the noise layers are filtered from. */
export const noiseFor = (ctx: BaseAudioContext) => {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
};

/** Schedules a key's layers from `when` on any audio context, live or offline. */
export const scheduleVoices = (ctx: BaseAudioContext, out: AudioNode, noiseBuffer: AudioBuffer, voices: Voice[], when: number) => {
  for (const v of voices) {
    const start = when + v.at;
    const end = start + 0.0015 + v.decay;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(v.gain, start + 0.0015);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    amp.connect(out);
    if (v.kind === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = v.filter;
      filter.frequency.value = v.freq;
      filter.Q.value = v.q;
      source.connect(filter).connect(amp);
      // A random point in the noise, so no two presses sound exactly alike.
      source.start(start, Math.random() * 0.3);
      source.stop(end + 0.02);
    } else {
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(v.freq, start);
      osc.frequency.exponentialRampToValueAtTime(v.to, end);
      osc.connect(amp);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
};

const play = (voices: Voice[], volume: number) => {
  if (!voices.length) return;
  const ctx = audio();
  if (!ctx || !output || !noiseBuffer) return;
  output.gain.value = volume;
  scheduleVoices(ctx, output, noiseBuffer, voices, ctx.currentTime + 0.002);
};

const current = () => useTyping.getState().settings;

/** Sounds of the trainer's keyboard, with the switch and volume from the settings. */
export const keySound = {
  press: (key: string) => {
    const {switchSound, soundVolume} = current();
    play(voicesFor(switchSound, 'press', key), soundVolume);
  },
  release: (key: string) => {
    const {switchSound, soundVolume} = current();
    play(voicesFor(switchSound, 'release', key), soundVolume);
  },
};

/** A few keystrokes so a switch can be heard before typing. */
export const previewSound = (sound: SwitchSound, volume: number) => {
  if (sound === 'off' || !audio()) return;
  ['k', 'l', 'a', ' ', 'm'].forEach((key, i) => {
    setTimeout(() => play(voicesFor(sound, 'press', key), volume), i * 160);
    setTimeout(() => play(voicesFor(sound, 'release', key), volume), i * 160 + 75);
  });
};
