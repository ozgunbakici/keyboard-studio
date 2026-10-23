import {useMemo, useState} from 'react';
import {RotateCcw} from 'lucide-react';
import type {TypingResult} from '@/typing/engine';
import {saveTypingRecord, toRecord, updateTypingSettings, useTyping, worthKeeping} from '@/typing/store';
import {seededRng, testText} from '@/typing/text';
import {Button, Toggle, cx} from '@/ui/components/ui';
import {ResultCard} from './ResultCard';
import {TypingRunner} from './TypingRunner';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const Segmented = <T extends string | number>({value, options, onChange, label}: {value: T; options: {value: T; label: string}[]; onChange: (v: T) => void; label: string}) => (
  <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label={label}>
    {options.map((o) => (
      <button
        key={String(o.value)}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        onClick={() => onChange(o.value)}
        className={cx('rounded-md px-2.5 py-1 text-[13px] font-medium', value === o.value ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg')}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const TestView = () => {
  const settings = useTyping((s) => s.settings);
  const records = useTyping((s) => s.records);
  const [seed, setSeed] = useState(newSeed);
  const [result, setResult] = useState<{value: TypingResult; best: number | null} | null>(null);
  const {testSeconds: seconds, testLanguage: lang, testPunctuation: punctuation, testNumbers: numbers, turkishChars} = settings;
  const source = `test-${lang}-${seconds}${punctuation ? '-p' : ''}${numbers ? '-n' : ''}`;

  const text = useMemo(
    () => testText(lang, seededRng(seed), {punctuation, numbers, turkishChars, count: Math.max(80, Math.round(seconds * 3.5))}),
    [lang, seed, punctuation, numbers, turkishChars, seconds],
  );

  const restart = () => {
    setResult(null);
    setSeed(newSeed());
  };

  const change = (patch: Parameters<typeof updateTypingSettings>[0]) => {
    void updateTypingSettings(patch);
    restart();
  };

  const finish = (value: TypingResult) => {
    const previous = records.filter((r) => r.kind === 'test' && r.source === source).map((r) => r.wpm);
    setResult({value, best: previous.length ? Math.max(...previous) : null});
    const label = `Test · ${lang === 'tr' ? 'Türkçe' : 'İngilizce'} · ${seconds} sn${punctuation ? ' · noktalama' : ''}${numbers ? ' · rakam' : ''}`;
    if (worthKeeping(value)) void saveTypingRecord(toRecord(value, 'test', source, label));
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Süre"
            value={seconds}
            onChange={(testSeconds) => change({testSeconds})}
            options={[15, 30, 60, 120].map((s) => ({value: s, label: `${s} sn`}))}
          />
          <Segmented
            label="Dil"
            value={lang}
            onChange={(testLanguage) => change({testLanguage})}
            options={[
              {value: 'tr', label: 'Türkçe'},
              {value: 'en', label: 'İngilizce'},
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <Toggle checked={punctuation} onChange={(testPunctuation) => change({testPunctuation})} label="Noktalama" />
            Noktalama
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <Toggle checked={numbers} onChange={(testNumbers) => change({testNumbers})} label="Rakamlar" />
            Rakamlar
          </label>
          {lang === 'tr' && (
            <label className="flex items-center gap-2 text-sm text-muted" title="Kapalıyken ç ğ ı ö ş ü yerine c g i o s u yazılır">
              <Toggle checked={turkishChars} onChange={(turkishChars) => change({turkishChars})} label="Türkçe karakterler" />
              Türkçe karakterler
            </label>
          )}
        </div>

        {result ? (
          <ResultCard
            result={result.value}
            title={`${seconds} saniyelik test · ${lang === 'tr' ? 'Türkçe' : 'İngilizce'}`}
            best={result.best}
            message={result.best !== null ? `Bu ayarlarla önceki en iyin: ${Math.round(result.best)} WPM.` : 'Bu ayarlarla ilk testin.'}
            actions={
              <Button variant="primary" icon={<RotateCcw size={15} />} onClick={restart}>
                Yeni test
              </Button>
            }
          />
        ) : (
          <TypingRunner key={`${source}-${seed}`} text={text} options={{mode: 'free'}} lines={3} timeLimit={seconds} onFinish={finish} onRestart={restart} />
        )}
        {!result && <p className="text-center text-xs text-faint">Süre ilk tuşa bastığında başlar. Sık kullanılan kelimelerle ölçülür; sonuçlar istatistiklere eklenir.</p>}
      </div>
    </div>
  );
};
