import {useMemo} from 'react';
import {isV3} from '@/definitions/parse';
import {buildCustomGroup, buildLayerGroup, buildLightingGroup, buildMacroGroup, buildSymbolGroup, staticGroups, type CatalogGroup} from '@/keycodes/catalog';
import {KeycodeCodec} from '@/keycodes/codec';
import {hostLayouts} from '@/keycodes/host-layouts';
import type {LabelContext} from '@/keycodes/labels';
import {useStudio, type KeyboardData} from '@/state/store';
import {getCodec} from '@/state/actions';

const fallbackCodec = KeycodeCodec.forProtocol(12);

/** Display names for macro slots: first few characters of text macros. */
export const macroNames = (data?: KeyboardData): (string | undefined)[] =>
  (data?.macros ?? []).map((macro) => {
    const text = macro
      .filter((a) => a.type === 'text')
      .map((a) => (a.type === 'text' ? a.text : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? (text.length > 10 ? `${text.slice(0, 9)}…` : text) : undefined;
  });

export const useLabelContext = (): LabelContext => {
  const selectedId = useStudio((s) => s.selectedId);
  const data = useStudio((s) => (s.selectedId ? s.data[s.selectedId] : undefined));
  const host = useStudio((s) => s.settings.hostLayout);
  const os = useStudio((s) => s.settings.os);
  return useMemo(
    () => ({
      codec: getCodec(selectedId) ?? fallbackCodec,
      host: hostLayouts[host],
      os,
      macroNames: macroNames(data),
      customKeycodes: data?.definition.customKeycodes,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, data?.macros, data?.definition, host, os],
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
  return useMemo(() => {
    const groups: CatalogGroup[] = [staticGroups.basic, buildSymbolGroup(hostLayouts[host]), staticGroups.media];
    groups.push(buildLayerGroup(data?.layerCount ?? 4, protocol));
    if (data?.macroCount) groups.push(buildMacroGroup(data.macroCount, macroNames(data)));
    groups.push(staticGroups.special);
    if (data) {
      const lighting = buildLightingGroup(lightingSet(data, protocol));
      if (lighting) groups.push(lighting);
      const custom = buildCustomGroup(data.definition.customKeycodes);
      if (custom) groups.push(custom);
    }
    return groups;
  }, [data, protocol, host]);
};
