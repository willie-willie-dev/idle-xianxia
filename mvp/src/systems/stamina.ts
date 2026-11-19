/**
 * 体力：纯函数。不改入参、不读存档、不随机。
 *
 * - `clampStamina` 把数值夹到 [0, max]，非有限数按 0；
 * - `canAbsorb` 判断当前体力是否够付这次消耗；
 * - `spendStamina` 扣除体力，不足时扣到 0；
 * - `restoreStamina` 回复体力，不超过上限。
 */

/** 夹到 [0, max]。value 或 max 不是有限数时按 0。 */
export function clampStamina(value: number, max: number): number {
  const current = Number.isFinite(value) ? value : 0;
  const cap = Number.isFinite(max) ? Math.max(0, max) : 0;
  return Math.min(Math.max(0, current), cap);
}

/** 当前体力是否不少于 cost。 */
export function canAbsorb(stamina: number, cost: number): boolean {
  return stamina >= cost;
}

/** 扣除体力。不够时扣到 0，不出现负数。 */
export function spendStamina(stamina: number, cost: number): number {
  const current = Number.isFinite(stamina) ? stamina : 0;
  const spend = Number.isFinite(cost) ? cost : 0;
  return Math.max(0, current - spend);
}

/** 回复体力，结果夹在 [0, max]。 */
export function restoreStamina(
  stamina: number,
  amount: number,
  max: number,
): number {
  const current = Number.isFinite(stamina) ? stamina : 0;
  const gain = Number.isFinite(amount) ? amount : 0;
  return clampStamina(current + gain, max);
}
