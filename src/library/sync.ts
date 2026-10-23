import {encodeMacro, encodeMacros, type Macro} from '@/via/macro-bytes';
import {resolveDelivery, type DeliveryContext} from './delivery';
import type {KeyBinding, LibraryAction, OsId, SlotUse} from './types';

export type SyncKeyboardState = {
  cols: number;
  layerCount: number;
  keymap: number[][];
  encoders: [number, number][][];
  /** Macros as stored on the keyboard (raw firmware actions). */
  macros: Macro[];
  macroCount: number;
  macroBufferSize: number;
};

export type SyncInput = {
  vendorProductId: number;
  os: OsId;
  ctx: DeliveryContext;
  actions: Map<string, LibraryAction>;
  bindings: KeyBinding[];
  slots: SlotUse[];
  keyboard: SyncKeyboardState;
};

export type SyncPlan = {
  keyWrites: {layer: number; row: number; col: number; keycode: number}[];
  encoderWrites: {layer: number; index: number; cw: boolean; keycode: number}[];
  /** Complete new macro list when any slot changes, else null. */
  macros: Macro[] | null;
  slots: SlotUse[];
  warnings: string[];
};

const sameBytes = (a: Macro, b: Macro, protocol: number) => {
  try {
    const x = encodeMacro(a, protocol);
    const y = encodeMacro(b, protocol);
    return x.length === y.length && x.every((v, i) => v === y[i]);
  } catch {
    return false;
  }
};

/**
 * Works out what to write so every bound key does its action's variant for
 * `os`. Pure: the caller applies the plan to the keyboard.
 */
export const planSync = (input: SyncInput): SyncPlan => {
  const {keyboard, ctx, os, vendorProductId} = input;
  const warnings: string[] = [];
  const macros = keyboard.macros.map((m) => m.map((a) => ({...a})));
  const owned = new Map(input.slots.filter((s) => s.vendorProductId === vendorProductId).map((s) => [s.actionId, s.slot]));
  const ownerOf = new Map([...owned].map(([actionId, slot]) => [slot, actionId]));
  const nextSlots = new Map<string, number>();
  const desiredKeys: {binding: KeyBinding; keycode: number; viaMacroSlot?: number}[] = [];

  const takeSlot = (actionId: string): number | null => {
    const existing = nextSlots.get(actionId) ?? owned.get(actionId);
    if (existing !== undefined && existing < keyboard.macroCount) return existing;
    const inUse = new Set(nextSlots.values());
    for (let slot = keyboard.macroCount - 1; slot >= 0; slot--) {
      if (inUse.has(slot)) continue;
      const owner = ownerOf.get(slot);
      // A slot is free when the library owns it for an action no longer used, or it is empty.
      if (owner !== undefined ? owner !== actionId && !input.bindings.some((b) => b.actionId === owner && input.actions.has(owner)) : macros[slot]?.length === 0) {
        return slot;
      }
    }
    return null;
  };

  for (const binding of input.bindings) {
    const action = input.actions.get(binding.actionId);
    if (!action) {
      // Removed action: the key goes back to empty (layer 0) or transparent.
      desiredKeys.push({binding, keycode: binding.layer === 0 ? 0 : (ctx.codec.value('KC_TRNS') ?? 1)});
      continue;
    }
    const delivery = resolveDelivery(action, os, ctx);
    switch (delivery.mode) {
      case 'keycode':
        desiredKeys.push({binding, keycode: delivery.keycode});
        break;
      case 'trigger':
        if (action.trigger === undefined) warnings.push(`“${action.name}” için tetikleyici atanmamış.`);
        else desiredKeys.push({binding, keycode: action.trigger});
        break;
      case 'macro': {
        const slot = takeSlot(action.id);
        if (slot === null) {
          warnings.push(`“${action.name}” için boş makro slotu kalmadı.`);
          break;
        }
        nextSlots.set(action.id, slot);
        if (!sameBytes(macros[slot] ?? [], delivery.macro, ctx.protocol)) macros[slot] = delivery.macro;
        const keycode = ctx.codec.parse(`MACRO(${slot})`);
        if (keycode !== null) desiredKeys.push({binding, keycode, viaMacroSlot: slot});
        break;
      }
      case 'unavailable':
        warnings.push(`“${action.name}”: ${delivery.summary}.`);
        break;
    }
  }

  // Slots the library owned but no longer needs are cleared to free memory.
  for (const [actionId, slot] of owned) {
    if (!nextSlots.has(actionId) && [...nextSlots.values()].every((s) => s !== slot)) macros[slot] = [];
  }

  let macrosChanged = macros.some((m, i) => !sameBytes(m, keyboard.macros[i] ?? [], ctx.protocol));
  if (macrosChanged) {
    let size = Number.POSITIVE_INFINITY;
    try {
      size = encodeMacros(macros, ctx.protocol).length;
    } catch {
      // Leave size infinite: treated as not fitting.
    }
    if (size > keyboard.macroBufferSize) {
      warnings.push(`Makrolar klavyenin hafızasına sığmıyor (${Number.isFinite(size) ? size : '?'}/${keyboard.macroBufferSize} bayt); makro gerektiren tuşlar atlandı.`);
      macrosChanged = false;
      // Do not point keys at macros that could not be written.
      for (let i = desiredKeys.length - 1; i >= 0; i--) {
        const slot = desiredKeys[i].viaMacroSlot;
        if (slot !== undefined && !sameBytes(macros[slot], keyboard.macros[slot] ?? [], ctx.protocol)) desiredKeys.splice(i, 1);
      }
      nextSlots.clear();
      owned.forEach((slot, actionId) => nextSlots.set(actionId, slot));
    }
  }

  const keyWrites: SyncPlan['keyWrites'] = [];
  const encoderWrites: SyncPlan['encoderWrites'] = [];
  for (const {binding, keycode} of desiredKeys) {
    if (binding.layer >= keyboard.layerCount) continue;
    if (binding.encoder) {
      const current = keyboard.encoders[binding.layer]?.[binding.encoder.index]?.[binding.encoder.cw ? 1 : 0];
      if (current !== undefined && current !== keycode) {
        encoderWrites.push({layer: binding.layer, index: binding.encoder.index, cw: binding.encoder.cw, keycode});
      }
    } else {
      const current = keyboard.keymap[binding.layer]?.[binding.row * keyboard.cols + binding.col];
      if (current !== undefined && current !== keycode) keyWrites.push({layer: binding.layer, row: binding.row, col: binding.col, keycode});
    }
  }

  return {
    keyWrites,
    encoderWrites,
    macros: macrosChanged ? macros : null,
    slots: [...nextSlots].map(([actionId, slot]) => ({vendorProductId, slot, actionId})),
    warnings: [...new Set(warnings)],
  };
};

export const isEmptyPlan = (plan: SyncPlan) => !plan.keyWrites.length && !plan.encoderWrites.length && !plan.macros;
