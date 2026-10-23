import type {KeycodeCodec} from '@/keycodes/codec';
import type {HostLayout} from '@/keycodes/host-layouts';
import {compileMacro, compileText} from '@/macros/host-text';
import {encodeMacro, type Macro} from '@/via/macro-bytes';
import {variantFor, type LibraryAction, type OsId} from './types';

/**
 * How an action reaches the computer on one OS:
 * - keycode: a single keycode on the key (shortcuts), no macro memory used;
 * - macro: a firmware macro typed by the keyboard itself;
 * - trigger: a helper trigger; the helper program on the computer does the work;
 * - unavailable: the action is incomplete or cannot be done.
 */
export type Delivery =
  | {mode: 'keycode'; keycode: number; summary: string}
  | {mode: 'macro'; macro: Macro; bytes: number; summary: string}
  | {mode: 'trigger'; reason: string; summary: string}
  | {mode: 'unavailable'; summary: string};

export type DeliveryContext = {codec: KeycodeCodec; host: HostLayout; protocol: number};

const byteSize = (macro: Macro, protocol: number) => {
  try {
    return encodeMacro(macro, protocol).length + 1;
  } catch {
    return Number.NaN;
  }
};

export const resolveDelivery = (action: LibraryAction, os: OsId, ctx: DeliveryContext): Delivery => {
  const variant = variantFor(action, os);
  switch (action.kind) {
    case 'shortcut': {
      const shortcut = variant.shortcut;
      const key = shortcut ? ctx.codec.parse(shortcut.key) : null;
      if (!shortcut || key === null || key > 0xff) return {mode: 'unavailable', summary: 'Kısayol tanımlanmamış'};
      const keycode = shortcut.mods ? ((shortcut.mods & 0x1f) << 8) | key : key;
      return {mode: 'keycode', keycode, summary: 'Tuşa doğrudan atanır (makro hafızası kullanmaz)'};
    }
    case 'text': {
      const text = variant.text ?? '';
      if (!text) return {mode: 'unavailable', summary: 'Metin boş'};
      const {macro, unsupported} = compileText(text, ctx.host);
      if (unsupported.length) {
        return {
          mode: 'trigger',
          reason: `${ctx.host.short} düzeni şunları yazamıyor: ${unsupported.join(' ')}`,
          summary: `Yardımcı program yazar (${unsupported.join(' ')} klavyeden yazılamıyor)`,
        };
      }
      const bytes = byteSize(macro, ctx.protocol);
      return {mode: 'macro', macro, bytes, summary: `Klavye yazar (${bytes} bayt makro)`};
    }
    case 'sequence': {
      const steps = variant.steps ?? [];
      if (!steps.length) return {mode: 'unavailable', summary: 'Adım yok'};
      const {macro, unsupported} = compileMacro(steps, ctx.host);
      if (unsupported.length) return {mode: 'unavailable', summary: `${ctx.host.short} düzeni şunları yazamıyor: ${unsupported.join(' ')}`};
      const bytes = byteSize(macro, ctx.protocol);
      if (Number.isNaN(bytes)) return {mode: 'unavailable', summary: 'Bu firmware bu adımları desteklemiyor (ör. bekleme)'};
      return {mode: 'macro', macro, bytes, summary: `Klavye çalıştırır (${bytes} bayt makro)`};
    }
    case 'app':
    case 'script':
    case 'url': {
      if (!variant.target?.trim()) return {mode: 'unavailable', summary: 'Hedef boş'};
      const what = action.kind === 'app' ? 'Uygulamayı' : action.kind === 'url' ? 'Adresi' : 'Komutu';
      return {mode: 'trigger', reason: 'Klavye program çalıştıramaz', summary: `${what} yardımcı program açar`};
    }
  }
};
