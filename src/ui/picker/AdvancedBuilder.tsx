import {useEffect, useMemo, useState} from 'react';
import {staticGroups} from '@/keycodes/catalog';
import {formatModMask} from '@/keycodes/codec';
import {keyLabel} from '@/keycodes/labels';
import {useLabelContext} from '@/ui/hooks';
import {Button, Field, Select, cx} from '@/ui/components/ui';
import {useSelectedData} from '@/state/store';

type Mode = 'combo' | 'modTap' | 'layerTap' | 'oneShot' | 'layerMod' | 'raw';

const modes: {value: Mode; label: string; help: string}[] = [
  {value: 'combo', label: 'Kısayol', help: 'Tek tuşla Ctrl+C, Ctrl+Shift+T gibi bir kombinasyon gönderir.'},
  {value: 'modTap', label: 'Dokun / tut: değiştirici', help: 'Dokununca bir tuş, basılı tutunca Ctrl/Shift gibi davranır (home row mods).'},
  {value: 'layerTap', label: 'Dokun / tut: katman', help: 'Dokununca bir tuş, basılı tutunca bir katmanı açar (ör. Boşluk/Fn).'},
  {value: 'oneShot', label: 'Tek seferlik değiştirici', help: 'Bir kez dokun, sonraki tuş o değiştiriciyle basılır.'},
  {value: 'layerMod', label: 'Katman + değiştirici', help: 'Basılıyken hem katmanı hem değiştiriciyi açar.'},
  {value: 'raw', label: 'Kod yaz', help: 'QMK/VIA ifadesi yaz: ör. LT(1,KC_SPC), C(S(KC_T)), MO(2), 0x7C73.'},
];

const modOptions = [
  {bit: 0x01, label: 'Ctrl', mac: '⌃ Control'},
  {bit: 0x02, label: 'Shift', mac: '⇧ Shift'},
  {bit: 0x04, label: 'Alt', mac: '⌥ Option'},
  {bit: 0x08, label: 'Win', mac: '⌘ Command'},
];

const basicKeys = staticGroups.basic.sections.flatMap((s) => s.keys).filter((k) => k.code !== 'KC_NO' && k.code !== 'KC_TRNS');

export const AdvancedBuilder = ({onPick, currentValue}: {onPick: (value: number) => void; currentValue?: number}) => {
  const ctx = useLabelContext();
  const data = useSelectedData();
  const layerCount = data?.layerCount ?? 4;
  const [mode, setMode] = useState<Mode>('combo');
  const [mods, setMods] = useState(0x01);
  const [right, setRight] = useState(false);
  const [key, setKey] = useState('KC_C');
  const [layer, setLayer] = useState(1);
  const [raw, setRaw] = useState('');

  // Start "Kod yaz" from the current key so it can be tweaked.
  useEffect(() => {
    if (currentValue !== undefined) setRaw(ctx.codec.format(currentValue));
  }, [currentValue, ctx.codec]);

  const modMask = mods | (right ? 0x10 : 0);
  const expression = useMemo(() => {
    const maskText = formatModMask(modMask);
    switch (mode) {
      case 'combo': {
        if (!mods) return key;
        const names = right ? ['RCTL', 'RSFT', 'RALT', 'RGUI'] : ['C', 'S', 'A', 'G'];
        return names.filter((_, i) => mods & (1 << i)).reduceRight((acc, name) => `${name}(${acc})`, key);
      }
      case 'modTap':
        return `MT(${maskText},${key})`;
      case 'layerTap':
        return `LT(${layer},${key})`;
      case 'oneShot':
        return `OSM(${maskText})`;
      case 'layerMod':
        return `LM(${layer},${maskText})`;
      case 'raw':
        return raw;
    }
  }, [mode, mods, right, key, layer, raw, modMask]);

  const value = expression ? ctx.codec.parse(expression) : null;
  const preview = value !== null ? keyLabel(value, ctx) : null;
  const needsKey = mode === 'combo' || mode === 'modTap' || mode === 'layerTap';
  const needsMods = mode !== 'layerTap' && mode !== 'raw';
  const needsLayer = mode === 'layerTap' || mode === 'layerMod';
  const isMac = ctx.os === 'mac';

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cx(
                'rounded-lg border px-3 py-1.5 text-[13px] font-medium',
                mode === m.value ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{modes.find((m) => m.value === mode)?.help}</p>

        {needsMods && (
          <Field label="Değiştiriciler" hint="QMK sol ve sağ değiştiricileri aynı tuşta karıştıramaz.">
            <div className="flex flex-wrap items-center gap-2">
              {modOptions.map((m) => (
                <label
                  key={m.bit}
                  className={cx(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px]',
                    mods & m.bit ? 'border-mod bg-mod-soft text-fg' : 'border-border text-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--mod)]"
                    checked={!!(mods & m.bit)}
                    onChange={(event) => setMods((v) => (event.target.checked ? v | m.bit : v & ~m.bit))}
                  />
                  {isMac ? m.mac : m.label}
                </label>
              ))}
              <label className="ml-2 flex items-center gap-2 text-[13px] text-muted">
                <input type="checkbox" checked={right} onChange={(event) => setRight(event.target.checked)} />
                Sağ taraftakiler (AltGr için Sağ + Alt)
              </label>
            </div>
          </Field>
        )}

        <div className="flex flex-wrap gap-4">
          {needsKey && (
            <Field label="Tuş">
              <Select
                value={key}
                onChange={setKey}
                className="w-64"
                options={basicKeys.map((k) => {
                  const v = ctx.codec.parse(k.code);
                  const label = v !== null ? keyLabel(v, ctx) : null;
                  const shown = label && label.tone === 'normal' && label.main ? label.main : k.label;
                  return {value: k.code, label: `${shown}  ·  ${k.code}`};
                })}
              />
            </Field>
          )}
          {needsLayer && (
            <Field label="Katman">
              <Select
                value={layer}
                onChange={setLayer}
                options={Array.from({length: Math.min(layerCount, 16)}, (_, i) => ({value: i, label: `Katman ${i}`}))}
              />
            </Field>
          )}
        </div>

        {mode === 'raw' && (
          <Field label="İfade" hint="Büyük/küçük harf fark etmez. Ondalık değil, onaltılık değerler 0x ile yazılır.">
            <input
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              spellCheck={false}
              className={cx(
                'h-10 rounded-lg border bg-surface-2 px-3 font-mono text-sm outline-none',
                raw && value === null ? 'border-danger' : 'border-border focus:border-accent',
              )}
              placeholder="LT(1,KC_SPC)"
            />
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
        <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">Önizleme</span>
        <div className="flex h-20 w-20 flex-col items-center justify-center self-center rounded-xl border border-border-strong bg-surface-3 text-center">
          {preview ? (
            <>
              {preview.top && <span className="text-[10px] text-muted">{preview.top}</span>}
              <span className="text-lg font-semibold">{preview.main || '∅'}</span>
              {preview.sub && <span className="text-[10px] text-layer">{preview.sub}</span>}
            </>
          ) : (
            <span className="text-xs text-danger">Geçersiz</span>
          )}
        </div>
        <code className="truncate text-center font-mono text-xs text-muted">{expression || '—'}</code>
        {preview && <p className="text-center text-xs text-muted">{preview.title}</p>}
        <Button variant="primary" disabled={value === null} onClick={() => value !== null && onPick(value)}>
          Seçili tuşa ata
        </Button>
      </div>
    </div>
  );
};
