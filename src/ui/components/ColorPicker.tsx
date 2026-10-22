import {Slider} from './ui';

/** QMK hue/saturation (0-255) to a CSS color at full brightness. */
export const hsToCss = (hue: number, sat: number) => {
  const h = (hue / 255) * 360;
  const s = sat / 255;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return 1 - s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to255 = (v: number) => Math.round(v * 255);
  return `rgb(${to255(f(5))} ${to255(f(3))} ${to255(f(1))})`;
};

const presets: [string, number, number][] = [
  ['Kırmızı', 0, 255],
  ['Turuncu', 21, 255],
  ['Sarı', 43, 255],
  ['Yeşil', 85, 255],
  ['Turkuaz', 128, 255],
  ['Mavi', 170, 255],
  ['Mor', 191, 255],
  ['Pembe', 234, 200],
  ['Beyaz', 0, 0],
];

export const ColorPicker = ({hue, sat, onChange}: {hue: number; sat: number; onChange: (hue: number, sat: number) => void}) => (
  <div className="flex w-full flex-col gap-3">
    <div className="flex items-center gap-3">
      <span className="h-9 w-9 shrink-0 rounded-lg border border-border-strong" style={{background: hsToCss(hue, sat)}} />
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([name, h, s]) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            onClick={() => onChange(h, s)}
            className="h-6 w-6 rounded-md border border-border-strong transition-transform hover:scale-110"
            style={{background: hsToCss(h, s)}}
          />
        ))}
      </div>
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">Renk tonu</span>
      <div
        className="h-2 rounded-full"
        style={{background: 'linear-gradient(90deg, red, yellow, lime, cyan, blue, magenta, red)'}}
        aria-hidden
      />
      <Slider value={hue} min={0} max={255} onChange={(h) => onChange(h, sat)} label="Renk tonu" />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">Doygunluk</span>
      <Slider value={sat} min={0} max={255} onChange={(s) => onChange(hue, s)} label="Doygunluk" />
    </div>
  </div>
);
