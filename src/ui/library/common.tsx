import {useMemo} from 'react';
import {AppWindow, Command, Globe, ListOrdered, Terminal, Type, type LucideIcon} from 'lucide-react';
import {catalogIndex} from '@/keycodes/catalog';
import {resolveDelivery, type Delivery} from '@/library/delivery';
import type {ActionKind, LibraryAction, OsId, ShortcutDef} from '@/library/types';
import {deliveryContext} from '@/state/actions';
import {useStudio} from '@/state/store';

export const kindIcons: Record<ActionKind, LucideIcon> = {
  shortcut: Command,
  text: Type,
  sequence: ListOrdered,
  app: AppWindow,
  script: Terminal,
  url: Globe,
};

export const kindOrder: ActionKind[] = ['shortcut', 'text', 'sequence', 'app', 'script', 'url'];

export const kindHints: Record<ActionKind, string> = {
  shortcut: 'Ctrl+C gibi bir tuş kombinasyonu',
  text: 'E-posta, imza, kod parçası yazar',
  sequence: 'Tuşlar, kısayollar ve beklemeler',
  app: 'Bir uygulamayı açar (yardımcı program ile)',
  script: 'Bir komut çalıştırır (yardımcı program ile)',
  url: 'Tarayıcıda bir adres açar (yardımcı program ile)',
};

export const deliveryModeText: Record<Delivery['mode'], string> = {
  keycode: 'tuş kodu',
  macro: 'klavye makrosu',
  trigger: 'yardımcı program',
  unavailable: 'eksik',
};

export const deliveryTone: Record<Delivery['mode'], 'success' | 'macro' | 'accent' | 'danger'> = {
  keycode: 'success',
  macro: 'macro',
  trigger: 'accent',
  unavailable: 'danger',
};

// Usual reading order on each OS: Win+Shift+S on Windows, ⌃⌥⇧⌘ on macOS.
const windowsMods: [number, string][] = [
  [0x08, 'Win'],
  [0x01, 'Ctrl'],
  [0x04, 'Alt'],
  [0x02, 'Shift'],
];
const macMods: [number, string][] = [
  [0x01, '⌃'],
  [0x04, '⌥'],
  [0x02, '⇧'],
  [0x08, '⌘'],
];

/** Human form of a shortcut, e.g. "Ctrl+Shift+T" or "⇧⌘T". */
export const shortcutText = (shortcut: ShortcutDef | undefined, os: OsId) => {
  if (!shortcut?.key) return '';
  const key = catalogIndex.get(shortcut.key)?.label ?? shortcut.key.replace(/^KC_/, '');
  const mods = (os === 'mac' ? macMods : windowsMods).filter(([bit]) => shortcut.mods & bit).map(([, name]) => name);
  return os === 'mac' ? `${mods.join('')}${key}` : [...mods, key].join('+');
};

/** Delivery context for an OS that follows the settings and the selected keyboard. */
export const useDeliveryContext = (os: OsId) => {
  const selectedId = useStudio((s) => s.selectedId);
  const settings = useStudio((s) => s.settings);
  const protocol = useStudio((s) => (s.selectedId ? s.sessions[s.selectedId]?.protocol : undefined));
  // deliveryContext reads the settings and session itself; they are listed so it recomputes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => deliveryContext(selectedId, os), [selectedId, os, settings, protocol]);
};

export const useDelivery = (action: LibraryAction, os: OsId) => {
  const ctx = useDeliveryContext(os);
  return useMemo(() => resolveDelivery(action, os, ctx), [action, os, ctx]);
};

export const useCurrentOs = (): OsId => useStudio((s) => (s.settings.os === 'mac' ? 'mac' : 'windows'));
