import {useEffect, useMemo, useState} from 'react';
import {Keyboard, Search, Sparkles, X} from 'lucide-react';
import type {CatalogGroup, CatalogKey} from '@/keycodes/catalog';
import {domCodeToKeycode} from '@/keycodes/dom-codes';
import {keyLabel, type LabelContext} from '@/keycodes/labels';
import {useCatalog, useLabelContext} from '@/ui/hooks';
import {cx} from '@/ui/components/ui';
import {AdvancedBuilder} from './AdvancedBuilder';

const fold = (text: string) =>
  text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u'})[c] ?? c);

const PickerKey = ({entry, ctx, onPick, active}: {entry: CatalogKey; ctx: LabelContext; onPick: (value: number) => void; active: boolean}) => {
  const value = ctx.codec.parse(entry.code);
  if (value === null) return null;
  const label = keyLabel(value, ctx);
  // Catalog labels are more descriptive for non-character keys.
  const showCatalogLabel = label.tone !== 'normal' || !label.main || [...label.main].length > 1;
  const main = showCatalogLabel ? entry.label : label.main;
  const top = showCatalogLabel ? undefined : label.top;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      title={entry.title ? `${entry.label} — ${entry.title} (${entry.code})` : `${entry.label} (${entry.code})`}
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

const GroupGrid = ({group, ctx, onPick, currentCode}: {group: CatalogGroup; ctx: LabelContext; onPick: (value: number) => void; currentCode?: string}) => (
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

export const KeycodePicker = ({onPick, currentValue, disabled}: {onPick: (value: number) => void; currentValue?: number; disabled?: boolean}) => {
  const groups = useCatalog();
  const ctx = useLabelContext();
  const [tab, setTab] = useState<string>('basic');
  const [query, setQuery] = useState('');
  const [capturing, setCapturing] = useState(false);
  const currentCode = currentValue !== undefined ? ctx.codec.format(currentValue) : undefined;

  useEffect(() => {
    if (!capturing) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape' && !event.shiftKey) {
        setCapturing(false);
        return;
      }
      const name = domCodeToKeycode[event.code];
      if (!name) return;
      const isModifier = /^KC_[LR](CTL|SFT|ALT|GUI)$/.test(name);
      let mods = 0;
      if (!isModifier) {
        if (event.ctrlKey) mods |= 0x01;
        if (event.shiftKey) mods |= 0x02;
        if (event.altKey) mods |= 0x04;
        if (event.metaKey) mods |= 0x08;
      }
      const base = ctx.codec.parse(name);
      if (base === null) return;
      onPick(mods ? (mods << 8) | base : base);
      setCapturing(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, ctx.codec, onPick]);

  const results = useMemo(() => {
    const raw = query.trim();
    const q = fold(raw);
    if (!q) return null;
    // One character: match what the key types on this computer (e.g. "ş", "@").
    const single = [...raw].length === 1 ? raw.toLocaleLowerCase('tr-TR') : null;
    const seen = new Set<string>();
    const exact: CatalogKey[] = [];
    const partial: CatalogKey[] = [];
    for (const group of groups) {
      for (const section of group.sections) {
        for (const key of section.keys) {
          if (seen.has(key.code)) continue;
          const value = ctx.codec.parse(key.code);
          const label = value !== null ? keyLabel(value, ctx) : null;
          const shown = [label?.main, label?.top, key.label].filter(Boolean).map((t) => t!.toLocaleLowerCase('tr-TR'));
          if (single && shown.includes(single)) {
            seen.add(key.code);
            exact.push(key);
          } else if (!single && fold(`${key.label} ${key.code} ${key.title ?? ''} ${label?.main ?? ''}`).includes(q)) {
            seen.add(key.code);
            partial.push(key);
          }
        }
      }
    }
    const keys = [...exact, ...partial];
    return {id: 'search', label: 'Arama', sections: [{label: `${keys.length} sonuç`, keys}]} satisfies CatalogGroup;
  }, [query, groups, ctx]);

  const active = groups.find((g) => g.id === tab) ?? groups[0];

  return (
    <div className={cx('flex min-h-0 flex-col', disabled && 'pointer-events-none opacity-50')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 pt-3 pb-2">
        <div className="flex flex-wrap gap-1" role="tablist">
          {groups.map((group) => (
            <button
              key={group.id}
              role="tab"
              aria-selected={!results && active.id === group.id}
              onClick={() => {
                setTab(group.id);
                setQuery('');
              }}
              className={cx(
                'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                !results && active.id === group.id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {group.label}
            </button>
          ))}
          <button
            role="tab"
            aria-selected={!results && tab === 'advanced'}
            onClick={() => {
              setTab('advanced');
              setQuery('');
            }}
            className={cx(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
              !results && tab === 'advanced' ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg',
            )}
          >
            <Sparkles size={14} /> Gelişmiş
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCapturing((c) => !c)}
            className={cx(
              'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium',
              capturing ? 'animate-pulse border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
            )}
            title="Klavyende bir tuşa (veya kısayola) bas, o tuş atanır"
          >
            <Keyboard size={15} /> {capturing ? 'Bir tuşa bas… (Esc: iptal)' : 'Tuşa basarak seç'}
          </button>
          <label className="relative">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tuş ara (ör. ses, katman, ş)"
              className="h-8 w-56 rounded-lg border border-border bg-surface-2 pr-7 pl-8 text-[13px] outline-none placeholder:text-faint focus:border-accent"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute top-1/2 right-2 -translate-y-1/2 text-faint hover:text-fg" aria-label="Aramayı temizle">
                <X size={14} />
              </button>
            )}
          </label>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {results ? (
          <GroupGrid group={results} ctx={ctx} onPick={onPick} currentCode={currentCode} />
        ) : tab === 'advanced' ? (
          <AdvancedBuilder onPick={onPick} currentValue={currentValue} />
        ) : (
          <GroupGrid group={active} ctx={ctx} onPick={onPick} currentCode={currentCode} />
        )}
      </div>
    </div>
  );
};
