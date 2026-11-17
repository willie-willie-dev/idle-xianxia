/**
 * 背包与功法槽位：全部是纯函数。
 *
 * 规则：
 * - 同一功法只保留一本（按 `techniqueId` 去重，`uid` 只是实例 id）；
 * - 只有背包里的功法才能装备，未拥有直接抛错；
 * - 空槽返回 `null`，吸收据此判断「没有功法」。
 */

import {
  assertTechniqueSlot,
  findTechnique,
  toTechnique,
} from '../data/balance.ts';
import type {
  InventoryItem,
  Technique,
  TechniqueSlot,
} from '../types.ts';

/** 加入背包的结果；`added === false` 表示已拥有同一种功法，原样返回。 */
export interface AddItemResult {
  inventory: InventoryItem[];
  added: boolean;
}

/** 背包里是否已有某种功法。 */
export function hasTechnique(
  inventory: readonly InventoryItem[],
  techniqueId: string,
): boolean {
  return inventory.some((item) => item.techniqueId === techniqueId);
}

/** 按实例 id 找背包条目；找不到返回 null。 */
export function findItemByUid(
  inventory: readonly InventoryItem[],
  uid: string,
): InventoryItem | null {
  return inventory.find((item) => item.uid === uid) ?? null;
}

/**
 * 往背包里加一条物品。
 *
 * 同 `techniqueId` 已存在时忽略并返回 `added: false`，不产生第二条。
 */
export function addItem(
  inventory: readonly InventoryItem[],
  item: InventoryItem,
): AddItemResult {
  if (hasTechnique(inventory, item.techniqueId)) {
    return { inventory: [...inventory], added: false };
  }
  return { inventory: [...inventory, item], added: true };
}

/**
 * 把背包里的某本功法装备到指定槽位。
 *
 * 槽位必须是 0 / 1 / 2；功法必须在背包里且存在于功法库，否则抛错。
 * 不改动 `activeSlot` —— 装备与「让哪一槽生效」是两件事。
 */
export function equip(
  slots: readonly (string | null)[],
  slot: TechniqueSlot,
  techniqueId: string,
  inventory: readonly InventoryItem[],
): (string | null)[] {
  assertTechniqueSlot(slot);
  if (!hasTechnique(inventory, techniqueId)) {
    throw new Error(`功法不在背包里：${techniqueId}`);
  }
  if (findTechnique(techniqueId) === null) {
    throw new Error(`未知功法：${techniqueId}`);
  }
  const next: (string | null)[] = [...slots];
  next[slot] = techniqueId;
  return next;
}

/** 当前生效功法；空槽或库外 id 返回 null。 */
export function activeTechnique(
  slots: readonly (string | null)[],
  activeSlot: TechniqueSlot,
): Technique | null {
  assertTechniqueSlot(activeSlot);
  const id = slots[activeSlot];
  if (id === null || id === undefined) return null;
  const def = findTechnique(id);
  return def === null ? null : toTechnique(def);
}
