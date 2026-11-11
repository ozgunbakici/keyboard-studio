import {useEffect, useRef, useState} from 'react';
import {Upload, Volume2, VolumeX, X} from 'lucide-react';
import {previewSound, removeCustomSound, setCustomSound, soundPacks, useCustomSound, type SoundPack} from '@/typing/sound';
import {updateTypingSettings, useTyping} from '@/typing/store';
import {Button, Slider, cx} from '@/ui/components/ui';
import {usePopover} from '@/ui/typing/usePopover';

const groups: {group: SoundPack['group']; title: string | null}[] = [
  {group: 'off', title: null},
  {group: 'switch', title: 'Switch’ler'},
  {group: 'fantasy', title: 'Fantastik'},
  {group: 'custom', title: 'Kendi sesim'},
];

/** Picks what the keys sound like (a switch, a fantasy pack or the user's own file), and how loud; choosing one plays a few keystrokes. */
export const SoundMenu = () => {
  const sound = useTyping((s) => s.settings.switchSound);
  const volume = useTyping((s) => s.settings.soundVolume);
  const customName = useCustomSound((s) => s.name);
  const {open, setOpen, ref} = usePopover();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const alert = useRef<HTMLDivElement>(null);
  // The list scrolls, so bring a fresh error into view.
  useEffect(() => {
    alert.current?.scrollIntoView({block: 'nearest'});
  }, [error]);
  const label = soundPacks.find((s) => s.id === sound)?.label ?? '';

  const choose = (pack: SoundPack) => {
    setError(null);
    if (pack.id === 'custom' && !customName) {
      input.current?.click();
      return;
    }
    void updateTypingSettings({switchSound: pack.id});
    previewSound(pack.id, volume);
  };

  const upload = async (file: File) => {
    try {
      await setCustomSound(file);
      setError(null);
      await updateTypingSettings({switchSound: 'custom'});
      previewSound('custom', volume);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ses dosyası yüklenemedi.');
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        size="sm"
        variant="ghost"
        icon={sound === 'off' ? <VolumeX size={15} /> : <Volume2 size={15} />}
        aria-label="Tuş sesi"
        aria-expanded={open}
        title="Tuş sesi: yazarken tuşlar seçtiğin gibi ses çıkarır"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="hidden sm:inline">{sound === 'off' ? 'Ses kapalı' : label}</span>
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 max-h-[min(34rem,calc(100dvh-7rem))] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-xl">
          <div role="radiogroup" aria-label="Switch sesi" className="flex flex-col">
            {groups.map(({group, title}) => (
              <div key={group} className="flex flex-col gap-0.5">
                {title && <div className="mt-2.5 mb-1 px-2.5 text-[11px] font-medium tracking-wide text-faint uppercase">{title}</div>}
                {soundPacks
                  .filter((s) => s.group === group)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={sound === s.id}
                      onClick={() => choose(s)}
                      className={cx('flex flex-col rounded-lg px-2.5 py-1.5 text-left', sound === s.id ? 'bg-accent-soft' : 'hover:bg-surface-2')}
                    >
                      <span className={cx('text-[13px] font-medium', sound === s.id && 'text-accent')}>{s.label}</span>
                      <span className="text-[11.5px] text-faint">{s.hint}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div className="mt-1 flex flex-col gap-1.5 px-2.5">
            {customName && <div className="truncate text-xs text-muted" title={customName}>{customName}</div>}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" icon={<Upload size={14} />} onClick={() => input.current?.click()}>
                Ses dosyası yükle
              </Button>
              {customName && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X size={14} />}
                  onClick={() => {
                    setError(null);
                    void removeCustomSound();
                    if (sound === 'custom') void updateTypingSettings({switchSound: 'off'});
                  }}
                >
                  Kaldır
                </Button>
              )}
            </div>
            <input
              ref={input}
              type="file"
              accept="audio/*"
              aria-label="Tuş sesi dosyası yükle"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = '';
              }}
            />
            {error && (
              <div ref={alert} role="alert" className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
                {error}
              </div>
            )}
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
