/**
 * 事件系统的全部类型。
 *
 * 这一层只有类型，没有运行时代码。事件数据仍在 `data/events.ts`，
 * 由 `event/pool.ts` 建索引；`types.ts` 再从这里转出，避免两处定义漂移。
 */

import type { Realm, RealmStage } from '../types.ts';

/** 事件的一个选项：给修为、给剧情标记、掉功法，至少给一样。 */
export interface EventOption {
  text: string;
  /** 选项被选中后的结果交代。 */
  outcome: string;
  cultivationGain?: number;
  plotFlag?: string;
  /**
   * 选项级功法掉落（`TECHNIQUE_LIBRARY` 的 id）。
   * 掉落进背包，需要玩家自己装备才生效；同一功法只保留一本。
   */
  grants?: string[];
  /** 选择后扣体力。 */
  staminaCost?: number;
  /** 消耗品 id，来自 `CONSUMABLE_LIBRARY`。 */
  itemGrants?: string[];
}

/** 事件类别：story = 奇遇（一次性）；daily = 日常（可复用）。 */
export type EventKind = 'story' | 'daily';

/** 一条事件。 */
export interface GameEvent {
  id: string;
  /** story = 奇遇（一次性）；daily = 日常（可复用）。 */
  kind: EventKind;
  realm: Realm;
  /** 境界内阶位：前期 / 中期 / 后期。 */
  stage: RealmStage;
  title: string;
  text: string;
  /**
   * 本次历练耗时天数（2~7）。
   * 省略时取 `ACTION_DAYS.event`，即不耗天。
   */
  days?: number;
  options: EventOption[];
}

/** 抽事件查询：按境界 + 已完成的 id 过滤。 */
export interface EventPoolQuery {
  realm: Realm;
  doneIds?: readonly string[];
}

/** 抽事件入参。 */
export interface PickEventInput extends EventPoolQuery {
  seed: number;
}

/** 抽事件结果；`nextSeed` 必须存回角色。 */
export interface PickResult {
  event: GameEvent | null;
  nextSeed: number;
}

/** 兼容旧名字：`PickEventResult` 与 `PickResult` 同构。 */
export type PickEventResult = PickResult;

/**
 * 结算一次选项的回报（应用层称作 `OptionOutcome`）。
 *
 * `cultivation` 是结算后的修为；`cultivationGain` 是本次增量；
 * `grants` 是选项掉落的功法 id（是否重复由应用层用背包判断）。
 * `staminaCost` 是本次扣除的体力，未写则为 0；
 * `itemGrants` 是选项给予的消耗品 id，未写则为空数组。
 * `optionText` 是被选中的选项原文；`outcome` 是选完后的结果交代。
 */
export interface ResolveResult {
  cultivation: number;
  cultivationGain: number;
  plotFlags: string[];
  grants: string[];
  staminaCost: number;
  itemGrants: string[];
  nextSeed: number;
  optionText: string;
  /** 选项被选中后的结果交代。 */
  outcome: string;
}
