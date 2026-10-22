import {CheckCircle2, Info, TriangleAlert, X} from 'lucide-react';
import {setState, useStudio} from '@/state/store';
import {cx} from '@/ui/components/ui';

export const Toasts = () => {
  const toasts = useStudio((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100%-32px))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'animate-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 text-sm shadow-xl',
            t.kind === 'error' ? 'border-danger/50' : t.kind === 'success' ? 'border-success/40' : 'border-border',
          )}
        >
          {t.kind === 'error' ? (
            <TriangleAlert size={17} className="mt-0.5 shrink-0 text-danger" />
          ) : t.kind === 'success' ? (
            <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <Info size={17} className="mt-0.5 shrink-0 text-accent" />
          )}
          <span className="flex-1 text-fg">{t.text}</span>
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setState((s) => ({toasts: s.toasts.filter((x) => x.id !== t.id)}))}
            className="text-faint hover:text-fg"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
};
