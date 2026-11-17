import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMemoryApp } from '../src/app.ts';
import { EVENTS } from '../src/data/events.ts';

const EPS = 1e-9;

function close(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= EPS,
    `${label}：期望 ${expected}，实际 ${actual}`,
  );
}

function eventById(id: string) {
  const event = EVENTS.find((entry) => entry.id === id);
  assert.ok(event, `事件池里应有 ${id}`);
  return event;
}

test('新角色初始无功法：三槽全空、背包为空、生效功法为 null', async () => {
  const app = createMemoryApp();
  const character = await app.create('沈青');

  assert.deepEqual(character.techniques, [null, null, null]);
  assert.deepEqual(character.inventory, []);
  assert.equal(character.activeSlot, 0);
  assert.deepEqual(app.ownedTechniques(), []);
  assert.deepEqual(app.inventory(), []);
});

test('无功法吸收：gain = 0、blocked = true、不推进时间与种子', async () => {
  const app = createMemoryApp();
  await app.create('沈青');
  const before = app.current();
  assert.ok(before);

  for (let i = 0; i < 3; i += 1) {
    const turn = await app.absorb();
    assert.equal(turn.blocked, true);
    assert.equal(turn.gain, 0);
    assert.equal(turn.absorption, null);
    assert.equal(turn.capped, false);
    assert.equal(turn.character.cultivation, 0);
    assert.equal(turn.character.time.day, before.time.day);
    assert.equal(turn.character.time.tick, before.time.tick);
    assert.equal(turn.character.rngSeed, before.rngSeed);
  }
});

test('历练拿到青木诀 → 进背包；装备前仍无修为，装备后 +10.626 并推进 1 天', async () => {
  const app = createMemoryApp();
  await app.create('沈青');

  const resolved = await app.resolveEvent(eventById('lianqi-01'), 0);
  assert.equal(resolved.granted.length, 1);
  const item = resolved.granted[0];
  assert.equal(item.techniqueId, 'qingmu');

  // 只在背包里，还没装备 → 吸收仍然被门禁挡住
  const stillBlocked = await app.absorb();
  assert.equal(stillBlocked.blocked, true);
  assert.equal(stillBlocked.gain, 0);

  const equipped = await app.equipTechnique(0, item.uid);
  assert.equal(equipped.techniques[0], 'qingmu');
  assert.equal(equipped.activeSlot, 0);

  const dayBefore = equipped.time.day;
  const turn = await app.absorb();
  assert.equal(turn.blocked, false);
  close(turn.gain, 10.626, '青木诀单次修为');
  // 事件本身给了 +8 修为；吸收再 +10.626。
  close(turn.character.cultivation, 8 + 10.626, '修为累加');
  assert.equal(turn.character.time.day, dayBefore + 1);
  assert.notEqual(turn.absorption, null);
});

test('槽位切换影响 gain：槽 0 青木诀 10.626 → 槽 1 烈火诀 13.2825', async () => {
  const app = createMemoryApp();
  await app.create('沈青');

  const qingmu = await app.resolveEvent(eventById('lianqi-01'), 0);
  const liehuo = await app.resolveEvent(eventById('zhuji-01'), 0);
  assert.equal(qingmu.granted[0].techniqueId, 'qingmu');
  assert.equal(liehuo.granted[0].techniqueId, 'liehuo');

  await app.equipTechnique(0, qingmu.granted[0].uid);
  await app.equipTechnique(1, liehuo.granted[0].uid);

  const slot0 = await app.absorb();
  close(slot0.gain, 10.626, '槽 0 青木诀');

  await app.setActiveSlot(1);
  const slot1 = await app.absorb();
  close(slot1.gain, 13.2825, '槽 1 烈火诀');
  assert.ok(slot1.gain > slot0.gain);
});

test('功法装备在非生效槽：吸收仍 +0；切到该槽后才生效', async () => {
  const app = createMemoryApp();
  await app.create('沈青');

  const resolved = await app.resolveEvent(eventById('lianqi-01'), 0);
  const equipped = await app.equipTechnique(1, resolved.granted[0].uid);
  assert.equal(equipped.techniques[1], 'qingmu');
  assert.equal(equipped.activeSlot, 0, '装备不改生效槽');

  const blocked = await app.absorb();
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.gain, 0);
  // 事件给过 +8；无功法吸收不再增加。
  assert.equal(blocked.character.cultivation, 8);

  await app.setActiveSlot(1);
  const active = await app.absorb();
  assert.equal(active.blocked, false);
  close(active.gain, 10.626, '切到槽 1 后青木诀生效');
});
