import {ArrowDown, ArrowUp, Clock, Command, Keyboard, Plus, Trash2, Type} from 'lucide-react';
import {staticGroups} from '@/keycodes/catalog';
import type {MacroStep} from '@/macros/steps';
import {Button, IconButton, Select, cx} from '@/ui/components/ui';
import {useLabelContext} from '@/ui/hooks';
import {supportsDelays} from '@/via/macro-bytes';

const basicKeyOptions = staticGroups.basic.sections
  .flatMap((s) => s.keys)
  .filter((k) => k.code !== 'KC_NO' && k.code !== 'KC_TRNS');

export const modifierOptions = [
  {code: 0xe0, label: 'Ctrl', mac: '⌃ Control'},
  {code: 0xe1, label: 'Shift', mac: '⇧ Shift'},
  {code: 0xe2, label: 'Alt', mac: '⌥ Option'},
  {code: 0xe3, label: 'Win', mac: '⌘ Command'},
  {code: 0xe6, label: 'AltGr', mac: 'Sağ ⌥'},
];

export const KeySelect = ({value, onChange}: {value: number; onChange: (value: number) => void}) => {
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


/** Editable list of macro steps with buttons to add new ones. */
export const StepsEditor = ({steps, setSteps, protocol, isMac}: {steps: MacroStep[]; setSteps: (steps: MacroStep[]) => void; protocol: number; isMac: boolean}) => {
  const addStep = (step: MacroStep) => setSteps([...steps, step]);
  return (
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
  );
};
