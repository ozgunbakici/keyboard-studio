import {resolveDelivery, type DeliveryContext} from './delivery';
import {ahkHotkey, hammerspoonHotkey, triggerLabel} from './triggers';
import {variantFor, type LibraryAction, type OsId} from './types';

/**
 * Generates the helper program configuration for each OS. The keyboard sends
 * a trigger combination; the helper turns it into "open this app", "run this
 * command", "open this URL" or "type this Unicode text".
 */

export type HelperEntry = {action: LibraryAction; trigger: number; kind: LibraryAction['kind']; value: string};

/** Actions that need the helper on `os`, with what the helper must do. */
export const helperEntries = (actions: LibraryAction[], os: OsId, ctx: DeliveryContext): HelperEntry[] =>
  actions
    .filter((action) => action.trigger !== undefined && resolveDelivery(action, os, ctx).mode === 'trigger')
    .map((action) => {
      const variant = variantFor(action, os);
      const value = action.kind === 'text' ? variant.text ?? '' : variant.target?.trim() ?? '';
      return {action, trigger: action.trigger!, kind: action.kind, value};
    })
    .filter((entry) => entry.value)
    .sort((a, b) => a.trigger - b.trigger);

/** Changes whenever the generated helper file would do something different. */
export const helperSignature = (entries: HelperEntry[]) => entries.map((e) => `${e.trigger}|${e.kind}|${e.value}`).join('\n');

const stamp = () => new Date().toLocaleString('tr-TR', {dateStyle: 'short', timeStyle: 'short'});

// AutoHotkey v2 single-quoted strings escape ' and ` with a backtick.
const ahkString = (text: string) =>
  `'${text.replace(/`/g, '``').replace(/'/g, "`'").replace(/\r?\n/g, '`n').replace(/\t/g, '`t')}'`;

/** Program paths with spaces need their own quotes inside the command line. */
const ahkRunTarget = (target: string) => {
  const t = target.trim();
  if (!t.startsWith('"') && /^[a-z]:\\/i.test(t) && /\s/.test(t) && /\.(exe|bat|cmd|lnk|ps1)$/i.test(t)) return ahkString(`"${t}"`);
  return ahkString(t);
};

export const buildAutoHotkey = (entries: HelperEntry[]) => {
  const lines = [
    '; Klavye Stüdyo yardımcı programı · Windows (AutoHotkey v2)',
    `; Üretildi: ${stamp()}. Kütüphanede değişiklik yapınca bu dosyayı yeniden indir.`,
    '; Açılışta çalışması için: Win+R → shell:startup → bu dosyanın kısayolunu oraya koy.',
    '#Requires AutoHotkey v2.0',
    '#SingleInstance Force',
    '',
  ];
  for (const entry of entries) {
    lines.push(`; ${entry.action.name} — ${triggerLabel(entry.trigger, 'windows')}`);
    const hotkey = ahkHotkey(entry.trigger);
    switch (entry.kind) {
      case 'text':
        lines.push(`${hotkey}::SendText ${ahkString(entry.value)}`);
        break;
      case 'app':
      case 'url':
      case 'script':
        lines.push(`${hotkey}::Run ${ahkRunTarget(entry.value)}`);
        break;
      default:
        lines.push(`; (bu eylem türü yardımcıda desteklenmiyor)`);
    }
    lines.push('');
  }
  if (!entries.length) lines.push('; Henüz yardımcı gerektiren eylem yok.');
  return lines.join('\r\n');
};

/** Lua long string that cannot be closed by the text itself. */
const luaString = (text: string) => {
  let level = 0;
  while (text.includes(`]${'='.repeat(level)}]`)) level++;
  const eq = '='.repeat(level);
  // A newline right after the opening bracket is dropped by Lua; keep it.
  return `[${eq}[${text.startsWith('\n') ? '\n' : ''}${text}]${eq}]`;
};

const luaTypeText = (text: string) => {
  // keyStrokes does not press Return for newlines, so send it explicitly.
  const parts = text.split('\n');
  return parts
    .map((part, i) => [part ? `hs.eventtap.keyStrokes(${luaString(part)})` : '', i < parts.length - 1 ? 'hs.eventtap.keyStroke({}, "return", 0)' : ''])
    .flat()
    .filter(Boolean)
    .join('; ');
};

export const buildHammerspoon = (entries: HelperEntry[]) => {
  const lines = [
    '-- Klavye Stüdyo yardımcı programı · macOS (Hammerspoon)',
    `-- Üretildi: ${stamp()}. Kütüphanede değişiklik yapınca bu dosyayı yeniden indir.`,
    '-- Kurulum: bu dosyayı ~/.hammerspoon/klavye-studio.lua olarak kaydet,',
    '-- ~/.hammerspoon/init.lua içine require("klavye-studio") satırını ekle ve Hammerspoon’da "Reload Config" de.',
    '',
    'local function bind(mods, key, fn) hs.hotkey.bind(mods, key, fn) end',
    '',
  ];
  for (const entry of entries) {
    const {mods, key} = hammerspoonHotkey(entry.trigger);
    const modList = `{${mods.map((m) => `"${m}"`).join(', ')}}`;
    let body: string;
    switch (entry.kind) {
      case 'text':
        body = luaTypeText(entry.value);
        break;
      case 'app':
        body = `hs.application.launchOrFocus(${luaString(entry.value)})`;
        break;
      case 'url':
        body = `hs.urlevent.openURL(${luaString(entry.value)})`;
        break;
      case 'script':
        body = `hs.task.new("/bin/zsh", nil, {"-lc", ${luaString(entry.value)}}):start()`;
        break;
      default:
        body = '-- (bu eylem türü yardımcıda desteklenmiyor)';
    }
    lines.push(`-- ${entry.action.name} — ${triggerLabel(entry.trigger, 'mac')}`);
    lines.push(`bind(${modList}, "${key}", function() ${body} end)`);
    lines.push('');
  }
  if (!entries.length) lines.push('-- Henüz yardımcı gerektiren eylem yok.');
  lines.push('hs.alert.show("Klavye Stüdyo yardımcısı yüklendi")');
  return lines.join('\n');
};
