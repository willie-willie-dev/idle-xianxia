/**
 * 突破：纯函数，输入修为 / 阈值 / 境界 / 种子，输出结果与下一个种子。
 *
 * 规则（DESIGN.md §5 + R4）：
 * - 金丹已是顶阶，再点突破一律失败且保持原状；
 * - 修为不足阈值时失败且不扣修为（UI 会禁用按钮，这里是防御）；
 * - 掷骰 roll = seedToUnit(推进后的种子)，roll < FAIL_LOSS_RATE 即失败；
 * - 失败：cultivation - floor(cultivation × FAIL_LOSS_RATE)，不得为负；
 * - 成功：境界前进一阶，cultivation - nextThreshold（不为负），
 *   nextThreshold / cultivationMax 按 balance.ts 重算。
 */

import {
  FAIL_LOSS_RATE,
  cultivationMaxOf,
  nextRealm,
  nextThresholdOf,
} from '../data/balance.ts';
import type {
  BreakthroughInput,
  BreakthroughResult,
  Realm,
} from '../types.ts';
import { nextSeed, seedToUnit } from './rng.ts';

/** 失败时扣掉的修为量：向下取整，且不超过当前修为。 */
export function breakthroughLoss(cultivation: number): number {
  const safe = Number.isFinite(cultivation) ? Math.max(0, cultivation) : 0;
  return Math.min(Math.floor(safe * FAIL_LOSS_RATE), safe);
}

/**
 * 尝试突破。
 *
 * 无论成功失败都会推进种子：`nextSeed` 必须写回角色，否则随机不可复现。
 */
export function tryBreakthrough(
  input: BreakthroughInput,
  seed: number,
): BreakthroughResult {
  const rolled = nextSeed(seed);
  const cultivation = Number.isFinite(input.cultivation)
    ? Math.max(0, input.cultivation)
    : 0;
  const realm: Realm = input.realm;

  /** 保持原状（只推进种子）的失败结果。 */
  const stay = (lost: number): BreakthroughResult => ({
    success: false,
    realm,
    cultivation: Math.max(0, cultivation - lost),
    cultivationMax: cultivationMaxOf(realm),
    nextThreshold: nextThresholdOf(realm),
    lost,
    nextSeed: rolled,
  });

  const target = nextRealm(realm);
  if (target === null) return stay(0);
  if (cultivation < input.nextThreshold) return stay(0);

  // 掷骰：低于失败率即失败。种子 → [0,1) 的映射是均匀的。
  if (seedToUnit(rolled) < FAIL_LOSS_RATE) {
    return stay(breakthroughLoss(cultivation));
  }

  const remaining = Math.max(0, cultivation - input.nextThreshold);
  return {
    success: true,
    realm: target,
    cultivation: remaining,
    cultivationMax: cultivationMaxOf(target),
    nextThreshold: nextThresholdOf(target),
    lost: 0,
    nextSeed: rolled,
  };
}
