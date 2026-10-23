import Dexie, {type Table} from 'dexie';
import type {AnyDefinition, DefinitionVersion} from '@/definitions/parse';
import type {BackupFile} from '@/state/backup';
import type {KeyBinding, LibraryAction, SlotUse} from '@/library/types';

export type StoredDefinition = {
  vendorProductId: number;
  version: DefinitionVersion;
  name: string;
  definition: AnyDefinition;
  savedAt: number;
};

export type StoredBackup = {
  id?: number;
  vendorProductId: number;
  deviceName: string;
  label: string;
  createdAt: number;
  automatic: boolean;
  data: BackupFile;
};

export type StoredSetting = {key: string; value: unknown};

class StudioDatabase extends Dexie {
  definitions!: Table<StoredDefinition, [number, DefinitionVersion]>;
  backups!: Table<StoredBackup, number>;
  settings!: Table<StoredSetting, string>;
  actions!: Table<LibraryAction, string>;
  bindings!: Table<KeyBinding, number>;
  slots!: Table<SlotUse, [number, number]>;

  constructor() {
    super('klavye-studio');
    this.version(1).stores({
      definitions: '[vendorProductId+version], vendorProductId, savedAt',
      backups: '++id, vendorProductId, createdAt',
      settings: 'key',
    });
    this.version(2).stores({
      actions: 'id, updatedAt',
      bindings: '++id, vendorProductId, actionId',
      slots: '[vendorProductId+slot], vendorProductId, actionId',
    });
  }
}

export const db = new StudioDatabase();

export const getSetting = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const row = await db.settings.get(key);
    return row ? (row.value as T) : fallback;
  } catch {
    return fallback;
  }
};

export const setSetting = async (key: string, value: unknown) => {
  try {
    await db.settings.put({key, value});
  } catch {
    // Storage can be unavailable (private mode); settings then live in memory only.
  }
};
