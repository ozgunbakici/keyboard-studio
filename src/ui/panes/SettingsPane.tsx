import {useState} from 'react';
import {Wand2} from 'lucide-react';
import {detectHostLayout, hostLayoutList, hostLayouts} from '@/keycodes/host-layouts';
import {updateSettings} from '@/state/actions';
import {toast, useStudio} from '@/state/store';
import {Button, Field, Select, Toggle} from '@/ui/components/ui';

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
              const detected = await detectHostLayout();
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
      </section>

      <p className="px-1 text-xs leading-relaxed text-faint">
        Klavye Stüdyo, VIA protokolüyle konuşur ve VIA’nın açık kaynak tanım paketini, keycode tablolarını ve tanım okuyucusunu kullanır (GPL-3.0).
        Tüm veriler bu tarayıcıda saklanır.
      </p>
    </div>
  );
};
