/**
 * 《登仙·MVP》全部共享类型。
 *
 * 这一层只有类型，没有任何运行时代码（`export type` 全部被类型擦除）。
 * 灵根与功法结构直接复用 `systems/absorb.ts`，避免两处定义漂移。
 */

import type { Roots } from './systems/absorb.ts';
import type { TimeState } from './time/types.ts';
import type { ResolveResult } from './event/types.ts';

export type { Roots, TimeState };
export type {
  EventOption,
  EventPoolQuery,
  GameEvent,
  PickEventInput,
  PickEventResult,
  PickResult,
  ResolveResult,
} from './event/types.ts';

/** 五行主属性。只做展示，暂不参与计算。 */
export type WuXing = '金' | '木' | '水' | '火' | '土';

/** MVP 三阶境界。 */
export type Realm = '炼气' | '筑基' | '金丹';

/** 境界内的阶位细分：每个境界再分前 / 中 / 后期，共 9 阶。 */
export type RealmStage = '前期' | '中期' | '后期';

/** 功法库 id（`balance.ts` 的 `TECHNIQUE_LIBRARY`）。 */
export type TechniqueId =
  | 'qingmu'
  | 'liehuo'
  | 'houtu'
  | 'gengjin'
  | 'xuanshui';

/** 灵根通道名，与 `Roots` 的键一致。 */
export type SpiritRootKey = keyof Roots;

/** 功法：absorb.ts 的两个系数 + 一个展示用名字。 */
export interface Technique {
  name: string;
  absorbRate: number;
  convertRate: number;
}

/** 功法槽位下标：固定 3 槽。 */
export type TechniqueSlot = 0 | 1 | 2;

/** 物品大类：功法或消耗品。 */
export type ItemKind = 'technique' | 'consumable';

/**
 * 背包里的功法实例。
 *
 * `uid` 是实例 id（同一种功法只保留一条，`techniqueId` 才是去重键）；
 * `fromEventId` 记录来源，迁移来的老存档记为 `'migrated'`。
 */
export interface TechniqueItem {
  uid: string;
  kind: 'technique';
  /** 指向 `TECHNIQUE_LIBRARY` 的 id。 */
  techniqueId: string;
  /** 来源事件 id；迁移补进来的用 `'migrated'`。 */
  fromEventId: string;
  obtainedAt: number;
}

/** 背包里的消耗品堆叠。`itemId` 指向 `CONSUMABLE_LIBRARY`。 */
export interface ConsumableItem {
  uid: string;
  kind: 'consumable';
  /** 指向 `CONSUMABLE_LIBRARY` 的 id。 */
  itemId: string;
  count: number;
  /** 来源事件 id；迁移补进来的用 `'migrated'`。 */
  fromEventId: string;
  obtainedAt: number;
}

/** 背包里的一条物品：功法或消耗品。 */
export type InventoryItem = TechniqueItem | ConsumableItem;

/** 事件进度：已完成的 id 与累计次数。 */
export interface EventState {
  doneIds: string[];
  count: number;
}

/** 存档里的完整角色。 */
export interface MvpCharacter {
  id: string;
  name: string;
  spiritRoots: Roots;
  element: WuXing;
  realm: Realm;
  /** 境界内阶位（前期 / 中期 / 后期）。 */
  stage: RealmStage;
  cultivation: number;
  cultivationMax: number;
  nextThreshold: number;
  /** 功法三槽，长度恒为 3；元素是功法 id，空槽为 null。 */
  techniques: (string | null)[];
  /** 当前生效槽位：0 / 1 / 2；吸收只用 `techniques[activeSlot]`。 */
  activeSlot: TechniqueSlot;
  /** 背包：功法只能通过历练事件获得，装备到槽位后才生效。 */
  inventory: InventoryItem[];
  stamina: number;
  staminaMax: number;
  eventState: EventState;
  /** 每个日常事件上次完成时的天数。 */
  dailyDone?: Record<string, number>;
  /** 剧情标记（R3 的第二类回报），去重累积，写入存档。 */
  plotFlags: string[];
  /** 时间状态（v0.2：day 为最小单位）。 */
  time: TimeState;
  rngSeed: number;
  saveVersion: 1;
  createdAt: number;
  updatedAt: number;
}

/** 列表页只读字段，避免拉全量存档。 */
export interface CharacterSummary {
  id: string;
  name: string;
  realm: Realm;
  stage: RealmStage;
  cultivation: number;
  stamina: number;
  staminaMax: number;
  day: number;
  createdAt: number;
}

/** 建号入参：除名字外全部可缺省。 */
export interface CreateCharacterInput {
  name: string;
  spiritRoots?: Roots;
  element?: WuXing;
  /** 三槽功法 id；缺省取 `balance.START_SLOTS`（三个空槽）。 */
  techniques?: (string | null)[];
}

/** 突破入参（纯函数）。 */
export interface BreakthroughInput {
  cultivation: number;
  nextThreshold: number;
  realm: Realm;
  stage: RealmStage;
  /** 本次突破成功率，取值 0~1。 */
  successRate: number;
}

export interface BreakthroughResult {
  success: boolean;
  realm: Realm;
  stage: RealmStage;
  cultivation: number;
  cultivationMax: number;
  nextThreshold: number;
  /** 失败扣除的修为量，成功时为 0。 */
  lost: number;
  /** 推进后的种子（线性同余），必须存回角色。 */
  nextSeed: number;
}

/** 事件结算回报（旧名字，等同 `event/types.ts` 的 `ResolveResult`）。 */
export type OptionOutcome = ResolveResult;
