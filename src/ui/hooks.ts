import {useMemo} from 'react';
import {isV3} from '@/definitions/parse';
import {buildCustomGroup, buildLayerGroup, buildLightingGroup, buildMacroGroup, buildSymbolGroup, staticGroups, type CatalogGroup} from '@/keycodes/catalog';
import {KeycodeCodec} from '@/keycodes/codec';
import {hostLayouts} from '@/keycodes/host-layouts';
import type {KeyLabel, LabelContext} from '@/keycodes/labels';
import {useLibrary} from '@/library/store';
import {bindingKey, kindLabel, type ActionKind, type LibraryAction} from '@/library/types';
import {useStudio, type KeyboardData} from '@/state/store';
import {getCodec} from '@/state/actions';

const fallbackCodec = KeycodeCodec.forProtocol(12);

const shorten = (text: string, max = 10) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Display names for macro slots: the library action that owns it, else the first characters of its text. */
export const macroNames = (data?: KeyboardData, owners?: Map<number, string>): (string | undefined)[] =>
  (data?.macros ?? []).map((macro, slot) => {
    const owner = owners?.get(slot);
    if (owner) return shorten(owner);
    const text = macro
      .filter((a) => a.type === 'text')
      .map((a) => (a.type === 'text' ? a.text : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? shorten(text) : undefined;
  });

const useSelectedVpid = () => useStudio((s) => (s.selectedId ? s.sessions[s.selectedId]?.vendorProductId : undefined));

/** Macro slots of the selected keyboard that library actions own: slot → action name. */
export const useSlotOwners = () => {
  const vpid = useSelectedVpid();
  const slots = useLibrary((s) => s.slots);
  const actions = useLibrary((s) => s.actions);
  return useMemo(() => {
    const names = new Map(actions.map((a) => [a.id, a]));
    const owners = new Map<number, LibraryAction>();
    for (const slot of slots) {
      const action = names.get(slot.actionId);
      if (slot.vendorProductId === vpid && action) owners.set(slot.slot, action);
    }
    return owners;
  }, [vpid, slots, actions]);
};

const useSlotNames = () => {
  const owners = useSlotOwners();
  return useMemo(() => new Map([...owners].map(([slot, action]) => [slot, action.name])), [owners]);
};

/** Library actions on the selected keyboard's keys, by binding position. */
export const useBoundActions = () => {
  const vpid = useSelectedVpid();
  const bindings = useLibrary((s) => s.bindings);
  const actions = useLibrary((s) => s.actions);
  return useMemo(() => {
    const byId = new Map(actions.map((a) => [a.id, a]));
    const bound = new Map<string, LibraryAction>();
    for (const binding of bindings) {
      const action = binding.vendorProductId === vpid ? byId.get(binding.actionId) : undefined;
      if (action) bound.set(bindingKey(binding), action);
    }
    return {vpid, bound};
  }, [vpid, bindings, actions]);
};

const kindShort: Record<ActionKind, string> = {
  text: 'metin',
  shortcut: 'kısayol',
  sequence: 'dizi',
  app: 'uygulama',
  script: 'komut',
  url: 'web',
};

/** Splits a long name over two lines at the space nearest the middle. */
const keyCapName = (name: string) => {
  if (name.length <= 7) return name;
  const spaces = [...name.matchAll(/ /g)].map((m) => m.index!);
  if (!spaces.length) return shorten(name, 9);
  const mid = name.length / 2;
  const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  return `${shorten(name.slice(0, at), 9)}\n${shorten(name.slice(at + 1), 9)}`;
};

/** Key cap label for a key that runs a library action. */
export const actionKeyLabel = (action: LibraryAction, current: KeyLabel): KeyLabel => ({
  main: keyCapName(action.name),
  sub: kindShort[action.kind],
  tone: 'action',
  title: `${action.name} (${kindLabel[action.kind]}, kütüphane eylemi) — şu an: ${current.title}`,
  code: current.code,
});

export const useLabelContext = (): LabelContext => {
  const selectedId = useStudio((s) => s.selectedId);
  const data = useStudio((s) => (s.selectedId ? s.data[s.selectedId] : undefined));
  const host = useStudio((s) => s.settings.hostLayout);
  const os = useStudio((s) => s.settings.os);
  const slotNames = useSlotNames();
  return useMemo(
    () => ({
      codec: getCodec(selectedId) ?? fallbackCodec,
      host: hostLayouts[host],
      os,
      macroNames: macroNames(data, slotNames),
      customKeycodes: data?.definition.customKeycodes,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, data?.macros, data?.definition, host, os, slotNames],
  );
};

const lightingSet = (data: KeyboardData, protocol: number) => {
  const definition = data.definition;
  if (!isV3(definition)) {
    const lighting = typeof definition.lighting === 'string' ? definition.lighting : definition.lighting.extends;
    const has = lighting !== 'none';
    return {backlight: has, legacyRgb: has, underglow: false, rgbMatrix: false};
  }
  const modules = (definition.keycodes ?? []) as string[];
  const menuIds = (definition.menus ?? []).filter((m): m is string => typeof m === 'string');
  const modern = protocol >= 13;
  const compat = modules.includes('qmk_lighting');
  const explicitBacklight = modules.includes('qmk_backlight_keycodes') || modules.includes('qmk_backlight_rgblight_keycodes');
  const explicitRgbLight = modules.includes('qmk_rgblight_keycodes') || modules.includes('qmk_backlight_rgblight_keycodes');
  const explicitMatrix = modules.includes('qmk_rgb_matrix_keycodes');
  if (!modern) {
    return {
      backlight: compat || explicitBacklight,
      legacyRgb: compat || explicitRgbLight || explicitMatrix,
      underglow: false,
      rgbMatrix: false,
    };
  }
  if (explicitBacklight || explicitRgbLight || explicitMatrix) {
    return {backlight: explicitBacklight, legacyRgb: false, underglow: explicitRgbLight, rgbMatrix: explicitMatrix};
  }
  if (!compat) return {backlight: false, legacyRgb: false, underglow: false, rgbMatrix: false};
  const backlightMenu = menuIds.includes('qmk_backlight') || menuIds.includes('qmk_backlight_rgblight');
  const rgbLightMenu = menuIds.includes('qmk_rgblight') || menuIds.includes('qmk_backlight_rgblight');
  const matrixMenu = menuIds.includes('qmk_rgb_matrix');
  const known = backlightMenu || rgbLightMenu || matrixMenu;
  return {backlight: backlightMenu, legacyRgb: false, underglow: !known || rgbLightMenu, rgbMatrix: !known || matrixMenu};
};

/** Keycode picker groups for the selected keyboard. */
export const useCatalog = (): CatalogGroup[] => {
  const data = useStudio((s) => (s.selectedId ? s.data[s.selectedId] : undefined));
  const protocol = useStudio((s) => (s.selectedId ? s.sessions[s.selectedId]?.protocol ?? 12 : 12));
  const host = useStudio((s) => s.settings.hostLayout);
  const slotNames = useSlotNames();
  return useMemo(() => {
    const groups: CatalogGroup[] = [staticGroups.basic, buildSymbolGroup(hostLayouts[host]), staticGroups.media];
    groups.push(buildLayerGroup(data?.layerCount ?? 4, protocol));
    if (data?.macroCount) groups.push(buildMacroGroup(data.macroCount, macroNames(data, slotNames)));
    groups.push(staticGroups.special);
    if (data) {
      const lighting = buildLightingGroup(lightingSet(data, protocol));
      if (lighting) groups.push(lighting);
      const custom = buildCustomGroup(data.definition.customKeycodes);
      if (custom) groups.push(custom);
    }
    return groups;
  }, [data, protocol, host, slotNames]);
};
