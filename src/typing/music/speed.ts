/** Speed is not shown for the first moments of a run: a few keys say nothing yet. */
export const MEASURE_AFTER_MS = 2000;
export const SPEED_WINDOW_MS = 5000;

/**
 * Correct keystrokes over the last `windowMs` as words per minute (5 characters = 1 word).
 * The window never reaches back before the run started; null until the run is measurable.
 * `hitTimes` is ascending, so only the keystrokes inside the window are visited.
 */
export const rollingWpm = (hitTimes: number[], now: number, startedAt: number | null, windowMs = SPEED_WINDOW_MS): number | null => {
  if (startedAt === null || now - startedAt < MEASURE_AFTER_MS) return null;
  const window = Math.min(windowMs, now - startedAt);
  const from = now - window;
  let count = 0;
  for (let i = hitTimes.length - 1; i >= 0 && hitTimes[i] >= from; i--) if (hitTimes[i] <= now) count++;
  return count / 5 / (window / 60000);
};
