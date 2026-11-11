import {getSetting, setSetting} from '@/storage/db';
import {useTyping, type TypingSettings} from '../store';
import type {Track} from './library';
import {nextRound, playOrder} from './order';

/**
 * Plays the user's tracks through one audio element. The caller sets the mode
 * from the speed gate; this module fades, pauses, moves between tracks and
 * remembers where it was, so a long soundtrack continues across visits.
 */

export type PlayerMode = 'off' | 'waiting' | 'playing' | 'ducked' | 'paused';
export type PlayerInfo = {current: {id: string; title: string} | null; error: string | null; stopped: boolean};
export type SavedPosition = {trackId: string; time: number};

/** Share of the volume left while the speed is low in duck mode. */
export const DUCK_LEVEL = 0.15;
const RISE_MS = 1500;
const FALL_MS = 1000;
// Volume changes from the settings follow quickly but without a click.
const ADJUST_MS = 250;
const FADE_STEP_MS = 40;
const SAVE_EVERY_MS = 5000;
const MAX_FAILURES = 3;
const RETRY_MS = 1000;
const POSITION_KEY = 'musicPosition';

let audio: HTMLAudioElement | null = null;
let url: string | null = null;
let tracks: Track[] = [];
let order: number[] = [];
let pos = 0;
let mode: PlayerMode = 'off';
let loadToken = 0;
let failures = 0;
let stopped = false;
let error: string | null = null;
let blocked = false;
let lastAttempt = 0;
let lastSave = 0;
/** Where the last visit stopped, until the track list has it. */
let pending: SavedPosition | null = null;
/** Position to jump to once the loaded file's length is known. */
let seekTo: number | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let listener: (info: PlayerInfo) => void = () => undefined;

const settings = (): TypingSettings => useTyping.getState().settings;
const randomSeed = () => (Math.random() * 2 ** 32) >>> 0;
const currentTrack = (): Track | null => tracks[order[pos]] ?? null;
const sounding = () => (mode === 'playing' || mode === 'ducked') && !stopped && currentTrack() !== null;
const targetVolume = () => {
  const volume = Math.min(1, Math.max(0, settings().musicVolume));
  return mode === 'playing' ? volume : mode === 'ducked' ? volume * DUCK_LEVEL : 0;
};

const notify = () => {
  const track = currentTrack();
  listener({current: track ? {id: track.id, title: track.title} : null, error, stopped});
};

const savePosition = () => {
  const track = currentTrack();
  // Before the restored position is applied, the element still reports 0.
  if (!track || !audio || seekTo !== null) return;
  lastSave = performance.now();
  void setSetting(POSITION_KEY, {trackId: track.id, time: Math.floor(audio.currentTime * 10) / 10} satisfies SavedPosition);
};

const stopFade = () => {
  if (fadeTimer !== null) clearInterval(fadeTimer);
  fadeTimer = null;
};

const fade = (el: HTMLAudioElement, to: number, ms: number, done?: () => void) => {
  stopFade();
  const from = el.volume;
  const start = performance.now();
  if (ms <= 0 || Math.abs(from - to) < 0.001) {
    el.volume = to;
    done?.();
    return;
  }
  // A timer rather than animation frames: fades must finish in a background tab too.
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / ms);
    el.volume = from + (to - from) * k;
    if (k < 1) return;
    stopFade();
    done?.();
  }, FADE_STEP_MS);
};

const start = (el: HTMLAudioElement) => {
  lastAttempt = performance.now();
  el.play().then(
    () => {
      blocked = false;
    },
    (reason: unknown) => {
      // Without a user gesture yet the browser refuses; the next tick tries again.
      // Files that cannot be decoded also raise the element's error event, handled there.
      if (reason instanceof DOMException && reason.name === 'NotAllowedError') blocked = true;
    },
  );
};

/** Brings the element in line with the mode; `ms` is the fade length. */
const apply = (ms: number) => {
  const el = audio;
  if (!el || !url) return;
  if (sounding()) {
    if (el.paused) {
      el.volume = 0;
      start(el);
    }
    fade(el, targetVolume(), ms);
  } else if (!el.paused) {
    fade(el, 0, ms, () => {
      if (!sounding()) el.pause();
    });
  }
};

const fail = () => {
  failures++;
  if (failures >= MAX_FAILURES) {
    stopped = true;
    error = 'Üst üste üç parça çalınamadı; dosyaların biçimini kontrol et.';
    stopFade();
    audio?.pause();
    notify();
    return;
  }
  move(1);
};

const element = () => {
  if (audio) return audio;
  const el = new Audio();
  el.preload = 'auto';
  el.volume = 0;
  el.addEventListener('ended', () => move(1));
  el.addEventListener('error', () => {
    // Clearing the source also raises an error; only the loaded track counts.
    if (url && el.src === url) fail();
  });
  el.addEventListener('loadedmetadata', () => {
    failures = 0;
    if (seekTo !== null && Number.isFinite(el.duration) && seekTo < el.duration - 1) el.currentTime = seekTo;
    seekTo = null;
  });
  el.addEventListener('timeupdate', () => {
    if (!el.paused && performance.now() - lastSave >= SAVE_EVERY_MS) savePosition();
  });
  el.addEventListener('pause', savePosition);
  window.addEventListener('pagehide', savePosition);
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('nexttrack', () => player.next());
      navigator.mediaSession.setActionHandler('previoustrack', () => player.previous());
    } catch {
      // Older browsers lack some actions.
    }
  }
  audio = el;
  return el;
};

const showMetadata = (track: Track | null) => {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  navigator.mediaSession.metadata = track ? new MediaMetadata({title: track.title, artist: track.artist ?? ''}) : null;
};

const unload = () => {
  loadToken++;
  stopFade();
  seekTo = null;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  if (url) URL.revokeObjectURL(url);
  url = null;
  showMetadata(null);
};

/** Opens the current track's file and puts it in the element, then follows the mode. */
const loadCurrent = async () => {
  const track = currentTrack();
  if (!track) return unload();
  const token = ++loadToken;
  notify();
  showMetadata(track);
  seekTo = pending?.trackId === track.id && pending.time > 0 ? pending.time : null;
  pending = null;
  let file: File;
  try {
    file = await track.open();
  } catch {
    if (token === loadToken) fail();
    return;
  }
  if (token !== loadToken) return;
  const el = element();
  const previous = url;
  url = URL.createObjectURL(file);
  el.src = url;
  if (previous) URL.revokeObjectURL(previous);
  // A track that follows another keeps its level; a start from silence fades in.
  if (sounding()) {
    start(el);
    fade(el, targetVolume(), RISE_MS);
  }
};

const move = (delta: 1 | -1) => {
  if (!tracks.length) return;
  if (delta === 1 && pos + 1 >= order.length) {
    order = settings().musicShuffle ? nextRound(tracks.length, randomSeed(), order[pos]) : playOrder(tracks.length, false, 0);
    pos = 0;
  } else {
    pos = (pos + delta + order.length) % order.length;
  }
  const track = currentTrack();
  if (track) void setSetting(POSITION_KEY, {trackId: track.id, time: 0} satisfies SavedPosition);
  void loadCurrent();
};

export const player = {
  onChange(callback: (info: PlayerInfo) => void) {
    listener = callback;
  },

  /** Reads where the last visit stopped; used when the tracks arrive. */
  async restore() {
    const saved = await getSetting<SavedPosition | null>(POSITION_KEY, null);
    if (saved && typeof saved.trackId === 'string' && typeof saved.time === 'number') pending = saved;
  },

  /** A new list; the track playing now goes on if it is still there. */
  setTracks(list: Track[]) {
    const playing = url ? currentTrack()?.id : undefined;
    const wanted = playing ?? pending?.trackId ?? currentTrack()?.id;
    tracks = list;
    failures = 0;
    stopped = false;
    error = null;
    const first = Math.max(0, list.findIndex((t) => t.id === wanted));
    order = playOrder(list.length, settings().musicShuffle, randomSeed(), first);
    pos = Math.max(0, order.indexOf(first));
    if (!list.length) {
      unload();
      notify();
    } else if (playing !== undefined && playing === currentTrack()?.id) {
      notify();
    } else {
      void loadCurrent();
    }
  },

  setMode(next: PlayerMode) {
    if (next === mode) return;
    const rising = next === 'playing';
    mode = next;
    apply(rising ? RISE_MS : FALL_MS);
  },

  /** Follows volume and shuffle changes from the settings. */
  settingsChanged(prev: TypingSettings, next: TypingSettings) {
    if (next.musicShuffle !== prev.musicShuffle && tracks.length) {
      const index = order[pos];
      order = playOrder(tracks.length, next.musicShuffle, randomSeed(), index);
      pos = Math.max(0, order.indexOf(index));
    }
    if (next.musicVolume !== prev.musicVolume && audio && !audio.paused && sounding()) fade(audio, targetVolume(), ADJUST_MS);
  },

  /** Called a few times a second: retries a start the browser refused. */
  tick(now: number) {
    if (blocked && audio && audio.paused && sounding() && now - lastAttempt >= RETRY_MS) start(audio);
  },

  next() {
    stopped = false;
    error = null;
    failures = 0;
    move(1);
  },

  previous() {
    stopped = false;
    error = null;
    failures = 0;
    move(-1);
  },

  snapshot: () => ({
    paused: audio?.paused ?? true,
    currentTime: audio?.currentTime ?? 0,
    volume: audio?.volume ?? 0,
    trackId: currentTrack()?.id ?? null,
  }),
};
