# 装备系统

## 系统架构

装备是角色的子系统，通过装备槽位绑定到角色，属性直接加成到最终属性计算中。

## 装备槽位

| 槽位 | 说明 |
|------|------|
| weapon | 武器 — 主加攻击 |
| armor | 护甲 — 主加防御/生命 |
| accessory1 | 饰品1 — 暴击/速度等 |
| accessory2 | 饰品2 — 暴击/速度等 |
| artifact | 法宝 — 全属性 |

## 品质分级

| 品质 | 颜色代码 | 附加属性条数 | 掉落权重 |
|------|----------|-------------|----------|
| 凡品 | white | 0 | 50% |
| 良品 | green | 1 | 25% |
| 上品 | blue | 2 | 15% |
| 极品 | purple | 3 | 7% |
| 仙器 | gold | 4 | 2.5% |
| 神器 | red | 4（高值） | 0.5% |

## 核心公式

```
强化后基础属性 = 原始基础属性 × (1 + 强化等级 × 0.10)
掉落品质概率修正 = 基础权重 × (1 + 怪物等级 × 0.01)
装备总属性 = 强化后基础属性 + ∑附加属性
```

## 强化费用

`费用 = 强化等级 × 1000 × 品质系数`（品质系数：凡品1, 良品1.5, 上品2, 极品3, 仙器5, 神器10）

## 套装效果

套装按2件/4件触发：
- 2件套：小加成（如 ATK+10%）
- 4件套：大加成 + 特殊效果

## TypeScript 类型

```typescript
type EquipSlot = 'weapon' | 'armor' | 'accessory1' | 'accessory2' | 'artifact';
type Quality = 'white' | 'green' | 'blue' | 'purple' | 'gold' | 'red';

interface Affix {
  stat: keyof BaseStats;
  value: number;
}

interface EquipBase {
  id: string;
  name: string;
  slot: EquipSlot;
  quality: Quality;
  baseStats: Partial<BaseStats>;
  affixes: Affix[];
  enhanceLevel: number;       // 0~15
  setId?: string;
}

interface SetEffect {
  setId: string;
  name: string;
  pieces2: { description: string; statBonus: Partial<BaseStats> };
  pieces4?: { description: string; statBonus: Partial<BaseStats>; special?: string };
}

interface EquipDropConfig {
  monsterLevelRange: [number, number];
  qualityWeights: Record<Quality, number>;
}
```

## 关联系统

- **角色系统**：装备属性加成到 `最终属性` 的 `装备加成` 部分
- **战斗系统**：战斗胜利触发掉落判定
- **奇遇系统**：机缘事件可直接奖励装备

## 示例

### 示例1：凡品铁剑
```json
{ "name": "铁剑", "slot": "weapon", "quality": "white", "baseStats": { "atk": 15 }, "affixes": [], "enhanceLevel": 0 }
```
总属性：ATK+15

### 示例2：上品玄铁甲 +5
```
基础 DEF=30, 强化后 = 30 × (1 + 5×0.1) = 45
附加属性：HP+200, SPD+5
总属性：DEF+45, HP+200, SPD+5
```

### 示例3：仙器·天雷剑 +12，附带"雷神"套装
```
基础 ATK=80, 强化后 = 80 × 2.2 = 176
附加属性：CRIT+8%, CRIT_DMG+30%, SPD+15, HP+500
总属性：ATK+176, CRIT+0.08, CRIT_DMG+0.30, SPD+15, HP+500
雷神2件套：ATK+15%; 雷神4件套：攻击时20%概率触发雷击(额外50%ATK伤害)
```
