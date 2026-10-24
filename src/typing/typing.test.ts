import {describe, expect, it} from 'vitest';
import {hostLayouts} from '@/keycodes/host-layouts';
import {charKey, keysToPress, standardKeys, standardPosition} from './fingers';
import {lessonCharset, lessonStars, lessonText, lessons} from './lessons';
import {foldTurkish, focusText, normalizeCode, seededRng, splitPassages, testText} from './text';
import {bookExcerpts} from './content/books';

describe('typing text', () => {
  it('folds Turkish letters for a US layout', () => {
    expect(foldTurkish('Şişli’de çiğ köfte, İğdır, Ünye')).toBe('Sisli’de cig kofte, Igdir, Unye');
  });

  it('normalises code like an editor', () => {
    expect(normalizeCode('\n\tif x:  \n\t\ty\n\n')).toBe('if x:\n    y');
  });

  it('builds reproducible test texts with punctuation', () => {
    const a = testText('en', seededRng(7), {punctuation: true, count: 40});
    expect(a).toBe(testText('en', seededRng(7), {punctuation: true, count: 40}));
    expect(a.charAt(0)).toMatch(/[A-Z]/);
    expect(a.split(' ')).toHaveLength(40);
  });

  it('splits a long text into passages at sentence ends', () => {
    const sentence = (i: number) => `Bu ${i}. cümle biraz uzun tutuldu ki bölümler oluşsun.`;
    const text = `${[1, 2, 3, 4, 5].map(sentence).join(' ')}\n${[6, 7, 8].map(sentence).join(' ')}`;
    const passages = splitPassages(text, 160);
    expect(passages.length).toBeGreaterThan(2);
    expect(passages.every((p) => p.length <= 160)).toBe(true);
    expect(passages.every((p) => /[.!?]$/.test(p))).toBe(true);
    // Nothing is lost or reordered.
    expect(passages.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('keeps book excerpts typeable on a US layout', () => {
    for (const book of bookExcerpts) {
      const typed = foldTurkish(book.text);
      expect([...typed].filter((ch) => !/[\x20-\x7e\n]/.test(ch)), book.id).toEqual([]);
    }
  });

  it('practises weak keys with words that contain them', () => {
    const text = focusText(['q', 'z'], seededRng(3), 20);
    expect(text.split(' ').every((w) => /[qz]/.test(w))).toBe(true);
  });
});

describe('touch typing lessons', () => {
  it('only uses keys taught so far', () => {
    lessons.forEach((lesson, i) => {
      const allowed = lessonCharset(i);
      const text = lessonText(i, seededRng(i + 1));
      expect(text.length).toBeGreaterThan(150);
      const extra = [...text].filter((ch) => !allowed.has(ch) && !(lesson.kind !== 'letters' && /[A-Za-z0-9]/.test(ch)));
      if (lesson.kind === 'letters' || lesson.kind === 'review') expect(extra, lesson.id).toEqual([]);
    });
  });

  it('starts with home-row drills', () => {
    const text = lessonText(0, seededRng(1));
    expect(text).toMatch(/^[fj ]+$/);
  });

  it('awards stars for accuracy and speed', () => {
    expect(lessonStars({wpm: 20, accuracy: 0.92}, 30)).toBe(1);
    expect(lessonStars({wpm: 31, accuracy: 0.96}, 30)).toBe(2);
    expect(lessonStars({wpm: 45, accuracy: 0.99}, 30)).toBe(3);
    expect(lessonStars({wpm: 80, accuracy: 0.8}, 30)).toBe(0);
  });
});

describe('finger guide', () => {
  it('draws a 15-unit ISO board', () => {
    const right = Math.max(...standardKeys.map((k) => k.x + k.w));
    expect(right).toBe(15);
    expect(standardPosition('KC_BSLS')).toBe(standardPosition('KC_NUHS'));
  });

  it('finds characters and the opposite Shift on the US layouts', () => {
    expect(charKey(hostLayouts.us, 'f')).toMatchObject({key: 'KC_F', shift: false, finger: 'L2'});
    expect(keysToPress(hostLayouts.us, 'A')).toEqual(['KC_A', 'KC_RSFT']);
    expect(keysToPress(hostLayouts.us, '(')).toEqual(['KC_9', 'KC_LSFT']);
    expect(charKey(hostLayouts.us, '\\')?.key).toBe('KC_NUHS');
    // On a Mac with an ISO keyboard ` sits next to the left Shift.
    expect(charKey(hostLayouts['us-mac-iso'], '`')).toMatchObject({key: 'KC_NUBS', finger: 'L5'});
    expect(charKey(hostLayouts.us, '\n')?.key).toBe('KC_ENT');
  });
});
