/**
 * 事件系统对外服务：抽事件、结算事件、查池子。
 *
 * 纯函数都在 `pool / picker / resolver` 里；这一层只做依赖装配，
 * 允许持有事件池引用（仍不碰 DOM、存储、时间）。
 */

import type { Realm } from '../types.ts';
import { pickEvent } from './picker.ts';
import { eventPool } from './pool.ts';
import type { EventPool } from './pool.ts';
import { applyOption } from './resolver.ts';
import type { GameEvent, ResolveResult } from './types.ts';

/** `next()` 需要的角色切片。 */
export interface EventCharacterView {
  realm: Realm;
  rngSeed: number;
  eventState?: { doneIds?: readonly string[] };
}

/** `next()` 的返回：事件 + 推进后的种子。 */
export interface NextEventResult {
  event: GameEvent | null;
  seed: number;
}

/** `resolve()` 需要的角色切片。 */
export interface EventResolveView {
  cultivation: number;
  rngSeed: number;
}

/** 事件系统服务。 */
export interface EventSystem {
  /** 抽一条当前境界的事件；`event === null` 表示本境界已历练完。 */
  next(character: EventCharacterView): NextEventResult;
  /** 结算指定事件 + 选项；未知事件 / 越界选项抛错。 */
  resolve(
    character: EventResolveView,
    eventId: string,
    optionIndex: number,
  ): ResolveResult;
  /** 全部事件（数据顺序）。 */
  list(): readonly GameEvent[];
  /** 按 id 查事件；未知 id 返回 null。 */
  byId(id: string): GameEvent | null;
  /** 底层事件池（查境界、查全量用）。 */
  readonly pool: EventPool;
}

export interface EventSystemDeps {
  /** 可注入的事件池；缺省用 `data/events.ts` 的默认池。 */
  pool?: EventPool;
}

/** 装配一个事件系统（默认持有全局事件池）。 */
export function createEventSystem(deps: EventSystemDeps = {}): EventSystem {
  const pool = deps.pool ?? eventPool;
  return {
    pool,
    next(character) {
      const picked = pickEvent(
        {
          realm: character.realm,
          doneIds: character.eventState?.doneIds ?? [],
          seed: character.rngSeed,
        },
        pool,
      );
      return { event: picked.event, seed: picked.nextSeed };
    },
    resolve(character, eventId, optionIndex) {
      const event = pool.byId(eventId);
      if (event === null) throw new Error(`未知事件：${eventId}`);
      return applyOption(
        { cultivation: character.cultivation, rngSeed: character.rngSeed },
        event,
        optionIndex,
      );
    },
    list: () => pool.all(),
    byId: (id) => pool.byId(id),
  };
}

export { eligibleEvents, pickEvent } from './picker.ts';
export { applyOption } from './resolver.ts';
export { createEventPool, eventPool } from './pool.ts';
export type { EventPool } from './pool.ts';
export type {
  EventOption,
  EventPoolQuery,
  GameEvent,
  PickEventInput,
  PickEventResult,
  PickResult,
  ResolveResult,
} from './types.ts';
