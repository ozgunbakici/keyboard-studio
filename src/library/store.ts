import {create} from 'zustand';
import {db, getSetting, setSetting} from '@/storage/db';
import {resolveDelivery, type DeliveryContext} from './delivery';
import {actionTemplates} from './templates';
import {allocateTrigger} from './triggers';
import {bindingKey, osIds, type ActionKind, type KeyBinding, type LibraryAction, type OsId, type SlotUse} from './types';

type LibraryState = {
  loaded: boolean;
  actions: LibraryAction[];
  bindings: KeyBinding[];
  slots: SlotUse[];
  /** Action the library pane should open (set from other panes). */
  focus: string | null;
  /** Unsaved edit in the library pane; kept while the user visits other panes. */
  draft: LibraryAction | null;
  /** Content of the helper files last downloaded, to tell when they are out of date. */
  helperSignatures: Partial<Record<OsId, string>>;
};

export const useLibrary = create<LibraryState>(() => ({
  loaded: false,
  actions: [],
  bindings: [],
  slots: [],
  focus: null,
  draft: null,
  helperSignatures: {},
}));

const set = useLibrary.setState;
const get = useLibrary.getState;

let loading: Promise<void> | null = null;

export const loadLibrary = () => {
  loading ??= (async () => {
    try {
      const [actions, bindings, slots, helperSignatures] = await Promise.all([
        db.actions.toArray(),
        db.bindings.toArray(),
        db.slots.toArray(),
        getSetting<Partial<Record<OsId, string>>>('helperSignatures', {}),
      ]);
      set({loaded: true, actions: actions.sort((a, b) => a.name.localeCompare(b.name, 'tr')), bindings, slots, helperSignatures});
    } catch {
      set({loaded: true});
    }
  })();
  return loading;
};

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `a-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const createAction = (kind: ActionKind, name: string): LibraryAction => {
  const now = Date.now();
  // Shortcuts start with the usual modifier of each OS: Ctrl on Windows, Cmd on macOS.
  const variants =
    kind === 'shortcut' ? {windows: {shortcut: {mods: 0x01, key: ''}}, mac: {shortcut: {mods: 0x08, key: ''}}} : {windows: {}, mac: {}};
  return {id: newId(), name, kind, tags: [], perOs: kind === 'shortcut' || kind === 'app', variants, createdAt: now, updatedAt: now};
};

export const fromTemplate = (index: number): LibraryAction => {
  const now = Date.now();
  return {...structuredClone(actionTemplates[index]), id: newId(), createdAt: now, updatedAt: now};
};

export const saveAction = async (action: LibraryAction) => {
  const saved = {...action, updatedAt: Date.now()};
  await db.actions.put(saved).catch(() => undefined);
  set((s) => ({
    actions: [...s.actions.filter((a) => a.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
  }));
  return saved;
};

/** Deletes an action; its keys are cleared on each keyboard's next sync. */
export const deleteAction = async (id: string) => {
  const removed = get().bindings.filter((b) => b.actionId === id);
  await db.transaction('rw', db.actions, db.bindings, async () => {
    await db.actions.delete(id);
    await db.bindings.where('actionId').equals(id).modify({actionId: ''});
  }).catch(() => undefined);
  set((s) => ({
    actions: s.actions.filter((a) => a.id !== id),
    bindings: s.bindings.map((b) => (b.actionId === id ? {...b, actionId: ''} : b)),
  }));
  return removed;
};

/** Gives the action a helper trigger if any OS needs one. */
export const ensureTrigger = async (action: LibraryAction, ctxFor: (os: 'windows' | 'mac') => DeliveryContext) => {
  if (action.trigger !== undefined) return action;
  const needs = osIds.some((os) => resolveDelivery(action, os, ctxFor(os)).mode === 'trigger');
  if (!needs) return action;
  const trigger = allocateTrigger(get().actions.map((a) => a.trigger).filter((t): t is number => t !== undefined));
  if (trigger === null) return action;
  return saveAction({...action, trigger});
};

/** Places an action on a key, replacing whatever binding was there. */
export const setBinding = async (binding: Omit<KeyBinding, 'id'>) => {
  const key = bindingKey(binding);
  const existing = get().bindings.filter((b) => bindingKey(b) === key);
  let id: number | undefined;
  await db.transaction('rw', db.bindings, async () => {
    await db.bindings.bulkDelete(existing.map((b) => b.id!).filter((x) => x !== undefined));
    id = await db.bindings.add({...binding});
  }).catch(() => undefined);
  set((s) => ({bindings: [...s.bindings.filter((b) => bindingKey(b) !== key), {...binding, id}]}));
};

export const removeBindingAt = async (position: Omit<KeyBinding, 'id' | 'actionId'>) => {
  const key = bindingKey(position);
  const existing = get().bindings.filter((b) => bindingKey(b) === key);
  if (!existing.length) return false;
  await db.bindings.bulkDelete(existing.map((b) => b.id!).filter((x) => x !== undefined)).catch(() => undefined);
  set((s) => ({bindings: s.bindings.filter((b) => bindingKey(b) !== key)}));
  return true;
};

/** Takes an action off one key; the key is cleared on the keyboard's next sync. */
export const clearBinding = async (binding: KeyBinding) => {
  const key = bindingKey(binding);
  const existing = get().bindings.filter((b) => bindingKey(b) === key);
  await db.bindings.bulkPut(existing.filter((b) => b.id !== undefined).map((b) => ({...b, actionId: ''}))).catch(() => undefined);
  set((s) => ({bindings: s.bindings.map((b) => (bindingKey(b) === key ? {...b, actionId: ''} : b))}));
};

/** Forgets cleared bindings once a sync has written them to the keyboard. */
export const dropClearedBindings = async (vendorProductId: number) => {
  const cleared = get().bindings.filter((b) => b.vendorProductId === vendorProductId && !b.actionId);
  if (!cleared.length) return;
  await db.bindings.bulkDelete(cleared.map((b) => b.id!).filter((x) => x !== undefined)).catch(() => undefined);
  set((s) => ({bindings: s.bindings.filter((b) => b.vendorProductId !== vendorProductId || b.actionId)}));
};

export const focusAction = (id: string | null) => set({focus: id});
export const setDraft = (draft: LibraryAction | null) => set({draft});

export const markHelperExported = async (os: OsId, signature: string) => {
  const helperSignatures = {...get().helperSignatures, [os]: signature};
  set({helperSignatures});
  await setSetting('helperSignatures', helperSignatures).catch(() => undefined);
};

/** Replaces the managed macro slots of one keyboard model. */
export const setSlots = async (vendorProductId: number, slots: SlotUse[]) => {
  await db.transaction('rw', db.slots, async () => {
    await db.slots.where('vendorProductId').equals(vendorProductId).delete();
    await db.slots.bulkPut(slots);
  }).catch(() => undefined);
  set((s) => ({slots: [...s.slots.filter((x) => x.vendorProductId !== vendorProductId), ...slots]}));
};

export type LibraryFile = {format: 'klavye-studio-library'; version: 1; exportedAt: string; actions: LibraryAction[]};

export const exportLibrary = (): LibraryFile => ({
  format: 'klavye-studio-library',
  version: 1,
  exportedAt: new Date().toISOString(),
  actions: get().actions,
});

/** Merges actions from a file; same ids are replaced by the newer copy. */
export const importLibrary = async (json: unknown) => {
  const file = json as LibraryFile;
  if (!file || file.format !== 'klavye-studio-library' || !Array.isArray(file.actions)) {
    throw new Error('Bu dosya bir Klavye Stüdyo kütüphanesi değil.');
  }
  let added = 0;
  for (const incoming of file.actions) {
    const current = get().actions.find((a) => a.id === incoming.id);
    if (current && current.updatedAt >= incoming.updatedAt) continue;
    // A trigger already used by a different local action is dropped and reassigned on use.
    const clash = incoming.trigger !== undefined && get().actions.some((a) => a.id !== incoming.id && a.trigger === incoming.trigger);
    const action = clash ? {...incoming, trigger: undefined} : incoming;
    await db.actions.put(action).catch(() => undefined);
    added++;
  }
  loading = null;
  await loadLibrary();
  return added;
};
