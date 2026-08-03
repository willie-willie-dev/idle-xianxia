# 角色属性系统

> 版本：v1.1（明确子系统归属）
> 状态：待设计师确认
> 说明：本文档定义角色属性子系统的底层逻辑。**角色系统**包含三个子系统：角色属性子系统（本文档）、装备子系统、修炼子系统。

---

## 一、角色系统架构

```
角色系统
├── 角色属性子系统（本文档）
│   └── 六维/境界/五行/成长公式
├── 装备子系统
│   └── 槽位/品质/强化/套装（详见 02-equipment-system.md）
└── 修炼子系统
    └── 功法/周天/灵气/道种（详见 05-cultivation-system.md）
```

三个子系统**并列**为角色提供最终属性加成，汇总公式见本文档第二节。

---

## 二、角色最终属性公式

角色最终面板由三层乘法与三类加算组成，对应 `calculateFinalStats` 的实现：

1. **基础层**：`baseStats`（创建角色时的基础六维）与 **等级成长** `level × growthRates` 相加，得到 `(base + level×growth)`。
2. **乘法修正层**：再依次乘以 **境界倍率** `REALMS[realm].multiplier` 与 **五行成长倍率** `WUXING_GROWTH[element]` 中对应属性的系数（未列出的属性视为 `1`）。
3. **加算层**：**装备加成** `equipmentBonus`、**技能加成** `skillBonus`、**修炼加成** `cultivationBonus`、**奇遇加成** `bonusFromEvents` 按属性键相加（缺失视为 `0`）。

**总公式（单属性）：**

```
最终属性[key] = (baseStats[key] + level × growthRates[key])
                × realmMultiplier
                × (WUXING_GROWTH[element][key] ?? 1)
                + equipmentBonus[key] + skillBonus[key] + cultivationBonus[key] + bonusFromEvents[key]
```

---

## 三、境界体系

| 阶段 | 境界 | 等级要求 | 属性倍率 | 突破材料 |
|------|------|----------|----------|----------|
| 1 | 炼气 | 1 | ×1.0 | — |
| 2 | 筑基 | 10 | ×1.5 | 筑基丹×1 |
| 3 | 金丹 | 25 | ×2.5 | 金丹碎片×3 |
| 4 | 元婴 | 45 | ×4.0 | 元婴果×2 |
| 5 | 化神 | 70 | ×6.5 | 化神莲×1 |

---

## 四、五行系统

五行类型为 `WuXing`：`metal` | `wood` | `water` | `fire` | `earth`。

| 五行 | 英文键 | 属性成长倍率（仅列出非 1 的项） | 相生哲学 |
|------|--------|----------------------------------|----------|
| 金 | `metal` | `mp` ×1.3，`wil` ×1.1 | 金生水 → 强化法力/神识 |
| 木 | `wood` | `atk` ×1.3，`spd` ×1.1 | 木生火 → 强化攻击/速度 |
| 水 | `water` | `hp` ×1.3，`mp` ×1.1 | 水生木 → 强化生命/法力 |
| 火 | `fire` | `def` ×1.3，`hp` ×1.1 | 火生土 → 强化防御/生命 |
| 土 | `earth` | `atk` ×1.3，`spd` ×1.1 | 土生金 → 强化攻击/速度 |

---

## 五、成长公式与成长率

| 属性键 | 含义 | 默认成长率（每级） |
|--------|------|---------------------|
| `hp` | 生命 | 12 |
| `mp` | 法力 | 5 |
| `atk` | 攻击 | 2.5 |
| `def` | 防御 | 2 |
| `spd` | 速度 | 0.3 |
| `wil` | 神识 | 1.0 |

**初始基础属性**（`createInitialCharacter`）：`hp: 100`，`mp: 30`，`atk: 10`，`def: 5`，`spd: 10`，`wil: 8`。默认五行 `metal`。

---

## 六、核心类型

```typescript
export type Realm = '炼气' | '筑基' | '金丹' | '元婴' | '化神';
export type WuXing = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

export interface Stats {
  hp: number; mp: number; atk: number; def: number; spd: number; wil: number;
}

export type StatKey = keyof Stats;

export interface GrowthRates { hp: number; mp: number; atk: number; def: number; spd: number; wil: number; }

export interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  realm: Realm;
  element: WuXing;
  baseStats: Stats;
  growthRates: GrowthRates;
  bonusFromEvents: Partial<Stats>; // 奇遇永久加成
  skillPoint: number;
  gold: number;
  cultivation: CultivationSlots; // 修炼槽位（见 05-cultivation-system.md）
  equipment: EquippedSlots;       // 装备槽位（见 02-equipment-system.md）
}
```

---

## 七、关联系统

| 系统 | 关联方式 |
|------|----------|
| **装备子系统** | `equipmentBonus` 叠加到最终六维 |
| **修炼子系统** | `cultivationBonus` 叠加到最终六维 |
| **技能系统** | `skillBonus` 叠加；突破后 `skillPoint` 增加 2 |
| **事件系统** | 奇遇奖励写入 `bonusFromEvents` |

---

## 八、升级与突破

- **升级经验**：`expToNextLevel(level) = level² × 10`
- **境界突破**：`breakthrough` 将 `realm` 提升至下一阶，并 `skillPoint += 2`

---

*版本历史：v1.0 初版，v1.1 明确装备/修炼为子系统，加成层增加 cultivationBonus。*
