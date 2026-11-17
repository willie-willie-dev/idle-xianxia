/**
 * 事件结算：把一个选项翻译成修为 / 剧情标记 / 功法掉落 / 新种子。
 *
 * 纯函数，不碰 DOM、存储、时间。
 */

import { DEFAULT_EVENT_GAIN } from '../data/balance.ts';
import { nextSeed } from '../systems/rng.ts';
import type { GameEvent, ResolveResult } from './types.ts';

/** 结算所需的角色切片；`MvpCharacter` 可直接传入。 */
export interface ResolveState {
  cultivation: number;
  rngSeed: number;
}

/** 选项里的功法 id 去重整理（忽略非字符串与空串）。 */
function normalizeGrants(grants: readonly string[] | undefined): string[] {
  if (!Array.isArray(grants)) return [];
  return Array.from(
    new Set(
      grants.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      ),
    ),
  );
}

/**
 * 结算一次选项，产出回报。
 *
 * 保证非空：选项没写（或写了非正数）修为时兜底 `DEFAULT_EVENT_GAIN`，
 * 所以返回的 `cultivationGain` 恒 > 0；`plotFlags` 收集剧情标记，
 * `grants` 收集选项掉落的功法 id。
 *
 * 越界选项抛 `RangeError`。
 */
export function applyOption(
  state: ResolveState,
  event: GameEvent,
  optionIndex: number,
): ResolveResult {
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
    grants: normalizeGrants(option.grants),
    nextSeed: nextSeed(state.rngSeed),
  };
}
