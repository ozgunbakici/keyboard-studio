/**
 * A typing run as a pure state machine. The screen feeds it characters and
 * Backspace with timestamps (ms); speed, accuracy and per-key numbers are
 * computed from the state, so the logic is testable without a browser.
 */

export type CharState = 'pending' | 'correct' | 'incorrect' | 'corrected' | 'auto';

/** Per expected character: attempts, wrong keystrokes, and time spent on correct ones. */
export type KeyStat = {hits: number; errors: number; ms: number; timed: number};

export type TypingOptions = {
  /** strict: a wrong key keeps the cursor in place; free: it moves on and Backspace fixes it. */
  mode: 'strict' | 'free';
  /** Code: the indentation after a line break is filled in, as an editor would. */
  autoIndent?: boolean;
};

export type TypingState = {
  target: string;
  options: TypingOptions;
  pos: number;
  states: CharState[];
  /** What was typed at positions that are wrong right now (free mode). */
  wrong: (string | undefined)[];
  /** Positions that were typed wrong at least once. */
  missed: boolean[];
  keystrokes: number;
  errors: number;
  startedAt: number | null;
  lastAt: number | null;
  lastOk: boolean;
  finishedAt: number | null;
  perChar: Record<string, KeyStat>;
  /** Times of correct and wrong keystrokes, for the speed-over-time chart. */
  hitTimes: number[];
  errorTimes: number[];
};

export type TypingResult = {
  durationMs: number;
  /** Correct characters per minute / 5. */
  wpm: number;
  /** All typed characters per minute / 5. */
  raw: number;
  /** Share of keystrokes that were right, 0–1. */
  accuracy: number;
  chars: number;
  keystrokes: number;
  errors: number;
  perChar: Record<string, KeyStat>;
  /** Average speed so far at each full second. */
  speedTrace: number[];
  /** Wrong keystrokes in each second. */
  errorTrace: number[];
};

// A pause longer than this is thinking time, not key speed.
const MAX_GAP = 2000;

/** Marks the indentation at the start of a line as typed. */
const skipIndent = (states: CharState[], target: string, pos: number) => {
  if (pos !== 0 && target[pos - 1] !== '\n') return pos;
  let p = pos;
  while (target[p] === ' ') states[p++] = 'auto';
  return p;
};

export const createTyping = (target: string, options: TypingOptions): TypingState => {
  const states: CharState[] = Array.from({length: target.length}, () => 'pending');
  return {
    target,
    options,
    pos: options.autoIndent ? skipIndent(states, target, 0) : 0,
    states,
    wrong: Array.from({length: target.length}, () => undefined),
    missed: Array.from({length: target.length}, () => false),
    keystrokes: 0,
    errors: 0,
    startedAt: null,
    lastAt: null,
    lastOk: false,
    finishedAt: null,
    perChar: {},
    hitTimes: [],
    errorTimes: [],
  };
};

export const typeChar = (s: TypingState, ch: string, t: number): TypingState => {
  if (s.finishedAt !== null || s.pos >= s.target.length) return s;
  const expected = s.target[s.pos];
  const ok = ch === expected;
  const states = [...s.states];
  const wrong = [...s.wrong];
  const missed = [...s.missed];

  const before = s.perChar[expected] ?? {hits: 0, errors: 0, ms: 0, timed: 0};
  const gap = s.lastAt !== null ? t - s.lastAt : Infinity;
  const timed = ok && s.lastOk && gap <= MAX_GAP;
  const perChar = {
    ...s.perChar,
    [expected]: {
      hits: before.hits + 1,
      errors: before.errors + (ok ? 0 : 1),
      ms: before.ms + (timed ? gap : 0),
      timed: before.timed + (timed ? 1 : 0),
    },
  };

  let pos = s.pos;
  if (ok) {
    states[pos] = missed[pos] ? 'corrected' : 'correct';
    wrong[pos] = undefined;
    pos++;
    if (expected === '\n' && s.options.autoIndent) pos = skipIndent(states, s.target, pos);
  } else {
    missed[pos] = true;
    states[pos] = 'incorrect';
    if (s.options.mode === 'free') wrong[pos++] = ch;
  }
  const done = pos >= s.target.length;
  return {
    ...s,
    pos,
    states,
    wrong,
    missed,
    keystrokes: s.keystrokes + 1,
    errors: s.errors + (ok ? 0 : 1),
    startedAt: s.startedAt ?? t,
    lastAt: t,
    lastOk: ok,
    finishedAt: done ? t : null,
    perChar,
    hitTimes: ok ? [...s.hitTimes, t] : s.hitTimes,
    errorTimes: ok ? s.errorTimes : [...s.errorTimes, t],
  };
};

/** Steps back one character (free mode only), over automatic indentation too. */
export const backspace = (s: TypingState, t: number): TypingState => {
  if (s.options.mode !== 'free' || s.finishedAt !== null || s.pos === 0) return s;
  let pos = s.pos - 1;
  while (pos > 0 && s.states[pos] === 'auto') pos--;
  if (s.states[pos] === 'auto') return s;
  const states = [...s.states];
  const wrong = [...s.wrong];
  for (let p = pos; p < s.pos; p++) {
    states[p] = 'pending';
    wrong[p] = undefined;
  }
  return {...s, pos, states, wrong, lastAt: t, lastOk: false};
};

/** Ends a timed run early; nothing more can be typed. */
export const finishTyping = (s: TypingState, t: number): TypingState => (s.finishedAt !== null ? s : {...s, finishedAt: t});

const perSecond = (times: number[], start: number, seconds: number) => {
  const counts = Array.from({length: seconds}, () => 0);
  for (const time of times) counts[Math.min(seconds - 1, Math.floor((time - start) / 1000))]++;
  return counts;
};

export const typingResult = (s: TypingState, now: number = s.finishedAt ?? s.lastAt ?? 0): TypingResult => {
  const start = s.startedAt ?? now;
  const durationMs = Math.max(1, now - start);
  const minutes = durationMs / 60000;
  const chars = s.states.filter((c) => c === 'correct' || c === 'corrected').length;
  const seconds = Math.max(1, Math.ceil(durationMs / 1000));
  const hits = perSecond(s.hitTimes, start, seconds);
  let sum = 0;
  const speedTrace = hits.map((n, i) => {
    sum += n;
    return Math.round(sum / 5 / ((i + 1) / 60));
  });
  return {
    durationMs,
    wpm: s.startedAt === null ? 0 : chars / 5 / minutes,
    raw: s.startedAt === null ? 0 : s.keystrokes / 5 / minutes,
    accuracy: s.keystrokes ? (s.keystrokes - s.errors) / s.keystrokes : 1,
    chars,
    keystrokes: s.keystrokes,
    errors: s.errors,
    perChar: s.perChar,
    speedTrace,
    errorTrace: perSecond(s.errorTimes, start, seconds),
  };
};
