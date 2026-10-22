import {useState} from 'react';
import {Lightbulb} from 'lucide-react';
import {
  decodeRange,
  dropdownOptions,
  encodeRange,
  isVisible,
  matchesValue,
  toggleValues,
  type MenuControl,
} from '@/definitions/menus';
import {keyLabel} from '@/keycodes/labels';
import {from16, to16} from '@/lib/bytes';
import {setMenuValue} from '@/state/actions';
import {useSelectedData, useSelectedSession} from '@/state/store';
import {ColorPicker} from '@/ui/components/ColorPicker';
import {Dialog} from '@/ui/components/Dialog';
import {Button, EmptyState, Select, Slider, Toggle} from '@/ui/components/ui';
import {useLabelContext} from '@/ui/hooks';
import {KeycodePicker} from '@/ui/picker/KeycodePicker';

// VIA's built-in menus are in English; translate the common labels.
const translations: Record<string, string> = {
  Lighting: 'Işık',
  Backlight: 'Arka ışık',
  Underglow: 'Alt ışık',
  Brightness: 'Parlaklık',
  Effect: 'Efekt',
  'Effect Speed': 'Efekt hızı',
  Color: 'Renk',
  'Color 1': 'Renk 1',
  'Color 2': 'Renk 2',
  Breathing: 'Nefes efekti',
  Audio: 'Ses',
  'Enable Audio': 'Ses açık',
  'Enable Audio Clicky': 'Tık sesi',
  'All Off': 'Kapalı',
  'Solid Color': 'Düz renk',
  'Alphas Mods': 'Harf / değiştirici renkleri',
  'Gradient Up/Down': 'Gradyan yukarı/aşağı',
  'Gradient Left/Right': 'Gradyan sol/sağ',
  'Cycle All': 'Renk döngüsü',
  'Cycle Left/Right': 'Döngü sol/sağ',
  'Cycle Up/Down': 'Döngü yukarı/aşağı',
  Raindrops: 'Yağmur damlaları',
  'Typing Heatmap': 'Yazma ısı haritası',
  'Digital Rain': 'Dijital yağmur',
  'Solid Reactive Simple': 'Basınca yanan (sade)',
  'Solid Reactive': 'Basınca yanan',
  Splash: 'Sıçrama',
  'Multi Splash': 'Çoklu sıçrama',
};
const tr = (label: string) => translations[label] ?? label;

const KeycodeControl = ({control, value}: {control: MenuControl; value: number[]}) => {
  const ctx = useLabelContext();
  const [open, setOpen] = useState(false);
  const keycode = to16(value[0] ?? 0, value[1] ?? 0);
  const label = keyLabel(keycode, ctx);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {label.main || label.code}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tr(control.label)} wide>
        <div className="h-[60vh] overflow-hidden rounded-lg border border-border">
          <KeycodePicker
            currentValue={keycode}
            onPick={(next) => {
              void setMenuValue(control.command!, from16(next));
              setOpen(false);
            }}
          />
        </div>
      </Dialog>
    </>
  );
};

const decodeText = (value?: number[]) => {
  if (!value?.length) return '';
  const end = value.indexOf(0);
  return new TextDecoder().decode(new Uint8Array(end === -1 ? value : value.slice(0, end)));
};

const Control = ({control, values}: {control: MenuControl; values: Record<string, number[]>}) => {
  const command = control.command;
  const value = command ? values[command[0]] : undefined;
  const unavailable = command && !value;

  const render = () => {
    if (unavailable) return <span className="text-xs text-faint">Klavye bu ayarı bildirmiyor</span>;
    switch (control.type) {
      case 'range': {
        const [min, max] = (control.options as [number, number]) ?? [0, 255];
        return (
          <Slider
            value={decodeRange(value, max)}
            min={min}
            max={max}
            unit={control.unit}
            label={tr(control.label)}
            onChange={(v) => void setMenuValue(command!, encodeRange(v, max))}
          />
        );
      }
      case 'dropdown': {
        const options = dropdownOptions(control.options);
        const selected = options.findIndex((o) => matchesValue(o.value, value));
        return (
          <Select
            value={selected}
            label={tr(control.label)}
            className="w-full max-w-xs"
            onChange={(i) => void setMenuValue(command!, options[i].value)}
            options={[
              ...(selected === -1 ? [{value: -1, label: `Bilinmeyen (${value?.[0]})`}] : []),
              ...options.map((o, i) => ({value: i, label: tr(o.label)})),
            ]}
          />
        );
      }
      case 'toggle': {
        const [off, on] = toggleValues(control.options);
        return <Toggle checked={matchesValue(on, value)} label={tr(control.label)} onChange={(v) => void setMenuValue(command!, v ? on : off)} />;
      }
      case 'color':
        return <ColorPicker hue={value?.[0] ?? 0} sat={value?.[1] ?? 0} onChange={(h, s) => void setMenuValue(command!, [h, s])} />;
      case 'keycode':
        return <KeycodeControl control={control} value={value ?? [0, 0]} />;
      case 'button': {
        const [press] = (control.options as [number] | undefined) ?? [1];
        return (
          <Button size="sm" onClick={() => void setMenuValue(command!, [press])}>
            Çalıştır
          </Button>
        );
      }
      case 'label':
        return <span className="text-sm text-muted">{control.text ?? decodeText(value)}</span>;
      case 'text':
        return <span className="text-sm text-muted">{control.text}</span>;
      case 'color-palette':
        return <span className="text-xs text-faint">Tuş başına renk düzenleme henüz desteklenmiyor.</span>;
    }
  };

  return (
    <div className="grid items-center gap-2 border-b border-border py-3 last:border-0 sm:grid-cols-[220px_1fr]">
      <span className="text-sm font-medium text-fg">{tr(control.label)}</span>
      <div className="flex min-w-0 items-center">{render()}</div>
    </div>
  );
};

export const LightingPane = () => {
  const data = useSelectedData();
  const session = useSelectedSession();
  if (!data || !session) return null;
  const {menus, menuValues} = data;
  const visibleMenus = menus.filter((menu) => isVisible(menu.conditions, menuValues));

  if (!visibleMenus.length) {
    return (
      <EmptyState icon={<Lightbulb size={30} />} title="Bu klavyede ayarlanabilir ışık yok">
        {(session.protocol ?? 0) < 11
          ? 'Bu firmware eski VIA protokolünü kullanıyor; ışık menüleri yalnızca VIA v11 ve üzeri için destekleniyor.'
          : 'Klavyenin tanım dosyası herhangi bir ayar menüsü içermiyor.'}
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-5">
      {visibleMenus.map((menu) => (
        <section key={menu.key} className="rounded-xl border border-border bg-surface">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{tr(menu.label)}</h2>
          <div className="flex flex-col gap-2 px-5 py-2">
            {menu.pages
              .filter((page) => isVisible(page.conditions, menuValues))
              .map((page) => (
                <div key={page.key} className="py-2">
                  {menu.pages.length > 1 && <h3 className="mb-1 text-[12px] font-semibold tracking-wide text-faint uppercase">{tr(page.label)}</h3>}
                  {page.controls
                    .filter((control) => isVisible(control.conditions, menuValues))
                    .map((control) => (
                      <Control key={control.key} control={control} values={menuValues} />
                    ))}
                </div>
              ))}
          </div>
        </section>
      ))}
      <p className="text-xs text-faint">Değişiklikler anında uygulanır ve kısa bir süre sonra klavyenin hafızasına kaydedilir.</p>
    </div>
  );
};
