/**
 * 时间系统 · 推进服务（单一节拍源）。
 *
 * 语义（v0.2）：
 * - 以「天」为最小单位，`days` 必须是非负整数；
 * - `days = n > 0`：先 `action-start`，再逐天 `day-start` → `day-end`（第 2…n+1 天，
 *   每天先 `day + 1` 再触发），最后 `action-end`；
 * - `days = 0`：只触发一次 `action-start` + `action-end`（突破等不耗天动作）；
 * - 钩子按 `priority` 升序、同优先级按注册顺序；单个钩子抛错被吞掉，不中断推进；
 * - 钩子返回的 `Partial<TimeState>` 只合并 `tick`，`day` 与其他字段一律忽略。
 */

import type { TimeHook, TimeReason, TimeState } from './types.ts';

/** 一次推进的结果。 */
export interface AdvanceResult {
  /** 推进后的新状态（不就地修改入参）。 */
  state: TimeState;
  /** 触发过的钩子 id，按触发顺序，重复触发会重复出现。 */
  fired: string[];
}

export interface TimeService {
  advance(
    state: TimeState,
    days: number,
    reason: TimeReason,
  ): AdvanceResult;
  /** 注册钩子；同 id 覆盖（保留原注册位次）。 */
  register(hook: TimeHook): void;
  unregister(id: string): void;
  /** 按触发顺序（priority 升序、同优先级注册序）列出当前钩子。 */
  list(): TimeHook[];
}

/** 校验天数：非负整数，否则抛错。 */
function assertDays(days: number): void {
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
    throw new Error(`推进天数必须是非负整数（当前 ${String(days)}）`);
  }
}

export function createTimeService(hooks: TimeHook[] = []): TimeService {
  const registry: TimeHook[] = [];

  function register(hook: TimeHook): void {
    const index = registry.findIndex((item) => item.id === hook.id);
    if (index < 0) registry.push(hook);
    else registry[index] = hook;
  }

  function unregister(id: string): void {
    const index = registry.findIndex((item) => item.id === id);
    if (index >= 0) registry.splice(index, 1);
  }

  /** 稳定排序：priority 升序，同优先级保持注册顺序。 */
  function ordered(): TimeHook[] {
    return registry
      .map((hook, index) => ({ hook, index }))
      .sort((a, b) => a.hook.priority - b.hook.priority || a.index - b.index)
      .map((entry) => entry.hook);
  }

  /**
   * 跑一个阶段的钩子，返回合并后的状态。
   * 钩子只拿到只读快照；返回值只认 `tick`。
   */
  function runPhase(
    current: TimeState,
    when: TimeHook['when'],
    reason: TimeReason,
    fired: string[],
  ): TimeState {
    let next = current;
    for (const hook of ordered()) {
      if (hook.when !== when) continue;
      if (hook.reasons !== undefined && !hook.reasons.includes(reason.kind)) {
        continue;
      }
      fired.push(hook.id);
      try {
        const patch = hook.run({ state: Object.freeze({ ...next }), reason });
        if (patch !== undefined && patch !== null && typeof patch === 'object') {
          const tick = patch.tick;
          if (typeof tick === 'number' && Number.isFinite(tick)) {
            next = { ...next, tick };
          }
        }
      } catch {
        // 单个钩子的错误不能中断时间推进。
      }
    }
    return next;
  }

  function advance(
    state: TimeState,
    days: number,
    reason: TimeReason,
  ): AdvanceResult {
    assertDays(days);
    const fired: string[] = [];
    let current: TimeState = { day: state.day, tick: state.tick };

    current = runPhase(current, 'action-start', reason, fired);
    for (let i = 0; i < days; i += 1) {
      current = { day: current.day + 1, tick: current.tick + 1 };
      current = runPhase(current, 'day-start', reason, fired);
      current = runPhase(current, 'day-end', reason, fired);
    }
    current = runPhase(current, 'action-end', reason, fired);

    return { state: current, fired };
  }

  for (const hook of hooks) register(hook);

  return {
    advance,
    register,
    unregister,
    list: ordered,
  };
}
