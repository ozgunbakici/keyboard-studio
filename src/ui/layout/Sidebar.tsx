import {Archive, FileJson, FlaskConical, Keyboard, Lightbulb, Plus, Settings, Sparkles, Usb, Zap} from 'lucide-react';
import {useMemo, type ReactNode} from 'react';
import {hostLayouts} from '@/keycodes/host-layouts';
import {connectDemo, connectWebHid, selectSession, setPane} from '@/state/actions';
import {useStudio, type Pane, type SessionInfo} from '@/state/store';
import {cx} from '@/ui/components/ui';

const statusDot: Record<SessionInfo['status'], string> = {
  connecting: 'bg-macro animate-pulse',
  loading: 'bg-macro animate-pulse',
  'needs-definition': 'bg-macro',
  ready: 'bg-success',
  error: 'bg-danger',
  disconnected: 'bg-faint',
};

const statusText: Record<SessionInfo['status'], string> = {
  connecting: 'Bağlanıyor',
  loading: 'Okunuyor',
  'needs-definition': 'Tanım gerekli',
  ready: 'Hazır',
  error: 'Hata',
  disconnected: 'Bağlı değil',
};

const navItems: {pane: Pane; label: string; icon: ReactNode; needsKeyboard: boolean}[] = [
  {pane: 'keymap', label: 'Tuş haritası', icon: <Keyboard size={17} />, needsKeyboard: true},
  {pane: 'macros', label: 'Makrolar', icon: <Zap size={17} />, needsKeyboard: true},
  {pane: 'lighting', label: 'Işık ve ayarlar', icon: <Lightbulb size={17} />, needsKeyboard: true},
  {pane: 'tester', label: 'Tuş testi', icon: <FlaskConical size={17} />, needsKeyboard: true},
  {pane: 'backups', label: 'Yedekler', icon: <Archive size={17} />, needsKeyboard: false},
  {pane: 'definitions', label: 'Klavye tanımları', icon: <FileJson size={17} />, needsKeyboard: false},
  {pane: 'settings', label: 'Ayarlar', icon: <Settings size={17} />, needsKeyboard: false},
];

export const Sidebar = () => {
  const sessionMap = useStudio((s) => s.sessions);
  const sessions = useMemo(() => Object.values(sessionMap), [sessionMap]);
  const selectedId = useStudio((s) => s.selectedId);
  const pane = useStudio((s) => s.pane);
  const ready = useStudio((s) => (s.selectedId ? s.sessions[s.selectedId]?.status === 'ready' : false));
  const data = useStudio((s) => s.data);
  const settings = useStudio((s) => s.settings);
  const webHid = useStudio((s) => s.webHidSupported);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Keyboard size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold">Klavye Stüdyo</div>
          <div className="text-[11px] text-faint">VIA uyumlu yapılandırıcı</div>
        </div>
      </div>

      <div className="px-3">
        <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-faint uppercase">Klavyeler</div>
        <div className="flex flex-col gap-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => selectSession(session.id)}
              className={cx(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                selectedId === session.id ? 'bg-surface-3' : 'hover:bg-surface-2',
              )}
            >
              <span className={cx('h-2 w-2 shrink-0 rounded-full', statusDot[session.status])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{data[session.id]?.name ?? session.productName}</span>
                <span className="block truncate text-[11px] text-faint">
                  {session.kind === 'virtual' ? 'Sanal demo' : statusText[session.status]}
                  {session.protocol !== undefined ? ` · VIA v${session.protocol}` : ''}
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => void connectWebHid()}
            disabled={!webHid}
            className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-2.5 py-2 text-[13px] font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            title={webHid ? 'USB ile bağlı bir VIA klavye seç' : 'Bu tarayıcı WebHID desteklemiyor'}
          >
            {sessions.length ? <Plus size={15} /> : <Usb size={15} />} Klavye bağla
          </button>
          {!sessions.some((s) => s.kind === 'virtual') && (
            <button
              type="button"
              onClick={() => void connectDemo()}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-faint transition-colors hover:text-fg"
            >
              <Sparkles size={14} /> Demo klavyeyi aç
            </button>
          )}
        </div>
      </div>

      <nav className="mt-4 flex flex-col gap-0.5 px-3" aria-label="Bölümler">
        <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-faint uppercase">Bölümler</div>
        {navItems.map((item) => {
          const disabled = item.needsKeyboard && !ready;
          return (
            <button
              key={item.pane}
              type="button"
              disabled={disabled}
              onClick={() => setPane(item.pane)}
              aria-current={pane === item.pane ? 'page' : undefined}
              className={cx(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors disabled:opacity-35',
                pane === item.pane ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setPane('settings')}
        className="mt-auto flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-left text-[12px] text-faint transition-colors hover:text-fg"
        title="Bilgisayardaki klavye düzeni ve işletim sistemi"
      >
        <span>
          Düzen: <span className="font-semibold text-muted">{hostLayouts[settings.hostLayout].short}</span>
        </span>
        <span>{settings.os === 'mac' ? 'macOS' : 'Windows / Linux'}</span>
      </button>
    </aside>
  );
};
