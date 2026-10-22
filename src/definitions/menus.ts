import type {DisplayLabel, VIAMenu} from '@the-via/reader';
import {commonMenus} from '@the-via/reader/dist/common-menus';
import {evalShowIf, type ValueMap} from '@/lib/showif';
import {isV3, type AnyDefinition} from './parse';

/** A command tuple: [name, channel, valueId, ...extra]. */
export type MenuCommand = [string, number, number, ...number[]];

export type MenuControl = {
  key: string;
  label: string;
  type: 'range' | 'dropdown' | 'toggle' | 'color' | 'keycode' | 'button' | 'label' | 'color-palette' | 'text';
  command?: MenuCommand;
  /** Static text for "label" and text items. */
  text?: string;
  options?: unknown;
  unit?: string;
  constraints?: {operator: '<' | '<=' | '>' | '>='; reference: string | MenuCommand; offset?: number; onViolation?: 'clamp' | 'push'}[];
  conditions: string[];
};

export type MenuPage = {key: string; label: string; conditions: string[]; controls: MenuControl[]};
export type ResolvedMenu = {key: string; label: string; conditions: string[]; pages: MenuPage[]};

type Node = {label?: string; showIf?: string; type?: string; content?: unknown; options?: unknown; unit?: string; constraints?: unknown};

const isCommand = (content: unknown): content is MenuCommand =>
  Array.isArray(content) && content.length >= 3 && typeof content[0] === 'string' && content.slice(1).every((v) => typeof v === 'number');

const withCondition = (conditions: string[], node: Node) => (node.showIf ? [...conditions, node.showIf] : conditions);

const collectControls = (nodes: Node[], conditions: string[], keyPrefix: string): MenuControl[] =>
  nodes.flatMap((node, i): MenuControl[] => {
    const key = `${keyPrefix}.${i}`;
    const conds = withCondition(conditions, node);
    if (node.type) {
      const command = isCommand(node.content) ? node.content : undefined;
      const text = Array.isArray(node.content) && node.content.length === 1 ? String(node.content[0]) : undefined;
      return [
        {
          key,
          label: node.label ?? '',
          type: node.type as MenuControl['type'],
          command,
          text,
          options: node.options,
          unit: node.unit,
          constraints: node.constraints as MenuControl['constraints'],
          conditions: conds,
        },
      ];
    }
    if (typeof node.content === 'string') {
      return [{key, label: node.label ?? '', type: 'text', text: node.content, conditions: conds}];
    }
    // A slice: unlabeled group that only adds a condition.
    if (Array.isArray(node.content)) return collectControls(node.content as Node[], conds, key);
    return [];
  });

const collectPages = (nodes: Node[], conditions: string[], keyPrefix: string): MenuPage[] =>
  nodes.flatMap((node, i): MenuPage[] => {
    const key = `${keyPrefix}.${i}`;
    const conds = withCondition(conditions, node);
    if (!Array.isArray(node.content)) return [];
    if (node.label === undefined) return collectPages(node.content as Node[], conds, key);
    return [{key, label: node.label, conditions: conds, controls: collectControls(node.content as Node[], [], key)}];
  });

const menuList = (definition: AnyDefinition): (VIAMenu<DisplayLabel> | VIAMenu | string)[] => {
  if (isV3(definition)) return definition.menus ?? [];
  return (definition.customMenus as VIAMenu[] | undefined) ?? [];
};

/** Resolves built-in menu names ("qmk_rgb_matrix") and flattens slices into pages. */
export const resolveMenus = (definition: AnyDefinition): ResolvedMenu[] =>
  menuList(definition)
    .flatMap((menu): unknown[] => (typeof menu === 'string' ? ((commonMenus as Record<string, VIAMenu[]>)[menu] ?? []) : [menu]))
    .map((menu, i) => {
      const node = menu as unknown as Node;
      return {
        key: `m${i}`,
        label: node.label ?? `Menü ${i + 1}`,
        conditions: node.showIf ? [node.showIf] : [],
        pages: collectPages((node.content as Node[]) ?? [], [], `m${i}`),
      };
    });

export const allControls = (menus: ResolvedMenu[]): MenuControl[] =>
  menus.flatMap((menu) => menu.pages.flatMap((page) => page.controls));

/** Unique commands to read from the keyboard, keyed by command name. */
export const menuCommands = (menus: ResolvedMenu[]): Map<string, MenuCommand> => {
  const commands = new Map<string, MenuCommand>();
  for (const control of allControls(menus)) {
    if (control.command && !commands.has(control.command[0])) commands.set(control.command[0], control.command);
  }
  return commands;
};

export const isVisible = (conditions: string[], values: ValueMap) => conditions.every((c) => evalShowIf(c, values));

/** Range values above 255 use two bytes (big endian), like VIA. */
export const decodeRange = (value: number[] | undefined, max: number) =>
  !value ? 0 : max > 255 ? ((value[0] ?? 0) << 8) | (value[1] ?? 0) : (value[0] ?? 0);

export const encodeRange = (value: number, max: number) => (max > 255 ? [(value >> 8) & 0xff, value & 0xff] : [value & 0xff]);

/** Dropdown options are labels (value = index) or [label, value, ...extraBytes]. */
export const dropdownOptions = (options: unknown): {label: string; value: number[]}[] =>
  Array.isArray(options)
    ? options.map((option, i) =>
        typeof option === 'string' ? {label: option, value: [i]} : {label: String(option[0]), value: option.slice(1) as number[]},
      )
    : [];

/** Toggle options default to [0, 1]; each side may be a number or byte array. */
export const toggleValues = (options: unknown): [number[], number[]] => {
  const [off, on] = Array.isArray(options) && options.length === 2 ? options : [0, 1];
  const box = (v: unknown) => (Array.isArray(v) ? (v as number[]) : [Number(v)]);
  return [box(off), box(on)];
};

export const matchesValue = (expected: number[], actual: number[] | undefined) =>
  !!actual && expected.every((byte, i) => actual[i] === byte);
