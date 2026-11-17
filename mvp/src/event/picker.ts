/**
 * 事件抽取：按境界 + 未完成过滤，再用种子选一条。
 *
 * 纯函数，保留原有 LCG（`systems/rng.ts`）：同种子同池长结果稳定，
 * 返回的 `nextSeed` 必须由调用方存回角色。
 */

import type { Realm } from '../types.ts';
import { nextSeed, seedToIndex } from '../systems/rng.ts';
import type { EventPool } from './pool.ts';
import { eventPool } from './pool.ts';
import type { GameEvent, PickEventInput, PickResult } from './types.ts';

/** 候选池：同境界且不在 `doneIds` 里的事件，保持数据顺序。 */
export function eligibleEvents(
  realm: Realm,
  doneIds: readonly string[],
  pool: EventPool = eventPool,
): GameEvent[] {
  return pool.eligible({ realm, doneIds });
}

/**
 * 抽一条事件。
 *
 * `event === null` 表示本境界已历练完；此时种子仍然推进，
 * 保证「抽一次 = 消耗一个随机数」的行为稳定。
 */
export function pickEvent(
  input: PickEventInput,
  pool: EventPool = eventPool,
): PickResult {
  const rolled = nextSeed(input.seed);
  const candidates = eligibleEvents(input.realm, input.doneIds ?? [], pool);
  if (candidates.length === 0) return { event: null, nextSeed: rolled };
  return {
    event: candidates[seedToIndex(rolled, candidates.length)],
    nextSeed: rolled,
  };
}
