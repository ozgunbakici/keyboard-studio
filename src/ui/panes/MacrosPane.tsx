import {useEffect, useMemo, useState} from 'react';
import {ArrowDown, ArrowUp, Clock, Command, Keyboard, Plus, RotateCcw, Save, Trash2, Type, Zap} from 'lucide-react';
import {staticGroups} from '@/keycodes/catalog';
import {compileMacro, decompileMacro, simulateMacro} from '@/macros/host-text';
import {isTextOnly, macroText, macroToSteps, sameMacro, stepsToMacro, type MacroStep} from '@/macros/steps';
import {writeMacros} from '@/state/actions';
import {useSelectedData, useSelectedSession, useStudio} from '@/state/store';
import {confirm} from '@/ui/components/Dialog';
import {Badge, Button, EmptyState, IconButton, Select, cx} from '@/ui/components/ui';
import {useLabelContext} from '@/ui/hooks';
import {encodeMacro, supportsDelays, type Macro} from '@/via/macro-bytes';
import {hostLayouts} from '@/keycodes/host-layouts';

const basicKeyOptions = staticGroups.basic.sections
  .flatMap((s) => s.keys)
  .filter((k) => k.code !== 'KC_NO' && k.code !== 'KC_TRNS');

const modifierOptions = [
  {code: 0xe0, label: 'Ctrl', mac: '⌃ Control'},
  {code: 0xe1, label: 'Shift', mac: '⇧ Shift'},
  {code: 0xe2, label: 'Alt', mac: '⌥ Option'},
  {code: 0xe3, label: 'Win', mac: '⌘ Command'},
  {code: 0xe6, label: 'AltGr', mac: 'Sağ ⌥'},
];

const KeySelect = ({value, onChange}: {value: number; onChange: (value: number) => void}) => {
  const ctx = useLabelContext();
  return (
    <Select
      value={value}
      onChange={onChange}
      className="w-48"
      label="Tuş"
      options={basicKeyOptions.flatMap((k) => {
        const v = ctx.codec.parse(k.code);
        return v === null || v > 0xff ? [] : [{value: v, label: `${k.label} · ${k.code.replace(/^KC_/, '')}`}];
      })}
    />
  );
};

const StepRow = ({
  step,
  onChange,
  onRemove,
  onMove,
  isMac,
}: {
  step: MacroStep;
  onChange: (step: MacroStep) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  isMac: boolean;
}) => {
  const icon = {text: <Type size={15} />, tap: <Keyboard size={15} />, chord: <Command size={15} />, down: <ArrowDown size={15} />, up: <ArrowUp size={15} />, delay: <Clock size={15} />}[step.kind];
  const title = {text: 'Metin', tap: 'Tuşa bas', chord: 'Kısayol', down: 'Basılı tut', up: 'Bırak', delay: 'Bekle'}[step.kind];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
      <span className="flex w-24 items-center gap-1.5 text-[13px] font-medium text-muted">
        {icon}
        {title}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {step.kind === 'text' && (
          <input
            value={step.text}
            onChange={(event) => onChange({...step, text: event.target.value})}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
            placeholder="Yazılacak metin"
          />
        )}
        {(step.kind === 'tap' || step.kind === 'down' || step.kind === 'up') && <KeySelect value={step.keycode} onChange={(keycode) => onChange({...step, keycode})} />}
        {step.kind === 'chord' && (
          <>
            {modifierOptions.map((m) => (
              <label
                key={m.code}
                className={cx(
                  'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]',
                  step.mods.includes(m.code) ? 'border-mod bg-mod-soft text-fg' : 'border-border text-muted',
                )}
              >
                <input
                  type="checkbox"
                  checked={step.mods.includes(m.code)}
                  onChange={(event) =>
                    onChange({...step, mods: event.target.checked ? [...step.mods, m.code].sort((a, b) => a - b) : step.mods.filter((c) => c !== m.code)})
                  }
                />
                {isMac ? m.mac : m.label}
              </label>
            ))}
            <span className="text-faint">+</span>
            <KeySelect value={step.keycode} onChange={(keycode) => onChange({...step, keycode})} />
          </>
        )}
        {step.kind === 'delay' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="number"
              min={0}
              max={9999}
              value={step.ms}
              onChange={(event) => onChange({...step, ms: Math.max(0, Math.min(9999, Number(event.target.value) || 0))})}
              className="h-9 w-24 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
            />
            ms
          </label>
        )}
      </div>
      <div className="flex items-center">
        <IconButton label="Yukarı taşı" onClick={() => onMove(-1)}>
          <ArrowUp size={14} />
        </IconButton>
        <IconButton label="Aşağı taşı" onClick={() => onMove(1)}>
          <ArrowDown size={14} />
        </IconButton>
        <IconButton label="Sil" onClick={onRemove}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  );
};

export const MacrosPane = () => {
  const data = useSelectedData();
  const session = useSelectedSession();
  const hostId = useStudio((s) => s.settings.hostLayout);
  const os = useStudio((s) => s.settings.os);
  const ctx = useLabelContext();
  const host = hostLayouts[hostId];
  const protocol = session?.protocol ?? 0;

  // Drafts hold the intended macro (what should appear on screen).
  const initial = useMemo(() => (data?.macros ?? []).map((macro) => decompileMacro(macro, host)), [data?.macros, host]);
  const [drafts, setDrafts] = useState<Macro[]>(initial);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<'text' | 'steps'>('text');
  const [saving, setSaving] = useState(false);
  const [testText, setTestText] = useState('');

  useEffect(() => setDrafts(initial), [initial]);

  const compiled = useMemo(
    () =>
      drafts.map((draft, i) => {
        if (sameMacro(draft, initial[i] ?? [])) return {macro: data?.macros[i] ?? [], unsupported: [] as string[], dirty: false};
        const result = compileMacro(draft, host);
        return {...result, dirty: true};
      }),
    [drafts, initial, data?.macros, host],
  );

  const sizes = compiled.map((c) => {
    try {
      return encodeMacro(c.macro, protocol).length + 1;
    } catch {
      return Number.NaN;
    }
  });
  const used = sizes.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0);
  const dirty = compiled.some((c) => c.dirty);

  useEffect(() => {
    const draft = drafts[selected];
    if (draft && !isTextOnly(draft)) setMode('steps');
  }, [selected, drafts]);

  if (!data || !session) return null;
  if (!data.macroCount) {
    return (
      <EmptyState icon={<Zap size={30} />} title="Bu klavyede makro hafızası yok">
        Firmware makro desteği olmadan derlenmiş (DYNAMIC_KEYMAP_MACRO_COUNT = 0).
      </EmptyState>
    );
  }

  const draft = drafts[selected] ?? [];
  const steps = macroToSteps(draft);
  const setDraft = (macro: Macro) => setDrafts((all) => all.map((m, i) => (i === selected ? macro : m)));
  const setSteps = (next: MacroStep[]) => setDraft(stepsToMacro(next));
  const current = compiled[selected];
  const preview = current ? simulateMacro(current.macro, host, ctx.codec) : '';
  const isMac = os === 'mac';
  const percent = Math.min(100, (used / data.macroBufferSize) * 100);
  const over = used > data.macroBufferSize;

  const addStep = (step: MacroStep) => setSteps([...steps, step]);
  const save = async () => {
    const bad = compiled.findIndex((c) => c.unsupported.length);
    if (bad >= 0 && !(await confirm({title: 'Yazılamayan karakterler', body: `M${bad} içinde ${host.label} düzeninde yazılamayan karakterler var (${compiled[bad].unsupported.join(' ')}). Bunlar atlanacak.`, confirmLabel: 'Yine de kaydet'}))) {
      return;
    }
    setSaving(true);
    const ok = await writeMacros(compiled.map((c) => c.macro));
    setSaving(false);
    if (ok) setTestText('');
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)] gap-0">
      <div className="flex min-h-0 flex-col border-r border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>Hafıza</span>
            <span className={cx('font-mono tabular-nums', over && 'text-danger')}>
              {used} / {data.macroBufferSize} bayt
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cx('h-full rounded-full', over ? 'bg-danger' : percent > 80 ? 'bg-macro' : 'bg-accent')} style={{width: `${percent}%`}} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {drafts.map((macro, i) => {
            const text = macroText(macro).replace(/\n/g, ' ⏎ ');
            const summary = text || (macro.length ? simulateMacro(compiled[i]?.macro ?? [], host, ctx.codec) : '');
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', selected === i ? 'bg-surface-3' : 'hover:bg-surface-2')}
              >
                <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-macro-soft font-mono text-[12px] font-semibold text-macro">M{i}</span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-[13px]', summary ? 'text-fg' : 'text-faint')}>{summary || 'Boş'}</span>
                  <span className="block text-[11px] text-faint">{Number.isNaN(sizes[i]) ? 'hatalı' : `${sizes[i]} bayt`}</span>
                </span>
                {compiled[i]?.dirty && <span className="h-2 w-2 rounded-full bg-macro" title="Kaydedilmedi" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <h2 className="mr-2 text-base font-semibold">Makro {selected}</h2>
          <div className="flex rounded-lg border border-border p-0.5">
            {(['text', 'steps'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={m === 'text' && !isTextOnly(draft)}
                onClick={() => setMode(m)}
                className={cx('rounded-md px-3 py-1 text-[13px] font-medium disabled:opacity-40', mode === m ? 'bg-surface-3 text-fg' : 'text-muted')}
                title={m === 'text' && !isTextOnly(draft) ? 'Bu makro kısayol veya bekleme içeriyor; Adımlar modunda düzenle' : undefined}
              >
                {m === 'text' ? 'Metin' : 'Adımlar'}
              </button>
            ))}
          </div>
          <Badge tone="accent">{host.short} için çevriliyor</Badge>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} disabled={!dirty} onClick={() => setDrafts(initial)}>
              Değişiklikleri at
            </Button>
            <Button size="sm" variant="primary" icon={<Save size={14} />} disabled={!dirty || over || saving} onClick={() => void save()}>
              {saving ? 'Yazılıyor…' : 'Klavyeye kaydet'}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex max-w-3xl flex-col gap-4">
            {mode === 'text' ? (
              <textarea
                value={macroText(draft)}
                onChange={(event) => setDraft(event.target.value ? [{type: 'text', text: event.target.value}] : [])}
                rows={6}
                spellCheck={false}
                placeholder={'Makro tuşuna basınca yazılacak metin.\nTürkçe karakterler (ş, ğ, ü, İ…) ve @ { } gibi semboller otomatik olarak doğru tuşlara çevrilir.'}
                className="w-full resize-y rounded-xl border border-border bg-surface p-4 font-mono text-sm leading-relaxed outline-none focus:border-accent"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {steps.length === 0 && <p className="text-sm text-faint">Henüz adım yok. Aşağıdan ekle.</p>}
                {steps.map((step, i) => (
                  <StepRow
                    key={i}
                    step={step}
                    isMac={isMac}
                    onChange={(next) => setSteps(steps.map((s, j) => (j === i ? next : s)))}
                    onRemove={() => setSteps(steps.filter((_, j) => j !== i))}
                    onMove={(dir) => {
                      const target = i + dir;
                      if (target < 0 || target >= steps.length) return;
                      const next = [...steps];
                      [next[i], next[target]] = [next[target], next[i]];
                      setSteps(next);
                    }}
                  />
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" icon={<Plus size={14} />} onClick={() => addStep({kind: 'text', text: ''})}>
                    Metin
                  </Button>
                  <Button size="sm" icon={<Plus size={14} />} onClick={() => addStep({kind: 'chord', mods: [isMac ? 0xe3 : 0xe0], keycode: 0x06})}>
                    Kısayol
                  </Button>
                  <Button size="sm" icon={<Plus size={14} />} onClick={() => addStep({kind: 'tap', keycode: 0x28})}>
                    Tuş
                  </Button>
                  {supportsDelays(protocol) && (
                    <Button size="sm" icon={<Plus size={14} />} onClick={() => addStep({kind: 'delay', ms: 200})}>
                      Bekleme
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => addStep({kind: 'down', keycode: 0xe1})}>
                    Basılı tut
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => addStep({kind: 'up', keycode: 0xe1})}>
                    Bırak
                  </Button>
                </div>
              </div>
            )}

            {current?.unsupported.length ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {host.label} düzeninde yazılamayan karakterler: {current.unsupported.join(' ')}
              </p>
            ) : null}

            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold tracking-wide text-faint uppercase">Ekrana yazılacak ({host.short})</span>
                <span className="font-mono text-[11px] text-faint">{Number.isNaN(sizes[selected]) ? '—' : `${sizes[selected]} bayt`}</span>
              </div>
              <pre className="min-h-6 font-mono text-sm whitespace-pre-wrap text-fg">{preview || <span className="text-faint">—</span>}</pre>
            </div>

            <div className="rounded-xl border border-dashed border-border p-4">
              <span className="text-[12px] font-semibold tracking-wide text-faint uppercase">Dene</span>
              <p className="mt-1 mb-2 text-sm text-muted">
                Kaydettikten sonra makronun atandığı tuşa (ör. tuş haritasında M{selected}) basıp sonucu burada gör.
              </p>
              <textarea
                value={testText}
                onChange={(event) => setTestText(event.target.value)}
                rows={2}
                placeholder="Buraya tıkla ve makro tuşuna bas"
                className="w-full rounded-lg border border-border bg-surface-2 p-3 font-mono text-sm outline-none focus:border-accent"
              />
              {testText && (
                <p className={cx('mt-2 text-sm', testText.trim() === preview.trim() ? 'text-success' : 'text-macro')}>
                  {testText.trim() === preview.trim() ? 'Birebir aynı ✓' : 'Beklenenden farklı: bilgisayardaki klavye düzenini Ayarlar’dan kontrol et.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
