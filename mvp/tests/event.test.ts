import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_EVENT_GAIN, REALMS } from '../src/data/balance.ts';
import { EVENTS } from '../src/data/events.ts';
import { applyOption, eligibleEvents, pickEvent } from '../src/systems/event.ts';
import { nextSeed } from '../src/systems/rng.ts';
import type { GameEvent, Realm } from '../src/types.ts';

const SEED = 1;
/** seed=1 推进后的种子，已验算。 */
const SEED_AFTER_1 = 1015568748;

function idsOf(realm: Realm): string[] {
  return EVENTS.filter((event) => event.realm === realm).map((event) => event.id);
}

test('事件池结构：24 条，每境界 8 条，id 唯一，2–3 个选项', () => {
  assert.equal(EVENTS.length, 24);
  for (const realm of REALMS) {
    assert.equal(idsOf(realm).length, 8, `${realm} 应有 8 条事件`);
  }
  const ids = EVENTS.map((event) => event.id);
  assert.equal(new Set(ids).size, 24);

  for (const event of EVENTS) {
    assert.ok(event.title.length > 0, `${event.id} 缺标题`);
    assert.ok(event.text.length > 0, `${event.id} 缺正文`);
    assert.ok(
      event.options.length >= 2 && event.options.length <= 3,
      `${event.id} 选项数应为 2–3，实际 ${event.options.length}`,
    );
    for (const option of event.options) {
      assert.ok(option.text.length > 0, `${event.id} 有选项缺文案`);
      assert.ok(
        option.cultivationGain !== undefined || option.plotFlag !== undefined,
        `${event.id} 有选项既无修为也无剧情标记（空结算）`,
      );
    }
  }
});

test('pickEvent：只抽当前境界的事件', () => {
  for (const realm of REALMS) {
    for (const seed of [1, 7, 42, 12345, 999999]) {
      const { event } = pickEvent({ realm, doneIds: [], seed });
      assert.notEqual(event, null);
      assert.equal(event?.realm, realm);
      assert.ok(idsOf(realm).includes(event!.id));
    }
  }
});

test('pickEvent：抽不到 doneIds 里已有的事件', () => {
  const lianqiIds = idsOf('炼气');
  const done = lianqiIds.slice(0, 7);
  const last = lianqiIds[7];

  for (const seed of [1, 2, 3, 4, 5]) {
    const { event } = pickEvent({ realm: '炼气', doneIds: done, seed });
    assert.equal(event?.id, last);
  }

  // 已完成全部 → null
  const empty = pickEvent({ realm: '炼气', doneIds: lianqiIds, seed: 3 });
  assert.equal(empty.event, null);
  assert.equal(empty.nextSeed, nextSeed(3));
});

test('pickEvent：本境界抽完返回 null，其它境界不受影响', () => {
  const { event } = pickEvent({ realm: '炼气', doneIds: idsOf('炼气'), seed: SEED });
  assert.equal(event, null);
  const still = pickEvent({ realm: '筑基', doneIds: idsOf('炼气'), seed: SEED });
  assert.equal(still.event?.realm, '筑基');
});

test('pickEvent：同种子可复现，不同种子会换一条', () => {
  const input = { realm: '炼气' as const, doneIds: [] as string[], seed: SEED };
  assert.deepEqual(pickEvent(input), pickEvent(input));

  const a = pickEvent({ realm: '炼气', doneIds: [], seed: 1 });
  const b = pickEvent({ realm: '炼气', doneIds: [], seed: 7 });
  assert.notEqual(a.event?.id, b.event?.id);
  assert.equal(a.nextSeed, SEED_AFTER_1);
  assert.equal(b.nextSeed, nextSeed(7));
});

test('eligibleEvents：过滤境界 + 已完成，保持池内顺序', () => {
  const pool = eligibleEvents('筑基', ['zhuji-02', 'zhuji-05']);
  assert.deepEqual(
    pool.map((event) => event.id),
    ['zhuji-01', 'zhuji-03', 'zhuji-04', 'zhuji-06', 'zhuji-07', 'zhuji-08'],
  );
  assert.deepEqual(eligibleEvents('炼气', idsOf('炼气')), []);
});

test('applyOption：每个选项都有非空回报（修为 > 0 或剧情标记）', () => {
  for (const event of EVENTS) {
    event.options.forEach((option, index) => {
      const outcome = applyOption({ cultivation: 20, rngSeed: SEED }, event, index);
      assert.ok(
        outcome.cultivationGain > 0 || outcome.plotFlags.length > 0,
        `${event.id} 第 ${index} 个选项回报为空`,
      );
      assert.equal(outcome.cultivation, 20 + outcome.cultivationGain);
      assert.equal(outcome.nextSeed, SEED_AFTER_1);
      assert.deepEqual(
        outcome.plotFlags,
        option.plotFlag === undefined ? [] : [option.plotFlag],
      );
      if (option.cultivationGain !== undefined) {
        assert.equal(outcome.cultivationGain, option.cultivationGain);
      }
    });
  }
});

test('applyOption：没写修为的选项给兜底增量（不空结算）', () => {
  const synthetic: GameEvent = {
    id: 'test-empty',
    realm: '炼气',
    title: '空选项',
    text: '只给剧情标记，不给修为。',
    options: [{ text: '记下这件事', plotFlag: '只留名' }],
  };
  const outcome = applyOption({ cultivation: 0, rngSeed: 7 }, synthetic, 0);
  assert.equal(outcome.cultivationGain, DEFAULT_EVENT_GAIN);
  assert.deepEqual(outcome.plotFlags, ['只留名']);
  assert.equal(outcome.nextSeed, nextSeed(7));
});

test('applyOption：修为累加、种子推进，越界选项抛错', () => {
  const event = EVENTS[0];
  const outcome = applyOption({ cultivation: 12.5, rngSeed: SEED }, event, 0);
  assert.equal(outcome.cultivation, 12.5 + outcome.cultivationGain);
  assert.equal(outcome.nextSeed, SEED_AFTER_1);

  assert.throws(
    () => applyOption({ cultivation: 0, rngSeed: SEED }, event, event.options.length),
    RangeError,
  );
  assert.throws(() => applyOption({ cultivation: 0, rngSeed: SEED }, event, -1), RangeError);
});

test('事件循环可跑：抽 8 次把炼气池清空', () => {
  let seed = 1;
  const doneIds: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const picked = pickEvent({ realm: '炼气', doneIds, seed });
    assert.notEqual(picked.event, null);
    const outcome = applyOption({ cultivation: 0, rngSeed: picked.nextSeed }, picked.event!, 0);
    assert.ok(outcome.cultivationGain > 0);
    doneIds.push(picked.event!.id);
    seed = outcome.nextSeed;
  }
  assert.equal(new Set(doneIds).size, 8);
  assert.equal(pickEvent({ realm: '炼气', doneIds, seed }).event, null);
});
