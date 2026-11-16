/**
 * 修炼：把一次吸收结果折算成修为增量（R1=A：吸收即转修为，灵气池不入存档）。
 *
 * 纯函数，不读时间、不读存档、不随机。
 * 数值全部来自 `absorb()` 的返回值，本文件不出现任何魔数。
 */

import type { AbsorbResult } from './absorb.ts';

export interface CultivateResult {
  cultivationGain: number;
}

/**
 * 入参是 `absorb()` 的结果；产出修为增量。
 *
 * 只做两件事：取 `cultivationGain`，并对异常值兜底（负数 / NaN → 0），
 * 保证调用方永远拿不到负修为。
 */
export function cultivate(absorbResult: AbsorbResult): CultivateResult {
  const raw = absorbResult.cultivationGain;
  if (!Number.isFinite(raw) || raw <= 0) return { cultivationGain: 0 };
  return { cultivationGain: raw };
}
