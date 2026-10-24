import {create} from 'zustand';
import type {AnyDefinition, DefinitionVersion} from '@/definitions/parse';
import type {DefinitionSource} from '@/definitions/repository';
import type {ResolvedMenu} from '@/definitions/menus';
import type {HostLayoutId} from '@/keycodes/host-layouts';
import type {Macro} from '@/via/macro-bytes';

export type SessionStatus = 'connecting' | 'needs-definition' | 'loading' | 'ready' | 'error' | 'disconnected';

export type SessionInfo = {
  id: string;
  kind: 'webhid' | 'virtual';
  vendorId: number;
  productId: number;
  vendorProductId: number;
  productName: string;
  protocol?: number;
  keycodesVersion?: number;
  firmwareVersion?: number;
  status: SessionStatus;
  progress?: string;
  error?: string;
};

export type KeyboardData = {
  definition: AnyDefinition;
  definitionVersion: DefinitionVersion;
  definitionSource: DefinitionSource;
  name: string;
  matrix: {rows: number; cols: number};
  layerCount: number;
  /** [layer][row * cols + col] */
  keymap: number[][];
  /** [layer][encoder] = [counter-clockwise, clockwise] */
  encoders: [number, number][][];
  encoderCount: number;
  /** Selected choice per layout option group. */
  layoutOptions: number[];
  macroCount: number;
  macroBufferSize: number;
  macroBytes: number[];
  macros: Macro[];
  menus: ResolvedMenu[];
  menuValues: Record<string, number[]>;
  /** Raw switch matrix is hidden on firmware built without VIA_INSECURE. */
  matrixTesterSupported: boolean;
};

export type Pane = 'keymap' | 'library' | 'lighting' | 'macros' | 'tester' | 'typing' | 'backups' | 'definitions' | 'settings';

export type KeySelection = {keyId: string; part: 'key' | 'ccw' | 'cw'} | null;

export type Toast = {id: number; kind: 'info' | 'success' | 'error'; text: string};

export type Settings = {
  hostLayout: HostLayoutId;
  hostLayoutAuto: boolean;
  os: 'mac' | 'other';
  osAuto: boolean;
  theme: 'dark' | 'light' | 'system';
  advanceSelection: boolean;
  blinkOnSelect: boolean;
  /** Rewrites library-bound keys for this computer's OS when a keyboard connects. */
  autoSync: boolean;
};

export type KeymapChange = {sessionId: string; layer: number; target: {row: number; col: number} | {encoder: number; cw: boolean}; before: number; after: number};

export type StudioState = {
  sessions: Record<string, SessionInfo>;
  data: Record<string, KeyboardData>;
  selectedId: string | null;
  pane: Pane;
  layer: number;
  selection: KeySelection;
  undo: KeymapChange[];
  redo: KeymapChange[];
  settings: Settings;
  toasts: Toast[];
  webHidSupported: boolean;
  /** Phone layout: the sidebar is a drawer that slides over the content. */
  navOpen: boolean;
};

export const defaultSettings: Settings = {
  hostLayout: 'us',
  hostLayoutAuto: true,
  os: 'other',
  osAuto: true,
  theme: 'dark',
  advanceSelection: true,
  blinkOnSelect: true,
  autoSync: true,
};

export const useStudio = create<StudioState>(() => ({
  sessions: {},
  data: {},
  selectedId: null,
  pane: 'keymap',
  layer: 0,
  selection: null,
  undo: [],
  redo: [],
  settings: defaultSettings,
  toasts: [],
  webHidSupported: typeof navigator !== 'undefined' && 'hid' in navigator,
  navOpen: false,
}));

export const getState = () => useStudio.getState();
export const setState = useStudio.setState;

export const updateSession = (id: string, patch: Partial<SessionInfo>) =>
  setState((s) => (s.sessions[id] ? {sessions: {...s.sessions, [id]: {...s.sessions[id], ...patch}}} : {}));

export const updateData = (id: string, patch: Partial<KeyboardData> | ((data: KeyboardData) => Partial<KeyboardData>)) =>
  setState((s) => {
    const current = s.data[id];
    if (!current) return {};
    const next = typeof patch === 'function' ? patch(current) : patch;
    return {data: {...s.data, [id]: {...current, ...next}}};
  });

let toastId = 0;
export const toast = (text: string, kind: Toast['kind'] = 'info', timeoutMs = 4500) => {
  const id = ++toastId;
  setState((s) => ({toasts: [...s.toasts, {id, kind, text}]}));
  setTimeout(() => setState((s) => ({toasts: s.toasts.filter((t) => t.id !== id)})), timeoutMs);
};

export const useSelectedSession = () => useStudio((s) => (s.selectedId ? s.sessions[s.selectedId] : undefined));
export const useSelectedData = () => useStudio((s) => (s.selectedId ? s.data[s.selectedId] : undefined));
