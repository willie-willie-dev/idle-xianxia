/**
 * 事件抽取：奇遇优先，日常按冷却。
 *
 * 纯函数，保留原有 LCG（`systems/rng.ts`）：同种子同池长结果稳定，
 * 返回的 `nextSeed` 必须由调用方存回角色。
 */

import { DAILY_COOLDOWN_DAYS } from '../data/balance.ts';
import type { Realm } from '../types.ts';
import { nextSeed, seedToIndex } from '../systems/rng.ts';
import type { EventPool } from './pool.ts';
import { eventPool } from './pool.ts';
import type { GameEvent, PickResult } from './types.ts';

/** 候选池：同境界、同阶位且不在 `doneIds` 里的事件，保持数据顺序。 */
export function eligibleEvents(
  realm: Realm,
  stage: GameEvent['stage'],
  doneIds: readonly string[],
  pool: EventPool = eventPool,
): GameEvent[] {
  return pool.eligible({ realm, stage, doneIds });
}

/**
 * 抽一条事件。
 *
 * 入参为 `{ realm, stage, doneIds, dailyDone, day, seed }`。
 * 先抽本阶位未完成的奇遇；没有再抽冷却已过的日常
 * （`day - (dailyDone[id] ?? -Infinity) >= DAILY_COOLDOWN_DAYS`）。
 * 都没有则 `event === null`，种子仍然推进。
 */
export function pickEvent(
  input: {
    realm: Realm;
    stage: GameEvent['stage'];
    doneIds: readonly string[];
    dailyDone: Record<string, number>;
    day: number;
    seed: number;
  },
  pool: EventPool = eventPool,
): PickResult {
  const rolled = nextSeed(input.seed);
  const story = pool
    .byKind({ realm: input.realm, stage: input.stage, kind: 'story' })
    .filter((event) => !input.doneIds.includes(event.id));
  if (story.length > 0) {
    return {
      event: story[seedToIndex(rolled, story.length)],
      nextSeed: rolled,
    };
  }

  const daily = pool
    .byKind({ realm: input.realm, stage: input.stage, kind: 'daily' })
    .filter(
      (event) =>
        input.day - (input.dailyDone[event.id] ?? -Infinity) >= DAILY_COOLDOWN_DAYS,
    );
  if (daily.length > 0) {
    return {
      event: daily[seedToIndex(rolled, daily.length)],
      nextSeed: rolled,
    };
  }
  return { event: null, nextSeed: rolled };
}
