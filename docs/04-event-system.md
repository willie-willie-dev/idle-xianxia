# 事件系统（含奇遇、维度框架、时间系统）

> 版本：v2.0（整合奇遇子系统、事件维度框架、时间系统）
> 状态：待设计师确认
> 说明：本系统为事件系统的完整设计，包含事件触发结算、奇遇模板、事件维度框架（战斗/人际/奇遇分类）、五行性格映射、以及时间消耗机制。原 `opportunity_templates.md`、`08-event-dimension-framework.md`、`06-time-system.md` 已并入本文档。

---

## 一、系统架构

```
事件系统
├── 事件子系统
│   ├── 事件触发与结算
│   ├── 事件维度框架（战斗/人际/奇遇分类 + 五行性格映射）
│   └── 奇遇子系统（机缘类事件模板）
└── 时间子系统（事件时间消耗、游戏内时间推进）
```

---

## 二、类型定义

```typescript
// 核心类型
export type EventType = '奇遇' | '机缘' | '抉择' | '危机';
export type EventCategory = 'battle' | 'social' | 'fortune'; // 事件维度分类

export interface EventReward {
  statBonus?: Partial<Stats>;
  expBonus?: number;
  goldBonus?: number;
  equipment?: EquipBase;
  spiritReward?: Partial<Record<SpiritRootKey, number>>;
  relationBonus?: RelationChange;
  reputationBonus?: number;
  followUpEventId?: string;
}

export interface EventOption {
  text: string;
  resultText: string;
  reward: EventReward;
  condition?: { realm?: Realm; statReq?: Partial<Stats> };
  /** 此选项的时间消耗（天数），优先级高于 event.timeCost */
  timeCost?: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  category: EventCategory;           // 事件维度分类
  realmRange: [Realm, Realm];
  options: EventOption[];
  triggerChance: number;
  oneTime: boolean;
  /** 默认时间消耗（天数），默认1天 */
  timeCost?: number;
}
```

---

## 三、事件三大分类（维度框架）

所有事件归为三大类，涵盖修仙体验的核心维度：

| 类别 | 键 | 核心内容 | 风险特征 |
|------|----|---------|---------|
| **战斗** | `battle` | 与敌对存在的对抗（妖兽、修士、天劫等） | 高风险/高回报 |
| **人际** | `social` | 与人的交互（合作、给予、接受、信任、背叛、传承、学习、感情） | 中风险/关系导向 |
| **奇遇** | `fortune` | 与事件/环境的交互（探索、发现、机缘） | 低~中风险/机遇导向 |

### 3.1 战斗类（battle）

**行动选项维度：**
- 战/逃/降
- 全力出手 / 留有余地
- 保护队友 / 独自突进
- 抢夺战利品 / 让给对方
- 追击 / 放走

**收获类型：** 修为(exp)、战利品(gold/装备/材料)、名誉、灵气

**代价/风险：** hp损失、mp消耗、装备损耗、结仇、消耗时间

### 3.2 人际类（social）

**交互类型细分：**

| 类型 | 说明 |
|------|------|
| 合作 | 与他人共同完成某事 |
| 给予 | 主动付出（资源、技能、机会） |
| 接受 | 接受他人的给予 |
| 信任 | 对他人建立信任 |
| 背叛 | 辜负或出卖信任 |
| 传承 | 知识/技能的给予 |
| 学习 | 从他人处获取知识 |
| 感情 | 情感关系的建立/破裂 |

**行动选项维度：** 主动vs被动、利他vs利己、亲近vs疏远、信任vs怀疑

**收获类型：** 人际关系/好感度、情报/知识、资源、功法/技能、声誉、灵气

**代价/风险：** 资源损失、时间成本、情感风险、声誉风险

### 3.3 奇遇类（fortune）

**交互类型细分：**

| 类型 | 说明 |
|------|------|
| 探索 | 主动寻找隐藏内容 |
| 发现 | 被动遇到意外之物 |
| 机缘 | 特殊稀有遭遇 |
| 环境交互 | 与自然/灵气环境互动 |

**行动选项维度：** 深入vs浅尝辄止、主动寻找vs顺其自然、记录/研究vs直接吸收、分享vs独享

---

## 四、关系维度体系（人际类事件专用）

人际事件中的角色关系分为 **6个维度**：

| # | 维度 | 驱动方向 | 典型行为 |
|---|------|----------|---------|
| 1 | **喜爱** | 讨好、亲近 | 主动赠送、主动帮忙、主动亲近 |
| 2 | **厌恶** | 远离 | 拒绝互动、言语冷淡、转身离开 |
| 3 | **仇恨** | 报复 | 主动伤害、落井下石、暗中破坏 |
| 4 | **恐惧** | 威慑 | 屈服顺从、避免冲突、保命优先 |
| 5 | **尊敬** | 听从 | 接受教导、遵循意愿、维护地位 |
| 6 | **赏识** | 认可 | 主动表现、证明价值、争取机会 |

---

## 五、收获/代价的标准化维度

| 维度 | 字段 | 说明 |
|------|------|------|
| 修为 | `expBonus: number` | 经验值 |
| 金币 | `goldBonus: number` | 游戏货币 |
| 灵气 | `spiritReward: SpiritReward` | 五行灵气（7种：乾坤/火/水/木/金/土） |
| 属性 | `statBonus: Partial<Stats>` | 永久属性变化（允许负数） |
| 物品 | `item: ItemBase \| null` | 消耗品/材料 |
| 装备 | `equipment: EquipBase \| null` | 装备 |
| 关系 | `relationBonus: RelationChange` | 人际关系变化 |
| 声誉 | `reputationBonus: number` | 声望变化（正/负） |

---

## 六、事件行为 → 五行性格映射

每个行为触发对应的五行方向偏移（`+`=阳增加，`↓`=阴不增加）：

| 行为 | 性格偏移 |
|------|---------|
| 主动赠送资源 | 木传承+, 土厚德+ |
| 主动帮忙 | 火热血+, 土厚德+ |
| 主动亲近 | 火热血+, 水包容+ |
| 拒绝互动 | 水包容↓, 土厚德↓ |
| 言语冷淡 | 金冷酷+, 水包容↓, 土厚德↓ |
| 主动伤害 | 火贪婪+, 金冷酷+ |
| 落井下石 | 火贪婪+, 金冷酷+ |
| 暗中破坏 | 金冷酷+, 木掌控+ |
| 屈服顺从 | 水包容+, 土厚德+ |
| 避免冲突 | 水包容+, 土厚德+ |
| 保命优先 | 土厚德+ |
| 接受教导 | 木传承+ |
| 遵循意愿 | 金刚毅+, 土厚德+ |
| 维护地位 | 金刚毅+ |
| 主动表现 | 火热血+, 金刚毅+ |
| 证明价值 | 金刚毅+ |
| 争取机会 | 火热血+, 金刚毅+ |

### 五行性格结构（阳/阴独立数值，0~100）

| 五行 | 锚定 | 阳（积极面） | 阴（消极面） |
|------|------|-------------|-------------|
| 火 | 激进 | 热血（积极介入） | 贪婪（掠夺资源） |
| 水 | 交融 | 包容（忠贞接纳） | 纵欲（无度追求） |
| 木 | 繁茂 | 传承（延续珍视之物） | 掌控（控制他人意志） |
| 金 | 坚刚 | 刚毅（坚守道义） | 冷酷（不择手段） |
| 土 | 固守 | 厚德（承载滋养） | 吝啬（过度守护不放） |

---

## 七、时间子系统

### 7.1 游戏内时间

```typescript
interface GameTime {
  epochYear: number;  // 纪元年（2016年=纪元1年）
  month: number;      // 月份（1-12）
  day: number;        // 日期（1-31）
}
```

### 7.2 时间推进规则

| 操作 | 时间消耗 | 说明 |
|------|----------|------|
| 历练（事件选项） | 1~30天 | 由事件/选项定义 |
| 周天运转 | 7天 | 固定（见修炼子系统） |
| 战斗（挂机tick） | 1天/次 | 每 tick 推进1天 |
| 突破境界 | 0天 | 瞬时 |
| 装备强化 | 0天 | 瞬时 |

### 7.3 闰年规则

```
闰年条件：(年份%4==0 且 年份%100!=0) 或 (年份%400==0)
2016→闰 ✓，2020→闰 ✓，2100→不闰，2400→闰 ✓
```

### 7.4 时间推进函数

```typescript
function advanceDays(time: GameTime, days: number): GameTime;
function formatGameTime(time: GameTime): string;  // "纪元1年1月1日"
```

### 7.5 事件时间消耗

```typescript
function getOptionTimeCost(event: GameEvent, optionIndex: number): number {
  const option = event.options[optionIndex];
  return option.timeCost ?? event.timeCost ?? 1;
}
```

**UI 显示示例：**
```
┌────────────────────────────────────────┐
│ 🌟 奇遇：山洞探索                        │
│ 你在山间发现了一个神秘山洞...             │
│                                          │
│  [0] 进入探索          ⏱ 10天           │
│  [1] 谨慎离开          ⏱ 1天            │
│  [2] 在洞口观察        ⏱ 3天            │
└────────────────────────────────────────┘
```

### 7.6 顶部状态栏时间显示

```
┌─────────────────────────────────────────────────────────────────────────┐
│  薇漾  ｜  炼气后期  ｜  道种 384/1920  ｜  💰 100  ｜  📅 纪元9年3月15日  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 八、奇遇事件模板（机缘类）

奇遇（原 `opportunity_templates.md`）作为 `EventType.机缘` / `category: fortune` 类型，数据已合并到 `EVENTS_DATA`。

| id | 标题 | 奖励结构 |
|----|------|----------|
| `opportunity_01` | 灵草奇遇 | spiritReward（火+水）+ exp |
| `opportunity_02` | 古墓探险 | spiritReward（土+金）+ gold |
| `opportunity_03` | 秘境悟道 | spiritReward（木+坤黑）+ exp |
| `opportunity_04` | 天赐灵泉 | spiritReward（水+乾白）+ exp |
| `opportunity_05` | 矿脉发掘 | spiritReward（金+火）+ gold |

灵气数值随机范围：**±5点**（下限±5）

**7种灵根类型：** `qian`（乾白）、`kun`（坤黑）、`fire`、`water`、`wood`、`metal`、`earth`

---

## 九、触发机制

| 条件 | 说明 |
|------|------|
| `realmRange` | 角色境界在指定范围内（含两端）时进入候选池 |
| `oneTime` | `true`=触发后永久排除；`false`=可反复触发 |
| `triggerChance` | 候选事件按数组顺序依次独立掷骰，**首个**命中者被选中 |

**调用时机：**
- 挂机 `tickIdle`：每 tick 修炼结算后触发
- 战斗 `doBattle`：战斗结算后触发
- 时间推进后：每次 `advanceDays` 后均检查

---

## 十、关联文件

| 路径 | 作用 |
|------|------|
| `src/types/event.ts` | 事件类型定义 |
| `src/data/events.ts` | EVENTS_DATA（含奇遇模板） |
| `src/systems/eventSystem.ts` | checkEventTrigger |
| `src/systems/timeSystem.ts` | advanceDays / GameTime |
| `src/store/gameStore.ts` | gameTime、triggeredEvents、currentEvent、resolveEvent |
| `src/components/EventModal.tsx` | 事件弹窗 |

---

## 十一、废弃文档

以下文档已并入本文档，内容不再使用：
- `opportunity_templates.md`（奇遇模板已并入 EVENTS_DATA）
- `08-event-dimension-framework.md`（维度框架已并入第三~六章）
- `06-time-system.md`（时间系统已并入第七章）

---

## 十二、待确认事项

| 项目 | 状态 | 说明 |
|------|------|------|
| 默认事件时间消耗 | ⚠️ 待确认 | 建议默认1天 |
| 最大事件时间上限 | ⚠️ 待确认 | 建议上限30天（1个月） |
| idle tick 天数 | ⚠️ 待确认 | 建议1天 |
| 五行性格偏移幅度 | ⚠️ 待细化 | 各行为具体偏移数值 |
| 关系维度 RelationChange 类型 | ⚠️ 待定义 | 6个维度的数值变化结构 |

---

*版本历史：v1.0 初版，v1.1（奇遇并入），v2.0（事件维度框架+时间系统并入）*
