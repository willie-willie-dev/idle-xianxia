/**
 * 突破：纯函数，输入修为 / 阈值 / 境界 / 阶位 / 成功率 / 种子，输出结果与下一个种子。
 *
 * 规则（DESIGN.md §5 + R4）：
 * - 金丹·后期已是顶阶，再点突破一律失败且保持原状；
 * - 修为不足阈值时失败且不扣修为（UI 会禁用按钮，这里是防御）；
 * - 掷骰 roll = seedToUnit(推进后的种子)；successRate 夹到 (0, 1]，roll >= successRate 即失败；
 * - 失败：cultivation - floor(cultivation × FAIL_LOSS_RATE)，不得为负；
 * - 成功：阶位 +1（前期 → 中期 → 后期 → 下一境界·前期），
 *   cultivation - nextThreshold（不为负），阈值与上限按新阶位重算；
 * - 无论成功还是失败，种子都照常推进。
 */

import {
  FAIL_LOSS_RATE,
  cultivationMaxOf,
  nextStageOf,
  nextThresholdOf,
} from '../data/balance.ts';
import type {
  BreakthroughInput,
  BreakthroughResult,
  Realm,
  RealmStage,
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
  const stage: RealmStage = input.stage;

  /** 保持原状（只推进种子）的失败结果。lost > 0 时扣修为。 */
  const stay = (lost: number): BreakthroughResult => ({
    success: false,
    realm,
    stage,
    cultivation: Math.max(0, cultivation - lost),
    cultivationMax: cultivationMaxOf(realm, stage),
    nextThreshold: nextThresholdOf(realm, stage),
    lost,
    nextSeed: rolled,
  });

  const target = nextStageOf(realm, stage);
  if (target === null) return stay(0);
  if (cultivation < input.nextThreshold) return stay(0);

  const rawRate = Number.isFinite(input.successRate) ? input.successRate : 0;
  const successRate = Math.min(1, Math.max(Number.MIN_VALUE, rawRate));
  if (seedToUnit(rolled) >= successRate) {
    return stay(breakthroughLoss(cultivation));
  }

  const remaining = Math.max(0, cultivation - input.nextThreshold);
  return {
    success: true,
    realm: target.realm,
    stage: target.stage,
    cultivation: remaining,
    cultivationMax: cultivationMaxOf(target.realm, target.stage),
    nextThreshold: nextThresholdOf(target.realm, target.stage),
    lost: 0,
    nextSeed: rolled,
  };
}
