import type {HostLayout} from '@/keycodes/host-layouts';
import type {KeyStat} from './engine';
import {charKey, type BoardShape} from './fingers';
import {lessonStars} from './lessons';
import type {TypingRecord} from './store';

/** Per-character totals over the most recent runs. */
export const aggregateKeys = (records: TypingRecord[], last = 60) => {
  const totals = new Map<string, KeyStat>();
  for (const record of records.slice(-last)) {
    for (const [ch, [hits, errors, ms, timed]] of Object.entries(record.keys)) {
      const t = totals.get(ch) ?? {hits: 0, errors: 0, ms: 0, timed: 0};
      totals.set(ch, {hits: t.hits + hits, errors: t.errors + errors, ms: t.ms + ms, timed: t.timed + timed});
    }
  }
  return totals;
};

export type KeyRow = {char: string; hits: number; errors: number; errorRate: number; avgMs: number | null; score: number};

/**
 * Keys that most need work: frequent mistakes first, unusually slow keys next.
 * Rates are smoothed so a key seen twice cannot top the list by one slip.
 */
export const weakKeys = (totals: Map<string, KeyStat>, {minHits = 12, limit = 8} = {}): KeyRow[] => {
  const rows: KeyRow[] = [...totals]
    .filter(([ch, s]) => s.hits >= minHits && ch !== ' ' && ch !== '\n')
    .map(([char, s]) => ({char, hits: s.hits, errors: s.errors, errorRate: s.errors / s.hits, avgMs: s.timed ? s.ms / s.timed : null, score: 0}));
  const times = rows.map((r) => r.avgMs).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;
  for (const row of rows) {
    const slowness = median && row.avgMs ? Math.max(0, row.avgMs / median - 1) : 0;
    row.score = (row.errors + 1) / (row.hits + 20) + slowness * 0.04;
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
};

export type KeyHeat = {hits: number; errors: number; rate: number};

/** Mistakes per physical key ("KC_A"), merging a key's characters (a and A). */
export const keyHeat = (totals: Map<string, KeyStat>, host: HostLayout, shape: BoardShape) => {
  const byKey = new Map<string, KeyHeat>();
  for (const [ch, s] of totals) {
    const where = charKey(host, ch, shape);
    if (!where || where.key === 'KC_SPC') continue;
    const t = byKey.get(where.key) ?? {hits: 0, errors: 0, rate: 0};
    byKey.set(where.key, {hits: t.hits + s.hits, errors: t.errors + s.errors, rate: 0});
  }
  for (const value of byKey.values()) value.rate = value.hits ? value.errors / value.hits : 0;
  return byKey;
};

/** Heat 0–1 relative to the worst key, ignoring keys with too few presses. */
export const heatScale = (heat: Map<string, KeyHeat>, minHits = 8) => {
  const worst = Math.max(0.01, ...[...heat.values()].filter((h) => h.hits >= minHits).map((h) => h.rate));
  return (h: KeyHeat | undefined) => (h && h.hits >= minHits ? Math.min(1, h.rate / worst) : undefined);
};

/** Best attempt of a lesson: most stars, then fastest. */
export const lessonBest = (records: TypingRecord[], lessonId: string, goalWpm: number) => {
  let best: {wpm: number; accuracy: number; stars: number} | null = null;
  for (const r of records) {
    if (r.kind !== 'lesson' || r.source !== lessonId) continue;
    const stars = lessonStars(r, goalWpm);
    if (!best || stars > best.stars || (stars === best.stars && r.wpm > best.wpm)) best = {wpm: r.wpm, accuracy: r.accuracy, stars};
  }
  return best;
};

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export const summary = (records: TypingRecord[]) => {
  const tests = records.filter((r) => r.kind === 'test');
  const recent = tests.slice(-10);
  const earlier = tests.slice(-20, -10);
  return {
    runs: records.length,
    totalMs: records.reduce((a, r) => a + r.durationMs, 0),
    bestTest: tests.length ? Math.max(...tests.map((r) => r.wpm)) : null,
    recentWpm: average(recent.map((r) => r.wpm)),
    earlierWpm: average(earlier.map((r) => r.wpm)),
    recentAccuracy: average(records.slice(-10).map((r) => r.accuracy)),
  };
};
