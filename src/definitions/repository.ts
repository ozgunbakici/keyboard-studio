import {db, type StoredDefinition} from '@/storage/db';
import {definitionName, parseDefinition, trustCompiledDefinition, type AnyDefinition, type DefinitionVersion} from './parse';

export type DefinitionSource = 'user' | 'bundle' | 'demo';

export type FoundDefinition = {
  definition: AnyDefinition;
  version: DefinitionVersion;
  source: DefinitionSource;
};

export type BundleIndexEntry = {vendorProductId: number; name: string; versions: DefinitionVersion[]};

const bundleUrl = (path: string) => new URL(`definitions/${path}`, document.baseURI).toString();

let bundleIndexPromise: Promise<BundleIndexEntry[]> | null = null;

/** Index of the VIA definitions bundled with the app (built by scripts/build-definitions.mjs). */
export const loadBundleIndex = (): Promise<BundleIndexEntry[]> => {
  bundleIndexPromise ??= fetch(bundleUrl('index.json'))
    .then((res) => (res.ok ? res.json() : {keyboards: []}))
    .then((json: {keyboards?: BundleIndexEntry[]}) => json.keyboards ?? [])
    .catch(() => []);
  return bundleIndexPromise;
};

const fetchBundled = async (vendorProductId: number, version: DefinitionVersion): Promise<AnyDefinition | null> => {
  const index = await loadBundleIndex();
  const entry = index.find((e) => e.vendorProductId === vendorProductId);
  if (!entry?.versions.includes(version)) return null;
  try {
    const res = await fetch(bundleUrl(`${version}/${vendorProductId}.json`));
    if (!res.ok) return null;
    return trustCompiledDefinition(await res.json()).definition;
  } catch {
    return null;
  }
};

const preferredOrder = (version: DefinitionVersion): DefinitionVersion[] => (version === 'v3' ? ['v3', 'v2'] : ['v2', 'v3']);

/**
 * Finds a definition for a keyboard. Files the user loaded win over the bundle,
 * so a newer vendor JSON can replace an outdated VIA one.
 */
export const findDefinition = async (vendorProductId: number, wanted: DefinitionVersion): Promise<FoundDefinition | null> => {
  for (const version of preferredOrder(wanted)) {
    try {
      const stored = await db.definitions.get([vendorProductId, version]);
      if (stored) return {definition: stored.definition, version, source: 'user'};
    } catch {
      // IndexedDB unavailable: fall through to the bundle.
    }
  }
  for (const version of preferredOrder(wanted)) {
    const bundled = await fetchBundled(vendorProductId, version);
    if (bundled) return {definition: bundled, version, source: 'bundle'};
  }
  return null;
};

export const saveUserDefinition = async (definition: AnyDefinition, version: DefinitionVersion) => {
  const row: StoredDefinition = {
    vendorProductId: definition.vendorProductId,
    version,
    name: definitionName(definition),
    definition,
    savedAt: Date.now(),
  };
  await db.definitions.put(row);
  return row;
};

export const listUserDefinitions = () => db.definitions.orderBy('savedAt').reverse().toArray();

export const deleteUserDefinition = (vendorProductId: number, version: DefinitionVersion) =>
  db.definitions.delete([vendorProductId, version]);

/** Reads a JSON file chosen by the user and validates it as a definition. */
export const readDefinitionFile = async (file: File) => {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${file.name} geçerli bir JSON dosyası değil.`);
  }
  return parseDefinition(json);
};
