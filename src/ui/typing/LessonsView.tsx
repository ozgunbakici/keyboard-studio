import {useMemo, useState} from 'react';
import {ArrowRight, Lightbulb, RotateCcw} from 'lucide-react';
import type {TypingResult} from '@/typing/engine';
import {lessonStars, lessonText, lessons} from '@/typing/lessons';
import {lessonBest} from '@/typing/stats';
import {saveTypingRecord, toRecord, updateTypingSettings, useTyping, worthKeeping} from '@/typing/store';
import {seededRng} from '@/typing/text';
import {Button, Select, Toggle, cx} from '@/ui/components/ui';
import {ResultCard, Stars} from './ResultCard';
import {TypingRunner} from './TypingRunner';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const verdict = (stars: number) =>
  [
    'Doğruluk %90’ın altında kaldı. Yavaşla, klavyeye bakmadan ve her tuşu doğru parmakla yaz.',
    'Doğru yazıyorsun; hız henüz hedefin altında. Bir kez daha dene, ritmi koru.',
    'Hedefe ulaştın. İstersen sonraki derse geç ya da üç yıldız için tekrar dene.',
    'Mükemmel! Bu tuşlar artık senin. Sonraki derse geç.',
  ][stars];

export const LessonsView = () => {
  const records = useTyping((s) => s.records);
  const settings = useTyping((s) => s.settings);
  const goal = settings.goalWpm;
  const firstOpen = () => {
    const i = lessons.findIndex((l) => (lessonBest(useTyping.getState().records, l.id, goal)?.stars ?? 0) < 2);
    return i < 0 ? 0 : i;
  };
  const [index, setIndex] = useState(firstOpen);
  const [seed, setSeed] = useState(newSeed);
  const [result, setResult] = useState<{value: TypingResult; stars: number; best: number | null} | null>(null);
  const lesson = lessons[index];
  const text = useMemo(() => lessonText(index, seededRng(seed)), [index, seed]);

  const bests = useMemo(() => lessons.map((l) => lessonBest(records, l.id, goal)), [records, goal]);
  const groups = [...new Set(lessons.map((l) => l.group))];

  const open = (i: number) => {
    setIndex(i);
    setSeed(newSeed());
    setResult(null);
  };

  const finish = (value: TypingResult) => {
    const stars = lessonStars(value, goal);
    const best = bests[index]?.wpm ?? null;
    setResult({value, stars, best});
    if (worthKeeping(value)) void saveTypingRecord(toRecord(value, 'lesson', lesson.id, `Ders: ${lesson.title}`));
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)]">
      <nav className="min-h-0 overflow-y-auto border-r border-border bg-surface p-2" aria-label="Dersler">
        {groups.map((group) => (
          <div key={group} className="mb-2">
            <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">{group}</div>
            {lessons.map((l, i) =>
              l.group === group ? (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => open(i)}
                  aria-current={i === index ? 'true' : undefined}
                  className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left', i === index ? 'bg-surface-3' : 'hover:bg-surface-2')}
                >
                  <span className="w-5 shrink-0 text-right text-[11px] text-faint tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{l.title}</span>
                  <Stars count={bests[i]?.stars ?? 0} size={11} />
                </button>
              ) : null,
            )}
          </div>
        ))}
      </nav>

      <div className="min-h-0 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-faint">
                {lesson.group} · Ders {index + 1}/{lessons.length}
              </div>
              <h2 className="text-lg font-semibold">{lesson.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <label className="flex items-center gap-2">
                Hedef hız
                <Select
                  value={goal}
                  label="Hedef hız"
                  onChange={(goalWpm) => void updateTypingSettings({goalWpm})}
                  options={[15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80].map((v) => ({value: v, label: `${v} WPM`}))}
                />
              </label>
              <label className="flex items-center gap-2">
                <Toggle checked={settings.showKeyboard} onChange={(showKeyboard) => void updateTypingSettings({showKeyboard})} label="Klavyeyi göster" />
                Klavye
              </label>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-macro" />
            <span>
              {lesson.hint} Hedef: en az %95 doğruluk ve {goal} WPM.
            </span>
          </p>

          {result ? (
            <ResultCard
              result={result.value}
              title={`Ders ${index + 1}: ${lesson.title}`}
              stars={result.stars}
              best={result.best}
              message={verdict(result.stars)}
              actions={
                <>
                  <Button icon={<RotateCcw size={15} />} onClick={() => open(index)}>
                    Tekrar dene
                  </Button>
                  {index < lessons.length - 1 && (
                    <Button variant={result.stars >= 2 ? 'primary' : 'secondary'} icon={<ArrowRight size={15} />} onClick={() => open(index + 1)}>
                      Sonraki ders
                    </Button>
                  )}
                </>
              }
            />
          ) : (
            <TypingRunner
              key={`${index}-${seed}`}
              text={text}
              options={{mode: 'strict'}}
              showKeyboard={settings.showKeyboard}
              onFinish={finish}
              onRestart={() => setSeed(newSeed())}
            />
          )}
        </div>
      </div>
    </div>
  );
};
