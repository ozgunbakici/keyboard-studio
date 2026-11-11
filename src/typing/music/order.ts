/** Small seeded generator (mulberry32), so a shuffled order can be reproduced in tests. */
export const seededRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * The order to play `count` tracks in, as indices. In order it is 0, 1, 2 …; shuffled,
 * every track comes once per round. `first` (the track playing now) leads the round.
 */
export const playOrder = (count: number, shuffle: boolean, seed: number, first?: number): number[] => {
  const order = Array.from({length: count}, (_, i) => i);
  if (!shuffle) return order;
  const random = seededRandom(seed);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (first !== undefined && first >= 0 && first < count) {
    order.splice(order.indexOf(first), 1);
    order.unshift(first);
  }
  return order;
};

/** A fresh shuffled round that does not open with the track that just closed the last one. */
export const nextRound = (count: number, seed: number, last: number): number[] => {
  const order = playOrder(count, true, seed);
  if (count > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
  return order;
};
