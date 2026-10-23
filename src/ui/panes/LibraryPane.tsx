import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {BookMarked, ChevronDown, Copy, Download, FileDown, FileUp, Monitor, Plus, RefreshCw, Save, Search, Trash2, Wand2, X} from 'lucide-react';
import {listUserDefinitions, loadBundleIndex} from '@/definitions/repository';
import {simulateMacro} from '@/macros/host-text';
import {macroToSteps, stepsToMacro} from '@/macros/steps';
import {buildAutoHotkey, buildHammerspoon, helperEntries, helperSignature, type HelperEntry} from '@/library/helpers-export';
import {createAction, exportLibrary, focusAction, fromTemplate, markHelperExported, saveAction, setDraft, useLibrary} from '@/library/store';
import {actionTemplates} from '@/library/templates';
import {triggerLabel} from '@/library/triggers';
import {
  kindLabel,
  osIds,
  osLabel,
  variantFor,
  type ActionKind,
  type ActionVariant,
  type KeyBinding,
  type LibraryAction,
  type OsId,
  type ShortcutDef,
} from '@/library/types';
import {deleteLibraryAction, importLibraryFile, saveLibraryAction, syncAllKeyboards, unbindAction} from '@/state/actions';
import {toast, useStudio} from '@/state/store';
import {confirm, Dialog} from '@/ui/components/Dialog';
import {Badge, Button, FileButton, IconButton, Toggle, cx, downloadJson, downloadText, slug} from '@/ui/components/ui';
import {
  deliveryModeText,
  deliveryTone,
  kindHints,
  kindIcons,
  kindOrder,
  shortcutText,
  useCurrentOs,
  useDelivery,
  useDeliveryContext,
} from '@/ui/library/common';
import {ShortcutEditor} from '@/ui/library/ShortcutEditor';
import {StepsEditor} from '@/ui/macros/StepsEditor';

const CTRL = 0x01;
const GUI = 0x08;

const defaultNames: Record<ActionKind, string> = {
  shortcut: 'Yeni kısayol',
  text: 'Yeni metin',
  sequence: 'Yeni adım dizisi',
  app: 'Yeni uygulama',
  script: 'Yeni komut',
  url: 'Yeni web adresi',
};

const fold = (text: string) =>
  text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u'})[c] ?? c);

/** Equal for the editor: the trigger and timestamps change behind the user's back. */
const sameContent = (a: LibraryAction, b: LibraryAction) =>
  JSON.stringify({...a, trigger: 0, updatedAt: 0}) === JSON.stringify({...b, trigger: 0, updatedAt: 0});

/** Ctrl shortcuts usually become Cmd on macOS. */
const toMacShortcut = (shortcut?: ShortcutDef): ShortcutDef | undefined =>
  shortcut && shortcut.mods & CTRL && !(shortcut.mods & GUI) ? {...shortcut, mods: (shortcut.mods & ~CTRL) | GUI} : shortcut;

const withPerOs = (action: LibraryAction, perOs: boolean): LibraryAction => {
  if (!perOs) return {...action, perOs};
  const win = action.variants.windows;
  const mac = action.variants.mac;
  const empty = !mac.text && !mac.shortcut?.key && !mac.steps?.length && !mac.target;
  if (!empty) return {...action, perOs};
  // Start the macOS version from the Windows one.
  const seeded: ActionVariant = {...structuredClone(win), shortcut: toMacShortcut(win.shortcut)};
  return {...action, perOs, variants: {...action.variants, mac: seeded}};
};

const withKind = (action: LibraryAction, kind: ActionKind): LibraryAction => {
  const next = {...action, kind};
  if (kind === 'shortcut') {
    next.variants = {
      windows: {...action.variants.windows, shortcut: action.variants.windows.shortcut ?? {mods: CTRL, key: ''}},
      mac: {...action.variants.mac, shortcut: action.variants.mac.shortcut ?? {mods: GUI, key: ''}},
    };
  }
  return next;
};

const positionText = (binding: KeyBinding) =>
  binding.encoder
    ? `Knob ${binding.encoder.index} ${binding.encoder.cw ? '↻' : '↺'}`
    : binding.keyName
      ? `${binding.keyName} tuşu`
      : `Tuş ${binding.row},${binding.col}`;

/** Names of keyboard models: connected ones, uploaded definitions, then the VIA bundle. */
const useKeyboardNames = () => {
  const sessions = useStudio((s) => s.sessions);
  const data = useStudio((s) => s.data);
  const [known, setKnown] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    let live = true;
    void Promise.all([loadBundleIndex(), listUserDefinitions().catch(() => [])]).then(([index, user]) => {
      if (!live) return;
      const names = new Map(index.map((entry) => [entry.vendorProductId, entry.name]));
      for (const stored of user) names.set(stored.vendorProductId, stored.name);
      setKnown(names);
    });
    return () => {
      live = false;
    };
  }, []);
  return (vpid: number) => {
    const session = Object.values(sessions).find((s) => s.vendorProductId === vpid);
    if (session) return data[session.id]?.name ?? session.productName;
    const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
    return known.get(vpid) ?? `Klavye ${hex(Math.floor(vpid / 65536))}:${hex(vpid & 0xffff)}`;
  };
};

// ---------------------------------------------------------------------------
// List

const NewActionMenu = ({onCreate}: {onCreate: (kind: ActionKind) => void}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Yeni eylem <ChevronDown size={14} />
      </Button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-20 mt-1 w-72 rounded-xl border border-border bg-surface p-1 shadow-xl">
          {kindOrder.map((kind) => {
            const Icon = kindIcons[kind];
            return (
              <button
                key={kind}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreate(kind);
                }}
                className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2"
              >
                <Icon size={16} className="mt-0.5 shrink-0 text-action" />
                <span>
                  <span className="block text-[13px] font-medium">{kindLabel[kind]}</span>
                  <span className="block text-[11.5px] text-faint">{kindHints[kind]}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ListItem = ({action, active, dirty, uses, onClick}: {action: LibraryAction; active: boolean; dirty: boolean; uses: number; onClick: () => void}) => {
  const Icon = kindIcons[action.kind];
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({block: 'nearest'});
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', active ? 'bg-surface-3' : 'hover:bg-surface-2')}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-action-soft text-action">
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{action.name || 'Adsız eylem'}</span>
        <span className="block truncate text-[11px] text-faint">
          {kindLabel[action.kind]} · {uses ? `${uses} tuşta` : 'atanmamış'}
          {action.perOs ? ' · Win/Mac ayrı' : ''}
        </span>
      </span>
      {dirty && <span className="h-2 w-2 shrink-0 rounded-full bg-macro" title="Kaydedilmedi" />}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Editor

const targetCopy: Record<'app' | 'script' | 'url', Record<OsId, {placeholder: string; hint: string}>> = {
  app: {
    windows: {
      placeholder: 'ör. code, notepad, chrome veya C:\\Program Files\\Uygulama\\uygulama.exe',
      hint: 'Win+R ile çalışan bir ad ya da programın tam yolu.',
    },
    mac: {placeholder: 'ör. Visual Studio Code, Safari, Terminal', hint: 'Uygulamalar klasöründeki adıyla.'},
  },
  script: {
    windows: {
      placeholder: 'ör. powershell -NoProfile -Command "Get-Date | Set-Clipboard"',
      hint: 'Komut olarak çalıştırılır; bir .bat veya .ps1 dosyasının yolu da olur.',
    },
    mac: {placeholder: 'ör. open ~/Downloads veya ~/scripts/yedek.sh', hint: 'zsh ile çalıştırılır.'},
  },
  url: {
    windows: {placeholder: 'https://', hint: 'Varsayılan tarayıcıda açılır.'},
    mac: {placeholder: 'https://', hint: 'Varsayılan tarayıcıda açılır.'},
  },
};

const VariantEditor = ({
  action,
  os,
  shared,
  onChange,
}: {
  action: LibraryAction;
  os: OsId;
  shared: boolean;
  onChange: (variant: ActionVariant) => void;
}) => {
  const here = useCurrentOs();
  const protocol = useStudio((s) => (s.selectedId ? s.sessions[s.selectedId]?.protocol ?? 12 : 12));
  const variant = action.variants[os];
  const mac = shared ? here === 'mac' : os === 'mac';
  switch (action.kind) {
    case 'text':
      return (
        <textarea
          value={variant.text ?? ''}
          onChange={(event) => onChange({...variant, text: event.target.value})}
          rows={5}
          spellCheck={false}
          aria-label={`Metin (${shared ? 'tüm sistemler' : osLabel[os]})`}
          placeholder={'Tuşa basınca yazılacak metin.\nSatır sonları Enter olarak yazılır.'}
          className="w-full resize-y rounded-lg border border-border bg-surface-2 p-3 font-mono text-sm leading-relaxed outline-none focus:border-accent"
        />
      );
    case 'shortcut':
      return <ShortcutEditor value={variant.shortcut} onChange={(shortcut) => onChange({...variant, shortcut})} mac={mac} />;
    case 'sequence':
      return (
        <StepsEditor
          steps={macroToSteps(variant.steps ?? [])}
          setSteps={(steps) => onChange({...variant, steps: stepsToMacro(steps)})}
          protocol={protocol}
          isMac={mac}
        />
      );
    case 'app':
    case 'script':
    case 'url': {
      const copy = targetCopy[action.kind][shared ? here : os];
      return (
        <div className="flex flex-col gap-1.5">
          <input
            value={variant.target ?? ''}
            onChange={(event) => onChange({...variant, target: event.target.value})}
            placeholder={copy.placeholder}
            spellCheck={false}
            aria-label={`${kindLabel[action.kind]} (${shared ? 'tüm sistemler' : osLabel[os]})`}
            className="h-9 w-full rounded-lg border border-border bg-surface-2 px-3 font-mono text-sm outline-none focus:border-accent"
          />
          <span className="text-xs text-faint">{copy.hint}</span>
        </div>
      );
    }
  }
};

/** How one OS gets the action: keycode, keyboard macro, or the helper program. */
const DeliveryRow = ({action, os}: {action: LibraryAction; os: OsId}) => {
  const here = useCurrentOs();
  const ctx = useDeliveryContext(os);
  const delivery = useDelivery(action, os);
  const preview = delivery.mode === 'macro' ? simulateMacro(delivery.macro, ctx.host, ctx.codec) : '';
  return (
    <div className="flex flex-col gap-1.5 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Monitor size={14} className="text-faint" />
        <span className="font-medium">{osLabel[os]}</span>
        <span className="text-xs text-faint">
          {ctx.host.short}
          {os === here ? ' · bu bilgisayar' : ''}
        </span>
        <Badge tone={deliveryTone[delivery.mode]}>{deliveryModeText[delivery.mode]}</Badge>
        <span className="text-muted">{delivery.summary}</span>
      </div>
      {preview && (
        <pre className="ml-6 rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-[12.5px] whitespace-pre-wrap text-fg">{preview}</pre>
      )}
      {delivery.mode === 'trigger' && (
        <p className="ml-6 text-xs text-faint">
          {action.trigger !== undefined
            ? `Klavye ${triggerLabel(action.trigger, os)} gönderir; bu kombinasyonu ${os === 'mac' ? 'Hammerspoon' : 'AutoHotkey'} yakalar.`
            : 'İlk kez bir tuşa atanınca boş bir tetikleyici kombinasyonu (ör. Ctrl+Alt+Shift+F13) verilir.'}{' '}
          Yardımcı programı “Yardımcı programlar” sekmesinden indir.
        </p>
      )}
    </div>
  );
};

const BoundKeys = ({action}: {action: LibraryAction}) => {
  const bindings = useLibrary((s) => s.bindings);
  const keyboardName = useKeyboardNames();
  const mine = bindings.filter((b) => b.actionId === action.id);
  const groups = [...new Set(mine.map((b) => b.vendorProductId))].map((vpid) => ({vpid, items: mine.filter((b) => b.vendorProductId === vpid)}));
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-faint uppercase">Atandığı tuşlar</h3>
      {!groups.length && (
        <p className="text-sm text-muted">
          Henüz bir tuşa atanmadı. Tuş haritasında bir tuş seç, alttaki “Eylemler” sekmesinden bu eylemi seç.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.vpid} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">{keyboardName(group.vpid)}</span>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((binding) => (
                <span key={binding.id ?? positionText(binding)} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 py-0.5 pr-0.5 pl-2 text-[12px]">
                  Katman {binding.layer} · {positionText(binding)}
                  <IconButton
                    label="Bu tuştan kaldır"
                    className="h-6 w-6"
                    onClick={async () => {
                      await unbindAction(binding);
                      toast('Eylem tuştan kaldırıldı.', 'success');
                    }}
                  >
                    <X size={12} />
                  </IconButton>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const KindPicker = ({value, onChange}: {value: ActionKind; onChange: (kind: ActionKind) => void}) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Eylem türü">
    {kindOrder.map((kind) => {
      const Icon = kindIcons[kind];
      return (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={value === kind}
          title={kindHints[kind]}
          onClick={() => onChange(kind)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
            value === kind ? 'border-action bg-action-soft text-fg' : 'border-border text-muted hover:text-fg',
          )}
        >
          <Icon size={14} />
          {kindLabel[kind]}
        </button>
      );
    })}
  </div>
);

const ActionEditor = ({draft, saved, onClose}: {draft: LibraryAction; saved?: LibraryAction; onClose: () => void}) => {
  const [saving, setSaving] = useState(false);
  const [tagText, setTagText] = useState(draft.tags.join(', '));
  const isNew = !saved;
  const dirty = isNew || !sameContent(draft, saved);
  const update = (next: LibraryAction) => setDraft(next);
  const setVariant = (os: OsId, variant: ActionVariant) => update({...draft, variants: {...draft.variants, [os]: variant}});

  // Follow tag changes made elsewhere (e.g. discarding edits) without fighting the user's typing.
  useEffect(() => {
    const typed = tagText.split(',').map((t) => t.trim()).filter(Boolean);
    if (typed.join('\n') !== draft.tags.join('\n')) setTagText(draft.tags.join(', '));
  }, [draft.tags]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveLibraryAction({...draft, trigger: draft.trigger ?? saved?.trigger});
      setDraft(structuredClone(result));
      toast(isNew ? `“${result.name}” kütüphaneye eklendi.` : `“${result.name}” kaydedildi.`, 'success');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const uses = useLibrary.getState().bindings.filter((b) => b.actionId === draft.id).length;
    const ok = await confirm({
      title: `“${draft.name}” silinsin mi?`,
      body: uses
        ? `Bu eylem ${uses} tuşta kullanılıyor. Bu tuşlar boşaltılır; şu an bağlı olmayan klavyelerde bir sonraki bağlanışta.`
        : 'Eylem kütüphaneden kaldırılır.',
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    await deleteLibraryAction(draft.id);
    setDraft(null);
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <input
          value={draft.name}
          onChange={(event) => update({...draft, name: event.target.value})}
          aria-label="Eylem adı"
          placeholder="Eylem adı"
          autoFocus={isNew}
          className="h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold outline-none hover:border-border focus:border-accent"
        />
        <div className="flex items-center gap-1.5">
          {!isNew && (
            <IconButton
              label="Kopyasını oluştur"
              onClick={() => {
                const copy = createAction(draft.kind, `${draft.name} (kopya)`);
                setDraft({...structuredClone(draft), id: copy.id, name: copy.name, trigger: undefined, createdAt: copy.createdAt, updatedAt: copy.updatedAt});
              }}
            >
              <Copy size={15} />
            </IconButton>
          )}
          {!isNew && (
            <IconButton label="Eylemi sil" onClick={() => void remove()}>
              <Trash2 size={15} />
            </IconButton>
          )}
          <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => (saved ? setDraft(structuredClone(saved)) : (setDraft(null), onClose()))}>
            {isNew ? 'Vazgeç' : 'Değişiklikleri at'}
          </Button>
          <Button size="sm" variant="primary" icon={<Save size={14} />} disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Kaydediliyor…' : isNew ? 'Kütüphaneye ekle' : 'Kaydet'}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="flex max-w-4xl flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">Tür</span>
            <KindPicker value={draft.kind} onChange={(kind) => update(withKind(draft, kind))} />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-60 flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium">Etiketler</span>
              <input
                value={tagText}
                onChange={(event) => {
                  setTagText(event.target.value);
                  update({...draft, tags: event.target.value.split(',').map((t) => t.trim()).filter(Boolean)});
                }}
                placeholder="ör. kod, python, iş"
                className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="flex h-9 items-center gap-2.5 text-sm">
              <Toggle checked={draft.perOs} onChange={(perOs) => update(withPerOs(draft, perOs))} label="Windows ve macOS’ta farklı" />
              Windows ve macOS’ta farklı
            </label>
          </div>

          <div className={cx('grid gap-4', draft.perOs && 'xl:grid-cols-2')}>
            {(draft.perOs ? osIds : (['windows'] as OsId[])).map((os) => (
              <section key={os} className="rounded-xl border border-border bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-[12px] font-semibold tracking-wide text-faint uppercase">{draft.perOs ? osLabel[os] : 'Tüm sistemler'}</h3>
                  {draft.perOs && os === 'mac' && draft.kind === 'shortcut' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setVariant('mac', {...draft.variants.mac, shortcut: toMacShortcut(draft.variants.windows.shortcut)})}
                    >
                      Windows’tan çevir (Ctrl → ⌘)
                    </Button>
                  )}
                </div>
                <VariantEditor action={draft} os={os} shared={!draft.perOs} onChange={(variant) => setVariant(os, variant)} />
              </section>
            ))}
          </div>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-3 text-[12px] font-semibold tracking-wide text-faint uppercase">Klavye bunu nasıl yapacak?</h3>
            {osIds.map((os) => (
              <DeliveryRow key={os} action={draft} os={os} />
            ))}
          </section>

          {!isNew && <BoundKeys action={draft} />}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Intro, templates, helpers

const IntroCard = ({title, children}: {title: string; children: ReactNode}) => (
  <div className="rounded-xl border border-border bg-surface p-4">
    <h3 className="mb-1.5 text-sm font-semibold">{title}</h3>
    <p className="text-sm leading-relaxed text-muted">{children}</p>
  </div>
);

const LibraryIntro = ({onTemplates, hasActions}: {onTemplates: () => void; hasActions: boolean}) => (
  <div className="min-h-0 overflow-y-auto px-6 py-6">
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Eylem kütüphanesi</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Bir işi bir kez tanımla, istediğin klavyenin istediğin tuşuna ata. Klavyeyi bu uygulama açıkken bir bilgisayara bağladığında, atanmış
          tuşlar o bilgisayarın işletim sistemine göre yeniden yazılır. Klavye en son hangi bilgisayarda eşitlendiyse onun sürümüyle kalır.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <IntroCard title="Kısayollar">Tek bir tuş koduna dönüşür, makro hafızası harcamaz. Windows’ta Ctrl+C, Mac’te ⌘C gibi.</IntroCard>
        <IntroCard title="Metin ve adım dizileri">
          Klavyenin makro hafızasına yazılır, bilgisayarda program gerekmez. US düzeninin yazamadığı harfler (ş, ğ, ı…) için yardımcı program
          devreye girer.
        </IntroCard>
        <IntroCard title="Uygulama, komut, web">
          Klavye bunları kendisi yapamaz: özel bir tuş kombinasyonu gönderir, bilgisayardaki yardımcı program (AutoHotkey / Hammerspoon) işi
          yapar.
        </IntroCard>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Wand2 size={15} />} onClick={onTemplates}>
          Hazır eylemlerden ekle
        </Button>
      </div>
      {hasActions && <p className="text-sm text-faint">Düzenlemek için soldan bir eylem seç.</p>}
    </div>
  </div>
);

const TemplatesDialog = ({open, onClose}: {open: boolean; onClose: () => void}) => {
  const actions = useLibrary((s) => s.actions);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const present = (i: number) => actions.some((a) => a.name === actionTemplates[i].name && a.kind === actionTemplates[i].kind);
  useEffect(() => {
    if (open) setPicked(new Set(actionTemplates.map((_, i) => i).filter((i) => !actions.some((a) => a.name === actionTemplates[i].name))));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async () => {
    const chosen = [...picked].filter((i) => !present(i));
    for (const i of chosen) await saveAction(fromTemplate(i));
    toast(`${chosen.length} hazır eylem eklendi.`, 'success');
    onClose();
  };
  const count = [...picked].filter((i) => !present(i)).length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Hazır eylemler"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" disabled={!count} onClick={() => void add()}>
            {count} eylemi ekle
          </Button>
        </>
      }
    >
      <p className="mb-3">Windows ve macOS sürümleri hazır gelir; ekledikten sonra hepsini değiştirebilirsin.</p>
      <div className="flex max-h-[55vh] flex-col gap-0.5 overflow-y-auto">
        {actionTemplates.map((template, i) => {
          const Icon = kindIcons[template.kind];
          const already = present(i);
          const describe = (os: OsId) => {
            const v = variantFor({...template, id: '', createdAt: 0, updatedAt: 0}, os);
            return template.kind === 'shortcut' ? shortcutText(v.shortcut, os) : (v.text ?? v.target ?? '').replace(/\n/g, ' ⏎ ');
          };
          return (
            <label key={template.name} className={cx('flex items-center gap-3 rounded-lg px-2 py-1.5', already ? 'opacity-50' : 'cursor-pointer hover:bg-surface-2')}>
              <input
                type="checkbox"
                disabled={already}
                checked={already || picked.has(i)}
                onChange={(event) =>
                  setPicked((all) => {
                    const next = new Set(all);
                    if (event.target.checked) next.add(i);
                    else next.delete(i);
                    return next;
                  })
                }
              />
              <Icon size={15} className="shrink-0 text-action" />
              <span className="w-44 shrink-0 truncate text-[13px] font-medium text-fg">{template.name}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                {template.perOs ? `Win: ${describe('windows')} · Mac: ${describe('mac')}` : describe('windows')}
              </span>
              {already && <Badge>eklendi</Badge>}
            </label>
          );
        })}
      </div>
    </Dialog>
  );
};

const helperSteps: Record<OsId, ReactNode[]> = {
  windows: [
    <>
      <a className="text-accent hover:underline" href="https://www.autohotkey.com" target="_blank" rel="noreferrer">
        AutoHotkey v2
      </a>
      ’yi kur.
    </>,
    'İndirdiğin klavye-studio.ahk dosyasına çift tıkla; sistem tepsisinde yeşil H simgesi görünür.',
    'Bilgisayar açılınca çalışsın: Win+R → shell:startup → dosyanın kısayolunu bu klasöre koy.',
    'Kütüphanede bir şey değişince dosyayı yeniden indir, eskisinin üzerine kaydet ve yine çift tıkla.',
  ],
  mac: [
    <>
      <a className="text-accent hover:underline" href="https://www.hammerspoon.org" target="_blank" rel="noreferrer">
        Hammerspoon
      </a>
      ’u kur ve Erişilebilirlik iznini ver.
    </>,
    'İndirdiğin klavye-studio.lua dosyasını ~/.hammerspoon/ klasörüne koy.',
    <>
      ~/.hammerspoon/init.lua dosyasına <code className="rounded bg-surface-2 px-1 font-mono text-[12px]">require("klavye-studio")</code> satırını ekle.
    </>,
    'Menü çubuğundaki Hammerspoon simgesinden “Reload Config” de. Değişiklikten sonra dosyayı yenileyip yine Reload Config de.',
  ],
};

const HelperCard = ({os, entries}: {os: OsId; entries: HelperEntry[]}) => {
  const signatures = useLibrary((s) => s.helperSignatures);
  const signature = helperSignature(entries);
  const stored = signatures[os];
  const state = stored === undefined ? (entries.length ? 'never' : 'none') : stored === signature ? 'fresh' : 'stale';
  const file = os === 'windows' ? 'klavye-studio.ahk' : 'klavye-studio.lua';
  const download = async () => {
    const text = os === 'windows' ? `\uFEFF${buildAutoHotkey(entries)}` : buildHammerspoon(entries);
    downloadText(file, text);
    await markHelperExported(os, signature);
  };
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{os === 'windows' ? 'Windows · AutoHotkey v2' : 'macOS · Hammerspoon'}</h3>
        <Badge>{entries.length} eylem</Badge>
        {state === 'stale' && <Badge tone="macro">güncel değil, yeniden indir</Badge>}
        {state === 'never' && <Badge tone="macro">henüz indirilmedi</Badge>}
        {state === 'fresh' && <Badge tone="success">indirilen dosya güncel</Badge>}
      </div>
      <ol className="ml-4 list-decimal space-y-1 text-sm text-muted">
        {helperSteps[os].map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <div>
        <Button variant={state === 'stale' || state === 'never' ? 'primary' : 'secondary'} icon={<Download size={15} />} onClick={() => void download()}>
          {file} indir
        </Button>
      </div>
    </section>
  );
};

const helperDoes = (entry: HelperEntry | undefined) => {
  if (!entry) return null;
  const value = entry.value.replace(/\n/g, ' ⏎ ');
  return `${{text: 'Yazar', app: 'Açar', script: 'Çalıştırır', url: 'Açar', shortcut: '', sequence: ''}[entry.kind]}: ${value}`;
};

const HelpersView = () => {
  const actions = useLibrary((s) => s.actions);
  const bindings = useLibrary((s) => s.bindings);
  const winCtx = useDeliveryContext('windows');
  const macCtx = useDeliveryContext('mac');
  const entries = useMemo(
    () => ({windows: helperEntries(actions, 'windows', winCtx), mac: helperEntries(actions, 'mac', macCtx)}),
    [actions, winCtx, macCtx],
  );
  const rows = [...new Set([...entries.windows, ...entries.mac].map((e) => e.action))].sort((a, b) => (a.trigger ?? 0) - (b.trigger ?? 0));
  const unbound = actions.filter((a) => a.trigger === undefined && ['app', 'script', 'url'].includes(a.kind) && !bindings.some((b) => b.actionId === a.id));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 p-5">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Klavye tek başına uygulama açamaz, komut çalıştıramaz ve US düzeninde Türkçe harf yazamaz. Bu eylemlerde klavye kimsenin kullanmadığı
          bir kombinasyon gönderir (ör. Ctrl+Alt+Shift+F13); bilgisayardaki küçük yardımcı program onu yakalayıp işi yapar. Yardımcıyı yalnızca
          istediğin bilgisayarlara kur. Kurulu olmayan bilgisayarda bu tuşlar hiçbir şey yapmaz, diğer tuşlar normal çalışır.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelperCard os="windows" entries={entries.windows} />
          <HelperCard os="mac" entries={entries.mac} />
        </div>
        <section className="rounded-xl border border-border bg-surface">
          <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">Dosyalardaki eylemler</h3>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="text-[11px] tracking-wide text-faint uppercase">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Eylem</th>
                    <th className="px-4 py-2 font-semibold">Kombinasyon</th>
                    <th className="px-4 py-2 font-semibold">Windows</th>
                    <th className="px-4 py-2 font-semibold">macOS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((action) => (
                    <tr key={action.id} className="border-t border-border align-top">
                      <td className="px-4 py-2 font-medium">{action.name}</td>
                      <td className="px-4 py-2 font-mono text-[12px] whitespace-nowrap text-muted">
                        {triggerLabel(action.trigger!, 'windows')}
                        <br />
                        {triggerLabel(action.trigger!, 'mac')}
                      </td>
                      {osIds.map((os) => (
                        <td key={os} className="max-w-72 px-4 py-2 break-words text-muted">
                          {helperDoes(entries[os].find((e) => e.action.id === action.id)) ?? <span className="text-faint">klavye kendisi yapar</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-muted">
              Henüz yardımcı gerektiren, bir tuşa atanmış eylem yok. Uygulama açan, komut çalıştıran, web adresi açan ya da US düzeninde
              yazılamayan metin içeren bir eylemi bir tuşa atadığında burada görünür.
            </p>
          )}
          {unbound.length > 0 && (
            <p className="border-t border-border px-4 py-3 text-xs text-faint">
              Bir tuşa atanınca dosyaya eklenecek: {unbound.map((a) => a.name).join(', ')}
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

export const LibraryPane = () => {
  const loaded = useLibrary((s) => s.loaded);
  const actions = useLibrary((s) => s.actions);
  const bindings = useLibrary((s) => s.bindings);
  const draft = useLibrary((s) => s.draft);
  const focus = useLibrary((s) => s.focus);
  const signatures = useLibrary((s) => s.helperSignatures);
  const readyCount = useStudio((s) => Object.values(s.sessions).filter((x) => x.status === 'ready').length);
  const winCtx = useDeliveryContext('windows');
  const macCtx = useDeliveryContext('mac');
  const [view, setView] = useState<'actions' | 'helpers'>('actions');
  const [query, setQuery] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const saved = draft ? actions.find((a) => a.id === draft.id) : undefined;
  const dirty = !!draft && (!saved || !sameContent(draft, saved));

  const uses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bindings) if (b.actionId) counts.set(b.actionId, (counts.get(b.actionId) ?? 0) + 1);
    return counts;
  }, [bindings]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return actions;
    return actions.filter((a) => fold(`${a.name} ${a.tags.join(' ')} ${kindLabel[a.kind]}`).includes(q));
  }, [actions, query]);

  // A helper file is out of date when what it would contain changed since the download.
  const helpersStale = useMemo(
    () =>
      osIds.some((os) => {
        const stored = signatures[os];
        const entries = helperEntries(actions, os, os === 'windows' ? winCtx : macCtx);
        return stored === undefined ? entries.length > 0 : stored !== helperSignature(entries);
      }),
    [actions, signatures, winCtx, macCtx],
  );

  const open = async (next: LibraryAction | null) => {
    if (dirty && draft) {
      const ok = await confirm({
        title: 'Kaydedilmemiş değişiklikler',
        body: `“${draft.name || 'Adsız eylem'}” üzerindeki değişiklikler kaydedilmedi.`,
        confirmLabel: 'Değişiklikleri at',
        danger: true,
      });
      if (!ok) return;
    }
    setDraft(next ? structuredClone(next) : null);
    setView('actions');
  };

  // Opened from the keymap's "Eylemi düzenle".
  useEffect(() => {
    if (!focus || !loaded) return;
    const action = useLibrary.getState().actions.find((a) => a.id === focus);
    focusAction(null);
    if (action && action.id !== draft?.id) void open(action);
    else setView('actions');
  }, [focus, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const tab = (id: 'actions' | 'helpers', label: ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => setView(id)}
      className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium', view === id ? 'bg-surface-3 text-fg' : 'text-muted hover:text-fg')}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <div role="tablist" className="flex rounded-lg border border-border p-0.5">
          {tab(
            'actions',
            <>
              <BookMarked size={14} /> Eylemler <span className="text-faint tabular-nums">{actions.length}</span>
            </>,
          )}
          {tab(
            'helpers',
            <>
              Yardımcı programlar
              {helpersStale && <span className="h-2 w-2 rounded-full bg-macro" title="İndirilen dosya güncel değil" />}
            </>,
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {readyCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw size={14} className={syncing ? 'animate-spin' : undefined} />}
              disabled={syncing}
              onClick={async () => {
                setSyncing(true);
                const changed = await syncAllKeyboards();
                setSyncing(false);
                if (!changed) toast('Bağlı klavyeler zaten güncel.', 'info');
              }}
            >
              Klavyeleri eşitle
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<FileDown size={14} />}
            disabled={!actions.length}
            onClick={() => downloadJson(`klavye-studio-kutuphane-${slug(new Date().toISOString().slice(0, 10))}.json`, exportLibrary())}
          >
            Dışa aktar
          </Button>
          <FileButton size="sm" variant="ghost" accept=".json,application/json" icon={<FileUp size={14} />} onFile={(file) => void importLibraryFile(file)}>
            İçe aktar
          </FileButton>
        </div>
      </div>

      {view === 'helpers' ? (
        <HelpersView />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border bg-surface">
            <div className="flex flex-col gap-2 border-b border-border p-3">
              <div className="flex flex-wrap gap-1.5">
                <NewActionMenu onCreate={(kind) => void open(createAction(kind, defaultNames[kind]))} />
                <Button size="sm" variant="ghost" icon={<Wand2 size={14} />} onClick={() => setTemplatesOpen(true)}>
                  Hazır eylemler
                </Button>
              </div>
              <label className="relative">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Eylem ara"
                  aria-label="Eylem ara"
                  className="h-8 w-full rounded-lg border border-border bg-surface-2 pr-2 pl-8 text-[13px] outline-none placeholder:text-faint focus:border-accent"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {draft && !saved && <ListItem action={draft} active dirty uses={0} onClick={() => undefined} />}
              {filtered.map((action) => (
                <ListItem
                  key={action.id}
                  action={draft?.id === action.id ? draft : action}
                  active={draft?.id === action.id}
                  dirty={draft?.id === action.id && dirty}
                  uses={uses.get(action.id) ?? 0}
                  onClick={() => void (draft?.id === action.id ? undefined : open(action))}
                />
              ))}
              {loaded && !actions.length && !draft && <p className="px-2 py-6 text-center text-sm text-faint">Henüz eylem yok.</p>}
              {query && actions.length > 0 && !filtered.length && <p className="px-2 py-6 text-center text-sm text-faint">Eşleşen eylem yok.</p>}
            </div>
          </div>
          {draft ? (
            <ActionEditor key={draft.id} draft={draft} saved={saved} onClose={() => undefined} />
          ) : (
            <LibraryIntro onTemplates={() => setTemplatesOpen(true)} hasActions={actions.length > 0} />
          )}
        </div>
      )}
      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </div>
  );
};
