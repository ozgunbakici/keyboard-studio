import type {Macro} from '@/via/macro-bytes';

export type OsId = 'windows' | 'mac';
export const osIds: OsId[] = ['windows', 'mac'];
export const osLabel: Record<OsId, string> = {windows: 'Windows', mac: 'macOS'};

export type ActionKind = 'text' | 'shortcut' | 'sequence' | 'app' | 'script' | 'url';

/** Modifiers use QMK's 5-bit mask: 0x01 Ctrl, 0x02 Shift, 0x04 Alt, 0x08 Win/Cmd, 0x10 right-hand. */
export type ShortcutDef = {mods: number; key: string};

export type ActionVariant = {
  /** kind "text": the text to type. */
  text?: string;
  /** kind "shortcut". */
  shortcut?: ShortcutDef;
  /** kind "sequence": text steps hold the intended text, as in the macro editor. */
  steps?: Macro;
  /** kind "app": program/app name or path; "url": address; "script": shell command. */
  target?: string;
};

/**
 * Something a key can do, defined once and reused on every keyboard. Variants
 * let the same key behave correctly on Windows and macOS.
 */
export type LibraryAction = {
  id: string;
  name: string;
  kind: ActionKind;
  tags: string[];
  /** When false, the Windows variant is used on every OS. */
  perOs: boolean;
  variants: Record<OsId, ActionVariant>;
  /** Helper trigger (a modifier + F13–F20 keycode), assigned on first use. */
  trigger?: number;
  createdAt: number;
  updatedAt: number;
};

/** A library action placed on a key of a keyboard model. */
export type KeyBinding = {
  id?: number;
  vendorProductId: number;
  layer: number;
  /** Matrix position, or an encoder direction. */
  row: number;
  col: number;
  encoder?: {index: number; cw: boolean};
  /** Empty when the action was removed: the next sync clears the key, then drops the binding. */
  actionId: string;
  /** What the key showed on layer 0 when the action was placed, to find it again later. */
  keyName?: string;
};

/** A macro slot of a keyboard model that the library manages. */
export type SlotUse = {vendorProductId: number; slot: number; actionId: string};

export const kindLabel: Record<ActionKind, string> = {
  text: 'Metin',
  shortcut: 'Kısayol',
  sequence: 'Adım dizisi',
  app: 'Uygulama aç',
  script: 'Komut çalıştır',
  url: 'Web adresi aç',
};

export const variantFor = (action: LibraryAction, os: OsId): ActionVariant =>
  action.perOs ? action.variants[os] : action.variants.windows;

export const bindingKey = (b: Pick<KeyBinding, 'vendorProductId' | 'layer' | 'row' | 'col' | 'encoder'>) =>
  `${b.vendorProductId}:${b.layer}:${b.encoder ? `e${b.encoder.index}${b.encoder.cw ? '+' : '-'}` : `${b.row},${b.col}`}`;
