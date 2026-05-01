# 角色属性系统

## 系统架构

角色属性分为三层：基础属性 → 成长修正 → 最终属性。最终属性 = (基础 + 等级成长) × 境界倍率 + 装备加成 + 技能加成 + 奇遇修正。

## 境界体系

| 阶段 | 境界 | 等级要求 | 属性倍率 | 突破材料 |
|------|------|----------|----------|----------|
| 1 | 炼气 | 1 | ×1.0 | — |
| 2 | 筑基 | 10 | ×1.5 | 筑基丹×1 |
| 3 | 金丹 | 25 | ×2.5 | 金丹碎片×3 |
| 4 | 元婴 | 45 | ×4.0 | 元婴果×2 |
| 5 | 化神 | 70 | ×6.5 | 化神莲×1 |
| 6 | 合体 | 100 | ×10.0 | 合体石×3 |
| 7 | 大乘 | 135 | ×16.0 | 大乘灵液×2 |
| 8 | 渡劫 | 175 | ×25.0 | 渡劫丹×1 |
| 9 | 仙人 | 220 | ×40.0 | 仙缘石×5 |

## 核心公式

```
最终属性 = (基础 + 等级 × 成长率) × 境界倍率 + 装备加成 + 技能加成 + 奇遇修正
升级经验 = 等级² × 10
```

成长率：HP=12, MP=5, ATK=2.5, DEF=2, SPD=0.3, CRIT=0.05%, CRIT_DMG=0.2%

## TypeScript 类型

```typescript
type Realm =
  | '炼气' | '筑基' | '金丹' | '元婴' | '化神'
  | '合体' | '大乘' | '渡劫' | '仙人';

interface RealmConfig {
  realm: Realm;
  levelReq: number;
  multiplier: number;
  materials: { name: string; count: number }[];
}

interface BaseStats {
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number;    // 0~1
  critDmg: number;     // 1.0+，即 150% = 1.5
}

interface GrowthRates {
  hp: number; mp: number; atk: number; def: number;
  spd: number; critRate: number; critDmg: number;
}

interface Character {
  id: string;
  name: string;
  level: number;
  exp: number;
  realm: Realm;
  baseStats: BaseStats;
  growthRates: GrowthRates;
  bonusFromEvents: Partial<BaseStats>;  // 奇遇永久修正
  skillPoint: number;
}

interface RealmConfigMap {
  [key: string]: RealmConfig;
}
```

## 关联系统

- **装备系统**：装备属性加成到最终属性
- **技能系统**：被动技能提供属性加成；境界突破解锁新技能位
- **奇遇系统**：部分事件永久修改 `bonusFromEvents`

## 示例

### 示例1：炼气1级新角色
```json
{ "level": 1, "realm": "炼气", "baseStats": { "hp": 100, "mp": 30, "atk": 10, "def": 5, "spd": 10, "critRate": 0.05, "critDmg": 1.5 } }
```
最终ATK = (10 + 1×2.5) × 1.0 = 12.5

### 示例2：筑基15级
```
ATK = (10 + 15×2.5) × 1.5 = (10 + 37.5) × 1.5 = 71.25
HP = (100 + 15×12) × 1.5 = (100 + 180) × 1.5 = 420
```

### 示例3：金丹30级 + 奇遇+10ATK
```
ATK = (10 + 30×2.5) × 2.5 + 10 = 85 × 2.5 + 10 = 222.5
```
