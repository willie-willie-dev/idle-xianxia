/**
 * 事件系统的全部类型。
 *
 * 这一层只有类型，没有运行时代码。事件数据仍在 `data/events.ts`，
 * 由 `event/pool.ts` 建索引；`types.ts` 再从这里转出，避免两处定义漂移。
 */

import type { Realm } from '../types.ts';

/** 事件的一个选项：给修为、给剧情标记、掉功法，至少给一样。 */
export interface EventOption {
  text: string;
  cultivationGain?: number;
  plotFlag?: string;
  /**
   * 选项级功法掉落（`TECHNIQUE_LIBRARY` 的 id）。
   * 掉落进背包，需要玩家自己装备才生效；同一功法只保留一本。
   */
  grants?: string[];
}

/** 一条事件。 */
export interface GameEvent {
  id: string;
  realm: Realm;
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
 * 结算一次选项的回报。
 *
 * `cultivation` 是结算后的修为；`cultivationGain` 是本次增量；
 * `grants` 是选项掉落的功法 id（是否重复由应用层用背包判断）。
 */
export interface ResolveResult {
  cultivation: number;
  cultivationGain: number;
  plotFlags: string[];
  grants: string[];
  nextSeed: number;
}
