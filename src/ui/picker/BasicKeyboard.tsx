import {useLayoutEffect, useMemo, useRef, useState, type RefObject} from 'react';
import type {CatalogGroup, CatalogKey} from '@/keycodes/catalog';
import type {LabelContext} from '@/keycodes/labels';
import {useStudio} from '@/state/store';
import {cx} from '@/ui/components/ui';
import {basicBoard} from './basic-board';
import {PickerKey, pickerLegend} from './keys';

const useWidth = (ref: RefObject<HTMLElement | null>) => {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

// Below this key size the navigation keys and the numpad move under the main block.
const MIN_UNIT = 30;

// Keys only one shape of keyboard has type the same as others on a US layout; off the board they go by place.
const placeNames: Record<string, string> = {KC_NUBS: 'ISO: Z’nin solu', KC_NUHS: 'ISO: Enter’ın solu', KC_BSLS: 'ANSI: Enter’ın üstü'};

/** Keycap-style short legends for small keys (phones), by OS. */
const compactLegend = (code: string, os: 'mac' | 'other'): string | undefined => {
  const mac = os === 'mac';
  const legends: Record<string, string> = {
    KC_BSPC: '⌫',
    KC_ENT: '↵',
    KC_PENT: '↵',
    KC_CAPS: 'Caps',
    KC_LSFT: '⇧',
    KC_RSFT: '⇧',
    KC_LCTL: mac ? '⌃' : 'Ctrl',
    KC_RCTL: mac ? '⌃' : 'Ctrl',
    KC_LGUI: mac ? '⌘' : 'Win',
    KC_RGUI: mac ? '⌘' : 'Win',
    KC_LALT: mac ? '⌥' : 'Alt',
    KC_RALT: mac ? '⌥' : 'AltGr',
    KC_APP: '☰',
    KC_INS: 'Ins',
    KC_DEL: 'Del',
    KC_PSCR: 'Prt',
    KC_SLCK: 'Scr',
    KC_PAUS: 'Pse',
    KC_NLCK: 'Num',
  };
  return legends[code];
};

/**
 * The basic keys laid out as a full-size keyboard (ANSI or ISO, as in the
 * settings); the few keys a keyboard does not have are listed underneath.
 */
export const BasicKeyboard = ({
  group,
  ctx,
  onPick,
  currentValue,
}: {
  group: CatalogGroup;
  ctx: LabelContext;
  onPick: (value: number) => void;
  currentValue?: number;
}) => {
  const shape = useStudio((s) => s.settings.keyboardShape);
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const wide = width >= 22.5 * MIN_UNIT;
  const board = useMemo(() => basicBoard(shape, wide), [shape, wide]);
  const unit = Math.max(20, Math.min(40, Math.floor(width / board.width) || MIN_UNIT));
  const compact = unit < 34;
  const entries = useMemo(() => new Map(group.sections.flatMap((s) => s.keys).map((k) => [k.code, k])), [group]);
  const [special, ...sections] = group.sections;
  const onBoard = new Set(board.keys.map((k) => k.code));
  const rest = sections.map((s) => ({...s, keys: s.keys.filter((k) => !onBoard.has(k.code))})).filter((s) => s.keys.length);
  const currentCode = currentValue !== undefined ? ctx.codec.format(currentValue) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {special.keys.map((entry) => (
          <PickerKey key={entry.code} entry={entry} ctx={ctx} onPick={onPick} active={entry.code === currentCode} />
        ))}
      </div>
      <div ref={box} className="w-full overflow-x-auto pb-1">
        <div className="relative mx-auto" style={{width: board.width * unit, height: board.height * unit}} aria-label="Temel tuşlar" role="group">
          {board.keys.map((spot) => {
            const entry: CatalogKey = entries.get(spot.code) ?? {code: spot.code, label: spot.code.replace(/^KC_/, '')};
            const legend = pickerLegend(entry, ctx);
            if (!legend) return null;
            // Numpad keys show their character, small keys a keycap legend; full names stay in the
            // tooltip and for screen readers.
            const numpad = /^KC_P(\d|SLS|AST|MNS|PLS|DOT)$/.test(spot.code);
            const main = numpad
              ? legend.main.replace(/^N/, '')
              : ((compact ? compactLegend(spot.code, ctx.os) : undefined) ?? (spot.code === 'KC_PENT' ? 'Enter' : legend.main));
            const named = main !== legend.main ? (numpad ? (entry.title ?? entry.label) : entry.label) : undefined;
            const short = [...main].length <= 2;
            const active = legend.value === currentValue;
            return (
              <button
                key={spot.code}
                type="button"
                onClick={() => onPick(legend.value)}
                title={legend.title}
                aria-label={named}
                style={{left: spot.x * unit, top: spot.y * unit, width: spot.w * unit - 4, height: spot.h * unit - 4}}
                className={cx(
                  'absolute flex flex-col items-center justify-center overflow-hidden rounded-md border px-0.5 text-center leading-tight transition-colors',
                  active ? 'border-accent bg-accent-soft' : 'border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3',
                )}
              >
                {legend.top && (
                  <span className="text-muted" style={{fontSize: Math.max(8, unit * 0.24)}}>
                    {legend.top}
                  </span>
                )}
                <span
                  className={cx('break-words', short ? 'font-semibold' : 'font-medium')}
                  style={{fontSize: short ? Math.max(11, unit * 0.36) : Math.min(11, Math.max(8, unit * 0.27))}}
                >
                  {main}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {rest.map((section) => (
        <div key={section.label} className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold tracking-wide text-faint uppercase">{section.label} (klavyede olmayanlar)</h4>
          <div className="flex flex-wrap gap-1.5">
            {section.keys.map((entry) => {
              const name = placeNames[entry.code];
              return (
                <PickerKey
                  key={entry.code}
                  entry={name ? {...entry, w: 2} : entry}
                  ctx={ctx}
                  onPick={onPick}
                  active={entry.code === currentCode}
                  name={name}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
