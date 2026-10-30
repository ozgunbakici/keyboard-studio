import {useEffect, useMemo, useState} from 'react';
import {BookMarked, Keyboard, Search, Sparkles, X} from 'lucide-react';
import type {CatalogGroup, CatalogKey} from '@/keycodes/catalog';
import {domCodeToKeycode} from '@/keycodes/dom-codes';
import {keyLabel} from '@/keycodes/labels';
import {useLibrary} from '@/library/store';
import {kindLabel, type LibraryAction} from '@/library/types';
import {setPane} from '@/state/actions';
import {useCatalog, useLabelContext} from '@/ui/hooks';
import {Button, cx} from '@/ui/components/ui';
import {deliveryModeText, kindOrder, useCurrentOs, useDelivery} from '@/ui/library/common';
import {AdvancedBuilder} from './AdvancedBuilder';
import {BasicKeyboard} from './BasicKeyboard';
import {GroupGrid} from './keys';

const fold = (text: string) =>
  text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u'})[c] ?? c);

const ActionButton = ({action, onPick, active}: {action: LibraryAction; onPick: (id: string) => void; active: boolean}) => {
  const delivery = useDelivery(action, useCurrentOs());
  return (
    <button
      type="button"
      onClick={() => onPick(action.id)}
      title={`${action.name} — ${delivery.summary}`}
      className={cx(
        'flex h-[3.4rem] w-[10rem] shrink-0 flex-col items-start justify-center gap-0.5 rounded-lg border px-2.5 text-left transition-colors',
        active ? 'border-action bg-action-soft' : 'border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3',
      )}
    >
      <span className="w-full truncate text-[12.5px] font-medium">{action.name}</span>
      <span className={cx('w-full truncate text-[10.5px]', delivery.mode === 'unavailable' ? 'text-danger' : 'text-faint')}>
        {kindLabel[action.kind]} · {deliveryModeText[delivery.mode]}
      </span>
    </button>
  );
};

const ActionSections = ({actions, onPick, currentActionId}: {actions: LibraryAction[]; onPick: (id: string) => void; currentActionId?: string}) => (
  <div className="flex flex-col gap-4">
    {kindOrder
      .map((kind) => ({kind, items: actions.filter((a) => a.kind === kind)}))
      .filter((section) => section.items.length)
      .map((section) => (
        <div key={section.kind} className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold tracking-wide text-faint uppercase">{kindLabel[section.kind]}</h4>
          <div className="flex flex-wrap gap-1.5">
            {section.items.map((action) => (
              <ActionButton key={action.id} action={action} onPick={onPick} active={action.id === currentActionId} />
            ))}
          </div>
        </div>
      ))}
  </div>
);

const ActionsTab = ({onPick, currentActionId}: {onPick: (id: string) => void; currentActionId?: string}) => {
  const actions = useLibrary((s) => s.actions);
  if (!actions.length) {
    return (
      <div className="flex flex-col items-start gap-3 text-sm text-muted">
        <p className="max-w-xl">
          Kütüphanende henüz eylem yok. Kısayol, metin, uygulama açma veya komut çalıştırma gibi işleri bir kez tanımla; her klavyede ve hem
          Windows’ta hem Mac’te doğru çalışsın.
        </p>
        <Button size="sm" icon={<BookMarked size={14} />} onClick={() => setPane('library')}>
          Kütüphaneyi aç
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Eylemler bu bilgisayarın işletim sistemine göre yazılır; klavyeyi başka bilgisayara takınca orada kendini uyarlar.{' '}
        <button type="button" className="text-accent hover:underline" onClick={() => setPane('library')}>
          Kütüphaneyi yönet
        </button>
      </p>
      <ActionSections actions={actions} onPick={onPick} currentActionId={currentActionId} />
    </div>
  );
};

export const KeycodePicker = ({
  onPick,
  onPickAction,
  currentValue,
  currentActionId,
  disabled,
}: {
  onPick: (value: number) => void;
  /** Shows the library tab; called with the chosen action id. */
  onPickAction?: (actionId: string) => void;
  currentValue?: number;
  currentActionId?: string;
  disabled?: boolean;
}) => {
  const groups = useCatalog();
  const ctx = useLabelContext();
  const actions = useLibrary((s) => s.actions);
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

  const actionResults = useMemo(() => {
    const q = fold(query.trim());
    if (!q || !onPickAction) return [];
    return actions.filter((a) => fold(`${a.name} ${a.tags.join(' ')} ${kindLabel[a.kind]}`).includes(q));
  }, [query, actions, onPickAction]);

  const active = groups.find((g) => g.id === tab) ?? groups[0];
  const showingGroup = !results && tab !== 'advanced' && tab !== 'actions';

  return (
    <div className={cx('flex h-full min-h-0 flex-1 flex-col', disabled && 'pointer-events-none opacity-50')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 pt-3 pb-2">
        <div className="flex flex-wrap gap-1" role="tablist">
          {groups.map((group) => (
            <button
              key={group.id}
              role="tab"
              aria-selected={showingGroup && active.id === group.id}
              onClick={() => {
                setTab(group.id);
                setQuery('');
              }}
              className={cx(
                'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                showingGroup && active.id === group.id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {group.label}
            </button>
          ))}
          {onPickAction && (
            <button
              role="tab"
              aria-selected={!results && tab === 'actions'}
              onClick={() => {
                setTab('actions');
                setQuery('');
              }}
              className={cx(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                !results && tab === 'actions' ? 'bg-action-soft text-action' : 'text-muted hover:text-fg',
              )}
            >
              <BookMarked size={14} /> Eylemler
            </button>
          )}
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
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setCapturing((c) => !c)}
            className={cx(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium whitespace-nowrap',
              capturing ? 'animate-pulse border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
            )}
            title="Klavyende bir tuşa (veya kısayola) bas, o tuş atanır"
          >
            <Keyboard size={15} /> {capturing ? 'Bir tuşa bas… (Esc: iptal)' : 'Tuşa basarak seç'}
          </button>
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tuş ara (ör. ses, katman, ş)"
              className="h-8 w-full rounded-lg border border-border bg-surface-2 pr-7 pl-8 text-[13px] outline-none placeholder:text-faint focus:border-accent sm:w-56"
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
          <div className="flex flex-col gap-5">
            {onPickAction && actionResults.length > 0 && (
              <ActionSections actions={actionResults} onPick={onPickAction} currentActionId={currentActionId} />
            )}
            <GroupGrid group={results} ctx={ctx} onPick={onPick} currentCode={currentCode} />
          </div>
        ) : tab === 'actions' && onPickAction ? (
          <ActionsTab onPick={onPickAction} currentActionId={currentActionId} />
        ) : tab === 'advanced' ? (
          <AdvancedBuilder onPick={onPick} currentValue={currentValue} />
        ) : active.id === 'basic' ? (
          <BasicKeyboard group={active} ctx={ctx} onPick={onPick} currentValue={currentValue} />
        ) : (
          <GroupGrid group={active} ctx={ctx} onPick={onPick} currentCode={currentCode} />
        )}
      </div>
    </div>
  );
};
