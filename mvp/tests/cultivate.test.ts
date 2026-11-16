import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_ROOTS,
  REALM_THRESHOLDS,
  START_TECHNIQUE,
} from '../src/data/balance.ts';
import {
  DEFAULT_LOCATION_ID,
  LOCATIONS,
  SPIRIT_SPRING,
  VOLCANO,
  findLocation,
} from '../src/data/locations.ts';
import { absorb } from '../src/systems/absorb.ts';
import type { AbsorbResult } from '../src/systems/absorb.ts';
import { cultivate } from '../src/systems/cultivate.ts';

const EPS = 1e-9;

function close(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= EPS,
    `${label}：期望 ${expected}，实际 ${actual}`,
  );
}

test('cultivate：火山 + 默认灵根 ≈ 10.6 修为/次', () => {
  const absorption = absorb(VOLCANO, DEFAULT_ROOTS, START_TECHNIQUE);
  // 200×0.15 + 30×0.15 + 230×0.15×1.5 + 230×0.10×0.1 = 88.55
  close(absorption.totalAbsorbed, 88.55 * 0.4, 'totalAbsorbed');
  close(absorption.cultivationGain, 88.55 * 0.4 * 0.3, 'cultivationGain → 10.626');
  close(cultivate(absorption).cultivationGain, 10.626, 'cultivate 产出');
});

test('cultivate：灵泉 + 默认灵根 = 11.55 修为/次', () => {
  const absorption = absorb(SPIRIT_SPRING, DEFAULT_ROOTS, START_TECHNIQUE);
  // 200×0.15 + 50×0.15 + 250×0.15×1.5 + 250×0.10×0.1 = 96.25
  close(absorption.totalAbsorbed, 96.25 * 0.4, 'totalAbsorbed');
  close(cultivate(absorption).cultivationGain, 11.55, 'cultivate 产出');
});

test('cultivate：原样透传 absorb 的 cultivationGain（不二次换算）', () => {
  for (const location of LOCATIONS) {
    const absorption = absorb(location, DEFAULT_ROOTS, START_TECHNIQUE);
    assert.equal(cultivate(absorption).cultivationGain, absorption.cultivationGain);
  }
});

test('cultivate：不返回负数 / NaN', () => {
  const negative: AbsorbResult = {
    absorbed: {},
    totalAbsorbed: -10,
    cultivationGain: -10,
  };
  assert.equal(cultivate(negative).cultivationGain, 0);

  const broken = {
    absorbed: {},
    totalAbsorbed: Number.NaN,
    cultivationGain: Number.NaN,
  };
  assert.equal(cultivate(broken).cultivationGain, 0);
});

test('节奏验算：约 10 次吸收攒满筑基阈值 100', () => {
  const perTurn = cultivate(absorb(VOLCANO, DEFAULT_ROOTS, START_TECHNIQUE))
    .cultivationGain;
  const threshold = REALM_THRESHOLDS['筑基'];
  assert.ok(perTurn * 9 < threshold, `9 次应不到 ${threshold}`);
  assert.ok(perTurn * 10 >= threshold, `10 次应超过 ${threshold}`);
});

test('locations：两条灵地与 id 查找', () => {
  assert.equal(LOCATIONS.length, 2);
  assert.deepEqual(
    LOCATIONS.map((location) => location.name),
    ['火山', '灵泉'],
  );
  assert.equal(findLocation(DEFAULT_LOCATION_ID), VOLCANO);
  assert.equal(findLocation('spirit-spring'), SPIRIT_SPRING);
  // 未知 id 回落到缺省灵地
  assert.equal(findLocation('nowhere'), VOLCANO);
  assert.equal(findLocation(undefined), VOLCANO);
});
