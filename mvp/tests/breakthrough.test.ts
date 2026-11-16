import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CULTIVATION_MAX_FACTOR,
  FAIL_LOSS_RATE,
  REALM_THRESHOLDS,
  cultivationMaxOf,
  nextRealm,
  nextThresholdOf,
} from '../src/data/balance.ts';
import { breakthroughLoss, tryBreakthrough } from '../src/systems/breakthrough.ts';
import { nextSeed, seedToUnit } from '../src/systems/rng.ts';

/** 已验算的种子：seed=1 → 下一枚 1015568748（roll ≈ 0.2365，成功）。 */
const WIN_SEED = 1;
const WIN_NEXT_SEED = 1015568748;
/** seed=3027450565 → 下一枚 217083232（roll ≈ 0.0505，失败）。 */
const LOSE_SEED = 3027450565;
const LOSE_NEXT_SEED = 217083232;

test('种子确实落在预期区间（防止常量漂移）', () => {
  assert.equal(nextSeed(WIN_SEED), WIN_NEXT_SEED);
  assert.equal(nextSeed(LOSE_SEED), LOSE_NEXT_SEED);
  assert.ok(seedToUnit(WIN_NEXT_SEED) >= FAIL_LOSS_RATE);
  assert.ok(seedToUnit(LOSE_NEXT_SEED) < FAIL_LOSS_RATE);
});

test('突破成功：炼气 → 筑基，修为扣阈值、阈值与上限重算', () => {
  const result = tryBreakthrough(
    { cultivation: 150, nextThreshold: REALM_THRESHOLDS['筑基'], realm: '炼气' },
    WIN_SEED,
  );

  assert.equal(result.success, true);
  assert.equal(result.realm, '筑基');
  assert.equal(result.cultivation, 50); // 150 - 100
  assert.equal(result.nextThreshold, REALM_THRESHOLDS['金丹']);
  assert.equal(result.cultivationMax, REALM_THRESHOLDS['金丹'] * CULTIVATION_MAX_FACTOR);
  assert.equal(result.lost, 0);
  assert.equal(result.nextSeed, WIN_NEXT_SEED);
});

test('突破成功：修为刚好等于阈值时清零', () => {
  const result = tryBreakthrough(
    { cultivation: 100, nextThreshold: 100, realm: '炼气' },
    WIN_SEED,
  );
  assert.equal(result.success, true);
  assert.equal(result.realm, '筑基');
  assert.equal(result.cultivation, 0);
});

test('突破成功：筑基 → 金丹，阈值递推一次到位', () => {
  const result = tryBreakthrough(
    { cultivation: 620, nextThreshold: 500, realm: '筑基' },
    WIN_SEED,
  );
  assert.equal(result.success, true);
  assert.equal(result.realm, '金丹');
  assert.equal(result.cultivation, 120);
  assert.equal(result.nextThreshold, nextThresholdOf('金丹'));
  assert.equal(result.cultivationMax, cultivationMaxOf('金丹'));
  assert.equal(result.nextThreshold, REALM_THRESHOLDS['金丹']);
});

test('突破失败：扣 20%，境界不变、阈值不变、种子推进', () => {
  const result = tryBreakthrough(
    { cultivation: 100, nextThreshold: 100, realm: '炼气' },
    LOSE_SEED,
  );

  assert.equal(result.success, false);
  assert.equal(result.realm, '炼气');
  assert.equal(result.lost, 20); // floor(100 × 0.2)
  assert.equal(result.cultivation, 80);
  assert.equal(result.nextThreshold, REALM_THRESHOLDS['筑基']);
  assert.equal(result.cultivationMax, REALM_THRESHOLDS['筑基'] * CULTIVATION_MAX_FACTOR);
  assert.equal(result.nextSeed, LOSE_NEXT_SEED);

  // 失败后可立即重试：修为仍高于阈值时还能再点
  assert.ok(result.cultivation >= result.nextThreshold - 20);
});

test('突破失败：修为不足 1 时不扣、不为负', () => {
  const result = tryBreakthrough(
    { cultivation: 3, nextThreshold: 100, realm: '炼气' },
    LOSE_SEED,
  );
  assert.equal(result.success, false);
  assert.equal(result.lost, 0); // floor(3 × 0.2) = 0
  assert.equal(result.cultivation, 3);
  assert.ok(result.cultivation >= 0);
});

test('突破失败：扣减下限为 0，任何输入都不会得到负修为', () => {
  assert.equal(breakthroughLoss(0), 0);
  assert.equal(breakthroughLoss(1), 0);
  assert.equal(breakthroughLoss(4), 0);
  assert.equal(breakthroughLoss(5), 1);
  assert.equal(breakthroughLoss(-100), 0);
  assert.equal(breakthroughLoss(Number.NaN), 0);
  assert.equal(breakthroughLoss(100), 20);
});

test('金丹是顶阶：再点突破一律失败且保持原状', () => {
  const result = tryBreakthrough(
    { cultivation: 900, nextThreshold: REALM_THRESHOLDS['金丹'], realm: '金丹' },
    WIN_SEED,
  );
  assert.equal(result.success, false);
  assert.equal(result.realm, '金丹');
  assert.equal(result.cultivation, 900);
  assert.equal(result.lost, 0);
  assert.equal(result.nextThreshold, REALM_THRESHOLDS['金丹']);
  assert.equal(result.cultivationMax, cultivationMaxOf('金丹'));
  assert.equal(result.nextSeed, WIN_NEXT_SEED);
  assert.equal(nextRealm('金丹'), null);
});

test('修为不足阈值时：失败但不扣修为（防御分支）', () => {
  const result = tryBreakthrough(
    { cultivation: 30, nextThreshold: 100, realm: '炼气' },
    WIN_SEED,
  );
  assert.equal(result.success, false);
  assert.equal(result.lost, 0);
  assert.equal(result.cultivation, 30);
  assert.equal(result.realm, '炼气');
});

test('同输入 + 同种子 = 同结果（可复现）', () => {
  const input = { cultivation: 150, nextThreshold: 100, realm: '炼气' as const };
  assert.deepEqual(tryBreakthrough(input, WIN_SEED), tryBreakthrough(input, WIN_SEED));
  assert.deepEqual(tryBreakthrough(input, LOSE_SEED), tryBreakthrough(input, LOSE_SEED));
});

test('阈值 / 上限公式：每阶上限 = 下一阈值 × 4', () => {
  assert.equal(cultivationMaxOf('炼气'), 400);
  assert.equal(cultivationMaxOf('筑基'), 2000);
  assert.equal(cultivationMaxOf('金丹'), 2000);
  assert.equal(nextThresholdOf('炼气'), 100);
  assert.equal(nextThresholdOf('筑基'), 500);
});
