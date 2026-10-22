import {describe, expect, it} from 'vitest';
import {evalShowIf, showIfDependencies} from './showif';

describe('showIf expressions', () => {
  const values = {effect: [24], speed: [10, 2], enabled: [1]};

  it('evaluates comparisons and boolean logic', () => {
    expect(evalShowIf('{effect} != 0', values)).toBe(true);
    expect(evalShowIf('{effect} != 0 && {effect} != 24', values)).toBe(false);
    expect(evalShowIf('{effect} == 1 || {enabled} == 1', values)).toBe(true);
    expect(evalShowIf('!({effect} == 24)', values)).toBe(false);
    expect(evalShowIf('{speed.1} >= 2 && {speed.0} < 11', values)).toBe(true);
    expect(evalShowIf('{missing} == 0', values)).toBe(true);
  });

  it('respects precedence: && binds tighter than ||', () => {
    expect(evalShowIf('1 == 1 || 1 == 0 && 0 == 1', {})).toBe(true);
    expect(evalShowIf('(1 == 1 || 1 == 0) && 0 == 1', {})).toBe(false);
  });

  it('never hides controls when an expression is malformed', () => {
    expect(evalShowIf('{effect} === 3', values)).toBe(true);
    expect(evalShowIf('({effect} == 3', values)).toBe(true);
  });

  it('lists dependencies', () => {
    expect(showIfDependencies('{a} == 1 && {b.2} > {a}')).toEqual(['a', 'b']);
  });
});
