import {describe, expect, it} from 'vitest';
import {KeycodeCodec} from '@/keycodes/codec';
import {hostLayouts} from '@/keycodes/host-layouts';
import {simulateMacro} from '@/macros/host-text';
import type {Macro} from '@/via/macro-bytes';
import {resolveDelivery, type DeliveryContext} from './delivery';
import {planSync, type SyncKeyboardState} from './sync';
import {actionTemplates} from './templates';
import {TRIGGER_POOL, ahkHotkey, allocateTrigger, hammerspoonHotkey, isTrigger, triggerLabel} from './triggers';
import type {KeyBinding, LibraryAction} from './types';

const codec = KeycodeCodec.forProtocol(12);
const winCtx: DeliveryContext = {codec, host: hostLayouts.us, protocol: 12};
const macCtx: DeliveryContext = {codec, host: hostLayouts['us-mac-iso'], protocol: 12};

let counter = 0;
const action = (partial: Partial<LibraryAction> & Pick<LibraryAction, 'kind'>): LibraryAction => ({
  id: `a${++counter}`,
  name: partial.kind,
  tags: [],
  perOs: false,
  variants: {windows: {}, mac: {}},
  createdAt: 0,
  updatedAt: 0,
  ...partial,
});

const fromTemplate = (name: string): LibraryAction => {
  const t = actionTemplates.find((x) => x.name === name)!;
  return {...t, id: `t-${name}`, createdAt: 0, updatedAt: 0};
};

const keyboard = (overrides: Partial<SyncKeyboardState> = {}): SyncKeyboardState => ({
  cols: 4,
  layerCount: 2,
  keymap: [Array(8).fill(4), Array(8).fill(1)],
  encoders: [[[0xaa, 0xa9]], [[1, 1]]],
  macros: Array.from({length: 4}, () => [] as Macro),
  macroCount: 4,
  macroBufferSize: 200,
  ...overrides,
});

const bind = (actionId: string, layer: number, row: number, col: number): KeyBinding => ({vendorProductId: 1, layer, row, col, actionId});

describe('triggers', () => {
  it('uses unique F13–F20 combinations helpers can catch', () => {
    expect(new Set(TRIGGER_POOL).size).toBe(TRIGGER_POOL.length);
    expect(TRIGGER_POOL.length).toBeGreaterThanOrEqual(32);
    const first = TRIGGER_POOL[0];
    expect(codec.format(first)).toBe('MEH(KC_F13)');
    expect(ahkHotkey(first)).toBe('^!+F13');
    expect(hammerspoonHotkey(first)).toEqual({mods: ['ctrl', 'alt', 'shift'], key: 'f13'});
    expect(triggerLabel(first, 'mac')).toBe('⌃⌥⇧F13');
    expect(allocateTrigger([first])).toBe(TRIGGER_POOL[1]);
    expect(isTrigger(first)).toBe(true);
  });
});

describe('delivery', () => {
  it('puts shortcuts straight on the key, per OS', () => {
    const copy = fromTemplate('Kopyala');
    expect(resolveDelivery(copy, 'windows', winCtx)).toMatchObject({mode: 'keycode', keycode: codec.parse('C(KC_C)')});
    expect(resolveDelivery(copy, 'mac', macCtx)).toMatchObject({mode: 'keycode', keycode: codec.parse('G(KC_C)')});
  });

  it('types text with the keyboard when the layout can, else asks the helper', () => {
    const plain = action({kind: 'text', variants: {windows: {text: 'git status\n'}, mac: {}}});
    expect(resolveDelivery(plain, 'windows', winCtx).mode).toBe('macro');
    const turkish = action({kind: 'text', variants: {windows: {text: 'Şişli'}, mac: {}}});
    expect(resolveDelivery(turkish, 'windows', winCtx)).toMatchObject({mode: 'trigger'});
    // A Mac can type ç and ü itself, but not ş.
    const macOnly = action({kind: 'text', variants: {windows: {text: 'çay ve süt'}, mac: {}}});
    expect(resolveDelivery(macOnly, 'mac', macCtx).mode).toBe('macro');
    expect(resolveDelivery(macOnly, 'windows', winCtx).mode).toBe('trigger');
  });

  it('needs the helper for apps, scripts and URLs', () => {
    expect(resolveDelivery(fromTemplate('VS Code'), 'windows', winCtx).mode).toBe('trigger');
    expect(resolveDelivery(action({kind: 'app'}), 'windows', winCtx).mode).toBe('unavailable');
  });
});

describe('planSync', () => {
  it('writes each OS variant and reuses one slot per action', () => {
    const copy = fromTemplate('Kopyala');
    const sig = action({kind: 'text', variants: {windows: {text: 'Saygılarımla'}, mac: {}}, trigger: TRIGGER_POOL[0]});
    const git = action({kind: 'text', variants: {windows: {text: 'git status\n'}, mac: {}}});
    const actions = new Map([copy, sig, git].map((a) => [a.id, a]));
    const bindings = [bind(copy.id, 0, 0, 0), bind(git.id, 1, 0, 1), bind(git.id, 1, 0, 2), bind(sig.id, 1, 1, 0)];

    const win = planSync({vendorProductId: 1, os: 'windows', ctx: winCtx, actions, bindings, slots: [], keyboard: keyboard()});
    expect(win.warnings).toEqual([]);
    expect(win.keyWrites).toContainEqual({layer: 0, row: 0, col: 0, keycode: codec.parse('C(KC_C)')});
    // git status goes into the last free slot, used by both keys.
    const gitSlot = win.slots.find((s) => s.actionId === git.id)!.slot;
    expect(gitSlot).toBe(3);
    expect(win.keyWrites.filter((w) => w.keycode === codec.parse(`MACRO(${gitSlot})`))).toHaveLength(2);
    expect(simulateMacro(win.macros![gitSlot], hostLayouts.us)).toBe('git status\n');
    // "ı" in Saygılarımla cannot be typed on US Windows: helper trigger, no slot.
    expect(win.slots.some((s) => s.actionId === sig.id)).toBe(false);
    expect(win.keyWrites).toContainEqual({layer: 1, row: 1, col: 0, keycode: TRIGGER_POOL[0]});

    // Same bindings on a Mac: Cmd+C, and the keyboard now writes nothing new for git.
    const after: SyncKeyboardState = keyboard({
      keymap: [
        [codec.parse('C(KC_C)')!, 4, 4, 4, 4, 4, 4, 4],
        [1, codec.parse('MACRO(3)')!, codec.parse('MACRO(3)')!, 1, 1, 1, 1, 1],
      ],
      macros: win.macros!,
    });
    const mac = planSync({vendorProductId: 1, os: 'mac', ctx: macCtx, actions, bindings, slots: win.slots, keyboard: after});
    expect(mac.keyWrites).toContainEqual({layer: 0, row: 0, col: 0, keycode: codec.parse('G(KC_C)')});
    // git keeps its slot untouched...
    expect(mac.macros![3]).toEqual(win.macros![3]);
    // ...while a Mac can type "ı" (Shift+Option+B), so the signature moves into a macro.
    const sigSlot = mac.slots.find((s) => s.actionId === sig.id)!.slot;
    expect(sigSlot).toBe(2);
    expect(simulateMacro(mac.macros![sigSlot], hostLayouts['us-mac-iso'])).toBe('Saygılarımla');
    expect(mac.keyWrites).toContainEqual({layer: 1, row: 1, col: 0, keycode: codec.parse('MACRO(2)')});
  });

  it('never overwrites macros the user made outside the library', () => {
    const git = action({kind: 'text', variants: {windows: {text: 'ls\n'}, mac: {}}});
    const userMacros: Macro[] = [[{type: 'text', text: 'mine'}], [{type: 'text', text: 'also mine'}], [], [{type: 'text', text: 'last'}]];
    const plan = planSync({
      vendorProductId: 1,
      os: 'windows',
      ctx: winCtx,
      actions: new Map([[git.id, git]]),
      bindings: [bind(git.id, 0, 0, 3)],
      slots: [],
      keyboard: keyboard({macros: userMacros}),
    });
    expect(plan.slots).toEqual([{vendorProductId: 1, slot: 2, actionId: git.id}]);
    expect(plan.macros![0]).toEqual(userMacros[0]);
    expect(plan.macros![3]).toEqual(userMacros[3]);
  });

  it('frees slots of actions that are no longer on any key', () => {
    const gone = action({kind: 'text', variants: {windows: {text: 'old'}, mac: {}}});
    const plan = planSync({
      vendorProductId: 1,
      os: 'windows',
      ctx: winCtx,
      actions: new Map([[gone.id, gone]]),
      bindings: [],
      slots: [{vendorProductId: 1, slot: 3, actionId: gone.id}],
      keyboard: keyboard({macros: [[], [], [], [{type: 'text', text: 'old'}]]}),
    });
    expect(plan.macros![3]).toEqual([]);
    expect(plan.slots).toEqual([]);
  });

  it('skips macro keys when the buffer would overflow', () => {
    const long = action({kind: 'text', variants: {windows: {text: 'x'.repeat(300)}, mac: {}}});
    const plan = planSync({
      vendorProductId: 1,
      os: 'windows',
      ctx: winCtx,
      actions: new Map([[long.id, long]]),
      bindings: [bind(long.id, 0, 1, 1)],
      slots: [],
      keyboard: keyboard(),
    });
    expect(plan.macros).toBeNull();
    expect(plan.keyWrites).toEqual([]);
    expect(plan.warnings[0]).toMatch(/sığmıyor/);
  });

  it('binds encoders too', () => {
    const vol = action({kind: 'shortcut', variants: {windows: {shortcut: {mods: 0, key: 'KC_VOLU'}}, mac: {}}});
    const plan = planSync({
      vendorProductId: 1,
      os: 'mac',
      ctx: macCtx,
      actions: new Map([[vol.id, vol]]),
      bindings: [{vendorProductId: 1, layer: 1, row: -1, col: -1, encoder: {index: 0, cw: true}, actionId: vol.id}],
      slots: [],
      keyboard: keyboard(),
    });
    expect(plan.encoderWrites).toEqual([{layer: 1, index: 0, cw: true, keycode: codec.parse('KC_VOLU')}]);
  });

  it('clears keys whose action was removed', () => {
    const plan = planSync({
      vendorProductId: 1,
      os: 'windows',
      ctx: winCtx,
      actions: new Map(),
      bindings: [bind('', 0, 0, 1), bind('', 1, 1, 2)],
      slots: [],
      keyboard: keyboard({keymap: [Array(8).fill(0x0104), Array(8).fill(0x0104)]}),
    });
    expect(plan.keyWrites).toEqual([
      {layer: 0, row: 0, col: 1, keycode: 0},
      {layer: 1, row: 1, col: 2, keycode: codec.value('KC_TRNS')},
    ]);
  });
});

describe('helper exports', async () => {
  const {buildAutoHotkey, buildHammerspoon, helperEntries} = await import('./helpers-export');
  const vs = {...fromTemplate('VS Code'), trigger: TRIGGER_POOL[0]};
  const site = {...fromTemplate('GitHub'), trigger: TRIGGER_POOL[1]};
  const sig = action({kind: 'text', name: 'İmza', variants: {windows: {text: "Şişli'den sevgiler\nÖzgün"}, mac: {}}, trigger: TRIGGER_POOL[2]});
  const script = action({
    kind: 'script',
    name: 'Yedekle',
    perOs: true,
    variants: {windows: {target: 'C:\\Program Files\\Yedek Araci\\yedek.exe'}, mac: {target: 'rsync -a ~/kod /Volumes/Yedek'}},
    trigger: TRIGGER_POOL[3],
  });
  const copy = fromTemplate('Kopyala');
  const all = [vs, site, sig, script, copy];

  it('writes AutoHotkey v2 hotkeys for Windows', () => {
    const ahk = buildAutoHotkey(helperEntries(all, 'windows', winCtx));
    expect(ahk).toContain('#Requires AutoHotkey v2.0');
    expect(ahk).toContain("^!+F13::Run 'code'");
    expect(ahk).toContain("^!+F14::Run 'https://github.com'");
    expect(ahk).toContain("^!+F15::SendText 'Şişli`'den sevgiler`nÖzgün'");
    expect(ahk).toContain(`^!+F16::Run '"C:\\Program Files\\Yedek Araci\\yedek.exe"'`);
    // Shortcuts never need the helper.
    expect(ahk).not.toContain('Kopyala');
  });

  it('writes Hammerspoon bindings for macOS', () => {
    const lua = buildHammerspoon(helperEntries(all, 'mac', macCtx));
    expect(lua).toContain('bind({"ctrl", "alt", "shift"}, "f13", function() hs.application.launchOrFocus([[Visual Studio Code]]) end)');
    expect(lua).toContain('hs.urlevent.openURL([[https://github.com]])');
    expect(lua).toContain('hs.eventtap.keyStrokes([[Şişli\'den sevgiler]]); hs.eventtap.keyStroke({}, "return", 0); hs.eventtap.keyStrokes([[Özgün]])');
    expect(lua).toContain('hs.task.new("/bin/zsh", nil, {"-lc", [[rsync -a ~/kod /Volumes/Yedek]]}):start()');
  });
});
