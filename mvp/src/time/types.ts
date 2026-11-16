/**
 * 时间系统 · 类型（v0.2：day 为最小单位，不引入时辰/phase）。
 *
 * 这一层只有类型与最基础的结构，不 import 任何其他模块，保证时间系统可以
 * 独立测试、独立演进。
 */

/** 时间状态（入存档）。 */
export interface TimeState {
  /** 第几天，从 1 开始。 */
  day: number;
  /** 累计推进天数（默认 = day - 1，但独立存，便于未来加速/减速）。 */
  tick: number;
}

/** 为什么推进时间。 */
export type TimeReasonKind =
  | 'absorb'
  | 'event'
  | 'breakthrough'
  | 'idle'
  | 'manual';

/** 一次时间推进的原因；`label` 只用于日志/调试。 */
export interface TimeReason {
  kind: TimeReasonKind;
  label?: string;
}

/** 钩子触发时机。 */
export type TimeHookWhen =
  | 'day-start'
  | 'day-end'
  | 'action-start'
  | 'action-end';

/** 时间钩子：只读上下文 → 返回可选补丁。 */
export interface TimeHook {
  /** 唯一 id，如 'daily-log'。 */
  id: string;
  /** 面板/日志显示的中文名。 */
  title: string;
  /** 何时触发。 */
  when: TimeHookWhen;
  /** 小者先跑；同优先级按注册顺序。 */
  priority: number;
  /** 只在某些 reason 下跑，省略 = 全部。 */
  reasons?: TimeReasonKind[];
  /** 只能通过返回值改时间，不能就地改 `ctx.state`。 */
  run(ctx: {
    state: Readonly<TimeState>;
    reason: TimeReason;
  }): Partial<TimeState> | void;
}
