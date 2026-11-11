/**
 * Decides whether the music should be up, from the typing speed over time.
 * Pure: the caller feeds it the time, speed and whether a run is going.
 */

/** The speed must hold at the threshold this long before the music starts. */
export const ATTACK_MS = 1500;
/** The speed must stay under the release level this long before the music stops. */
export const RELEASE_MS = 3000;
/** Below this share of the threshold counts as slow; in between nothing changes. */
export const RELEASE_RATIO = 0.9;
/** Without a run going, the music stays on this long (a breath between texts). */
export const REST_MS = 20000;

export type GateState = {
  on: boolean;
  /** Since when the speed has been at or above the threshold, without a break. */
  aboveSince: number | null;
  /** Since when the speed has been under the release level, without a break. */
  belowSince: number | null;
  /** Since when no run has been going. */
  idleSince: number | null;
};

export type GateInput = {now: number; wpm: number | null; running: boolean; threshold: number};

export const initialGate: GateState = {on: false, aboveSince: null, belowSince: null, idleSince: null};

const same = (a: GateState, b: GateState) =>
  a.on === b.on && a.aboveSince === b.aboveSince && a.belowSince === b.belowSince && a.idleSince === b.idleSince;

/** The next state; the same object comes back when nothing changed. */
export const stepGate = (state: GateState, {now, wpm, running, threshold}: GateInput): GateState => {
  let next: GateState;
  if (!running) {
    const idleSince = state.idleSince ?? now;
    next = {on: state.on && now - idleSince < REST_MS, aboveSince: null, belowSince: null, idleSince};
  } else if (wpm === null) {
    // The run just started: keep whatever was playing until its speed means something.
    next = {on: state.on, aboveSince: null, belowSince: null, idleSince: null};
  } else if (wpm >= threshold) {
    const aboveSince = state.aboveSince ?? now;
    next = {on: state.on || now - aboveSince >= ATTACK_MS, aboveSince, belowSince: null, idleSince: null};
  } else if (wpm < threshold * RELEASE_RATIO) {
    const belowSince = state.belowSince ?? now;
    next = {on: state.on && now - belowSince < RELEASE_MS, aboveSince: null, belowSince, idleSince: null};
  } else {
    next = {on: state.on, aboveSince: null, belowSince: null, idleSince: null};
  }
  return same(state, next) ? state : next;
};

/** True once the rest after the last run is over: nobody is typing here. */
export const isResting = (state: GateState, now: number) => state.idleSince !== null && now - state.idleSince >= REST_MS;
