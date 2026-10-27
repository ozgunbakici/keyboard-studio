import {useRef, useState, type ReactNode} from 'react';
import {ImagePlus, Trash2, Wand2} from 'lucide-react';
import {photoIds, photos} from '@/assets/backgrounds';
import {detectHostLayout, hostLayoutList, hostLayouts} from '@/keycodes/host-layouts';
import {removeCustomBackground, setCustomBackground, useAppearance} from '@/state/appearance';
import {updateSettings} from '@/state/actions';
import {toast, useStudio, type Settings} from '@/state/store';
import {Button, Field, Select, Slider, Toggle, cx} from '@/ui/components/ui';

const Choice = ({label, active, onClick, children}: {label: string; active: boolean; onClick: () => void; children: ReactNode}) => (
  <button type="button" onClick={onClick} aria-pressed={active} className="group flex w-36 flex-col gap-1.5 text-left">
    <span
      className={cx(
        'relative block aspect-[3/2] w-full overflow-hidden rounded-lg border-2 transition-colors',
        active ? 'border-accent' : 'border-border group-hover:border-border-strong',
      )}
    >
      {children}
    </span>
    <span className={cx('text-[13px] font-medium', active ? 'text-fg' : 'text-muted')}>{label}</span>
  </button>
);

/** A few keycaps drawn in a key theme, independent of the one in use. */
const KeycapPreview = ({theme}: {theme: Settings['keyTheme']}) => {
  const cap = (kind: 'alpha' | 'mod' | 'accent', text: string, wide = false) => (
    <span
      className={cx('flex h-7 items-center justify-center rounded-[5px] text-[11px] font-semibold', wide ? 'w-11' : 'w-7')}
      style={{background: `var(--key-${kind})`, color: `var(--key-${kind}-fg)`, boxShadow: '0 2px 0 var(--key-edge)'}}
    >
      {text}
    </span>
  );
  return (
    <span aria-hidden data-keys={theme} className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-1 p-2" style={{background: 'var(--plate)'}}>
      {cap('accent', 'Esc')}
      {cap('alpha', 'Q')}
      {cap('alpha', 'W')}
      {cap('mod', 'Tab', true)}
      {cap('alpha', 'A')}
      {cap('accent', '↵')}
    </span>
  );
};

const BackgroundSettings = ({settings}: {settings: Settings}) => {
  const customUrl = useAppearance((s) => s.customUrl);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (file: File) => {
    try {
      await setCustomBackground(file);
      await updateSettings({background: 'custom'});
      toast('Arka plan resmi yüklendi.', 'success');
    } catch {
      toast('Bu resim açılamadı. JPEG, PNG ya da WebP bir dosya dene.', 'error', 6000);
    }
  };
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4">
      <div>
        <div className="text-sm font-medium">Arka plan</div>
        <div className="mt-0.5 max-w-xl text-sm text-muted">
          Uygulamanın arkasında düz renk, hazır fotoğraf ya da kendi yüklediğin bir resim. Yüklediğin resim yalnızca bu tarayıcıda kalır.
        </div>
      </div>
      <div role="group" aria-label="Arka plan" className="flex flex-wrap gap-3">
        <Choice label="Düz" active={settings.background === 'plain'} onClick={() => void updateSettings({background: 'plain'})}>
          <span className="absolute inset-0" style={{background: 'var(--bg)'}} />
        </Choice>
        {photoIds.map((id) => (
          <Choice
            key={id}
            label={photos[id].label}
            active={settings.background === id}
            // A photo brings its keycap colours and darkening; both can be changed again.
            onClick={() => void updateSettings({background: id, keyTheme: id, backgroundDim: photos[id].dim})}
          >
            <img src={photos[id].thumb} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </Choice>
        ))}
        <Choice
          label="Kendi resmim"
          active={settings.background === 'custom'}
          onClick={() => (customUrl ? void updateSettings({background: 'custom'}) : input.current?.click())}
        >
          {customUrl ? (
            <img src={customUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-faint">
              <ImagePlus size={20} />
              <span className="text-[11px]">Resim yükle</span>
            </span>
          )}
        </Choice>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label="Arka plan resmi yükle"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<ImagePlus size={14} />} onClick={() => input.current?.click()}>
          {customUrl ? 'Başka resim yükle' : 'Resim yükle'}
        </Button>
        {customUrl && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 size={14} />}
            onClick={async () => {
              await removeCustomBackground();
              if (settings.background === 'custom') await updateSettings({background: 'plain'});
            }}
          >
            Yüklenen resmi kaldır
          </Button>
        )}
      </div>
      {settings.background !== 'plain' && (
        <div className="grid max-w-xl gap-x-6 gap-y-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Karartma
            <Slider value={Math.round(settings.backgroundDim * 100)} min={0} max={85} unit="%" label="Karartma" onChange={(v) => void updateSettings({backgroundDim: v / 100})} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Bulanıklık
            <Slider value={settings.backgroundBlur} min={0} max={16} unit=" px" label="Bulanıklık" onChange={(backgroundBlur) => void updateSettings({backgroundBlur})} />
          </label>
        </div>
      )}
    </div>
  );
};

const Row = ({title, description, children}: {title: string; description?: string; children: React.ReactNode}) => (
  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4 last:border-0">
    <div className="max-w-xl">
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
    </div>
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

export const SettingsPane = () => {
  const settings = useStudio((s) => s.settings);
  const [detecting, setDetecting] = useState(false);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-5">
      <section className="rounded-xl border border-border bg-surface px-5">
        <h2 className="pt-4 text-sm font-semibold">Bilgisayar</h2>
        <Row
          title="Bilgisayardaki klavye düzeni"
          description="Tuş etiketleri ve makro metinleri bu düzene göre gösterilir ve çevrilir. Klavyenin kendisinde düzen ayarı yoktur; harfi bilgisayar belirler."
        >
          <Select
            value={settings.hostLayout}
            label="Klavye düzeni"
            onChange={(hostLayout) => void updateSettings({hostLayout, hostLayoutAuto: false})}
            options={hostLayoutList.map((l) => ({value: l.id, label: l.label}))}
          />
          <Button
            size="sm"
            icon={<Wand2 size={14} />}
            disabled={detecting}
            onClick={async () => {
              setDetecting(true);
              const detected = await detectHostLayout(settings.os);
              setDetecting(false);
              if (detected) {
                await updateSettings({hostLayout: detected, hostLayoutAuto: true});
                toast(`Algılandı: ${hostLayouts[detected].label}`, 'success');
              } else {
                toast('Düzen algılanamadı (tarayıcı izin vermedi ya da düzen tanınmadı). Listeden seç.', 'info', 6000);
              }
            }}
          >
            Algıla
          </Button>
        </Row>
        <Row title="İşletim sistemi" description="Kısayol önerileri (Ctrl / ⌘) ve tuş adları buna göre gösterilir.">
          <Select
            value={settings.os}
            label="İşletim sistemi"
            onChange={(os) => void updateSettings({os, osAuto: false})}
            options={[
              {value: 'other', label: 'Windows / Linux'},
              {value: 'mac', label: 'macOS'},
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <Toggle checked={settings.osAuto} onChange={(osAuto) => void updateSettings({osAuto})} label="Otomatik algıla" />
            Otomatik
          </label>
        </Row>
      </section>

      <section className="rounded-xl border border-border bg-surface px-5">
        <h2 className="pt-4 text-sm font-semibold">Çalışma şekli</h2>
        <Row
          title="Klavyeleri bu bilgisayara göre eşitle"
          description="Kütüphaneden atanan tuşlar, klavye bağlanınca ve işletim sistemi ya da düzen değişince bu bilgisayara göre yeniden yazılır (ör. Kopyala: Windows’ta Ctrl+C, Mac’te ⌘C)."
        >
          <Toggle checked={settings.autoSync} onChange={(autoSync) => void updateSettings({autoSync})} label="Otomatik eşitle" />
        </Row>
        <Row title="Atamadan sonra sonraki tuşa geç" description="Bir tuşa keycode atayınca seçim otomatik olarak sıradaki tuşa ilerler; hızlı düzenleme için.">
          <Toggle checked={settings.advanceSelection} onChange={(advanceSelection) => void updateSettings({advanceSelection})} label="Sonraki tuşa geç" />
        </Row>
        <Row title="Seçilen klavyenin ışıklarını yak" description="Birden çok klavye bağlıyken hangisini düzenlediğini görmek için ışıklar kısa bir süre yanıp söner.">
          <Toggle checked={settings.blinkOnSelect} onChange={(blinkOnSelect) => void updateSettings({blinkOnSelect})} label="Işıkla göster" />
        </Row>
      </section>

      <section className="rounded-xl border border-border bg-surface px-5">
        <h2 className="pt-4 text-sm font-semibold">Görünüm</h2>
        <Row title="Tema">
          <Field label="">
            <Select
              value={settings.theme}
              label="Tema"
              onChange={(theme) => void updateSettings({theme})}
              options={[
                {value: 'dark', label: 'Koyu'},
                {value: 'light', label: 'Açık'},
                {value: 'system', label: 'Sistemle aynı'},
              ]}
            />
          </Field>
        </Row>
        <BackgroundSettings settings={settings} />
        <div className="flex flex-col gap-3 py-4">
          <div>
            <div className="text-sm font-medium">Tuş renkleri</div>
            <div className="mt-0.5 max-w-xl text-sm text-muted">Ekrandaki klavye çizimlerinin renkleri. Bir fotoğraf seçince ona uygun renkler gelir; buradan yine değiştirebilirsin.</div>
          </div>
          <div role="group" aria-label="Tuş renkleri" className="flex flex-wrap gap-3">
            {(
              [
                ['default', 'Varsayılan'],
                ['sakura', 'Sakura'],
                ['mordor', 'Mordor'],
              ] as const
            ).map(([theme, label]) => (
              <Choice key={theme} label={label} active={settings.keyTheme === theme} onClick={() => void updateSettings({keyTheme: theme})}>
                <KeycapPreview theme={theme} />
              </Choice>
            ))}
          </div>
        </div>
      </section>

      <p className="px-1 text-xs leading-relaxed text-faint">
        Klavye Stüdyo, VIA protokolüyle konuşur ve VIA’nın açık kaynak tanım paketini, keycode tablolarını ve tanım okuyucusunu kullanır (GPL-3.0).
        Tüm veriler bu tarayıcıda saklanır.
      </p>
    </div>
  );
};
