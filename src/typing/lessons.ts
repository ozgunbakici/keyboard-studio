import {lessonCorpus, pick, shuffle, symbolTokens, type Rng} from './text';

/**
 * Touch-typing course for the US layout: a few new keys per lesson, practised
 * with real words where the learned keys allow and drills where they don't.
 */

export type LessonKind = 'letters' | 'review' | 'shift' | 'punctuation' | 'numbers' | 'symbols';

export type Lesson = {
  id: string;
  group: string;
  title: string;
  /** Characters this lesson adds. */
  chars: string;
  kind: LessonKind;
  hint: string;
};

export const lessons: Lesson[] = [
  {id: 'home-fj', group: 'Ana sıra', title: 'F ve J', chars: 'fj', kind: 'letters', hint: 'İşaret parmaklarını F ve J’deki çıkıntılara koy; diğer parmaklar yanlarına dizilir (sol el A S D F, sağ el J K L ;). Başparmaklar boşlukta.'},
  {id: 'home-dk', group: 'Ana sıra', title: 'D ve K', chars: 'dk', kind: 'letters', hint: 'Orta parmaklar: sol D, sağ K. Tuşa bastıktan sonra parmak yerine döner.'},
  {id: 'home-sl', group: 'Ana sıra', title: 'S ve L', chars: 'sl', kind: 'letters', hint: 'Yüzük parmakları: sol S, sağ L.'},
  {id: 'home-a', group: 'Ana sıra', title: 'A ve ;', chars: 'a;', kind: 'letters', hint: 'Serçe parmaklar: sol A, sağ noktalı virgül.'},
  {id: 'home-gh', group: 'Ana sıra', title: 'G ve H', chars: 'gh', kind: 'letters', hint: 'G için sol işaret parmağı bir tuş sağa, H için sağ işaret parmağı bir tuş sola uzanır.'},
  {id: 'top-ei', group: 'Üst sıra', title: 'E ve I', chars: 'ei', kind: 'letters', hint: 'Orta parmaklar bir sıra yukarı: sol E, sağ I. El yerinde kalır, sadece parmak uzanır.'},
  {id: 'top-ru', group: 'Üst sıra', title: 'R ve U', chars: 'ru', kind: 'letters', hint: 'İşaret parmakları yukarı: sol R, sağ U.'},
  {id: 'top-ty', group: 'Üst sıra', title: 'T ve Y', chars: 'ty', kind: 'letters', hint: 'T sol işaret, Y sağ işaret parmağıyla; ikisi de yukarı ve içe uzanır.'},
  {id: 'top-wo', group: 'Üst sıra', title: 'W ve O', chars: 'wo', kind: 'letters', hint: 'Yüzük parmakları yukarı: sol W, sağ O.'},
  {id: 'top-qp', group: 'Üst sıra', title: 'Q ve P', chars: 'qp', kind: 'letters', hint: 'Serçe parmaklar yukarı: sol Q, sağ P.'},
  {id: 'bottom-vm', group: 'Alt sıra', title: 'V ve M', chars: 'vm', kind: 'letters', hint: 'İşaret parmakları aşağı: sol V, sağ M.'},
  {id: 'bottom-c', group: 'Alt sıra', title: 'C ve virgül', chars: 'c,', kind: 'letters', hint: 'Orta parmaklar aşağı: sol C, sağ virgül.'},
  {id: 'bottom-x', group: 'Alt sıra', title: 'X ve nokta', chars: 'x.', kind: 'letters', hint: 'Yüzük parmakları aşağı: sol X, sağ nokta.'},
  {id: 'bottom-z', group: 'Alt sıra', title: 'Z ve /', chars: 'z/', kind: 'letters', hint: 'Serçe parmaklar aşağı: sol Z, sağ eğik çizgi.'},
  {id: 'bottom-bn', group: 'Alt sıra', title: 'B ve N', chars: 'bn', kind: 'letters', hint: 'B sol işaret, N sağ işaret parmağıyla.'},
  {id: 'all-letters', group: 'Alt sıra', title: 'Tüm harfler', chars: '', kind: 'review', hint: 'Bütün harfler bir arada. Klavyeye bakma; hata yaparsan yavaşla, ritmi koru.'},
  {id: 'shift', group: 'Büyük harf ve noktalama', title: 'Shift ile büyük harf', chars: '', kind: 'shift', hint: 'Shift’e harfin olmadığı elin serçe parmağıyla bas: sol eldeki harf için sağ Shift, sağ eldeki harf için sol Shift.'},
  {id: 'punct', group: 'Büyük harf ve noktalama', title: 'Noktalama', chars: '\'"?!:-', kind: 'punctuation', hint: 'Kesme işareti ve tırnak sağ serçe parmakta; ? için Shift + /, ! için Shift + 1, : için Shift + ;.'},
  {id: 'num-left', group: 'Rakamlar', title: '1 2 3 4 5', chars: '12345', kind: 'numbers', hint: 'Rakama kendi sütununun parmağıyla uzan: 1 serçe, 2 yüzük, 3 orta, 4 ve 5 işaret parmağı.'},
  {id: 'num-right', group: 'Rakamlar', title: '6 7 8 9 0', chars: '67890', kind: 'numbers', hint: '6 ve 7 sağ işaret, 8 orta, 9 yüzük, 0 serçe parmakla.'},
  {id: 'sym-brackets', group: 'Kod sembolleri', title: '( ) [ ] { }', chars: '()[]{}', kind: 'symbols', hint: 'Parantezler Shift + 9 ve 0; köşeli ve süslü parantezler sağ serçe parmağın uzandığı P’nin sağındaki tuşlarda.'},
  {id: 'sym-math', group: 'Kod sembolleri', title: '= + - * / %', chars: '=+-*/%', kind: 'symbols', hint: '= ve - sağ serçe parmakta; * için Shift + 8, % için Shift + 5.'},
  {id: 'sym-logic', group: 'Kod sembolleri', title: '< > ! & |', chars: '<>!&|', kind: 'symbols', hint: '< ve > Shift + virgül / nokta; & Shift + 7; | Shift + \\.'},
  {id: 'sym-misc', group: 'Kod sembolleri', title: '@ # $ _ ~ ` ^ \\', chars: '@#$_~`^\\', kind: 'symbols', hint: '@ # $ sol elin rakam sırasında, _ Shift + -. ` ve ~ tuşunun yeri ekrandaki klavyede (Mac ISO’da sol Shift’in yanında).'},
];

const letterOrder = lessons.filter((l) => l.kind === 'letters').map((l) => l.chars).join('');

/** Characters available once a lesson is reached: its own and every earlier lesson's. */
export const lessonCharset = (index: number) => {
  const set = new Set<string>([' ']);
  for (const lesson of lessons.slice(0, index + 1)) {
    for (const ch of lesson.kind === 'review' ? letterOrder : lesson.chars) set.add(ch);
  }
  return set;
};

const isLetter = (ch: string) => /[a-z]/.test(ch);

/** Drill tokens for new keys: "ff jj fj jf fjf". */
const drills = (fresh: string[], rng: Rng) => {
  const out: string[] = [];
  for (const a of fresh) out.push(a + a, a + a + a);
  if (fresh.length > 1) {
    const [a, b] = fresh;
    out.push(a + b, b + a, a + b + a, b + a + b, a + a + b, b + b + a);
  }
  return shuffle(out, rng);
};

/** Pronounceable-ish nonsense from the allowed letters, with at least one new letter. */
const pseudoWord = (letters: string[], fresh: string[], rng: Rng) => {
  const length = 2 + Math.floor(rng() * 4);
  const chars = Array.from({length}, () => pick(letters, rng));
  chars[Math.floor(rng() * length)] = pick(fresh, rng);
  return chars.join('');
};

const punctuate = (word: string, fresh: string[], rng: Rng) => {
  const marks = fresh.filter((ch) => !isLetter(ch));
  if (!marks.length || rng() > 0.35) return word;
  const mark = pick(marks, rng);
  return mark === '/' ? `${word}/${word.slice(0, 2)}` : word + mark;
};

const TARGET_LENGTH = 190;

const fill = (make: () => string, startWith: string[] = []) => {
  const tokens = [...startWith];
  while (tokens.join(' ').length < TARGET_LENGTH) tokens.push(make());
  return tokens.join(' ');
};

/** The practice text for a lesson; a new one each time it is started. */
export const lessonText = (index: number, rng: Rng): string => {
  const lesson = lessons[index];
  const allowed = lessonCharset(index);
  const letters = [...allowed].filter(isLetter);
  const corpus = lessonCorpus().filter((w) => [...w].every((ch) => allowed.has(ch)));

  switch (lesson.kind) {
    case 'letters': {
      const fresh = [...lesson.chars];
      const freshLetters = fresh.filter(isLetter);
      const withFresh = corpus.filter((w) => freshLetters.some((ch) => w.includes(ch)));
      const pool = withFresh.length >= 8 ? withFresh : [...withFresh, ...corpus];
      const make = () =>
        punctuate(
          pool.length >= 8 && rng() < 0.75 ? pick(pool, rng) : pseudoWord(letters, freshLetters.length ? freshLetters : letters, rng),
          fresh,
          rng,
        );
      return fill(make, freshLetters.length ? drills(freshLetters, rng).slice(0, 8) : []);
    }
    case 'review':
      return fill(() => pick(corpus, rng));
    case 'shift':
      return fill(() => {
        const word = pick(corpus, rng);
        return rng() < 0.5 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
      });
    case 'punctuation': {
      const forms = [
        (w: string) => `'${w}'`,
        (w: string) => `"${w}"`,
        (w: string) => `${w}?`,
        (w: string) => `${w}!`,
        (w: string) => `${w}:`,
        (w: string) => `${w}-${pick(corpus, rng)}`,
        (w: string) => `${w}'s`,
        (w: string) => w,
      ];
      return fill(() => pick(forms, rng)(pick(corpus, rng)));
    }
    case 'numbers': {
      const digits = [...allowed].filter((ch) => /[0-9]/.test(ch));
      const number = () => Array.from({length: 1 + Math.floor(rng() * 4)}, () => pick(digits, rng)).join('');
      return fill(() => (rng() < 0.6 ? number() : pick(corpus, rng)));
    }
    case 'symbols': {
      const fresh = [...lesson.chars];
      const okToken = (t: string) => [...t].every((ch) => ch === ' ' || allowed.has(ch) || /[a-z0-9]/i.test(ch));
      const tokens = symbolTokens.filter((t) => okToken(t) && fresh.some((ch) => t.includes(ch)));
      const pairs = fresh.map((ch) => `${pick(letters, rng)}${ch}${pick(letters, rng)}`);
      return fill(() => (tokens.length && rng() < 0.7 ? pick(tokens, rng) : pick(pairs, rng)));
    }
  }
};

/** 0–3 stars: 1 for finishing accurately, 2 for reaching the goal speed, 3 for clearly beating it. */
export const lessonStars = ({wpm, accuracy}: {wpm: number; accuracy: number}, goalWpm: number) =>
  accuracy >= 0.98 && wpm >= goalWpm + 10 ? 3 : accuracy >= 0.95 && wpm >= goalWpm ? 2 : accuracy >= 0.9 ? 1 : 0;
