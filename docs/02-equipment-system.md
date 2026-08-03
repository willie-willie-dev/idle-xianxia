# 装备系统

装备通过固定槽位挂在角色上，单件属性由**基础属性**（随强化缩放）、**附加属性（affixes）**（不随强化缩放）组成。汇总逻辑见 `src/systems/equipmentSystem.ts`；静态定义见 `src/types/equipment.ts` 与 `src/data/equipment.ts`。

## 槽位（`EquipSlot`）

| 枚举值 | 含义 |
|--------|------|
| `weapon` | 武器 |
| `armor` | 护甲 |
| `accessory1` | 饰品 1 |
| `accessory2` | 饰品 2 |
| `artifact` | 法宝 |

穿戴结构 `EquippedSlots` 对上述五个键各对应 `EquipBase | null`。

## 品质（`Quality`）

| 枚举 | 中文习惯称呼 | UI 色值（`QUALITY_COLORS`） |
|------|----------------|-----------------------------|
| `white` | 凡品 | `#c8ccd4` |
| `green` | 良品 | `#81c784` |
| `blue` | 上品 | `#64b5f6` |
| `purple` | 极品 | `#ce93d8` |
| `gold` | 仙器 | `#d4a843` |
| `red` | 神器 | `#e57373` |

品质全序：`QUALITY_ORDER = ['white','green','blue','purple','gold','red']`。

**掉落权重**（`QUALITY_WEIGHTS`，相对权重，非百分比）：

| white | green | blue | purple | gold | red |
|------:|------:|-----:|-------:|-----:|----:|
| 50 | 25 | 15 | 7 | 2.5 | 0.5 |

掉落掷骰（`rollDrop`）时，每个品质的有效权重为  
`QUALITY_WEIGHTS[q] * (1 + monsterLevel * 0.01)`，再在同级装备池 `EQUIPMENT_DATA.filter(e => e.quality === chosen)` 中随机其一；新掉落会重置 `enhanceLevel` 为 `0` 并生成唯一 `id`。

**品质系数**（`QUALITY_MULTIPLIER`，用于强化费用）：

| white | green | blue | purple | gold | red |
|------:|------:|-----:|-------:|-----:|----:|
| 1 | 1.5 | 2 | 3 | 5 | 10 |

> 说明：代码未按品质限制 affix 条数，条数由策划在 `EQUIPMENT_DATA` 中逐件配置。

## 强化

- **缩放对象**：仅 `baseStats` 中的每一项。
- **公式**：对每个基础属性键 `k`，  
  `enhanced[k] = baseStats[k] * (1 + enhanceLevel * 0.10)`  
  即「原始基础属性 ×（1 + 强化等级 × 0.10）」。
- **附加属性**：`affixes` 中每条 `{ stat, value }` 以**固定数值**累加到对应键上，**不参与**上述强化倍率。

单件总属性由 `getEnhancedStats` 计算；多槽合计由 `getTotalEquipmentBonus` 对各件 `getEnhancedStats` 结果按 Stat 键相加。

### 强化费用

`equipmentSystem.enhanceCost(equip)`：

\[
\text{费用} = \texttt{enhanceLevel} \times 1000 \times \texttt{QUALITY_MULTIPLIER[quality]}
\]

（即从当前等级强化到下一级所需金币，与品质系数挂钩。）

> **实现差异**：`gameStore.enhanceItem` 当前扣费为 `item.enhanceLevel * 1000`，未乘品质系数；而 `EquipmentBag` 展示的费用来自 `enhanceCost`。若以系统设计为准，后续应将 store 扣费与 `enhanceCost` 对齐。

## 附加属性（`Affix`）

每条 affix 为 `{ stat: StatKey, value: number }`，其中 `StatKey` 为 `Stats` 的键：`hp` | `mp` | `atk` | `def` | `spd` | `wil`。`value` 可为负（如速度惩罚）。

## 套装效果（`SET_EFFECTS`）

数据侧只配置了一套 **`setId: 'thunder-god'`**（名称「雷神」）。当前 `EQUIPMENT_DATA` 中带该 `setId` 的仅有 **`tianlei-sword`（天雷剑）**。

| 件数 | `description`（数据内文案） | `statBonus`（代码中的数值字段） | 其他 |
|------|------------------------------|-----------------------------------|------|
| 2 | `ATK+15%` | `{ atk: 30 }` | — |
| 4 | `攻击时20%概率触发雷击` | `{ atk: 60 }` | `special: '雷击'` |

`SetEffect` 类型：

- `setId`, `name`
- `pieces2`: `{ description, statBonus: Partial<Stats> }`
- `pieces4?`: `{ description, statBonus: Partial<Stats>; special?: string }`

> **实现说明**：`SET_EFFECTS` 已定义，但 `getTotalEquipmentBonus` **尚未**根据已装备件数读取该表叠加套装加成；套装逻辑需在后续接入总属性或战斗结算。

## TypeScript 类型（与 `src/types/equipment.ts` 一致）

下列类型依赖 `./character` 中的 `Stats` 与 `StatKey`。

```typescript
import type { Stats, StatKey } from './character';

export type EquipSlot = 'weapon' | 'armor' | 'accessory1' | 'accessory2' | 'artifact';
export type Quality = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red';

export interface Affix {
  stat: StatKey;
  value: number;
}

export interface EquipBase {
  id: string;
  name: string;
  slot: EquipSlot;
  quality: Quality;
  baseStats: Partial<Stats>;
  affixes: Affix[];
  enhanceLevel: number;
  setId?: string;
}

export interface SetEffect {
  setId: string;
  name: string;
  pieces2: { description: string; statBonus: Partial<Stats> };
  pieces4?: { description: string; statBonus: Partial<Stats>; special?: string };
}

export interface EquippedSlots {
  weapon: EquipBase | null;
  armor: EquipBase | null;
  accessory1: EquipBase | null;
  accessory2: EquipBase | null;
  artifact: EquipBase | null;
}
```

`Stats`（供 `baseStats` / `statBonus` 引用）：

```typescript
export interface Stats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  wil: number;
}
```

## `EQUIPMENT_DATA` 数据示例

与 `src/data/equipment.ts` 中条目一致（`enhanceLevel` 默认 `0`）。

| id | name | slot | quality | baseStats | affixes | setId |
|----|------|------|---------|-----------|---------|--------|
| `iron-sword` | 铁剑 | weapon | white | atk 15 | — | — |
| `cloth-armor` | 布甲 | armor | white | def 8, hp 30 | — | — |
| `green-blade` | 青锋剑 | weapon | green | atk 25 | spd +3 | — |
| `xuantie-armor` | 玄铁甲 | armor | blue | def 30, hp 80 | def +5, spd −2 | — |
| `zidian-bracer` | 紫电护腕 | accessory1 | purple | atk 12, spd 8 | wil +10, atk +5 | — |
| `tianlei-sword` | 天雷剑 | weapon | gold | atk 80 | wil +20, spd +15, hp +500 | `thunder-god` |
| `jade-pendant` | 玉佩 | accessory2 | green | hp 40, mp 20 | def +3 | — |
| `hunyuan-seal` | 混元印 | artifact | red | atk 50, def 40, hp 300, mp 100, spd 10 | wil +30, atk +20, def +15 | — |

### 计算示例：玄铁甲 +5

- 强化倍率 `1 + 5 × 0.10 = 1.5`  
- 基础：`def 30 × 1.5 = 45`，`hp 80 × 1.5 = 120`  
- affix（不缩放）：`def +5`，`spd −2`  
- **合计**：def `45 + 5 = 50`，hp `120`，spd `−2`

### 计算示例：天雷剑 +0（仅单件，无套装加成进汇总）

- 基础：atk `80`  
- affix：wil +20，spd +15，hp +500  
- **合计**：atk 80，wil 20，spd 15，hp 500（套装表见上文，尚未接入总属性）

## 关联代码路径

| 内容 | 位置 |
|------|------|
| 类型定义 | `src/types/equipment.ts` |
| 装备表 / 套装表 / 品质常量 | `src/data/equipment.ts` |
| 强化数值、费用、掉落 | `src/systems/equipmentSystem.ts` |
| 穿戴与强化（金币） | `src/store/gameStore.ts` |
