import assert from 'node:assert/strict';
import { test } from 'node:test';

import { absorb } from './absorb.ts';
import type { Location, Roots, Technique } from './absorb.ts';

/** 浮点比较容差，按需求使用 ±0.01。 */
const TOLERANCE = 0.01;

const ROOTS: Roots = {
  fire: 30,
  water: 0,
  wood: 0,
  metal: 0,
  earth: 0,
  qian: 50,
  kun: 20,
};

const TECHNIQUE: Technique = { absorbRate: 0.4, convertRate: 0.3 };

function assertClose(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= TOLERANCE,
    `${label}：期望 ${expected}（±${TOLERANCE}），实际 ${actual}`,
  );
}

test('火山：火/土灵气按灵根与乾/坤通道入池', () => {
  const volcano: Location = {
    id: 'volcano',
    name: '火山',
    spirits: [
      { type: '火', amount: 200 },
      { type: '土', amount: 30 },
    ],
  };

  const result = absorb(volcano, ROOTS, TECHNIQUE);

  // 原始入池总和 237.1；乘以 absorbRate 0.4 与 convertRate 0.3。
  assertClose(result.totalAbsorbed, 94.84, 'totalAbsorbed');
  assertClose(result.cultivationGain, 28.45, 'cultivationGain');
});

test('灵泉：水/木灵气按灵根与乾/坤通道入池', () => {
  const spring: Location = {
    id: 'spirit-spring',
    name: '灵泉',
    spirits: [
      { type: '水', amount: 200 },
      { type: '木', amount: 50 },
    ],
  };

  const result = absorb(spring, ROOTS, TECHNIQUE);

  // 原始入池总和 192.5；乘以 absorbRate 0.4 与 convertRate 0.3。
  assertClose(result.totalAbsorbed, 77, 'totalAbsorbed');
  assertClose(result.cultivationGain, 23.1, 'cultivationGain');
});

test('坤通道只乘一次：100 × 0.2 × 0.1 × 0.4 = 0.8', () => {
  const roots: Roots = {
    fire: 0,
    water: 0,
    wood: 0,
    metal: 0,
    earth: 0,
    qian: 0,
    kun: 20,
  };
  const location: Location = {
    id: 'kun-only',
    name: '坤灵地',
    spirits: [{ type: '火', amount: 100 }],
  };

  const result = absorb(location, roots, TECHNIQUE);

  // 若重复乘以 0.1 会得到 0.08。
  assertClose(result.totalAbsorbed, 0.8, 'totalAbsorbed');
  assertClose(result.cultivationGain, 0.24, 'cultivationGain');
});

test('系数可注入：absorbRate 1.0 的 totalAbsorbed 是 0.4 版本的 2.5 倍', () => {
  const location: Location = {
    id: 'volcano',
    name: '火山',
    spirits: [
      { type: '火', amount: 200 },
      { type: '土', amount: 30 },
    ],
  };

  const base = absorb(location, ROOTS, {
    absorbRate: 0.4,
    convertRate: 0.3,
  });
  const doubled = absorb(location, ROOTS, {
    absorbRate: 1,
    convertRate: 0.3,
  });

  assertClose(doubled.totalAbsorbed, base.totalAbsorbed * 2.5, 'totalAbsorbed 比例');
  assertClose(doubled.cultivationGain, base.cultivationGain * 2.5, 'cultivationGain 比例');
});
