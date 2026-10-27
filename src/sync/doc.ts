/**
 * The shared copy of the user's data that devices exchange through GitHub.
 *
 * Every record lives under a collection and a key that is the same on every
 * device (an action id, a key position, the time a test ended…). An entry holds
 * the record and the time it last changed, or only that time when it was
 * deleted. Two copies merge record by record, the later change winning, so any
 * device can merge in any order and all of them end up with the same data.
 *
 * Records in the browser carry no deletion marks; a device finds out what it
 * changed by comparing its data with the copy it agreed on at the last sync
 * (the base).
 */

export const collections = ['actions', 'bindings', 'slots', 'typing', 'texts', 'prefs', 'definitions', 'backups'] as const;
export type Collection = (typeof collections)[number];

/** `u`: when the record last changed (ms); `v`: the record; `d`: deleted. */
export type Entry = {u: number; v?: unknown; d?: 1};
export type SyncDoc = Record<Collection, Record<string, Entry>>;

/**
 * A record as this device has it. `at` is the record's own change time when it
 * has one. `keep` marks a setting this device does not share right now (a
 * background picture only it has): the shared value is left alone both ways.
 */
export type LocalItem = {value: unknown; at?: number; keep?: boolean};
export type LocalState = Record<Collection, Map<string, LocalItem>>;

export const emptyDoc = (): SyncDoc => Object.fromEntries(collections.map((c) => [c, {}])) as SyncDoc;
export const emptyLocal = (): LocalState => Object.fromEntries(collections.map((c) => [c, new Map()])) as LocalState;

/** JSON with object keys sorted, so equal data always reads the same. */
export const stable = (value: unknown): string | undefined => JSON.stringify(sortKeys(value));

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
};

export const sameValue = (a: unknown, b: unknown) => stable(a) === stable(b);

/**
 * This device's data as entries: records equal to the base keep the base's
 * entry, changed or new ones get a fresh time, missing ones become deletions.
 * A device `joining` data other devices already share brings settings it never
 * shared with the oldest time, so the shared settings win over its defaults.
 */
export const localChanges = (local: LocalState, base: SyncDoc, now: number, {joining = false} = {}): SyncDoc => {
  const doc = emptyDoc();
  for (const c of collections) {
    const mine = local[c];
    const before = base[c];
    for (const [key, item] of mine) {
      const prior = before[key];
      if (item.keep) {
        if (prior) doc[c][key] = prior;
        continue;
      }
      if (prior && !prior.d && sameValue(prior.v, item.value)) {
        doc[c][key] = prior;
        continue;
      }
      const fresh = joining && c === 'prefs' && !prior ? 0 : (item.at ?? now);
      doc[c][key] = {u: prior ? Math.max(fresh, prior.u + 1) : fresh, v: item.value};
    }
    for (const [key, prior] of Object.entries(before)) {
      if (mine.has(key)) continue;
      doc[c][key] = prior.d ? prior : {u: Math.max(now, prior.u + 1), d: 1};
    }
  }
  return doc;
};

const later = (a: Entry | undefined, b: Entry | undefined) => {
  if (!a) return b!;
  if (!b) return a;
  if (a.u !== b.u) return a.u > b.u ? a : b;
  // Same time on two devices: any fixed rule will do, as long as every device picks the same.
  return (stable(a) ?? '') >= (stable(b) ?? '') ? a : b;
};

export const mergeDocs = (a: SyncDoc, b: SyncDoc): SyncDoc => {
  const doc = emptyDoc();
  for (const c of collections) {
    for (const key of new Set([...Object.keys(a[c] ?? {}), ...Object.keys(b[c] ?? {})])) {
      doc[c][key] = later(a[c]?.[key], b[c]?.[key]);
    }
  }
  return doc;
};

/** Deletion marks are kept long enough for every device to have seen them. */
export const TOMBSTONE_DAYS = 180;

export const dropOldTombstones = (doc: SyncDoc, now: number): SyncDoc => {
  const limit = now - TOMBSTONE_DAYS * 24 * 60 * 60 * 1000;
  const out = emptyDoc();
  for (const c of collections) {
    for (const [key, entry] of Object.entries(doc[c])) if (!entry.d || entry.u >= limit) out[c][key] = entry;
  }
  return out;
};

/** What the device must change so it holds exactly the shared data. */
export type LocalChange = {collection: Collection; key: string; before: unknown; after: unknown};

export const changesToApply = (local: LocalState, doc: SyncDoc): LocalChange[] => {
  const changes: LocalChange[] = [];
  for (const c of collections) {
    for (const key of new Set([...local[c].keys(), ...Object.keys(doc[c])])) {
      const item = local[c].get(key);
      if (item?.keep) continue;
      const entry = doc[c][key];
      const after = entry && !entry.d ? entry.v : undefined;
      if (!sameValue(item?.value, after)) changes.push({collection: c, key, before: item?.value, after});
    }
  }
  return changes;
};

// ---------------------------------------------------------------------------
// Files in the repository

export const FILE_FORMAT = 'klavye-studio-sync';

const month = (ms: number) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 7) : 'diger');
const hex = (vendorProductId: string) => {
  const n = Number(vendorProductId);
  return Number.isFinite(n) ? n.toString(16).padStart(8, '0') : 'diger';
};

/** The file a record is kept in. Large, growing data is split so a sync rewrites little. */
export const fileOf = (collection: Collection, key: string): string => {
  switch (collection) {
    case 'actions':
      return 'eylemler.json';
    case 'bindings':
    case 'slots':
      return 'atamalar.json';
    case 'prefs':
      return 'ayarlar.json';
    case 'texts':
      return 'metinler.json';
    case 'definitions':
      return 'tanimlar.json';
    case 'backups':
      return `yedekler/${hex(key.split(':')[0])}.json`;
    case 'typing':
      return `antrenman/${month(Number(key.split(':')[0]))}.json`;
  }
};

export const isDataFile = (path: string) =>
  ['eylemler.json', 'atamalar.json', 'ayarlar.json', 'metinler.json', 'tanimlar.json'].includes(path) ||
  /^(yedekler|antrenman)\/[^/]+\.json$/.test(path);

/** Splits the shared data into the files of the repository. */
export const splitIntoFiles = (doc: SyncDoc): Map<string, SyncDoc> => {
  const files = new Map<string, SyncDoc>();
  for (const c of collections) {
    for (const [key, entry] of Object.entries(doc[c])) {
      const path = fileOf(c, key);
      if (!files.has(path)) files.set(path, emptyDoc());
      files.get(path)![c][key] = entry;
    }
  }
  return files;
};

export const fileText = (part: SyncDoc) => {
  const used = Object.fromEntries(collections.filter((c) => Object.keys(part[c]).length).map((c) => [c, part[c]]));
  return `${JSON.stringify(sortKeys({format: FILE_FORMAT, version: 1, collections: used}), null, 1)}\n`;
};

export const parseFile = (text: string): SyncDoc => {
  const doc = emptyDoc();
  const file = JSON.parse(text) as {format?: string; collections?: Partial<SyncDoc>};
  if (file?.format !== FILE_FORMAT || !file.collections) throw new Error('Eşitleme dosyası tanınmadı.');
  for (const c of collections) {
    for (const [key, entry] of Object.entries(file.collections[c] ?? {})) {
      if (entry && typeof entry.u === 'number') doc[c][key] = entry.d ? {u: entry.u, d: 1} : {u: entry.u, v: entry.v};
    }
  }
  return doc;
};

/** The id git gives a file's content, to tell which files changed without downloading them. */
export const gitBlobSha = async (text: string) => {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const bytes = new Uint8Array(head.length + body.length);
  bytes.set(head);
  bytes.set(body, head.length);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Two devices can give the same helper trigger to different actions before they
 * sync. The older action keeps it; the other loses it and gets a new one the
 * next time it is used. Every device decides the same way.
 */
export const fixTriggerClashes = (doc: SyncDoc): SyncDoc => {
  type Action = {trigger?: number; createdAt?: number};
  const byTrigger = new Map<number, string[]>();
  for (const [key, entry] of Object.entries(doc.actions)) {
    const trigger = !entry.d ? (entry.v as Action | undefined)?.trigger : undefined;
    if (trigger !== undefined) byTrigger.set(trigger, [...(byTrigger.get(trigger) ?? []), key]);
  }
  const actions = {...doc.actions};
  for (const keys of byTrigger.values()) {
    if (keys.length < 2) continue;
    const age = (key: string) => (actions[key].v as Action).createdAt ?? 0;
    const [, ...losers] = [...keys].sort((a, b) => age(a) - age(b) || a.localeCompare(b));
    for (const key of losers) {
      const {trigger: _dropped, ...rest} = actions[key].v as Action;
      actions[key] = {u: actions[key].u + 1, v: rest};
    }
  }
  return {...doc, actions};
};
