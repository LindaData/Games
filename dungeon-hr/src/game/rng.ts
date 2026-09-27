export type Rng = () => number;

/** Small seeded PRNG so simulations are reproducible in tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

export function vary(rng: Rng, value: number, spread: number): number {
  return value * (1 - spread + rng() * spread * 2);
}

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick<T>(rng: Rng, items: readonly { item: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  let r = rng() * total;
  for (const i of items) {
    r -= Math.max(0, i.weight);
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
