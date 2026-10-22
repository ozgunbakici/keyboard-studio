import type {KeycodeCodec} from '@/keycodes/codec';
import {decodeMacros, type Macro} from '@/via/macro-bytes';
import {expressionToMacro, macroToExpression} from '@/via/macro-expression';

/** Full snapshot of a keyboard's configurable state. */
export type BackupFile = {
  format: 'klavye-studio-backup';
  version: 1;
  createdAt: string;
  keyboard: {name: string; vendorId: number; productId: number; vendorProductId: number};
  protocol: number;
  matrix: {rows: number; cols: number};
  /** Keycode names: portable between firmware/protocol versions. */
  layers: string[][];
  /** Exact 16-bit values as read from the keyboard. */
  rawLayers: number[][];
  /** [layer][encoder] = [counter-clockwise, clockwise] names. */
  encoders?: [string, string][][];
  layoutOptions?: number;
  macros?: {count: number; bufferSize: number; bytes: number[]; expressions: string[]};
  menuValues?: Record<string, {command: number[]; value: number[]}>;
};

/** VIA's own save file (.layout.json). */
export type ViaSaveFile = {
  name: string;
  vendorProductId: number;
  layers: string[][];
  macros?: string[];
  encoders?: [string, string][][];
};

export const isBackupFile = (json: unknown): json is BackupFile =>
  !!json && typeof json === 'object' && (json as BackupFile).format === 'klavye-studio-backup';

export const isViaSaveFile = (json: unknown): json is ViaSaveFile =>
  !!json &&
  typeof json === 'object' &&
  typeof (json as ViaSaveFile).vendorProductId === 'number' &&
  Array.isArray((json as ViaSaveFile).layers);

export type SnapshotInput = {
  name: string;
  vendorId: number;
  productId: number;
  vendorProductId: number;
  protocol: number;
  matrix: {rows: number; cols: number};
  keymap: number[][];
  encoders: [number, number][][];
  layoutOptions?: number;
  macroCount: number;
  macroBufferSize: number;
  macroBytes: number[];
  menuValues: Record<string, number[]>;
  menuCommands: Record<string, number[]>;
};

export const createBackup = (input: SnapshotInput, codec: KeycodeCodec): BackupFile => {
  const macros = input.macroCount > 0 ? decodeMacros(input.macroBytes, input.macroCount, input.protocol) : [];
  return {
    format: 'klavye-studio-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    keyboard: {
      name: input.name,
      vendorId: input.vendorId,
      productId: input.productId,
      vendorProductId: input.vendorProductId,
    },
    protocol: input.protocol,
    matrix: input.matrix,
    layers: input.keymap.map((layer) => layer.map((value) => codec.format(value))),
    rawLayers: input.keymap.map((layer) => [...layer]),
    encoders: input.encoders.length
      ? input.encoders.map((layer) => layer.map(([ccw, cw]) => [codec.format(ccw), codec.format(cw)] as [string, string]))
      : undefined,
    layoutOptions: input.layoutOptions,
    macros: input.macroCount
      ? {
          count: input.macroCount,
          bufferSize: input.macroBufferSize,
          bytes: [...input.macroBytes],
          expressions: macros.map((macro) => macroToExpression(macro, codec)),
        }
      : undefined,
    menuValues: Object.fromEntries(
      Object.entries(input.menuValues)
        .filter(([name]) => input.menuCommands[name])
        .map(([name, value]) => [name, {command: input.menuCommands[name], value: [...value]}]),
    ),
  };
};

export const toViaSaveFile = (backup: BackupFile): ViaSaveFile => ({
  name: backup.keyboard.name,
  vendorProductId: backup.keyboard.vendorProductId,
  layers: backup.layers,
  macros: backup.macros?.expressions,
  encoders: backup.encoders,
});

export type RestorePlan = {
  keymap: number[][];
  encoders?: [number, number][][];
  layoutOptions?: number;
  macros?: Macro[];
  menuValues?: Record<string, {command: number[]; value: number[]}>;
  warnings: string[];
};

/**
 * Turns a backup (ours or VIA's) into values for the connected keyboard.
 * Names are preferred over raw values so backups survive firmware updates
 * that change keycode numbering.
 */
export const planRestore = (
  file: BackupFile | ViaSaveFile,
  codec: KeycodeCodec,
  target: {layerCount: number; rows: number; cols: number; protocol: number; macroCount: number},
): RestorePlan => {
  const warnings: string[] = [];
  const size = target.rows * target.cols;
  const parseList = (names: string[], raw?: number[]) =>
    Array.from({length: size}, (_, i) => {
      const name = names[i];
      const parsed = name === undefined || name === '' ? 0 : codec.parse(name);
      if (parsed === null) {
        if (raw?.[i] !== undefined) return raw[i];
        warnings.push(`Tanınmayan tuş kodu "${name}" boş bırakıldı.`);
        return 0;
      }
      return parsed;
    });

  const sourceLayers = file.layers;
  if (sourceLayers.length > target.layerCount) {
    warnings.push(`Yedekte ${sourceLayers.length} katman var, klavye ${target.layerCount} katman destekliyor; fazlası atlandı.`);
  }
  const rawLayers = isBackupFile(file) ? file.rawLayers : undefined;
  const keymap = sourceLayers
    .slice(0, target.layerCount)
    .map((layer, l) => parseList(layer, isBackupFile(file) && file.protocol === target.protocol ? rawLayers?.[l] : undefined));

  const encoders = file.encoders?.slice(0, target.layerCount).map((layer) =>
    layer.map(([ccw, cw]) => [codec.parse(ccw) ?? 0, codec.parse(cw) ?? 0] as [number, number]),
  );

  let macros: Macro[] | undefined;
  const expressions = isBackupFile(file) ? file.macros?.expressions : file.macros;
  if (expressions && target.macroCount > 0) {
    macros = [];
    for (const [i, expression] of expressions.slice(0, target.macroCount).entries()) {
      try {
        macros.push(expressionToMacro(expression, codec));
      } catch (error) {
        warnings.push(`Makro ${i} okunamadı: ${(error as Error).message}`);
        macros.push([]);
      }
    }
    while (macros.length < target.macroCount) macros.push([]);
  }

  return {
    keymap,
    encoders,
    layoutOptions: isBackupFile(file) ? file.layoutOptions : undefined,
    macros,
    menuValues: isBackupFile(file) ? file.menuValues : undefined,
    warnings,
  };
};
