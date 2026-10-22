import {useEffect, useRef, type ReactNode} from 'react';
import {create} from 'zustand';
import {Button} from './ui';

/** Native <dialog> wrapper: focus trapping and Esc handling come for free. */
export const Dialog = ({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100%-32px)] ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border border-border bg-surface p-0 text-fg shadow-2xl backdrop:bg-black/60`}
    >
      {open && (
        <div className="flex flex-col">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
          </header>
          <div className="px-5 py-4 text-sm text-muted">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
};

type ConfirmRequest = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

const useConfirmStore = create<{request: ConfirmRequest | null}>(() => ({request: null}));

/** Promise based confirmation dialog: `if (await confirm({...})) ...` */
export const confirm = (options: Omit<ConfirmRequest, 'resolve'>) =>
  new Promise<boolean>((resolve) => useConfirmStore.setState({request: {...options, resolve}}));

export const ConfirmHost = () => {
  const request = useConfirmStore((s) => s.request);
  const finish = (ok: boolean) => {
    request?.resolve(ok);
    useConfirmStore.setState({request: null});
  };
  return (
    <Dialog
      open={!!request}
      onClose={() => finish(false)}
      title={request?.title ?? ''}
      footer={
        <>
          <Button variant="ghost" onClick={() => finish(false)}>
            Vazgeç
          </Button>
          <Button variant={request?.danger ? 'danger' : 'primary'} onClick={() => finish(true)}>
            {request?.confirmLabel}
          </Button>
        </>
      }
    >
      {request?.body}
    </Dialog>
  );
};
