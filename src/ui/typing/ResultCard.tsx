import type {ReactNode} from 'react';
import {Star} from 'lucide-react';
import type {TypingResult} from '@/typing/engine';
import {cx} from '@/ui/components/ui';
import {LineChart} from './LineChart';

const Tile = ({label, value, hint}: {label: string; value: string; hint?: string}) => (
  <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface px-4 py-3">
    <span className="text-xs text-muted">{label}</span>
    <span className="text-xl font-semibold">{value}</span>
    {hint && <span className="text-[11px] text-faint">{hint}</span>}
  </div>
);

export const Stars = ({count, size = 18}: {count: number; size?: number}) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${count} yıldız`}>
    {[0, 1, 2].map((i) => (
      <Star key={i} size={size} className={i < count ? 'fill-macro text-macro' : 'text-faint'} />
    ))}
  </span>
);

const charName = (ch: string) => (ch === ' ' ? 'boşluk' : ch === '\n' ? 'Enter' : ch);

const seconds = (ms: number) => (ms < 60000 ? `${(ms / 1000).toFixed(1)} sn` : `${Math.floor(ms / 60000)} dk ${Math.round((ms % 60000) / 1000)} sn`);

/** End-of-run summary: the speed as the headline, then accuracy and the trouble keys. */
export const ResultCard = ({
  result,
  title,
  stars,
  message,
  best,
  actions,
}: {
  result: TypingResult;
  title: string;
  stars?: number;
  message?: ReactNode;
  /** Previous best for the same exercise, to celebrate a new record. */
  best?: number | null;
  actions?: ReactNode;
}) => {
  const trouble = Object.entries(result.perChar)
    .filter(([, s]) => s.errors > 0)
    .sort((a, b) => b[1].errors - a[1].errors)
    .slice(0, 6);
  const record = best !== undefined && (best === null || result.wpm > best);
  const points = result.speedTrace.map((wpm, i) => ({
    label: `${i + 1}. sn`,
    value: wpm,
    marked: (result.errorTrace[i] ?? 0) > 0,
    detail: result.errorTrace[i] ? `${result.errorTrace[i]} hata` : undefined,
  }));

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6" aria-label="Sonuç">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted">{title}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-semibold tracking-tight" data-testid="result-wpm">
              {Math.round(result.wpm)}
            </span>
            <span className="text-lg text-muted">WPM</span>
            {record && <span className="ml-2 rounded-md bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">yeni rekor</span>}
          </div>
          {stars !== undefined && <Stars count={stars} size={22} />}
          {message && <p className="max-w-xl text-sm text-muted">{message}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Doğruluk" value={`%${(result.accuracy * 100).toFixed(1)}`} hint={`${result.errors} hatalı vuruş`} />
        <Tile label="Ham hız" value={`${Math.round(result.raw)} WPM`} hint="hatalar dahil" />
        <Tile label="Süre" value={seconds(result.durationMs)} />
        <Tile label="Doğru karakter" value={String(result.chars)} />
      </div>

      {points.length >= 3 && <LineChart points={points} unit="WPM" title="Hız (o saniyeye kadar ortalama)" markLabel="hata yapılan saniye" />}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">En çok takıldığın karakterler:</span>
        {trouble.length ? (
          trouble.map(([ch, s]) => (
            <span key={ch} className={cx('inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5')}>
              <kbd className="font-mono">{charName(ch)}</kbd>
              <span className="text-xs text-muted">{s.errors} hata</span>
            </span>
          ))
        ) : (
          <span className="text-success">hiç hata yok</span>
        )}
      </div>
    </section>
  );
};
