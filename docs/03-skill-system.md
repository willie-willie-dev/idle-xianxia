# 技能与战斗（与实现对齐）

本文档依据 `src/types/skill.ts`、`src/data/skills.ts`、`src/types/combat.ts` 及当前战斗入口 `src/systems/combatSystem.ts`、`src/store/gameStore.ts` 描述技能数据模型、生效方式与战斗结算。

---

## 技能类型与分类

| `SkillType` | 含义 | 数据上的消耗与冷却 |
|-------------|------|---------------------|
| `active` | 主动技能 | `mpCost`、`cooldown` 由数据定义；`currentCd` 为运行时冷却剩余（类型上存在，当前战斗逻辑未驱动） |
| `passive` | 被动技能 | `mpCost`、`cooldown`、`currentCd` 在数据中为 `0` |
| `talent` | 天赋 | 同上，无蓝耗与冷却 |

效果类型 `EffectType`：`damage` | `heal` | `buff` | `debuff`。  
效果目标 `SkillTarget`：`self` | `enemy` | `allEnemy` | `ally`。

---

## 五行与技能

角色与怪物带有五行 `WuXing`：`metal` | `wood` | `water` | `fire` | `earth`。  
五行参与 `calculateFinalStats` 的成长倍率（见 `src/types/character.ts` 中 `WUXING_GROWTH`），**不写在 `Skill` 上**；技能系统本身不存「技能五行」字段。

---

## 完整类型定义（摘自实现）

`StatKey` 来自 `src/types/character.ts`，即 `hp` | `mp` | `atk` | `def` | `spd` | `wil`。

```typescript
// src/types/skill.ts
import type { StatKey } from './character';

export type SkillType = 'active' | 'passive' | 'talent';
export type SkillTarget = 'self' | 'enemy' | 'allEnemy' | 'ally';
export type EffectType = 'damage' | 'heal' | 'buff' | 'debuff';

export interface SkillEffect {
  type: EffectType;
  target: SkillTarget;
  multiplier: number;
  buffStat?: StatKey;
  buffValue?: number;
  buffDuration?: number;
}

export interface Skill {
  id: string;
  name: string;
  type: SkillType;
  level: number;
  maxLevel: number;
  mpCost: number;
  cooldown: number;
  currentCd: number;
  effects: SkillEffect[];
  unlockRealm: string;
  description: string;
}
```

```typescript
// src/types/combat.ts（战斗相关：Combatant / Buff / BattleResult 等）
import type { StatKey, Stats, WuXing } from './character';
import type { EquipBase } from './equipment';
import type { Skill } from './skill';

export interface Buff {
  stat: StatKey;
  value: number;
  turnsLeft: number;
}

export interface Combatant {
  name: string;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  stats: Stats;
  element: WuXing;
  skills: Skill[];
  buffs: Buff[];
}

export interface BattleResult {
  victory: boolean;
  turnsUsed: number;
  expGained: number;
  goldGained: number;
  drops: EquipBase[];
  log: string[];
  hpLeft: number;
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  realm: string;
  element: WuXing;
  stats: Stats;
  expReward: number;
  goldReward: number;
}

export interface LogEntry {
  id: number;
  text: string;
  type: 'battle' | 'reward' | 'levelup' | 'idle' | 'event' | 'drop';
  timestamp: number;
}
```

说明：`Combatant`、`Buff` 为完整战斗单位建模；**当前 `simulateBattle` 未使用该结构**，也未改写 `skills`/`buffs`。

---

## 技能列表机制（无存档意义上的「槽位」类型）

游戏中技能存储为 `GameState.skills: Skill[]`（见 `gameStore.ts`），**没有**单独的 `SkillSlot` 或固定槽位数组类型。

- **初始**：从 `SKILLS_DATA` 中筛选 `unlockRealm === '炼气'` 的条目复制为初始列表（含炼气可学的主动、被动、天赋）。
- **境界突破**：`tryBreakthrough` 将角色境界更新后，把 `SKILLS_DATA` 里 `unlockRealm === 新境界` 且 `id` 尚未在列表中的技能追加进去。
- **界面**：`SkillPanel` 按 `type` 分三组展示（主动 / 被动 / 天赋），不限制装备数量，与数据里「已解锁并存在于 `skills` 数组」一致。

被动与天赋中 **`type === 'buff'` 且带 `buffStat` / `buffValue`** 的效果，在 `getFinalStats` 里汇总到 `skillBonus`，再传入 `calculateFinalStats`（仅 `passive` 与 `talent` 会参与该汇总）。同一键的数值会累加。

主动技能数据中的 `mpCost`、`cooldown`、`SkillEffect.multiplier` 等字段**存在且见 UI 描述**，但当前 `simulateBattle` **不读取**玩家 `skills`，不扣 MP，不推进 CD，也不按倍率改伤害。

天赋 **剑心** 含一条 `damage` effect（倍率 `2.5`）：该条**不参与**属性汇总；因战斗未遍历技能，`damage` / `heal` / `debuff` 类效果在当前战斗脚本中均无结算。

---

## 战斗流程（当前实现：`simulateBattle`）

1. 入参：`playerStats`（已由装备与被动/天赋加成后的最终 `Stats`）、`monster`；`simulateBattle` 接收玩家五行与等级参数但未使用。
2. 初始化：玩家 HP 取 `playerStats.hp`，怪物 HP 取 `monster.stats.hp`；`playerStats.mp` 读入但未参与逻辑。
3. 循环条件：玩家 HP、`monster` HP 均大于 0，且回合数小于 `maxTurns`（30）。
4. **每一轮循环**（`turns` 自增 1）：
   - 玩家攻击一次：按下方「伤害公式」对怪物扣血，写日志。
   - 若怪物仍存活：怪物攻击一次，对称公式对玩家扣血，写日志。
5. 退出后：若怪物 HP ≤ 0 则 `victory`；胜利时约 35% 概率 `rollDrop` 得到装备；经验 / 金币按胜败分支写入 `BattleResult`。

即：**没有**按 `spd` 排序出手、**没有**技能选择或普攻/技能分支，双方每轮各打一次固定「普攻式」伤害。

---

## 伤害公式（当前实现）

以下均为**取整前**先完成乘法再 `Math.floor`（代码中先乘随机系数再取整）。

**玩家对怪物：**

\[
\text{dmg}_p = \max\bigl(1,\ \text{ATK}_p - \text{DEF}_m \times 0.5\bigr) \times U(0.9,\ 1.1)
\]

**怪物对玩家：**

\[
\text{dmg}_m = \max\bigl(1,\ \text{ATK}_m - \text{DEF}_p \times 0.5\bigr) \times U(0.9,\ 1.1)
\]

其中 \(U(0.9, 1.1)\) 为 `0.9 + Math.random() * 0.2`。

**未实现（与旧设计稿常见写法不同，且当前代码中不存在）：** 技能倍率、暴击倍率、治疗按 ATK×倍率、回合结束统一减 CD 等。

---

## `SKILLS_DATA` 一览（`src/data/skills.ts`）

| id | 名称 | type | mpCost | cooldown | 主要 effects | unlockRealm |
|----|------|------|--------|----------|--------------|-------------|
| `fireball` | 火球术 | active | 10 | 0 | `damage` / `enemy` / `multiplier: 1.8` | 炼气 |
| `yujian` | 御剑术 | active | 20 | 2 | `damage` / `enemy` / `multiplier: 2.5` | 筑基 |
| `iron-wall` | 铁壁 | passive | 0 | 0 | `buff` / `self` / `def` +20 | 炼气 |
| `lingshi` | 灵识 | passive | 0 | 0 | `buff` / `self` / `wil` +8 | 筑基 |
| `jianxin` | 剑心 | talent | 0 | 0 | `buff` `wil` +15；`damage` / `enemy` / `multiplier: 2.5` | 金丹 |
| `shenshenli` | 天生神力 | talent | 0 | 0 | `buff` / `self` / `atk` +30 | 炼气 |

各条目均含合理的 `level` / `maxLevel` / `description` / `currentCd: 0`，与数据源一致。

### 数据示例（精简）

```typescript
// 主动：火球术
{
  id: 'fireball', name: '火球术', type: 'active', level: 1, maxLevel: 10,
  mpCost: 10, cooldown: 0, currentCd: 0,
  effects: [{ type: 'damage', target: 'enemy', multiplier: 1.8 }],
  unlockRealm: '炼气', description: '凝聚灵力化为火球，造成1.8倍伤害',
}

// 被动：铁壁
{
  id: 'iron-wall', name: '铁壁', type: 'passive', level: 1, maxLevel: 5,
  mpCost: 0, cooldown: 0, currentCd: 0,
  effects: [{ type: 'buff', target: 'self', multiplier: 0, buffStat: 'def', buffValue: 20 }],
  unlockRealm: '炼气', description: '永久提升防御20点',
}

// 天赋：剑心（属性部分参与 finalStats；damage 条仅数据存在）
{
  id: 'jianxin', name: '剑心', type: 'talent', level: 1, maxLevel: 3,
  mpCost: 0, cooldown: 0, currentCd: 0,
  effects: [
    { type: 'buff', target: 'self', multiplier: 0, buffStat: 'wil', buffValue: 15 },
    { type: 'damage', target: 'enemy', multiplier: 2.5 },
  ],
  unlockRealm: '金丹', description: '天赋：神识+15，附带主动剑气伤害',
}
```

---

## 关联文件

| 路径 | 作用 |
|------|------|
| `src/types/skill.ts` | 技能与效果类型 |
| `src/data/skills.ts` | `SKILLS_DATA` |
| `src/types/combat.ts` | `Combatant`、`Buff`、`BattleResult`、`Monster` |
| `src/store/gameStore.ts` | 技能列表、被动/天赋汇总进 `getFinalStats`、突破解锁 |
| `src/systems/combatSystem.ts` | `simulateBattle` 实际结算 |
| `src/components/SkillPanel.tsx` | 按类型展示技能与主动 CD/蓝耗文案 |
