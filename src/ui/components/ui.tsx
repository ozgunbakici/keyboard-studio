import {type ButtonHTMLAttributes, type ReactNode, useId, useRef} from 'react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
export {cx};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
};

export const Button = ({variant = 'secondary', size = 'md', icon, className, children, ...props}: ButtonProps) => (
  <button
    type="button"
    {...props}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-45',
      size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
      variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent-strong',
      variant === 'secondary' && 'border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-surface-3',
      variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-fg',
      variant === 'danger' && 'border border-danger/40 bg-danger-soft text-danger hover:border-danger',
      className,
    )}
  >
    {icon}
    {children}
  </button>
);

export const IconButton = ({label, className, children, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {label: string}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    {...props}
    className={cx(
      'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40',
      className,
    )}
  >
    {children}
  </button>
);

export const Toggle = ({checked, onChange, label, disabled}: {checked: boolean; onChange: (value: boolean) => void; label?: string; disabled?: boolean}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cx(
      'relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-40',
      checked ? 'border-accent bg-accent' : 'border-border-strong bg-surface-3',
    )}
  >
    <span
      className={cx(
        'absolute top-0.5 left-0 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-[22px]' : 'translate-x-0.5',
      )}
    />
  </button>
);

export const Select = <T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: {value: T; label: string}[];
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) => (
  <select
    aria-label={label}
    value={String(value)}
    onChange={(event) => {
      const option = options.find((o) => String(o.value) === event.target.value);
      if (option) onChange(option.value);
    }}
    className={cx(
      'h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-fg outline-none hover:border-border-strong focus:border-accent',
      className,
    )}
  >
    {options.map((option) => (
      <option key={String(option.value)} value={String(option.value)}>
        {option.label}
      </option>
    ))}
  </select>
);

export const Slider = ({
  value,
  min,
  max,
  onChange,
  label,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
}) => (
  <div className="flex w-full items-center gap-3">
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer"
    />
    <span className="w-14 shrink-0 text-right font-mono text-xs text-muted tabular-nums">
      {value}
      {unit ?? ''}
    </span>
  </div>
);

export const Panel = ({title, actions, children, className}: {title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string}) => (
  <section className={cx('rounded-xl border border-border bg-surface', className)}>
    {(title || actions) && (
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </header>
    )}
    <div className="p-4">{children}</div>
  </section>
);

export const Badge = ({children, tone = 'neutral'}: {children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'macro' | 'layer'}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
      tone === 'neutral' && 'bg-surface-3 text-muted',
      tone === 'accent' && 'bg-accent-soft text-accent',
      tone === 'success' && 'bg-success/15 text-success',
      tone === 'danger' && 'bg-danger-soft text-danger',
      tone === 'macro' && 'bg-macro-soft text-macro',
      tone === 'layer' && 'bg-layer-soft text-layer',
    )}
  >
    {children}
  </span>
);

export const Kbd = ({children}: {children: ReactNode}) => (
  <kbd className="rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>
);

export const Field = ({label, hint, children}: {label: string; hint?: ReactNode; children: ReactNode}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5" id={id}>
      <span className="text-[13px] font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
};

/** Hidden file input with a button trigger. */
export const FileButton = ({
  accept,
  onFile,
  children,
  variant = 'secondary',
  icon,
}: {
  accept: string;
  onFile: (file: File) => void;
  children: ReactNode;
  variant?: ButtonProps['variant'];
  icon?: ReactNode;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <Button variant={variant} icon={icon} onClick={() => ref.current?.click()}>
        {children}
      </Button>
    </>
  );
};

export const EmptyState = ({icon, title, children}: {icon?: ReactNode; title: string; children?: ReactNode}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
    {icon && <div className="text-faint">{icon}</div>}
    <h3 className="text-base font-semibold">{title}</h3>
    {children && <div className="max-w-md text-sm text-muted">{children}</div>}
  </div>
);

export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const slug = (text: string) =>
  text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u'})[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
