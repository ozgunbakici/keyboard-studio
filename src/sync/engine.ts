import {create} from 'zustand';
import {reloadLibrary, useLibrary} from '@/library/store';
import {useStudio} from '@/state/store';
import {db, getSetting, setSetting} from '@/storage/db';
import {reloadTyping, useTyping} from '@/typing/store';
import {
  changesToApply,
  dropOldTombstones,
  emptyDoc,
  fileText,
  fixTriggerClashes,
  gitBlobSha,
  isDataFile,
  localChanges,
  mergeDocs,
  parseFile,
  splitIntoFiles,
  type SyncDoc,
} from './doc';
import {GitHubError, GitHubRepo, tokenLogin, type FileChange} from './github';
import {applyChanges, readLocal, type Applied} from './local';

/**
 * Keeps this device in step with the user's private GitHub repository: on
 * start, when the app comes back into view, a few seconds after a change and
 * before a keyboard is brought in line with the library.
 */

export type CloudConfig = {owner: string; repo: string; branch: string; token: string};

/** What the last successful sync agreed on with the repository. */
type SavedSync = {repo: string; base: SyncDoc; head: string; tree: string; files: Record<string, string>; at: number};

const CONFIG_KEY = 'cloudSync';
const STATE_KEY = 'cloudSyncState';

export type CloudStatus = {
  /** owner/name of the repository; null while sync is off. */
  repo: string | null;
  phase: 'off' | 'idle' | 'syncing' | 'error';
  lastSync: number | null;
  error: string | null;
  /** The problem needs the user (token, repository); automatic syncs wait until it is fixed. */
  blocked: boolean;
};

export const useCloud = create<CloudStatus>(() => ({repo: null, phase: 'off', lastSync: null, error: null, blocked: false}));

let config: CloudConfig | null = null;
let running: Promise<void> | null = null;
let again = false;
/** Set while the sync itself fills the stores, so that does not count as the user's change. */
let applying = false;
/** The repository was checked to be private during this visit. */
let verified = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const appliedListeners = new Set<(applied: Applied) => void>();

/** Called after data from another device was stored here. */
export const onCloudApplied = (listener: (applied: Applied) => void) => {
  appliedListeners.add(listener);
  return () => void appliedListeners.delete(listener);
};

class PublicRepoError extends Error {}

const describe = (error: unknown): {error: string; blocked: boolean} => {
  if (error instanceof PublicRepoError) {
    return {error: 'Bu depo herkese açık. Verilerin başkalarına görünmesin diye yalnızca gizli (Private) bir depoya eşitlenir.', blocked: true};
  }
  if (error instanceof GitHubError) {
    if (error.status === 0) return {error: 'GitHub’a ulaşılamadı. İnternet gelince yeniden denenir.', blocked: false};
    if (error.status === 401) return {error: 'Anahtar geçersiz ya da süresi dolmuş. Yeni bir anahtar oluşturup yeniden bağlan.', blocked: true};
    if (error.status === 403 && /rate limit/i.test(error.message)) return {error: 'GitHub istek sınırına ulaşıldı; biraz sonra yeniden denenir.', blocked: false};
    if (error.status === 403) return {error: 'Anahtarın bu depoya yazma izni yok: “Contents” iznini “Read and write” yap.', blocked: true};
    if (error.status === 404) return {error: 'Depo bulunamadı ya da anahtar bu depoya erişemiyor (anahtarı oluştururken depoyu seçtin mi?).', blocked: true};
    return {error: `GitHub hatası (${error.status}): ${error.message}`, blocked: false};
  }
  if (error instanceof SyntaxError) return {error: 'Depodaki eşitleme dosyaları okunamadı.', blocked: true};
  return {error: error instanceof Error ? error.message : String(error), blocked: false};
};

const deviceLabel = () => {
  const nav = navigator as Navigator & {userAgentData?: {platform?: string}};
  const ua = navigator.userAgent;
  if (nav.userAgentData?.platform) return nav.userAgentData.platform;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Mac/i.test(navigator.platform)) return 'macOS';
  if (/Win/i.test(navigator.platform)) return 'Windows';
  return 'tarayıcı';
};

const readme = () => `# Klavye Stüdyo verileri

Bu depo, [Klavye Stüdyo](${new URL(import.meta.env.BASE_URL, location.origin).href})’nun cihazlar arasında eşitlediği verileri tutar. Gizli (private) kalmalı.
Dosyaları elle değiştirme; uygulama her eşitlemede kendisi yazar.

- \`eylemler.json\`: eylem kütüphanesi
- \`atamalar.json\`: eylemlerin hangi klavyede hangi tuşta olduğu
- \`ayarlar.json\`, \`metinler.json\`: ayarlar ve yazı antrenmanı metinleri
- \`tanimlar.json\`: yüklenen klavye tanımları
- \`yedekler/\`: klavye yedekleri
- \`antrenman/\`: yazı antrenmanı geçmişi, ay ay
`;

const reloadStores = async (applied: Applied) => {
  applying = true;
  try {
    if (applied.studio) useStudio.setState((s) => ({settings: {...s.settings, ...applied.studio}}));
    if (applied.library) await reloadLibrary();
    if (applied.typing) await reloadTyping();
  } finally {
    applying = false;
  }
  if (applied.library || applied.typing || applied.studio || applied.files) for (const listener of appliedListeners) listener(applied);
};

const syncWith = async (cfg: CloudConfig) => {
  const repo = new GitHubRepo(cfg.token, cfg.owner, cfg.repo);
  const name = `${cfg.owner}/${cfg.repo}`;
  if (!verified) {
    if (!(await repo.info()).private) throw new PublicRepoError();
    verified = true;
  }
  const saved = await getSetting<SavedSync | null>(STATE_KEY, null);
  const known = saved?.repo === name ? saved : null;

  let head = await repo.head(cfg.branch);
  if (!head) {
    await repo.createFile(cfg.branch, 'README.md', readme(), 'Klavye Stüdyo eşitleme deposu');
    head = await repo.head(cfg.branch);
    if (!head) throw new GitHubError(409, 'Depo hazırlanamadı.');
  }

  // The shared copy. Files unchanged since the last sync come from the base, the rest are downloaded.
  let remote = emptyDoc();
  let tree: string;
  let remoteFiles: Map<string, string>;
  if (known?.head === head) {
    remote = known.base;
    tree = known.tree;
    remoteFiles = new Map(Object.entries(known.files));
  } else {
    const listing = await repo.files(head);
    tree = listing.tree;
    remoteFiles = listing.files;
    const parts = known ? splitIntoFiles(known.base) : new Map<string, SyncDoc>();
    for (const [path, sha] of remoteFiles) {
      if (!isDataFile(path)) continue;
      const part = known?.files[path] === sha ? parts.get(path) : undefined;
      remote = mergeDocs(remote, part ?? parseFile(await repo.readText(sha)));
    }
  }

  const now = Date.now();
  const local = await readLocal();
  // A device that never synced with this repository joins the data the others share.
  const joining = !known && Object.keys(remote.prefs).length > 0;
  const mine = localChanges(local, known?.base ?? emptyDoc(), now, {joining});
  const merged = fixTriggerClashes(dropOldTombstones(mergeDocs(mine, remote), now));

  // The repository is written first: when another device got there first, nothing here has changed yet.
  const texts = new Map([...splitIntoFiles(merged)].map(([path, part]) => [path, fileText(part)]));
  const files: Record<string, string> = {};
  for (const [path, text] of texts) files[path] = await gitBlobSha(text);
  const changes: FileChange[] = [...texts].filter(([path]) => remoteFiles.get(path) !== files[path]).map(([path, content]) => ({path, content}));
  for (const path of remoteFiles.keys()) if (isDataFile(path) && !texts.has(path)) changes.push({path, content: null});
  if (changes.length) ({commit: head, tree} = await repo.commit(cfg.branch, head, tree, changes, `Eşitleme · ${deviceLabel()}`));

  const applied = await applyChanges(changesToApply(local, merged));
  await setSetting(STATE_KEY, {repo: name, base: merged, head, tree, files, at: Date.now()} satisfies SavedSync);
  await reloadStores(applied);
};

const runOnce = async (cfg: CloudConfig) => {
  useCloud.setState({phase: 'syncing'});
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await syncWith(cfg);
        break;
      } catch (error) {
        // Another device wrote in between: merge with what it wrote and try again.
        if (error instanceof GitHubError && error.status === 422 && attempt < 4) continue;
        throw error;
      }
    }
    if (config === cfg) useCloud.setState({phase: 'idle', lastSync: Date.now(), error: null, blocked: false});
  } catch (error) {
    if (config === cfg) useCloud.setState({phase: 'error', ...describe(error)});
  }
};

/** Syncs now; a request during a sync runs once more right after it. */
export const syncNow = (): Promise<void> => {
  clearTimeout(timer);
  if (!config) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      if (config) await runOnce(config);
    } while (again && config);
  })().finally(() => {
    running = null;
  });
  return running;
};

const ready = () => config !== null && !useCloud.getState().blocked;

const scheduleSync = () => {
  if (applying || !ready()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 4000);
};

const syncIfStale = (ms: number) => {
  if (ready() && Date.now() - (useCloud.getState().lastSync ?? 0) > ms) void syncNow();
};

let watching = false;

const watchChanges = () => {
  if (watching) return;
  watching = true;
  useLibrary.subscribe((s, prev) => {
    if (s.actions !== prev.actions || s.bindings !== prev.bindings || s.slots !== prev.slots) scheduleSync();
  });
  useTyping.subscribe((s, prev) => {
    if (s.records !== prev.records || s.settings !== prev.settings) scheduleSync();
  });
  useStudio.subscribe((s, prev) => {
    if (s.settings !== prev.settings) scheduleSync();
  });
  for (const table of [db.definitions, db.backups]) {
    table.hook('creating', () => void scheduleSync());
    table.hook('updating', () => void scheduleSync());
    table.hook('deleting', () => void scheduleSync());
  }
  window.addEventListener('focus', () => syncIfStale(30_000));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncIfStale(30_000));
  window.addEventListener('online', () => ready() && void syncNow());
};

export const startCloudSync = async () => {
  config = await getSetting<CloudConfig | null>(CONFIG_KEY, null);
  if (!config) return;
  const saved = await getSetting<SavedSync | null>(STATE_KEY, null);
  useCloud.setState({repo: `${config.owner}/${config.repo}`, phase: 'idle', lastSync: saved?.at ?? null});
  watchChanges();
  await syncNow();
};

/** Checks the repository and token, then makes the first sync. */
export const connectCloud = async (repoInput: string, tokenInput: string) => {
  const token = tokenInput.trim();
  const input = repoInput
    .trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  if (!input) throw new Error('Depo adını yaz.');
  if (!token) throw new Error('Anahtarı yapıştır.');
  let next: CloudConfig;
  try {
    const [owner, name] = input.includes('/') ? input.split('/') : [await tokenLogin(token), input];
    const info = await new GitHubRepo(token, owner, name).info();
    if (!info.private) throw new PublicRepoError();
    const [fullOwner, fullName] = info.full_name.split('/');
    next = {owner: fullOwner, repo: fullName, branch: info.default_branch || 'main', token};
  } catch (error) {
    throw new Error(describe(error).error);
  }
  const previous = config;
  config = next;
  verified = true;
  useCloud.setState({repo: `${next.owner}/${next.repo}`, phase: 'idle', error: null, blocked: false, lastSync: null});
  await syncNow();
  const status = useCloud.getState();
  if (status.phase === 'error') {
    // Nothing is kept from a failed attempt; a connection that existed before stays as it was.
    const message = status.error ?? 'Eşitlenemedi.';
    config = previous;
    verified = false;
    useCloud.setState(
      previous
        ? {repo: `${previous.owner}/${previous.repo}`, phase: 'error', error: message, blocked: true}
        : {repo: null, phase: 'off', error: null, blocked: false, lastSync: null},
    );
    throw new Error(message);
  }
  await setSetting(CONFIG_KEY, next);
  watchChanges();
};

/** Forgets the token on this device; the data stays here and in the repository. */
export const disconnectCloud = async () => {
  clearTimeout(timer);
  config = null;
  verified = false;
  await setSetting(CONFIG_KEY, null);
  useCloud.setState({repo: null, phase: 'off', error: null, blocked: false, lastSync: null});
};

/** Before a keyboard is brought in line with the library, pick up actions bound on other devices. */
export const freshenForKeyboard = async () => {
  if (!ready() || Date.now() - (useCloud.getState().lastSync ?? 0) < 30_000) return;
  await Promise.race([syncNow(), new Promise((resolve) => setTimeout(resolve, 8000))]);
};
