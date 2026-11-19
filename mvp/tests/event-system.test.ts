import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMemoryApp } from '../src/app.ts';
import {
  BOOTSTRAP_TECHNIQUE_ID,
  REALMS,
  REALM_STAGES,
  findTechnique,
} from '../src/data/balance.ts';
import { DAILY_EVENTS } from '../src/data/daily-events.ts';
import { EVENTS } from '../src/data/events.ts';
import {
  createEventPool,
  createEventSystem,
  pickEvent,
} from '../src/event/index.ts';
import { applyOption } from '../src/event/resolver.ts';
import { nextSeed } from '../src/systems/rng.ts';

function lianqiIds(): string[] {
  return EVENTS.filter((event) => event.realm === '炼气').map((event) => event.id);
}

test('事件池索引：33 条 / 每境界 11 条 / id 唯一 / 顺序保持', () => {
  const system = createEventSystem();
  const all = system.list();
  const source = [...EVENTS, ...DAILY_EVENTS];

  assert.equal(all.length, 33);
  assert.equal(system.pool.size, 33);
  assert.deepEqual(
    all.map((event) => event.id),
    source.map((event) => event.id),
  );
  assert.equal(new Set(all.map((event) => event.id)).size, 33);

  for (const realm of REALMS) {
    const bucket = system.pool.byRealm(realm);
    assert.equal(bucket.length, 11, `${realm} 应有 11 条`);
    assert.ok(bucket.every((event) => event.realm === realm));
  }

  assert.equal(system.byId('lianqi-01')?.title, '山道拾遗');
  assert.equal(system.byId('no-such-event'), null);
});

test('池按境界 + doneIds 过滤，保持数据顺序', () => {
  const pool = createEventPool(EVENTS);

  assert.deepEqual(
    pool
      .eligible({
        realm: '筑基',
        stage: '中期',
        doneIds: ['zhuji-02', 'zhuji-05'],
      })
      .map((event) => event.id),
    ['zhuji-03', 'zhuji-04', 'zhuji-06'],
  );

  const done = lianqiIds();
  assert.deepEqual(
    pool.eligible({ realm: '炼气', stage: '前期', doneIds: done }),
    [],
  );
  const jindanEarly = EVENTS.filter(
    (event) => event.realm === '金丹' && event.stage === '前期',
  );
  assert.equal(
    pool.eligible({ realm: '金丹', stage: '前期' }).length,
    jindanEarly.length,
  );
  assert.equal(
    pool.eligible({ realm: '金丹', stage: '前期', doneIds: ['jindan-01'] }).length,
    jindanEarly.length - 1,
  );
});

test('pickEvent：同种子可复现，返回推进后的 nextSeed', () => {
  const input = {
    realm: '炼气' as const,
    stage: '前期' as const,
    doneIds: [] as string[],
    dailyDone: {},
    day: 1,
    seed: 1,
  };
  const a = pickEvent(input);
  const b = pickEvent({ ...input });

  assert.deepEqual(a, b);
  assert.equal(a.nextSeed, nextSeed(1));
  assert.equal(a.event?.realm, '炼气');
  assert.equal(a.event?.stage, '前期');
  assert.ok(lianqiIds().includes(a.event!.id));
});

test('pickEvent：doneIds 排除，抽空返回 null 且种子仍推进', () => {
  const stage = '前期' as const;
  const ids = EVENTS.filter(
    (event) => event.realm === '炼气' && event.stage === stage,
  ).map((event) => event.id);
  const done = ids.slice(0, -1);

  for (const seed of [1, 2, 3, 4, 5]) {
    const picked = pickEvent({
      realm: '炼气',
      stage,
      doneIds: done,
      dailyDone: {},
      day: 1,
      seed,
    });
    assert.equal(picked.event?.id, ids[ids.length - 1]);
  }

  const empty = pickEvent({
    realm: '炼气',
    stage,
    doneIds: ids,
    dailyDone: { 'daily-lianqi-01': 1 },
    day: 1,
    seed: 3,
  });
  assert.equal(empty.event, null);
  assert.equal(empty.nextSeed, nextSeed(3));
});

test('createEventSystem.next：接受角色切片，本境界抽完返回 null', () => {
  const system = createEventSystem();

  const picked = system.next({
    realm: '炼气',
    stage: '前期',
    rngSeed: 1,
    eventState: { doneIds: [] },
    dailyDone: {},
    time: { day: 1 },
  });
  assert.equal(picked.event?.realm, '炼气');
  assert.equal(picked.event?.stage, '前期');
  assert.equal(picked.seed, nextSeed(1));

  const exhausted = system.next({
    realm: '炼气',
    stage: '前期',
    rngSeed: 1,
    eventState: { doneIds: lianqiIds() },
    dailyDone: { 'daily-lianqi-01': 1 },
    time: { day: 1 },
  });
  assert.equal(exhausted.event, null);
  assert.equal(exhausted.seed, nextSeed(1));

  // 没有 eventState 也能抽（默认候选全池）
  const bare = system.next({
    realm: '筑基',
    stage: '前期',
    rngSeed: 7,
    dailyDone: {},
    time: { day: 1 },
  });
  assert.equal(bare.event?.realm, '筑基');
  assert.equal(bare.event?.stage, '前期');
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
      stage: '前期',
      rngSeed: 1,
      eventState: { doneIds: ['lianqi-01'] },
      dailyDone: {},
      time: { day: 1 },
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
    const stage = REALM_STAGES[i % REALM_STAGES.length];
    const ids = EVENTS.filter(
      (event) => event.realm === realm && event.stage === stage,
    ).map((event) => event.id);
    const doneIds = ids.slice(0, i % (ids.length + 1));
    const picked = pickEvent({
      realm,
      stage,
      doneIds,
      dailyDone: {},
      day: 1,
      seed: i + 1,
    });
    if (picked.event === null) continue;
    assert.equal(doneIds.includes(picked.event.id), false);
    assert.equal(picked.event.realm, realm);
    assert.equal(picked.event.stage, stage);
  }
});

test('九个阶位：炼气/筑基/金丹 × 前/中/后，每阶至少 2 条', () => {
  for (const realm of REALMS) {
    for (const stage of REALM_STAGES) {
      const count = EVENTS.filter(
        (event) => event.realm === realm && event.stage === stage,
      ).length;
      assert.ok(count >= 2, `${realm}·${stage} 应至少 2 条，实际 ${count}`);
    }
  }
});

test('pickEvent：给定境界与阶位只抽该阶事件', () => {
  for (const realm of REALMS) {
    for (const stage of REALM_STAGES) {
      const ids = EVENTS.filter(
        (event) => event.realm === realm && event.stage === stage,
      ).map((event) => event.id);
      for (let seed = 1; seed <= 50; seed += 1) {
        const picked = pickEvent({
          realm,
          stage,
          doneIds: [],
          dailyDone: {},
          day: 1,
          seed,
        });
        assert.notEqual(picked.event, null, `${realm}·${stage} seed=${seed}`);
        assert.equal(picked.event?.realm, realm);
        assert.equal(picked.event?.stage, stage);
        assert.equal(ids.includes(picked.event!.id), true);
      }
    }
  }
});

test('lianqi-01：阶位为前期，且仍是青木诀保底', () => {
  const event = EVENTS.find((entry) => entry.id === 'lianqi-01');
  assert.ok(event);
  assert.equal(event.stage, '前期');
  assert.ok(event.options.length > 0);
  for (const option of event.options) {
    assert.ok(
      (option.grants ?? []).includes('qingmu'),
      `lianqi-01 选项「${option.text}」应保底青木诀`,
    );
  }
});

test('全部事件、全部选项都有 outcome，且 trim 后长度 ≥ 10', () => {
  for (const event of EVENTS) {
    for (const [index, option] of event.options.entries()) {
      assert.equal(typeof option.outcome, 'string', `${event.id}[${index}] 应有 outcome`);
      assert.ok(
        option.outcome.trim().length >= 10,
        `${event.id}[${index}] outcome trim 后长度应 ≥ 10`,
      );
    }
  }
});

test('同一事件内不同选项的 outcome 两两不同', () => {
  for (const event of EVENTS) {
    const outcomes = event.options.map((option) => option.outcome);
    assert.equal(
      new Set(outcomes).size,
      outcomes.length,
      `${event.id} 的选项 outcome 应两两不同`,
    );
  }
});

test('applyOption 返回的 optionText 等于选项 text、outcome 等于选项 outcome', () => {
  for (const event of EVENTS) {
    event.options.forEach((option, index) => {
      const result = applyOption({ cultivation: 0, rngSeed: 1 }, event, index);
      assert.equal(result.optionText, option.text, `${event.id}[${index}] optionText`);
      assert.equal(result.outcome, option.outcome, `${event.id}[${index}] outcome`);
    });
  }
});

test('lianqi-02 的 index 0 与 1 调用 applyOption，返回的 outcome 不同', () => {
  const event = EVENTS.find((entry) => entry.id === 'lianqi-02');
  assert.ok(event);
  const first = applyOption({ cultivation: 0, rngSeed: 1 }, event, 0);
  const second = applyOption({ cultivation: 0, rngSeed: 1 }, event, 1);
  assert.notEqual(first.outcome, second.outcome);
});

test('日常事件可复用：day 1 完成后，day 2 抽不到，day 4 冷却结束可再抽到', () => {
  const id = 'daily-lianqi-01';
  const doneIds = EVENTS.filter(
    (event) => event.realm === '炼气' && event.stage === '前期',
  ).map((event) => event.id);
  const base = {
    realm: '炼气' as const,
    stage: '前期' as const,
    doneIds,
    dailyDone: { [id]: 1 },
    seed: 1,
  };

  assert.equal(pickEvent({ ...base, day: 2 }).event, null);

  const ready = pickEvent({ ...base, day: 4 });
  assert.equal(ready.event?.id, id);
  assert.equal(ready.event?.kind, 'daily');
});

test('奇遇优先：story 池还有未完成事件时，抽到的 event.kind 必为 story', () => {
  for (const realm of REALMS) {
    for (const stage of REALM_STAGES) {
      const storyIds = EVENTS.filter(
        (event) => event.realm === realm && event.stage === stage,
      ).map((event) => event.id);
      assert.ok(storyIds.length > 0, `${realm}·${stage} 应有奇遇`);
      for (const doneIds of [[], storyIds.slice(0, -1)] as const) {
        for (const seed of [1, 8, 42]) {
          const picked = pickEvent({
            realm,
            stage,
            doneIds,
            dailyDone: {},
            day: 1,
            seed,
          });
          assert.equal(
            picked.event?.kind,
            'story',
            `${realm}·${stage} seed=${seed}`,
          );
        }
      }
    }
  }
});
