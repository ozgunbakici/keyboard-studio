import {useCallback, useEffect, useMemo, useState} from 'react';
import {BookMarked, Copy, Eraser, Layers, Redo2, RotateCcw, SlidersHorizontal, Undo2} from 'lucide-react';
import {layoutOptionGroups, visibleKeys, type RenderKey} from '@/definitions/geometry';
import {keyLabel} from '@/keycodes/labels';
import {focusAction} from '@/library/store';
import {bindingKey} from '@/library/types';
import {
  assignAction,
  assignKeycode,
  clearLayer,
  copyLayer,
  redoChange,
  resetKeymapToDefault,
  setLayer,
  setLayoutOption,
  setPane,
  setSelection,
  undoChange,
} from '@/state/actions';
import {useSelectedData, useStudio} from '@/state/store';
import {confirm} from '@/ui/components/Dialog';
import {Badge, Button, IconButton, Select, Toggle, cx} from '@/ui/components/ui';
import {actionKeyLabel, useBoundActions, useLabelContext} from '@/ui/hooks';
import {KeyboardView} from '@/ui/keyboard/KeyboardView';
import {KeycodePicker} from '@/ui/picker/KeycodePicker';

const LayerTabs = ({layerCount, layer, keymap}: {layerCount: number; layer: number; keymap: number[][]}) => {
  const ctx = useLabelContext();
  const trns = ctx.codec.value('KC_TRNS') ?? 1;
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Katmanlar">
      <Layers size={15} className="mr-1 text-faint" />
      {Array.from({length: layerCount}, (_, i) => {
        const empty = keymap[i]?.every((code) => code === trns || code === 0);
        return (
          <button
            key={i}
            role="tab"
            aria-selected={layer === i}
            onClick={() => setLayer(i)}
            title={empty ? `Katman ${i} (boş/geçirgen)` : `Katman ${i}`}
            className={cx(
              'h-8 min-w-9 rounded-lg px-2.5 text-[13px] font-semibold tabular-nums transition-colors',
              layer === i ? 'bg-layer text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg',
              empty && layer !== i && 'opacity-50',
            )}
          >
            {i}
          </button>
        );
      })}
    </div>
  );
};

const LayoutOptions = () => {
  const data = useSelectedData();
  if (!data) return null;
  const groups = layoutOptionGroups(data.definition);
  if (!groups.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-faint uppercase">
        <SlidersHorizontal size={14} /> Dizilim
      </span>
      {groups.map((group) => (
        <label key={group.index} className="flex items-center gap-2 text-[13px] text-muted">
          {group.label}
          {group.isToggle ? (
            <Toggle checked={data.layoutOptions[group.index] === 1} onChange={(v) => setLayoutOption(group.index, v ? 1 : 0)} label={group.label} />
          ) : (
            <Select
              value={data.layoutOptions[group.index] ?? 0}
              onChange={(v) => setLayoutOption(group.index, v)}
              options={group.choices.map((label, value) => ({value, label}))}
              label={group.label}
            />
          )}
        </label>
      ))}
    </div>
  );
};

export const KeymapPane = () => {
  const data = useSelectedData();
  const layer = useStudio((s) => s.layer);
  const selection = useStudio((s) => s.selection);
  const canUndo = useStudio((s) => s.undo.length > 0);
  const canRedo = useStudio((s) => s.redo.length > 0);
  const ctx = useLabelContext();
  const {vpid, bound} = useBoundActions();
  const [copyTarget, setCopyTarget] = useState(1);

  const keys = useMemo(() => (data ? visibleKeys(data.definition, data.layoutOptions) : []), [data]);
  const cols = data?.matrix.cols ?? 1;
  const layerKeys = data?.keymap[layer];

  const actionAt = useCallback(
    (key: RenderKey, part: 'key' | 'ccw' | 'cw') => {
      if (vpid === undefined) return undefined;
      const position =
        part === 'key'
          ? {vendorProductId: vpid, layer, row: key.row, col: key.col}
          : {vendorProductId: vpid, layer, row: -1, col: -1, encoder: {index: key.ei ?? 0, cw: part === 'cw'}};
      return bound.get(bindingKey(position));
    },
    [vpid, bound, layer],
  );

  const labelFor = useCallback(
    (key: RenderKey) => {
      if (!key.hasMatrix || !layerKeys) return undefined;
      const label = keyLabel(layerKeys[key.row * cols + key.col] ?? 0, ctx);
      const action = actionAt(key, 'key');
      return action ? actionKeyLabel(action, label) : label;
    },
    [layerKeys, cols, ctx, actionAt],
  );
  const encoderLabelsFor = useCallback(
    (key: RenderKey) => {
      const pair = key.ei !== undefined ? data?.encoders[layer]?.[key.ei] : undefined;
      if (!pair) return undefined;
      const side = (part: 'ccw' | 'cw', value: number) => {
        const label = keyLabel(value, ctx);
        const action = actionAt(key, part);
        return action ? actionKeyLabel(action, label) : label;
      };
      return {ccw: side('ccw', pair[0]), cw: side('cw', pair[1])};
    },
    [data?.encoders, layer, ctx, actionAt],
  );

  const selectedKey = keys.find((k) => k.id === selection?.keyId);
  const selectedAction = selectedKey && selection ? actionAt(selectedKey, selection.part) : undefined;
  const currentValue = useMemo(() => {
    if (!selectedKey || !data || !selection) return undefined;
    if (selection.part === 'key') return layerKeys?.[selectedKey.row * cols + selectedKey.col];
    const pair = selectedKey.ei !== undefined ? data.encoders[layer]?.[selectedKey.ei] : undefined;
    return pair?.[selection.part === 'cw' ? 1 : 0];
  }, [selectedKey, selection, data, layerKeys, cols, layer]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        void (event.shiftKey ? redoChange() : undoChange());
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        void redoChange();
      } else if (event.key === 'Escape') {
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!data) return null;
  const current = currentValue !== undefined ? keyLabel(currentValue, ctx) : null;
  const encodersMapped = data.encoderCount > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LayerTabs layerCount={data.layerCount} layer={layer} keymap={data.keymap} />
        <div className="flex flex-wrap items-center gap-1">
          <IconButton label="Geri al (Ctrl+Z)" disabled={!canUndo} onClick={() => void undoChange()}>
            <Undo2 size={16} />
          </IconButton>
          <IconButton label="Yinele (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => void redoChange()}>
            <Redo2 size={16} />
          </IconButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <Select
            value={copyTarget}
            onChange={setCopyTarget}
            label="Kopyalanacak katman"
            className="h-8 text-[13px]"
            options={Array.from({length: data.layerCount}, (_, i) => ({value: i, label: `→ Katman ${i}`})).filter((o) => o.value !== layer)}
          />
          <Button
            size="sm"
            icon={<Copy size={14} />}
            onClick={async () => {
              const target = copyTarget === layer ? (layer + 1) % data.layerCount : copyTarget;
              if (await confirm({title: `Katman ${layer} → Katman ${target}`, body: `Katman ${target} tamamen Katman ${layer} ile değiştirilecek. Önce otomatik yedek alınır.`, confirmLabel: 'Kopyala'})) {
                await copyLayer(layer, target);
              }
            }}
          >
            Kopyala
          </Button>
          <Button
            size="sm"
            icon={<Eraser size={14} />}
            onClick={async () => {
              if (await confirm({title: `Katman ${layer} temizlensin mi?`, body: 'Tüm tuşlar geçirgen (▽) yapılır; alttaki katman çalışır. Önce otomatik yedek alınır.', confirmLabel: 'Temizle', danger: true})) {
                await clearLayer(layer);
              }
            }}
          >
            Temizle
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={14} />}
            onClick={async () => {
              if (await confirm({title: 'Fabrika tuş haritası', body: 'Tüm katmanlar firmware içindeki varsayılan haritaya döner. Mevcut hâli otomatik yedeklenir.', confirmLabel: 'Varsayılana dön', danger: true})) {
                await resetKeymapToDefault();
              }
            }}
          >
            Varsayılan
          </Button>
        </div>
      </div>

      <LayoutOptions />

      <div className="flex flex-col gap-2">
        <div className="mx-auto w-full max-w-[1180px]">
          <KeyboardView
            keys={keys}
            labelFor={labelFor}
            encoderLabelsFor={encodersMapped ? encoderLabelsFor : undefined}
            selection={selection}
            onSelect={(next) => setSelection(selection?.keyId === next.keyId && selection.part === next.part ? null : next)}
            className="max-h-[44vh] w-full select-none"
            ariaLabel={`${data.name}, katman ${layer}`}
          />
        </div>
        {encodersMapped && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
            {keys
              .filter((k) => k.isEncoder)
              .map((k) => {
                const labels = encoderLabelsFor(k);
                const chip = (part: 'ccw' | 'cw', icon: string, text?: string) => (
                  <button
                    key={part}
                    type="button"
                    onClick={() => setSelection({keyId: k.id, part})}
                    className={cx(
                      'rounded-md border px-2 py-1',
                      selection?.keyId === k.id && selection.part === part ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:text-fg',
                    )}
                  >
                    {icon} {text?.replace(/\n/g, ' ') || '—'}
                  </button>
                );
                return (
                  <span key={k.id} className="flex items-center gap-1.5">
                    <span className="text-faint">Knob {k.ei}</span>
                    {chip('ccw', '↺', labels?.ccw?.main)}
                    {chip('cw', '↻', labels?.cw?.main)}
                  </span>
                );
              })}
          </div>
        )}
        <div className="flex min-h-10 flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm">
          {selectedKey && current ? (
            <>
              <span className="text-faint">
                {selection?.part === 'key' ? `Tuş ${selectedKey.row},${selectedKey.col}` : selection?.part === 'cw' ? 'Knob sağa' : 'Knob sola'} · Katman {layer}
              </span>
              {selectedAction ? (
                <>
                  <Badge tone="action">
                    <BookMarked size={12} /> Eylem
                  </Badge>
                  <span className="font-semibold">{selectedAction.name}</span>
                </>
              ) : (
                <span className="font-semibold">{current.title}</span>
              )}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{current.code}</code>
              <div className="ml-auto flex gap-1.5">
                {selectedAction && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      focusAction(selectedAction.id);
                      setPane('library');
                    }}
                  >
                    Eylemi düzenle
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => void assignKeycode(ctx.codec.value('KC_TRNS') ?? 1)}>
                  Geçirgen yap
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void assignKeycode(0)}>
                  Boşalt
                </Button>
              </div>
            </>
          ) : (
            <span className="text-muted">
              Değiştirmek için klavyede bir tuşa tıkla, sonra aşağıdan atanacak tuşu seç.
              {encodersMapped ? ' Knob’un sol/sağ yarısı dönüş yönleridir.' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-[220px] flex-1 overflow-hidden rounded-xl border border-border bg-surface">
        <KeycodePicker
          onPick={(value) => void assignKeycode(value)}
          onPickAction={(id) => void assignAction(id)}
          currentValue={selectedAction ? undefined : currentValue}
          currentActionId={selectedAction?.id}
          disabled={!selection}
        />
      </div>
    </div>
  );
};
