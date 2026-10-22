import type {KeyboardDefinitionV2, KeyboardDefinitionV3, VIADefinitionV2, VIADefinitionV3} from '@the-via/reader';

export type AnyDefinition = VIADefinitionV2 | VIADefinitionV3;
export type DefinitionVersion = 'v2' | 'v3';

export const isV3 = (definition: AnyDefinition): definition is VIADefinitionV3 => !('lighting' in definition);

export class DefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DefinitionError';
  }
}

// VIA's reader compiles large JSON-schema validators when imported, so it is
// only loaded when a user-supplied file actually needs validating.
const loadReader = () => import('@the-via/reader');

const asObject = (json: unknown): Record<string, unknown> => {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new DefinitionError('Dosya bir klavye tanımı (JSON nesnesi) içermiyor.');
  }
  return json as Record<string, unknown>;
};

const isCompiled = (obj: Record<string, unknown>) => {
  const layouts = obj.layouts as Record<string, unknown> | undefined;
  return typeof obj.vendorProductId === 'number' && !!layouts && Array.isArray(layouts.keys);
};

/**
 * Definitions from our own bundle were validated at build time; only the shape
 * is checked here so start-up stays fast.
 */
export const trustCompiledDefinition = (json: unknown): {definition: AnyDefinition; version: DefinitionVersion} => {
  const obj = asObject(json);
  if (!isCompiled(obj)) throw new DefinitionError('Derlenmiş VIA tanımı bekleniyordu.');
  const definition = obj as unknown as AnyDefinition;
  return {definition, version: 'lighting' in obj ? 'v2' : 'v3'};
};

/**
 * Accepts what people usually have on disk: the source JSON published by a
 * vendor (v2 or v3, with a KLE keymap) or an already compiled VIA definition.
 */
export const parseDefinition = async (json: unknown): Promise<{definition: AnyDefinition; version: DefinitionVersion}> => {
  const obj = asObject(json);
  const reader = await loadReader();

  if (isCompiled(obj)) {
    if ('lighting' in obj && reader.isVIADefinitionV2(obj)) return {definition: obj, version: 'v2'};
    if (reader.isVIADefinitionV3(obj)) return {definition: obj, version: 'v3'};
    throw new DefinitionError('Derlenmiş VIA tanımı geçersiz görünüyor.');
  }

  if (typeof obj.vendorId !== 'string' || typeof obj.productId !== 'string') {
    throw new DefinitionError('Tanımda "vendorId" ve "productId" alanları bulunamadı.');
  }
  const layouts = obj.layouts as Record<string, unknown> | undefined;
  if (!layouts || !Array.isArray(layouts.keymap)) {
    throw new DefinitionError('Tanımda "layouts.keymap" (KLE dizilimi) bulunamadı.');
  }

  try {
    if ('lighting' in obj) {
      return {definition: reader.keyboardDefinitionV2ToVIADefinitionV2(obj as unknown as KeyboardDefinitionV2), version: 'v2'};
    }
    return {definition: reader.keyboardDefinitionV3ToVIADefinitionV3(obj as unknown as KeyboardDefinitionV3), version: 'v3'};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DefinitionError(`Tanım doğrulanamadı: ${message.split('\n').slice(0, 6).join(' ')}`);
  }
};

/** Display name; dynamic names pick an option once its value is known. */
export const definitionName = (definition: AnyDefinition, dynamicIndex?: number): string => {
  const {name} = definition;
  if (typeof name === 'string') return name;
  const options = name.options;
  return options[dynamicIndex ?? 0] ?? options[0];
};

/** Custom-menu command behind a dynamic definition name, if any. */
export const dynamicNameCommand = (definition: AnyDefinition): number[] | null => {
  const {name} = definition;
  if (typeof name === 'string') return null;
  const [, channel, valueId, ...extra] = name.content;
  return [channel, valueId, ...extra];
};
