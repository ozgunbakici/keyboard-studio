import {describe, expect, it} from 'vitest';
import {backspace, createTyping, finishTyping, typeChar, typingResult, type TypingState} from './engine';

const typeAll = (state: TypingState, text: string, start = 0, step = 200) =>
  [...text].reduce((s, ch, i) => typeChar(s, ch, start + i * step), state);

describe('typing engine', () => {
  it('measures speed and accuracy of a clean run', () => {
    // 10 characters, one every 200 ms: 1.8 s from first to last keystroke.
    const s = typeAll(createTyping('asdf jkl;a', {mode: 'strict'}), 'asdf jkl;a');
    expect(s.finishedAt).toBe(1800);
    const r = typingResult(s);
    expect(r.chars).toBe(10);
    expect(r.accuracy).toBe(1);
    expect(r.wpm).toBeCloseTo(10 / 5 / (1.8 / 60), 5);
    // The first keystroke has nothing before it, so only the second "a" is timed.
    expect(r.perChar.a).toEqual({hits: 2, errors: 0, ms: 200, timed: 1});
  });

  it('keeps the cursor on a wrong key in strict mode', () => {
    let s = createTyping('ab', {mode: 'strict'});
    s = typeChar(s, 'a', 0);
    s = typeChar(s, 'x', 100);
    expect(s.pos).toBe(1);
    expect(s.states[1]).toBe('incorrect');
    s = typeChar(s, 'b', 300);
    expect(s.states[1]).toBe('corrected');
    expect(s.finishedAt).toBe(300);
    const r = typingResult(s);
    expect(r.errors).toBe(1);
    expect(r.accuracy).toBeCloseTo(2 / 3);
    // The correct "b" followed a mistake, so its time is not counted as key speed.
    expect(r.perChar.b).toEqual({hits: 2, errors: 1, ms: 0, timed: 0});
  });

  it('moves on after a mistake in free mode and lets Backspace fix it', () => {
    let s = createTyping('cat', {mode: 'free'});
    s = typeChar(s, 'c', 0);
    s = typeChar(s, 'o', 100);
    expect(s.pos).toBe(2);
    expect(s.wrong[1]).toBe('o');
    s = backspace(s, 200);
    expect(s.pos).toBe(1);
    expect(s.states[1]).toBe('pending');
    s = typeAll(s, 'at', 300);
    expect(s.states).toEqual(['correct', 'corrected', 'correct']);
    expect(s.finishedAt).not.toBeNull();
  });

  it('fills in code indentation after Enter and steps back over it', () => {
    const code = 'if x:\n    y\n';
    let s = createTyping(code, {mode: 'free', autoIndent: true});
    s = typeAll(s, 'if x:\n');
    expect(s.pos).toBe(10);
    expect(s.states.slice(6, 10)).toEqual(['auto', 'auto', 'auto', 'auto']);
    s = backspace(s, 5000);
    expect(s.pos).toBe(5);
    expect(s.states[6]).toBe('pending');
    s = typeAll(s, '\ny\n', 6000);
    expect(s.finishedAt).not.toBeNull();
    // Indentation is not counted as typed characters.
    expect(typingResult(s).chars).toBe(8);
  });

  it('ignores Backspace in strict mode and input after the end', () => {
    let s = typeAll(createTyping('a', {mode: 'strict'}), 'a');
    expect(backspace(s, 500)).toBe(s);
    expect(typeChar(s, 'b', 600)).toBe(s);
    s = createTyping('ab', {mode: 'strict'});
    expect(backspace(typeChar(s, 'a', 0), 10).pos).toBe(1);
  });

  it('can be stopped by a timer and traces speed per second', () => {
    let s = createTyping('the quick brown fox', {mode: 'free'});
    s = typeAll(s, 'the quick', 0, 250);
    s = finishTyping(s, 3000);
    const r = typingResult(s);
    expect(r.durationMs).toBe(3000);
    expect(r.speedTrace).toHaveLength(3);
    expect(r.speedTrace[2]).toBe(Math.round(9 / 5 / (3 / 60)));
    expect(r.errorTrace).toEqual([0, 0, 0]);
  });
});
