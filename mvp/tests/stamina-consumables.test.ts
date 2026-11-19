import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMemoryApp } from '../src/app.ts';
import type { GameApp } from '../src/app.ts';
import {
  ABSORB_STAMINA_COST,
  STAMINA_INITIAL,
  STAMINA_MAX,
} from '../src/data/balance.ts';
import { EVENTS } from '../src/data/events.ts';
import {
  canAbsorb,
  clampStamina,
  restoreStamina,
  spendStamina,
} from '../src/systems/stamina.ts';
import type { GameEvent, MvpCharacter } from '../src/types.ts';

function eventById(id: string): GameEvent {
  const event = EVENTS.find((entry) => entry.id === id);
  assert.ok(event, `事件池里应有 ${id}`);
  return event;
}

/**
 * 下一次操作读的是内存里的当前角色。
 * 应用层没有改体力 / 修为 / 种子的入口，测试直接改这份当前角色。
 */
function tune(
  app: GameApp,
  patch: Partial<Pick<MvpCharacter, 'stamina' | 'cultivation' | 'rngSeed'>>,
): MvpCharacter {
  const character = app.current();
  assert.ok(character, '还没有当前角色');
  if (patch.stamina !== undefined) character.stamina = patch.stamina;
  if (patch.cultivation !== undefined) character.cultivation = patch.cultivation;
  if (patch.rngSeed !== undefined) character.rngSeed = patch.rngSeed;
  return character;
}

/** 领一本青木诀并装备到槽 0。选项 2 不扣体力。 */
async function appWithQingmu(): Promise<GameApp> {
  const app = createMemoryApp();
  await app.create('沈青');
  const resolved = await app.resolveEvent(eventById('lianqi-01'), 2);
  const item = resolved.granted[0];
  assert.ok(item, '山道拾遗应掉落青木诀');
  await app.equipTechnique(0, item.uid);
  return app;
}

test('体力纯函数：canAbsorb 边界、不足扣到 0、回复不超上限、负数与 NaN 归 0', () => {
  assert.equal(ABSORB_STAMINA_COST, 5);
  assert.equal(canAbsorb(5, ABSORB_STAMINA_COST), true);
  assert.equal(canAbsorb(4, ABSORB_STAMINA_COST), false);

  assert.equal(spendStamina(4, ABSORB_STAMINA_COST), 0);
  assert.equal(spendStamina(0, 1), 0);

  assert.equal(restoreStamina(90, 40, STAMINA_MAX), STAMINA_MAX);
  assert.equal(restoreStamina(STAMINA_MAX, 40, STAMINA_MAX), STAMINA_MAX);
  assert.ok(restoreStamina(10, 20, STAMINA_MAX) <= STAMINA_MAX);

  assert.equal(clampStamina(-1, STAMINA_MAX), 0);
  assert.equal(clampStamina(Number.NaN, STAMINA_MAX), 0);
});

test('新角色体力满、没有破境保证', async () => {
  const app = createMemoryApp();
  const character = await app.create('沈青');

  assert.equal(character.stamina, STAMINA_INITIAL);
  assert.equal(character.stamina, 100);
  assert.equal(character.staminaMax, STAMINA_MAX);
  assert.equal(character.staminaMax, 100);
  assert.equal(character.breakthroughGuard, false);
});

test('无功法吸收：因功法被挡住，体力与天数都不变', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  const turn = await app.absorb();

  assert.equal(turn.blocked, true);
  assert.equal(turn.blockedReason, 'technique');
  assert.equal(turn.character.stamina, created.stamina);
  assert.equal(turn.character.time.day, created.time.day);
});

test('有功法吸收一次：体力 -5，天数 +1', async () => {
  const app = await appWithQingmu();
  const before = app.current();
  assert.ok(before);

  const turn = await app.absorb();

  assert.equal(turn.blocked, false);
  assert.equal(turn.character.stamina, before.stamina - ABSORB_STAMINA_COST);
  assert.equal(turn.character.time.day, before.time.day + 1);
});

test('体力不足时吸收：因体力被挡住，天数不变', async () => {
  const app = await appWithQingmu();
  const before = tune(app, { stamina: 3 });

  const turn = await app.absorb();

  assert.equal(turn.blocked, true);
  assert.equal(turn.blockedReason, 'stamina');
  assert.equal(turn.character.stamina, 3);
  assert.equal(turn.character.time.day, before.time.day);
});

test('打坐：60 回复到上限并过一天，满体力再打坐仍是 100', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  tune(app, { stamina: 60 });

  const rested = await app.rest();
  assert.equal(rested.character.stamina, 100);
  assert.equal(rested.character.stamina, rested.character.staminaMax);
  assert.equal(rested.gained, 40);
  assert.equal(rested.character.time.day, created.time.day + 1);

  const full = await app.rest();
  assert.equal(full.character.stamina, 100);
  assert.equal(full.gained, 0);
});

test('lianqi-01 选项 0：结算后体力 -10', async () => {
  const app = createMemoryApp();
  const created = await app.create('沈青');
  const turn = await app.resolveEvent(eventById('lianqi-01'), 0);

  assert.equal(turn.staminaCost, 10);
  assert.equal(turn.character.stamina, created.stamina - 10);
});

test('消耗品：同 id 堆成 2，回气丹恢复 30 并封顶，破境丹不能直接使用', async () => {
  const app = createMemoryApp();
  await app.create('沈青');

  const source = eventById('lianqi-04');
  await app.resolveEvent(source, 2);
  const stacked = await app.resolveEvent(source, 2);
  const pills = stacked.character.inventory.filter(
    (item) => item.kind === 'consumable' && item.itemId === 'huiqi-dan',
  );
  assert.equal(pills.length, 1);
  const pill = pills[0];
  assert.ok(pill !== undefined && pill.kind === 'consumable');
  assert.equal(pill.count, 2);

  tune(app, { stamina: 50 });
  const healed = await app.useItem(pill.uid);
  assert.equal(healed.effect.kind, 'stamina');
  assert.equal(healed.effect.amount, 30);
  assert.equal(healed.character.stamina, 80);
  const remaining = healed.character.inventory.find(
    (item) => item.kind === 'consumable' && item.itemId === 'huiqi-dan',
  );
  assert.ok(remaining !== undefined && remaining.kind === 'consumable');
  assert.equal(remaining.count, 1);

  tune(app, { stamina: 90 });
  const capped = await app.useItem(pill.uid);
  assert.equal(capped.effect.amount, 30);
  assert.equal(capped.character.stamina, 100);
  assert.equal(capped.character.stamina, capped.character.staminaMax);
  assert.equal(
    capped.character.inventory.some(
      (item) => item.kind === 'consumable' && item.itemId === 'huiqi-dan',
    ),
    false,
  );

  const granted = await app.resolveEvent(eventById('jindan-04'), 0);
  const dan = granted.character.inventory.find(
    (item) => item.kind === 'consumable' && item.itemId === 'pojing-dan',
  );
  assert.ok(dan !== undefined && dan.kind === 'consumable');

  await assert.rejects(() => app.useItem(dan.uid), /不能直接使用/);
});
