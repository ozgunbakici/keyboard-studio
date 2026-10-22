import type {VIAKey} from '@the-via/reader';
import type {AnyDefinition} from './parse';

export type RenderKey = VIAKey & {
  /** Stable id within the definition, e.g. "k12" or "g0o1k3". */
  id: string;
  isEncoder: boolean;
  /** True when the key has a switch in the matrix. */
  hasMatrix: boolean;
};

export type LayoutOptionGroup = {
  index: number;
  label: string;
  /** Labels for each choice. Toggles have ["Kapalı", "Açık"]. */
  choices: string[];
  isToggle: boolean;
};

export const layoutOptionGroups = (definition: AnyDefinition): LayoutOptionGroup[] =>
  (definition.layouts.labels ?? []).map((label, index) =>
    Array.isArray(label)
      ? {index, label: label[0], choices: label.slice(1), isToggle: false}
      : {index, label, choices: ['Kapalı', 'Açık'], isToggle: true},
  );

export const layoutChoiceCounts = (definition: AnyDefinition): number[] =>
  layoutOptionGroups(definition).map((group) => group.choices.length);

const toRenderKey = (key: VIAKey, id: string): RenderKey => ({
  ...key,
  id,
  isEncoder: key.ei !== undefined,
  hasMatrix: key.row >= 0 && key.col >= 0,
});

/** Keys to draw for the selected layout options (decals excluded). */
export const visibleKeys = (definition: AnyDefinition, selections: number[]): RenderKey[] => {
  const {keys, optionKeys} = definition.layouts;
  const base = keys.map((key, i) => toRenderKey(key, `k${i}`));
  const options = Object.entries(optionKeys).flatMap(([group, choices]) => {
    const selected = selections[Number(group)] ?? 0;
    const chosen = choices[String(selected)] ?? choices['0'] ?? [];
    return chosen.map((key, i) => toRenderKey(key, `g${group}o${selected}k${i}`));
  });
  return [...base, ...options].filter((key) => !key.d);
};

const rotate = (x: number, y: number, cx: number, cy: number, degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)};
};

/** Corner points of a key (one or two rectangles) after rotation, in key units. */
export const keyCorners = (key: VIAKey) => {
  const rects = [[key.x, key.y, key.w, key.h]];
  if (key.w2 !== undefined && key.h2 !== undefined) {
    rects.push([key.x + (key.x2 ?? 0), key.y + (key.y2 ?? 0), key.w2, key.h2]);
  }
  return rects.flatMap(([x, y, w, h]) =>
    [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ].map(([px, py]) => (key.r ? rotate(px, py, key.rx, key.ry, key.r) : {x: px, y: py})),
  );
};

export const layoutBounds = (keys: VIAKey[]) => {
  if (keys.length === 0) return {minX: 0, minY: 0, width: 1, height: 1};
  const points = keys.flatMap(keyCorners);
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  return {minX, minY, width: maxX - minX, height: maxY - minY};
};

/**
 * Outline of a key in key units, shrunk by `inset` on every side. Two-rectangle
 * keys (ISO Enter, big-ass Enter) become one polygon.
 */
export const keyOutline = (key: VIAKey, inset: number): {kind: 'rect'; x: number; y: number; w: number; h: number} | {kind: 'path'; d: string} => {
  if (key.w2 === undefined || key.h2 === undefined || (key.w2 === key.w && key.h2 === key.h && !key.x2 && !key.y2)) {
    return {kind: 'rect', x: key.x + inset, y: key.y + inset, w: key.w - inset * 2, h: key.h - inset * 2};
  }
  // Build the union outline on a grid of the rectangle edges.
  const a = {x: key.x, y: key.y, w: key.w, h: key.h};
  const b = {x: key.x + (key.x2 ?? 0), y: key.y + (key.y2 ?? 0), w: key.w2, h: key.h2};
  const xs = [...new Set([a.x, a.x + a.w, b.x, b.x + b.w])].sort((p, q) => p - q);
  const ys = [...new Set([a.y, a.y + a.h, b.y, b.y + b.h])].sort((p, q) => p - q);
  const inside = (x: number, y: number) =>
    (x > a.x && x < a.x + a.w && y > a.y && y < a.y + a.h) || (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
  // Collect boundary edges of filled grid cells.
  const edges: [number, number, number, number][] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (!inside(cx, cy)) continue;
      const left = i > 0 && inside((xs[i - 1] + xs[i]) / 2, cy);
      const right = i < xs.length - 2 && inside((xs[i + 1] + xs[i + 2]) / 2, cy);
      const up = j > 0 && inside(cx, (ys[j - 1] + ys[j]) / 2);
      const down = j < ys.length - 2 && inside(cx, (ys[j + 1] + ys[j + 2]) / 2);
      if (!up) edges.push([xs[i], ys[j], xs[i + 1], ys[j]]);
      if (!right) edges.push([xs[i + 1], ys[j], xs[i + 1], ys[j + 1]]);
      if (!down) edges.push([xs[i + 1], ys[j + 1], xs[i], ys[j + 1]]);
      if (!left) edges.push([xs[i], ys[j + 1], xs[i], ys[j]]);
    }
  }
  // Chain edges into a clockwise loop.
  const loop: [number, number][] = [];
  let edge = edges.shift();
  if (!edge) return {kind: 'rect', x: key.x + inset, y: key.y + inset, w: key.w - inset * 2, h: key.h - inset * 2};
  loop.push([edge[0], edge[1]]);
  while (edge) {
    const [, , ex, ey] = edge;
    loop.push([ex, ey]);
    const nextIndex = edges.findIndex(([sx, sy]) => sx === ex && sy === ey);
    edge = nextIndex >= 0 ? edges.splice(nextIndex, 1)[0] : undefined;
  }
  // Remove collinear points and the closing duplicate.
  const points = loop.slice(0, -1).filter((p, i, arr) => {
    const prev = arr[(i - 1 + arr.length) % arr.length];
    const next = arr[(i + 1) % arr.length];
    return !((prev[0] === p[0] && p[0] === next[0]) || (prev[1] === p[1] && p[1] === next[1]));
  });
  // Inset each vertex towards the inside using the polygon's orientation.
  const n = points.length;
  const inner = points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const inDir = [Math.sign(p[0] - prev[0]), Math.sign(p[1] - prev[1])];
    const outDir = [Math.sign(next[0] - p[0]), Math.sign(next[1] - p[1])];
    // For a clockwise loop (screen coords), the inside is to the right of travel.
    const normalIn = [-inDir[1], inDir[0]];
    const normalOut = [-outDir[1], outDir[0]];
    return [p[0] + (normalIn[0] + normalOut[0]) * inset, p[1] + (normalIn[1] + normalOut[1]) * inset];
  });
  return {kind: 'path', d: `M${inner.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join('L')}Z`};
};

/** Highest encoder index + 1 across all keys and layout options. */
export const encoderCount = (definition: AnyDefinition): number => {
  const all = [
    ...definition.layouts.keys,
    ...Object.values(definition.layouts.optionKeys).flatMap((group) => Object.values(group).flat()),
  ];
  return all.reduce((max, key) => (key.ei !== undefined ? Math.max(max, key.ei + 1) : max), 0);
};
