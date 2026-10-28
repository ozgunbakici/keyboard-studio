import {describe, expect, it} from 'vitest';
import {keySize, voicesFor, type Voice} from './sound';

const fixed = () => 0.5;
const loudness = (voices: Voice[]) => voices.reduce((sum, v) => sum + v.gain, 0);
const lowest = (voices: Voice[]) => Math.min(...voices.map((v) => v.freq));

describe('switch sounds', () => {
  it('stays silent when off', () => {
    expect(voicesFor('off', 'press', 'a')).toEqual([]);
    expect(voicesFor('off', 'release', 'a')).toEqual([]);
  });

  it('sizes keys like a real board', () => {
    expect(keySize(' ')).toBe('space');
    expect(keySize('Enter')).toBe('wide');
    expect(keySize('a')).toBe('normal');
  });

  it('gives the space bar a lower, longer sound with a stabiliser rattle', () => {
    const letter = voicesFor('linear', 'press', 'a', fixed);
    const space = voicesFor('linear', 'press', ' ', fixed);
    expect(space.length).toBe(letter.length + 1);
    expect(lowest(space)).toBeLessThan(lowest(letter));
    expect(Math.max(...space.map((v) => v.decay))).toBeGreaterThan(Math.max(...letter.map((v) => v.decay)));
  });

  it('sounds like the switch type', () => {
    const clicky = voicesFor('clicky', 'press', 'a', fixed);
    expect(clicky.some((v) => v.kind === 'noise' && v.filter === 'highpass' && v.at === 0)).toBe(true);
    // A tactile bump comes before the bottom-out.
    expect(voicesFor('tactile', 'press', 'a', fixed).some((v) => v.at > 0)).toBe(true);
    // Thock stays low: no layer above 2 kHz.
    expect(Math.max(...voicesFor('thock', 'press', 'a', fixed).map((v) => v.freq))).toBeLessThan(2100);
    for (const sound of ['linear', 'tactile', 'clicky', 'thock'] as const) {
      expect(loudness(voicesFor(sound, 'release', 'a', fixed))).toBeLessThan(loudness(voicesFor(sound, 'press', 'a', fixed)));
    }
  });

  it('varies a little from press to press', () => {
    const a = voicesFor('linear', 'press', 'a', () => 0);
    const b = voicesFor('linear', 'press', 'a', () => 1);
    expect(a[0].freq).not.toBe(b[0].freq);
    expect(b[0].freq / a[0].freq).toBeLessThan(1.07);
  });
});
