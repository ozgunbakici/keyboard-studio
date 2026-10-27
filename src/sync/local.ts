import {bindingKey, type KeyBinding, type LibraryAction, type SlotUse} from '@/library/types';
import {defaultSettings, type Settings} from '@/state/store';
import {db, type StoredBackup, type StoredDefinition} from '@/storage/db';
import {defaultTypingSettings, type SavedText, type TypingRecord, type TypingSettings} from '@/typing/store';
import {emptyLocal, sameValue, type Collection, type LocalChange, type LocalState} from './doc';

/**
 * This device's data in the shape of the shared copy, and the way back. Records
 * get keys that are the same on every device; local ids stay local.
 */

/** Settings shared by every device; the computer's layout and OS stay with each one. */
const studioPrefs = ['theme', 'background', 'backgroundDim', 'backgroundBlur', 'keyTheme', 'advanceSelection', 'blinkOnSelect', 'autoSync'] as const;
const typingPrefs = [
  'turkishChars',
  'practiceMode',
  'goalWpm',
  'showKeyboard',
  'testSeconds',
  'testLanguage',
  'testPunctuation',
  'testNumbers',
  'practiceSource',
  'course',
  'activeText',
] as const;

const withoutId = <T extends {id?: unknown}>(row: T): Omit<T, 'id'> => {
  const {id: _id, ...rest} = row;
  return rest;
};

const slotKey = (s: SlotUse) => `${s.vendorProductId}:${s.slot}`;
const typingKey = (r: Pick<TypingRecord, 'at' | 'kind'>) => `${r.at}:${r.kind}`;
const definitionKey = (d: Pick<StoredDefinition, 'vendorProductId' | 'version'>) => `${d.vendorProductId}:${d.version}`;
const backupKey = (b: Pick<StoredBackup, 'vendorProductId' | 'createdAt'>) => `${b.vendorProductId}:${b.createdAt}`;

const storedSettings = async () => ((await db.settings.get('settings'))?.value ?? {}) as Partial<Settings>;
const storedTyping = async () => {
  const typing = {...defaultTypingSettings, ...((await db.settings.get('typingSettings'))?.value as Partial<TypingSettings> | undefined)};
  // The single pasted text of older versions counts as a saved text.
  if (typing.customText?.trim() && !typing.customTexts.length) {
    typing.customTexts = [{id: 'metin-1', title: 'Metnim', text: typing.customText, position: 0}];
  }
  return typing;
};

export const readLocal = async (): Promise<LocalState> => {
  const state = emptyLocal();
  const [actions, bindings, slots, typing, definitions, backups, settings, typingSettings] = await Promise.all([
    db.actions.toArray(),
    db.bindings.toArray(),
    db.slots.toArray(),
    db.typing.toArray(),
    db.definitions.toArray(),
    db.backups.toArray(),
    storedSettings(),
    storedTyping(),
  ]);
  for (const a of actions) state.actions.set(a.id, {value: a, at: a.updatedAt});
  for (const b of bindings) state.bindings.set(bindingKey(b), {value: withoutId(b)});
  for (const s of slots) state.slots.set(slotKey(s), {value: s});
  for (const r of typing) state.typing.set(typingKey(r), {value: withoutId(r), at: r.at});
  for (const d of definitions) state.definitions.set(definitionKey(d), {value: d, at: d.savedAt});
  for (const b of backups) state.backups.set(backupKey(b), {value: withoutId(b), at: b.createdAt});
  const studio = {...defaultSettings, ...settings};
  for (const key of studioPrefs) {
    // An uploaded picture lives on one device only; the others keep their own background.
    state.prefs.set(`studio.${key}`, {value: studio[key], keep: key === 'background' && studio.background === 'custom'});
  }
  for (const key of typingPrefs) state.prefs.set(`typing.${key}`, {value: typingSettings[key]});
  for (const t of typingSettings.customTexts) state.texts.set(t.id, {value: t});
  return state;
};

/** What changed on this device, so the screens holding that data can reload. */
export type Applied = {library: boolean; typing: boolean; studio: Partial<Settings> | null; files: boolean};

/**
 * Stores the shared data on this device. A record the user changed while the
 * sync was under way is left alone; the next sync sends it out instead.
 */
export const applyChanges = async (changes: LocalChange[]): Promise<Applied> => {
  const applied: Applied = {library: false, typing: false, studio: null, files: false};
  if (!changes.length) return applied;
  const of = (c: Collection) => changes.filter((x) => x.collection === c);
  await db.transaction('rw', [db.actions, db.bindings, db.slots, db.typing, db.definitions, db.backups, db.settings], async () => {
    for (const {key, before, after} of of('actions')) {
      if (!sameValue(await db.actions.get(key), before)) continue;
      if (after === undefined) await db.actions.delete(key);
      else await db.actions.put(after as LibraryAction);
      applied.library = true;
    }

    if (of('bindings').length) {
      const rows = await db.bindings.toArray();
      for (const {key, before, after} of of('bindings')) {
        const same = rows.filter((b) => bindingKey(b) === key);
        if (!sameValue(same.length ? withoutId(same[same.length - 1]) : undefined, before)) continue;
        await db.bindings.bulkDelete(same.map((b) => b.id!));
        if (after !== undefined) await db.bindings.add(after as KeyBinding);
        applied.library = true;
      }
    }

    for (const {key, before, after} of of('slots')) {
      const [vendorProductId, slot] = key.split(':').map(Number);
      if (!sameValue(await db.slots.get([vendorProductId, slot]), before)) continue;
      if (after === undefined) await db.slots.delete([vendorProductId, slot]);
      else await db.slots.put(after as SlotUse);
      applied.library = true;
    }

    for (const {key, before, after} of of('typing')) {
      const at = Number(key.split(':')[0]);
      const same = (await db.typing.where('at').equals(at).toArray()).filter((r) => typingKey(r) === key);
      if (!sameValue(same.length ? withoutId(same[0]) : undefined, before)) continue;
      await db.typing.bulkDelete(same.map((r) => r.id!));
      if (after !== undefined) await db.typing.add(after as TypingRecord);
      applied.typing = true;
    }

    for (const {key, before, after} of of('definitions')) {
      const [vendorProductId, version] = key.split(':');
      const id: [number, StoredDefinition['version']] = [Number(vendorProductId), version as StoredDefinition['version']];
      if (!sameValue(await db.definitions.get(id), before)) continue;
      if (after === undefined) await db.definitions.delete(id);
      else await db.definitions.put(after as StoredDefinition);
      applied.files = true;
    }

    for (const {key, before, after} of of('backups')) {
      const createdAt = Number(key.split(':')[1]);
      const same = (await db.backups.where('createdAt').equals(createdAt).toArray()).filter((b) => backupKey(b) === key);
      if (!sameValue(same.length ? withoutId(same[0]) : undefined, before)) continue;
      await db.backups.bulkDelete(same.map((b) => b.id!));
      if (after !== undefined) await db.backups.add(after as StoredBackup);
      applied.files = true;
    }

    // A setting is never removed, only changed.
    const prefs = of('prefs').filter((c) => c.after !== undefined);
    if (prefs.length) {
      const currentStudio: Record<string, unknown> = {...defaultSettings, ...(await storedSettings())};
      const currentTyping: Record<string, unknown> = await storedTyping();
      const studio: Record<string, unknown> = {};
      const typing: Record<string, unknown> = {};
      for (const {key, before, after} of prefs) {
        const [scope, name] = key.split('.');
        if (scope === 'studio' && (studioPrefs as readonly string[]).includes(name) && sameValue(currentStudio[name], before)) studio[name] = after;
        if (scope === 'typing' && (typingPrefs as readonly string[]).includes(name) && sameValue(currentTyping[name], before)) typing[name] = after;
      }
      if (Object.keys(studio).length) {
        await db.settings.put({key: 'settings', value: {...(await storedSettings()), ...studio}});
        applied.studio = studio as Partial<Settings>;
      }
      if (Object.keys(typing).length) {
        await db.settings.put({key: 'typingSettings', value: {...(await storedTyping()), ...typing}});
        applied.typing = true;
      }
    }

    const texts = of('texts');
    if (texts.length) {
      const typing = await storedTyping();
      let list: SavedText[] = typing.customTexts;
      for (const {key, before, after} of texts) {
        if (!sameValue(list.find((t) => t.id === key), before)) continue;
        if (after === undefined) list = list.filter((t) => t.id !== key);
        else if (list.some((t) => t.id === key)) list = list.map((t) => (t.id === key ? (after as SavedText) : t));
        else list = [...list, after as SavedText];
      }
      await db.settings.put({key: 'typingSettings', value: {...typing, customText: '', customTexts: list}});
      applied.typing = true;
    }
  });
  return applied;
};
