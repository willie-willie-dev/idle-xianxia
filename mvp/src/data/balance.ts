/**
 * 《登仙·MVP》全部数值常量。
 *
 * 铁律：`systems/` 里不许出现硬编码数字，所有可调数值都从这里取。
 * 与 `design-docs/` 的冲突只在核对时改这一个文件。
 */

import type { Realm, Roots, Technique, WuXing } from '../types.ts';

/** 境界顺序（低 → 高）。 */
export const REALMS: readonly Realm[] = ['炼气', '筑基', '金丹'];

/** 每个境界进入所需的修为阈值。 */
export const REALM_THRESHOLDS: Record<Realm, number> = {
  炼气: 0,
  筑基: 100,
  金丹: 500,
};

/** 修为上限 = 下一阈值 × 本系数。 */
export const CULTIVATION_MAX_FACTOR = 4;

/** 突破失败损耗比例（10–30% 区间取中点，见 R4）。 */
export const FAIL_LOSS_RATE = 0.2;

/** 灵根合计目标值。 */
export const ROOTS_SUM_TARGET = 100;

/** 灵根合计允许误差（±0.01）。 */
export const ROOTS_SUM_TOLERANCE = 0.01;

/** 默认灵根：乾 15 / 坤 10 / 五行各 15，合计 100。 */
export const DEFAULT_ROOTS: Roots = {
  metal: 15,
  wood: 15,
  water: 15,
  fire: 15,
  earth: 15,
  qian: 15,
  kun: 10,
};

/** 起始功法「青木诀」，与 PR #4 测试一致。 */
export const START_TECHNIQUE: Technique = {
  name: '青木诀',
  absorbRate: 0.4,
  convertRate: 0.3,
};

/** 五行展示顺序（主属性推导用，先到先得）。 */
export const ELEMENT_ORDER: readonly WuXing[] = ['金', '木', '水', '火', '土'];

/** 灵根平手时的默认主属性。 */
export const DEFAULT_ELEMENT: WuXing = '木';

/** 初始天数。 */
export const INITIAL_DAY = 1;

/**
 * 各动作消耗的天数（v0.2：天为最小单位）。
 * 事件可通过 `GameEvent.days` 覆盖，取 2~7 天。
 */
export const ACTION_DAYS = {
  absorb: 1,
  event: 0,
  breakthrough: 0,
} as const;

/** 初始修为。 */
export const INITIAL_CULTIVATION = 0;

/** 初始境界。 */
export const INITIAL_REALM: Realm = '炼气';

/** 角色最小的修为增量：事件选项没写修为时的兜底，保证不空结算。 */
export const DEFAULT_EVENT_GAIN = 5;

/** 线性同余随机数：seed = (seed × A + C) >>> 0。 */
export const RNG_MULTIPLIER = 1664525;
export const RNG_INCREMENT = 1013904223;
export const RNG_MODULUS = 4294967296;

/** 下一境界；金丹已是顶阶，返回 null。 */
export function nextRealm(realm: Realm): Realm | null {
  const index = REALMS.indexOf(realm);
  if (index < 0 || index >= REALMS.length - 1) return null;
  return REALMS[index + 1];
}

/** 当前境界突破所需的修为 = 下一境界的阈值；顶阶回落到自身阈值。 */
export function nextThresholdOf(realm: Realm): number {
  const next = nextRealm(realm);
  return next === null ? REALM_THRESHOLDS[realm] : REALM_THRESHOLDS[next];
}

/** 当前境界的修为上限 = 下一阈值 × 4；顶阶同样是自身阈值 × 4。 */
export function cultivationMaxOf(realm: Realm): number {
  return nextThresholdOf(realm) * CULTIVATION_MAX_FACTOR;
}

/** 炼气期的突破阈值（100）。 */
export const INITIAL_NEXT_THRESHOLD = nextThresholdOf(INITIAL_REALM);

/** 炼气期的修为上限（400）：到 100 就能突破，但可以继续攒到 400。 */
export const INITIAL_CULTIVATION_MAX = cultivationMaxOf(INITIAL_REALM);
