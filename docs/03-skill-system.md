# 技能/战斗系统

## 系统架构

技能分为主动、被动、天赋三类。战斗采用回合制自动战斗，根据速度决定出手顺序。

## 技能分类

| 类型 | 说明 | 生效方式 |
|------|------|----------|
| 主动 | 消耗灵力，有冷却 | 战斗中手动/自动施放 |
| 被动 | 永久生效 | 属性加成或条件触发 |
| 天赋 | 角色固有 | 境界突破时解锁/强化 |

## 技能解锁

- 初始：2个主动技能位，1个被动技能位
- 每次境界突破：+1主动位，+1被动位
- 天赋随境界自动解锁
- 技能书可通过掉落/奇遇获得，学习后填入空位

## 战斗流程

```
1. 按SPD排序确定出手顺序
2. 每回合：
   a. 当前角色选择技能（优先CD好且灵力够的最高优先级技能，否则普攻）
   b. 计算伤害/治疗/增益
   c. 判定暴击
   d. 扣血/应用效果
   e. 检查死亡 → 结束或继续
3. 回合结束，CD-1
```

## 核心公式

```
伤害 = max(1, (ATK × 技能倍率 - DEF × 0.5)) × (1 + CRIT_DMG_if_crit) × random(0.9, 1.1)
治疗 = 施法者ATK × 技能倍率 × random(0.9, 1.1)
普攻倍率 = 1.0
技能升级提升 = 基础倍率 + 等级 × 0.1
```

## TypeScript 类型

```typescript
type SkillType = 'active' | 'passive' | 'talent';
type SkillTarget = 'self' | 'enemy' | 'allEnemy' | 'ally';
type EffectType = 'damage' | 'heal' | 'buff' | 'debuff';

interface SkillEffect {
  type: EffectType;
  target: SkillTarget;
  multiplier: number;         // 技能倍率
  buffStat?: keyof BaseStats;
  buffValue?: number;
  buffDuration?: number;      // 回合数
}

interface Skill {
  id: string;
  name: string;
  type: SkillType;
  level: number;
  maxLevel: number;
  mpCost: number;             // 主动技能消耗
  cooldown: number;           // 回合，0=无冷却
  currentCd: number;
  effects: SkillEffect[];
  unlockRealm: string;        // 解锁境界要求
}

interface SkillSlot {
  active: (Skill | null)[];   // 主动技能位
  passive: (Skill | null)[];  // 被动技能位
  talents: Skill[];           // 天赋（自动填满）
}

interface Combatant {
  character: Character;
  currentHp: number;
  currentMp: number;
  buffs: { stat: keyof BaseStats; value: number; turnsLeft: number }[];
  skillSlots: SkillSlot;
}

interface BattleResult {
  victory: boolean;
  turnsUsed: number;
  expGained: number;
  drops: EquipBase[];
}
```

## 关联系统

- **角色系统**：技能位数量由境界决定；被动技能加成到最终属性
- **装备系统**：装备属性影响战斗伤害计算
- **奇遇系统**：可获得技能书

## 示例

### 示例1：主动技能「火球术」
```json
{ "name": "火球术", "type": "active", "mpCost": 10, "cooldown": 0, "effects": [{ "type": "damage", "target": "enemy", "multiplier": 1.8 }] }
```
ATK=100, 敌DEF=30 → 伤害 = (100×1.8 - 30×0.5) × random = 165 × ~1.0

### 示例2：被动技能「铁壁」
```json
{ "name": "铁壁", "type": "passive", "effects": [{ "type": "buff", "target": "self", "buffStat": "def", "buffValue": 20 }] }
```
永久 DEF+20，加成到最终属性的技能加成部分。

### 示例3：天赋「剑心」
```json
{ "name": "剑心", "type": "talent", "unlockRealm": "金丹", "effects": [{ "type": "buff", "target": "self", "buffStat": "critRate", "buffValue": 0.1 }, { "type": "damage", "target": "enemy", "multiplier": 2.5 }] }
```
金丹境界解锁，被动 CRIT+10%，同时附带一个主动伤害技能。
