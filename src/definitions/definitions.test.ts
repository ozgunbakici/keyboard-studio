import {describe, expect, it} from 'vitest';
import {demoDefinitionSource} from '@/emulator/demo';
import {encoderCount, keyOutline, layoutBounds, layoutChoiceCounts, layoutOptionGroups, visibleKeys} from './geometry';
import {decodeRange, dropdownOptions, isVisible, menuCommands, resolveMenus, toggleValues} from './menus';
import {DefinitionError, definitionName, parseDefinition, trustCompiledDefinition} from './parse';
import {packLayoutOptions, unpackLayoutOptions} from '@/lib/bytes';

describe('definition parsing', () => {
  it('compiles the demo v3 definition', async () => {
    const {definition, version} = await parseDefinition(demoDefinitionSource);
    expect(version).toBe('v3');
    expect(definition.vendorProductId).toBe(0x4b53 * 65536 + 0x0075);
    expect(definitionName(definition)).toBe('Klavye Stüdyo Demo 75');
    expect(definition.layouts.keys.length).toBeGreaterThan(70);
  });

  it('accepts already compiled definitions', async () => {
    const {definition} = await parseDefinition(demoDefinitionSource);
    expect((await parseDefinition(JSON.parse(JSON.stringify(definition)))).definition).toEqual(definition);
    expect(trustCompiledDefinition(JSON.parse(JSON.stringify(definition))).version).toBe('v3');
  });

  it('explains what is wrong with bad files', async () => {
    await expect(parseDefinition([1, 2])).rejects.toThrow(DefinitionError);
    await expect(parseDefinition({name: 'x'})).rejects.toThrow(/vendorId/);
    await expect(parseDefinition({name: 'x', vendorId: '0x1', productId: '0x2', layouts: {}})).rejects.toThrow(/keymap/);
  });
});

describe('layout geometry', async () => {
  const {definition} = await parseDefinition(demoDefinitionSource);

  it('lists layout options', () => {
    expect(layoutOptionGroups(definition).map((g) => [g.label, g.choices.length, g.isToggle])).toEqual([
      ['Bölünmüş Backspace', 2, true],
      ['Sol Shift', 2, false],
    ]);
    const counts = layoutChoiceCounts(definition);
    expect(unpackLayoutOptions(packLayoutOptions([1, 1], counts), counts)).toEqual([1, 1]);
    expect(packLayoutOptions([1, 0], counts)).toBe(0b10);
  });

  it('swaps option keys in place of the default option', () => {
    const ansi = visibleKeys(definition, [0, 0]);
    const iso = visibleKeys(definition, [0, 1]);
    const splitBackspace = visibleKeys(definition, [1, 0]);
    expect(iso.length).toBe(ansi.length + 1);
    expect(splitBackspace.length).toBe(ansi.length + 1);
    const isoShift = iso.find((k) => k.row === 4 && k.col === 0)!;
    const ansiShift = ansi.find((k) => k.row === 4 && k.col === 0)!;
    expect(isoShift.x).toBeCloseTo(ansiShift.x);
    expect(isoShift.w).toBe(1.25);
    const extra = iso.find((k) => k.row === 4 && k.col === 1)!;
    expect(extra.x).toBeCloseTo(1.25);
  });

  it('finds the knob and the bounds', () => {
    const keys = visibleKeys(definition, [0, 0]);
    expect(encoderCount(definition)).toBe(1);
    const knob = keys.find((k) => k.isEncoder)!;
    expect(knob).toMatchObject({row: 0, col: 15, ei: 0, hasMatrix: true});
    const bounds = layoutBounds(keys);
    expect(bounds.width).toBeCloseTo(16.25);
    expect(bounds.height).toBeCloseTo(6.25);
  });

  it('draws ISO style keys as a single polygon', () => {
    const iso = {x: 13.75, y: 1, w: 1.5, h: 1, x2: 0.25, y2: 0, w2: 1.25, h2: 2, r: 0, rx: 0, ry: 0, row: 2, col: 13, color: 'alpha'};
    const outline = keyOutline(iso as never, 0);
    expect(outline.kind).toBe('path');
    if (outline.kind === 'path') expect(outline.d.split('L')).toHaveLength(6);
  });
});

describe('menus', async () => {
  const {definition} = await parseDefinition(demoDefinitionSource);

  it('resolves built-in menus and their commands', () => {
    const menus = resolveMenus(definition);
    expect(menus).toHaveLength(1);
    expect(menus[0].pages[0].controls.map((c) => c.type)).toEqual(['range', 'dropdown', 'range', 'color']);
    expect([...menuCommands(menus).keys()]).toEqual([
      'id_qmk_rgb_matrix_brightness',
      'id_qmk_rgb_matrix_effect',
      'id_qmk_rgb_matrix_effect_speed',
      'id_qmk_rgb_matrix_color',
    ]);
    const speed = menus[0].pages[0].controls[2];
    expect(isVisible(speed.conditions, {id_qmk_rgb_matrix_effect: [0]})).toBe(false);
    expect(isVisible(speed.conditions, {id_qmk_rgb_matrix_effect: [3]})).toBe(true);
  });

  it('decodes control values', () => {
    expect(decodeRange([1, 2], 1000)).toBe(258);
    expect(decodeRange([7], 255)).toBe(7);
    expect(dropdownOptions(['a', 'b'])).toEqual([
      {label: 'a', value: [0]},
      {label: 'b', value: [1]},
    ]);
    expect(dropdownOptions([['x', 5, 1]])).toEqual([{label: 'x', value: [5, 1]}]);
    expect(toggleValues(undefined)).toEqual([[0], [1]]);
    expect(toggleValues([[0, 1], [2, 3]])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});
