import {useEffect, useMemo, useRef, useState} from 'react';
import {RotateCcw} from 'lucide-react';
import {visibleKeys, type RenderKey} from '@/definitions/geometry';
import {domCodeToKeycode} from '@/keycodes/dom-codes';
import {keyLabel} from '@/keycodes/labels';
import {pressedFromMatrix} from '@/via/api';
import {getController, readMatrix} from '@/state/actions';
import {useSelectedData, useSelectedSession} from '@/state/store';
import {Badge, Button} from '@/ui/components/ui';
import {useLabelContext} from '@/ui/hooks';
import {KeyboardView} from '@/ui/keyboard/KeyboardView';
import {VirtualTransport} from '@/emulator/virtual-keyboard';

type LogEntry = {id: number; code: string; key: string; at: number};

export const TesterPane = () => {
  const data = useSelectedData();
  const session = useSelectedSession();
  const ctx = useLabelContext();
  const [matrixPressed, setMatrixPressed] = useState<Set<string>>(new Set());
  const [eventPressed, setEventPressed] = useState<Set<string>>(new Set());
  const [tested, setTested] = useState<Set<string>>(new Set());
  const [matrixSeen, setMatrixSeen] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logId = useRef(0);

  const keys = useMemo(() => (data ? visibleKeys(data.definition, data.layoutOptions) : []), [data]);
  const cols = data?.matrix.cols ?? 1;

  // Poll the switch matrix (works on firmware built with VIA_INSECURE).
  useEffect(() => {
    if (!session || !data) return;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        try {
          const flat = await readMatrix(session.id);
          if (!flat) break;
          const pressed = pressedFromMatrix(flat, data.matrix);
          if (pressed.size) {
            setMatrixSeen(true);
            setTested((t) => (([...pressed].every((p) => t.has(p)) ? t : new Set([...t, ...pressed]))));
          }
          setMatrixPressed((prev) => (prev.size === pressed.size && [...pressed].every((p) => prev.has(p)) ? prev : pressed));
        } catch {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [session?.id, data?.matrix, session, data]);

  // Map OS key events to matrix positions through layer 0 of the keymap.
  useEffect(() => {
    if (!data) return;
    const positionsFor = (code: string) => {
      const name = domCodeToKeycode[code];
      const value = name ? ctx.codec.parse(name) : null;
      if (value === null) return [];
      return keys.filter((k) => k.hasMatrix && data.keymap[0][k.row * cols + k.col] === value).map((k) => `${k.row},${k.col}`);
    };
    const down = (event: KeyboardEvent) => {
      event.preventDefault();
      const positions = positionsFor(event.code);
      setEventPressed((p) => new Set([...p, ...positions]));
      if (positions.length) setTested((t) => new Set([...t, ...positions]));
      if (!event.repeat) {
        setLog((l) => [{id: ++logId.current, code: event.code, key: event.key, at: Date.now()}, ...l].slice(0, 12));
      }
    };
    const up = (event: KeyboardEvent) => {
      event.preventDefault();
      const positions = positionsFor(event.code);
      setEventPressed((p) => new Set([...p].filter((x) => !positions.includes(x))));
    };
    const blur = () => setEventPressed(new Set());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [data, keys, cols, ctx.codec]);

  if (!data || !session) return null;
  const pressed = new Set([...matrixPressed, ...eventPressed]);
  const testable = keys.filter((k) => k.hasMatrix);
  const doneCount = testable.filter((k) => tested.has(`${k.row},${k.col}`)).length;
  const labelFor = (key: RenderKey) => (key.hasMatrix ? keyLabel(data.keymap[0][key.row * cols + key.col] ?? 0, ctx) : undefined);

  // The virtual keyboard can be "pressed" with the mouse.
  const virtual = getController(session.id)?.transport;
  const onSelect = virtual instanceof VirtualTransport
    ? ({keyId}: {keyId: string}) => {
        const key = keys.find((k) => k.id === keyId);
        if (!key) return;
        virtual.keyboard.press(key.row, key.col);
        setTimeout(() => virtual.keyboard.release(key.row, key.col), 180);
      }
    : undefined;

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={matrixSeen ? 'success' : 'neutral'}>{matrixSeen ? 'Matris okunuyor' : 'Bilgisayar tuş olayları'}</Badge>
        <span className="text-sm text-muted">
          {doneCount}/{testable.length} tuş denendi
        </span>
        <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} className="ml-auto" onClick={() => {
          setTested(new Set());
          setLog([]);
        }}>
          Sıfırla
        </Button>
      </div>
      <div className="mx-auto w-full max-w-[1180px]">
        <KeyboardView keys={keys} labelFor={labelFor} pressed={pressed} tested={tested} onSelect={onSelect} className="w-full select-none" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          <p className="font-semibold text-fg">Nasıl çalışır?</p>
          <p className="mt-1">
            Tuşlara bas; basılan tuş mavi, en az bir kez çalışan tuş yeşil olur. Firmware matris bilgisini paylaşıyorsa (VIA_INSECURE) Fn gibi
            bilgisayara hiç gitmeyen tuşlar da görünür; paylaşmıyorsa tuşlar bilgisayarın gördüğü olaylarla eşleştirilir.
          </p>
          {onSelect && <p className="mt-2 text-accent">Demo klavyede tuşlara tıklayarak da basabilirsin.</p>}
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-[12px] font-semibold tracking-wide text-faint uppercase">Bilgisayarın gördüğü son tuşlar</p>
          {log.length === 0 ? (
            <p className="text-sm text-faint">Bir tuşa bas…</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {log.map((entry) => (
                <li key={entry.id} className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs">
                  <span className="text-fg">{entry.key === ' ' ? '␣' : entry.key}</span> <span className="text-faint">{entry.code}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
