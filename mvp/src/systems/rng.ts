/**
 * 线性同余随机数（LCG），纯函数、可复现。
 *
 * seed = (seed × RNG_MULTIPLIER + RNG_INCREMENT) >>> 0
 * 每次抽取都返回新的 seed，调用方必须把它存回角色存档。
 */

import { RNG_INCREMENT, RNG_MULTIPLIER, RNG_MODULUS } from '../data/balance.ts';

/** 推进一个种子，得到下一个 uint32。 */
export function nextSeed(seed: number): number {
  const base = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  return (base * RNG_MULTIPLIER + RNG_INCREMENT) >>> 0;
}

/** 把 uint32 种子映射到 [0, 1)。 */
export function seedToUnit(seed: number): number {
  return seed / RNG_MODULUS;
}

/** 从种子里取一个 [0, length) 的下标，池为空时返回 0。 */
export function seedToIndex(seed: number, length: number): number {
  if (length <= 0) return 0;
  return seed % length;
}
