import {useEffect, useState, type FormEvent} from 'react';
import {Cloud, CloudAlert, ExternalLink, KeyRound, RefreshCw, Unplug} from 'lucide-react';
import {toast} from '@/state/store';
import {connectCloud, disconnectCloud, syncNow, useCloud} from '@/sync/engine';
import {confirm} from '@/ui/components/Dialog';
import {Button, cx} from '@/ui/components/ui';

const REPO_NAME = 'klavye-studio-veri';
const newRepoUrl = `https://github.com/new?name=${REPO_NAME}&visibility=private&description=${encodeURIComponent('Klavye Stüdyo eşitleme verileri')}`;
const newTokenUrl = 'https://github.com/settings/personal-access-tokens/new';

const inputClass = 'h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent';

export const timeAgo = (ms: number, now = Date.now()) => {
  const minutes = Math.round((now - ms) / 60_000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dakika önce`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} saat önce`;
  return new Date(ms).toLocaleString('tr-TR', {dateStyle: 'medium', timeStyle: 'short'});
};

/** Re-renders now and then so "2 dakika önce" stays true. */
export const useMinuteTick = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
};

const ExternalButton = ({href, children}: {href: string; children: string}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] font-medium hover:border-border-strong hover:bg-surface-3"
  >
    {children} <ExternalLink size={13} />
  </a>
);

const ConnectForm = ({initialRepo = REPO_NAME, onDone}: {initialRepo?: string; onDone?: () => void}) => {
  const [repo, setRepo] = useState(initialRepo);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await connectCloud(repo, token);
      toast('Eşitleme açıldı; veriler GitHub’daki depoya eşitlendi.', 'success');
      onDone?.();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-1.5 flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <input value={repo} onChange={(e) => setRepo(e.target.value)} aria-label="Depo" placeholder="kullanıcı/depo" className={inputClass} />
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
          autoComplete="off"
          aria-label="Erişim anahtarı"
          placeholder="github_pat_…"
          className={cx(inputClass, 'font-mono')}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" size="sm" icon={<KeyRound size={14} />} disabled={busy}>
          {busy ? 'Bağlanıyor…' : 'Bağlan ve eşitle'}
        </Button>
        {error && (
          <span role="alert" className="text-[13px] text-danger">
            {error}
          </span>
        )}
      </div>
    </form>
  );
};

const Setup = () => (
  <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm marker:text-faint">
    <li>
      <div className="font-medium">GitHub’da gizli bir depo oluştur</div>
      <div className="text-muted">
        Adı <code className="text-fg">{REPO_NAME}</code>, görünürlüğü <b className="text-fg">Private</b> olsun.
      </div>
      <ExternalButton href={newRepoUrl}>Depo oluştur</ExternalButton>
    </li>
    <li>
      <div className="font-medium">Yalnızca bu depoya izinli bir anahtar oluştur</div>
      <div className="text-muted">
        Repository access: <b className="text-fg">Only select repositories</b> → {REPO_NAME}. Permissions → Repository permissions →{' '}
        <b className="text-fg">Contents: Read and write</b>. Süre için 1 yıl yeterli; dolunca uygulama haber verir.
      </div>
      <ExternalButton href={newTokenUrl}>Anahtar oluştur</ExternalButton>
    </li>
    <li>
      <div className="font-medium">Anahtarı buraya yapıştır</div>
      <ConnectForm />
      <div className="mt-2 text-xs text-faint">
        Anahtar yalnızca bu tarayıcıda saklanır ve sadece GitHub’a gönderilir. Her cihazda (telefon dahil) bir kez girmen yeterli; aynı anahtar kullanılabilir.
      </div>
    </li>
  </ol>
);

const Connected = () => {
  const {repo, phase, lastSync, error, blocked} = useCloud();
  const [changingToken, setChangingToken] = useState(false);
  useMinuteTick();
  const status = phase === 'syncing' ? 'Eşitleniyor…' : phase === 'error' ? 'Eşitlenemedi' : lastSync ? `Eşitlendi · ${timeAgo(lastSync)}` : 'Henüz eşitlenmedi';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cx('grid size-9 shrink-0 place-items-center rounded-lg', phase === 'error' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent')}>
            {phase === 'error' ? <CloudAlert size={18} /> : <Cloud size={18} />}
          </span>
          <div className="min-w-0">
            <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
              {repo}
            </a>
            <div className="text-[13px] text-muted" data-testid="cloud-status" data-last-sync={lastSync ?? ''}>
              {status}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={<RefreshCw size={14} className={phase === 'syncing' ? 'animate-spin' : undefined} />}
            disabled={phase === 'syncing'}
            onClick={() => void syncNow()}
          >
            Şimdi eşitle
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Unplug size={14} />}
            onClick={async () => {
              const ok = await confirm({
                title: 'Eşitleme kapatılsın mı?',
                body: 'Bu cihazdaki anahtar silinir. Veriler hem bu cihazda hem GitHub’daki depoda kalır; istediğinde yeniden bağlanabilirsin.',
                confirmLabel: 'Bağlantıyı kes',
              });
              if (ok) await disconnectCloud();
            }}
          >
            Bağlantıyı kes
          </Button>
        </div>
      </div>
      {phase === 'error' && error && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
          {blocked && !changingToken && (
            <button type="button" className="ml-2 font-medium underline" onClick={() => setChangingToken(true)}>
              Yeni anahtar gir
            </button>
          )}
        </div>
      )}
      {changingToken && repo && <ConnectForm initialRepo={repo} onDone={() => setChangingToken(false)} />}
    </div>
  );
};

export const CloudSyncSection = () => {
  const connected = useCloud((s) => s.repo !== null);
  return (
    <section className="rounded-xl border border-border bg-surface px-5 pb-5">
      <h2 className="pt-4 text-sm font-semibold">Cihazlar arası eşitleme</h2>
      <p className="mt-1 mb-4 max-w-2xl text-sm text-muted">
        Eylemlerin, tuş atamaların, yazı antrenmanın, ayarların, klavye tanımların ve yedeklerin senin GitHub hesabındaki gizli bir depoda tutulur;
        Windows, Mac ve telefon aynı verileri görür. Klavye düzeni ve işletim sistemi her cihazda kendi kalır.
      </p>
      {connected ? <Connected /> : <Setup />}
    </section>
  );
};
