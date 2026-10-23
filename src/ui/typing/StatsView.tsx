import {useMemo, useState} from 'react';
import {BarChart3, Dumbbell, Trash2} from 'lucide-react';
import {visibleKeys, type RenderKey} from '@/definitions/geometry';
import {hostLayouts} from '@/keycodes/host-layouts';
import {keyLabel} from '@/keycodes/labels';
import {getCodec} from '@/state/actions';
import {useStudio} from '@/state/store';
import {standardKeys} from '@/typing/fingers';
import {lessons} from '@/typing/lessons';
import {aggregateKeys, heatScale, keyHeat, lessonBest, summary, weakKeys, type KeyHeat} from '@/typing/stats';
import {clearTypingHistory, updateTypingSettings, useTyping, type TypingKind} from '@/typing/store';
import {confirm} from '@/ui/components/Dialog';
import {Button, EmptyState, cx} from '@/ui/components/ui';
import {KeyboardView} from '@/ui/keyboard/KeyboardView';
import {LineChart} from './LineChart';
import {TrainerKeyboard} from './TrainerKeyboard';

const kinds: {id: TypingKind; label: string}[] = [
  {id: 'test', label: 'Testler'},
  {id: 'practice', label: 'Pratik'},
  {id: 'lesson', label: 'Dersler'},
];

const Tile = ({label, value, delta}: {label: string; value: string; delta?: {text: string; good: boolean} | null}) => (
  <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
    <span className="text-xs text-muted">{label}</span>
    <span className="text-2xl font-semibold">{value}</span>
    {delta && <span className={cx('text-xs font-medium', delta.good ? 'text-success' : 'text-danger')}>{delta.text}</span>}
  </div>
);

const date = (at: number) => new Date(at).toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'});
const minutes = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)} sn` : ms < 3600000 ? `${Math.round(ms / 60000)} dk` : `${(ms / 3600000).toFixed(1)} sa`);
const heatText = (h?: KeyHeat) => (h ? `%${(h.rate * 100).toFixed(1)} hata, ${h.hits} basış` : 'veri yok');

/** Mistakes drawn on the connected keyboard's own layout (layer 0). */
const OwnKeyboardHeat = ({heat}: {heat: Map<string, KeyHeat>}) => {
  const selectedId = useStudio((s) => s.selectedId);
  const data = useStudio((s) => (s.selectedId ? s.data[s.selectedId] : undefined));
  const settings = useStudio((s) => s.settings);
  const codec = getCodec(selectedId);
  const keys = useMemo(() => (data ? visibleKeys(data.definition, data.layoutOptions) : []), [data]);
  if (!data || !codec) return null;
  const ctx = {codec, host: hostLayouts[settings.hostLayout], os: settings.os};
  const scale = heatScale(heat);
  const baseName = (value: number) => {
    const d = codec.decode(value);
    if (d.kind === 'basic') return d.name;
    if (d.kind === 'mods' || d.kind === 'modTap' || d.kind === 'layerTap') return codec.basicName(d.key);
    return null;
  };
  const values = new Map<string, number>();
  const titles = new Map<string, string>();
  for (const key of keys) {
    if (!key.hasMatrix) continue;
    const name = baseName(data.keymap[0]?.[key.row * data.matrix.cols + key.col] ?? 0);
    const h = name ? heat.get(name) : undefined;
    const v = scale(h);
    if (v !== undefined) values.set(`${key.row},${key.col}`, v);
    if (h) titles.set(key.id, heatText(h));
  }
  const labelFor = (key: RenderKey) => {
    if (!key.hasMatrix) return undefined;
    const label = keyLabel(data.keymap[0]?.[key.row * data.matrix.cols + key.col] ?? 0, ctx);
    const extra = titles.get(key.id);
    return extra ? {...label, title: `${label.title} — ${extra}`} : label;
  };
  return <KeyboardView keys={keys} labelFor={labelFor} heat={values} className="w-full select-none" ariaLabel={`${data.name}: hata ısı haritası`} />;
};

const HeatLegend = () => (
  <div className="flex items-center gap-2 text-xs text-muted" aria-hidden>
    <span>az hata</span>
    <span className="h-2.5 w-32 rounded-full" style={{background: 'linear-gradient(to right, rgb(208 59 59 / 0.08), rgb(208 59 59 / 0.9))'}} />
    <span>en çok hata</span>
  </div>
);

export const StatsView = ({onPractice}: {onPractice: () => void}) => {
  const records = useTyping((s) => s.records);
  const goal = useTyping((s) => s.settings.goalWpm);
  const hostId = useStudio((s) => s.settings.hostLayout);
  const hasKeyboard = useStudio((s) => !!(s.selectedId && s.data[s.selectedId]));
  const [kind, setKind] = useState<TypingKind>('test');
  const [own, setOwn] = useState(true);

  const totals = useMemo(() => aggregateKeys(records), [records]);
  const weak = useMemo(() => weakKeys(totals), [totals]);
  const heat = useMemo(() => keyHeat(totals, hostLayouts[hostId]), [totals, hostId]);
  const s = useMemo(() => summary(records), [records]);
  const stars = useMemo(() => lessons.reduce((sum, l) => sum + (lessonBest(records, l.id, goal)?.stars ?? 0), 0), [records, goal]);

  if (!records.length) {
    return (
      <EmptyState icon={<BarChart3 size={30} />} title="Henüz istatistik yok">
        Bir ders, pratik ya da test bitirdiğinde hızın, doğruluğun ve en çok zorlandığın tuşlar burada görünür.
      </EmptyState>
    );
  }

  const series = records.filter((r) => r.kind === kind).slice(-40);
  const scale = heatScale(heat);
  const standardHeat = new Map<string, number>();
  for (const key of standardKeys) {
    const v = scale(heat.get(key.code));
    if (v !== undefined) standardHeat.set(`${key.row},${key.col}`, v);
  }
  const delta =
    s.recentWpm !== null && s.earlierWpm !== null
      ? {text: `${s.recentWpm >= s.earlierWpm ? '+' : ''}${(s.recentWpm - s.earlierWpm).toFixed(1)} önceki 10 teste göre`, good: s.recentWpm >= s.earlierWpm}
      : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile label="Son 10 test ortalaması" value={s.recentWpm !== null ? `${Math.round(s.recentWpm)} WPM` : '–'} delta={delta} />
          <Tile label="En iyi test" value={s.bestTest !== null ? `${Math.round(s.bestTest)} WPM` : '–'} />
          <Tile label="Doğruluk (son 10)" value={s.recentAccuracy !== null ? `%${(s.recentAccuracy * 100).toFixed(1)}` : '–'} />
          <Tile label="Toplam antrenman" value={minutes(s.totalMs)} />
          <Tile label="Ders yıldızları" value={`${stars} / ${lessons.length * 3}`} />
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Gösterilen çalışmalar">
            {kinds.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => setKind(k.id)}
                className={cx('rounded-md px-2.5 py-1 text-[13px] font-medium', kind === k.id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg')}
              >
                {k.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-faint">son {series.length} çalışma</span>
          </div>
          {series.length >= 2 ? (
            <>
              <LineChart
                title="Hız"
                unit="WPM"
                points={series.map((r) => ({label: date(r.at), value: r.wpm, detail: r.label}))}
              />
              <LineChart
                title="Doğruluk"
                unit="%"
                minY={Math.min(80, ...series.map((r) => Math.floor(r.accuracy * 100)))}
                maxY={100}
                format={(v) => `${Math.round(v)}`}
                points={series.map((r) => ({label: date(r.at), value: r.accuracy * 100, detail: r.label}))}
              />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Grafik için bu türde en az iki çalışma gerekiyor.</p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold">Hata ısı haritası</h3>
            <HeatLegend />
            {hasKeyboard && (
              <div className="ml-auto flex rounded-lg border border-border p-0.5 text-[13px]">
                <button type="button" onClick={() => setOwn(true)} className={cx('rounded-md px-2.5 py-1', own ? 'bg-surface-3 text-fg' : 'text-muted')}>
                  Kendi klavyem
                </button>
                <button type="button" onClick={() => setOwn(false)} className={cx('rounded-md px-2.5 py-1', !own ? 'bg-surface-3 text-fg' : 'text-muted')}>
                  Standart
                </button>
              </div>
            )}
          </div>
          <div className="mx-auto w-full max-w-[900px]">
            {hasKeyboard && own ? (
              <OwnKeyboardHeat heat={heat} />
            ) : (
              <TrainerKeyboard heat={standardHeat} titleFor={(code) => heatText(heat.get(code))} />
            )}
          </div>
          <p className="text-xs text-faint">Son 60 çalışmadaki vuruşlar. Renk, tuşun hata oranını en çok hata yapılan tuşa göre gösterir; üzerine gelince ayrıntısı çıkar.</p>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold">Zayıf tuşlar</h3>
            {weak.length > 0 && (
              <Button
                size="sm"
                variant="primary"
                icon={<Dumbbell size={14} />}
                className="ml-auto"
                onClick={async () => {
                  await updateTypingSettings({practiceSource: 'weak'});
                  onPractice();
                }}
              >
                Bu tuşlarla çalış
              </Button>
            )}
          </div>
          {weak.length ? (
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] text-faint uppercase">
                <tr>
                  <th className="py-1.5 font-semibold">Karakter</th>
                  <th className="py-1.5 font-semibold">Hata oranı</th>
                  <th className="py-1.5 font-semibold">Ortalama süre</th>
                  <th className="py-1.5 font-semibold">Basış</th>
                </tr>
              </thead>
              <tbody>
                {weak.map((k) => (
                  <tr key={k.char} className="border-t border-border">
                    <td className="py-1.5">
                      <kbd className="rounded border border-border-strong bg-surface-2 px-1.5 font-mono">{k.char}</kbd>
                    </td>
                    <td className="py-1.5 tabular-nums">%{(k.errorRate * 100).toFixed(1)}</td>
                    <td className="py-1.5 tabular-nums">{k.avgMs !== null ? `${Math.round(k.avgMs)} ms` : '–'}</td>
                    <td className="py-1.5 tabular-nums text-muted">{k.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">Her tuş için en az 12 basış toplanınca burada listelenir.</p>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Son çalışmalar</h3>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={14} />}
              className="ml-auto"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Antrenman geçmişi silinsin mi?',
                  body: 'Bütün ders, pratik ve test sonuçları ile ders yıldızları silinir. Bu geri alınamaz.',
                  confirmLabel: 'Geçmişi sil',
                  danger: true,
                });
                if (ok) await clearTypingHistory();
              }}
            >
              Geçmişi sil
            </Button>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] text-faint uppercase">
              <tr>
                <th className="py-1.5 font-semibold">Tarih</th>
                <th className="py-1.5 font-semibold">Çalışma</th>
                <th className="py-1.5 font-semibold">WPM</th>
                <th className="py-1.5 font-semibold">Doğruluk</th>
              </tr>
            </thead>
            <tbody>
              {records
                .slice(-12)
                .reverse()
                .map((r) => (
                  <tr key={r.id ?? r.at} className="border-t border-border">
                    <td className="py-1.5 text-muted">{new Date(r.at).toLocaleString('tr-TR', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}</td>
                    <td className="py-1.5">{r.label}</td>
                    <td className="py-1.5 tabular-nums">{Math.round(r.wpm)}</td>
                    <td className="py-1.5 tabular-nums">%{(r.accuracy * 100).toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};
