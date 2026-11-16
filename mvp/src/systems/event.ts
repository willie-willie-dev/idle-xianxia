/**
 * 事件：按境界 + 未完成 + 种子抽一条，结算选项回报。
 *
 * R2：事件不消耗资源；R3：回报只有修为 + 剧情标记；R5：抽取用种子，可复现。
 *
 * 抽取规则：候选池 = 同境界 且 不在 doneIds 里的事件；池空则 `event: null`。
 * 索引 = 推进后的种子 mod 池长，因此同种子同池长结果稳定。
 */

import { DEFAULT_EVENT_GAIN } from '../data/balance.ts';
import { EVENTS } from '../data/events.ts';
import type {
  GameEvent,
  OptionOutcome,
  PickEventInput,
  PickEventResult,
} from '../types.ts';
import { nextSeed, seedToIndex } from './rng.ts';

/** 按境界筛出还没做过的事件（保持 EVENTS 里的顺序）。 */
export function eligibleEvents(
  realm: PickEventInput['realm'],
  doneIds: readonly string[],
): GameEvent[] {
  return EVENTS.filter(
    (event) => event.realm === realm && !doneIds.includes(event.id),
  );
}

/**
 * 抽一条事件。
 *
 * 返回的 `nextSeed` 必须存回角色；`event === null` 表示本境界已历练完。
 */
export function pickEvent(input: PickEventInput): PickEventResult {
  const rolled = nextSeed(input.seed);
  const pool = eligibleEvents(input.realm, input.doneIds);
  if (pool.length === 0) return { event: null, nextSeed: rolled };
  return { event: pool[seedToIndex(rolled, pool.length)], nextSeed: rolled };
}

/**
 * 结算一次选项，产出回报。
 *
 * 保证非空：选项没写（或写了非正数）修为时兜底 `DEFAULT_EVENT_GAIN`，
 * 所以返回的 `cultivationGain` 恒 > 0；`plotFlags` 收集剧情标记。
 * 入参 `state` 只需要修为与种子，`MvpCharacter` 可直接传入。
 */
export function applyOption(
  state: { cultivation: number; rngSeed: number },
  event: GameEvent,
  optionIndex: number,
): OptionOutcome {
  const option = event.options[optionIndex];
  if (option === undefined) {
    throw new RangeError(
      `事件 ${event.id} 没有第 ${optionIndex} 个选项（共 ${event.options.length} 个）`,
    );
  }

  const base = Number.isFinite(state.cultivation)
    ? Math.max(0, state.cultivation)
    : 0;
  const declared =
    typeof option.cultivationGain === 'number' && Number.isFinite(option.cultivationGain)
      ? option.cultivationGain
      : 0;
  const gain = declared > 0 ? declared : DEFAULT_EVENT_GAIN;
  const plotFlags = option.plotFlag === undefined ? [] : [option.plotFlag];

  return {
    cultivation: base + gain,
    cultivationGain: gain,
    plotFlags,
    nextSeed: nextSeed(state.rngSeed),
  };
}
