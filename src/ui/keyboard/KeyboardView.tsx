import {memo, useMemo} from 'react';
import {keyOutline, layoutBounds, type RenderKey} from '@/definitions/geometry';
import type {KeyLabel} from '@/keycodes/labels';
import type {KeySelection} from '@/state/store';

const PAD = 0.3;
const GAP = 0.05;

type Props = {
  keys: RenderKey[];
  labelFor?: (key: RenderKey) => KeyLabel | undefined;
  encoderLabelsFor?: (key: RenderKey) => {ccw?: KeyLabel; cw?: KeyLabel} | undefined;
  selection?: KeySelection;
  onSelect?: (selection: NonNullable<KeySelection>) => void;
  pressed?: Set<string>;
  tested?: Set<string>;
  heat?: Map<string, number>;
  /** Base fill per "row,col", e.g. finger colours in the typing guide. */
  tints?: Map<string, string>;
  className?: string;
  ariaLabel?: string;
};

// Legends take the ink of the keycap they sit on (e.g. green on cream, cream on green).
const legendColor = (key: RenderKey) =>
  key.color === 'mod' ? 'var(--key-mod-fg)' : key.color === 'accent' ? 'var(--key-accent-fg)' : 'var(--key-alpha-fg)';

const keyColor = (key: RenderKey) =>
  key.color === 'mod' ? 'var(--key-mod)' : key.color === 'accent' ? 'var(--key-accent)' : 'var(--key-alpha)';

const toneColor: Record<string, string | undefined> = {
  layer: 'var(--layer)',
  macro: 'var(--macro)',
  mod: 'var(--mod)',
  custom: 'var(--accent)',
  action: 'var(--action)',
};

/** Shrinks text to fit the keycap width. */
const fitSize = (text: string, width: number, base: number) => {
  const length = [...text].length;
  if (length <= 1) return base * 1.15;
  return Math.min(base, (width - 0.22) / (length * 0.56));
};

const Legend = ({label, x, y, w, h, dim, ink}: {label: KeyLabel; x: number; y: number; w: number; h: number; dim?: boolean; ink: string}) => {
  const cxp = x + w / 2;
  const lines = label.main.split('\n');
  const mainSize = fitSize(lines.reduce((a, b) => (b.length > a.length ? b : a), ''), w, 0.26);
  const tone = toneColor[label.tone];
  const hasTop = !!label.top;
  const hasSub = !!label.sub;
  const mainY = y + h / 2 + (hasTop ? 0.1 : 0) - (hasSub ? 0.08 : 0);
  return (
    <g pointerEvents="none" opacity={dim ? 0.38 : 1}>
      {hasTop && (
        <text x={cxp} y={y + 0.33} textAnchor="middle" fontSize={fitSize(label.top!, w, 0.17)} fill={ink} fillOpacity={0.62}>
          {label.top}
        </text>
      )}
      {lines.map((line, i) => (
        <text
          key={i}
          x={cxp}
          y={mainY + (i - (lines.length - 1) / 2) * mainSize * 1.1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={mainSize}
          fontWeight={label.tone === 'normal' && [...line].length === 1 ? 600 : 500}
          fill={label.tone === 'transparent' || label.tone === 'empty' ? 'var(--faint)' : ink}
        >
          {line}
        </text>
      ))}
      {hasSub && (
        <text x={cxp} y={y + h - 0.2} textAnchor="middle" fontSize={fitSize(label.sub!, w, 0.15)} fill={tone ?? 'var(--muted)'}>
          {label.sub}
        </text>
      )}
    </g>
  );
};

const KeyCap = memo(function KeyCap({
  keyDef,
  label,
  encoderLabels,
  selected,
  pressed,
  tested,
  heat,
  tint,
  onSelect,
}: {
  keyDef: RenderKey;
  label?: KeyLabel;
  encoderLabels?: {ccw?: KeyLabel; cw?: KeyLabel};
  selected: KeySelection;
  pressed: boolean;
  tested: boolean;
  heat?: number;
  tint?: string;
  onSelect?: Props['onSelect'];
}) {
  const k = keyDef;
  const transform = k.r ? `rotate(${k.r} ${k.rx} ${k.ry})` : undefined;
  const isSelected = selected?.keyId === k.id;
  const tone = label ? toneColor[label.tone] : undefined;
  const base = pressed ? 'var(--accent)' : tested ? 'var(--layer-soft)' : keyColor(k);
  const heatFill = heat !== undefined ? `rgb(208 59 59 / ${Math.min(0.9, heat * 0.9).toFixed(3)})` : undefined;

  if (k.isEncoder) {
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    const r = Math.min(k.w, k.h) / 2 - GAP * 2;
    const part = isSelected ? selected?.part : null;
    const half = (side: 'ccw' | 'cw') => {
      const sweep = side === 'ccw' ? 0 : 1;
      return `M${cx},${cy - r} A${r},${r} 0 0 ${sweep} ${cx},${cy + r} Z`;
    };
    return (
      <g transform={transform} data-key-id={k.id} className="cursor-pointer">
        <circle cx={cx} cy={cy} r={r + 0.03} fill="var(--key-edge)" />
        {(['ccw', 'cw'] as const).map((side) => (
          <path
            key={side}
            d={half(side)}
            className="key-shape"
            fill={part === side ? 'var(--accent-soft)' : 'var(--key-mod)'}
            stroke={part === side ? 'var(--accent)' : 'transparent'}
            strokeWidth={0.04}
            onClick={() => onSelect?.({keyId: k.id, part: side})}
          >
            <title>
              {side === 'ccw' ? 'Sola çevirme' : 'Sağa çevirme'}
              {encoderLabels?.[side] ? `: ${encoderLabels[side]!.title}` : ''}
            </title>
          </path>
        ))}
        {k.hasMatrix && (
          <circle
            cx={cx}
            cy={cy}
            r={r * 0.42}
            className="key-shape"
            fill={pressed ? 'var(--accent)' : part === 'key' ? 'var(--accent-soft)' : 'var(--key-alpha)'}
            stroke={part === 'key' ? 'var(--accent)' : 'var(--border-strong)'}
            strokeWidth={0.035}
            onClick={() => onSelect?.({keyId: k.id, part: 'key'})}
          >
            <title>{label ? `Basma: ${label.title}` : 'Basma'}</title>
          </circle>
        )}
        <g pointerEvents="none" fill="var(--muted)" fontSize={0.2}>
          <text x={cx - r * 0.66} y={cy} textAnchor="middle" dominantBaseline="central" fill={part === 'ccw' ? 'var(--accent)' : undefined}>
            ↺
          </text>
          <text x={cx + r * 0.66} y={cy} textAnchor="middle" dominantBaseline="central" fill={part === 'cw' ? 'var(--accent)' : undefined}>
            ↻
          </text>
          {k.hasMatrix && label && (
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--key-fg)"
              fontSize={Math.min(0.13, (r * 0.84) / Math.max(1, [...label.main].length * 0.55))}
            >
              {label.main}
            </text>
          )}
        </g>
      </g>
    );
  }

  const outer = keyOutline(k, GAP);
  const inner = keyOutline(k, GAP + 0.07);
  const shape = (o: ReturnType<typeof keyOutline>, props: Record<string, unknown>) =>
    o.kind === 'rect' ? <rect x={o.x} y={o.y} width={o.w} height={o.h} rx={0.1} {...props} /> : <path d={o.d} strokeLinejoin="round" {...props} />;
  // Legend area: the first rectangle (ISO enter's upper part is wide enough).
  const legendBox = {x: k.x, y: k.y, w: k.w, h: k.h};
  if (k.w2 !== undefined && k.h2 !== undefined && k.h2 > k.h) {
    legendBox.x = k.x + (k.x2 ?? 0);
    legendBox.w = k.w2;
    legendBox.h = k.h2;
  }

  return (
    <g
      transform={transform}
      data-key-id={k.id}
      data-row={k.row}
      data-col={k.col}
      className={onSelect && k.hasMatrix ? 'cursor-pointer' : undefined}
      onClick={() => k.hasMatrix && onSelect?.({keyId: k.id, part: 'key'})}
      role={onSelect ? 'button' : undefined}
      aria-label={label ? `${label.title}` : `Tuş ${k.row},${k.col}`}
      aria-pressed={onSelect ? isSelected : undefined}
    >
      {label?.title && <title>{label.title}</title>}
      {shape(outer, {fill: 'var(--key-edge)'})}
      {shape(inner, {
        className: 'key-shape',
        fill: base,
        stroke: isSelected ? 'var(--accent)' : tone ? tone : 'var(--key-top)',
        strokeWidth: isSelected ? 0.06 : tone ? 0.035 : 0.02,
      })}
      {heatFill && !pressed && shape(inner, {fill: heatFill, pointerEvents: 'none'})}
      {tint && !pressed && !heatFill && shape(inner, {fill: tint, pointerEvents: 'none'})}
      {label && <Legend label={label} {...legendBox} dim={!k.hasMatrix} ink={pressed ? 'var(--accent-fg)' : legendColor(k)} />}
    </g>
  );
});

export const KeyboardView = ({keys, labelFor, encoderLabelsFor, selection = null, onSelect, pressed, tested, heat, tints, className, ariaLabel}: Props) => {
  const bounds = useMemo(() => layoutBounds(keys), [keys]);
  const viewBox = `${bounds.minX - PAD} ${bounds.minY - PAD} ${bounds.width + PAD * 2} ${bounds.height + PAD * 2}`;
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role="group"
      aria-label={ariaLabel ?? 'Klavye'}
      style={{fontFamily: 'var(--font-sans)'}}
    >
      <rect
        x={bounds.minX - PAD + 0.05}
        y={bounds.minY - PAD + 0.05}
        width={bounds.width + PAD * 2 - 0.1}
        height={bounds.height + PAD * 2 - 0.1}
        rx={0.3}
        fill="var(--plate)"
        stroke="var(--border)"
        strokeWidth={0.03}
      />
      {keys.map((key) => (
        <KeyCap
          key={key.id}
          keyDef={key}
          label={labelFor?.(key)}
          encoderLabels={key.isEncoder ? encoderLabelsFor?.(key) : undefined}
          selected={selection?.keyId === key.id ? selection : null}
          pressed={pressed?.has(`${key.row},${key.col}`) ?? false}
          tested={tested?.has(`${key.row},${key.col}`) ?? false}
          heat={heat?.get(`${key.row},${key.col}`)}
          tint={tints?.get(`${key.row},${key.col}`)}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
};
