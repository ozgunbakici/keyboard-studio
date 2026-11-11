import {create} from 'zustand';
import {getSetting, setSetting} from '@/storage/db';
import type {SamplePlay} from './engine';
import {keyRole} from './voice';

/**
 * The user's own key sound ("Kendi sesim"): a short file kept as a Blob in IndexedDB and decoded once into
 * memory; only this browser has it.
 */
export const useCustomSound = create<{name: string | null}>(() => ({name: null}));

const KEY = 'customKeySound';
const MAX_SECONDS = 5;
const MAX_BYTES = 3 * 1024 * 1024;

let sample: {buffer: AudioBuffer; gain: number} | null = null;

/** The decoded recording and the gain that brings its peak to a level like the other packs; null when none is loaded. */
export const customSample = () => sample;

/** How a key plays the recording: slightly different each time, the big keys lower; nothing on release. */
export const sampleFor = (phase: 'press' | 'release', key: string, rand: () => number = Math.random): SamplePlay | null => {
  if (phase === 'release') return null;
  const role = keyRole(key);
  const low = role === 'space' || role === 'enter' ? 0.8 : 1;
  return {rate: low * (0.96 + rand() * 0.08), gain: 0.85 + rand() * 0.3};
};

const decode = async (blob: Blob) => {
  // An offline context decodes without needing a click first, unlike the live one.
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) for (const s of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(s));
  // Quiet files are lifted (up to 4×) and loud ones lowered to a peak of 0.2, about as loud as the other packs.
  return {buffer, gain: peak > 0 ? Math.min(4, 0.2 / peak) : 1};
};

/** Checks, keeps and starts using a sound file; throws with a message for the user when it can't be used. */
export const setCustomSound = async (file: File) => {
  if (file.size > MAX_BYTES) throw new Error('Ses dosyası en fazla 3 MB olabilir.');
  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error('Bu dosya ses olarak açılamadı.');
  }
  if (decoded.buffer.duration > MAX_SECONDS) throw new Error('Ses en fazla 5 saniye olabilir.');
  await setSetting(KEY, {name: file.name, blob: file});
  sample = decoded;
  useCustomSound.setState({name: file.name});
};

export const removeCustomSound = async () => {
  await setSetting(KEY, null);
  sample = null;
  useCustomSound.setState({name: null});
};

let loading: Promise<void> | null = null;

/** Reads the stored file, once per visit; a missing, unreadable or undecodable file just leaves the sound off. */
export const loadCustomSound = () => {
  loading ??= (async () => {
    const stored = await getSetting<{name: string; blob: Blob} | null>(KEY, null);
    if (!stored || !(stored.blob instanceof Blob)) return;
    try {
      const decoded = await decode(stored.blob);
      // A file chosen while this one was decoding wins.
      if (sample) return;
      sample = decoded;
      useCustomSound.setState({name: stored.name});
    } catch {
      // Not decodable in this browser.
    }
  })();
  return loading;
};
