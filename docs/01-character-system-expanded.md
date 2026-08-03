# 角色属性系统 - 详细设计文档

## 模块总览

```
角色系统
├── 子模块1: 基础属性体系（baseStats + growthRates）
├── 子模块2: 境界与突破（realm + realmStage + breakthrough）
├── 子模块3: 灵根与五行（spiritRoots 7因子 + element 五行）
├── 子模块4: 灵气系统（spiritQi 储量 + 吸收/消耗）
├── 子模块5: 成长公式（expToNextLevel + calculateFinalStats）
├── 子模块6: 角色生命周期（create → 成长 → 突破 → 死亡/重生）
├── 子模块7: 五行性格系统（fiveElements 10维 + temperamentShift）
├── 子模块8: 五脏六腑系统（zangfu 心肝脾肺肾 → 五行映射）【**待战斗系统设计时联调**，当前仅存储字段】
└── 关联模块: 装备 / 技能 / 奇遇 / 功法槽
```

---

## 子模块1: 基础属性体系

### 设计规格

- **六维基础属性**（`Stats`）：`hp`(生命)、`mp`(法力)、`atk`(攻击)、`def`(防御)、`spd`(速度)、`wil`(神识)
- **默认初始值**（`createInitialCharacter`）：
  - `hp: 100`, `mp: 30`, `atk: 10`, `def: 5`, `spd: 10`, `wil: 8`
- **每级线性成长**：`level × growthRates[key]`，与 `baseStats` 相加后进入最终公式

### 数据结构

```typescript
interface Stats {
  hp: number; mp: number; atk: number; def: number; spd: number; wil: number;
}

interface GrowthRates {
  hp: number; mp: number; atk: number; def: number; spd: number; wil: number;
}
```

**默认成长率**（`DEFAULT_GROWTH_RATES`）：

| 属性 | 默认成长率（每级） |
|------|-------------------|
| hp   | 12                |
| mp   | 5                 |
| atk  | 2.5               |
| def  | 2                 |
| spd  | 0.3               |
| wil  | 1.0               |

### 计算公式

```
属性基础值 = baseStats[key] + level × growthRates[key]
```

### 当前实现状态

✅ **已实现**：`Stats`、`GrowthRates`、`DEFAULT_GROWTH_RATES`、`createInitialCharacter` 中的 `baseStats` 和 `growthRates` 字段。

### 待开发事项

无。

---

## 子模块2: 境界与突破

### 设计规格

- **境界序列**（`REALM_ORDER`）：`炼气 → 筑基 → 金丹 → 元婴 → 化神`（顺序固定）
- **境界配置**（`REALMS`）：每个境界包含 `levelReq`（突破等级要求）、`multiplier`（属性倍率）、`materials`（突破消耗材料）
- **阶段划分**（`realmStage`）：每个境界分 `early | mid | late` 三期，影响灵气容量上限
- **突破操作**：`realm` 升至下一阶，`skillPoint += 2`

### 境界数据

| 境界 | 等级要求 | 属性倍率 | 突破材料（代码中） |
|------|----------|----------|-------------------|
| 炼气 | 1        | ×1.0     | —                 |
| 筑基 | 10       | ×1.5     | 筑基丹×1          |
| 金丹 | 25       | ×2.5     | 金丹丹×1          |
| 元婴 | 45       | ×4.0     | 元婴丹×1          |
| 化神 | 70       | ×6.5     | 化神丹×1          |

> ⚠️ **设计文档 vs 代码差异**：设计文档写的是 `金丹碎片×3`、`元婴果×2`、`化神莲×1`；代码实际使用 `金丹丹`、`元婴丹`、`化神丹`。以代码实现为准。

### 数据结构

```typescript
type Realm = '炼气' | '筑基' | '金丹' | '元婴' | '化神';
type RealmStage = 'early' | 'mid' | 'late';

interface RealmConfig {
  realm: Realm;
  levelReq: number;
  multiplier: number;
  materials: { name: string; count: number }[];
}
```

**境界阶段**（`REALM_STAGE_THRESHOLDS`）：

| 阶段 | 阈值（占境界升级进度比例） |
|------|--------------------------|
| early | 0.20（0~20%）            |
| mid   | 0.40（20~40%）            |
| late  | 1.00（40~100%）           |

**各境界阶段灵气容量上限**（`REALM_STAGE_PROGRESS_CAP`，单位：灵气单位）：

| 境界 | early         | mid          | late           |
|------|---------------|--------------|----------------|
| 炼气 | 384           | 768          | 1920           |
| 筑基 | 1920          | 3840         | 9600           |
| 金丹 | 9600          | 19200        | 48000          |
| 元婴 | 48000         | 96000        | 240000         |
| 化神 | 240000        | 480000       | 1200000        |

### 核心函数

```typescript
// 判断当前角色是否满足突破条件
canBreakthrough(char: Character): boolean
  → char.level >= REALMS[nextRealm].levelReq

// 获取下一境界
getNextRealm(char: Character): Realm | null

// 执行突破
breakthrough(char: Character): Character
  → { ...char, realm: nextRealm, skillPoint: char.skillPoint + 2 }
```

### 当前实现状态

✅ **已实现**：`REALMS`、`REALM_ORDER`、`canBreakthrough`、`getNextRealm`、`breakthrough`、`realmStage` 字段及 `RealmStage` 类型。

### 待开发事项

无。

---

## 子模块3: 灵根与五行

### 设计规格

**本模块实际包含两套相关但独立的灵根系统：**

#### 系统A：五行灵根（`element`，用于属性成长倍率）

- 五行类型（`WuXing`）：`metal | wood | water | fire | earth`
- 在 `calculateFinalStats` 中参与乘法修正
- 创建角色时由玩家选择（或默认 `metal`）

```typescript
/**
 * 五行成长倍率：按「相生」哲学设计
 * 相生链：木→火→土→金→水→木
 * - 木生火 → 木灵根强化火属性（atk/spd）
 * - 火生土 → 火灵根强化土属性（def/hp）
 * - 土生金 → 土灵根强化金属性（atk/spd）
 * - 金生水 → 金灵根强化水属性（mp/wil）
 * - 水生木 → 水灵根强化木属性（hp/mp）
 */
const WUXING_GROWTH: Record<WuXing, Partial<Stats>> = {
  metal: { mp: 1.3, wil: 1.1 },  // 金生水 → 法力、神识
  wood:  { atk: 1.3, spd: 1.1 }, // 木生火 → 攻击、速度
  water: { hp: 1.3, mp: 1.1 },   // 水生木 → 生命、法力
  fire:  { def: 1.3, hp: 1.1 },  // 火生土 → 防御、生命
  earth: { atk: 1.3, spd: 1.1 }, // 土生金 → 攻击、速度
};
```

#### 系统B：七因子灵根分布（`spiritRoots`，用于灵气亲和与道种系统）

- **7种灵根**（`SpiritRootKey`）：`qian`(乾)、`kun`(坤)、`fire`(火)、`water`(水)、`wood`(木)、`metal`(金)、`earth`(土)
- 总和必须为 100（百分比）
- 灵根影响角色对各类灵气的亲和力（道种系统读取）
- **坤灵根特殊规则**：`kun = 100 - sum(其他六项)`，自动计算

**默认均分**（`defaultEvenSpiritRoots`）：

| 灵根 | qian(乾) | kun(坤) | 火   | 水   | 木   | 金   | 土   |
|------|----------|---------|------|------|------|------|------|
| 占比 | 15%      | 10%     | 15%  | 15%  | 15%  | 15%  | 15%  |

### 数据结构

```typescript
// SpiritRootKey 的7种
type SpiritRootKey = 'qian' | 'kun' | 'fire' | 'water' | 'wood' | 'metal' | 'earth';

// spiritRoots：Record<SpiritRootKey, number>，总和100
spiritRoots: { qian: 15, kun: 10, fire: 15, water: 15, wood: 15, metal: 15, earth: 15 }

// element：WuXing，五行灵根（影响属性成长倍率）
element: WuXing;
```

### 当前实现状态

✅ **已实现**：`SpiritRootKey`、`spiritRoots`、`defaultEvenSpiritRoots()`、`patchCharacter` 中的灵根修复逻辑。

⚠️ **设计文档未覆盖**：设计文档中的"灵根"仅描述了五行灵根（`element`），未提及七因子灵根分布系统（`spiritRoots`）。

### 待开发事项

> ⚠️ **双向耦合延迟决策**：以下两项均涉及灵根对战斗的影响幅度，需等战斗系统设计完成后，再与战斗系统倒推联调。当前阶段均标记为「待定」，暂不实现。

- **spiritRoots（七因子灵根分布）**：`spiritRoots` 对战斗的数值影响 → **待定**（暂不纳入战斗公式，仅保留字段）
- **element（五行灵根）的战斗影响幅度**：`WUXING_GROWTH` 的具体倍率 → **待定**（等战斗系统确定「风格影响」的具体机制后再调整）
- 确认灵根是否支持后期重塑（`reformSpiritRoots`）

---

## 子模块4: 灵气系统

### 设计规格

- **灵气类型**（`SpiritType`）：`fire | water | wood | metal | earth`（仅5种，乾/坤不存储灵气）
- **灵气储量**（`spiritQi`）：`Record<SpiritType, number>`，每种独立累加
- **容量上限**：`MAJOR_REALM_SPIRIT_CAP[realm]` 为各境界总储量上限；各阶段上限见 `REALM_STAGE_PROGRESS_CAP`
- **灵气用途**：用于功法释放、道种培育等（具体由战斗/功法系统读取）

### 数据结构

```typescript
// 灵气储量初始化
function emptySpiritQi(): Record<SpiritType, number> {
  return { fire: 0, water: 0, wood: 0, metal: 0, earth: 0 };
}

// 境界总灵气容量上限
const MAJOR_REALM_SPIRIT_CAP: Partial<Record<Realm, number>> = {
  '炼气': 1920, '筑基': 9600, '金丹': 48000, '元婴': 240000, '化神': 1200000,
};

// spiritQi 字段（Character）
spiritQi: Record<SpiritType, number>;
```

### 当前实现状态

✅ **已实现**：`spiritQi` 字段类型、`emptySpiritQi()`、境界灵气容量上限常量。

⚠️ **灵气吸收/消耗逻辑**：未在 `characterSystem.ts` 中实现，由其他系统（道种/功法系统）读取 `spiritQi` 后操作。

### 待开发事项

- 灵气吸收接口（从环境/战斗中吸收灵气入 `spiritQi`）
- 灵气消耗接口（功法释放时扣减灵气）
- 超容量时的处理规则（拒绝/溢出/阶段升级）

---

## 子模块5: 成长公式

### 设计规格

#### 5.1 升级经验公式

```
expToNextLevel(level) = level² × 10
```

含义：在 `level` 级时升至 `level+1` 级所需的累计经验。

| 当前等级 | 升至下一级所需经验 |
|----------|-------------------|
| 1        | 10                |
| 9        | 810               |
| 10       | 1000              |
| 24       | 5760              |

#### 5.2 最终属性公式

```
最终属性[key] = (baseStats[key] + level × growthRates[key])
                × realmMultiplier
                × (WUXING_GROWTH[element][key] ?? 1)
                + equipmentBonus[key] + skillBonus[key] + bonusFromEvents[key]
```

**三层乘法：**
1. 基础层：`baseStats + level × growthRates`
2. 境界乘法：`× realmMultiplier`（`REALMS[realm].multiplier`）
3. 五行乘法：`× (WUXING_GROWTH[element][key] ?? 1)`

**三类加算：**
1. 装备加成：`equipmentBonus`
2. 技能加成：`skillBonus`
3. 奇遇永久加成：`bonusFromEvents`

### 数据结构

```typescript
function calculateFinalStats(
  char: Character,
  equipmentBonus: Partial<Stats>,
  skillBonus: Partial<Stats>,
): Stats {
  // 遍历 ['hp', 'mp', 'atk', 'def', 'spd', 'wil'] 逐项计算
}

function addExp(char: Character, exp: number): Character {
  // 循环直至经验不足一级
  // c.exp >= expToNextLevel(c.level) 时升级并扣减经验
}
```

### 当前实现状态

✅ **已实现**：`expToNextLevel`、`calculateFinalStats`、`addExp`。

### 待开发事项

无。

---

## 子模块6: 角色生命周期

### 6.1 创建（`createInitialCharacter`）

```
输入：element: WuXing（默认'metal'），opts（可选name/realm/spiritRoots/gender/inventory）
输出：完整 Character 对象
```

**创建时字段初始化值：**

| 字段           | 初始值                              |
|----------------|-------------------------------------|
| id             | `'player'`                          |
| name           | opts.name ?? '无名修士'              |
| level          | 1                                   |
| exp            | 0                                   |
| realm          | opts.realm ?? '炼气'                |
| realmStage     | `'early'`                           |
| element        | `metal`（默认）                     |
| gender         | `'male'`（默认）                    |
| spiritRoots    | `defaultEvenSpiritRoots()`         |
| spiritQi       | `emptySpiritQi()`                   |
| inventory      | `{}`（空对象）                      |
| baseStats      | `{ hp:100, mp:30, atk:10, def:5, spd:10, wil:8 }` |
| growthRates    | `{ ...DEFAULT_GROWTH_RATES }`       |
| bonusFromEvents| `{}`                                |
| skillPoint     | 0                                   |
| gold           | 0                                   |
| realmProgress  | 0                                   |
| techniqueSlots | `{ jiao:null, jing:null, ziwei:null, kui:null, dou:null }` |
| knownTechniques| `[]`                                |
| techniqueStash | `{}`                                |

### 6.2 成长（`addExp`）

- 每次获得经验后，循环检查是否满足升级条件
- 升级后 `level++`，`exp` 扣减升级所需经验
- 可连升多级的场景（如一次性获得大量经验）

### 6.3 突破（`breakthrough`）

- 满足 `canBreakthrough` 后可执行
- `realm` 升至下一境界
- `skillPoint += 2`
- `realmStage` 重置为 `'early'`
- `realmProgress` 归零

### 6.4 存档迁移（`patchCharacter`）

- 用于读取旧存档时字段缺失的补丁
- 处理 `spiritQi` 从老格式（含 qian/kun）迁移至新格式（仅5种灵气）
- 自动修复灵根总和不足100的情况（自动补充到 kun）

### 当前实现状态

✅ **已实现**：全生命周期函数。

### 待开发事项

- 角色死亡/复活机制
- 角色陨落转世（重塑灵根）机制

---

## 子模块7: 五行性格系统

### 设计规格

五行性格是角色的行事偏好体系，独立于修为灵根（`element`），不影响属性数值，只影响事件决策倾向。

#### 7.1 结构（10维）

每个五行方向有**阳**和**阴**两个独立数值，下限 0，上限不封顶：

| 五行 | 阳面 | 阴面 |
|------|------|------|
| 火 | 热血（主动、热情）| 贪婪（索取、占有）|
| 水 | 包容（温和、开放）| 纵欲（放纵、沉溺）|
| 木 | 传承（给予、培育）| 掌控（控制、支配）|
| 金 | 刚毅（坚定、独立）| 冷酷（冷漠、残忍）|
| 土 | 厚德（牺牲、给予）| 吝啬（自私、占有）|

#### 7.2 与修为灵根的关系

两套独立系统，无直接绑定。

- **修为灵根（`element`）**：定义五行主灵根，影响属性成长倍率
- **五行性格（`fiveElements`）**：定义行事偏好，影响事件选项倾向

两者的关系：**修为灵根作为五行性格的初始锚点**，角色创建时由角色系统根据 `element` 生成初始值；后续由事件选项结算持续修正，修正结果不受修为灵根约束。

#### 7.3 初始化

初始化逻辑由角色系统在创建角色时执行，框架文档只描述接口规范。

`GeneratorContext.fiveElements` 字段在角色创建时由角色系统写入 `Character` 对象。

#### 7.4 修正机制

每次事件选项结算时：

1. 根据选项的 `temperamentShift` 字段应用偏移
2. 将偏移量叠加到对应的五行性格维度上
3. 数值下限 0，上限不封顶（超过 100 继续增长）
4. 无衰减机制（性格一旦形成不回落）

#### 7.5 性格偏移接口

性格偏移由事件模板自行定义，角色系统只提供接口规范。

**接口格式：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `dimension` | `FiveElementsDimension` | 偏移的五行维度，如 `fire.yang`、`water.yin` |
| `value` | `number` | 偏移量，通常为 ±1 |

**可用维度：**

| dimension 值 | 对应阴阳 | 说明 |
|-------------|---------|------|
| `fire.yang` | 火·阳 | 热血 |
| `fire.yin` | 火·阴 | 贪婪 |
| `water.yang` | 水·阳 | 包容 |
| `water.yin` | 水·阴 | 纵欲 |
| `wood.yang` | 木·阳 | 传承 |
| `wood.yin` | 木·阴 | 掌控 |
| `metal.yang` | 金·阳 | 刚毅 |
| `metal.yin` | 金·阴 | 冷酷 |
| `earth.yang` | 土·阳 | 厚德 |
| `earth.yin` | 土·阴 | 吝啬 |

### 数据结构

```typescript
interface FiveElements {
  fire: { yang: number; yin: number };
  water: { yang: number; yin: number };
  wood: { yang: number; yin: number };
  metal: { yang: number; yin: number };
  earth: { yang: number; yin: number };
}

interface TemperamentShift {
  dimension: FiveElementsDimension;  // 例：'fire.yang'
  value: number;                      // 偏移量
}

// FiveElementsDimension 枚举
export type FiveElementsDimension =
  | 'fire.yang' | 'fire.yin'
  | 'water.yang' | 'water.yin'
  | 'wood.yang' | 'wood.yin'
  | 'metal.yang' | 'metal.yin'
  | 'earth.yang' | 'earth.yin';
```

### 当前实现状态

⚠️ **未实现**：`FiveElements` 字段尚未写入 `Character` 接口。

### 待开发事项

- 确认 `FiveElements` 字段写入 `Character` 接口
- 确认初始化算法（角色系统根据 `element` 生成初始值的规则）
- 确认存档迁移时 `fiveElements` 的处理逻辑

---

## 关联系统接口

### 装备系统
- `equipmentBonus: Partial<Stats>` 作为参数传入 `calculateFinalStats`
- 装备属性直接加算到最终属性

### 技能系统
- `skillBonus: Partial<Stats>` 作为参数传入 `calculateFinalStats`
- `skillPoint` 由 `breakthrough` 增加（每次+2）

### 奇遇系统
- `bonusFromEvents: Partial<Stats>` 存储于 `Character` 中
- 加算到最终属性（永久生效）

### 功法槽系统
- `techniqueSlots: TechniqueSlots` = `Record<'jiao'|'jing'|'ziwei'|'kui'|'dou', string | null>`
- 五功法槽位，每槽可装备一部功法

---

## 模块间依赖关系

```
spiritRoots（灵根分布）
  └──→ 影响灵气吸收/道种系统亲和力

realm + realmStage + realmProgress
  ├──→ 影响灵气容量上限（MAJOR_REALM_SPIRIT_CAP / REALM_STAGE_PROGRESS_CAP）
  └──→ 影响道种上限

element（角色五行）
  └──→ 影响 calculateFinalStats 的五行乘法倍率

baseStats + growthRates + level
  └──→ calculateFinalStats 的基础层

REALMS[realm].multiplier
  └──→ calculateFinalStats 的境界乘法层

equipmentBonus + skillBonus + bonusFromEvents
  └──→ calculateFinalStats 的加算层
```

---

## 子模块8: 五脏六腑系统（心肝脾肺肾）

### 设计规格

**五脏与五行的映射关系：**

| 五脏 | 对应五行 | 字段键 |
|------|----------|--------|
| 心 | 火（fire） | `heart` |
| 肝 | 木（wood） | `liver` |
| 脾 | 土（earth） | `spleen` |
| 肺 | 金（metal） | `lungs` |
| 肾 | 水（water） | `kidneys` |

### 数据结构

```typescript
// 五脏数值（整数，范围待定，当前仅存储）
interface ZangFu {
  heart: number;   // 心·火
  liver: number;   // 肝·木
  spleen: number;  // 脾·土
  lungs: number;   // 肺·金
  kidneys: number; // 肾·水
}
```

### 当前状态

⬜ **待建立**：字段尚未写入 `Character` 接口。当前仅为规划状态，等战斗系统设计完成后再确定具体数值范围和影响机制。

### 与其他系统的关系

| 关联系统 | 关系 |
|----------|------|
| 五行灵根（`element`） | `element` 决定五脏的初始偏向（如 `element=fire` → 心·火 较高），但具体数值**待定** |
| 七因子灵根（`spiritRoots`） | 两者关系**待定**，联调时一并确定 |
| 战斗系统 | 五脏数值对战斗的影响方式**待定**（如：影响技能威力？影响气血消耗？影响出手顺序？），等战斗系统设计后倒推 |
| 卡牌系统（Estiah风格） | 若引入卡牌制，五脏可能影响：手牌上限、抽卡倾向、卡牌威力等，**待与卡牌系统联调** |

### 待开发事项

- 五脏初始值如何由 `element` 和 `spiritRoots` 共同决定
- 五脏数值是否随升级/修炼自动成长
- 五脏对战斗系统的具体影响方式（**需等战斗系统设计**）
- 五脏对卡牌/技能系统的具体影响方式（**需等卡牌系统设计**）

---

## 优先级排序

| 优先级 | 子模块 | 理由 |
|--------|--------|------|
| P1     | 基础属性体系 | 所有其他系统的数值根基 |
| P1     | 成长公式 | `calculateFinalStats`/`addExp` 被所有系统调用 |
| P2     | 境界与突破 | 境界倍率影响最终属性，突破解锁新阶段 |
| P2     | 灵根与五行（**双向待定**） | `element` 和 `spiritRoots` 的战斗影响均**待定**，等战斗系统设计后联调 |
| P3     | 灵气系统 | 道种/功法系统的前置依赖 |
| P3     | 五脏六腑系统（心肝脾肺肾） | **待战斗+卡牌系统设计后联调**，当前仅存储字段 |
| P4     | 功法槽系统 | UI 层面组件，独立于战斗核心循环 |
| P4     | 五行性格系统 | 事件系统的前置依赖 |
| P5     | 战斗系统 | **新建设计**，计划引入卡牌制（Estiah风格），需同步与五脏/灵根系统联调 |
| P5     | 角色死亡/重生 | 后期润色功能 |

---

## 设计文档 vs 代码实现差异清单

| 项目 | 设计文档描述 | 代码实际实现 | 处理建议 |
|------|-------------|-------------|---------|
| 突破材料名称 | 金丹碎片、元婴果、化神莲 | 金丹丹、元婴丹、化神丹 | **以代码为准**，更新设计文档 |
| 灵根系统 | 仅描述五行灵根（WuXing） | 新增七因子 `spiritRoots` 分布系统 | **补充设计文档**，定义spiritRoots与道种/灵气的关联规则 |
| Gender系统 | 未提及 | `'male'|'female'` + `GENDER_LABELS` | **补充设计文档** |
| 功法槽系统 | 未提及 | `techniqueSlots` 5槽位 + `knownTechniques` + `techniqueStash` | **补充设计文档**，定义功法装备效果接口 |
| 灵气存储 | 未提及 | `spiritQi` 5类型灵气独立储量 + 各境界容量上限 | **补充设计文档**，定义吸收/消耗规则 |
| realmStage | 未提及 | `early/mid/late` 三期 + 各阶段灵气容量 | **补充设计文档** |
| patchCharacter | 未提及 | 老存档迁移补丁函数 | **补充设计文档**或确认是否属于其他系统文档 |
| 五行性格系统 | 未提及 | `FiveElements` 字段未写入 `Character` 接口 | **已补充至子模块7**，待实现 |
