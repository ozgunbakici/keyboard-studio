import {catalogIndex, type CustomKeycodeInfo} from './catalog';
import {KeycodeCodec, modNames} from './codec';
import {hostCharFor, hostLegend, type HostLayout} from './host-layouts';

export type KeyTone = 'normal' | 'mod' | 'layer' | 'macro' | 'special' | 'empty' | 'transparent' | 'custom';

export type KeyLabel = {
  /** Big centered text. */
  main: string;
  /** Small text above the main label (shifted symbol, modifier names). */
  top?: string;
  /** Small text under the main label (hold action, layer). */
  sub?: string;
  tone: KeyTone;
  /** Full explanation for tooltips. */
  title: string;
  code: string;
};

export type LabelContext = {
  codec: KeycodeCodec;
  host: HostLayout;
  os: 'mac' | 'other';
  macroNames?: (string | undefined)[];
  customKeycodes?: CustomKeycodeInfo[];
};

const macModifierLabels: Record<string, string> = {
  KC_LCTL: '⌃ Ctrl',
  KC_RCTL: '⌃ Ctrl',
  KC_LALT: '⌥ Opt',
  KC_RALT: '⌥ Opt',
  KC_LGUI: '⌘ Cmd',
  KC_RGUI: '⌘ Cmd',
};

const layerFnNames: Record<string, string> = {
  MO: 'basılıyken açar',
  TG: 'aç/kapat',
  TT: 'tut veya çift dokun',
  OSL: 'tek tuş için',
  TO: 'geçiş',
  DF: 'varsayılan katman',
  PDF: 'kalıcı varsayılan katman',
};

/** Label for a plain (basic) keycode name. */
const basicLabel = (name: string, ctx: LabelContext): Omit<KeyLabel, 'code'> => {
  if (name === 'KC_NO') return {main: '', tone: 'empty', title: 'Boş (KC_NO)'};
  if (name === 'KC_TRNS') return {main: '▽', tone: 'transparent', title: 'Geçirgen: alttaki katmandaki tuş çalışır'};
  const legend = hostLegend(ctx.host, name);
  const entry = catalogIndex.get(name);
  if (legend) {
    return {
      main: legend.main,
      top: legend.top,
      tone: 'normal',
      title: `${legend.top ? `${legend.main} / ${legend.top}` : legend.main} (${name}, ${ctx.host.short})`,
    };
  }
  if (ctx.os === 'mac' && macModifierLabels[name]) {
    return {main: macModifierLabels[name], tone: 'normal', title: `${macModifierLabels[name]} (${name})`};
  }
  if (entry) {
    return {
      main: entry.label,
      tone: 'normal',
      title: entry.title ? `${entry.label}: ${entry.title}` : `${entry.label} (${name})`,
    };
  }
  return {main: name.replace(/^KC_/, ''), tone: 'normal', title: name};
};

export const keyLabel = (value: number, ctx: LabelContext): KeyLabel => {
  const {codec} = ctx;
  const code = codec.format(value);
  const decoded = codec.decode(value);
  switch (decoded.kind) {
    case 'basic':
      return {...basicLabel(decoded.name, ctx), code};
    case 'named': {
      const entry = catalogIndex.get(decoded.name);
      return {
        main: entry?.label ?? decoded.name.replace(/^(KC_|QK_)/, ''),
        tone: 'special',
        title: entry?.title ? `${entry.label}: ${entry.title}` : decoded.name,
        code,
      };
    }
    case 'layer':
      return {
        main: `${decoded.fn} ${decoded.layer}`,
        tone: 'layer',
        title: `Katman ${decoded.layer}: ${layerFnNames[decoded.fn]}`,
        code,
      };
    case 'layerTap': {
      const base = basicLabel(codec.basicName(decoded.key), ctx);
      return {
        main: base.main || '∅',
        top: base.top,
        sub: `K${decoded.layer} tut`,
        tone: 'layer',
        title: `Dokununca ${base.main || 'hiçbir şey'}, basılı tutunca Katman ${decoded.layer}`,
        code,
      };
    }
    case 'modTap': {
      const base = basicLabel(codec.basicName(decoded.key), ctx);
      const mods = modNames(decoded.mods, ctx.os).join(ctx.os === 'mac' ? '' : '+');
      return {
        main: base.main || '∅',
        top: base.top,
        sub: `${mods} tut`,
        tone: 'mod',
        title: `Dokununca ${base.main}, basılı tutunca ${mods}`,
        code,
      };
    }
    case 'mods': {
      const keyName = codec.basicName(decoded.key);
      const char = hostCharFor(ctx.host, keyName, decoded.mods);
      const mods = modNames(decoded.mods, ctx.os).join(ctx.os === 'mac' ? '' : '+');
      const base = basicLabel(keyName, ctx);
      if (char) {
        return {
          main: char,
          sub: `${mods}+${base.main}`,
          tone: 'normal',
          title: `${char} karakteri (${mods}+${base.main}, ${ctx.host.short})`,
          code,
        };
      }
      return {
        main: base.main,
        top: mods,
        tone: 'special',
        title: `${mods}+${base.main} kısayolu`,
        code,
      };
    }
    case 'oneShotMod': {
      const mods = modNames(decoded.mods, ctx.os).join('+');
      return {main: `OSM`, sub: mods, tone: 'mod', title: `Tek seferlik ${mods}`, code};
    }
    case 'layerMod': {
      const mods = modNames(decoded.mods, ctx.os).join('+');
      return {
        main: `LM ${decoded.layer}`,
        sub: mods,
        tone: 'layer',
        title: `Katman ${decoded.layer} + ${mods}`,
        code,
      };
    }
    case 'macro': {
      const name = ctx.macroNames?.[decoded.index];
      return {
        main: `M${decoded.index}`,
        sub: name,
        tone: 'macro',
        title: name ? `Makro ${decoded.index}: ${name}` : `Makro ${decoded.index}`,
        code,
      };
    }
    case 'custom': {
      const custom = ctx.customKeycodes?.[decoded.index];
      return {
        main: custom?.shortName || custom?.name || `C${decoded.index}`,
        tone: 'custom',
        title: custom ? `${custom.name}${custom.title ? `: ${custom.title}` : ''}` : `Özel tuş ${decoded.index}`,
        code,
      };
    }
    case 'unknown':
      return {main: code, tone: 'special', title: `Bilinmeyen tuş kodu ${code}`, code};
  }
};
