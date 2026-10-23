/**
 * Helper triggers: key combinations no keyboard or app normally uses
 * (modifiers + F13–F20). The keyboard sends one; the helper program on the
 * computer (AutoHotkey / Hammerspoon) runs the matching action. F13–F20 is the
 * range macOS and Hammerspoon recognise.
 */

const FUNCTION_KEYS = Array.from({length: 8}, (_, i) => ({name: `F${13 + i}`, keycode: 0x68 + i}));

// Ctrl+Alt+Shift first; then two-modifier sets. Win/Cmd combos are avoided
// (Windows reserves Ctrl+Alt+Shift+Win for the Office key).
const MOD_SETS = [0x07, 0x03, 0x05, 0x06];

export const TRIGGER_POOL: number[] = MOD_SETS.flatMap((mods) => FUNCTION_KEYS.map((key) => (mods << 8) | key.keycode));

export const isTrigger = (keycode: number) => TRIGGER_POOL.includes(keycode);

export const allocateTrigger = (used: Iterable<number>): number | null => {
  const taken = new Set(used);
  return TRIGGER_POOL.find((t) => !taken.has(t)) ?? null;
};

export type TriggerParts = {ctrl: boolean; alt: boolean; shift: boolean; key: string};

export const triggerParts = (keycode: number): TriggerParts => {
  const mods = (keycode >> 8) & 0x1f;
  return {
    ctrl: !!(mods & 0x01),
    shift: !!(mods & 0x02),
    alt: !!(mods & 0x04),
    key: `F${13 + ((keycode & 0xff) - 0x68)}`,
  };
};

export const triggerLabel = (keycode: number, os: 'mac' | 'windows') => {
  const p = triggerParts(keycode);
  if (os === 'mac') return `${p.ctrl ? '⌃' : ''}${p.alt ? '⌥' : ''}${p.shift ? '⇧' : ''}${p.key}`;
  return [p.ctrl && 'Ctrl', p.alt && 'Alt', p.shift && 'Shift', p.key].filter(Boolean).join('+');
};

/** AutoHotkey v2 hotkey syntax, e.g. ^!+F13. */
export const ahkHotkey = (keycode: number) => {
  const p = triggerParts(keycode);
  return `${p.ctrl ? '^' : ''}${p.alt ? '!' : ''}${p.shift ? '+' : ''}${p.key}`;
};

/** Hammerspoon modifier list and key, e.g. {"ctrl","alt","shift"}, "f13". */
export const hammerspoonHotkey = (keycode: number) => {
  const p = triggerParts(keycode);
  const mods = [p.ctrl && 'ctrl', p.alt && 'alt', p.shift && 'shift'].filter(Boolean) as string[];
  return {mods, key: p.key.toLowerCase()};
};
