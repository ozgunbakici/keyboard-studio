import {create} from 'zustand';
import {db, getSetting, setSetting} from '@/storage/db';
import type {TypingResult} from './engine';
import type {SwitchSound} from './sound';
import type {Language} from './text';

export type TypingKind = 'lesson' | 'practice' | 'test';

/** One finished run, as stored in the browser. */
export type TypingRecord = {
  id?: number;
  at: number;
  kind: TypingKind;
  /** Lesson id, practice source or test setup, e.g. "home-fj", "python", "test-en-60". */
  source: string;
  label: string;
  durationMs: number;
  wpm: number;
  raw: number;
  accuracy: number;
  chars: number;
  errors: number;
  /** Expected character -> [attempts, errors, timed ms, timed keystrokes]. */
  keys: Record<string, [number, number, number, number]>;
};

export type PracticeSource =
  | 'tr-words'
  | 'en-words'
  | 'tr-sentences'
  | 'en-sentences'
  | 'tr-books'
  | 'en-books'
  | 'python'
  | 'java'
  | 'numbers'
  | 'symbols'
  | 'weak'
  | 'custom';

/** A text the user pasted (e.g. a book chapter), practised passage by passage. */
export type SavedText = {id: string; title: string; text: string; position: number};

export type TypingSettings = {
  /** Keep ç ğ ı ö ş ü in Turkish texts; off folds them for a US layout. */
  turkishChars: boolean;
  /** Practice: a wrong key must be retyped (strict) or can be fixed with Backspace (free). */
  practiceMode: 'strict' | 'free';
  goalWpm: number;
  showKeyboard: boolean;
  testSeconds: number;
  testLanguage: Language;
  testPunctuation: boolean;
  testNumbers: boolean;
  /** Older single pasted text; moved into `customTexts` on load. */
  customText: string;
  customTexts: SavedText[];
  activeText: string | null;
  practiceSource: PracticeSource;
  /** Practice text length: about two lines, or four and more. */
  practiceLength: 'normal' | 'long';
  /** Sound of each key press, like a switch type; off by default. */
  switchSound: SwitchSound;
  /** 0–1. */
  soundVolume: number;
  /** Next lesson of the code courses. */
  course: {python: number; java: number};
};

export const defaultTypingSettings: TypingSettings = {
  turkishChars: false,
  practiceMode: 'free',
  goalWpm: 30,
  showKeyboard: true,
  testSeconds: 60,
  testLanguage: 'tr',
  testPunctuation: false,
  testNumbers: false,
  customText: '',
  customTexts: [],
  activeText: null,
  practiceSource: 'tr-words',
  practiceLength: 'normal',
  switchSound: 'off',
  soundVolume: 0.6,
  course: {python: 0, java: 0},
};

type TypingStore = {loaded: boolean; records: TypingRecord[]; settings: TypingSettings};

export const useTyping = create<TypingStore>(() => ({loaded: false, records: [], settings: defaultTypingSettings}));

let loading: Promise<void> | null = null;

export const loadTyping = () => {
  loading ??= (async () => {
    const [records, stored] = await Promise.all([
      db.typing.orderBy('at').toArray().catch(() => [] as TypingRecord[]),
      getSetting<Partial<TypingSettings>>('typingSettings', {}),
    ]);
    const settings = {...defaultTypingSettings, ...stored, course: {...defaultTypingSettings.course, ...stored.course}};
    if (settings.customText.trim() && !settings.customTexts.length) {
      settings.customTexts = [{id: 'metin-1', title: 'Metnim', text: settings.customText, position: 0}];
      settings.activeText = 'metin-1';
      settings.customText = '';
    }
    useTyping.setState({loaded: true, records, settings});
  })();
  return loading;
};

/** Reads history and settings again after changes from another device were stored. */
export const reloadTyping = () => {
  if (!useTyping.getState().loaded) return Promise.resolve();
  loading = null;
  return loadTyping();
};

export const updateTypingSettings = async (patch: Partial<TypingSettings>) => {
  const settings = {...useTyping.getState().settings, ...patch};
  useTyping.setState({settings});
  await setSetting('typingSettings', settings);
};

export const toRecord = (result: TypingResult, kind: TypingKind, source: string, label: string): TypingRecord => ({
  at: Date.now(),
  kind,
  source,
  label,
  durationMs: Math.round(result.durationMs),
  wpm: Math.round(result.wpm * 10) / 10,
  raw: Math.round(result.raw * 10) / 10,
  accuracy: Math.round(result.accuracy * 1000) / 1000,
  chars: result.chars,
  errors: result.errors,
  keys: Object.fromEntries(Object.entries(result.perChar).map(([ch, s]) => [ch, [s.hits, s.errors, Math.round(s.ms), s.timed]])),
});

/** Runs this short are warm-ups and would only add noise to the history. */
export const worthKeeping = (result: TypingResult) => result.chars >= 10 && result.durationMs >= 3000;

export const saveTypingRecord = async (record: TypingRecord) => {
  let id: number | undefined;
  try {
    id = await db.typing.add(record);
  } catch {
    // Storage unavailable: keep the result for this visit only.
  }
  useTyping.setState((s) => ({records: [...s.records, {...record, id}]}));
};

export const clearTypingHistory = async () => {
  await db.typing.clear().catch(() => undefined);
  useTyping.setState({records: []});
};
