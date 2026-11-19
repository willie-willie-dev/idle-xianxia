import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canBreakthrough, createMemoryApp } from '../src/app.ts';
import { BREAKTHROUGH_SUCCESS_RATE, POJING_ITEM_ID } from '../src/data/balance.ts';
import { nextSeed, seedToUnit } from '../src/systems/rng.ts';
import type { MvpCharacter } from '../src/types.ts';

/** seed=1 → 下一枚 roll ≈ 0.2365 < 0.8，无丹也会成功。 */
const WIN_SEED = 1;
/** seed=1456 → 下一枚 roll ≈ 0.8003 >= 0.8，无丹失败。 */
const LOSE_SEED = 1456;

function poJingCount(character: MvpCharacter): number {
  let total = 0;
  for (const item of character.inventory) {
    if (item.kind !== 'consumable' || item.itemId !== POJING_ITEM_ID) continue;
    if (item.count > 0) total += item.count;
  }
  return total;
}

/** 测试直接改当前角色的背包。突破读的就是这份内存角色。 */
function grantPoJing(character: MvpCharacter, count: number): void {
  character.inventory.push({
    uid: 'test-pojing-dan',
    kind: 'consumable',
    itemId: POJING_ITEM_ID,
    count,
    fromEventId: 'test',
    obtainedAt: 1,
  });
}

test('没有破境丹：修为足够就可以突破', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');

  assert.equal(poJingCount(created), 0);
  assert.equal(canBreakthrough(created), false);

  created.cultivation = created.nextThreshold;
  created.rngSeed = WIN_SEED;
  assert.equal(canBreakthrough(created), true);

  const turn = await app.breakthrough();
  assert.equal(turn.result.success, true);
  assert.equal(turn.character.realm, '炼气');
  assert.equal(turn.character.stage, '中期');
  assert.equal(turn.character.cultivation, 0);
  assert.equal(poJingCount(turn.character), 0);
});

test('持有破境丹：突破必定成功，并消耗 1 枚', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  grantPoJing(created, 1);
  created.cultivation = created.nextThreshold;
  created.rngSeed = LOSE_SEED;

  assert.ok(seedToUnit(nextSeed(LOSE_SEED)) >= BREAKTHROUGH_SUCCESS_RATE);
  assert.equal(canBreakthrough(created), true);
  assert.equal(poJingCount(created), 1);

  const turn = await app.breakthrough();
  assert.equal(turn.result.success, true);
  assert.equal(turn.character.realm, '炼气');
  assert.equal(turn.character.stage, '中期');
  assert.equal(poJingCount(turn.character), 0);
});

test('没有破境丹且掷骰失败：突破失败，不扣破境丹', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  created.cultivation = created.nextThreshold;
  created.rngSeed = LOSE_SEED;

  assert.equal(poJingCount(created), 0);
  assert.ok(seedToUnit(nextSeed(LOSE_SEED)) >= BREAKTHROUGH_SUCCESS_RATE);

  const turn = await app.breakthrough();
  assert.equal(turn.result.success, false);
  assert.equal(turn.character.realm, '炼气');
  assert.equal(turn.character.stage, '前期');
  assert.equal(turn.result.lost, 20);
  assert.equal(turn.character.cultivation, created.nextThreshold - 20);
  assert.equal(poJingCount(turn.character), 0);
});

test('破境丹 count=2：连续两次突破各消耗 1 枚', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  grantPoJing(created, 2);
  created.cultivation = created.nextThreshold;
  created.rngSeed = LOSE_SEED;
  assert.equal(poJingCount(created), 2);

  const first = await app.breakthrough();
  assert.equal(first.result.success, true);
  assert.equal(poJingCount(first.character), 1);

  if (first.character.cultivation < first.character.nextThreshold) {
    first.character.cultivation = first.character.nextThreshold;
  }

  const second = await app.breakthrough();
  assert.equal(second.result.success, true);
  assert.equal(poJingCount(second.character), 0);
});
