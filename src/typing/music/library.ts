import {getSetting, setSetting} from '@/storage/db';

/**
 * The user's own music: a folder picked with the File System Access API (kept
 * between visits as a handle in IndexedDB), or files chosen for this visit only.
 * Nothing is copied or uploaded; the files are read where they are.
 */

// Minimal File System Access types; TypeScript's DOM lib does not have all of them.
type ReadPermission = {mode: 'read'};
export type FileHandleLike = {kind: 'file'; name: string; getFile(): Promise<File>};
export type DirectoryHandleLike = {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FileHandleLike | DirectoryHandleLike>;
  queryPermission?(descriptor: ReadPermission): Promise<PermissionState>;
  requestPermission?(descriptor: ReadPermission): Promise<PermissionState>;
};
type PickerWindow = Window & {showDirectoryPicker?: (options: ReadPermission) => Promise<DirectoryHandleLike>};

export type Track = {
  /** Path inside the folder, or the file name. */
  id: string;
  title: string;
  /** The folder the file is in, shown as the artist. */
  artist: string | null;
  open(): Promise<File>;
};

const FOLDER_KEY = 'musicFolder';
const AUDIO = new Set(['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac']);
export const MAX_DEPTH = 6;
export const MAX_FILES = 5000;

const extension = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

export const isAudioFile = (name: string) => AUDIO.has(extension(name));

/** File name without its extension and folders. */
export const titleOf = (path: string) => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
};

/** The folder a path is in, or null at the top. */
export const parentOf = (path: string) => {
  const parts = path.split('/');
  return parts.length > 1 ? parts[parts.length - 2] : null;
};

const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

/** Path order with numbers compared as numbers, so "2 …" comes before "10 …" and albums stay together. */
export const comparePaths = (a: string, b: string) => collator.compare(a, b);

export const sortTracks = <T extends {id: string}>(tracks: T[]) => [...tracks].sort((a, b) => comparePaths(a.id, b.id));

/** Audio files under a folder, as paths relative to it; hidden entries are skipped. */
export const walkFolder = async (root: DirectoryHandleLike, maxDepth = MAX_DEPTH, maxFiles = MAX_FILES) => {
  const found: {path: string; handle: FileHandleLike}[] = [];
  const walk = async (dir: DirectoryHandleLike, prefix: string, depth: number) => {
    for await (const entry of dir.values()) {
      if (found.length >= maxFiles) return;
      if (entry.name.startsWith('.')) continue;
      const path = prefix + entry.name;
      if (entry.kind === 'file') {
        if (isAudioFile(entry.name)) found.push({path, handle: entry});
      } else if (depth < maxDepth) {
        await walk(entry, path + '/', depth + 1);
      }
    }
  };
  await walk(root, '', 0);
  return found.sort((a, b) => comparePaths(a.path, b.path));
};

export const folderTracks = async (root: DirectoryHandleLike): Promise<Track[]> =>
  (await walkFolder(root)).map(({path, handle}) => ({
    id: path,
    title: titleOf(path),
    artist: parentOf(path) ?? root.name,
    open: () => handle.getFile(),
  }));

/** Files from an input; a folder input gives them a relative path, which keeps albums apart. */
export const fileTracks = (files: File[]): Track[] =>
  sortTracks(
    files
      .filter((file) => isAudioFile(file.name))
      .map((file) => {
        const id = file.webkitRelativePath || file.name;
        return {id, title: titleOf(file.name), artist: parentOf(id), open: () => Promise.resolve(file)};
      }),
  );

export const folderSupported = () => typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';

/** Opens the folder picker; null when the user cancels it. */
export const pickFolder = async (): Promise<DirectoryHandleLike | null> => {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  try {
    const handle = await picker.call(window, {mode: 'read'});
    await setSetting(FOLDER_KEY, handle);
    return handle;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
};

export const storedFolder = async () => {
  const handle = await getSetting<DirectoryHandleLike | null>(FOLDER_KEY, null);
  return handle && typeof handle === 'object' && handle.kind === 'directory' ? handle : null;
};

export const forgetFolder = () => setSetting(FOLDER_KEY, null);

/** Whether the folder can be read now; `ask` shows the browser's prompt, which needs a click. */
export const folderAccess = async (handle: DirectoryHandleLike, ask: boolean): Promise<boolean> => {
  try {
    const check = ask ? handle.requestPermission : handle.queryPermission;
    // Browsers without the permission methods grant access for as long as the handle lives.
    if (!check) return true;
    return (await check.call(handle, {mode: 'read'})) === 'granted';
  } catch {
    return false;
  }
};
