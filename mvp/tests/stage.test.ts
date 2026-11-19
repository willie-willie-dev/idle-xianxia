import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CULTIVATION_MAX_FACTOR,
  FAIL_LOSS_RATE,
  STAGE_TABLE,
  cultivationMaxOf,
  nextStageOf,
  nextThresholdOf,
  stageAt,
  stageIndexOf,
  stageLabel,
} from '../src/data/balance.ts';
import { tryBreakthrough } from '../src/systems/breakthrough.ts';
import { nextSeed, seedToUnit } from '../src/systems/rng.ts';
import type { Realm, RealmStage } from '../src/types.ts';

/** seed=1 的下一枚 roll ≈ 0.2365 ≥ 0.2 → 成功。 */
const WIN_SEED = 1;
/** seed=3027450565 的下一枚 roll ≈ 0.0505 < 0.2 → 失败。 */
const LOSE_SEED = 3027450565;

/** 阶位表的期望值（阈值 / 本阶上限）。 */
const EXPECTED: readonly (readonly [string, number, number])[] = [
  ['炼气·前期', 0, 400],
  ['炼气·中期', 100, 960],
  ['炼气·后期', 240, 1720],
  ['筑基·前期', 430, 2800],
  ['筑基·中期', 700, 4320],
  ['筑基·后期', 1080, 6400],
  ['金丹·前期', 1600, 9200],
  ['金丹·中期', 2300, 12800],
  ['金丹·后期', 3200, 12800],
];

test('9 阶阈值表完整：阶位 / 阈值 / 本阶上限逐项对齐', () => {
  assert.equal(STAGE_TABLE.length, 9);
  assert.equal(EXPECTED.length, 9);

  EXPECTED.forEach(([label, threshold, max], index) => {
    const def = stageAt(index);
    assert.equal(stageLabel(def.realm, def.stage), label, `第 ${index} 阶文案`);
    assert.equal(def.threshold, threshold, `${label} 阈值`);
    assert.equal(nextThresholdOf(def.realm, def.stage), nextOf(index), `${label} 的下一阈值`);
    assert.equal(cultivationMaxOf(def.realm, def.stage), max, `${label} 上限`);
    assert.equal(stageIndexOf(def.realm, def.stage), index);
  });

  // 顶阶：nextThreshold 回落到自身阈值，上限 = 自身阈值 × 4
  const top = stageAt(8);
  assert.equal(stageLabel(top.realm, top.stage), '金丹·后期');
  assert.equal(nextThresholdOf('金丹', '后期'), 3200);
  assert.equal(nextStageOf('金丹', '后期'), null);
  assert.equal(cultivationMaxOf('金丹', '后期'), 3200 * CULTIVATION_MAX_FACTOR);

  function nextOf(index: number): number {
    return EXPECTED[index + 1]?.[1] ?? EXPECTED[index][1];
  }
});

test('突破逐阶推进：0 → 1 → 2 → 3 连续三次', () => {
  let realm: Realm = '炼气';
  let stage: RealmStage = '前期';
  let cultivation = 0;
  let nextThreshold = nextThresholdOf(realm, stage);
  const visited: string[] = [];

  for (let i = 0; i < 3; i += 1) {
    // 每次补足到阈值（真实游戏靠吸收攒，这里直接置满）
    cultivation = Math.max(cultivation, nextThreshold);
    const result = tryBreakthrough(
      { cultivation, nextThreshold, realm, stage, successRate: 1 },
      WIN_SEED,
    );
    assert.equal(result.success, true, `第 ${i + 1} 次突破应成功`);
    assert.equal(result.cultivation, cultivation - nextThreshold);
    visited.push(stageLabel(result.realm, result.stage));

    realm = result.realm;
    stage = result.stage;
    cultivation = result.cultivation;
    nextThreshold = result.nextThreshold;
  }

  assert.deepEqual(visited, ['炼气·中期', '炼气·后期', '筑基·前期']);
  // 筑基·前期：阈值 700、上限 2800
  assert.equal(nextThreshold, 700);
  assert.equal(cultivationMaxOf(realm, stage), 2800);
});

test('跨境界：炼气·后期 → 筑基·前期，扣阈值并重算上限', () => {
  const result = tryBreakthrough(
    { cultivation: 500, nextThreshold: 430, realm: '炼气', stage: '后期', successRate: 1 },
    WIN_SEED,
  );

  assert.equal(result.success, true);
  assert.equal(result.realm, '筑基');
  assert.equal(result.stage, '前期');
  assert.equal(stageLabel(result.realm, result.stage), '筑基·前期');
  assert.equal(result.cultivation, 70); // 500 - 430
  assert.equal(result.nextThreshold, 700);
  assert.equal(result.cultivationMax, 2800);
  assert.equal(result.lost, 0);
});

test('顶阶（金丹·后期）不回退：失败、不扣、保持原状', () => {
  for (const seed of [WIN_SEED, LOSE_SEED]) {
    const result = tryBreakthrough(
      { cultivation: 9000, nextThreshold: 3200, realm: '金丹', stage: '后期' },
      seed,
    );
    assert.equal(result.success, false);
    assert.equal(result.realm, '金丹');
    assert.equal(result.stage, '后期');
    assert.equal(result.cultivation, 9000);
    assert.equal(result.lost, 0);
    assert.equal(result.nextThreshold, 3200);
    assert.equal(result.cultivationMax, 12800);
    assert.equal(result.nextSeed, nextSeed(seed));
  }
});

test('突破失败：扣当前修为 20%，阶位与阈值不变', () => {
  const result = tryBreakthrough(
    { cultivation: 1100, nextThreshold: 1080, realm: '筑基', stage: '中期' },
    LOSE_SEED,
  );

  assert.ok(seedToUnit(nextSeed(LOSE_SEED)) < FAIL_LOSS_RATE);
  assert.equal(result.success, false);
  assert.equal(result.realm, '筑基');
  assert.equal(result.stage, '中期');
  assert.equal(result.lost, 220); // floor(1100 × 0.2)
  assert.equal(result.cultivation, 880);
  assert.equal(result.nextThreshold, 1080); // 失败不换阶
  assert.equal(result.cultivationMax, 4320); // 下一阈值 1080 × 4
});

test('阶位文案与边界：每境界三阶、合法组合都能定位', () => {
  const labels = STAGE_TABLE.map((entry) => stageLabel(entry.realm, entry.stage));
  assert.deepEqual(labels, [
    '炼气·前期',
    '炼气·中期',
    '炼气·后期',
    '筑基·前期',
    '筑基·中期',
    '筑基·后期',
    '金丹·前期',
    '金丹·中期',
    '金丹·后期',
  ]);
  assert.throws(() => stageIndexOf('炼气', '大圆满' as RealmStage), /未知阶位/);
  assert.throws(() => stageAt(9), /越界/);
});
