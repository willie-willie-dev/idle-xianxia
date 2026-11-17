import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApp } from '../src/app.ts';
import type { GameApp } from '../src/app.ts';
import {
  DEFAULT_ROOTS,
  START_INVENTORY,
  START_SLOTS,
  TECHNIQUE_LIBRARY,
  TECHNIQUE_SLOT_COUNT,
  nextThresholdOf,
  techniqueById,
} from '../src/data/balance.ts';
import { VOLCANO } from '../src/data/locations.ts';
import { MemoryCharacterRepository, withDefaults } from '../src/storage/repository.ts';
import { absorb } from '../src/systems/absorb.ts';
import type {
  InventoryItem,
  MvpCharacter,
  TechniqueSlot,
} from '../src/types.ts';

const EPS = 1e-9;

/** 火山 + 默认灵根的原始入池总量（不含 absorbRate）。 */
const VOLCANO_CHANNEL_TOTAL = 88.55;

function close(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= EPS,
    `${label}：期望 ${expected}，实际 ${actual}`,
  );
}

/** 某功法在「火山 + 默认灵根」下的单次修为产出。 */
function gainOf(id: string): number {
  const def = techniqueById(id);
  return absorb(VOLCANO, DEFAULT_ROOTS, def).cultivationGain;
}

/** 造一条测试用背包物品。 */
function makeItem(techniqueId: string): InventoryItem {
  return {
    uid: crypto.randomUUID(),
    kind: 'technique',
    techniqueId,
    fromEventId: 'test',
    obtainedAt: 1,
  };
}

/** 先建号、再往背包里塞功法，最后交给 app（生产路径不提供凭空发功法）。 */
async function seededApp(ids: readonly string[]): Promise<GameApp> {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '沈青' });
  await repo.update(created.id, { inventory: ids.map(makeItem) });
  const app = createApp(repo);
  await app.enter(created.id);
  return app;
}

/** 从背包按功法 id 找 uid，装备到指定槽。 */
async function equipOwned(
  app: GameApp,
  slot: TechniqueSlot,
  techniqueId: string,
): Promise<MvpCharacter> {
  const item = app.inventory().find((entry) => entry.techniqueId === techniqueId);
  assert.ok(item !== undefined, `背包里应有 ${techniqueId}`);
  return app.equipTechnique(slot, item.uid);
}

test('初始三槽全空：techniques = [null, null, null]，activeSlot = 0，背包为空', async () => {
  const repo = new MemoryCharacterRepository();
  const character = await repo.create({ name: '沈青' });

  assert.equal(TECHNIQUE_SLOT_COUNT, 3);
  assert.equal(character.techniques.length, 3);
  assert.deepEqual(character.techniques, [...START_SLOTS]);
  assert.deepEqual(character.inventory, [...START_INVENTORY]);
  assert.equal(character.activeSlot, 0);

  // 功法库 5 条，综合效率严格递增（差异明显，便于测试）
  assert.equal(TECHNIQUE_LIBRARY.length, 5);
  const efficiencies = TECHNIQUE_LIBRARY.map(
    (def) => def.absorbRate * def.convertRate,
  );
  assert.deepEqual(efficiencies, [0.12, 0.15, 0.175, 0.2, 0.225]);
});

test('吸收产出随功法变化：火山 + 默认灵根，效率 0.12 → 0.225 逐档递增', () => {
  // 原始入池 200×0.15 + 30×0.15 + 230×0.15×1.5 + 230×0.10×0.1 = 88.55
  close(gainOf('qingmu'), VOLCANO_CHANNEL_TOTAL * 0.12, '青木诀 0.12');
  close(gainOf('liehuo'), VOLCANO_CHANNEL_TOTAL * 0.15, '烈火诀 0.15');
  close(gainOf('houtu'), VOLCANO_CHANNEL_TOTAL * 0.175, '厚土诀 0.175');
  close(gainOf('gengjin'), VOLCANO_CHANNEL_TOTAL * 0.2, '庚金诀 0.20');
  close(gainOf('xuanshui'), VOLCANO_CHANNEL_TOTAL * 0.225, '玄水诀 0.225');

  // 具体数值（浏览器验点用）
  close(gainOf('qingmu'), 10.626, '青木诀 单次 10.626');
  close(gainOf('liehuo'), 13.2825, '烈火诀 单次 13.2825');
  close(gainOf('houtu'), 15.49625, '厚土诀 单次 15.49625');
  close(gainOf('gengjin'), 17.71, '庚金诀 单次 17.71');
  close(gainOf('xuanshui'), 19.92375, '玄水诀 单次 19.92375');

  assert.ok(gainOf('xuanshui') > gainOf('gengjin'));
  assert.ok(gainOf('gengjin') > gainOf('houtu'));
  assert.ok(gainOf('houtu') > gainOf('liehuo'));
  assert.ok(gainOf('liehuo') > gainOf('qingmu'));
});

test('app：切换 activeSlot / 换槽功法后，单次吸收立即按新功法计算', async () => {
  const app = await seededApp(['qingmu', 'liehuo', 'houtu', 'gengjin', 'xuanshui']);

  // 槽 0 = 青木诀
  await equipOwned(app, 0, 'qingmu');
  const first = await app.absorb();
  close(first.gain, 10.626, '槽 0 青木诀');

  // 切到槽 1 = 烈火诀
  await equipOwned(app, 1, 'liehuo');
  await app.setActiveSlot(1);
  const second = await app.absorb();
  close(second.gain, 13.2825, '槽 1 烈火诀');

  // 槽 2 装庚金诀，再切过去
  const changed = await equipOwned(app, 2, 'gengjin');
  assert.equal(changed.techniques[2], 'gengjin');
  assert.equal(changed.activeSlot, 1); // 装备不改生效槽
  assert.deepEqual(changed.techniques, ['qingmu', 'liehuo', 'gengjin']);
  await app.setActiveSlot(2);
  const third = await app.absorb();
  close(third.gain, 17.71, '槽 2 庚金诀');

  // 再换玄水诀，切到槽 2
  await equipOwned(app, 2, 'xuanshui');
  await app.setActiveSlot(2);
  const fourth = await app.absorb();
  close(fourth.gain, 19.92375, '槽 2 玄水诀');
});

test('setSlotTechnique / equipTechnique / setActiveSlot：未知 id、未拥有、越界都抛错', async () => {
  const app = await seededApp(['qingmu']);

  await assert.rejects(() => app.setSlotTechnique(0, 'bogus'), /未知功法/);
  await assert.rejects(() => app.setSlotTechnique(0, 'liehuo'), /不在背包/);
  await assert.rejects(() => app.setSlotTechnique(3, 'qingmu'), /功法槽位/);
  await assert.rejects(() => app.setSlotTechnique(-1, 'qingmu'), /功法槽位/);
  await assert.rejects(() => app.equipTechnique(0, 'no-such-uid'), /没有这件物品/);
  await assert.rejects(
    () => app.equipTechnique(3, app.inventory()[0].uid),
    /功法槽位/,
  );
  await assert.rejects(() => app.setActiveSlot(3), /功法槽位/);
  await assert.rejects(() => app.setActiveSlot(1.5), /功法槽位/);

  // 抛错不影响存档
  const character = app.current();
  assert.notEqual(character, null);
  assert.equal(character?.techniques[0], null);
  assert.equal(character?.activeSlot, 0);
});

test('迁移：旧单 technique（库外）丢弃为 null，不污染背包；库内则进槽并进背包', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '旧档' });

  const unknown = { ...created } as unknown as Record<string, unknown>;
  delete unknown.techniques;
  delete unknown.activeSlot;
  delete unknown.stage;
  unknown.technique = { name: '玄天诀', absorbRate: 0.33, convertRate: 0.44 };
  const migrated = withDefaults(unknown as unknown as MvpCharacter);

  assert.equal('technique' in migrated, false);
  assert.deepEqual(migrated.techniques, [null, null, null]);
  assert.deepEqual(migrated.inventory, []);
  assert.equal(migrated.activeSlot, 0);
  assert.equal(migrated.stage, '前期');

  // 库内功法：按名字匹配到 id，同时补进背包
  const known = { ...created } as unknown as Record<string, unknown>;
  delete known.techniques;
  known.technique = { name: '青木诀', absorbRate: 0.4, convertRate: 0.3 };
  const matched = withDefaults(known as unknown as MvpCharacter);
  assert.deepEqual(matched.techniques, ['qingmu', null, null]);
  assert.equal(matched.inventory.length, 1);
  assert.equal(matched.inventory[0].techniqueId, 'qingmu');
  assert.equal(matched.inventory[0].fromEventId, 'migrated');
});

test('迁移：既无 technique 也无 techniques → 三空槽；缺 stage / activeSlot 也能补', async () => {
  const repo = new MemoryCharacterRepository();
  const created = await repo.create({ name: '史前档' });
  const legacy = { ...created } as unknown as Record<string, unknown>;
  delete legacy.techniques;
  delete legacy.activeSlot;
  delete legacy.stage;
  delete legacy.technique;

  const migrated = withDefaults(legacy as unknown as MvpCharacter);

  assert.deepEqual(migrated.techniques, [null, null, null]);
  assert.deepEqual(migrated.inventory, []);
  assert.equal(migrated.activeSlot, 0);
  assert.equal(migrated.stage, '前期');
  assert.equal(migrated.nextThreshold, nextThresholdOf('炼气', '前期'));

  // 老存档境界已有、阶位缺失：按新阶位表重算阈值与上限
  const oldRealm = { ...created, realm: '筑基', cultivation: 900 } as unknown as Record<
    string,
    unknown
  >;
  delete oldRealm.stage;
  oldRealm.cultivationMax = 2000; // 旧三阶数值
  oldRealm.nextThreshold = 500;
  const rebuilt = withDefaults(oldRealm as unknown as MvpCharacter);
  assert.equal(rebuilt.stage, '前期');
  assert.equal(rebuilt.nextThreshold, 700);
  assert.equal(rebuilt.cultivationMax, 2800);
  // 已有三槽（空槽）→ 保持，不被塞默认功法
  assert.deepEqual(rebuilt.techniques, [null, null, null]);
  assert.deepEqual(rebuilt.inventory, []);
});
