import type {CatalogGroup, CatalogKey} from '@/keycodes/catalog';
import {keyLabel, type LabelContext} from '@/keycodes/labels';
import {cx} from '@/ui/components/ui';

/** What a picker key shows: the character it types here, or the catalog's name for other keys. */
export const pickerLegend = (entry: CatalogKey, ctx: LabelContext) => {
  const value = ctx.codec.parse(entry.code);
  if (value === null) return null;
  const label = keyLabel(value, ctx);
  // Catalog labels are more descriptive for non-character keys.
  const showCatalogLabel = label.tone !== 'normal' || !label.main || [...label.main].length > 1;
  return {
    value,
    main: showCatalogLabel ? entry.label : label.main,
    top: showCatalogLabel ? undefined : label.top,
    title: entry.title ? `${entry.label} — ${entry.title} (${entry.code})` : `${entry.label} (${entry.code})`,
  };
};

export const PickerKey = ({
  entry,
  ctx,
  onPick,
  active,
  name,
}: {
  entry: CatalogKey;
  ctx: LabelContext;
  onPick: (value: number) => void;
  active: boolean;
  /** Shown instead of the character, where the key's place matters more than what it types. */
  name?: string;
}) => {
  const legend = pickerLegend(entry, ctx);
  if (!legend) return null;
  const {value, title} = legend;
  const main = name ?? legend.main;
  const top = name ? undefined : legend.top;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      title={title}
      style={{width: `calc(${entry.w ?? 1} * 3.4rem + ${((entry.w ?? 1) - 1) * 0.375}rem)`}}
      className={cx(
        'relative flex h-[3.4rem] shrink-0 flex-col items-center justify-center rounded-lg border px-1 text-center leading-tight transition-colors',
        active ? 'border-accent bg-accent-soft' : 'border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3',
      )}
    >
      {top && <span className="text-[10px] text-muted">{top}</span>}
      <span className={cx('break-words', [...main].length <= 2 ? 'text-base font-semibold' : 'text-[11px] font-medium')}>{main}</span>
    </button>
  );
};

export const GroupGrid = ({
  group,
  ctx,
  onPick,
  currentCode,
}: {
  group: Pick<CatalogGroup, 'description' | 'sections'>;
  ctx: LabelContext;
  onPick: (value: number) => void;
  currentCode?: string;
}) => (
  <div className="flex flex-col gap-4">
    {group.description && <p className="text-xs text-muted">{group.description}</p>}
    {group.sections.map((section) => (
      <div key={section.label} className="flex flex-col gap-2">
        <h4 className="text-[11px] font-semibold tracking-wide text-faint uppercase">{section.label}</h4>
        <div className="flex flex-wrap gap-1.5">
          {section.keys.map((entry) => (
            <PickerKey key={entry.code} entry={entry} ctx={ctx} onPick={onPick} active={entry.code === currentCode} />
          ))}
        </div>
      </div>
    ))}
  </div>
);
