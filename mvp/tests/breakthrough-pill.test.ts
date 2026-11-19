import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canBreakthrough, createMemoryApp } from '../src/app.ts';
import { FAIL_LOSS_RATE, POJING_ITEM_ID } from '../src/data/balance.ts';
import { nextSeed, seedToUnit } from '../src/systems/rng.ts';
import type { MvpCharacter } from '../src/types.ts';

/** seed=3027450565 → 下一枚 roll ≈ 0.0505，低于失败线。 */
const LOSE_SEED = 3027450565;

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

test('没有破境丹：不能突破，修为与阶位不变', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');

  assert.equal(canBreakthrough(created), false);

  const turn = await app.breakthrough();
  assert.equal(turn.blocked, true);
  assert.equal(turn.character.cultivation, created.cultivation);
  assert.equal(turn.character.realm, created.realm);
  assert.equal(turn.character.stage, created.stage);
});

test('持有 1 枚破境丹且修为足够：可以突破，并消耗 1 枚', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  grantPoJing(created, 1);
  created.cultivation = created.nextThreshold;

  assert.equal(canBreakthrough(created), true);
  assert.equal(poJingCount(created), 1);

  const turn = await app.breakthrough();
  assert.equal(poJingCount(turn.character), 0);
});

test('突破失败也消耗 1 枚破境丹', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  grantPoJing(created, 1);
  created.cultivation = created.nextThreshold;
  created.rngSeed = LOSE_SEED;

  assert.ok(seedToUnit(nextSeed(LOSE_SEED)) < FAIL_LOSS_RATE);
  assert.equal(poJingCount(created), 1);

  const turn = await app.breakthrough();
  assert.equal(turn.result.success, false);
  assert.equal(turn.character.realm, created.realm);
  assert.equal(turn.character.stage, '前期');
  assert.equal(poJingCount(turn.character), 0);
});

test('破境丹 count=2：连续突破两次后耗尽', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  grantPoJing(created, 2);
  created.cultivation = created.nextThreshold;
  assert.equal(poJingCount(created), 2);

  const first = await app.breakthrough();
  assert.equal(first.blocked, false);
  assert.equal(poJingCount(first.character), 1);

  if (first.character.cultivation < first.character.nextThreshold) {
    first.character.cultivation = first.character.nextThreshold;
  }

  const second = await app.breakthrough();
  assert.equal(second.blocked, false);
  assert.equal(poJingCount(second.character), 0);
});
