import {describe, expect, it} from 'vitest';
import {ATTACK_MS, initialGate, isResting, RELEASE_MS, REST_MS, stepGate, type GateInput, type GateState} from './gate';
import {comparePaths, fileTracks, isAudioFile, parentOf, titleOf, walkFolder, type DirectoryHandleLike, type FileHandleLike} from './library';
import {nextRound, playOrder} from './order';
import {rollingWpm} from './speed';

describe('rollingWpm', () => {
  // 10 correct keys a second = 120 WPM.
  const hits = (from: number, to: number, perSecond = 10) => Array.from({length: Math.round(((to - from) / 1000) * perSecond)}, (_, i) => from + i * (1000 / perSecond));

  it('is null before the run is measurable', () => {
    expect(rollingWpm([], 1000, null)).toBeNull();
    expect(rollingWpm(hits(0, 1900), 1900, 0)).toBeNull();
    expect(rollingWpm(hits(0, 2000), 2000, 0)).not.toBeNull();
  });

  it('measures from the start while the run is shorter than the window', () => {
    expect(rollingWpm(hits(0, 3000), 3000, 0)).toBeCloseTo(120, 0);
  });

  it('only counts the last window', () => {
    const times = [...hits(0, 10000, 20), ...hits(10000, 20000, 5)];
    expect(rollingWpm(times, 20000, 0)).toBeCloseTo(60, 0);
    expect(rollingWpm(times, 20000, 0, 2000)).toBeCloseTo(60, 0);
  });

  it('falls to zero when typing stops', () => {
    expect(rollingWpm(hits(0, 5000), 11000, 0)).toBe(0);
  });

  it('ignores keystrokes after now', () => {
    expect(rollingWpm([1000, 2000, 9000], 3000, 0, 5000)).toBeCloseTo(8, 5);
  });
});

describe('stepGate', () => {
  const T = 50;
  /** Feeds the gate one input every 100 ms from `from` to `to`. */
  const run = (state: GateState, from: number, to: number, input: Omit<GateInput, 'now' | 'threshold'>) => {
    let s = state;
    for (let now = from; now <= to; now += 100) s = stepGate(s, {...input, now, threshold: T});
    return s;
  };
  const fast = {wpm: 60, running: true};
  const band = {wpm: 47, running: true};
  const slow = {wpm: 30, running: true};
  const on = run(initialGate, 0, ATTACK_MS, fast);

  it('turns on after the speed held for the attack time', () => {
    expect(run(initialGate, 0, ATTACK_MS - 100, fast).on).toBe(false);
    expect(on.on).toBe(true);
  });

  it('needs the speed continuously to turn on', () => {
    let s = run(initialGate, 0, 1000, fast);
    s = run(s, 1100, 1200, band);
    s = run(s, 1300, 2700, fast);
    expect(s.on).toBe(false);
    expect(run(s, 2800, 2800, fast).on).toBe(true);
  });

  it('turns off after the release time below 90 %', () => {
    expect(run(on, 2000, 2000 + RELEASE_MS - 100, slow).on).toBe(true);
    expect(run(on, 2000, 2000 + RELEASE_MS, slow).on).toBe(false);
  });

  it('keeps its value in the band between 90 % and the threshold', () => {
    expect(run(on, 2000, 20000, band).on).toBe(true);
    expect(run(initialGate, 0, 20000, band).on).toBe(false);
    expect(run(on, 2000, 20000, {wpm: 45, running: true}).on).toBe(true);
  });

  it('lets short dips pass', () => {
    let s = run(on, 2000, 4000, slow);
    s = run(s, 4100, 4500, fast);
    s = run(s, 4600, 6600, slow);
    s = run(s, 6700, 6800, band);
    s = run(s, 6900, 8900, slow);
    expect(s.on).toBe(true);
  });

  it('keeps the value while the speed is not measurable', () => {
    expect(run(on, 2000, 10000, {wpm: null, running: true}).on).toBe(true);
    expect(run(initialGate, 0, 10000, {wpm: null, running: true}).on).toBe(false);
    // An unmeasurable moment breaks a slow stretch.
    let s = run(on, 2000, 4000, slow);
    s = stepGate(s, {now: 4100, wpm: null, running: true, threshold: T});
    expect(run(s, 4200, 6000, slow).on).toBe(true);
  });

  it('stays on for the rest after a run, then turns off', () => {
    const rest = {wpm: null, running: false};
    expect(run(on, 2000, 2000 + REST_MS - 100, rest).on).toBe(true);
    const after = run(on, 2000, 2000 + REST_MS, rest);
    expect(after.on).toBe(false);
    expect(isResting(after, 2000 + REST_MS)).toBe(true);
    expect(isResting(on, 2000 + REST_MS)).toBe(false);
  });

  it('does not turn on without a run', () => {
    expect(run(initialGate, 0, 30000, {wpm: 200, running: false}).on).toBe(false);
  });

  it('carries a new run within the rest until its speed is measurable', () => {
    let s = run(on, 2000, 2000 + REST_MS - 1000, {wpm: null, running: false});
    // The next run starts just before the rest ends; it is not measurable for 2 s.
    s = run(s, 2000 + REST_MS - 900, 2000 + REST_MS + 1000, {wpm: null, running: true});
    expect(s.on).toBe(true);
    expect(s.idleSince).toBeNull();
    // Then the normal rules: slow for the release time turns it off.
    expect(run(s, 30000, 30000 + RELEASE_MS - 100, slow).on).toBe(true);
    expect(run(s, 30000, 30000 + RELEASE_MS, slow).on).toBe(false);
  });

  it('starts the rest again after each run', () => {
    let s = run(on, 2000, 12000, {wpm: null, running: false});
    s = run(s, 12100, 15000, fast);
    s = run(s, 15100, 15100 + REST_MS - 100, {wpm: null, running: false});
    expect(s.on).toBe(true);
  });

  it('returns the same object when nothing changed', () => {
    const s = stepGate(on, {now: 2000, wpm: 60, running: true, threshold: T});
    expect(stepGate(s, {now: 2100, wpm: 70, running: true, threshold: T})).toBe(s);
  });
});

describe('library helpers', () => {
  it('keeps audio files by extension', () => {
    expect(['a.mp3', 'B.FLAC', 'c.m4a', 'd.opus', 'e.oga', 'f.wav', 'g.aac', 'h.ogg'].every(isAudioFile)).toBe(true);
    expect(['cover.jpg', 'notes.txt', 'mp3', '.mp3', 'x.mp3.part'].some(isAudioFile)).toBe(false);
  });

  it('makes titles and folders from paths', () => {
    expect(titleOf('Album/01 Opening.theme.mp3')).toBe('01 Opening.theme');
    expect(titleOf('noext')).toBe('noext');
    expect(parentOf('OST/Disc 1/01.mp3')).toBe('Disc 1');
    expect(parentOf('01.mp3')).toBeNull();
  });

  it('orders numbers as numbers and albums together', () => {
    const paths = ['B/10 x.mp3', 'A/2 y.mp3', 'B/2 z.mp3', 'A/10 w.mp3', 'a/1 v.mp3'];
    expect([...paths].sort(comparePaths)).toEqual(['a/1 v.mp3', 'A/2 y.mp3', 'A/10 w.mp3', 'B/2 z.mp3', 'B/10 x.mp3']);
  });

  it('turns chosen files into sorted tracks', () => {
    const files = [new File(['x'], '10 Ten.mp3'), new File(['x'], 'cover.png'), new File(['x'], '2 Two.ogg')];
    expect(fileTracks(files).map((t) => [t.id, t.title])).toEqual([
      ['2 Two.ogg', '2 Two'],
      ['10 Ten.mp3', '10 Ten'],
    ]);
  });

  const file = (name: string): FileHandleLike => ({kind: 'file', name, getFile: async () => new File(['x'], name)});
  const dir = (name: string, entries: (FileHandleLike | DirectoryHandleLike)[]): DirectoryHandleLike => ({
    kind: 'directory',
    name,
    async *values() {
      yield* entries;
    },
  });

  it('walks a folder, skipping hidden entries and other files', async () => {
    const root = dir('Music', [
      file('readme.txt'),
      file('.hidden.mp3'),
      dir('.cache', [file('a.mp3')]),
      dir('OST', [file('10 End.mp3'), file('2 Middle.mp3'), file('1 Start.flac'), file('cover.jpg')]),
      file('single.wav'),
    ]);
    expect((await walkFolder(root)).map((f) => f.path)).toEqual(['OST/1 Start.flac', 'OST/2 Middle.mp3', 'OST/10 End.mp3', 'single.wav']);
  });

  it('limits depth and count', async () => {
    let deep: DirectoryHandleLike = dir('d8', [file('deep.mp3')]);
    for (let i = 7; i >= 1; i--) deep = dir(`d${i}`, [deep, file(`at${i}.mp3`)]);
    const paths = (await walkFolder(dir('root', [deep]))).map((f) => f.path);
    expect(paths.some((p) => p.endsWith('at6.mp3'))).toBe(true);
    expect(paths.some((p) => p.endsWith('at7.mp3'))).toBe(false);
    const many = dir('many', Array.from({length: 30}, (_, i) => file(`${i}.mp3`)));
    expect(await walkFolder(many, 6, 10)).toHaveLength(10);
  });
});

describe('play order', () => {
  it('is in order without shuffle', () => {
    expect(playOrder(4, false, 1)).toEqual([0, 1, 2, 3]);
  });

  it('shuffles every track once, reproducibly', () => {
    const order = playOrder(20, true, 42);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({length: 20}, (_, i) => i));
    expect(playOrder(20, true, 42)).toEqual(order);
    expect(playOrder(20, true, 43)).not.toEqual(order);
    expect(order).not.toEqual(playOrder(20, false, 0));
  });

  it('puts the playing track first', () => {
    for (let seed = 0; seed < 20; seed++) expect(playOrder(10, true, seed, 7)[0]).toBe(7);
  });

  it('does not repeat the last track at the start of a new round', () => {
    for (let seed = 0; seed < 50; seed++) {
      const order = nextRound(5, seed, 3);
      expect(order[0]).not.toBe(3);
      expect(new Set(order).size).toBe(5);
    }
    expect(nextRound(1, 0, 0)).toEqual([0]);
    expect(playOrder(0, true, 1)).toEqual([]);
  });
});
