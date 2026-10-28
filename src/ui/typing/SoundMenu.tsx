import {useEffect, useRef, useState} from 'react';
import {Volume2, VolumeX} from 'lucide-react';
import {previewSound, switchSounds} from '@/typing/sound';
import {updateTypingSettings, useTyping} from '@/typing/store';
import {Button, Slider, cx} from '@/ui/components/ui';

/** Picks the switch the trainer sounds like, and how loud; choosing one plays a few keystrokes. */
export const SoundMenu = () => {
  const sound = useTyping((s) => s.settings.switchSound);
  const volume = useTyping((s) => s.settings.soundVolume);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);
  const label = switchSounds.find((s) => s.id === sound)?.label ?? '';

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        size="sm"
        variant="ghost"
        icon={sound === 'off' ? <VolumeX size={15} /> : <Volume2 size={15} />}
        aria-label="Tuş sesi"
        aria-expanded={open}
        title="Tuş sesi: yazarken seçtiğin switch gibi ses çıkar"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="hidden sm:inline">{sound === 'off' ? 'Ses kapalı' : label}</span>
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-72 rounded-xl border border-border bg-surface p-3 shadow-xl">
          <div className="mb-2 text-xs font-medium text-muted">Tuş sesi (switch tipi)</div>
          <div role="radiogroup" aria-label="Switch sesi" className="flex flex-col gap-0.5">
            {switchSounds.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={sound === s.id}
                onClick={() => {
                  void updateTypingSettings({switchSound: s.id});
                  previewSound(s.id, volume);
                }}
                className={cx('flex flex-col rounded-lg px-2.5 py-1.5 text-left', sound === s.id ? 'bg-accent-soft' : 'hover:bg-surface-2')}
              >
                <span className={cx('text-[13px] font-medium', sound === s.id && 'text-accent')}>{s.label}</span>
                <span className="text-[11.5px] text-faint">{s.hint}</span>
              </button>
            ))}
          </div>
          {sound !== 'off' && (
            <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
              Ses düzeyi
              <Slider value={Math.round(volume * 100)} min={5} max={100} unit="%" label="Ses düzeyi" onChange={(v) => void updateTypingSettings({soundVolume: v / 100})} />
            </label>
          )}
        </div>
      )}
    </div>
  );
};
