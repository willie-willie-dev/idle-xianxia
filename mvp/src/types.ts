/**
 * 《登仙·MVP》全部共享类型。
 *
 * 这一层只有类型，没有任何运行时代码（`export type` 全部被类型擦除）。
 * 灵根与功法结构直接复用 `systems/absorb.ts`，避免两处定义漂移。
 */

import type { Roots } from './systems/absorb.ts';

export type { Roots };

/** 五行主属性。只做展示，暂不参与计算。 */
export type WuXing = '金' | '木' | '水' | '火' | '土';

/** MVP 三阶境界。 */
export type Realm = '炼气' | '筑基' | '金丹';

/** 灵根通道名，与 `Roots` 的键一致。 */
export type SpiritRootKey = keyof Roots;

/** 功法：absorb.ts 的两个系数 + 一个展示用名字。 */
export interface Technique {
  name: string;
  absorbRate: number;
  convertRate: number;
}

/** 事件的一个选项：给修为，或给剧情标记，至少给一样。 */
export interface EventOption {
  text: string;
  cultivationGain?: number;
  plotFlag?: string;
}

/** 一条事件。 */
export interface GameEvent {
  id: string;
  realm: Realm;
  title: string;
  text: string;
  options: EventOption[];
}

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
  cultivation: number;
  cultivationMax: number;
  nextThreshold: number;
  technique: Technique;
  eventState: EventState;
  /** 剧情标记（R3 的第二类回报），去重累积，写入存档。 */
  plotFlags: string[];
  day: number;
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
  cultivation: number;
  day: number;
  createdAt: number;
}

/** 建号入参：除名字外全部可缺省。 */
export interface CreateCharacterInput {
  name: string;
  spiritRoots?: Roots;
  element?: WuXing;
  technique?: Technique;
}

/** 突破结果（纯函数返回值）。 */
export interface BreakthroughInput {
  cultivation: number;
  nextThreshold: number;
  realm: Realm;
}

export interface BreakthroughResult {
  success: boolean;
  realm: Realm;
  cultivation: number;
  cultivationMax: number;
  nextThreshold: number;
  /** 失败扣除的修为量，成功时为 0。 */
  lost: number;
  /** 推进后的种子（线性同余），必须存回角色。 */
  nextSeed: number;
}

/** 抽事件入参 / 结果。 */
export interface PickEventInput {
  realm: Realm;
  doneIds: string[];
  seed: number;
}

export interface PickEventResult {
  event: GameEvent | null;
  nextSeed: number;
}

/** 事件结算回报，保证非空（修为 > 0 或剧情标记至少一个）。 */
export interface OptionOutcome {
  cultivation: number;
  cultivationGain: number;
  plotFlags: string[];
  nextSeed: number;
}
