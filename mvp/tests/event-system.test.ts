import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMemoryApp } from '../src/app.ts';
import {
  BOOTSTRAP_TECHNIQUE_ID,
  REALMS,
  findTechnique,
} from '../src/data/balance.ts';
import { EVENTS } from '../src/data/events.ts';
import {
  createEventPool,
  createEventSystem,
  pickEvent,
} from '../src/event/index.ts';
import { nextSeed } from '../src/systems/rng.ts';

function lianqiIds(): string[] {
  return EVENTS.filter((event) => event.realm === '炼气').map((event) => event.id);
}

test('事件池索引：24 条 / 每境界 8 条 / id 唯一 / 顺序保持', () => {
  const system = createEventSystem();
  const all = system.list();

  assert.equal(all.length, 24);
  assert.equal(system.pool.size, 24);
  assert.deepEqual(
    all.map((event) => event.id),
    EVENTS.map((event) => event.id),
  );
  assert.equal(new Set(all.map((event) => event.id)).size, 24);

  for (const realm of REALMS) {
    const bucket = system.pool.byRealm(realm);
    assert.equal(bucket.length, 8, `${realm} 应有 8 条`);
    assert.ok(bucket.every((event) => event.realm === realm));
  }

  assert.equal(system.byId('lianqi-01')?.title, '山道拾遗');
  assert.equal(system.byId('no-such-event'), null);
});

test('池按境界 + doneIds 过滤，保持数据顺序', () => {
  const pool = createEventPool(EVENTS);

  assert.deepEqual(
    pool
      .eligible({ realm: '筑基', doneIds: ['zhuji-02', 'zhuji-05'] })
      .map((event) => event.id),
    ['zhuji-01', 'zhuji-03', 'zhuji-04', 'zhuji-06', 'zhuji-07', 'zhuji-08'],
  );

  const done = lianqiIds();
  assert.deepEqual(pool.eligible({ realm: '炼气', doneIds: done }), []);
  assert.equal(pool.eligible({ realm: '金丹' }).length, 8);
  assert.equal(pool.eligible({ realm: '金丹', doneIds: ['jindan-01'] }).length, 7);
});

test('pickEvent：同种子可复现，返回推进后的 nextSeed', () => {
  const input = { realm: '炼气' as const, doneIds: [] as string[], seed: 1 };
  const a = pickEvent(input);
  const b = pickEvent({ ...input });

  assert.deepEqual(a, b);
  assert.equal(a.nextSeed, nextSeed(1));
  assert.equal(a.event?.realm, '炼气');
  assert.ok(lianqiIds().includes(a.event!.id));
});

test('pickEvent：doneIds 排除，抽空返回 null 且种子仍推进', () => {
  const ids = lianqiIds();
  const done = ids.slice(0, 7);

  for (const seed of [1, 2, 3, 4, 5]) {
    const picked = pickEvent({ realm: '炼气', doneIds: done, seed });
    assert.equal(picked.event?.id, ids[7]);
  }

  const empty = pickEvent({ realm: '炼气', doneIds: ids, seed: 3 });
  assert.equal(empty.event, null);
  assert.equal(empty.nextSeed, nextSeed(3));
});

test('createEventSystem.next：接受角色切片，本境界抽完返回 null', () => {
  const system = createEventSystem();

  const picked = system.next({
    realm: '炼气',
    rngSeed: 1,
    eventState: { doneIds: [] },
  });
  assert.equal(picked.event?.realm, '炼气');
  assert.equal(picked.seed, nextSeed(1));

  const exhausted = system.next({
    realm: '炼气',
    rngSeed: 1,
    eventState: { doneIds: lianqiIds() },
  });
  assert.equal(exhausted.event, null);
  assert.equal(exhausted.seed, nextSeed(1));

  // 没有 eventState 也能抽（默认候选全池）
  const bare = system.next({ realm: '筑基', rngSeed: 7 });
  assert.equal(bare.event?.realm, '筑基');
});

test('掉落表：青木诀由 lianqi-01 三个选项保底，其余 4 本各 1 条', () => {
  const drops = EVENTS.flatMap((event) =>
    event.options.flatMap((option, optionIndex) =>
      (option.grants ?? []).map((techniqueId) => ({
        eventId: event.id,
        optionIndex,
        techniqueId,
      })),
    ),
  );

  assert.equal(drops.length, 7); // lianqi-01 的 3 个选项都给青木诀 + 其余 4 本各 1
  assert.deepEqual(
    [...new Set(drops.map((drop) => drop.techniqueId))].sort(),
    ['gengjin', 'houtu', 'liehuo', 'qingmu', 'xuanshui'],
  );
  assert.equal(new Set(drops.map((drop) => drop.techniqueId)).size, 5);

  for (const drop of drops) {
    assert.notEqual(findTechnique(drop.techniqueId), null, `${drop.techniqueId} 不在功法库`);
  }

  const bootstrap = drops.find(
    (drop) => drop.techniqueId === BOOTSTRAP_TECHNIQUE_ID,
  );
  assert.equal(bootstrap?.eventId, 'lianqi-01');
  assert.equal(bootstrap?.optionIndex, 0);
});

test('resolve：选项级 grants 产出，其它选项不带掉落', () => {
  const system = createEventSystem();

  const outcome = system.resolve({ cultivation: 20, rngSeed: 1 }, 'lianqi-01', 0);
  assert.deepEqual(outcome.grants, ['qingmu']);
  assert.equal(outcome.cultivation, 28);
  assert.equal(outcome.cultivationGain, 8);
  assert.deepEqual(outcome.plotFlags, []);
  assert.equal(outcome.nextSeed, nextSeed(1));

  // 保底：换一个选项也必须给青木诀，避免新手拿不到第一本功法
  const other = system.resolve({ cultivation: 20, rngSeed: 1 }, 'lianqi-01', 1);
  assert.deepEqual(other.grants, ['qingmu']);
  assert.deepEqual(other.plotFlags, ['藏玉简']);
});

test('resolve：未知事件 / 越界选项抛错', () => {
  const system = createEventSystem();

  assert.throws(
    () => system.resolve({ cultivation: 0, rngSeed: 1 }, 'no-such-event', 0),
    /未知事件/,
  );
  assert.throws(
    () => system.resolve({ cultivation: 0, rngSeed: 1 }, 'lianqi-01', 99),
    RangeError,
  );
});

test('app：resolve 后功法进背包、不进槽位；重复获得被忽略', async () => {
  const app = createMemoryApp();
  await app.create('沈青');

  const event = EVENTS.find((entry) => entry.id === 'lianqi-01');
  assert.ok(event);
  assert.deepEqual(app.inventory(), []);
  assert.deepEqual(app.ownedTechniques(), []);

  const first = await app.resolveEvent(event, 0);
  assert.equal(first.granted.length, 1);
  assert.equal(first.granted[0].techniqueId, 'qingmu');
  assert.equal(first.granted[0].fromEventId, 'lianqi-01');
  assert.equal(first.granted[0].kind, 'technique');
  assert.deepEqual(first.duplicates, []);
  assert.equal(app.inventory().length, 1);
  assert.equal(app.current()?.techniques[0], null, '掉落只进背包，不自动装备');
  assert.deepEqual(
    app.ownedTechniques().map((def) => def.id),
    ['qingmu'],
  );

  const again = await app.resolveEvent(event, 0);
  assert.equal(again.granted.length, 0);
  assert.deepEqual(again.duplicates, ['qingmu']);
  assert.equal(app.inventory().length, 1);
});

test('createEventPool：重复事件 id 直接抛错', () => {
  assert.throws(
    () => createEventPool([EVENTS[0], EVENTS[0]]),
    /事件 id 重复/,
  );
});

test('createEventSystem：可注入自定义池', () => {
  const pool = createEventPool([EVENTS[0]]);
  const system = createEventSystem({ pool });

  assert.equal(system.list().length, 1);
  assert.equal(system.pool, pool);
  assert.equal(
    system.next({
      realm: '炼气',
      rngSeed: 1,
      eventState: { doneIds: ['lianqi-01'] },
    }).event,
    null,
  );
});

test('按境界分组：EVENTS 共 24 条，炼气/筑基/金丹各 8 条', () => {
  assert.equal(EVENTS.length, 24);

  const grouped = {
    炼气: EVENTS.filter((event) => event.realm === '炼气'),
    筑基: EVENTS.filter((event) => event.realm === '筑基'),
    金丹: EVENTS.filter((event) => event.realm === '金丹'),
  };

  for (const realm of REALMS) {
    const bucket = grouped[realm];
    assert.equal(bucket.length, 8, `${realm} 应有 8 条`);
    assert.ok(bucket.every((event) => event.realm === realm));
  }
});

test('pickEvent：连续抽取不重复，结果 id 不在 doneIds 中', () => {
  for (let i = 0; i < 100; i += 1) {
    const realm = REALMS[i % REALMS.length];
    const ids = EVENTS.filter((event) => event.realm === realm).map((event) => event.id);
    const doneIds = ids.slice(0, i % (ids.length + 1));
    const picked = pickEvent({ realm, doneIds, seed: i + 1 });
    if (picked.event === null) continue;
    assert.equal(doneIds.includes(picked.event.id), false);
  }
});
