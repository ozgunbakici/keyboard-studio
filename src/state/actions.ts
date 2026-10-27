import {packLayoutOptions, unpackLayoutOptions, vendorProductId} from '@/lib/bytes';
import {encoderCount, layoutChoiceCounts, visibleKeys} from '@/definitions/geometry';
import {menuCommands, resolveMenus, type MenuCommand} from '@/definitions/menus';
import {definitionName, dynamicNameCommand, parseDefinition, type AnyDefinition, type DefinitionVersion} from '@/definitions/parse';
import {findDefinition, readDefinitionFile, saveUserDefinition, type FoundDefinition} from '@/definitions/repository';
import {createDemoKeyboard, demoDefinitionSource} from '@/emulator/demo';
import {VirtualTransport} from '@/emulator/virtual-keyboard';
import {KeycodeCodec} from '@/keycodes/codec';
import {detectHostLayout, hostLayouts} from '@/keycodes/host-layouts';
import {keyLabel} from '@/keycodes/labels';
import {resolveDelivery, type DeliveryContext} from '@/library/delivery';
import {
  clearBinding,
  deleteAction,
  dropClearedBindings,
  ensureTrigger,
  importLibrary,
  loadLibrary,
  removeBindingAt,
  saveAction,
  setBinding,
  setSlots,
  useLibrary,
} from '@/library/store';
import {isEmptyPlan, planSync} from '@/library/sync';
import {osLabel, type KeyBinding, type LibraryAction, type OsId} from '@/library/types';
import {db, getSetting, setSetting} from '@/storage/db';
import {freshenForKeyboard, onCloudApplied, startCloudSync} from '@/sync/engine';
import {ViaApi} from '@/via/api';
import {Command, Protocol, VIA_USAGE, VIA_USAGE_PAGE} from '@/via/constants';
import {decodeMacros, encodeMacros, type Macro} from '@/via/macro-bytes';
import {isViaInterface, ViaChannel, WebHidTransport, type HidTransport} from '@/via/transport';
import {loadCustomBackground} from './appearance';
import {createBackup, planRestore, type BackupFile, type ViaSaveFile} from './backup';
import {
  defaultSettings,
  getState,
  setState,
  toast,
  updateData,
  updateSession,
  type KeyboardData,
  type KeymapChange,
  type Pane,
  type SessionInfo,
  type Settings,
} from './store';

type Controller = {transport: HidTransport; channel: ViaChannel; api: ViaApi; codec: KeycodeCodec; unsubscribe: () => void};

const controllers = new Map<string, Controller>();

export const getController = (id: string) => controllers.get(id);
export const getCodec = (id: string | null) => (id ? controllers.get(id)?.codec : undefined);

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// ---------------------------------------------------------------------------
// App start-up and settings

const detectOs = (): 'mac' | 'other' => {
  const nav = navigator as Navigator & {userAgentData?: {platform?: string}};
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? '';
  return /mac/i.test(platform) ? 'mac' : 'other';
};

/**
 * US on a Mac means the Mac US layout (Option characters) of the keyboard's
 * shape, as macOS swaps § and ` on ISO keyboards; and the other way round.
 */
const usVariantFor = (os: Settings['os'], layout: Settings['hostLayout'], shape: Settings['keyboardShape']): Settings['hostLayout'] => {
  if (os === 'mac' && layout === 'us') return shape === 'iso' ? 'us-mac-iso' : 'us-mac';
  if (os !== 'mac' && (layout === 'us-mac' || layout === 'us-mac-iso')) return 'us';
  return layout;
};

export const updateSettings = async (patch: Partial<Settings>) => {
  const before = getState().settings;
  const settings = {...before, ...patch};
  if (patch.os !== undefined && patch.hostLayout === undefined) {
    settings.hostLayout = usVariantFor(settings.os, settings.hostLayout, settings.keyboardShape);
  }
  setState({settings});
  await setSetting('settings', settings);
  // Library keys follow the computer: a corrected OS or layout rewrites them.
  if (settings.autoSync && (settings.os !== before.os || settings.hostLayout !== before.hostLayout)) await syncAllKeyboards();
};

export const refreshAutoSettings = async () => {
  const {settings} = getState();
  const patch: Partial<Settings> = {};
  if (settings.osAuto) patch.os = detectOs();
  if (settings.hostLayoutAuto) {
    const detected = await detectHostLayout(patch.os ?? settings.os);
    if (detected) patch.hostLayout = detected;
    // Without the Keyboard Map API, at least pick the right US variant for the OS.
    else {
      const variant = usVariantFor(patch.os ?? settings.os, settings.hostLayout, settings.keyboardShape);
      if (variant !== settings.hostLayout) patch.hostLayout = variant;
    }
  }
  if (Object.keys(patch).length) setState({settings: {...getState().settings, ...patch}});
};

let initialized = false;

export const initApp = async () => {
  if (initialized) return;
  initialized = true;
  const stored = await getSetting<Partial<Settings>>('settings', {});
  setState({settings: {...defaultSettings, ...stored}});
  await refreshAutoSettings();
  void loadLibrary();
  void loadCustomBackground();
  onCloudApplied((applied) => {
    // Actions placed on another computer reach the keyboards plugged in here.
    if (applied.library && getState().settings.autoSync) void syncAllKeyboards({announce: false});
  });
  void startCloudSync();

  const hid = (navigator as Navigator & {hid?: HID}).hid;
  if (!hid) return;
  hid.addEventListener('disconnect', (event) => {
    const id = [...controllers.entries()].find(([, c]) => c.transport instanceof WebHidTransport && c.transport.device === event.device)?.[0];
    if (id) void closeSession(id, true);
  });
  hid.addEventListener('connect', (event) => {
    if (isViaInterface(event.device)) void openWebHidDevice(event.device);
  });
  // Re-open keyboards the user already granted access to.
  try {
    const devices = await hid.getDevices();
    for (const device of devices.filter(isViaInterface)) await openWebHidDevice(device);
  } catch {
    // Permission policy may block WebHID.
  }
};

// ---------------------------------------------------------------------------
// Connecting

export const connectWebHid = async () => {
  const hid = (navigator as Navigator & {hid?: HID}).hid;
  if (!hid) {
    toast('Bu tarayıcı WebHID desteklemiyor. Chrome veya Edge kullan.', 'error');
    return;
  }
  let devices: HIDDevice[] = [];
  try {
    devices = await hid.requestDevice({filters: [{usagePage: VIA_USAGE_PAGE, usage: VIA_USAGE}]});
  } catch (error) {
    toast(`Cihaz seçilemedi: ${errorText(error)}`, 'error');
    return;
  }
  const viaDevices = devices.filter(isViaInterface);
  if (devices.length && !viaDevices.length) toast('Seçilen cihaz VIA arayüzü sunmuyor.', 'error');
  for (const device of viaDevices) await openWebHidDevice(device, true);
};

const openWebHidDevice = async (device: HIDDevice, select = false) => {
  const existing = [...controllers.entries()].find(([, c]) => c.transport instanceof WebHidTransport && c.transport.device === device);
  if (existing) {
    if (select) selectSession(existing[0]);
    return;
  }
  await openTransport(new WebHidTransport(device), {select});
};

export const connectDemo = async () => {
  // Close the phone menu before the definition is parsed, which keeps the main thread busy.
  setState({navOpen: false});
  const existing = Object.values(getState().sessions).find((s) => s.kind === 'virtual');
  if (existing) {
    selectSession(existing.id);
    return;
  }
  const {definition} = await parseDefinition(demoDefinitionSource);
  await openTransport(new VirtualTransport(createDemoKeyboard(), 1), {
    select: true,
    definition: {definition, version: 'v3', source: 'demo'},
  });
};

const openTransport = async (transport: HidTransport, options: {select?: boolean; definition?: FoundDefinition} = {}) => {
  const id = transport.id;
  const info: SessionInfo = {
    id,
    kind: transport.kind,
    vendorId: transport.vendorId,
    productId: transport.productId,
    vendorProductId: vendorProductId(transport.vendorId, transport.productId),
    productName: transport.productName || 'Bilinmeyen klavye',
    status: 'connecting',
    progress: 'Bağlanıyor',
  };
  setState((s) => ({sessions: {...s.sessions, [id]: info}}));
  if (options.select || !getState().selectedId) {
    selectSession(id);
    // A keyboard the user just picked should be shown, not hidden behind settings.
    if (options.select && ['settings', 'definitions', 'backups', 'library', 'typing'].includes(getState().pane)) setState({pane: 'keymap'});
  }

  const channel = new ViaChannel(transport);
  try {
    await channel.open();
    const api = new ViaApi(channel);
    const protocol = await api.getProtocolVersion();
    let keycodesVersion: number | undefined;
    if (protocol >= Protocol.KeycodesVersion) keycodesVersion = await api.getKeycodesVersion().catch(() => undefined);
    const unsubscribe = channel.onUnsolicited((report) => {
      if (report[0] === Command.UiSyncRequest) void syncMenuValues(id);
    });
    controllers.set(id, {transport, channel, api, codec: KeycodeCodec.forProtocol(protocol), unsubscribe});
    updateSession(id, {protocol, keycodesVersion, progress: 'Tanım aranıyor'});

    const found = options.definition ?? (await findDefinition(info.vendorProductId, protocol >= Protocol.V3Definitions ? 'v3' : 'v2'));
    if (!found) {
      updateSession(id, {status: 'needs-definition', progress: undefined});
      return;
    }
    await loadKeyboard(id, found);
  } catch (error) {
    updateSession(id, {status: 'error', error: errorText(error), progress: undefined});
  }
};

/** Reads everything VIA can configure from the keyboard. */
const loadKeyboard = async (id: string, found: FoundDefinition) => {
  const controller = controllers.get(id);
  const session = getState().sessions[id];
  if (!controller || !session) return;
  const {api} = controller;
  const protocol = session.protocol ?? 0;
  const {definition} = found;
  const matrix = definition.matrix;
  updateSession(id, {status: 'loading', progress: 'Klavye okunuyor', error: undefined});
  try {
    const layerCount = await api.getLayerCount(protocol);

    let layoutOptions: number[] = [];
    const counts = layoutChoiceCounts(definition);
    if (counts.length) {
      const packed = await api.getLayoutOptions().catch(() => 0);
      layoutOptions = unpackLayoutOptions(packed, counts);
    }

    updateSession(id, {progress: 'Tuş haritası okunuyor'});
    const keymap = await api.readKeymap(layerCount, matrix, protocol);

    const encoders: [number, number][][] = [];
    let encodersSupported = encoderCount(definition);
    if (encodersSupported > 0) {
      try {
        for (let layer = 0; layer < layerCount; layer++) {
          const row: [number, number][] = [];
          for (let e = 0; e < encodersSupported; e++) {
            row.push([await api.getEncoder(layer, e, false), await api.getEncoder(layer, e, true)]);
          }
          encoders.push(row);
        }
      } catch {
        // Firmware without ENCODER_MAP_ENABLE: knobs are handled in firmware.
        encodersSupported = 0;
        encoders.length = 0;
      }
    }

    updateSession(id, {progress: 'Makrolar okunuyor'});
    let macroCount = 0;
    let macroBufferSize = 0;
    let macroBytes: number[] = [];
    try {
      macroCount = await api.getMacroCount();
      macroBufferSize = macroCount ? await api.getMacroBufferSize() : 0;
      macroBytes = macroBufferSize ? await api.readMacroBuffer(macroBufferSize) : [];
    } catch {
      macroCount = 0;
    }

    const menus = protocol >= Protocol.V3Definitions ? resolveMenus(definition) : [];
    const menuValues: Record<string, number[]> = {};
    if (menus.length) {
      updateSession(id, {progress: 'Işık ayarları okunuyor'});
      for (const [name, command] of menuCommands(menus)) {
        const [, ...bytes] = command;
        try {
          menuValues[name] = await api.getCustomValue(bytes);
        } catch {
          // Leave unsupported values out; their controls show as unavailable.
        }
      }
    }

    let firmwareVersion: number | undefined;
    if (protocol >= Protocol.V3Definitions) firmwareVersion = await api.getFirmwareVersion().catch(() => undefined);
    if (firmwareVersion !== undefined) menuValues.id_firmware_version = [firmwareVersion];

    let dynamicNameIndex: number | undefined;
    const nameCommand = dynamicNameCommand(definition);
    if (nameCommand) dynamicNameIndex = (await api.getCustomValue(nameCommand).catch(() => [0]))[0];

    const data: KeyboardData = {
      definition,
      definitionVersion: found.version,
      definitionSource: found.source,
      name: definitionName(definition, dynamicNameIndex),
      matrix,
      layerCount,
      keymap,
      encoders,
      encoderCount: encodersSupported,
      layoutOptions,
      macroCount,
      macroBufferSize,
      macroBytes,
      macros: macroCount ? decodeMacros(macroBytes, macroCount, protocol) : [],
      menus,
      menuValues,
      matrixTesterSupported: true,
    };
    setState((s) => ({data: {...s.data, [id]: data}}));
    updateSession(id, {status: 'ready', progress: undefined, firmwareVersion});
    void autoBackup(id)
      .then(freshenForKeyboard)
      .then(() => (getState().settings.autoSync ? syncKeyboard(id) : null));
  } catch (error) {
    updateSession(id, {status: 'error', error: errorText(error), progress: undefined});
  }
};

/** User supplied a JSON definition for a keyboard that had none. */
export const provideDefinitionFile = async (id: string, file: File) => {
  const session = getState().sessions[id];
  if (!session) return;
  try {
    const {definition, version} = await readDefinitionFile(file);
    if (definition.vendorProductId !== session.vendorProductId) {
      const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
      throw new Error(
        `Bu dosya başka bir klavyeye ait (dosya: ${hex(definition.vendorProductId >>> 16)}:${hex(definition.vendorProductId & 0xffff)}, ` +
          `klavye: ${hex(session.vendorId)}:${hex(session.productId)}).`,
      );
    }
    await saveUserDefinition(definition, version);
    toast(`${definitionName(definition)} tanımı kaydedildi. Bir daha yüklemene gerek yok.`, 'success');
    await loadKeyboard(id, {definition, version, source: 'user'});
  } catch (error) {
    toast(errorText(error), 'error', 8000);
  }
};

/** Stores a definition without a connected keyboard (definitions pane). */
export const importDefinitionFile = async (file: File) => {
  try {
    const {definition, version} = await readDefinitionFile(file);
    await saveUserDefinition(definition, version);
    toast(`${definitionName(definition)} tanımı kaydedildi.`, 'success');
    // A waiting keyboard may match this definition.
    const waiting = Object.values(getState().sessions).find(
      (s) => s.status === 'needs-definition' && s.vendorProductId === definition.vendorProductId,
    );
    if (waiting) await loadKeyboard(waiting.id, {definition, version, source: 'user'});
    return definition;
  } catch (error) {
    toast(errorText(error), 'error', 8000);
    return null;
  }
};

export const reloadSession = async (id: string) => {
  const session = getState().sessions[id];
  const data = getState().data[id];
  if (!session) return;
  if (data) {
    await loadKeyboard(id, {definition: data.definition, version: data.definitionVersion, source: data.definitionSource});
  } else {
    const found = await findDefinition(session.vendorProductId, (session.protocol ?? 0) >= 11 ? 'v3' : 'v2');
    if (found) await loadKeyboard(id, found);
  }
};

export const closeSession = async (id: string, unplugged = false) => {
  const controller = controllers.get(id);
  controllers.delete(id);
  controller?.unsubscribe();
  await controller?.channel.close().catch(() => undefined);
  setState((s) => {
    const sessions = {...s.sessions};
    const data = {...s.data};
    delete sessions[id];
    delete data[id];
    const selectedId = s.selectedId === id ? (Object.keys(sessions)[0] ?? null) : s.selectedId;
    return {sessions, data, selectedId, selection: s.selectedId === id ? null : s.selection};
  });
  if (unplugged) toast('Klavye çıkarıldı.', 'info');
};

export const selectSession = (id: string) => {
  setState({navOpen: false});
  if (getState().selectedId === id) return;
  setState({selectedId: id, layer: 0, selection: null});
  const controller = controllers.get(id);
  if (controller?.transport.kind === 'webhid' && getState().settings.blinkOnSelect) void blink(id);
};

/** Briefly blinks the keyboard's LEDs so the user can see which board is selected. */
export const blink = async (id: string) => {
  const api = controllers.get(id)?.api;
  if (!api) return;
  for (let step = 0; step < 6; step++) {
    await api.deviceIndication(step).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

export const setPane = (pane: Pane) => setState({pane, navOpen: false});
export const setNavOpen = (navOpen: boolean) => setState({navOpen});
export const setLayer = (layer: number) => setState({layer});
export const setSelection = (selection: ReturnType<typeof getState>['selection']) => setState({selection});

// ---------------------------------------------------------------------------
// Keymap editing

const requireReady = (id: string | null) => {
  if (!id) return null;
  const controller = controllers.get(id);
  const data = getState().data[id];
  return controller && data ? {controller, data} : null;
};

const applyChange = async (change: KeymapChange, value: number) => {
  const ready = requireReady(change.sessionId);
  if (!ready) return false;
  const {controller} = ready;
  const {layer, target} = change;
  if ('row' in target) {
    const {cols} = ready.data.matrix;
    const index = target.row * cols + target.col;
    updateData(change.sessionId, (d) => ({
      keymap: d.keymap.map((keys, l) => (l === layer ? keys.map((k, i) => (i === index ? value : k)) : keys)),
    }));
    try {
      await controller.api.setKeycode(layer, target.row, target.col, value);
      return true;
    } catch (error) {
      toast(`Tuş yazılamadı: ${errorText(error)}`, 'error');
      return false;
    }
  }
  updateData(change.sessionId, (d) => ({
    encoders: d.encoders.map((row, l) =>
      l === layer ? row.map((pair, e) => (e === target.encoder ? ((target.cw ? [pair[0], value] : [value, pair[1]]) as [number, number]) : pair)) : row,
    ),
  }));
  try {
    await controller.api.setEncoder(layer, target.encoder, target.cw, value);
    return true;
  } catch (error) {
    toast(`Knob ayarı yazılamadı: ${errorText(error)}`, 'error');
    return false;
  }
};

/** Keys of the current layout in reading order (used to advance the selection). */
export const orderedKeys = (data: KeyboardData) =>
  visibleKeys(data.definition, data.layoutOptions)
    .filter((key) => key.hasMatrix || key.isEncoder)
    .sort((a, b) => Math.round(a.y * 4) - Math.round(b.y * 4) || a.x - b.x);

export const assignKeycode = async (value: number) => {
  const {selectedId, selection, layer, settings} = getState();
  const ready = requireReady(selectedId);
  if (!ready || !selection || !selectedId) return;
  const key = visibleKeys(ready.data.definition, ready.data.layoutOptions).find((k) => k.id === selection.keyId);
  if (!key) return;

  let change: KeymapChange;
  if (selection.part === 'key') {
    if (!key.hasMatrix) return;
    const before = ready.data.keymap[layer]?.[key.row * ready.data.matrix.cols + key.col] ?? 0;
    change = {sessionId: selectedId, layer, target: {row: key.row, col: key.col}, before, after: value};
  } else {
    if (key.ei === undefined || !ready.data.encoders.length) return;
    const cw = selection.part === 'cw';
    const before = ready.data.encoders[layer]?.[key.ei]?.[cw ? 1 : 0] ?? 0;
    change = {sessionId: selectedId, layer, target: {encoder: key.ei, cw}, before, after: value};
  }
  if (change.before === change.after) return;
  const ok = await applyChange(change, value);
  if (!ok) return;
  setState((s) => ({undo: [...s.undo.slice(-199), change], redo: []}));
  // A key edited by hand no longer follows its library action.
  const vpid = getState().sessions[selectedId]?.vendorProductId;
  if (vpid !== undefined) {
    await removeBindingAt(
      'row' in change.target
        ? {vendorProductId: vpid, layer, row: change.target.row, col: change.target.col}
        : {vendorProductId: vpid, layer, row: -1, col: -1, encoder: {index: change.target.encoder, cw: change.target.cw}},
    );
  }

  if (settings.advanceSelection && selection.part === 'key') {
    const order = orderedKeys(ready.data).filter((k) => k.hasMatrix);
    const index = order.findIndex((k) => k.id === key.id);
    const next = order[index + 1];
    setState({selection: next ? {keyId: next.id, part: 'key'} : null});
  }
};

export const undoChange = async () => {
  const change = getState().undo.at(-1);
  if (!change) return;
  setState((s) => ({undo: s.undo.slice(0, -1), redo: [...s.redo, change], layer: change.layer}));
  await applyChange(change, change.before);
};

export const redoChange = async () => {
  const change = getState().redo.at(-1);
  if (!change) return;
  setState((s) => ({redo: s.redo.slice(0, -1), undo: [...s.undo, change], layer: change.layer}));
  await applyChange(change, change.after);
};

/** Copies one layer onto another in a single buffer write. */
export const copyLayer = async (from: number, to: number) => {
  const {selectedId} = getState();
  const ready = requireReady(selectedId);
  if (!ready || !selectedId || from === to) return;
  const {data, controller} = ready;
  const keymap = data.keymap.map((keys, l) => (l === to ? [...data.keymap[from]] : keys));
  await saveBackup(selectedId, `Katman ${to} kopyalamadan önce`, true);
  updateData(selectedId, {keymap});
  try {
    await controller.api.writeKeymap(keymap, data.matrix, getState().sessions[selectedId]?.protocol ?? 0);
    toast(`Katman ${from}, katman ${to} üzerine kopyalandı.`, 'success');
  } catch (error) {
    toast(`Kopyalanamadı: ${errorText(error)}`, 'error');
  }
};

/** Fills a layer with KC_TRNS so it falls through to lower layers. */
export const clearLayer = async (layer: number) => {
  const {selectedId} = getState();
  const ready = requireReady(selectedId);
  if (!ready || !selectedId) return;
  const trns = ready.controller.codec.value('KC_TRNS') ?? 1;
  const keymap = ready.data.keymap.map((keys, l) => (l === layer ? keys.map(() => trns) : keys));
  await saveBackup(selectedId, `Katman ${layer} temizlenmeden önce`, true);
  updateData(selectedId, {keymap});
  try {
    await ready.controller.api.writeKeymap(keymap, ready.data.matrix, getState().sessions[selectedId]?.protocol ?? 0);
    toast(`Katman ${layer} geçirgen yapıldı.`, 'success');
  } catch (error) {
    toast(`Katman temizlenemedi: ${errorText(error)}`, 'error');
  }
};

/** Restores the keymap compiled into the firmware. */
export const resetKeymapToDefault = async () => {
  const {selectedId} = getState();
  const ready = requireReady(selectedId);
  if (!ready || !selectedId) return;
  await saveBackup(selectedId, 'Fabrika keymap’ine dönmeden önce', true);
  try {
    await ready.controller.api.resetKeymap();
    const keymap = await ready.controller.api.readKeymap(ready.data.layerCount, ready.data.matrix, getState().sessions[selectedId]?.protocol ?? 0);
    updateData(selectedId, {keymap});
    setState({undo: [], redo: []});
    toast('Tuş haritası firmware varsayılanına döndü. Önceki hâli yedeklendi.', 'success');
  } catch (error) {
    toast(`Sıfırlanamadı: ${errorText(error)}`, 'error');
  }
};

export const setLayoutOption = async (group: number, choice: number) => {
  const {selectedId} = getState();
  const ready = requireReady(selectedId);
  if (!ready || !selectedId) return;
  const selections = [...ready.data.layoutOptions];
  selections[group] = choice;
  updateData(selectedId, {layoutOptions: selections});
  setState({selection: null});
  try {
    await ready.controller.api.setLayoutOptions(packLayoutOptions(selections, layoutChoiceCounts(ready.data.definition)));
  } catch (error) {
    toast(`Layout seçeneği yazılamadı: ${errorText(error)}`, 'error');
  }
};

// ---------------------------------------------------------------------------
// Custom menus (lighting etc.)

const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

const scheduleSave = (id: string, channel: number) => {
  const key = `${id}:${channel}`;
  clearTimeout(pendingSaves.get(key));
  pendingSaves.set(
    key,
    setTimeout(() => {
      pendingSaves.delete(key);
      void controllers.get(id)?.api.saveCustomValues(channel).catch(() => undefined);
    }, 600),
  );
};

// While a slider is dragged only the newest value per command is sent, so the
// HID queue never falls behind the pointer.
const menuWrites = new Map<string, {latest: number[] | null; running: boolean}>();

export const setMenuValue = async (command: MenuCommand, value: number[]) => {
  const {selectedId} = getState();
  const ready = requireReady(selectedId);
  if (!ready || !selectedId) return;
  const [name, channel, ...rest] = command;
  updateData(selectedId, (d) => ({menuValues: {...d.menuValues, [name]: value}}));
  const key = `${selectedId}:${name}`;
  const slot = menuWrites.get(key) ?? {latest: null, running: false};
  menuWrites.set(key, slot);
  slot.latest = value;
  if (slot.running) return;
  slot.running = true;
  try {
    while (slot.latest) {
      const next = slot.latest;
      slot.latest = null;
      await ready.controller.api.setCustomValue([channel, ...rest], next);
    }
    scheduleSave(selectedId, channel);
  } catch (error) {
    toast(`Ayar yazılamadı: ${errorText(error)}`, 'error');
  } finally {
    slot.running = false;
  }
};

export const syncMenuValues = async (id: string) => {
  const ready = requireReady(id);
  if (!ready) return;
  const values: Record<string, number[]> = {};
  for (const [name, [, ...bytes]] of menuCommands(ready.data.menus)) {
    try {
      values[name] = await ready.controller.api.getCustomValue(bytes);
    } catch {
      // Ignore values the firmware does not report.
    }
  }
  updateData(id, (d) => ({menuValues: {...d.menuValues, ...values}}));
};

// ---------------------------------------------------------------------------
// Macros

export const writeMacros = (macros: Macro[]) => writeMacrosFor(getState().selectedId, macros);

export const writeMacrosFor = async (id: string | null, macros: Macro[]) => {
  const ready = requireReady(id);
  const protocol = id ? getState().sessions[id]?.protocol ?? 0 : 0;
  if (!ready || !id) return false;
  const padded = [...macros.slice(0, ready.data.macroCount)];
  while (padded.length < ready.data.macroCount) padded.push([]);
  let bytes: number[];
  try {
    bytes = encodeMacros(padded, protocol);
  } catch (error) {
    toast(errorText(error), 'error');
    return false;
  }
  if (bytes.length > ready.data.macroBufferSize) {
    toast(`Makrolar hafızaya sığmıyor: ${bytes.length}/${ready.data.macroBufferSize} bayt.`, 'error');
    return false;
  }
  try {
    await ready.controller.api.writeMacroBuffer(bytes, ready.data.macroBufferSize);
    const full = [...bytes, ...new Array(ready.data.macroBufferSize - bytes.length).fill(0)];
    updateData(id, {macroBytes: full, macros: padded});
    return true;
  } catch (error) {
    toast(`Makrolar yazılamadı: ${errorText(error)}`, 'error');
    return false;
  }
};

// ---------------------------------------------------------------------------
// Action library: keys bound to library actions follow the computer's OS.

export const currentOs = (): OsId => (getState().settings.os === 'mac' ? 'mac' : 'windows');

/** Delivery context for an OS; the other OS uses its usual US layout variant. */
export const deliveryContext = (id: string | null, os: OsId = currentOs()): DeliveryContext => {
  const protocol = (id && getState().sessions[id]?.protocol) || 12;
  const codec = getCodec(id) ?? KeycodeCodec.forProtocol(protocol);
  const here = currentOs();
  const {hostLayout} = getState().settings;
  const host = os === here ? hostLayouts[hostLayout] : os === 'mac' ? hostLayouts['us-mac-iso'] : hostLayouts.us;
  return {codec, host, protocol};
};

const syncing = new Set<string>();

/**
 * Rewrites every library-bound key and managed macro of a keyboard for the
 * OS of this computer. Returns a short summary, or null when nothing changed.
 */
export const syncKeyboard = async (id: string, {announce = true} = {}) => {
  const ready = requireReady(id);
  const session = getState().sessions[id];
  if (!ready || !session || syncing.has(id)) return null;
  syncing.add(id);
  try {
    await loadLibrary();
    const vpid = session.vendorProductId;
    const lib = useLibrary.getState();
    const bindings = lib.bindings.filter((b) => b.vendorProductId === vpid);
    const slots = lib.slots.filter((x) => x.vendorProductId === vpid);
    if (!bindings.length && !slots.length) return null;
    const os = currentOs();
    const ctx = deliveryContext(id, os);
    for (const actionId of new Set(bindings.map((b) => b.actionId))) {
      const action = useLibrary.getState().actions.find((a) => a.id === actionId);
      if (action) await ensureTrigger(action, (o) => deliveryContext(id, o));
    }
    const actions = new Map(useLibrary.getState().actions.map((a) => [a.id, a]));
    const data = getState().data[id]!;
    const plan = planSync({
      vendorProductId: vpid,
      os,
      ctx,
      actions,
      bindings,
      slots,
      keyboard: {
        cols: data.matrix.cols,
        layerCount: data.layerCount,
        keymap: data.keymap,
        encoders: data.encoders,
        macros: data.macros,
        macroCount: data.macroCount,
        macroBufferSize: data.macroBufferSize,
      },
    });
    if (plan.macros && !(await writeMacrosFor(id, plan.macros))) return null;
    for (const w of plan.keyWrites) {
      await ready.controller.api.setKeycode(w.layer, w.row, w.col, w.keycode);
    }
    for (const w of plan.encoderWrites) {
      await ready.controller.api.setEncoder(w.layer, w.index, w.cw, w.keycode);
    }
    if (plan.keyWrites.length || plan.encoderWrites.length) {
      updateData(id, (d) => ({
        keymap: d.keymap.map((keys, layer) =>
          keys.map((k, i) => plan.keyWrites.find((w) => w.layer === layer && w.row * d.matrix.cols + w.col === i)?.keycode ?? k),
        ),
        encoders: d.encoders.map((row, layer) =>
          row.map((pair, e) => {
            const ccw = plan.encoderWrites.find((w) => w.layer === layer && w.index === e && !w.cw);
            const cw = plan.encoderWrites.find((w) => w.layer === layer && w.index === e && w.cw);
            return [ccw?.keycode ?? pair[0], cw?.keycode ?? pair[1]] as [number, number];
          }),
        ),
      }));
    }
    await setSlots(vpid, plan.slots);
    await dropClearedBindings(vpid);
    plan.warnings.slice(0, 3).forEach((w) => toast(w, 'info', 7000));
    if (isEmptyPlan(plan)) return null;
    const parts = [
      plan.keyWrites.length + plan.encoderWrites.length ? `${plan.keyWrites.length + plan.encoderWrites.length} tuş` : '',
      plan.macros ? 'makrolar' : '',
    ].filter(Boolean);
    const summary = `${osLabel[os]} için eşitlendi: ${parts.join(', ')}`;
    if (announce) toast(summary, 'success');
    return summary;
  } catch (error) {
    toast(`Eşitleme başarısız: ${errorText(error)}`, 'error');
    return null;
  } finally {
    syncing.delete(id);
  }
};

/** Layer-0 legend of a key (e.g. "F5"), so a binding can be described without the keyboard. */
const baseKeyName = (id: string, row: number, col: number) => {
  const data = getState().data[id];
  const codec = getCodec(id);
  const value = data?.keymap[0]?.[row * data.matrix.cols + col];
  if (!data || !codec || value === undefined) return undefined;
  const {settings} = getState();
  const label = keyLabel(value, {codec, host: hostLayouts[settings.hostLayout], os: settings.os});
  return label.main.replace(/\n/g, ' ') || undefined;
};

/** Binds a library action to the selected key and writes it right away. */
export const assignAction = async (actionId: string) => {
  const {selectedId, selection, layer, settings} = getState();
  const ready = requireReady(selectedId);
  const session = selectedId ? getState().sessions[selectedId] : undefined;
  if (!ready || !selection || !selectedId || !session) return;
  const key = visibleKeys(ready.data.definition, ready.data.layoutOptions).find((k) => k.id === selection.keyId);
  if (!key) return;
  const binding: Omit<KeyBinding, 'id'> =
    selection.part === 'key'
      ? {vendorProductId: session.vendorProductId, layer, row: key.row, col: key.col, actionId, keyName: baseKeyName(selectedId, key.row, key.col)}
      : {vendorProductId: session.vendorProductId, layer, row: -1, col: -1, encoder: {index: key.ei ?? 0, cw: selection.part === 'cw'}, actionId};
  if (selection.part === 'key' && !key.hasMatrix) return;
  await setBinding(binding);
  await syncKeyboard(selectedId, {announce: false});
  const action = useLibrary.getState().actions.find((a) => a.id === actionId);
  if (action) {
    const delivery = resolveDelivery(action, currentOs(), deliveryContext(selectedId));
    toast(`“${action.name}” atandı. ${delivery.summary}.`, delivery.mode === 'unavailable' ? 'error' : 'success');
  }
  if (settings.advanceSelection && selection.part === 'key') {
    const order = orderedKeys(ready.data).filter((k) => k.hasMatrix);
    const next = order[order.findIndex((k) => k.id === key.id) + 1];
    setState({selection: next ? {keyId: next.id, part: 'key'} : null});
  }
};

/** Brings every connected keyboard in line with the library; returns how many changed. */
export const syncAllKeyboards = async ({announce = true} = {}) => {
  let changed = 0;
  for (const session of Object.values(getState().sessions)) {
    if (session.status !== 'ready') continue;
    if (await syncKeyboard(session.id, {announce})) changed++;
  }
  return changed;
};

/** Saves an action from the library editor and updates the keyboards using it. */
export const saveLibraryAction = async (draft: LibraryAction) => {
  const name = draft.name.trim() || 'Adsız eylem';
  let saved = await saveAction({...draft, name, tags: [...new Set(draft.tags.map((t) => t.trim()).filter(Boolean))]});
  // Keyboards not connected right now still need the trigger in the helper file.
  if (useLibrary.getState().bindings.some((b) => b.actionId === saved.id)) {
    saved = await ensureTrigger(saved, (os) => deliveryContext(getState().selectedId, os));
  }
  await syncAllKeyboards();
  return useLibrary.getState().actions.find((a) => a.id === saved.id) ?? saved;
};

export const deleteLibraryAction = async (id: string) => {
  await deleteAction(id);
  await syncAllKeyboards({announce: false});
};

/** Takes an action off one key; connected keyboards are updated right away. */
export const unbindAction = async (binding: KeyBinding) => {
  await clearBinding(binding);
  await syncAllKeyboards({announce: false});
};

export const importLibraryFile = async (file: File) => {
  try {
    const added = await importLibrary(JSON.parse(await file.text()));
    toast(added ? `${added} eylem içe aktarıldı.` : 'Dosyadaki eylemler zaten güncel.', 'success');
    if (added) await syncAllKeyboards();
  } catch (error) {
    toast(error instanceof SyntaxError ? 'Dosya okunamadı (JSON değil).' : errorText(error), 'error', 7000);
  }
};

// ---------------------------------------------------------------------------
// Matrix tester

export const readMatrix = async (id: string) => {
  const ready = requireReady(id);
  if (!ready) return null;
  return ready.controller.api.getMatrixState(ready.data.matrix, getState().sessions[id]?.protocol ?? 0);
};

// ---------------------------------------------------------------------------
// Backups

export const snapshot = (id: string): BackupFile | null => {
  const ready = requireReady(id);
  const session = getState().sessions[id];
  if (!ready || !session) return null;
  const {data, controller} = ready;
  const counts = layoutChoiceCounts(data.definition);
  return createBackup(
    {
      name: data.name,
      vendorId: session.vendorId,
      productId: session.productId,
      vendorProductId: session.vendorProductId,
      protocol: session.protocol ?? 0,
      matrix: data.matrix,
      keymap: data.keymap,
      encoders: data.encoders,
      layoutOptions: counts.length ? packLayoutOptions(data.layoutOptions, counts) : undefined,
      macroCount: data.macroCount,
      macroBufferSize: data.macroBufferSize,
      macroBytes: data.macroBytes,
      menuValues: data.menuValues,
      menuCommands: Object.fromEntries([...menuCommands(data.menus)].map(([name, [, ...bytes]]) => [name, bytes])),
    },
    controller.codec,
  );
};

const AUTO_BACKUP_INTERVAL = 12 * 60 * 60 * 1000;
const MAX_AUTO_BACKUPS = 20;

export const saveBackup = async (id: string, label: string, automatic = false) => {
  const file = snapshot(id);
  const session = getState().sessions[id];
  if (!file || !session) return null;
  try {
    const backupId = await db.backups.add({
      vendorProductId: session.vendorProductId,
      deviceName: file.keyboard.name,
      label,
      createdAt: Date.now(),
      automatic,
      data: file,
    });
    if (automatic) {
      const autos = await db.backups.where('vendorProductId').equals(session.vendorProductId).filter((b) => b.automatic).sortBy('createdAt');
      const excess = autos.slice(0, Math.max(0, autos.length - MAX_AUTO_BACKUPS));
      await db.backups.bulkDelete(excess.map((b) => b.id!));
    }
    return backupId;
  } catch {
    return null;
  }
};

const autoBackup = async (id: string) => {
  const session = getState().sessions[id];
  if (!session || session.kind === 'virtual') return;
  try {
    const latest = await db.backups.where('vendorProductId').equals(session.vendorProductId).reverse().sortBy('createdAt');
    const lastAuto = latest.find((b) => b.automatic);
    if (!lastAuto || Date.now() - lastAuto.createdAt > AUTO_BACKUP_INTERVAL) await saveBackup(id, 'Otomatik yedek (bağlanınca)', true);
  } catch {
    // Storage unavailable.
  }
};

export const restoreBackup = async (file: BackupFile | ViaSaveFile) => {
  const {selectedId} = getState();
  const ready = requireReady(selectedId);
  const session = selectedId ? getState().sessions[selectedId] : undefined;
  if (!ready || !selectedId || !session) return false;
  const fileVpid = 'format' in file ? file.keyboard.vendorProductId : file.vendorProductId;
  if (fileVpid !== session.vendorProductId) {
    toast('Bu yedek başka bir klavyeye ait; geri yüklenmedi.', 'error');
    return false;
  }
  const {data, controller} = ready;
  const protocol = session.protocol ?? 0;
  const plan = planRestore(file, controller.codec, {
    layerCount: data.layerCount,
    rows: data.matrix.rows,
    cols: data.matrix.cols,
    protocol,
    macroCount: data.macroCount,
  });
  await saveBackup(selectedId, 'Geri yüklemeden önce', true);
  try {
    const keymap = data.keymap.map((keys, l) => plan.keymap[l] ?? keys);
    await controller.api.writeKeymap(keymap, data.matrix, protocol);
    updateData(selectedId, {keymap});
    if (plan.encoders && data.encoderCount) {
      for (const [layer, row] of plan.encoders.entries()) {
        for (const [encoder, [ccw, cw]] of row.slice(0, data.encoderCount).entries()) {
          await controller.api.setEncoder(layer, encoder, false, ccw);
          await controller.api.setEncoder(layer, encoder, true, cw);
        }
      }
      updateData(selectedId, (d) => ({
        encoders: d.encoders.map((row, l) => row.map((pair, e) => plan.encoders?.[l]?.[e] ?? pair)),
      }));
    }
    if (plan.layoutOptions !== undefined) {
      await controller.api.setLayoutOptions(plan.layoutOptions);
      updateData(selectedId, {layoutOptions: unpackLayoutOptions(plan.layoutOptions, layoutChoiceCounts(data.definition))});
    }
    if (plan.macros) await writeMacros(plan.macros);
    if (plan.menuValues) {
      const channels = new Set<number>();
      for (const [name, {command, value}] of Object.entries(plan.menuValues)) {
        if (!(name in data.menuValues)) continue;
        await controller.api.setCustomValue(command, value).catch(() => undefined);
        channels.add(command[0]);
      }
      for (const channel of channels) await controller.api.saveCustomValues(channel).catch(() => undefined);
      await syncMenuValues(selectedId);
    }
    setState({undo: [], redo: []});
    plan.warnings.slice(0, 3).forEach((w) => toast(w, 'info', 8000));
    toast('Yedek geri yüklendi.', 'success');
    return true;
  } catch (error) {
    toast(`Geri yükleme yarıda kaldı: ${errorText(error)}`, 'error', 8000);
    return false;
  }
};

/** For a v2/v3 version string of the session. */
export const wantedDefinitionVersion = (session: SessionInfo): DefinitionVersion =>
  (session.protocol ?? 0) >= Protocol.V3Definitions ? 'v3' : 'v2';

export const useDefinitionForSession = async (id: string, definition: AnyDefinition, version: DefinitionVersion) =>
  loadKeyboard(id, {definition, version, source: 'user'});
