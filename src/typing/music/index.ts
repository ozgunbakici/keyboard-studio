import {create} from 'zustand';
import type {TypingState} from '../engine';
import {loadTyping, useTyping} from '../store';
import {initialGate, isResting, stepGate} from './gate';
import {
  fileTracks,
  folderAccess,
  folderSupported,
  folderTracks,
  forgetFolder,
  pickFolder,
  sortTracks,
  storedFolder,
  type DirectoryHandleLike,
  type Track,
} from './library';
import {player} from './player';
import {rollingWpm} from './speed';

/**
 * Music from the user's own files while typing fast enough: the trainer reports
 * its run, the speed gate decides, the player fades the music up or down.
 */

export type MusicTrack = {id: string; title: string};
/** off: disabled or no tracks · waiting: armed, speed not there yet · playing · ducked · paused */
export type MusicStatus = 'off' | 'waiting' | 'playing' | 'ducked' | 'paused';

export type MusicState = {
  loaded: boolean;
  /** The browser can open a folder (Chromium on desktop); otherwise files are added for one visit. */
  folderSupported: boolean;
  folderName: string | null;
  /** A folder is remembered but the browser wants permission again; call `music.reconnect()` from a click. */
  needsPermission: boolean;
  /** The tracks were added as files and are gone after a reload. */
  sessionOnly: boolean;
  tracks: MusicTrack[];
  current: MusicTrack | null;
  status: MusicStatus;
  /** Speed over the last seconds (rounded), null when not measurable. */
  wpm: number | null;
  /** User-facing, in Turkish. */
  error: string | null;
};

export const useMusic = create<MusicState>(() => ({
  loaded: false,
  folderSupported: folderSupported(),
  folderName: null,
  needsPermission: false,
  sessionOnly: false,
  tracks: [],
  current: null,
  status: 'off',
  wpm: null,
  error: null,
}));

type Run = Pick<TypingState, 'startedAt' | 'finishedAt' | 'hitTimes'>;

// How often the gate moves on by itself, e.g. through the rest after a run.
const TICK_MS = 250;

let run: Run | null = null;
let gate = initialGate;
/** The music has sounded since the last rest ended, so a slow stretch ducks rather than waits. */
let heard = false;
let stopped = false;
let library: Track[] = [];
let folder: DirectoryHandleLike | null = null;
let libraryError: string | null = null;
let playerError: string | null = null;
let loading: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let scanToken = 0;

const patch = (next: Partial<MusicState>) => {
  const state = useMusic.getState();
  if ((Object.keys(next) as (keyof MusicState)[]).some((key) => state[key] !== next[key])) useMusic.setState(next);
};

const showError = () => patch({error: playerError ?? libraryError});

const evaluate = (now: number) => {
  const settings = useTyping.getState().settings;
  const running = run !== null && run.startedAt !== null && run.finishedAt === null;
  const speed = running ? rollingWpm(run!.hitTimes, now, run!.startedAt) : null;
  gate = stepGate(gate, {now, wpm: speed, running, threshold: settings.musicThreshold});
  if (!gate.on && isResting(gate, now)) heard = false;

  let status: MusicStatus;
  if (!settings.musicEnabled || !library.length || stopped) status = 'off';
  else if (gate.on) status = 'playing';
  else if (!heard) status = 'waiting';
  else status = settings.musicBelow === 'pause' ? 'paused' : 'ducked';
  if (status === 'playing') heard = true;

  patch({status, wpm: speed === null ? null : Math.round(speed)});
  player.setMode(status);
  player.tick(now);

  // The runner reports while a run is going; the clock is only needed for what happens
  // without it: the rest after a run and retrying a start the browser refused.
  const ticking = status !== 'off' && (gate.on || heard);
  if (ticking && timer === null) timer = setInterval(() => evaluate(performance.now()), TICK_MS);
  else if (!ticking && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
};

const setLibrary = (list: Track[], state: Partial<MusicState>) => {
  library = list;
  useMusic.setState({...state, tracks: list.map(({id, title}) => ({id, title}))});
  player.setTracks(list);
  showError();
  evaluate(performance.now());
};

const scan = async (handle: DirectoryHandleLike) => {
  const token = ++scanToken;
  let list: Track[];
  try {
    list = await folderTracks(handle);
  } catch {
    if (token !== scanToken) return;
    libraryError = 'Klasör okunamadı.';
    showError();
    return;
  }
  if (token !== scanToken) return;
  libraryError = list.length ? null : 'Bu klasörde müzik dosyası bulunamadı.';
  setLibrary(list, {folderName: handle.name, needsPermission: false, sessionOnly: false});
};

player.onChange((info) => {
  playerError = info.error;
  stopped = info.stopped;
  patch({current: info.current});
  showError();
  evaluate(performance.now());
});

let subscribed = false;
const subscribe = () => {
  if (subscribed) return;
  subscribed = true;
  useTyping.subscribe((state, prev) => {
    if (state.settings === prev.settings) return;
    player.settingsChanged(prev.settings, state.settings);
    evaluate(performance.now());
  });
};

export const music = {
  /** Restores the folder and the position; safe to call repeatedly. */
  load(): Promise<void> {
    loading ??= (async () => {
      subscribe();
      await loadTyping();
      await player.restore();
      const handle = await storedFolder();
      // Files added meanwhile win over the remembered folder.
      if (handle && !library.length) {
        folder = handle;
        patch({folderName: handle.name});
        if (await folderAccess(handle, false)) await scan(handle);
        else patch({needsPermission: true});
      }
      patch({loaded: true});
      evaluate(performance.now());
    })();
    return loading;
  },

  /** Opens the folder picker; call it from a click. A cancelled picker changes nothing. */
  async chooseFolder() {
    let handle: DirectoryHandleLike | null;
    try {
      handle = await pickFolder();
    } catch {
      libraryError = 'Klasör açılamadı.';
      showError();
      return;
    }
    if (!handle) return;
    folder = handle;
    await scan(handle);
  },

  /** Asks the browser again for the remembered folder; call it from a click. */
  async reconnect() {
    if (!folder) return;
    if (await folderAccess(folder, true)) await scan(folder);
  },

  /** Files for this visit only (no folder access, e.g. phones and Firefox); added to earlier ones. */
  addFiles(files: File[]) {
    const added = fileTracks(files);
    if (!added.length) {
      libraryError = 'Seçilen dosyalar arasında müzik yok.';
      showError();
      return;
    }
    const kept = useMusic.getState().sessionOnly ? library.filter((t) => !added.some((a) => a.id === t.id)) : [];
    libraryError = null;
    scanToken++;
    setLibrary(sortTracks([...kept, ...added]), {sessionOnly: true, folderName: null, needsPermission: false});
  },

  /** Forgets the folder and the list. */
  async forget() {
    scanToken++;
    folder = null;
    libraryError = null;
    await forgetFolder();
    setLibrary([], {folderName: null, needsPermission: false, sessionOnly: false});
  },

  next() {
    player.next();
  },

  previous() {
    player.previous();
  },

  /** The runner reports the run on screen, about ten times a second and on every change. */
  track(current: Run, now: number) {
    if (!loading) void music.load();
    run = current;
    evaluate(now);
  },

  /** No run on screen any more. */
  rest(now = performance.now()) {
    run = null;
    evaluate(now);
  },
};

/** What the audio element is doing, for tests. */
export const playerSnapshot = (): {paused: boolean; currentTime: number; volume: number; trackId: string | null} => player.snapshot();
