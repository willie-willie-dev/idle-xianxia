# 事件链模板设计 - 设计师指南

> 版本：v0.1
> 状态：等待设计师填充内容
> 关联项目：登仙 Idle Xianxia

---

## 一、概述

事件链是玩家点击「下一回合」后触发的随机事件。目前定义了 4 种事件类型 + 1 种战斗类型：

| 类型 | 英文键 | 说明 |
|------|--------|------|
| 奇遇 | `fortune` | 低风险/中收益 |
| 机缘 | `opportunity` | 中风险/中收益 |
| 抉择 | `choice` | 无战斗但有取舍 |
| 危机 | `crisis` | 高风险/高收益 |
| 战斗 | `combat` | 直接触发战斗 |

每种事件需要设计一个「最基本模板」——即最简单的版本，仅包含最核心的反馈内容。

---

## 二、通用基础规则

### 2.1 灵气返还机制

所有事件的基础回报都是**灵气**，格式如下：

```typescript
interface SpiritReward {
  qian?: number;   // 乾白灵气
  kun?: number;    // 坤黑灵气
  fire?: number;   // 火灵气
  water?: number;  // 水灵气
  wood?: number;   // 木灵气
  metal?: number;  // 金灵气
  earth?: number;  // 土灵气
}
```

**随机范围原则：**
- 奇遇：主要奖励 1 种灵气，随机 8~15 点
- 机缘：主要奖励 1 种灵气，随机 10~20 点
- 抉择：多系少量，随机 3~8 点/系
- 危机：主要奖励 1 种灵气，随机 15~30 点

### 2.2 灵气超限处理

若灵气超过上限，**溢出部分损失**（不等价转化），不积累到下个回合。

---

## 三、各事件类型模板

### 3.1 奇遇（fortune）

**设计原则：** 低风险，探索类，奖励以灵气为主，可附带随机物品/装备

**最基本模板字段：**

```yaml
id: fortune_basic_01
title: "[待设计师填写]"           # 事件标题
description: "[待设计师填写]"    # 事件描述文字
type: fortune
realmRange: [练气初期, 化神后期]  # 通用所有境界
weight: 10                        # 出现权重

options:
  - text: "[待设计师填写]"        # 选项 A 描述
    resultText: "[待设计师填写]"  # 选项 A 结果描述
    reward:
      spiritReward:
        fire: 12                   # 举例：随机 8~15 点火灵气
      # 以下可选
      expBonus: 50
      goldBonus: 30
      equipment: null              # 空装备（占位）
      item: null                   # 空物品（占位）

  - text: "[待设计师填写]"        # 选项 B
    resultText: "[待设计师填写]"
    reward:
      spiritReward:
        metal: 10
      expBonus: 40

  - text: "[待设计师填写]"        # 选项 C（简单路过）
    resultText: "[待设计师填写]"
    reward:
      spiritReward:
        wood: 8
```

**设计师需要提供的：**
- [ ] 标题（建议 4~8 字，仙侠风格）
- [ ] 描述（建议 1~2 句话）
- [ ] 3 个选项的文案（每个选项对应不同灵气类型）
- [ ] 每个选项的灵气类型 + 随机范围

**示例参考（设计师可参考以下风格）：**

```
标题：灵药秘境
描述：前方发现一处隐秘灵药园，灵气浓郁。
选项A：采摘火系灵药 → 火灵气+12, exp+50
选项B：探索金属矿脉 → 金属灵气+10, gold+30
选项C：观望离开 → 木灵气+8
```

---

### 3.2 机缘（opportunity）

**设计原则：** 中等风险，通常需要玩家做出选择，可能附带中等价值物品

**最基本模板字段：**

```yaml
id: opportunity_basic_01
title: "[待设计师填写]"
description: "[待设计师填写]"
type: opportunity
realmRange: [练气初期, 化神后期]
weight: 8

options:
  - text: "[待设计师填写]"
    resultText: "[待设计师填写]"
    reward:
      spiritReward:
        water: 15                 # 随机 10~20 点水灵气
      expBonus: 80

  - text: "[待设计师填写]"
    resultText: "[待设计师填写]"
    reward:
      spiritReward:
        earth: 18
      item: null                  # 空物品
```

**设计师需要提供的：**
- [ ] 标题
- [ ] 描述
- [ ] 2 个选项的文案
- [ ] 每个选项的灵气类型 + 随机范围（10~20）

---

### 3.3 抉择（choice）

**设计原则：** 无战斗，纯粹选择，选择本身即收益，奖励多系少量

**最基本模板字段：**

```yaml
id: choice_basic_01
title: "[待设计师填写]"
description: "[待设计师填写]"
type: choice
realmRange: [练气初期, 化神后期]
weight: 6

options:
  - text: "[待设计师填写]"
    resultText: "[待设计师填写]"
    reward:
      spiritReward:              # 多系少量，3~8 点/系
        fire: 5
        metal: 5
        wood: 5
      expBonus: 30

  - text: "[待设计师填写]"
    resultText: "[待设计师填写]"
    reward:
      spiritReward:
        water: 6
        earth: 6
      goldBonus: 50
```

**设计师需要提供的：**
- [ ] 标题（建议与人生选择、机缘相关）
- [ ] 描述
- [ ] 2 个选项的文案
- [ ] 每个选项的多系灵气组合（3~8 点/系）

---

### 3.4 危机（crisis）

**设计原则：** 高风险，可能掉血或损失属性，但回报也高

**最基本模板字段：**

```yaml
id: crisis_basic_01
title: "[待设计师填写]"
description: "[待设计师填写]"
type: crisis
realmRange: [练气初期, 化神后期]
weight: 4

options:
  - text: "[待设计师填写]"
    resultText: "[待设计师填写]"
    reward:
      spiritReward:
        fire: 25                  # 高量灵气 15~30
      expBonus: 150
    risk:                        # 可选，风险描述
      hpLoss: 50                 # 损失生命

  - text: "[待设计师填写]"
    resultText: "[待设计师填写]"
    reward:
      spiritReward:
        metal: 20
      equipment: null            # 空装备
    risk:
      hpLoss: 30
```

**设计师需要提供的：**
- [ ] 标题
- [ ] 描述
- [ ] 2 个选项的文案
- [ ] 每个选项的灵气类型 + 随机范围（15~30）
- [ ] 每个选项的风险（hpLoss）

---

### 3.5 战斗（combat）

**设计原则：** 直接触发战斗，战斗本身不设计（暂跳过），但**战斗结果**需要设计基础模板

**战斗结果基础模板（设计师填写）：**

```yaml
combat_result:
  victory:
    spiritReward:
      fire: 10                    # 少量灵气，随机 5~15
    expBonus: 100
    goldBonus: 50
    drop:
      item: null                   # 空物品
      equipment: null              # 空装备

  defeat:
    # 失败不掉落任何东西，保留 1HP
    spiritReward: null
    expBonus: 0
    goldBonus: 0
    drop: null
```

**设计师需要提供的（战斗结果）：**
- [ ] 胜利时灵气类型 + 随机范围（5~15）
- [ ] 胜利时经验奖励
- [ ] 胜利时金币奖励
- [ ] 胜利时掉落的空物品（占位符）
- [ ] 胜利时掉落的空装备（占位符）

---

## 四、设计师产出要求

请设计师为每个事件类型设计 **3~5 个** 基础模板（奇遇可更多），覆盖不同灵气类型组合。

### 产出文件

```
docs/events/
  fortune_templates.md      # 奇遇模板（3~5 个）
  opportunity_templates.md  # 机缘模板（3 个）
  choice_templates.md       # 抉择模板（3 个）
  crisis_templates.md       # 危机模板（3 个）
  combat_results.md         # 战斗结果模板（1 个通用版）
```

### 每个模板的固定格式

```yaml
id: <type>_<number>
title: <标题，4~8字>
description: <描述，1~2句话>
type: <fortune|opportunity|choice|crisis|combat>
realmRange: [练气初期, 化神后期]
weight: <1~10，数字越大出现概率越高>

options:
  - text: <选项描述>
    resultText: <结果描述>
    reward:
      spiritReward:
        <灵气键>: <随机范围下限>
      # 其他 reward 字段可选
    risk:                       # 可选
      hpLoss: <数值>
```

---

## 五、占位符说明

当前阶段所有「物品」「装备」均用 `null` 占位，不设计具体内容：

- `item: null` → 空物品（设计师可标注预期类型，如「丹药」「材料」）
- `equipment: null` → 空装备（设计师可标注预期类型，如「剑」「护甲」）

---

## 六、示例（设计师参考风格）

### 奇遇示例

```yaml
id: fortune_temple_01
title: 古修洞府
description: 意外发现一座残留灵气的前人洞府。
type: fortune
realmRange: [练气初期, 化神后期]
weight: 10

options:
  - text: 进入洞府深处探查
    resultText: 在石壁上发现了前人留下的修炼心得，灵气涌入门户。
    reward:
      spiritReward:
        fire: 12
      expBonus: 50
      equipment: null

  - text: 在洞府外围搜索
    resultText: 外围残留些许灵气结晶，被你悉数收入囊中。
    reward:
      spiritReward:
        metal: 10

  - text: 谨慎离开
    resultText: 不愿冒险，悄然离去，仅吸收到弥散的少量灵气。
    reward:
      spiritReward:
        wood: 6
```

### 危机示例

```yaml
id: crisis_beast_01
title: 妖兽伏击
description: 幽暗密林中突然窜出一头妖兽，气势汹汹。
type: crisis
realmRange: [练气初期, 化神后期]
weight: 4

options:
  - text: 正面迎击
    resultText: 一番激战，妖兽被斩，获得灵气灌注。
    reward:
      spiritReward:
        fire: 25
      expBonus: 150
    risk:
      hpLoss: 50

  - text: 且战且退
    resultText: 利用地形且战且退，消耗较少，但也错失良机。
    reward:
      spiritReward:
        earth: 15
    risk:
      hpLoss: 20
```

---

## 七、下一步

1. 设计师按上述格式产出各类型模板文档
2. 产出后交给开发者录入 `src/data/events/` 目录
3. 后续扩展：物品系统、装备系统具体化

---

_文档版本：v0.1 | 待设计师填充内容_