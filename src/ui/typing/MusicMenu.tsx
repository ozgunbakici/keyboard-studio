import {useEffect, useRef} from 'react';
import {FolderOpen, Music, Plus, SkipBack, SkipForward} from 'lucide-react';
import {music, useMusic, type MusicStatus} from '@/typing/music';
import {updateTypingSettings, useTyping} from '@/typing/store';
import {Button, IconButton, Slider, Toggle, cx} from '@/ui/components/ui';
import {usePopover} from '@/ui/typing/usePopover';

const statusText = (status: MusicStatus, threshold: number, enabled: boolean, hasTracks: boolean) => {
  switch (status) {
    case 'playing':
      return 'Çalıyor';
    case 'ducked':
      return 'Kısıldı; hızlanınca geri gelir';
    case 'paused':
      return 'Durdu; hızlanınca devam eder';
    case 'waiting':
      return `Müzik için ${threshold} WPM’in üstüne çık`;
    case 'off':
      // Off has three causes; say which one the user can do something about.
      if (!enabled) return 'Müzik kapalı';
      return hasTracks ? 'Çalınamıyor; başka bir parçaya geç' : 'Çalmak için müzik dosyası ekle';
  }
};

/** Background music from the user's own files, gated by typing speed. */
export const MusicMenu = () => {
  const s = useTyping((st) => st.settings);
  const m = useMusic();
  const {open, setOpen, ref} = usePopover();
  const files = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void music.load();
  }, []);

  const {musicEnabled: enabled, musicThreshold: threshold, musicBelow: below, musicVolume: volume, musicShuffle: shuffle} = s;
  const hasTracks = m.tracks.length > 0;
  const needsFiles = enabled && !hasTracks && !m.needsPermission && m.loaded;
  const ratio = Math.min(1, (m.wpm ?? 0) / 120);

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Müzik"
        aria-expanded={open}
        data-status={m.status}
        title="Müzik: hızlı yazınca kendi dosyalarından müzik çalar"
        icon={
          <span className="relative">
            <Music size={15} className={cx(m.status === 'playing' && 'text-accent')} />
            {needsFiles && <span aria-hidden className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-accent" />}
          </span>
        }
        onClick={() => setOpen((o) => !o)}
      >
        {enabled && m.wpm !== null ? (
          <span className="hidden font-mono text-xs tabular-nums sm:inline">
            {m.wpm} / {threshold}
          </span>
        ) : (
          <span className="hidden sm:inline">Müzik</span>
        )}
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 max-h-[min(40rem,calc(100dvh-7rem))] w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">Hızlı yazınca müzik çal</div>
              <div className="text-[11.5px] text-faint">Hızın eşiğin üstünde kaldıkça kendi dosyalarından müzik çalar.</div>
            </div>
            <Toggle checked={enabled} onChange={(v) => void updateTypingSettings({musicEnabled: v})} label="Hızlı yazınca müzik çal" />
          </div>

          <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-2.5">
            {m.needsPermission && (
              <div className="flex flex-col gap-1.5 text-xs text-muted">
                <span>“{m.folderName}” klasörü için tarayıcı yeniden izin istiyor.</span>
                <Button size="sm" variant="primary" className="self-start" onClick={() => void music.reconnect()}>
                  İzin ver
                </Button>
              </div>
            )}
            {!hasTracks && !m.needsPermission && (
              <div className="text-xs text-muted">Dosyalar bu bilgisayarda kalır, hiçbir yere yüklenmez.</div>
            )}
            {hasTracks && (
              <div className="text-xs text-muted">
                <div className="truncate font-medium text-fg" title={m.folderName ?? undefined}>
                  {m.folderName ?? 'Bu oturum için seçilen dosyalar'}
                </div>
                {m.tracks.length} parça
                {m.sessionOnly && <div className="mt-0.5 text-faint">Bu dosyalar sayfa yenilenince gider.</div>}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {m.folderSupported && (
                <Button size="sm" icon={<FolderOpen size={14} />} onClick={() => void music.chooseFolder()}>
                  {hasTracks && m.folderName ? 'Klasörü değiştir' : 'Klasör seç'}
                </Button>
              )}
              <Button size="sm" icon={<Plus size={14} />} onClick={() => files.current?.click()}>
                Dosya ekle
              </Button>
              {(hasTracks || m.folderName) && (
                <Button size="sm" variant="ghost" onClick={() => void music.forget()}>
                  Unut
                </Button>
              )}
            </div>
            <input
              ref={files}
              type="file"
              multiple
              accept="audio/*"
              aria-label="Müzik dosyası ekle"
              className="hidden"
              onChange={(event) => {
                const picked = [...(event.target.files ?? [])];
                if (picked.length) void music.addFiles(picked);
                event.target.value = '';
              }}
            />
          </div>

          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Hız eşiği
            <Slider value={threshold} min={20} max={120} unit=" WPM" label="Hız eşiği" onChange={(v) => void updateTypingSettings({musicThreshold: v})} />
          </label>

          <div className="mt-3 text-xs text-muted">Eşiğin altında</div>
          <div role="radiogroup" aria-label="Eşiğin altında" className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5">
            {([['duck', 'Kısılsın'], ['pause', 'Dursun']] as const).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={below === id}
                onClick={() => void updateTypingSettings({musicBelow: id})}
                className={cx('rounded-md px-2 py-1 text-[13px] font-medium', below === id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg')}
              >
                {text}
              </button>
            ))}
          </div>

          <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
            Müzik sesi
            <Slider value={Math.round(volume * 100)} min={5} max={100} unit="%" label="Müzik sesi" onChange={(v) => void updateTypingSettings({musicVolume: v / 100})} />
          </label>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
            Karışık çal
            <Toggle checked={shuffle} onChange={(v) => void updateTypingSettings({musicShuffle: v})} label="Karışık çal" />
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1 truncate text-[13px] font-medium" title={m.current?.title}>
                {m.current?.title ?? 'Parça yok'}
              </div>
              <IconButton label="Önceki parça" disabled={!hasTracks} onClick={() => music.previous()}>
                <SkipBack size={15} />
              </IconButton>
              <IconButton label="Sonraki parça" disabled={!hasTracks} onClick={() => music.next()}>
                <SkipForward size={15} />
              </IconButton>
            </div>
            <div className="mt-0.5 text-xs text-muted" aria-live="polite">
              {statusText(m.status, threshold, enabled, hasTracks)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div
                role="meter"
                aria-label="Yazma hızı"
                aria-valuemin={0}
                aria-valuemax={120}
                aria-valuenow={m.wpm ?? 0}
                className="relative h-2 flex-1 rounded-full bg-surface-3"
              >
                <div className={cx('h-full rounded-full', (m.wpm ?? 0) >= threshold ? 'bg-success' : 'bg-accent')} style={{width: `${ratio * 100}%`}} />
                <div className="absolute -top-0.5 h-3 w-0.5 rounded bg-fg" style={{left: `${Math.min(1, threshold / 120) * 100}%`}} />
              </div>
              <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{m.wpm ?? '–'} / {threshold} WPM</span>
            </div>
          </div>

          {m.error && (
            <div role="alert" className="mt-3 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
              {m.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
