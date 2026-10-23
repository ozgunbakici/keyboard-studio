import {useMemo, useState} from 'react';
import {ChevronLeft, ChevronRight, Code2, FileText, RotateCcw, Shuffle} from 'lucide-react';
import {javaLessons} from '@/typing/content/java';
import {pythonLessons, type CodeLesson} from '@/typing/content/python';
import type {TypingResult} from '@/typing/engine';
import {aggregateKeys, weakKeys} from '@/typing/stats';
import {saveTypingRecord, toRecord, updateTypingSettings, useTyping, worthKeeping, type PracticeSource} from '@/typing/store';
import {focusText, normalizeCode, normalizeProse, numbersText, randomWords, seededRng, sentencesText, symbolsText} from '@/typing/text';
import {Button, Toggle, cx} from '@/ui/components/ui';
import {ResultCard} from './ResultCard';
import {TypingRunner} from './TypingRunner';

const sources: {id: PracticeSource; label: string}[] = [
  {id: 'tr-words', label: 'Türkçe kelimeler'},
  {id: 'tr-sentences', label: 'Türkçe cümleler'},
  {id: 'en-words', label: 'İngilizce kelimeler'},
  {id: 'en-sentences', label: 'İngilizce cümleler'},
  {id: 'python', label: 'Python dersleri'},
  {id: 'java', label: 'Java'},
  {id: 'symbols', label: 'Kod sembolleri'},
  {id: 'numbers', label: 'Rakamlar'},
  {id: 'weak', label: 'Zayıf tuşlarım'},
  {id: 'custom', label: 'Kendi metnim'},
];

const sourceLabel = Object.fromEntries(sources.map((s) => [s.id, s.label])) as Record<PracticeSource, string>;

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

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
  const [draft, setDraft] = useState(settings.customText);
  const [editing, setEditing] = useState(!settings.customText);

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
      case 'custom':
        return settings.customText.trim() ? {text: normalizeProse(settings.customText), code: false} : null;
    }
  }, [source, seed, settings.turkishChars, settings.customText, courseLesson, weak]);

  const choose = (id: PracticeSource) => {
    void updateTypingSettings({practiceSource: id});
    setSeed(newSeed());
    setResult(null);
  };

  const moveCourse = (index: number) => {
    const key = source === 'java' ? 'java' : 'python';
    void updateTypingSettings({course: {...settings.course, [key]: index}});
    setResult(null);
  };

  const finish = (value: TypingResult) => {
    setResult(value);
    const label = courseLesson ? `${sourceLabel[source]}: ${courseLesson.title}` : sourceLabel[source];
    if (worthKeeping(value)) void saveTypingRecord(toRecord(value, 'practice', courseLesson ? courseLesson.id : source, label));
  };

  const again = () => {
    setResult(null);
    setSeed(newSeed());
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Metin türü">
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              onClick={() => choose(s.id)}
              className={cx(
                'rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                source === s.id ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:text-fg',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          {source.startsWith('tr') && (
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
          {source === 'custom' && !editing && (
            <Button size="sm" variant="ghost" icon={<FileText size={14} />} onClick={() => setEditing(true)}>
              Metni değiştir
            </Button>
          )}
          {!course && source !== 'custom' && (
            <Button size="sm" variant="ghost" icon={<Shuffle size={14} />} onClick={again}>
              Yeni metin
            </Button>
          )}
        </div>

        {course && <CourseHeader lessons={course} index={Math.min(courseIndex, course.length - 1)} onMove={moveCourse} />}

        {source === 'weak' && (
          <p className="text-sm text-muted">
            {weak.length
              ? `Çalışılan karakterler: ${weak.map((k) => (k.char === ' ' ? 'boşluk' : k.char)).join('  ')} — en çok hata yaptığın ve en yavaş kaldığın tuşlar.`
              : 'Henüz yeterli veri yok. Birkaç ders, pratik ya da test yaptıktan sonra burada en çok zorlandığın tuşlar çalışılır.'}
          </p>
        )}

        {source === 'custom' && editing ? (
          <div className="flex flex-col gap-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={8}
              placeholder="Çalışmak istediğin metni buraya yapıştır: bir makale, e-posta ya da kod…"
              className="w-full resize-y rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed outline-none focus:border-accent"
            />
            <div>
              <Button
                variant="primary"
                disabled={!draft.trim()}
                onClick={async () => {
                  await updateTypingSettings({customText: draft});
                  setEditing(false);
                  again();
                }}
              >
                Bu metinle başla
              </Button>
            </div>
          </div>
        ) : result ? (
          <ResultCard
            result={result}
            title={courseLesson ? `${sourceLabel[source]} · ${courseLesson.title}` : sourceLabel[source]}
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
            key={`${source}-${seed}-${courseLesson?.id ?? ''}`}
            text={run.text}
            code={run.code}
            options={{mode: settings.practiceMode, autoIndent: run.code}}
            showKeyboard={settings.showKeyboard}
            onFinish={finish}
            onRestart={course || source === 'custom' ? undefined : again}
          />
        ) : null}
      </div>
    </div>
  );
};
