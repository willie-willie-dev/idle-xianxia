# 时间系统 + 钩子设计 v0.2（已定：天为最小单位）

> 代码区文档，不进 `design-docs/`。目标：把「天」从 `app.absorb()` 里抽出来，做成**唯一节拍源**，并在上面挂满扩展点，供后续「事件」「角色」订阅。
>
> **v0.2 已按 W 指示简化：去掉 phase，day 为最小单位。** 落地代码以 `src/time/types.ts` / `src/time/time-service.ts` 为准。

## 1. 现状与问题

现在时间只有三行代码：

| 位置 | 代码 | 问题 |
|---|---|---|
| `balance.ts` | `INITIAL_DAY = 1`、`DAYS_PER_ABSORB = 1` | 常量散落 |
| `app.ts` `absorb()` | `day: character.day + DAYS_PER_ABSORB` | **时间被吸收动作绑死** |
| 其他动作 | 突破/历练/进出角色都不动 `day` | 语义不一致，且无处扩展 |

结论：现在没法回答「第 30 天发生了什么」，因为**没有任何东西订阅时间**。

## 2. 设计目标

1. **单一节拍源**：只有 `TimeService` 能改 `day`，其他系统一律通过 `advance()` 或钩子。
2. **钩子即扩展点**：事件刷新、角色结算、功法运转、离线补偿，全部挂成钩子，核心代码不再为它们加 `if`。
3. **行为可回退**：抽出来之后，MVP 现有表现（吸收 +1 天）**完全不变**。
4. **可测试**：钩子注册/顺序/隔离都能用纯函数单测，不需要浏览器。

## 3. 核心抽象

```ts
/** 时间状态（进存档） */
interface TimeState {
  day: number;          // 第几天，从 1 开始
  tick: number;         // 累计推进次数（= day - 1，但独立存，便于未来加速/减速）
  phase: '晨' | '昼' | '夜';  // 预留：现在恒为 '昼'，不参与计算
}

/** 为什么推进时间 */
type TimeReason =
  | { kind: 'absorb' }                        // 吸收灵气
  | { kind: 'event' }                         // 历练
  | { kind: 'breakthrough' }                  // 突破
  | { kind: 'idle'; seconds: number }         // 挂机/离线（预留）
  | { kind: 'manual'; label: string };        // 手动调试

/** 钩子上下文：只读快照 + 可返回补丁 */
interface TimeContext {
  state: Readonly<TimeState>;
  reason: TimeReason;
  /** 角色只读快照，由 app 注入；时间系统本身不依赖角色模块 */
  character?: Readonly<MvpCharacter>;
}

/** 钩子返回值：要么什么都不改，要么给时间/角色的补丁 */
interface HookResult {
  time?: Partial<TimeState>;
  character?: Partial<MvpCharacter>;
}

interface TimeHook {
  id: string;                 // 唯一，如 'daily-settlement'
  title: string;              // 面板上显示的中文名
  /** 何时触发 */
  when: 'day-start' | 'day-end' | 'action-start' | 'action-end' | 'realm-change';
  priority: number;           // 小者先跑，默认 100
  /** 只在某些 reason 下跑，省略=全部 */
  reasons?: TimeReason['kind'][];
  run(ctx: TimeContext): HookResult | void;
}
```

**三条铁律**

1. 钩子**不能**直接改 `ctx.state`（只读），只能返回补丁，由 `TimeService` 统一合并。
2. 单个钩子抛错**不能**中断时间推进：捕获 → 记日志 → 继续下一个。
3. 钩子按 `priority` 稳定排序；同优先级按注册顺序。

## 4. 钩子清单（这一版先全留空壳）

### A. 时间自身

| 钩子 id | 时机 | 用途 | MVP 实现？ |
|---|---|---|---|
| `day-start` | 每次 advance 的每一天开始 | 每日结算的总入口 | ✅ 只打日志 |
| `day-end` | 每天结束 | 跨日快照、清当日临时状态 | ✅ 只打日志 |
| `action-start` | 吸收/历练/突破前 | 检查前置条件（精力、冷却） | ⬜ 空壳 |
| `action-end` | 动作后 | 事后结算 | ⬜ 空壳 |
| `offline-catchup` | 读档时发现离线 | 离线收益（按秒折算 tick） | ⬜ 空壳 |

### B. 给「事件系统」预留

| 钩子 id | 时机 | 用途 | 备注 |
|---|---|---|---|
| `event-refresh` | 每 N 天（默认 7） | 刷新事件池 / 解锁新事件 | 现在 `doneIds` 永久累积 |
| `event-expire` | 每天 | 未处理的事件过期 | 现在事件不过期 |
| `event-weight` | 抽事件前 | 按天数/境界改权重 | 现在等概率 |

### C. 给「角色系统」预留

| 钩子 id | 时机 | 用途 | 备注 |
|---|---|---|---|
| `daily-cultivation` | 每天 | 每日修为自然增长（挂机收益） | 现在只有主动吸收 |
| `lifespan-decay` | 每天 | 寿元 -1（若引入寿元） | 现在没有寿元 |
| `cap-clamp` | 动作后 | 修为封顶/溢出处理 | 现在 `min(cult, max)` 写死在 app |
| `realm-change` | 突破成功/失败 | 境界变化后广播 | 现在只有 app 内部处理 |

### D. 给「功法循环」预留

| 钩子 id | 时机 | 用途 | 备注 |
|---|---|---|---|
| `technique-cycle` | 每天 | 功法自动运转产出 | 现在只有手动吸收 |
| `spirit-decay` | 每天 | 灵气池衰减（若引入灵气池） | 现在 R1=A 无灵气池 |

> 上表共 **12 个钩子**，MVP 只真正实现 `day-start`、`day-end` 两个「日志型」钩子，用来证明管线通；其余留空壳 + 单测占位。

## 5. 时间服务接口

```ts
interface TimeService {
  /** 读当前时间（只读） */
  state(): Readonly<TimeState>;
  /** 推进 n 天；逐天触发 day-start/day-end，最后触发一次 action-end */
  advance(n: number, reason: TimeReason, character?: MvpCharacter): AdvanceResult;
  /** 注册/注销钩子（幂等：同 id 覆盖） */
  register(hook: TimeHook): void;
  unregister(id: string): void;
  list(): TimeHook[];
}

interface AdvanceResult {
  state: TimeState;
  /** 所有钩子返回的角色补丁按顺序合并后的结果 */
  characterPatch: Partial<MvpCharacter>;
  /** 触发了哪些钩子（调试/日志用） */
  fired: Array<{ id: string; result: HookResult | void; error?: string }>;
}
```

**推进语义**

- `advance(1, {kind:'absorb'})`：`day-start(day=2)` → 合并补丁 → `day-end(day=2)`
- 逐天触发而不是一次性触发，是为了让「每日结算」类钩子能按天累加。
- `advance(0, ...)` 合法：只触发 `action-start/action-end`（用于突破这种「不耗天但需要插钩子」的动作）。

## 6. 与现有代码的接线（改造点）

| 现在 | 改成 |
|---|---|
| `app.absorb()` 里 `day + 1` | `time.advance(1, {kind:'absorb'}, character)` |
| `app.absorb()` 里 `min(cult, max)` | 交给 `cap-clamp` 钩子（空壳期仍是 app 里那行） |
| `app.breakthrough()` | `time.advance(0, {kind:'breakthrough'})` + 发 `realm-change` |
| `app.resolveEvent()` | `time.advance(0, {kind:'event'})`（暂不耗天，见待拍点） |
| 存档 | `MvpCharacter` 加 `time: TimeState`（老档用 `withDefaults` 补 `{day: 现有 day, tick: day-1, phase:'昼'}`） |

## 7. 文件结构

```
mvp/src/time/
├── types.ts          TimeState / TimeReason / TimeHook / HookResult
├── time-service.ts   TimeService 实现（推进、排序、错误隔离、补丁合并）
├── hooks.ts          内置钩子注册表（12 个空壳，逐个标注 TODO）
└── hooks/
    ├── daily-log.ts  ✅ 唯一真正实现的：day-start/day-end 写日志
    └── README.md     新增钩子的模板与约定
```

## 8. 分三步落地（每步都能跑、都能回滚）

| 步骤 | 内容 | 验收 |
|---|---|---|
| **Step 1** | 抽 `TimeService`，行为不变：吸收仍然 +1 天 | 38 单测 + 浏览器流程全绿，`day` 数值与现在完全一致 |
| **Step 2** | 加钩子注册表 + `daily-log` 钩子 + 6 个单测（顺序/隔离/补丁合并） | 日志里能看到 「第 N 天 开始/结束」 |
| **Step 3** | 其余 11 个钩子挂空壳，`hooks.ts` 里一句话 TODO；面板上不加 UI | grep 能看到 12 个 id，全部可注册可注销 |

## 9. 风险

| 风险 | 处理 |
|---|---|
| 钩子乱序导致数值不确定 | priority + 同优先级按注册序，单测固定断言 |
| 某钩子抛错吞掉时间推进 | try/catch 隔离，`fired[].error` 记录 |
| 老存档没有 `time` 字段 | `withDefaults` 兜底迁移 |
| 性能：`advance(365)` 逐天触发 | 先不管；真需要时加「合并模式」（只跑 day-end） |
| 钩子被滥用成"隐式逻辑" | 约定：钩子只做「响应时间」，不发起新动作 |

## 10. 待 W 拍板（4 个）

1. **tick 单位**：~~一天（现在的做法），还是要引入「时辰」四段（晨/昼/暮/夜）？~~ **✅ 已定（v0.2）：以「天」为最小单位，不引入时辰/phase。**
2. **哪些动作推进时间**：只有吸收？还是历练也推进、突破不推进？
3. **要不要离线结算**：关掉页面 8 小时，回来按小时折算挂机收益？
4. **钩子能不能改时间状态**：我倾向「能改但受限」（只允许 `tick`，不许改 `day`），你同意吗？
