import type {KeycodeCodec} from '@/keycodes/codec';
import type {Macro, MacroAction} from './macro-bytes';

/**
 * VIA's textual macro format, used in its .layout.json save files:
 *   text, {KC_A} tap, {+KC_A} down, {-KC_A} up, {KC_LCTL,KC_C} chord, {250} delay,
 *   and \{ for a literal brace.
 */

export const macroToExpression = (macro: Macro, codec: KeycodeCodec): string => {
  const name = (keycode: number) => codec.basicName(keycode);
  const parts: string[] = [];
  for (let i = 0; i < macro.length; i++) {
    const action = macro[i];
    // Collapse "down mods, tap key, up mods (reversed)" into a chord.
    if (action.type === 'down') {
      const downs: number[] = [];
      let j = i;
      while (macro[j]?.type === 'down') downs.push((macro[j++] as {keycode: number}).keycode);
      const tap = macro[j];
      const ups = macro.slice(j + 1, j + 1 + downs.length);
      const isChord =
        tap?.type === 'tap' &&
        ups.length === downs.length &&
        ups.every((up, k) => up.type === 'up' && up.keycode === downs[downs.length - 1 - k]);
      if (isChord && tap.type === 'tap') {
        parts.push(`{${[...downs, tap.keycode].map(name).join(',')}}`);
        i = j + downs.length;
        continue;
      }
    }
    switch (action.type) {
      case 'text':
        parts.push(action.text.replace(/{/g, '\\{'));
        break;
      case 'tap':
        parts.push(`{${name(action.keycode)}}`);
        break;
      case 'down':
        parts.push(`{+${name(action.keycode)}}`);
        break;
      case 'up':
        parts.push(`{-${name(action.keycode)}}`);
        break;
      case 'delay':
        parts.push(`{${action.ms}}`);
        break;
    }
  }
  return parts.join('');
};

export class MacroExpressionError extends Error {}

export const expressionToMacro = (expression: string, codec: KeycodeCodec): Macro => {
  const actions: MacroAction[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = actions[actions.length - 1];
    if (last?.type === 'text') last.text += text;
    else actions.push({type: 'text', text});
  };
  const basic = (token: string) => {
    const value = codec.parse(token);
    if (value === null || value > 0xff) throw new MacroExpressionError(`Makroda geçersiz tuş: ${token}`);
    return value;
  };
  let i = 0;
  let text = '';
  while (i < expression.length) {
    const c = expression[i];
    if (c === '\\' && expression[i + 1] === '{') {
      text += '{';
      i += 2;
      continue;
    }
    if (c !== '{') {
      text += c;
      i++;
      continue;
    }
    const end = expression.indexOf('}', i);
    if (end === -1) throw new MacroExpressionError('Kapanmamış { bloğu');
    pushText(text);
    text = '';
    const body = expression.slice(i + 1, end).replace(/\s+/g, '');
    i = end + 1;
    if (!body) throw new MacroExpressionError('Boş {} bloğu');
    if (/^\d+$/.test(body)) {
      actions.push({type: 'delay', ms: Number.parseInt(body, 10)});
      continue;
    }
    if (body[0] === '+' || body[0] === '-') {
      actions.push({type: body[0] === '+' ? 'down' : 'up', keycode: basic(body.slice(1))});
      continue;
    }
    const keys = body.split(',').filter(Boolean).map(basic);
    if (keys.length === 1) {
      actions.push({type: 'tap', keycode: keys[0]});
    } else {
      const mods = keys.slice(0, -1);
      mods.forEach((keycode) => actions.push({type: 'down', keycode}));
      actions.push({type: 'tap', keycode: keys[keys.length - 1]});
      [...mods].reverse().forEach((keycode) => actions.push({type: 'up', keycode}));
    }
  }
  pushText(text);
  return actions;
};
