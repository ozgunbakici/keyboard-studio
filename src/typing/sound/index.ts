import {useTyping} from '../store';
import {customSample, sampleFor} from './custom';
import {createKeyEngine, createOutput, type KeyEngine} from './engine';
import {mixFor, voicesFor, type SwitchSound} from './packs';

/**
 * Key sounds for the trainer, synthesised with the Web Audio API from filtered noise, tones and partials, so no
 * recordings are needed; only the "Kendi sesim" pack plays the user's own file.
 */

export {soundPacks, switchSounds, voicesFor, mixFor, type SoundPack, type SwitchSound} from './packs';
export {keyRole, keySize, keyHash, type KeyRole, type KeySize, type Voice} from './voice';
export {keyNote, pentatonic} from './fantasy';
export {CHOKE_AFTER, MAX_RINGING, chokeOld, createKeyEngine, createOutput, limiterCurve, noiseFor, scheduleVoices, type KeyEngine, type SamplePlay} from './engine';
export {customSample, loadCustomSound, removeCustomSound, sampleFor, setCustomSound, useCustomSound} from './custom';

/** Plays one key press or release of a pack on an engine, from `when`; works on live and offline contexts. */
export const scheduleKey = (engine: KeyEngine, sound: SwitchSound, phase: 'press' | 'release', key: string, when: number) => {
  if (sound === 'custom') {
    const recording = customSample();
    const play = sampleFor(phase, key);
    if (recording && play) engine.sample(recording.buffer, {...play, gain: play.gain * recording.gain}, when);
    return;
  }
  engine.voices(voicesFor(sound, phase, key), when, mixFor(sound));
};

let context: AudioContext | null = null;
let output: GainNode | null = null;
let engine: KeyEngine | null = null;

/** The audio graph, made on first use; browsers allow sound only after a key press or click. */
const audio = () => {
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!Context) return null;
    context = new Context({latencyHint: 'interactive'});
    output = createOutput(context);
    engine = createKeyEngine(context, output);
  }
  if (context.state === 'suspended') void context.resume();
  return context;
};

const play = (sound: SwitchSound, phase: 'press' | 'release', key: string, volume: number) => {
  if (sound === 'off') return;
  if (sound === 'custom' && !customSample()) return;
  const ctx = audio();
  if (!ctx || !output || !engine) return;
  output.gain.value = volume;
  scheduleKey(engine, sound, phase, key, ctx.currentTime + 0.002);
};

const current = () => useTyping.getState().settings;

/** Sounds of the trainer's keyboard, with the pack and volume from the settings. */
export const keySound = {
  press: (key: string) => {
    const {switchSound, soundVolume} = current();
    play(switchSound, 'press', key, soundVolume);
  },
  release: (key: string) => {
    const {switchSound, soundVolume} = current();
    play(switchSound, 'release', key, soundVolume);
  },
};

/** A few letters, then Space and Enter, so a pack's special sounds are heard before typing; ms from the start. */
export const previewKeys: [key: string, at: number][] = [
  ['k', 0],
  ['l', 170],
  ['a', 340],
  // The longer sounds of Space and Enter get a little more room.
  [' ', 520],
  ['m', 840],
  ['Enter', 1060],
];

/** Plays the preview keystrokes of a pack. */
export const previewSound = (sound: SwitchSound, volume: number) => {
  if (sound === 'off' || !audio()) return;
  for (const [key, at] of previewKeys) {
    setTimeout(() => play(sound, 'press', key, volume), at);
    setTimeout(() => play(sound, 'release', key, volume), at + 75);
  }
};
