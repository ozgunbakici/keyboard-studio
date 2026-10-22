import type {Macro, MacroAction} from '@/via/macro-bytes';

/** Editor-friendly view of a macro: chords are one step instead of down/tap/up. */
export type MacroStep =
  | {kind: 'text'; text: string}
  | {kind: 'tap'; keycode: number}
  | {kind: 'chord'; mods: number[]; keycode: number}
  | {kind: 'down'; keycode: number}
  | {kind: 'up'; keycode: number}
  | {kind: 'delay'; ms: number};

export const MODIFIER_KEYCODES = [0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7];
export const isModifierKeycode = (keycode: number) => keycode >= 0xe0 && keycode <= 0xe7;

export const macroToSteps = (macro: Macro): MacroStep[] => {
  const steps: MacroStep[] = [];
  for (let i = 0; i < macro.length; i++) {
    const action = macro[i];
    if (action.type === 'down' && isModifierKeycode(action.keycode)) {
      const downs: number[] = [];
      let j = i;
      while (macro[j]?.type === 'down' && isModifierKeycode((macro[j] as {keycode: number}).keycode)) {
        downs.push((macro[j] as {keycode: number}).keycode);
        j++;
      }
      const tap = macro[j];
      const ups = macro.slice(j + 1, j + 1 + downs.length);
      if (tap?.type === 'tap' && ups.length === downs.length && ups.every((u, k) => u.type === 'up' && u.keycode === downs[downs.length - 1 - k])) {
        steps.push({kind: 'chord', mods: downs, keycode: tap.keycode});
        i = j + downs.length;
        continue;
      }
    }
    switch (action.type) {
      case 'text':
        steps.push({kind: 'text', text: action.text});
        break;
      case 'tap':
        steps.push({kind: 'tap', keycode: action.keycode});
        break;
      case 'down':
        steps.push({kind: 'down', keycode: action.keycode});
        break;
      case 'up':
        steps.push({kind: 'up', keycode: action.keycode});
        break;
      case 'delay':
        steps.push({kind: 'delay', ms: action.ms});
        break;
    }
  }
  return steps;
};

export const stepsToMacro = (steps: MacroStep[]): Macro =>
  steps.flatMap((step): MacroAction[] => {
    switch (step.kind) {
      case 'text':
        return step.text ? [{type: 'text', text: step.text}] : [];
      case 'tap':
        return [{type: 'tap', keycode: step.keycode}];
      case 'chord':
        return [
          ...step.mods.map((keycode) => ({type: 'down', keycode}) as MacroAction),
          {type: 'tap', keycode: step.keycode},
          ...[...step.mods].reverse().map((keycode) => ({type: 'up', keycode}) as MacroAction),
        ];
      case 'down':
        return [{type: 'down', keycode: step.keycode}];
      case 'up':
        return [{type: 'up', keycode: step.keycode}];
      case 'delay':
        return [{type: 'delay', ms: step.ms}];
    }
  });

/** True when a macro is only text, so the simple text editor can show it. */
export const isTextOnly = (macro: Macro) => macro.every((a) => a.type === 'text');

export const macroText = (macro: Macro) => macro.map((a) => (a.type === 'text' ? a.text : '')).join('');

export const sameMacro = (a: Macro, b: Macro) => JSON.stringify(a) === JSON.stringify(b);
