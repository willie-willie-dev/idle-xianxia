/**
 * 消耗品：纯函数。按背包 uid 使用一件，返回新角色与效果，不改入参。
 *
 * - 只认 `kind === "consumable"` 的条目，找不到就抛错；
 * - 效果按 `CONSUMABLE_LIBRARY` 的 kind：回体力、加修为、或放下一次破境保证；
 * - 使用后 count - 1，扣到 0 时从背包移除。
 */

import { findConsumable } from '../data/balance.ts';
import type { ConsumableItem, MvpCharacter } from '../types.ts';
import { restoreStamina } from './stamina.ts';

/** 使用一件消耗品后的效果。amount 取自消耗品库。 */
export interface ConsumableEffect {
  kind: 'stamina' | 'cultivation' | 'breakthrough';
  amount: number;
}

export interface UseConsumableResult {
  character: MvpCharacter;
  effect: ConsumableEffect;
}

/** 修为加上 amount，夹在 [0, cultivationMax]。 */
function addCultivation(current: number, amount: number, max: number): number {
  const base = Number.isFinite(current) ? current : 0;
  const gain = Number.isFinite(amount) ? amount : 0;
  const cap = Number.isFinite(max) ? Math.max(0, max) : 0;
  return Math.min(Math.max(0, base + gain), cap);
}

/**
 * 使用背包里 uid 对应的消耗品。
 *
 * 不存在、不是消耗品、或 id 不在消耗品库时抛错。
 */
export function useConsumable(
  character: MvpCharacter,
  uid: string,
): UseConsumableResult {
  const item = character.inventory.find(
    (entry): entry is ConsumableItem =>
      entry.uid === uid && entry.kind === 'consumable',
  );
  if (item === undefined) {
    throw new Error(`消耗品不在背包里：${uid}`);
  }

  const def = findConsumable(item.itemId);
  if (def === null) {
    throw new Error(`未知消耗品：${item.itemId}`);
  }

  let consumed = false;
  const inventory = character.inventory.flatMap((entry) => {
    if (consumed || entry.uid !== uid || entry.kind !== 'consumable') {
      return [entry];
    }
    consumed = true;
    const nextCount = entry.count - 1;
    if (!Number.isFinite(nextCount) || nextCount <= 0) return [];
    return [{ ...entry, count: nextCount }];
  });

  const effect: ConsumableEffect = { kind: def.kind, amount: def.amount };
  const next: MvpCharacter = { ...character, inventory };

  if (def.kind === 'stamina') {
    next.stamina = restoreStamina(character.stamina, def.amount, character.staminaMax);
  } else if (def.kind === 'cultivation') {
    next.cultivation = addCultivation(
      character.cultivation,
      def.amount,
      character.cultivationMax,
    );
  } else {
    next.breakthroughGuard = true;
  }

  return { character: next, effect };
}
