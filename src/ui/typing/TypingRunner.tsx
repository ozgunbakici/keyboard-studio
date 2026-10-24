import {memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {MousePointerClick, RotateCcw} from 'lucide-react';
import {
  backspace,
  createTyping,
  finishTyping,
  typeChar,
  typingResult,
  type CharState,
  type TypingOptions,
  type TypingResult,
  type TypingState,
} from '@/typing/engine';
import {IconButton, cx} from '@/ui/components/ui';
import {TrainerKeyboard} from './TrainerKeyboard';

/** Owns one run: keyboard input through a hidden textarea, the clock and the time limit. */
const useTypingRun = ({
  text,
  options,
  timeLimit,
  onFinish,
  onRestart,
}: {
  text: string;
  options: TypingOptions;
  timeLimit?: number;
  onFinish: (result: TypingResult) => void;
  onRestart?: () => void;
}) => {
  const [state, setState] = useState(() => createTyping(text, options));
  const [now, setNow] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reported = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const reset = useCallback(() => {
    setState(createTyping(text, options));
    reported.current = false;
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, options.mode, options.autoIndent]);

  useEffect(reset, [reset]);

  // Live numbers and the time limit tick while a run is going.
  useEffect(() => {
    if (state.startedAt === null || state.finishedAt !== null) return;
    const started = state.startedAt;
    const id = setInterval(() => {
      const t = performance.now();
      setNow(t);
      if (timeLimit && t - started >= timeLimit * 1000) setState((s) => finishTyping(s, started + timeLimit * 1000));
    }, 100);
    return () => clearInterval(id);
  }, [state.startedAt, state.finishedAt, timeLimit]);

  useEffect(() => {
    if (state.finishedAt === null || reported.current) return;
    reported.current = true;
    onFinishRef.current(typingResult(state));
  }, [state]);

  const type = (chars: string) => {
    const t = performance.now();
    // Phones turn quotes into typographic ones; treat them as the plain characters.
    const plain = chars.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\u00a0/g, ' ');
    setState((s) => {
      if (timeLimit && s.startedAt !== null && t - s.startedAt >= timeLimit * 1000) return finishTyping(s, s.startedAt + timeLimit * 1000);
      return [...plain].reduce((acc, ch) => typeChar(acc, ch, t), s);
    });
  };
  const erase = () => setState((s) => backspace(s, performance.now()));

  // Phone keyboards need a character to delete before their Backspace sends anything,
  // so the hidden field always holds one space.
  const settle = (element: HTMLTextAreaElement) => {
    element.value = SENTINEL;
    element.setSelectionRange(1, 1);
  };

  // Word-suggesting keyboards (Gboard) send the current word as a growing composition;
  // follow it letter by letter. A desktop dead key composes one accented character instead.
  const composition = useRef({text: '', dead: false});
  const follow = (next: string) => {
    const prev = composition.current.text;
    let common = 0;
    while (common < prev.length && common < next.length && prev[common] === next[common]) common++;
    for (let i = prev.length; i > common; i--) erase();
    if (next.length > common) type(next.slice(common));
    composition.current.text = next;
  };

  const handlers = {
    onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Dead') composition.current.dead = true;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (onRestart) onRestart();
        else reset();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        erase();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        type('\n');
      } else if (event.key === 'Tab') {
        event.preventDefault();
      }
    },
    onInput: (event: React.FormEvent<HTMLTextAreaElement>) => {
      const native = event.nativeEvent as InputEvent;
      const element = event.currentTarget;
      if (native.isComposing || native.inputType === 'insertCompositionText') {
        if (!composition.current.dead) follow(native.data ?? '');
        return;
      }
      // Safari repeats the composed text after compositionend.
      if (native.inputType === 'insertFromComposition') return settle(element);
      if (native.inputType === 'deleteContentBackward') {
        erase();
        return settle(element);
      }
      const data = native.inputType === 'insertLineBreak' ? '\n' : (native.data ?? element.value.slice(SENTINEL.length));
      settle(element);
      if (data) type(data);
    },
    onCompositionStart: () => {
      composition.current.text = '';
    },
    onCompositionEnd: (event: React.CompositionEvent<HTMLTextAreaElement>) => {
      if (composition.current.dead) type(event.data);
      else follow(event.data);
      composition.current = {text: '', dead: false};
      settle(event.currentTarget);
    },
    onFocus: (event: React.FocusEvent<HTMLTextAreaElement>) => {
      settle(event.currentTarget);
      setFocused(true);
    },
    onBlur: () => setFocused(false),
  };

  return {state, now, focused, inputRef, handlers, reset};
};

const SENTINEL = ' ';

const charClass: Record<CharState, string> = {
  pending: 'text-muted',
  correct: 'text-fg',
  corrected: 'text-fg underline decoration-macro decoration-2 underline-offset-4',
  incorrect: 'rounded-[3px] bg-danger-soft text-danger',
  auto: 'text-faint',
};

const Char = memo(function Char({ch, state, current}: {ch: string; state: CharState; current: boolean}) {
  return (
    <span data-current={current || undefined} className={cx(charClass[state], current && 'typing-caret')}>
      {ch === '\n' ? (
        <>
          <span className={state === 'pending' || state === 'auto' ? 'text-faint' : undefined}>↵</span>
          {'\n'}
        </>
      ) : (
        ch
      )}
    </span>
  );
});

/** The text with each character coloured by its state; keeps the cursor line in view. */
const TypingText = ({state, code, lines}: {state: TypingState; code: boolean; lines?: number}) => {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const caret = el?.querySelector<HTMLElement>('[data-current]');
    if (!el || !caret) return;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 32;
    // Snap to whole lines: the caret's line becomes the second visible one.
    const line = Math.floor((caret.offsetTop + caret.offsetHeight / 2) / lineHeight);
    if (lines) {
      el.scrollTop = Math.max(0, line - 1) * lineHeight;
    } else if ((line + 1) * lineHeight > el.scrollTop + el.clientHeight || line * lineHeight < el.scrollTop) {
      el.scrollTop = Math.max(0, line - 2) * lineHeight;
    }
  }, [state.pos, lines]);

  return (
    <div
      ref={box}
      className={cx(
        'relative overflow-hidden break-words whitespace-pre-wrap',
        code
          ? 'font-mono text-[0.9rem] leading-[1.65rem] sm:text-[1.05rem] sm:leading-[1.9rem]'
          : 'text-[1.2rem] leading-[2.05rem] tracking-[0.01em] sm:text-[1.45rem] sm:leading-[2.4rem]',
        !lines && 'max-h-[42vh] overflow-y-auto',
      )}
      style={lines ? {height: `${lines}lh`} : undefined}
      aria-label="Yazılacak metin"
    >
      {[...state.target].map((ch, i) => (
        <Char key={i} ch={ch} state={state.states[i]} current={i === state.pos && state.finishedAt === null} />
      ))}
    </div>
  );
};

const formatTime = (ms: number, countdown = false) => {
  const s = Math.max(0, countdown ? Math.ceil(ms / 1000) : Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const LiveStats = ({state, now, timeLimit}: {state: TypingState; now: number; timeLimit?: number}) => {
  const started = state.startedAt !== null;
  const end = state.finishedAt ?? (started ? Math.max(now, state.lastAt ?? 0) : 0);
  const result = started ? typingResult(state, end) : null;
  const elapsed = started ? end - state.startedAt! : 0;
  const progress = state.target.length ? state.pos / state.target.length : 0;
  const item = (label: string, value: string, strong = false) => (
    <div className="flex items-baseline gap-1.5">
      <span className={cx('text-xl font-semibold tabular-nums sm:text-2xl', strong ? 'text-fg' : 'text-muted')}>{value}</span>
      <span className="text-xs text-faint">{label}</span>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
      {timeLimit
        ? item('kalan', formatTime(timeLimit * 1000 - elapsed, true), true)
        : item('süre', formatTime(elapsed))}
      {item('WPM', result ? String(Math.round(result.wpm)) : '–', !timeLimit)}
      {item('doğruluk', result ? `%${Math.round(result.accuracy * 100)}` : '–')}
      {!timeLimit && (
        <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-surface-3" aria-label="İlerleme">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{width: `${progress * 100}%`}} />
        </div>
      )}
    </div>
  );
};

/**
 * A complete typing run: live numbers, the text, an optional finger guide.
 * The parent decides what happens at the end (show results, save, next text).
 */
export const TypingRunner = ({
  text,
  options,
  code = false,
  lines,
  timeLimit,
  showKeyboard = false,
  header,
  onFinish,
  onRestart,
}: {
  text: string;
  options: TypingOptions;
  code?: boolean;
  lines?: number;
  timeLimit?: number;
  showKeyboard?: boolean;
  header?: ReactNode;
  onFinish: (result: TypingResult) => void;
  /** Esc: start again; without it the same text restarts. */
  onRestart?: () => void;
}) => {
  const {state, now, focused, inputRef, handlers, reset} = useTypingRun({text, options, timeLimit, onFinish, onRestart});
  const next = state.finishedAt === null ? state.target[state.pos] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <LiveStats state={state} now={now} timeLimit={timeLimit} />
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-faint">
          {header}
          <IconButton label="Baştan başla (Esc)" onClick={() => (onRestart ? onRestart() : reset())}>
            <RotateCcw size={16} />
          </IconButton>
        </div>
      </div>

      <div
        className="relative cursor-text rounded-2xl border border-border bg-surface px-4 py-4 sm:px-6 sm:py-5"
        onMouseDown={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <textarea
          ref={inputRef}
          {...handlers}
          defaultValue={SENTINEL}
          autoFocus
          aria-label="Yazma alanı"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="absolute top-0 left-0 h-px w-px resize-none opacity-0"
        />
        <div className={cx('transition-[filter,opacity]', !focused && 'opacity-40 blur-[2px]')}>
          <TypingText state={state} code={code} lines={lines} />
        </div>
        {!focused && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-fg">
            <MousePointerClick size={18} /> Yazmaya başlamak için tıkla
          </div>
        )}
      </div>

      {showKeyboard && <TrainerKeyboard next={next} />}
      <p className="text-center text-xs text-faint">
        Esc: baştan başla{options.mode === 'free' ? ' · Backspace: düzelt' : ' · Yanlış tuşta imleç bekler, doğrusunu yaz'}
        {code ? ' · Satır başı girintisi kendiliğinden gelir' : ''}
      </p>
    </div>
  );
};
