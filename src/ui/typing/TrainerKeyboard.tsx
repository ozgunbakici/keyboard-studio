import {useMemo} from 'react';
import {KeycodeCodec} from '@/keycodes/codec';
import {hostLayouts} from '@/keycodes/host-layouts';
import {keyLabel} from '@/keycodes/labels';
import type {RenderKey} from '@/definitions/geometry';
import {updateSettings} from '@/state/actions';
import {useStudio} from '@/state/store';
import {
  charKey,
  fingerColors,
  fingerNames,
  fingerOf,
  keysToPress,
  standardBoards,
  standardPosition,
  type BoardShape,
  type Finger,
  type StandardKey,
} from '@/typing/fingers';
import {cx} from '@/ui/components/ui';
import {KeyboardView} from '@/ui/keyboard/KeyboardView';

const codec = KeycodeCodec.forProtocol(12);

const fingerTints = (keys: StandardKey[]) =>
  new Map(
    keys.flatMap((key) => {
      const finger = fingerOf.get(key.code);
      return finger ? [[`${key.row},${key.col}`, fingerColors[finger]] as const] : [];
    }),
  );

const tints: Record<BoardShape, Map<string, string>> = {ansi: fingerTints(standardBoards.ansi), iso: fingerTints(standardBoards.iso)};

const legendFingers: [Finger, string][] = [
  ['L5', 'Serçe'],
  ['L4', 'Yüzük'],
  ['L3', 'Orta'],
  ['L2', 'İşaret'],
  ['T', 'Başparmak'],
];

const charName = (ch: string) => (ch === ' ' ? 'Boşluk' : ch === '\n' ? 'Enter' : ch);

/** ANSI or ISO; the choice is kept in the settings and used everywhere. */
export const ShapeSwitch = ({className}: {className?: string}) => {
  const shape = useStudio((s) => s.settings.keyboardShape);
  return (
    <div role="radiogroup" aria-label="Klavye dizilimi" className={cx('inline-flex rounded-md border border-border p-0.5', className)}>
      {(['ansi', 'iso'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={shape === value}
          onClick={() => void updateSettings({keyboardShape: value})}
          className={cx(
            'rounded px-2 py-0.5 text-[11px] font-semibold transition-colors',
            shape === value ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

/**
 * Standard ANSI or ISO keyboard with finger colours. `next` lights up the key
 * to press (and the other hand's Shift); `heat` paints mistakes instead.
 */
export const TrainerKeyboard = ({
  next,
  heat,
  titleFor,
  className,
}: {
  next?: string;
  heat?: Map<string, number>;
  /** Tooltip text per key code, e.g. its error rate. */
  titleFor?: (code: string) => string | undefined;
  className?: string;
}) => {
  const hostId = useStudio((s) => s.settings.hostLayout);
  const os = useStudio((s) => s.settings.os);
  const shape = useStudio((s) => s.settings.keyboardShape);
  const host = hostLayouts[hostId];
  const ctx = useMemo(() => ({codec, host, os}), [host, os]);

  const labelFor = (key: RenderKey) => {
    const code = (key as StandardKey).code;
    const value = codec.parse(code);
    if (value === null) return undefined;
    const label = keyLabel(value, ctx);
    const extra = titleFor?.(code);
    return {
      ...label,
      sub: code === 'KC_F' || code === 'KC_J' ? '—' : undefined,
      title: extra ? `${label.main.replace(/\n/g, ' ')}: ${extra}` : label.title,
    };
  };

  const pressed = useMemo(() => {
    if (next === undefined) return undefined;
    return new Set(
      keysToPress(host, next, shape)
        .map((code) => standardPosition(code, shape))
        .filter((p): p is string => !!p),
    );
  }, [host, next, shape]);

  const where = next !== undefined ? charKey(host, next, shape) : null;
  const finger = where?.finger;

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[860px]">
        <KeyboardView
          keys={standardBoards[shape]}
          labelFor={labelFor}
          pressed={pressed}
          heat={heat}
          tints={heat ? undefined : tints[shape]}
          className="w-full select-none"
          ariaLabel={heat ? 'Hata ısı haritası' : 'Parmak rehberi'}
        />
      </div>
      {!heat && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted">
          {next !== undefined && (
            <span className="font-medium text-fg">
              Sıradaki: <kbd className="rounded border border-border-strong bg-surface-2 px-1.5 font-mono">{charName(next)}</kbd>
              {finger ? ` — ${fingerNames[finger]}` : ''}
              {where?.shift ? ' + Shift' : ''}
              {where?.altgr ? ' + AltGr' : ''}
            </span>
          )}
          {legendFingers.map(([f, name]) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{background: fingerColors[f]}} />
              {name}
            </span>
          ))}
          <ShapeSwitch />
        </div>
      )}
    </div>
  );
};
