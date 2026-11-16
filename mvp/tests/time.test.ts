import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTimeService } from '../src/time/time-service.ts';
import type { TimeHook, TimeState } from '../src/time/types.ts';

const START: TimeState = { day: 1, tick: 0 };

/** 只记录触发次数的钩子。 */
function probe(
  id: string,
  when: TimeHook['when'],
  priority = 100,
  seen: string[] = [],
): TimeHook {
  return {
    id,
    title: id,
    when,
    priority,
    run() {
      seen.push(id);
    },
  };
}

test('days=0：只触发一次 action-start + action-end，不动 day/tick', () => {
  const fired: string[] = [];
  const service = createTimeService([
    probe('as', 'action-start', 10, fired),
    probe('ae', 'action-end', 10, fired),
    probe('ds', 'day-start', 10, fired),
    probe('de', 'day-end', 10, fired),
  ]);

  const result = service.advance(START, 0, { kind: 'breakthrough' });

  assert.deepEqual(fired, ['as', 'ae']);
  assert.deepEqual(result.state, { day: 1, tick: 0 });
  assert.deepEqual(result.fired, ['as', 'ae']);
});

test('days=1：day 2、tick 1，day-start / day-end 各一次', () => {
  const fired: string[] = [];
  const service = createTimeService([
    probe('as', 'action-start', 10, fired),
    probe('ds', 'day-start', 10, fired),
    probe('de', 'day-end', 10, fired),
    probe('ae', 'action-end', 10, fired),
  ]);

  const result = service.advance(START, 1, { kind: 'absorb' });

  assert.deepEqual(result.state, { day: 2, tick: 1 });
  assert.deepEqual(result.fired, ['as', 'ds', 'de', 'ae']);
  assert.deepEqual(fired, ['as', 'ds', 'de', 'ae']);
});

test('days=3：对第 2、3、4 天依次触发 day-start / day-end', () => {
  const days: number[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const hook: TimeHook = {
    id: 'daily',
    title: '每日',
    when: 'day-start',
    priority: 10,
    run({ state }) {
      starts.push(state.day);
    },
  };
  const hookEnd: TimeHook = {
    id: 'daily-end',
    title: '每日结束',
    when: 'day-end',
    priority: 10,
    run({ state }) {
      ends.push(state.day);
    },
  };
  const service = createTimeService([
    hook,
    hookEnd,
    {
      id: 'watch',
      title: '观察',
      when: 'action-end',
      priority: 10,
      run({ state }) {
        days.push(state.day);
      },
    },
  ]);

  const result = service.advance(START, 3, { kind: 'event' });

  assert.deepEqual(starts, [2, 3, 4]);
  assert.deepEqual(ends, [2, 3, 4]);
  assert.deepEqual(days, [4]);
  assert.deepEqual(result.state, { day: 4, tick: 3 });
});

test('tick 累加；入参不被就地修改', () => {
  const state: TimeState = { day: 1, tick: 0 };
  const service = createTimeService();

  const first = service.advance(state, 2, { kind: 'absorb' });
  assert.deepEqual(first.state, { day: 3, tick: 2 });
  assert.deepEqual(state, { day: 1, tick: 0 });

  const second = service.advance(first.state, 1, { kind: 'absorb' });
  assert.deepEqual(second.state, { day: 4, tick: 3 });
  assert.deepEqual(first.state, { day: 3, tick: 2 });
});

test('钩子顺序：priority 升序，同优先级按注册顺序', () => {
  const order: string[] = [];
  const service = createTimeService([
    probe('c', 'day-end', 10, order),
    probe('a', 'day-end', 5, order),
    probe('b', 'day-end', 5, order),
  ]);

  service.advance(START, 1, { kind: 'absorb' });

  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(
    service.list().map((hook) => hook.id),
    ['a', 'b', 'c'],
  );
});

test('单个钩子抛错不中断：后续钩子与时间推进照常', () => {
  const order: string[] = [];
  const service = createTimeService([
    {
      id: 'boom',
      title: '会炸',
      when: 'day-start',
      priority: 1,
      run() {
        throw new Error('boom');
      },
    },
    probe('after', 'day-start', 2, order),
  ]);

  const result = service.advance(START, 1, { kind: 'absorb' });

  assert.deepEqual(result.state, { day: 2, tick: 1 });
  assert.deepEqual(order, ['after']);
  assert.deepEqual(result.fired, ['boom', 'after']);
});

test('钩子改 day 被忽略，只合并 tick', () => {
  const service = createTimeService([
    {
      id: 'greedy',
      title: '越界',
      when: 'day-end',
      priority: 10,
      run() {
        return { day: 99, tick: 42 } as Partial<TimeState>;
      },
    },
  ]);

  const result = service.advance(START, 1, { kind: 'absorb' });

  assert.equal(result.state.day, 2);
  assert.equal(result.state.tick, 42);
  assert.equal(
    (result.state as unknown as { day?: number }).day,
    2,
  );
});

test('reasons 过滤：只跑匹配 kind 的钩子', () => {
  const fired: string[] = [];
  const service = createTimeService([
    { ...probe('absorb-only', 'day-start', 10, fired), reasons: ['absorb'] },
    probe('all', 'day-start', 20, fired),
  ]);

  const event = service.advance(START, 1, { kind: 'event' });
  assert.deepEqual(event.fired, ['all']);

  const absorb = service.advance(event.state, 1, { kind: 'absorb' });
  assert.deepEqual(absorb.fired, ['absorb-only', 'all']);
});

test('非法 days 抛错：负数 / 小数 / NaN', () => {
  const service = createTimeService();
  for (const days of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => service.advance(START, days, { kind: 'manual' }),
      /推进天数必须是非负整数/,
    );
  }
});

test('register 同 id 覆盖、unregister 移除', () => {
  const fired: string[] = [];
  const service = createTimeService();
  service.register(probe('h', 'day-start', 10, fired));
  service.register({ ...probe('h', 'day-start', 10, fired), title: '覆盖后' });

  assert.equal(service.list().length, 1);
  assert.equal(service.list()[0].title, '覆盖后');

  service.advance(START, 1, { kind: 'absorb' });
  assert.deepEqual(fired, ['h']);

  service.unregister('h');
  assert.deepEqual(service.list(), []);
  service.advance(START, 1, { kind: 'absorb' });
  assert.deepEqual(fired, ['h']);
});
