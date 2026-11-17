import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_ROOTS,
  INITIAL_CULTIVATION_MAX,
  START_INVENTORY,
  START_SLOTS,
  nextThresholdOf,
} from '../src/data/balance.ts';
import { MemoryCharacterRepository, withDefaults } from '../src/storage/repository.ts';
import type { MvpCharacter } from '../src/types.ts';

/** 让 Date.now() 至少前进 1ms，避免 createdAt / updatedAt 撞在同一毫秒。 */
function tick(ms = 3): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

test('全链路：create → list → get → update → remove → activeId', async () => {
  const repo = new MemoryCharacterRepository();

  const first = await repo.create({ name: '沈青' });
  await tick();
  const second = await repo.create({ name: '白鹿' });
  await tick();
  const third = await repo.create({ name: '云鹤' });

  // list：只返回摘要，按 createdAt 倒序
  const summaries = await repo.list();
  assert.deepEqual(
    summaries.map((summary) => summary.name),
    ['云鹤', '白鹿', '沈青'],
  );
  for (const summary of summaries) {
    assert.deepEqual(Object.keys(summary).sort(), [
      'createdAt',
      'cultivation',
      'day',
      'id',
      'name',
      'realm',
      'stage',
    ]);
  }
  assert.equal(summaries[0].id, third.id);
  assert.ok(summaries[0].createdAt >= summaries[1].createdAt);
  assert.ok(summaries[1].createdAt >= summaries[2].createdAt);

  // get：拿到完整存档，且是副本（改它不影响存储）
  const loaded = await repo.get(second.id);
  assert.notEqual(loaded, null);
  assert.equal(loaded?.name, '白鹿');
  loaded!.cultivation = 999;
  const reloaded = await repo.get(second.id);
  assert.equal(reloaded?.cultivation, 0);

  // update：patch 合并 + updatedAt 刷新 + 返回新对象
  const before = await repo.get(first.id);
  await tick();
  const patched = await repo.update(first.id, {
    cultivation: 42,
    time: { day: 7, tick: 6 },
  });
  assert.notEqual(patched, before);
  assert.equal(patched.id, first.id);
  assert.equal(patched.createdAt, first.createdAt);
  assert.equal(patched.cultivation, 42);
  assert.equal(patched.time.day, 7);
  assert.equal(patched.name, '沈青');
  assert.ok(patched.updatedAt > (before?.updatedAt ?? 0));
  // 原对象不被就地修改
  assert.equal(first.cultivation, 0);

  // id / createdAt 不可被 patch 篡改
  const guarded = await repo.update(first.id, {
    id: 'hacked',
    createdAt: 1,
  } as Partial<MvpCharacter>);
  assert.equal(guarded.id, first.id);
  assert.equal(guarded.createdAt, first.createdAt);

  // activeId：赋值 / 读取
  await repo.setActiveId(second.id);
  assert.equal(await repo.getActiveId(), second.id);

  // remove：删掉的 id 是 activeId 时置 null
  await repo.remove(second.id);
  assert.equal(await repo.get(second.id), null);
  assert.equal(await repo.getActiveId(), null);
  const afterRemove = await repo.list();
  assert.deepEqual(
    afterRemove.map((summary) => summary.name),
    ['云鹤', '沈青'],
  );

  // remove：不是 activeId 的 id 不影响当前角色
  await repo.setActiveId(third.id);
  await repo.remove(first.id);
  assert.equal(await repo.getActiveId(), third.id);
  assert.equal((await repo.list()).length, 1);

  await repo.setActiveId(null);
  assert.equal(await repo.getActiveId(), null);
});

test('create：缺省值全部来自 balance.ts', async () => {
  const repo = new MemoryCharacterRepository();
  const character = await repo.create({ name: '  沈青  ' });

  assert.equal(character.name, '沈青');
  assert.deepEqual(character.spiritRoots, DEFAULT_ROOTS);
  assert.deepEqual(character.techniques, [...START_SLOTS]);
  assert.equal(character.techniques.length, 3);
  assert.deepEqual(character.inventory, [...START_INVENTORY]);
  assert.equal(character.activeSlot, 0);
  assert.equal(character.realm, '炼气');
  assert.equal(character.stage, '前期');
  assert.equal(character.cultivation, 0);
  assert.equal(character.nextThreshold, nextThresholdOf('炼气', '前期'));
  assert.equal(character.cultivationMax, INITIAL_CULTIVATION_MAX);
  assert.deepEqual(character.eventState, { doneIds: [], count: 0 });
  assert.equal(character.time.day, 1);
  assert.equal(character.time.tick, 0);
  assert.equal(character.saveVersion, 1);
  assert.match(character.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(typeof character.createdAt, 'number');
  assert.equal(character.createdAt, character.updatedAt);
  assert.ok(character.rngSeed >= 0 && character.rngSeed <= 4294967295);
  // 默认灵根五行皆 15，主属性取 ELEMENT_ORDER 里第一个最大值 → 金
  assert.equal(character.element, '金');
});

test('create：灵根合计不等于 100（±0.01）时抛错且不落库', async () => {
  const repo = new MemoryCharacterRepository();

  await assert.rejects(
    () =>
      repo.create({
        name: '破灵根',
        spiritRoots: { ...DEFAULT_ROOTS, fire: 99 },
      }),
    /灵根合计必须为 100/,
  );

  await assert.rejects(
    () =>
      repo.create({
        name: '空名',
        spiritRoots: { ...DEFAULT_ROOTS, fire: -1 },
      }),
    /灵根/,
  );

  assert.equal((await repo.list()).length, 0);
});

test('create：灵根误差在 ±0.01 内可通过，超出则拒绝', async () => {
  const repo = new MemoryCharacterRepository();

  const inside = await repo.create({
    name: '差一点',
    spiritRoots: { ...DEFAULT_ROOTS, qian: 15.005 },
  });
  assert.equal(inside.name, '差一点');

  await assert.rejects(
    () =>
      repo.create({
        name: '差太多',
        spiritRoots: { ...DEFAULT_ROOTS, qian: 15.02 },
      }),
    /灵根合计必须为 100/,
  );
});

test('create：名字为空 / 只有空白时抛错', async () => {
  const repo = new MemoryCharacterRepository();
  await assert.rejects(() => repo.create({ name: '   ' }), /角色名不能为空/);
  assert.equal((await repo.list()).length, 0);
});

test('update / get：不存在的 id 抛错 / 返回 null', async () => {
  const repo = new MemoryCharacterRepository();
  assert.equal(await repo.get('missing'), null);
  await assert.rejects(
    () => repo.update('missing', { time: { day: 2, tick: 1 } }),
    /角色不存在/,
  );
});

test('list：空仓库返回空数组', async () => {
  const repo = new MemoryCharacterRepository();
  assert.deepEqual(await repo.list(), []);
  assert.equal(await repo.getActiveId(), null);
});

test('withDefaults：老存档只有 day 时迁移成 time，并删掉旧字段', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '旧档' });
  const legacy = { ...created } as unknown as Record<string, unknown>;
  legacy.day = 12;
  delete legacy.time;

  const migrated = withDefaults(legacy as unknown as MvpCharacter);

  assert.deepEqual(migrated.time, { day: 12, tick: 11 }); // tick = day - 1
  assert.equal('day' in migrated, false);
});

test('create：缺键灵根抛错且不落库', async () => {
  const repo = new MemoryCharacterRepository();
  // 去掉 kun，并把 qian 加上这 10 点：其余键加起来正好 100。
  // 旧实现会把缺键加成 NaN，合计比较被绕过。
  const spiritRoots = { ...DEFAULT_ROOTS, qian: 25 } as Partial<typeof DEFAULT_ROOTS>;
  delete spiritRoots.kun;

  await assert.rejects(
    () => repo.create({ name: '缺坤', spiritRoots: spiritRoots as typeof DEFAULT_ROOTS }),
    /灵根 kun 必须是非负有限数/,
  );
  assert.equal((await repo.list()).length, 0);
});

test('update：外部 push 不影响存档', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '沈青' });

  const inventory: MvpCharacter['inventory'] = [
    {
      uid: 'u-qingmu',
      kind: 'technique',
      techniqueId: 'qingmu',
      fromEventId: 'evt-1',
      obtainedAt: 1,
    },
  ];
  const techniques: (string | null)[] = ['qingmu', null, null];
  const time = { day: 4, tick: 3 };
  const spiritRoots = { ...DEFAULT_ROOTS };
  const eventState = { doneIds: ['e1'], count: 1 };
  const plotFlags = ['flag-a'];

  await repo.update(created.id, {
    inventory,
    techniques,
    time,
    spiritRoots,
    eventState,
    plotFlags,
  });

  inventory.push({
    uid: 'u-extra',
    kind: 'technique',
    techniqueId: 'liehuo',
    fromEventId: 'evt-2',
    obtainedAt: 2,
  });
  inventory[0].fromEventId = 'tampered';
  techniques.push('liehuo');
  techniques[0] = 'liehuo';
  time.day = 99;
  spiritRoots.fire = 0;
  eventState.doneIds.push('e2');
  eventState.count = 9;
  plotFlags.push('flag-b');

  const loaded = await repo.get(created.id);
  assert.deepEqual(loaded?.inventory, [
    {
      uid: 'u-qingmu',
      kind: 'technique',
      techniqueId: 'qingmu',
      fromEventId: 'evt-1',
      obtainedAt: 1,
    },
  ]);
  assert.deepEqual(loaded?.techniques, ['qingmu', null, null]);
  assert.deepEqual(loaded?.time, { day: 4, tick: 3 });
  assert.equal(loaded?.spiritRoots.fire, DEFAULT_ROOTS.fire);
  assert.deepEqual(loaded?.eventState, { doneIds: ['e1'], count: 1 });
  assert.deepEqual(loaded?.plotFlags, ['flag-a']);
});

test('get / list 之后存档对象未被改写', async () => {
  const createdRepo = new MemoryCharacterRepository();
  const created = await createdRepo.create({ name: '旧档' });
  const stored = { ...created } as unknown as Record<string, unknown>;
  stored.day = 12;
  delete stored.time;
  const snapshot = JSON.stringify(stored);

  const migrated = withDefaults(stored as unknown as MvpCharacter);
  assert.equal(JSON.stringify(stored), snapshot);
  assert.deepEqual(migrated.time, { day: 12, tick: 11 });
  assert.equal('day' in migrated, false);

  const repo = new MemoryCharacterRepository([[created.id, stored as unknown as MvpCharacter]]);
  const loaded = await repo.get(created.id);
  const summaries = await repo.list();

  assert.equal(JSON.stringify(stored), snapshot);
  assert.equal('time' in stored, false);
  assert.equal(stored.day, 12);
  assert.notEqual(loaded, null);
  assert.deepEqual(loaded?.time, { day: 12, tick: 11 });
  assert.equal('day' in loaded!, false);
  assert.equal(summaries[0]?.day, 12);
});

test('get：迁移补进的 inventory uid 连续两次读取相同', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '沈青' });
  await repo.update(created.id, {
    techniques: ['qingmu', null, null],
    inventory: [],
  });

  const first = await repo.get(created.id);
  const second = await repo.get(created.id);

  assert.equal(first?.inventory[0].uid, second?.inventory[0].uid);
  assert.equal(first?.inventory[0].uid, 'migrated-qingmu');
  assert.equal(second?.inventory[0].uid, 'migrated-qingmu');
});
