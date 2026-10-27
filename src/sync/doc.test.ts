import {describe, expect, it} from 'vitest';
import {
  changesToApply,
  dropOldTombstones,
  emptyDoc,
  emptyLocal,
  fileOf,
  fileText,
  fixTriggerClashes,
  gitBlobSha,
  localChanges,
  mergeDocs,
  parseFile,
  splitIntoFiles,
  stable,
  type LocalState,
  type SyncDoc,
} from './doc';

const local = (items: Partial<Record<keyof LocalState, [string, unknown, number?][]>>): LocalState => {
  const state = emptyLocal();
  for (const [c, list] of Object.entries(items) as [keyof LocalState, [string, unknown, number?][]][]) {
    for (const [key, value, at] of list) state[c].set(key, {value, at});
  }
  return state;
};

/** One sync of a device: its changes merged with the shared copy, then applied. */
const sync = (device: LocalState, base: SyncDoc, remote: SyncDoc, now: number) => {
  const joining = Object.keys(base.prefs).length === 0 && Object.keys(remote.prefs).length > 0;
  const merged = mergeDocs(localChanges(device, base, now, {joining}), remote);
  for (const change of changesToApply(device, merged)) {
    if (change.after === undefined) device[change.collection].delete(change.key);
    else device[change.collection].set(change.key, {value: change.after});
  }
  return merged;
};

describe('sync documents', () => {
  it('writes the same text for the same data', () => {
    expect(stable({b: 1, a: {d: [2, {f: 1, e: 0}], c: undefined}})).toBe('{"a":{"d":[2,{"e":0,"f":1}]},"b":1}');
  });

  it('turns local data into entries against the base', () => {
    const base = emptyDoc();
    base.actions.same = {u: 10, v: {name: 'Kopyala'}};
    base.actions.edited = {u: 10, v: {name: 'Eski'}};
    base.actions.gone = {u: 10, v: {name: 'Silinen'}};
    const doc = localChanges(
      local({actions: [['same', {name: 'Kopyala'}, 99], ['edited', {name: 'Yeni'}, 5], ['new', {name: 'Taze'}, 50]]}),
      base,
      1000,
    );
    expect(doc.actions.same).toBe(base.actions.same);
    // An edit always beats the version it was made from, even with a slow clock.
    expect(doc.actions.edited).toEqual({u: 11, v: {name: 'Yeni'}});
    expect(doc.actions.new).toEqual({u: 50, v: {name: 'Taze'}});
    expect(doc.actions.gone).toEqual({u: 1000, d: 1});
  });

  it('lets shared settings win over the defaults of a joining device', () => {
    const remote = emptyDoc();
    remote.prefs['studio.theme'] = {u: 500, v: 'dark'};
    const device = local({prefs: [['studio.theme', 'light'], ['studio.keyTheme', 'default']]});
    const merged = sync(device, emptyDoc(), remote, 1000);
    expect(device.prefs.get('studio.theme')?.value).toBe('dark');
    expect(merged.prefs['studio.keyTheme']).toEqual({u: 0, v: 'default'});
    // The first device's settings are real choices, not defaults.
    expect(localChanges(local({prefs: [['studio.theme', 'light']]}), emptyDoc(), 1000).prefs['studio.theme']).toEqual({u: 1000, v: 'light'});
  });

  it('leaves a setting marked keep alone in both directions', () => {
    const base = emptyDoc();
    base.prefs['studio.background'] = {u: 5, v: 'mordor'};
    const device = emptyLocal();
    device.prefs.set('studio.background', {value: 'custom', keep: true});
    const doc = localChanges(device, base, 100);
    expect(doc.prefs['studio.background']).toEqual({u: 5, v: 'mordor'});
    expect(changesToApply(device, doc)).toEqual([]);
  });

  it('merges by the later change and agrees on ties', () => {
    const a = emptyDoc();
    const b = emptyDoc();
    a.actions.x = {u: 5, v: 'a'};
    b.actions.x = {u: 7, v: 'b'};
    a.actions.y = {u: 3, v: 'left'};
    b.actions.y = {u: 3, v: 'right'};
    expect(mergeDocs(a, b).actions.x.v).toBe('b');
    expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a));
  });

  it('two devices converge: one adds, the other deletes', () => {
    let shared = emptyDoc();
    const windows = local({actions: [['copy', {name: 'Kopyala'}, 1]]});
    const mac = emptyLocal();
    let windowsBase = emptyDoc();
    let macBase = emptyDoc();

    shared = windowsBase = sync(windows, windowsBase, shared, 10);
    shared = macBase = sync(mac, macBase, shared, 20);
    expect(mac.actions.get('copy')?.value).toEqual({name: 'Kopyala'});

    mac.actions.delete('copy');
    mac.typing.set('30:test', {value: {wpm: 57}, at: 30});
    shared = macBase = sync(mac, macBase, shared, 40);
    shared = windowsBase = sync(windows, windowsBase, shared, 50);
    expect(windows.actions.has('copy')).toBe(false);
    expect(windows.typing.get('30:test')?.value).toEqual({wpm: 57});
    expect(windowsBase).toEqual(macBase);
  });

  it('forgets deletion marks after half a year', () => {
    const doc = emptyDoc();
    const day = 24 * 60 * 60 * 1000;
    doc.actions.old = {u: 0, d: 1};
    doc.actions.recent = {u: 200 * day, d: 1};
    doc.actions.kept = {u: 0, v: 1};
    expect(Object.keys(dropOldTombstones(doc, 200 * day).actions).sort()).toEqual(['kept', 'recent']);
  });

  it('splits data into files and reads them back', () => {
    const doc = emptyDoc();
    doc.actions.a = {u: 1, v: {name: 'Kopyala'}};
    doc.bindings['1263207541:1:2,3'] = {u: 1, v: {actionId: 'a'}};
    doc.typing[`${Date.UTC(2026, 9, 27)}:test`] = {u: 1, v: {wpm: 57}};
    doc.typing[`${Date.UTC(2026, 8, 3)}:lesson`] = {u: 1, d: 1};
    doc.backups['1263207541:5'] = {u: 5, v: {label: 'Yedek'}};
    const files = splitIntoFiles(doc);
    expect([...files.keys()].sort()).toEqual(['antrenman/2026-09.json', 'antrenman/2026-10.json', 'atamalar.json', 'eylemler.json', 'yedekler/4b4b0475.json']);
    const back = [...files.values()].map((part) => parseFile(fileText(part))).reduce(mergeDocs, emptyDoc());
    expect(back).toEqual(doc);
    expect(fileOf('backups', 'x:1')).toBe('yedekler/diger.json');
  });

  it('computes the same blob id as git', async () => {
    expect(await gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    expect(await gitBlobSha('ş')).toBe(await gitBlobSha('ş'));
  });

  it('gives a clashing helper trigger to the older action only', () => {
    const doc = emptyDoc();
    doc.actions.older = {u: 9, v: {createdAt: 1, trigger: 7}};
    doc.actions.newer = {u: 4, v: {createdAt: 2, trigger: 7}};
    const fixed = fixTriggerClashes(doc);
    expect(fixed.actions.older).toBe(doc.actions.older);
    expect(fixed.actions.newer).toEqual({u: 5, v: {createdAt: 2}});
  });
});
