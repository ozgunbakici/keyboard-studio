import {describe, expect, it} from 'vitest';
import {
  chokeOld,
  customSample,
  keyNote,
  keyRole,
  keySize,
  loadCustomSound,
  mixFor,
  pentatonic,
  sampleFor,
  soundPacks,
  switchSounds,
  useCustomSound,
  voiceEnd,
  voicesFor,
  type SwitchSound,
  type Voice,
} from './sound';

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

const fantasy = ['shotgun', 'laser', 'sword', 'anvil', 'magic', 'wardrum', 'typewriter', 'arcade'] as const;
const roles = {normal: 'a', space: ' ', enter: 'Enter', backspace: 'Backspace', wide: 'Shift'};
// Audio nodes a press creates: source, filter and gain per noise layer, oscillator and gain per tone, plus extras.
const nodes = (voices: Voice[]) =>
  voices.reduce((n, v) => n + (v.kind === 'noise' ? 3 : 2) + (v.kind === 'tone' && v.fm ? 2 : 0) + (v.drive ? 1 : 0), 0);

describe('sound packs', () => {
  it('lists every pack once, in menu order', () => {
    expect(soundPacks.map((s) => s.id)).toEqual(['off', 'linear', 'tactile', 'clicky', 'thock', ...fantasy, 'custom']);
    expect(soundPacks.filter((s) => s.group === 'fantasy')).toHaveLength(8);
    expect(switchSounds).toBe(soundPacks);
  });

  it('tells the key roles apart', () => {
    expect(Object.entries(roles).map(([, key]) => keyRole(key))).toEqual(Object.keys(roles));
    expect(keyRole('Tab')).toBe('wide');
    expect(keyRole('CapsLock')).toBe('wide');
  });

  it('keeps the switches as they were tuned', () => {
    expect(voicesFor('clicky', 'press', 'a', fixed)).toHaveLength(4);
    expect(voicesFor('clicky', 'release', 'a', fixed)).toHaveLength(2);
    expect(mixFor('thock')).toEqual({level: 1, wet: 0});
  });

  it('gives every fantasy pack a light sound for every role', () => {
    for (const sound of fantasy) {
      for (const key of Object.values(roles)) {
        const voices = voicesFor(sound, 'press', key, fixed);
        expect(voices.length, `${sound} ${key}`).toBeGreaterThan(0);
        // Leaves room for the press's own gain and reverb send.
        expect(nodes(voices), `${sound} ${key}`).toBeLessThanOrEqual(11);
      }
    }
  });

  it('plays nothing for custom, off or an unknown pack', () => {
    expect(voicesFor('custom', 'press', 'a')).toEqual([]);
    expect(voicesFor('rocket' as SwitchSound, 'press', 'a')).toEqual([]);
  });

  it('shoots on every key, racks the pump on Enter and is silent on release', () => {
    const shot = voicesFor('shotgun', 'press', 'a', fixed);
    const blast = shot.find((v) => v.kind === 'noise' && v.filter === 'lowpass')!;
    expect(blast.freq).toBeGreaterThan(5000);
    expect(blast.kind === 'noise' && blast.to).toBeLessThan(500);
    expect(shot.some((v) => v.kind === 'tone' && v.freq <= 160 && v.to < 70)).toBe(true);
    const rack = voicesFor('shotgun', 'press', 'Enter', fixed);
    expect(rack.some((v) => v.kind === 'noise' && v.filter === 'lowpass')).toBe(false);
    expect(new Set(rack.map((v) => v.at))).toEqual(new Set([0, 0.12]));
    expect(Math.max(...voicesFor('shotgun', 'press', ' ', fixed).map(voiceEnd))).toBeGreaterThan(Math.max(...shot.map(voiceEnd)));
    expect(voicesFor('shotgun', 'release', 'a', fixed)).toEqual([]);
  });

  it('fires the laser downward, and Backspace upward', () => {
    const pew = voicesFor('laser', 'press', 'a', fixed).find((v) => v.kind === 'tone')!;
    expect(pew.freq).toBeGreaterThan(2000);
    expect(pew.kind === 'tone' && pew.to).toBeLessThan(400);
    const back = voicesFor('laser', 'press', 'Backspace', fixed).find((v) => v.kind === 'tone')!;
    expect(back.kind === 'tone' && back.to).toBeGreaterThan(back.freq);
  });

  it('rings the sword at inharmonic partials over a per-key base', () => {
    for (const key of 'abcdefghij') {
      const tones = voicesFor('sword', 'press', key, fixed).filter((v) => v.kind === 'tone');
      expect(tones[0].freq).toBeGreaterThanOrEqual(900);
      expect(tones[0].freq).toBeLessThanOrEqual(1400);
      expect(tones[1].freq / tones[0].freq).toBeCloseTo(2.76);
    }
  });

  it('gives each key its own note of the pentatonic scale, always the same one', () => {
    expect(keyNote('a')).toBe(keyNote('a'));
    expect(new Set('abcdefghijklmnopqrstuvwxyz'.split('').map(keyNote)).size).toBeGreaterThan(5);
    for (const rand of [() => 0, () => 1]) {
      const bell = voicesFor('magic', 'press', 's', rand)[0];
      expect(pentatonic).toContain(bell.freq);
      expect(bell.freq).toBe(keyNote('s'));
    }
    expect(voicesFor('arcade', 'press', 's', fixed)[0].freq).toBe(keyNote('s'));
  });

  it('keeps the war drum low and hits Enter twice', () => {
    const drum = voicesFor('wardrum', 'press', 'a', fixed).find((v) => v.kind === 'tone')!;
    expect(drum.freq).toBeLessThan(120);
    expect(voicesFor('wardrum', 'press', ' ', fixed).find((v) => v.kind === 'tone')!.freq).toBeLessThan(drum.freq);
    expect(voicesFor('wardrum', 'press', 'Enter', fixed).filter((v) => v.kind === 'tone')).toHaveLength(2);
  });

  it('rings the typewriter bell on Enter and ticks on release', () => {
    expect(voicesFor('typewriter', 'press', 'Enter', fixed).some((v) => v.kind === 'tone' && v.freq > 1800 && v.decay > 1)).toBe(true);
    expect(voicesFor('typewriter', 'release', 'a', fixed)).toHaveLength(1);
  });
});

describe('choke', () => {
  it('drops finished sounds and fades the oldest beyond the limit', () => {
    const ringing = [{until: 1}, {until: 3}, {until: 4}, {until: 5}];
    expect(chokeOld(ringing, 2, 2)).toEqual({keep: [{until: 4}, {until: 5}], choke: [{until: 3}]});
    expect(chokeOld(ringing, 4.5, 2)).toEqual({keep: [{until: 5}], choke: []});
    expect(chokeOld([], 0)).toEqual({keep: [], choke: []});
  });
});

describe('own sound', () => {
  it('varies a little per press, plays Space and Enter lower and nothing on release', () => {
    const low = sampleFor('press', 'a', () => 0)!;
    const high = sampleFor('press', 'a', () => 1)!;
    expect(low.rate).toBeCloseTo(0.96);
    expect(high.rate).toBeCloseTo(1.04);
    expect(sampleFor('press', ' ', () => 0.5)!.rate).toBeCloseTo(0.8);
    expect(sampleFor('press', 'Enter', () => 0.5)!.rate).toBeCloseTo(0.8);
    expect(sampleFor('release', 'a')).toBeNull();
  });

  it('starts empty and loads safely without storage or Web Audio', async () => {
    await loadCustomSound();
    await loadCustomSound();
    expect(useCustomSound.getState().name).toBeNull();
    expect(customSample()).toBeNull();
  });
});
