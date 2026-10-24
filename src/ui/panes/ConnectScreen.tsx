import {AlertTriangle, FileJson, GraduationCap, Loader2, ShieldCheck, Sparkles, Usb} from 'lucide-react';
import {connectDemo, connectWebHid, provideDefinitionFile, reloadSession, setPane} from '@/state/actions';
import type {SessionInfo} from '@/state/store';
import {useStudio} from '@/state/store';
import {Button, FileButton, Kbd} from '@/ui/components/ui';

const udevRule = 'KERNEL=="hidraw*", SUBSYSTEM=="hidraw", TAG+="uaccess"';
const udevReload = 'sudo udevadm control --reload-rules && sudo udevadm trigger';

export const WelcomeScreen = () => {
  const webHid = useStudio((s) => s.webHidSupported);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
          <Sparkles size={13} /> VIA uyumlu · tarayıcıda çalışır
        </span>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Klavyeni bağla, her şeyi buradan ayarla.</h2>
        <p className="text-[15px] leading-relaxed text-muted">
          Tuş haritası, katmanlar, knob, ışıklar ve makrolar doğrudan klavyenin hafızasına yazılır. Ayarlar klavyede kalır; bilgisayarı
          değiştirsen de çalışır. Firmware’e dokunulmaz.
        </p>
      </div>

      {!webHid && (
        <div className="flex gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-danger" />
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-fg">Bu tarayıcı klavye ayarlarına bağlanamıyor.</p>
            <p className="text-muted">
              Klavye ayarı için gereken WebHID yalnızca bilgisayardaki Chrome, Edge ve diğer Chromium tabanlı tarayıcılarda var; Firefox, Safari ve
              telefon tarayıcıları desteklemiyor. Yazı antrenmanı ve demo klavye burada da çalışır: telefona taktığın klavyeyle yazabilirsin.
            </p>
            <div>
              <Button size="sm" icon={<GraduationCap size={14} />} onClick={() => setPane('typing')}>
                Yazı antrenmanına git
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void connectWebHid()}
          disabled={!webHid}
          className="flex flex-col items-start gap-2 rounded-2xl border border-accent/40 bg-accent-soft p-5 text-left transition-colors hover:border-accent disabled:opacity-40"
        >
          <Usb size={22} className="text-accent" />
          <span className="text-base font-semibold">USB klavyeyi bağla</span>
          <span className="text-sm text-muted">Açılan pencereden klavyeni seç. Bir kez izin verince sonraki açılışlarda otomatik bağlanır.</span>
        </button>
        <button
          type="button"
          onClick={() => void connectDemo()}
          className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:border-border-strong"
        >
          <Sparkles size={22} className="text-macro" />
          <span className="text-base font-semibold">Demo klavyeyle dene</span>
          <span className="text-sm text-muted">Gerçek klavye olmadan her özelliği dene. Tamamen sanal; hiçbir şey kaydedilmez.</span>
        </button>
      </div>


      <div className="grid gap-4 text-sm text-muted sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-fg">Kablo ile bağla</span>
          Ayar yaparken USB kablosu kullan; çoğu klavye Bluetooth’ta bu arayüzü açmaz.
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-fg">Tek uygulama</span>
          usevia.app veya başka bir yapılandırıcı açıksa kapat; klavyeyle aynı anda tek uygulama konuşabilir.
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
            <ShieldCheck size={15} /> Gizlilik
          </span>
          Hiçbir veri sunucuya gitmez. Tanımlar, yedekler ve ayarlar bu tarayıcıda saklanır.
        </div>
      </div>

      <details className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <summary className="cursor-pointer font-semibold text-fg">Linux’ta klavye listede görünmüyor mu?</summary>
        <p className="mt-2">
          Tarayıcının hidraw cihazlarına erişmesi için bir udev kuralı gerekir. <Kbd>/etc/udev/rules.d/70-klavye-studio.rules</Kbd> dosyasına
          şunu ekle, kuralları yeniden yükle ve klavyeyi çıkarıp tak:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs text-fg">{udevRule}</pre>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs text-fg">{udevReload}</pre>
      </details>
    </div>
  );
};

export const SessionStateScreen = ({session}: {session: SessionInfo}) => {
  const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;

  if (session.status === 'connecting' || session.status === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
        <Loader2 size={28} className="animate-spin text-accent" />
        <span className="text-sm">{session.progress ?? 'Bekleniyor'}…</span>
      </div>
    );
  }

  if (session.status === 'needs-definition') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-6 py-14">
        <FileJson size={30} className="text-macro" />
        <h2 className="text-2xl font-semibold">Bu klavye için tanım dosyası gerekiyor</h2>
        <p className="text-[15px] leading-relaxed text-muted">
          <span className="font-semibold text-fg">{session.productName}</span> VIA’nın listesinde yok. Üreticinin verdiği VIA JSON dosyasını
          (genelde ürün sayfasında “VIA JSON” olarak geçer) bir kez yükle; uygulama bu klavyeyi kalıcı olarak hatırlar.
        </p>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-4 font-mono text-xs text-muted">
          <span>vendorId</span>
          <span className="text-fg">{hex(session.vendorId)}</span>
          <span>productId</span>
          <span className="text-fg">{hex(session.productId)}</span>
          <span>VIA protokolü</span>
          <span className="text-fg">{session.protocol ?? '—'}</span>
        </div>
        <p className="text-sm text-muted">JSON dosyasındaki vendorId ve productId bu değerlerle aynı olmalı.</p>
        <div>
          <FileButton accept=".json,application/json" variant="primary" icon={<FileJson size={16} />} onFile={(file) => void provideDefinitionFile(session.id, file)}>
            JSON dosyası seç
          </FileButton>
        </div>
      </div>
    );
  }

  if (session.status === 'error') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-6 py-14">
        <AlertTriangle size={30} className="text-danger" />
        <h2 className="text-2xl font-semibold">Klavyeyle konuşulamadı</h2>
        <p className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger">{session.error}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>usevia.app veya başka bir yapılandırıcı açıksa kapat.</li>
          <li>Klavyeyi kablo ile bağla ve kablolu moda al.</li>
          <li>Çıkarıp yeniden takmayı dene.</li>
          <li>Klavyenin firmware’i VIA desteklemiyor olabilir.</li>
        </ul>
        <div>
          <Button variant="primary" onClick={() => void reloadSession(session.id)}>
            Tekrar dene
          </Button>
        </div>
      </div>
    );
  }
  return null;
};
