import {useMemo, useRef, useState} from 'react';
import {Table2} from 'lucide-react';
import {cx} from '@/ui/components/ui';

export type ChartPoint = {
  /** Text for the x position in the tooltip and table, e.g. "12. sn" or a date. */
  label: string;
  value: number;
  /** Highlights the point with a marker (e.g. a second with mistakes). */
  marked?: boolean;
  /** Extra tooltip line. */
  detail?: string;
};

const W = 900;
const H = 220;
const PAD = {top: 14, right: 16, bottom: 26, left: 40};

const niceStep = (span: number, ticks: number) => {
  const raw = span / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
};

/**
 * Single-series line: 2px line with a light wash, hairline grid, a crosshair
 * tooltip that snaps to the nearest point, optional markers, and a table view.
 */
export const LineChart = ({
  points,
  unit,
  title,
  markLabel,
  minY,
  maxY,
  format = (v) => String(Math.round(v)),
}: {
  points: ChartPoint[];
  unit: string;
  title: string;
  markLabel?: string;
  minY?: number;
  maxY?: number;
  format?: (value: number) => string;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const svg = useRef<SVGSVGElement>(null);

  const geometry = useMemo(() => {
    const values = points.map((p) => p.value);
    const lo = minY ?? Math.min(0, ...values);
    const top = maxY ?? Math.max(...values, lo + 1);
    const step = niceStep(top - lo, 4);
    const hi = Math.ceil(top / step) * step;
    const ticks: number[] = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
    const yMin = ticks[0];
    const x = (i: number) => PAD.left + (points.length <= 1 ? (W - PAD.left - PAD.right) / 2 : (i / (points.length - 1)) * (W - PAD.left - PAD.right));
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (hi - yMin || 1)) * (H - PAD.top - PAD.bottom);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = points.length > 1 ? `${line} L${x(points.length - 1).toFixed(1)},${y(yMin)} L${x(0).toFixed(1)},${y(yMin)} Z` : '';
    return {x, y, line, area, ticks, yMin};
  }, [points, minY, maxY]);

  if (!points.length) return null;
  const {x, y, line, area, ticks, yMin} = geometry;
  const xTickEvery = Math.max(1, Math.ceil(points.length / 6));

  const pick = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((clientX - box.left) / box.width) * W;
    const i = points.length <= 1 ? 0 : Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <span className="flex items-center gap-3 text-xs text-muted">
          {markLabel && points.some((p) => p.marked) && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="10" height="10" aria-hidden>
                <circle cx="5" cy="5" r="4" fill="var(--chart-critical)" />
              </svg>
              {markLabel}
            </span>
          )}
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            aria-pressed={table}
            className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:text-fg', table && 'bg-surface-3 text-fg')}
          >
            <Table2 size={13} /> Tablo
          </button>
        </span>
      </figcaption>

      {table ? (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-surface text-[11px] text-faint uppercase">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Zaman</th>
                <th className="px-3 py-1.5 font-semibold">{unit}</th>
                <th className="px-3 py-1.5 font-semibold">Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-1 text-muted">{p.label}</td>
                  <td className="px-3 py-1 tabular-nums">{format(p.value)}</td>
                  <td className="px-3 py-1 text-muted">{p.detail ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none"
            role="img"
            aria-label={`${title}: ${points.length} nokta, son değer ${format(points[points.length - 1].value)} ${unit}`}
            onPointerMove={(event) => pick(event.clientX)}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--faint)" style={{fontVariantNumeric: 'tabular-nums'}}>
                  {format(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % xTickEvery === 0 || i === points.length - 1 ? (
                <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--faint)">
                  {p.label}
                </text>
              ) : null,
            )}
            {area && <path d={area} fill="var(--chart-1)" opacity={0.1} />}
            <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              p.marked ? <circle key={i} cx={x(i)} cy={y(p.value)} r={4} fill="var(--chart-critical)" stroke="var(--surface)" strokeWidth={2} /> : null,
            )}
            {points.length === 1 && <circle cx={x(0)} cy={y(points[0].value)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />}
            <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
            {active && hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(yMin)} stroke="var(--border-strong)" strokeWidth={1} />
                <circle cx={x(hover)} cy={y(active.value)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
              </g>
            )}
          </svg>
          {active && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-lg"
              style={{left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) > W * 0.7 ? '-105%' : '8px'})`}}
            >
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded" style={{background: 'var(--chart-1)'}} />
                <span className="text-sm font-semibold text-fg">{format(active.value)}</span>
                <span className="text-muted">{unit}</span>
              </div>
              <div className="text-muted">{active.label}</div>
              {active.detail && <div className="text-muted">{active.detail}</div>}
            </div>
          )}
        </div>
      )}
    </figure>
  );
};
