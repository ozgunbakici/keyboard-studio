import {useMemo, useState} from 'react';
import {BookOpen, ChevronLeft, ChevronRight, Code2, FileText, Pencil, Plus, RotateCcw, Shuffle, Trash2} from 'lucide-react';
import {bookExcerpts, type BookExcerpt} from '@/typing/content/books';
import {javaLessons} from '@/typing/content/java';
import {pythonLessons, type CodeLesson} from '@/typing/content/python';
import type {TypingResult} from '@/typing/engine';
import {aggregateKeys, weakKeys} from '@/typing/stats';
import {saveTypingRecord, toRecord, updateTypingSettings, useTyping, worthKeeping, type PracticeSource, type SavedText} from '@/typing/store';
import {
  focusText,
  foldTurkish,
  normalizeCode,
  normalizeProse,
  numbersText,
  randomWords,
  seededRng,
  sentencesText,
  splitPassages,
  symbolsText,
} from '@/typing/text';
import {confirm} from '@/ui/components/Dialog';
import {Button, IconButton, Select, Toggle, cx} from '@/ui/components/ui';
import {ResultCard} from './ResultCard';
import {TypingRunner} from './TypingRunner';

const sources: {id: PracticeSource; label: string}[] = [
  {id: 'tr-words', label: 'Türkçe kelimeler'},
  {id: 'tr-sentences', label: 'Türkçe cümleler'},
  {id: 'tr-books', label: 'Türkçe kitaplardan'},
  {id: 'en-words', label: 'İngilizce kelimeler'},
  {id: 'en-sentences', label: 'İngilizce cümleler'},
  {id: 'en-books', label: 'İngilizce kitaplardan'},
  {id: 'python', label: 'Python dersleri'},
  {id: 'java', label: 'Java'},
  {id: 'symbols', label: 'Kod sembolleri'},
  {id: 'numbers', label: 'Rakamlar'},
  {id: 'weak', label: 'Zayıf tuşlarım'},
  {id: 'custom', label: 'Kendi metinlerim'},
];

const sourceLabel = Object.fromEntries(sources.map((s) => [s.id, s.label])) as Record<PracticeSource, string>;

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** A random excerpt of the language, different from the current one when possible. */
const otherBook = (lang: 'tr' | 'en', current?: string) => {
  const pool = bookExcerpts.filter((b) => b.lang === lang && b.id !== current);
  return pool[Math.floor(Math.random() * pool.length)]?.id ?? bookExcerpts.find((b) => b.lang === lang)!.id;
};

const BookHeader = ({excerpt, onPick}: {excerpt: BookExcerpt; onPick: (id: string) => void}) => (
  <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
    <div className="flex flex-wrap items-center gap-2">
      <BookOpen size={16} className="shrink-0 text-accent" />
      <Select
        value={excerpt.id}
        label="Alıntı"
        className="min-w-0 flex-1 sm:max-w-md"
        onChange={onPick}
        options={bookExcerpts.filter((b) => b.lang === excerpt.lang).map((b) => ({value: b.id, label: `${b.author} — ${b.work}`}))}
      />
      <Button size="sm" variant="ghost" icon={<Shuffle size={14} />} onClick={() => onPick(otherBook(excerpt.lang, excerpt.id))}>
        Başka alıntı
      </Button>
    </div>
    <p className="text-sm text-muted">
      {excerpt.author}, <span className="italic">{excerpt.work}</span>
      {excerpt.year === 'anonim' ? ' — halk fıkrası, bu uygulama için yeniden anlatıldı.' : ` (${excerpt.year}) — telif süresi dolmuş, kamu malı eser.`}
    </p>
  </div>
);

const newTextId = () => `metin-${Date.now().toString(36)}`;

/** Add or edit a pasted text: a title and the text itself. */
const TextForm = ({initial, onSave, onCancel}: {initial?: SavedText; onSave: (title: string, text: string) => void; onCancel?: () => void}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [text, setText] = useState(initial?.text ?? '');
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">
        Elindeki bir kitaptan bölüm, bir makale ya da e-posta yapıştır. Uzun metinler cümle sonlarından bölümlere ayrılır; kaldığın yer saklanır.
        Metin yalnızca bu tarayıcıda kalır.
      </p>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Başlık (ör. Kitabın adı, 3. bölüm)"
        aria-label="Metin başlığı"
        className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent"
      />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={9}
        aria-label="Metin"
        placeholder="Metni buraya yapıştır…"
        className="w-full resize-y rounded-xl border border-border bg-surface-2 p-3 text-sm leading-relaxed outline-none focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!text.trim()} onClick={() => onSave(title.trim() || 'Adsız metin', text)}>
          {initial ? 'Kaydet' : 'Ekle ve başla'}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Vazgeç
          </Button>
        )}
        {text.trim() && <span className="text-xs text-faint">{splitPassages(text).length} bölüm</span>}
      </div>
    </div>
  );
};

const CourseHeader = ({lessons, index, onMove}: {lessons: CodeLesson[]; index: number; onMove: (index: number) => void}) => {
  const lesson = lessons[index];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Code2 size={16} className="text-accent" />
        <span className="text-xs text-faint">
          {index + 1}/{lessons.length}
        </span>
        <h3 className="text-sm font-semibold">{lesson.title}</h3>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" icon={<ChevronLeft size={14} />} disabled={index === 0} onClick={() => onMove(index - 1)}>
            Önceki
          </Button>
          <Button size="sm" variant="ghost" disabled={index === lessons.length - 1} onClick={() => onMove(index + 1)}>
            Sonraki <ChevronRight size={14} />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">{lesson.note}</p>
    </div>
  );
};

export const PracticeView = () => {
  const settings = useTyping((s) => s.settings);
  const records = useTyping((s) => s.records);
  const source = settings.practiceSource;
  const [seed, setSeed] = useState(newSeed);
  const [result, setResult] = useState<TypingResult | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);

  const bookLang = source === 'tr-books' ? 'tr' : source === 'en-books' ? 'en' : null;
  const bookPool = bookLang ? bookExcerpts.filter((b) => b.lang === bookLang) : [];
  // Until one is picked, the run's seed chooses the excerpt so it stays put between renders.
  const excerpt = bookLang ? (bookPool.find((b) => b.id === bookId) ?? bookPool[seed % bookPool.length]) : null;

  const texts = settings.customTexts;
  const active = texts.find((t) => t.id === settings.activeText) ?? texts[0];
  const passages = useMemo(() => (active ? splitPassages(active.text) : []), [active]);
  const passageIndex = active ? Math.min(active.position, Math.max(0, passages.length - 1)) : 0;
  const fold = (text: string) => (settings.turkishChars ? text : foldTurkish(text));

  const weak = useMemo(() => weakKeys(aggregateKeys(records)), [records]);
  const course = source === 'python' ? pythonLessons : source === 'java' ? javaLessons : null;
  const courseIndex = source === 'python' ? settings.course.python : source === 'java' ? settings.course.java : 0;
  const courseLesson = course ? course[Math.min(courseIndex, course.length - 1)] : null;

  const run = useMemo(() => {
    const rng = seededRng(seed);
    const tr = settings.turkishChars;
    switch (source) {
      case 'tr-words':
        return {text: randomWords('tr', 40, rng, {top: 260, turkishChars: tr}).join(' '), code: false};
      case 'en-words':
        return {text: randomWords('en', 40, rng, {top: 260}).join(' '), code: false};
      case 'tr-sentences':
        return {text: sentencesText('tr', 4, rng, tr), code: false};
      case 'en-sentences':
        return {text: sentencesText('en', 4, rng), code: false};
      case 'python':
      case 'java':
        return {text: normalizeCode(courseLesson!.code), code: true};
      case 'symbols':
        return {text: symbolsText(28, rng), code: false};
      case 'numbers':
        return {text: numbersText(30, rng), code: false};
      case 'weak':
        return weak.length ? {text: focusText(weak.map((k) => k.char), rng), code: false} : null;
      case 'tr-books':
      case 'en-books':
        return {text: fold(normalizeProse(excerpt!.text)), code: false};
      case 'custom':
        return passages.length ? {text: fold(passages[passageIndex]), code: false} : null;
    }
    // fold depends only on settings.turkishChars, listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, seed, settings.turkishChars, courseLesson, weak, excerpt, passages, passageIndex]);

  const choose = (id: PracticeSource) => {
    void updateTypingSettings({practiceSource: id});
    setSeed(newSeed());
    setResult(null);
    setEditing(null);
    if (id === 'tr-books' || id === 'en-books') setBookId(otherBook(id === 'tr-books' ? 'tr' : 'en', bookId ?? undefined));
  };

  const saveTexts = (customTexts: SavedText[], activeText: string | null) => updateTypingSettings({customTexts, activeText});

  const movePassage = (position: number) => {
    if (!active) return;
    void saveTexts(
      texts.map((t) => (t.id === active.id ? {...t, position} : t)),
      active.id,
    );
    setResult(null);
  };

  const moveCourse = (index: number) => {
    const key = source === 'java' ? 'java' : 'python';
    void updateTypingSettings({course: {...settings.course, [key]: index}});
    setResult(null);
  };

  const title = courseLesson
    ? `${sourceLabel[source]}: ${courseLesson.title}`
    : excerpt
      ? `${excerpt.author}, ${excerpt.work}`
      : source === 'custom' && active
        ? `${active.title} · bölüm ${passageIndex + 1}/${passages.length}`
        : sourceLabel[source];

  const finish = (value: TypingResult) => {
    setResult(value);
    const id = courseLesson?.id ?? excerpt?.id ?? source;
    if (worthKeeping(value)) void saveTypingRecord(toRecord(value, 'practice', id, title));
  };

  const again = () => {
    setResult(null);
    setSeed(newSeed());
    if (bookLang) setBookId(otherBook(bookLang, excerpt?.id));
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="radiogroup" aria-label="Metin türü">
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              onClick={() => choose(s.id)}
              className={cx(
                'shrink-0 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                source === s.id ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:text-fg',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          {(source.startsWith('tr') || source === 'custom') && (
            <label className="flex items-center gap-2" title="Kapalıyken ç ğ ı ö ş ü yerine c g i o s u yazılır (US düzeni için)">
              <Toggle checked={settings.turkishChars} onChange={(turkishChars) => void updateTypingSettings({turkishChars})} label="Türkçe karakterler" />
              Türkçe karakterler (ç ğ ı ö ş ü)
            </label>
          )}
          <label className="flex items-center gap-2" title="Açıkken yanlış tuşta imleç bekler; kapalıyken ilerler ve Backspace ile düzeltirsin">
            <Toggle
              checked={settings.practiceMode === 'strict'}
              onChange={(strict) => void updateTypingSettings({practiceMode: strict ? 'strict' : 'free'})}
              label="Hatada dur"
            />
            Hatada dur
          </label>
          <label className="flex items-center gap-2">
            <Toggle checked={settings.showKeyboard} onChange={(showKeyboard) => void updateTypingSettings({showKeyboard})} label="Klavyeyi göster" />
            Klavye
          </label>
          {!course && !bookLang && source !== 'custom' && (
            <Button size="sm" variant="ghost" icon={<Shuffle size={14} />} onClick={again}>
              Yeni metin
            </Button>
          )}
        </div>

        {course && <CourseHeader lessons={course} index={Math.min(courseIndex, course.length - 1)} onMove={moveCourse} />}

        {excerpt && (
          <BookHeader
            excerpt={excerpt}
            onPick={(id) => {
              setBookId(id);
              setResult(null);
            }}
          />
        )}

        {source === 'custom' && active && !editing && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <FileText size={16} className="shrink-0 text-accent" />
              <Select
                value={active.id}
                label="Metin"
                className="min-w-0 flex-1 sm:max-w-sm"
                onChange={(id) => {
                  void saveTexts(texts, id);
                  setResult(null);
                }}
                options={texts.map((t) => ({value: t.id, label: t.title}))}
              />
              <IconButton label="Yeni metin ekle" onClick={() => setEditing('new')}>
                <Plus size={16} />
              </IconButton>
              <IconButton label="Metni düzenle" onClick={() => setEditing('edit')}>
                <Pencil size={15} />
              </IconButton>
              <IconButton
                label="Metni sil"
                onClick={async () => {
                  if (!(await confirm({title: `“${active.title}” silinsin mi?`, body: 'Metin bu tarayıcıdan silinir.', confirmLabel: 'Sil', danger: true}))) return;
                  const rest = texts.filter((t) => t.id !== active.id);
                  await saveTexts(rest, rest[0]?.id ?? null);
                  setResult(null);
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>
                Bölüm {passageIndex + 1} / {passages.length}
              </span>
              <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent" style={{width: `${((passageIndex + 1) / passages.length) * 100}%`}} />
              </div>
              <Button size="sm" variant="ghost" icon={<ChevronLeft size={14} />} disabled={passageIndex === 0} onClick={() => movePassage(passageIndex - 1)}>
                Önceki
              </Button>
              <Button size="sm" variant="ghost" disabled={passageIndex >= passages.length - 1} onClick={() => movePassage(passageIndex + 1)}>
                Sonraki <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {source === 'weak' && (
          <p className="text-sm text-muted">
            {weak.length
              ? `Çalışılan karakterler: ${weak.map((k) => (k.char === ' ' ? 'boşluk' : k.char)).join('  ')} — en çok hata yaptığın ve en yavaş kaldığın tuşlar.`
              : 'Henüz yeterli veri yok. Birkaç ders, pratik ya da test yaptıktan sonra burada en çok zorlandığın tuşlar çalışılır.'}
          </p>
        )}

        {source === 'custom' && (editing || !active) ? (
          <TextForm
            key={editing === 'edit' ? active?.id : 'new'}
            initial={editing === 'edit' ? active : undefined}
            onCancel={active ? () => setEditing(null) : undefined}
            onSave={async (title, text) => {
              if (editing === 'edit' && active) {
                const changed = active.text !== text;
                await saveTexts(
                  texts.map((t) => (t.id === active.id ? {...t, title, text, position: changed ? 0 : t.position} : t)),
                  active.id,
                );
              } else {
                const id = newTextId();
                await saveTexts([...texts, {id, title, text, position: 0}], id);
              }
              setEditing(null);
              setResult(null);
            }}
          />
        ) : result ? (
          <ResultCard
            result={result}
            title={title}
            actions={
              <>
                <Button icon={<RotateCcw size={15} />} onClick={() => setResult(null)}>
                  Aynı metni tekrar
                </Button>
                {course ? (
                  courseIndex < course.length - 1 && (
                    <Button variant="primary" icon={<ChevronRight size={15} />} onClick={() => moveCourse(courseIndex + 1)}>
                      Sonraki ders
                    </Button>
                  )
                ) : source === 'custom' ? (
                  passageIndex < passages.length - 1 ? (
                    <Button variant="primary" icon={<ChevronRight size={15} />} onClick={() => movePassage(passageIndex + 1)}>
                      Sonraki bölüm
                    </Button>
                  ) : (
                    <Button variant="primary" icon={<RotateCcw size={15} />} onClick={() => movePassage(0)}>
                      Metni baştan başla
                    </Button>
                  )
                ) : bookLang ? (
                  <Button variant="primary" icon={<Shuffle size={15} />} onClick={again}>
                    Başka alıntı
                  </Button>
                ) : (
                  <Button variant="primary" icon={<Shuffle size={15} />} onClick={again}>
                    Yeni metin
                  </Button>
                )}
              </>
            }
          />
        ) : run ? (
          <TypingRunner
            key={`${source}-${seed}-${courseLesson?.id ?? excerpt?.id ?? ''}-${active?.id ?? ''}-${passageIndex}`}
            text={run.text}
            code={run.code}
            options={{mode: settings.practiceMode, autoIndent: run.code}}
            showKeyboard={settings.showKeyboard}
            onFinish={finish}
            onRestart={course || bookLang || source === 'custom' ? undefined : again}
          />
        ) : null}
      </div>
    </div>
  );
};
