# 剧情/奇遇系统

## 系统架构

挂机/历练时随机触发事件，玩家做出选择，获得奖励或惩罚。事件按境界分层。

## 事件类型

| 类型 | 说明 | 典型效果 |
|------|------|----------|
| 奇遇 | 属性加成 | 永久+属性 |
| 机缘 | 获得道具/装备 | 物品奖励 |
| 抉择 | 分支选择 | 影响后续事件链 |
| 危机 | 降低属性/损失资源 | 负面效果（可抵抗） |

## 触发机制

```
触发概率 = 基础概率(5%) × 地图系数 × (1 + 境界加成)
挂机每10分钟检测一次触发
历练每场战斗后检测一次触发
同一天然事件不重复触发
```

## 事件池分段

| 境界段 | 事件风格 |
|--------|----------|
| 炼气~筑基 | 凡人奇遇：山洞发现、仙人遗物 |
| 金丹~元婴 | 修士机缘：秘境探险、灵兽契约 |
| 化神~合体 | 大能际遇：古战场、天劫洗礼 |
| 大乘~仙人 | 仙界缘法：天道考验、飞升奇遇 |

## TypeScript 类型

```typescript
type EventType = '奇遇' | '机缘' | '抉择' | '危机';

interface EventReward {
  statBonus?: Partial<BaseStats>;       // 永久属性修正
  items?: { id: string; count: number }[];
  equipment?: EquipBase;
  followUpEventId?: string;             // 触发后续事件
  expBonus?: number;
}

interface EventOption {
  text: string;
  resultText: string;
  reward: EventReward;
  condition?: { realm?: string; statReq?: Partial<BaseStats> };  // 选项出现条件
}

interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  realmRange: [string, string];         // 适用境界范围
  options: EventOption[];
  triggerChance: number;                // 基础触发概率
  oneTime: boolean;                     // 是否只触发一次
}

interface EventHistory {
  eventId: string;
  chosenOptionIndex: number;
  timestamp: number;
}
```

## 关联系统

- **角色系统**：`statBonus` 写入 `bonusFromEvents` 永久修正
- **装备系统**：`equipment` 直接获得装备
- **技能系统**：部分机缘奖励技能书

## 示例

### 示例1：奇遇 — 灵泉洗礼
```json
{
  "title": "灵泉洗礼",
  "description": "你发现了一处隐秘的灵泉，泉水散发着淡淡灵光。",
  "type": "奇遇",
  "realmRange": ["炼气", "筑基"],
  "options": [
    { "text": "饮用灵泉", "resultText": "灵力灌体，全身经脉通畅！", "reward": { "statBonus": { "hp": 50, "mp": 20 } } },
    { "text": "浸泡全身", "resultText": "你感到力量涌动，但泉水冰凉刺骨...", "reward": { "statBonus": { "atk": 5, "def": -3 } } }
  ]
}
```

### 示例2：机缘 — 古修遗府
```json
{
  "title": "古修遗府",
  "description": "一座破旧的修士洞府出现在眼前，门上刻着古老符文。",
  "type": "机缘",
  "realmRange": ["金丹", "元婴"],
  "options": [
    { "text": "强行破门", "resultText": "机关触发！但你还是拿到了宝物。", "reward": { "equipment": "...", "statBonus": { "hp": -30 } } },
    { "text": "仔细研究符文", "resultText": "符文自然消散，门缓缓打开。", "reward": { "equipment": "..." }, "condition": { "realm": "元婴" } }
  ]
}
```

### 示例3：危机 — 天劫降临
```json
{
  "title": "天劫降临",
  "description": "乌云密布，天道劫雷凝聚成形，似乎感应到了你的存在。",
  "type": "危机",
  "realmRange": ["化神", "渡劫"],
  "options": [
    { "text": "硬抗天劫", "resultText": "劫雷轰击，你身受重伤但道心更坚。", "reward": { "statBonus": { "atk": 15, "hp": -100 } } },
    { "text": "使用法宝抵挡", "resultText": "法宝碎裂，但你安然无恙。", "reward": { "statBonus": { "def": 10 } }, "condition": { "statReq": { "def": 200 } } }
  ]
}
```
