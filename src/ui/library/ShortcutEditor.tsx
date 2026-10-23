import {useEffect, useState} from 'react';
import {Keyboard} from 'lucide-react';
import {domCodeToKeycode} from '@/keycodes/dom-codes';
import {staticGroups} from '@/keycodes/catalog';
import type {ShortcutDef} from '@/library/types';
import {Select, cx} from '@/ui/components/ui';

const keyOptions = [...staticGroups.basic.sections, ...staticGroups.media.sections.slice(0, 2)]
  .flatMap((s) => s.keys)
  .filter((k) => !['KC_NO', 'KC_TRNS'].includes(k.code) && !/^KC_[LR](CTL|SFT|ALT|GUI)$/.test(k.code))
  .map((k) => {
    const name = k.code.replace(/^KC_/, '');
    return {value: k.code, label: k.label === name ? k.label : `${k.label} · ${name}`};
  });

const mods = (mac: boolean) => [
  {bit: 0x01, label: mac ? '⌃ Control' : 'Ctrl'},
  {bit: 0x02, label: mac ? '⇧ Shift' : 'Shift'},
  {bit: 0x04, label: mac ? '⌥ Option' : 'Alt'},
  {bit: 0x08, label: mac ? '⌘ Command' : 'Win'},
];

/** Modifier checkboxes + key, or capture by pressing the combination. */
export const ShortcutEditor = ({value, onChange, mac}: {value?: ShortcutDef; onChange: (value: ShortcutDef) => void; mac: boolean}) => {
  const current = value ?? {mods: 0, key: ''};
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (event: KeyboardEvent) => {
      const key = domCodeToKeycode[event.code];
      if (!key || /^KC_[LR](CTL|SFT|ALT|GUI)$/.test(key)) return;
      event.preventDefault();
      event.stopPropagation();
      let m = 0;
      if (event.ctrlKey) m |= 0x01;
      if (event.shiftKey) m |= 0x02;
      if (event.altKey) m |= 0x04;
      if (event.metaKey) m |= 0x08;
      onChange({mods: m, key});
      setCapturing(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {mods(mac).map((m) => (
          <label
            key={m.bit}
            className={cx(
              'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]',
              current.mods & m.bit ? 'border-mod bg-mod-soft text-fg' : 'border-border text-muted',
            )}
          >
            <input
              type="checkbox"
              checked={!!(current.mods & m.bit)}
              onChange={(event) => onChange({...current, mods: event.target.checked ? current.mods | m.bit : current.mods & ~m.bit})}
            />
            {m.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={current.key}
          onChange={(key) => onChange({...current, key})}
          options={current.key ? keyOptions : [{value: '', label: 'Tuş seç…'}, ...keyOptions]}
          label="Tuş"
          className="w-56"
        />
        <button
          type="button"
          onClick={() => setCapturing((c) => !c)}
          className={cx(
            'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px]',
            capturing ? 'animate-pulse border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
          )}
        >
          <Keyboard size={14} /> {capturing ? 'Kısayola bas…' : 'Basarak yakala'}
        </button>
      </div>
    </div>
  );
};
