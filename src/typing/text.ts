import {englishSentences, turkishSentences} from './content/sentences';
import {englishWords, turkishWords} from './content/words';

export type Rng = () => number;
export type Language = 'tr' | 'en';

/** Small seeded generator (mulberry32) so a text can be reproduced. */
export const seededRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

export const shuffle = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const trFold: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
  Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U', Â: 'A', Î: 'I', Û: 'U',
};

/** Turkish letters as their plain Latin look-alikes, for typing on a US layout. */
export const foldTurkish = (text: string) => text.replace(/[çğıöşüâîûÇĞİÖŞÜÂÎÛ]/g, (c) => trFold[c] ?? c);

/** Code as an editor holds it: spaces instead of tabs, no trailing spaces, blank edges or shared indentation. */
export const normalizeCode = (code: string) => {
  const lines = code
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''));
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  const indent = Math.min(...lines.filter(Boolean).map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
};

/** Collapses whitespace in free text and makes typographic punctuation typeable on a US layout. */
export const normalizeProse = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[’‘]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

const unique = (list: string[]) => [...new Set(list)];

export const wordList = (lang: Language, turkishChars = false) =>
  unique(lang === 'en' ? englishWords : turkishChars ? turkishWords : turkishWords.map(foldTurkish));

/** Every word of both languages in plain ASCII, for lessons that build words from learned keys. */
export const lessonCorpus = () => unique([...englishWords, ...turkishWords.map(foldTurkish)]).filter((w) => /^[a-z]+$/.test(w));

export const randomWords = (lang: Language, count: number, rng: Rng, {top = 200, turkishChars = false} = {}) => {
  const list = wordList(lang, turkishChars).slice(0, top);
  const out: string[] = [];
  while (out.length < count) {
    const word = pick(list, rng);
    if (word !== out[out.length - 1]) out.push(word);
  }
  return out;
};

export const sentencesText = (lang: Language, count: number, rng: Rng, turkishChars = false) => {
  const chosen = shuffle(lang === 'en' ? englishSentences : turkishSentences, rng).slice(0, count).join(' ');
  return lang === 'tr' && !turkishChars ? foldTurkish(chosen) : chosen;
};

const numberToken = (rng: Rng) => {
  const n = (min: number, max: number) => Math.floor(min + rng() * (max - min + 1));
  const two = (v: number) => String(v).padStart(2, '0');
  const kinds = [
    () => String(n(1990, 2030)),
    () => `${two(n(0, 23))}:${two(n(0, 59))}`,
    () => `${n(1, 999)}.${two(n(0, 99))}`,
    () => String(n(0, 99)),
    () => String(n(100, 9999)),
    () => `${two(n(1, 28))}.${two(n(1, 12))}.${n(1990, 2030)}`,
    () => `${n(1, 9)},${String(n(0, 999)).padStart(3, '0')}`,
    () => `-${n(1, 50)}`,
  ];
  return pick(kinds, rng)();
};

export const numbersText = (count: number, rng: Rng) => Array.from({length: count}, () => numberToken(rng)).join(' ');

/** Short pieces of everyday code punctuation. */
export const symbolTokens = [
  '()', '[]', '{}', '<>', 'f(x)', 'a[i]', 'm[k]', '{a: 1}', '(a, b)', '[1, 2]', 'x = y', 'x == y', 'x != y', 'a <= b',
  'a >= b', 'i += 1', 'n -= 2', 'k *= 3', 'a && b', 'a || b', '!ok', 'x -> y', 'a => b', 'obj.key', 'Map::new',
  '@Override', '#include', '$HOME', '50%', '2^8', '~/code', '`ls`', "'a'", '"str"', 'a\\b', 'x | y', 'a & b', 'i++', '--j',
  'a * b', 'a / b', 'a % b', 'key: value', 'end;', 'arr[0]', 'list[-1]', 'if (x) {', '} else {', 'f(g(x))', '<T>',
  'List<String>', 'a ? b : c', 'x ?? y', 'user@mail.com', '#tag', 'a_b', '__init__', '~x', 'a ^ b', '"%d"', "{'k': v}",
];

export const symbolsText = (count: number, rng: Rng, allowed?: (ch: string) => boolean) => {
  const pool = allowed ? symbolTokens.filter((t) => [...t].every((ch) => ch === ' ' || allowed(ch))) : symbolTokens;
  return Array.from({length: count}, () => pick(pool.length ? pool : symbolTokens, rng)).join(' ');
};

/** Timed-test words: plain, or with sentence punctuation and numbers mixed in. */
export const testText = (
  lang: Language,
  rng: Rng,
  {punctuation = false, numbers = false, turkishChars = false, count = 220}: {punctuation?: boolean; numbers?: boolean; turkishChars?: boolean; count?: number} = {},
) => {
  const words = randomWords(lang, count, rng, {turkishChars});
  const out: string[] = [];
  let sentenceStart = true;
  for (const raw of words) {
    let word = numbers && rng() < 0.1 ? numberToken(rng) : raw;
    if (punctuation) {
      if (sentenceStart) word = word.charAt(0).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US') + word.slice(1);
      sentenceStart = false;
      const roll = rng();
      if (roll < 0.08) {
        word += pick(['.', '.', '.', '?', '!'], rng);
        sentenceStart = true;
      } else if (roll < 0.16) {
        word += ',';
      }
    }
    out.push(word);
  }
  return out.join(' ');
};

/** Words that contain the given characters often, for practising weak keys. */
export const focusText = (chars: string[], rng: Rng, count = 36) => {
  const wanted = chars.map((c) => c.toLowerCase());
  const letters = wanted.filter((c) => /[a-z]/.test(c));
  const others = wanted.filter((c) => !/[a-z ]/.test(c));
  const corpus = lessonCorpus();
  const scored = letters.length
    ? corpus
        .map((word) => ({word, score: [...word].filter((ch) => letters.includes(ch)).length}))
        .filter((w) => w.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 120)
    : [];
  const symbolPool = others.length ? symbolTokens.filter((t) => others.some((ch) => t.includes(ch))) : [];
  const out: string[] = [];
  while (out.length < count) {
    if (symbolPool.length && (!scored.length || rng() < 0.35)) out.push(pick(symbolPool, rng));
    else if (scored.length) out.push(pick(scored, rng).word);
    else out.push(numberToken(rng));
  }
  return out.join(' ');
};
