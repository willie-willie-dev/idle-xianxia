import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  START_INVENTORY,
  START_SLOTS,
  techniqueById,
} from '../src/data/balance.ts';
import { MemoryCharacterRepository, withDefaults } from '../src/storage/repository.ts';
import {
  activeTechnique,
  addItem,
  equip,
  findItemByUid,
  hasTechnique,
} from '../src/systems/inventory.ts';
import type {
  InventoryItem,
  MvpCharacter,
  TechniqueSlot,
} from '../src/types.ts';

function makeItem(techniqueId: string, uid?: string): InventoryItem {
  return {
    uid: uid ?? crypto.randomUUID(),
    kind: 'technique',
    techniqueId,
    fromEventId: 'test-event',
    obtainedAt: 1234,
  };
}

test('addItem：空背包加入一条，返回新数组且不改入参', () => {
  const empty: InventoryItem[] = [];
  const item = makeItem('qingmu');
  const result = addItem(empty, item);

  assert.equal(result.added, true);
  assert.deepEqual(result.inventory, [item]);
  assert.deepEqual(empty, []);
  assert.notEqual(result.inventory, empty);
});

test('addItem：同 techniqueId 去重，只保留先到的一条', () => {
  const first = makeItem('qingmu');
  const inventory = [first];
  const second = makeItem('qingmu');
  const result = addItem(inventory, second);

  assert.equal(result.added, false);
  assert.equal(result.inventory.length, 1);
  assert.equal(result.inventory[0].uid, first.uid);
  assert.equal(second.uid === first.uid, false);
});

test('hasTechnique / findItemByUid：命中与未命中', () => {
  const item = makeItem('liehuo');
  const inventory = [item];

  assert.equal(hasTechnique(inventory, 'liehuo'), true);
  assert.equal(hasTechnique(inventory, 'qingmu'), false);
  assert.equal(findItemByUid(inventory, item.uid), item);
  assert.equal(findItemByUid(inventory, 'missing'), null);
});

test('equip：装备到指定槽，返回新数组、不改原槽；未拥有 / 越界抛错', () => {
  const inventory = [makeItem('liehuo')];
  const slots: (string | null)[] = [null, null, null];

  const next = equip(slots, 1, 'liehuo', inventory);
  assert.deepEqual(next, [null, 'liehuo', null]);
  assert.deepEqual(slots, [null, null, null]);
  assert.notEqual(next, slots);

  assert.throws(() => equip(slots, 0, 'qingmu', inventory), /不在背包/);
  assert.throws(
    () => equip(slots, 3 as unknown as TechniqueSlot, 'liehuo', inventory),
    /功法槽位/,
  );
  assert.throws(
    () => equip(slots, -1 as unknown as TechniqueSlot, 'liehuo', inventory),
    /功法槽位/,
  );
});

test('activeTechnique：空槽返回 null，已装备返回库里的系数', () => {
  assert.equal(activeTechnique([null, null, null], 0), null);
  assert.equal(activeTechnique([null, null, null], 2), null);

  const def = techniqueById('liehuo');
  assert.deepEqual(activeTechnique(['liehuo', null, null], 0), {
    name: def.name,
    absorbRate: def.absorbRate,
    convertRate: def.convertRate,
  });
  // 库外 id 视为无功法
  assert.equal(activeTechnique(['bogus', null, null], 0), null);
  assert.throws(
    () => activeTechnique([null, null, null], 3 as unknown as TechniqueSlot),
    /功法槽位/,
  );
});

test('迁移：对象数组 → id 数组 + 背包（库外丢弃，每个匹配项一条）', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '旧档' });
  const legacy = { ...created } as unknown as Record<string, unknown>;
  legacy.techniques = [
    { name: '青木诀', absorbRate: 0.4, convertRate: 0.3 },
    { name: '玄天诀', absorbRate: 0.33, convertRate: 0.44 },
    { name: '庚金诀', absorbRate: 0.5, convertRate: 0.4 },
  ];
  delete legacy.inventory;
  delete legacy.activeSlot;

  const migrated = withDefaults(legacy as unknown as MvpCharacter);

  assert.deepEqual(migrated.techniques, ['qingmu', null, 'gengjin']);
  assert.equal(migrated.inventory.length, 2);
  const ids = migrated.inventory.map((item) => item.techniqueId);
  assert.deepEqual(ids, ['qingmu', 'gengjin']);
  for (const item of migrated.inventory) {
    assert.equal(item.kind, 'technique');
    assert.equal(item.fromEventId, 'migrated');
    assert.equal(item.uid, `migrated-${item.techniqueId}`);
    assert.equal(typeof item.obtainedAt, 'number');
  }
  assert.equal(new Set(migrated.inventory.map((item) => item.uid)).size, 2);
  assert.equal(migrated.activeSlot, 0);
});

test('迁移：已装备但背包缺失 → 补一条 migrated；再跑一次幂等', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '旧档' });
  const legacy = { ...created } as unknown as Record<string, unknown>;
  legacy.techniques = ['xuanshui', null, null];
  delete legacy.inventory;
  delete legacy.activeSlot;

  const once = withDefaults(legacy as unknown as MvpCharacter);
  assert.deepEqual(once.techniques, ['xuanshui', null, null]);
  assert.equal(once.inventory.length, 1);
  assert.equal(once.inventory[0].techniqueId, 'xuanshui');
  assert.equal(once.inventory[0].fromEventId, 'migrated');

  const twice = withDefaults(once);
  assert.equal(twice.inventory.length, 1);
  assert.equal(twice.inventory[0].uid, once.inventory[0].uid);
});

test('迁移：缺 inventory → []，坏条目 / 重复 / 库外 id 被丢弃', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '旧档' });

  const noInventory = { ...created, techniques: [...START_SLOTS] } as unknown as Record<
    string,
    unknown
  >;
  delete noInventory.inventory;
  const cleaned = withDefaults(noInventory as unknown as MvpCharacter);
  assert.deepEqual(cleaned.inventory, [...START_INVENTORY]);

  const dirty = {
    ...created,
    techniques: [...START_SLOTS],
    inventory: [
      { uid: 'u1', techniqueId: 'qingmu' },
      { uid: 'u2', techniqueId: 'qingmu' }, // 重复
      { uid: 'u3', techniqueId: 'bogus' }, // 库外
      null,
      'not-an-object',
    ],
  } as unknown as MvpCharacter;
  const normalized = withDefaults(dirty);
  assert.equal(normalized.inventory.length, 1);
  assert.equal(normalized.inventory[0].techniqueId, 'qingmu');
  assert.equal(normalized.inventory[0].uid, 'u1');
  assert.equal(normalized.inventory[0].kind, 'technique');
  assert.equal(normalized.inventory[0].fromEventId, 'migrated');
});
