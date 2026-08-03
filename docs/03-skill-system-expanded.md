# 技能与战斗系统 - 详细设计文档

> 文档版本：v2.0（与实现对齐，2026-06-02）
> 依据：`src/types/skill.ts`、`src/data/skills.ts`、`src/types/combat.ts`、`src/systems/combatSystem.ts`、`src/store/gameStore.ts`

---

## 模块总览

| 子模块 | 负责文件 | 当前状态 |
|--------|----------|----------|
| 技能分类与数据结构 | `skill.ts`、`skills.ts` | ✅ 定义完整，数据完整 |
| 被动/天赋技能系统 | `skill.ts`、`gameStore.ts` | ⚠️ 属性加成已实现，战斗未驱动 |
| 主动技能与CD/MP | `skill.ts`、`skills.ts` | ⚠️ 数据定义完整，UI展示CD/MP，战斗未驱动 |
| 战斗引擎 | `combatSystem.ts` | ⚠️ 基础框架完成，缺技能/速度/暴击 |
| 战斗AI与策略 | `combatSystem.ts` | ❌ 未实现（纯对称普攻） |
| 掉落结算 | `combatSystem.ts`、`equipmentSystem.ts` | ✅ 35%概率已实现 |

---

## 子模块1：技能分类与数据结构

### 设计规格

| 分类 | 英文名 | 蓝耗 | 冷却 | 说明 |
|------|--------|------|------|------|
| 主动技能 | `active` | ✅ 有（`mpCost`） | ✅ 有（`cooldown`） | 战斗中需手动/自动释放 |
| 被动技能 | `passive` | ❌ 0 | ❌ 0 | 常驻属性加成 |
| 天赋 | `talent` | ❌ 0 | ❌ 0 | 境界解锁，属性加成 |

**效果类型（`EffectType`）：**
- `damage` — 伤害（倍率按 ATK 计算）
- `heal` — 治疗（倍率按 ATK 计算，当前无实现）
- `buff` — 增益己方（`buffStat` + `buffValue`）
- `debuff` — 减益敌方（当前无实现）

**目标类型（`SkillTarget`）：**
- `self` — 作用于己方
- `enemy` — 作用于单个敌人
- `allEnemy` — 作用于所有敌人（当前无实现）
- `ally` — 作用于友方（当前无实现）

### 数据结构

```typescript
// src/types/skill.ts
type SkillType = 'active' | 'passive' | 'talent';
type SkillTarget = 'self' | 'enemy' | 'allEnemy' | 'ally';
type EffectType = 'damage' | 'heal' | 'buff' | 'debuff';

interface SkillEffect {
  type: EffectType;
  target: SkillTarget;
  multiplier: number;      // damage/heal 按 ATK 倍率；buff/debuff 为 0 时用 buffValue
  buffStat?: StatKey;      // buff 类型时指定属性
  buffValue?: number;      // buff 数值（multiplier=0 时生效）
  buffDuration?: number;   // 持续回合数（当前未实现）
}

interface Skill {
  id: string;
  name: string;
  type: SkillType;
  level: number;
  maxLevel: number;
  mpCost: number;
  cooldown: number;
  currentCd: number;         // 运行时冷却剩余，当前战斗未推进
  effects: SkillEffect[];
  unlockRealm: string;
  description: string;
}
```

### 当前实现状态

- ✅ `Skill`、`SkillEffect` 类型定义完整
- ✅ `SKILLS_DATA` 已定义 6 个技能（2 主动、2 被动、2 天赋）
- ✅ `SkillPanel` UI 按 type 分三组展示，显示 mpCost / cooldown 描述
- ❌ 技能无独立"槽位"概念，存于 `GameState.skills: Skill[]` 数组

### 待开发事项

1. **主动技能 UI 入口**：当前技能面板只展示描述，没有施放按钮或技能选择
2. **技能升级**：支持 `level` → `maxLevel`，升级后 `buffValue` 等数值成长
3. **`buffDuration`**：BUFF 持续回合机制未实现
4. **群攻/治疗目标**：`allEnemy`、`ally` 目标类型无 UI 和结算逻辑

---

## 子模块2：被动/天赋技能系统

### 设计规格

被动与天赋的效果分两类：

| 效果类型 | 在 `getFinalStats` 中的处理 |
|----------|------------------------------|
| `buff` + `buffStat` + `buffValue` | ✅ 汇总到 `skillBonus`，参与 `calculateFinalStats` |
| `damage` / `heal` / `debuff` | ❌ 不参与属性计算，战斗中另行结算 |

### 当前实现状态

**属性加成链路（已完整实现）：**

```
SKILLS_DATA（passive/talent的buff效果）
  → GameState.skills[]
    → getFinalStats() 汇总 skillBonus[StatKey]
      → calculateFinalStats(stats + skillBonus)
        → 最终属性用于战斗
```

**剑心（jianxin）特殊说明：**
- `effects[0]`：`buff` / `self` / `wil` +15 → ✅ 参与属性加成
- `effects[1]：`damage` / `enemy` / `multiplier: 2.5` → ❌ 不参与属性，但因战斗未驱动技能，倍率也不生效

### 待开发事项

1. **被动/天赋的等级成长**：升级后 `buffValue` 数值需要随 `level` 增长
2. **天赋伤害效果接入战斗**：剑心的 `damage` effect 需要在 `simulateBattle` 中被触发

---

## 子模块3：主动技能与CD/MP

### 设计规格

| 字段 | 来源 | 战斗行为 |
|------|------|----------|
| `mpCost` | `Skill.mpCost` | ❌ 战斗未扣 MP |
| `cooldown` | `Skill.cooldown` | ❌ 战斗未推进 CD |
| `currentCd` | `Skill.currentCd` | ❌ 每回合不减 CD |
| `multiplier` | `SkillEffect.multiplier` | ❌ 战斗中不用倍率 |

### 当前实现状态

- ✅ 数据层：`mpCost`、`cooldown`、`currentCd` 定义完整
- ✅ UI 层：`SkillPanel` 显示技能描述（含"冷却X回合"等文案）
- ❌ 战斗层：玩家不消耗 MP、不推进 CD、不按技能倍率施法

**当前有技能但无技能入口的问题：**
- 玩家能解锁火球术、御剑术
- 但战斗永远是普攻，技能描述是"空气"

### 待开发事项

1. **MP 消耗**：施放主动技能前检查 `playerStats.mp >= mpCost`
2. **CD 机制**：每回合结束对所有主动技能 `currentCd - 1`（最低为 0）
3. **技能施放逻辑**：战斗中玩家每回合选择普攻或技能；技能按 `multiplier × ATK` 计算伤害
4. **MP 回复**：每回合回复 MP（需设计回复量）
5. **UI 技能按钮**：技能面板增加施放按钮，显示当前 CD 状态

---

## 子模块4：战斗引擎

### 设计规格（当前实现）

**回合结构：**
```
while (玩家HP > 0 && 怪物HP > 0 && 回合 < 30) {
  玩家攻击 → 怪物扣血
  若怪物存活 → 怪物攻击 → 玩家扣血
}
```

**伤害公式：**

玩家对怪物：
```
dmg_p = floor( max(1, ATK_p - DEF_m × 0.5) × U(0.9, 1.1) )
```

怪物对玩家：
```
dmg_m = floor( max(1, ATK_m - DEF_p × 0.5) × U(0.9, 1.1) )
```

其中 `U(0.9, 1.1) = 0.9 + Math.random() * 0.2`，为 ±10% 伤害波动。

**未实现的常见机制：**

| 机制 | 说明 |
|------|------|
| 速度排序 | `spd` 未用于决定出手顺序 |
| 暴击 | 无暴击概念 |
| 技能伤害 | 玩家只打普攻，不施放技能 |
| Buff 回合结算 | Buff 的 `turnsLeft` 未推进 |
| MP 消耗与回复 | MP 存在但未参与战斗 |
| 五行克制 | 五行字段存在但未参与伤害计算 |
| 经验溢出升级 | 等级提升逻辑在战斗外处理 |

### 当前实现状态

- ✅ 基础 HP/DEF/ATK 伤害计算框架
- ✅ 30 回合上限防死循环
- ✅ 35% 掉落概率
- ❌ 其他所有机制均缺失

---

## 子模块5：战斗AI与策略

### 设计规格（未实现）

理想状态下，战斗 AI 应考虑：

- **玩家决策**：普攻 / 技能选择（受 MP、CD 约束）
- **怪物行为**：根据怪物类型（攻击型/防御型）有不同的攻击模式
- **速度影响**：高速方先手，可能影响技能节奏
- **血线判断**：低血量时治疗或防御，高血量时全力输出

### 当前实现状态

❌ 怪物只有一种行为：**固定普攻**（`ATK_m - DEF_p × 0.5`）

### 待开发事项

1. **怪物行为分级**：定义不同怪物的攻击策略（激进/保守/均衡）
2. **速度影响出手**：按 `spd` 排序决定先手
3. **AI 决策树**：玩家方根据 HP/MP/Buff 状态选择最优技能
4. **自动战斗模式**：挂机时 AI 代理决策

---

## 子模块6：掉落结算

### 设计规格

```
胜利 && random() < 0.35
  → rollDrop(monster.level)
  → 返回 EquipBase 加入 BattleResult.drops[]
```

失败时：无掉落，经验折算为 1/3。

### 当前实现状态

- ✅ 35% 概率触发掉落
- ✅ `rollDrop` 按怪物等级从装备池抽取
- ✅ 掉落加入 `BattleResult.drops[]`，日志写入 `log`

### 待开发事项

1. **多件掉落**：高等级/首领怪可能掉落多件
2. **保底机制**：连续不出掉落时的累积概率提升
3. **装备绑定/交易**：装备是否可交易、是否绑定角色

---

## 模块间依赖关系

```
Skill (被动/天赋 buff 效果)
  └── getFinalStats() ──→ skillBonus
        └── calculateFinalStats() ──→ 最终属性
              └── simulateBattle() 使用

Skill (主动 mpCost/cooldown)
  └── simulateBattle() 消费（当前未实现）
        └── 需要 MP 充足、CD 就绪

Monster
  └── simulateBattle() 直接消费 stats/hp

Buff (Combatant.buffs[])
  └── 当前技能系统产生，但不参与战斗结算
```

---

## 优先级排序

| 优先级 | 事项 | 所属模块 | 理由 |
|--------|------|----------|------|
| P0 | **主动技能施放（伤害倍率+MP+CD）** | 子模块3+4 | 当前最大缺口，战斗无技能体验断裂 |
| P0 | **速度出手排序** | 子模块4 | 影响战斗节奏感 |
| P1 | **被动/天赋等级成长** | 子模块2 | 技能养成核心 |
| P1 | **Buff 持续回合结算** | 子模块4 | Buff 系统完整化 |
| P2 | **战斗AI策略** | 子模块5 | 提升战斗可玩性 |
| P2 | **五行克制伤害** | 子模块4 | 丰富战斗维度 |
| P3 | **怪物AI分级行为** | 子模块5 | 让怪物不再是木桩 |
| P3 | **多件掉落/保底** | 子模块6 | 提升掉落爽感 |