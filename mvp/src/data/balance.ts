/**
 * 《登仙·MVP》全部数值常量。
 *
 * 铁律：`systems/` 里不许出现硬编码数字，所有可调数值都从这里取。
 * 与 `design-docs/` 的冲突只在核对时改这一个文件。
 */

import type {
  Realm,
  RealmStage,
  Roots,
  Technique,
  TechniqueId,
  TechniqueSlot,
  WuXing,
} from '../types.ts';

/** 境界顺序（低 → 高）。 */
export const REALMS: readonly Realm[] = ['炼气', '筑基', '金丹'];

/** 境界内阶位顺序（低 → 高）。 */
export const REALM_STAGES: readonly RealmStage[] = ['前期', '中期', '后期'];

/** 一阶的定义：所属境界 + 阶位名 + 进入本阶所需修为。 */
export interface StageDef {
  realm: Realm;
  stage: RealmStage;
  /** 进入本阶所需的修为阈值；0 为初始阶。 */
  threshold: number;
}

/**
 * 9 阶阶位表，索引即阶位（0 → 8）。
 *
 * 阈值即「进入本阶所需修为」；本阶上限 = 下一阶阈值 × CULTIVATION_MAX_FACTOR，
 * 顶阶（金丹·后期）回落到自身阈值 × 系数。
 */
export const STAGE_TABLE: readonly StageDef[] = [
  { realm: '炼气', stage: '前期', threshold: 0 },
  { realm: '炼气', stage: '中期', threshold: 100 },
  { realm: '炼气', stage: '后期', threshold: 240 },
  { realm: '筑基', stage: '前期', threshold: 430 },
  { realm: '筑基', stage: '中期', threshold: 700 },
  { realm: '筑基', stage: '后期', threshold: 1080 },
  { realm: '金丹', stage: '前期', threshold: 1600 },
  { realm: '金丹', stage: '中期', threshold: 2300 },
  { realm: '金丹', stage: '后期', threshold: 3200 },
];

/** 阶位总数（9）。 */
export const STAGE_COUNT = STAGE_TABLE.length;

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

/** 功法库的一条：id + 展示名 + 两个系数。 */
export interface TechniqueDef extends Technique {
  id: TechniqueId;
}

/** 功法库：综合效率 = absorbRate × convertRate（0.12 → 0.225，便于测出差异）。 */
export const TECHNIQUE_LIBRARY: readonly TechniqueDef[] = [
  { id: 'qingmu', name: '青木诀', absorbRate: 0.4, convertRate: 0.3 },
  { id: 'liehuo', name: '烈火诀', absorbRate: 0.6, convertRate: 0.25 },
  { id: 'houtu', name: '厚土诀', absorbRate: 0.35, convertRate: 0.5 },
  { id: 'gengjin', name: '庚金诀', absorbRate: 0.5, convertRate: 0.4 },
  { id: 'xuanshui', name: '玄水诀', absorbRate: 0.25, convertRate: 0.9 },
];

/** 功法槽位数：固定 3 槽。 */
export const TECHNIQUE_SLOT_COUNT = 3;

/** 默认三槽：青木诀 / 烈火诀 / 厚土诀。 */
export const DEFAULT_TECHNIQUE_IDS: readonly TechniqueId[] = [
  'qingmu',
  'liehuo',
  'houtu',
];

/** 按 id 取功法；未知 id 返回 null。 */
export function findTechnique(id: string): TechniqueDef | null {
  return TECHNIQUE_LIBRARY.find((def) => def.id === id) ?? null;
}

/** 按 id 取功法；未知 id 直接抛错（app 层与 UI 用）。 */
export function techniqueById(id: string): TechniqueDef {
  const hit = findTechnique(id);
  if (hit === null) throw new Error(`未知功法：${id}`);
  return hit;
}

/** 只保留技法三字段的副本（存档里不存功法库 id）。 */
export function toTechnique(def: Technique): Technique {
  return {
    name: def.name,
    absorbRate: def.absorbRate,
    convertRate: def.convertRate,
  };
}

/** 默认三槽功法（每次返回新副本，避免共享引用）。 */
export function defaultTechniques(): Technique[] {
  return DEFAULT_TECHNIQUE_IDS.map((id) => toTechnique(techniqueById(id)));
}

/** 起始功法「青木诀」（默认槽 0），与 PR #4 测试一致。 */
export const START_TECHNIQUE: Technique = toTechnique(techniqueById('qingmu'));

/** 校验槽位下标：必须是 0 / 1 / 2 的整数，否则抛错。 */
export function assertTechniqueSlot(slot: number): asserts slot is TechniqueSlot {
  if (slot !== 0 && slot !== 1 && slot !== 2) {
    throw new RangeError(
      `功法槽位必须是 0 / 1 / 2，当前 ${String(slot)}`,
    );
  }
}

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

/** 初始阶位。 */
export const INITIAL_STAGE: RealmStage = '前期';

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

/** 阶位下标；未知组合抛错。 */
export function stageIndexOf(realm: Realm, stage: RealmStage): number {
  const index = STAGE_TABLE.findIndex(
    (entry) => entry.realm === realm && entry.stage === stage,
  );
  if (index < 0) throw new Error(`未知阶位：${realm}·${stage}`);
  return index;
}

/** 按阶位下标取定义；越界抛错。 */
export function stageAt(index: number): StageDef {
  const entry = STAGE_TABLE[index];
  if (entry === undefined) throw new RangeError(`阶位下标越界：${index}`);
  return entry;
}

/**
 * 下一阶（前期 → 中期 → 后期 → 下一境界·前期）。
 * 顶阶（金丹·后期）返回 null。
 */
export function nextStageOf(realm: Realm, stage: RealmStage): StageDef | null {
  const index = stageIndexOf(realm, stage);
  const next = STAGE_TABLE[index + 1];
  return next === undefined ? null : next;
}

/** 进入下一阶所需修为 = 下一阶阈值；顶阶回落到自身阈值。 */
export function nextThresholdOf(realm: Realm, stage: RealmStage): number {
  const next = nextStageOf(realm, stage);
  return next === null ? stageAt(stageIndexOf(realm, stage)).threshold : next.threshold;
}

/** 当前阶位的修为上限 = 下一阶阈值 × 4；顶阶用自身阈值 × 4。 */
export function cultivationMaxOf(realm: Realm, stage: RealmStage): number {
  return nextThresholdOf(realm, stage) * CULTIVATION_MAX_FACTOR;
}

/** 统一展示文案：`炼气·中期`。 */
export function stageLabel(realm: Realm, stage: RealmStage): string {
  return `${realm}·${stage}`;
}

/**
 * 各境界的起始阈值（炼气 0 / 筑基 430 / 金丹 1600）。
 * 从阶位表派生，避免两处手写漂移；迁移与摘要用。
 */
export const REALM_THRESHOLDS: Record<Realm, number> = Object.fromEntries(
  REALMS.map((realm) => [realm, stageAt(stageIndexOf(realm, '前期')).threshold]),
) as Record<Realm, number>;

/** 炼气·前期的突破阈值（100）。 */
export const INITIAL_NEXT_THRESHOLD = nextThresholdOf(INITIAL_REALM, INITIAL_STAGE);

/** 炼气·前期的修为上限（400）：到 100 就能突破，但可以继续攒到 400。 */
export const INITIAL_CULTIVATION_MAX = cultivationMaxOf(INITIAL_REALM, INITIAL_STAGE);
