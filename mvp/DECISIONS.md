# 登仙 · MVP 临时拍板记录（2026-11-16）

> ⚠️ 这是**临时决议**，不写进 `design-docs/`。
> 等 MVP 跑起来后，再拿代码行为和设计文档逐条对账，**回头统一改设计文档**。
> W 只做一次终审调整。

## 一、R1–R5 的决定

| # | 问题 | 临时决定 | 理由 | 终审可能改的点 |
|---|---|---|---|---|
| R1 | 灵气是否留存 | **A：吸收即转修为**，灵气池只做本次 UI 明细，不入存档 | 最少状态、最少 bug；先让闭环转起来 | 若想更贴 01-05 的“5 栏修炼”，会改成 B（先入池、修炼时消耗） |
| R2 | 事件是否消耗资源 | **不消耗**，事件只产出回报 | 避免“资源不够点不动”的卡死 | 加精力/灵气消耗 |
| R3 | 事件回报类别 | **修为 + 剧情标记**（装备砍） | 遵守 00-01“禁止空结算”，但砍掉无系统支撑的装备 | 加性格偏移或装备 |
| R4 | 突破失败损耗 | **保留 20%**，失败后可立即重试 | 01-01 v1.1 已锁区间 10–30%，取中点 | 改 10% / 去掉失败 |
| R5 | 事件抽取 | **按条件随机 + 存 `rngSeed`**（可复现） | 随机有变化，种子可复现便于测试 | 改为固定顺序 |

## 二、可选字段取舍

| 字段 | 决定 | 备注 |
|---|---|---|
| `element`（五行主属性） | **保留** | 只展示，暂不参与计算 |
| `day`（天数） | **保留，入存档** | 仅展示与叙事节奏 |
| `energy`（精力） | **不做** | 先“想点就点” |
| `spiritPool`（灵气池） | **不做** | R1=A 的直接结果 |
| `rootExp`（灵根经验） | **不做** | 灵根固定 |
| `appearance` / `lifespan` | **不做** | 无对应系统 |

## 三、临时数值（与设计文档解耦，待对账）

| 项 | 临时值 | 说明 |
|---|---|---|
| 初始灵根 | `{qian:15,kun:10,fire:15,water:15,wood:15,metal:15,earth:15}` | 合计 100，来自 01-01 示例 |
| 起始功法「青木诀」 | `absorbRate 0.4 / convertRate 0.3` | 与 PR #4 测试一致 |
| 境界阈值（MVP 三阶） | 炼气 0 / 筑基 **100** / 金丹 **500** | **≠ 01-01 的 1000/5000**，为 10 分钟首突破而临时压低 |
| 修为上限 | 下一阈值 × 4（沿用公式） | 与 01-01 公式一致 |
| 地点 1「火山」 | 火 200 + 土 30 | 与 Issue #3 用例一致 |
| 地点 2「灵泉」 | 水 200 + 木 50 | 同上 |
| 单次吸收产出 | ≈ 10 修为（按上面参数算得） | 到筑基 100 需约 10 次吸收 ≈ 3–4 分钟 |
| 事件池 | 24 条，按境界 8/8/8 | 每条 2–3 选项，单选项给 +5~+15 修为或剧情标记 |

**首突破节奏验算**：`200×0.15 + (230×0.15×1.5) + (230×0.10×0.1) = 84.05` →
`×0.4 = 33.6` → `×0.3 ≈ 10.1 修为/次`；筑基阈值 100 → **约 10 次吸收**，加事件奖励可缩到 6–8 次。

## 四、由此确定的角色结构

```ts
interface MvpCharacter {
  id: string;
  name: string;
  spiritRoots: Roots;        // 复用 mvp/absorb.ts
  element: WuXing;
  realm: Realm;              // '炼气' | '筑基' | '金丹'
  cultivation: number;
  cultivationMax: number;
  nextThreshold: number;
  technique: Technique;      // 复用 mvp/absorb.ts
  eventState: { doneIds: string[]; count: number };
  day: number;
  rngSeed: number;
  saveVersion: 1;
}
```

## 五、代码落点（不新增设计文档）

```
mvp/
├── DECISIONS.md          ← 本文件（跑通后对账用）
├── index.html
├── package.json
├── src/state.ts  save.ts  main.ts
├── src/systems/absorb.ts（已有） cultivate.ts  breakthrough.ts  event.ts
├── src/data/locations.ts  events.ts
└── tests/
```

## 六、实现期补充决议（2026-11-16 下午）

| 项 | 决定 | 说明 |
|---|---|---|
| **剧情标记落点** | `MvpCharacter.plotFlags: string[]`，去重累积、写入存档 | R3 的「剧情标记」原本没有数据落点，实现时补上 |
| **老存档兼容** | 存储层 `withDefaults()` 兜底：缺 `plotFlags` 补 `[]`，缺 `eventState` 补空 | 无迁移脚本时的最低成本方案 |

> 这两条是实现过程中发现的缺口，不是设计变更；对账时一并核对 01-02（性格）/02-01（事件）是否需要对应的字段定义。

## 七、实现期补充（2026-11-17）

> 本轮加的是「境界细分 + 功法栏」两块，仍属临时拍板，对账时与 01-01（境界）/
> 02-01（功法）核对。

| 项 | 决定 | 说明 |
|---|---|---|
| **境界细分** | `Realm` 不变（炼气/筑基/金丹），新增 `stage: '前期' \| '中期' \| '后期'`，共 9 阶 | 展示统一为 `炼气·中期`；事件池仍按 `realm` 划分，不受阶位影响 |
| **9 阶阈值** | `STAGE_TABLE`：0 / 100 / 240 / 430 / 700 / 1080 / 1600 / 2300 / 3200 | 取代原三阶 `REALM_THRESHOLDS`（100 / 500）；`REALM_THRESHOLDS` 保留为「境界起始阈值」派生值 |
| **本阶上限** | 下一阶阈值 × 4；顶阶（金丹·后期）用自身阈值 × 4 = 12800 | 沿用 `CULTIVATION_MAX_FACTOR`，公式不变，只换成阶位粒度 |
| **突破语义** | 成功：阶位 +1、`cultivation -= nextThreshold`；失败：扣 20%、阶位不变；顶阶再点：失败不扣 | 原三阶分支原样沿用，只是「+1 境界」变成「+1 阶」 |
| **功法栏** | 角色删单 `technique`，改成 `techniques: Technique[]`（恒 3 槽）+ `activeSlot: 0\|1\|2`，吸收只用 `techniques[activeSlot]` | 为后续「功法搭配」留结构；本轮只做切换，不做功法成长 |
| **功法库** | `TECHNIQUE_LIBRARY` 5 条：青木 0.12 / 烈火 0.15 / 厚土 0.175 / 庚金 0.20 / 玄水 0.225（综合效率 = absorbRate × convertRate） | 默认三槽 `[青木, 烈火, 厚土]`，`activeSlot = 0`；库 id 与名称分离，存档只存三系数 |
| **app 新方法** | `setActiveSlot(index)`、`setSlotTechnique(slot, techniqueId)` | 未知 id / 槽位越界抛错（`techniqueById` + `assertTechniqueSlot`） |
| **老存档迁移** | `withDefaults()` 补 `stage` / `techniques` / `activeSlot`，旧 `technique` 迁到槽 0 后删除；缺阶位时按新阶位表重算阈值与上限 | 旧三阶数值（如筑基 500 / 上限 2000）不再冒充新表；迁移后立即自洽 |

**验算（火山 + 默认灵根，原始入池 88.55）**：青木诀 10.626 / 烈火诀 13.2825 /
厚土诀 15.49625 / 庚金诀 17.71 / 玄水诀 19.92375 修为每次 —— 换功法后单次吸收
变化 ≈ 1.87 倍（0.12 → 0.225），浏览器里一眼能看出。

## 八、实现期补充（2026-11-17 下午）：事件模块 / 物品 / 无功法门禁

> 本轮把事件抽成独立模块、加最小物品系统，并把功法改成「历练获得 → 背包 →
> 装备到槽位」；对账时与 01-01（功法）/ 02-01（事件）核对。

| 项 | 决定 | 说明 |
|---|---|---|
| **事件模块** | 新建 `src/event/`：`types` / `pool`（索引）/ `picker`（LCG 抽取）/ `resolver`（选项结算）/ `index`（`createEventSystem`：`next` / `resolve` / `list` / `byId`） | 事件数据仍留在 `data/events.ts`；`systems/event.ts` 降为兼容 re-export，旧 import 不动 |
| **物品/背包** | `InventoryItem { uid, kind: 'technique', techniqueId, fromEventId, obtainedAt }`，`MvpCharacter.inventory: InventoryItem[]`，初始 `[]` | 同一 `techniqueId` 只保留一条（`addItem` 去重），`uid` 只是实例 id |
| **功法槽** | `techniques: (string \| null)[]`（恒 3，元素是功法 id，空槽 null），`activeSlot: 0 \| 1 \| 2`；删除「槽里存 Technique 对象」写法 | 初始 `START_SLOTS = [null, null, null]`、`START_INVENTORY = []`；`START_TECHNIQUE` 只作为纯函数测试的数值样本保留 |
| **无功法门禁** | 当前生效槽为空 → `absorb()` 返回 `{ gain: 0, blocked: true }`，修为 +0、**不推进时间 / 种子** | 吸收按钮仍可点；UI 日志「没有功法，灵气散于经脉」；历练不受影响 |
| **功法掉落** | 选项级 `option.grants`，进背包但不自动装备；`lianqi-01` 选项 0 保底 `qingmu`，其余四本各 1 条（见 DESIGN 掉落表） | 同一条事件靠 `doneIds` 不重复抽；已拥有时 `addItem` 忽略并在 `EventTurn.duplicates` 回报 |
| **app 新 API** | `equipTechnique(slot, itemUid)`、`ownedTechniques()`、`inventory()`；`setSlotTechnique(slot, id)` 保留但要求已拥有 | 装备不改 `activeSlot`；UI 下拉只列背包功法，槽位按钮切换生效位 |
| **老存档迁移** | 对象数组 / 单 `technique` 按 id 或名字匹配 `TECHNIQUE_LIBRARY` → id 数组；匹配不到置 null；匹配到的补进 `inventory`（`fromEventId: 'migrated'`） | 缺 `inventory` → `[]`，缺 / 非法 `activeSlot` → 0；`migrateStage` / `migrateTime` 不变 |
| **测试** | 61 条旧测试全部保留并更新；新增 `inventory` / `event-system` / `absorb-gate` 三个文件，共 85 条 | `node --test tests/*.test.ts` 85 通过；`npx vite build` 通过 |

## 九、破境丹口径（2026-11-19 W 拍板：方案 3）

- 破境丹是**突破必需品**：没有它不能突破
- 每次突破**消耗 1 枚**，**成功与失败都消耗**（方案 3，惩罚最重）
- 破境丹不能手动使用；缺口时界面提示、按钮禁用
- 事件池合计可拿 10 枚，覆盖 8 次突破 + 2 枚容错


## 十、事件双池与破境丹改加成（2026-11-19 W 拍板）

- 事件分两类：**奇遇（story，一次性）** 与 **日常（daily，冷却 3 天可复用）**
- 抽取优先级：奇遇未抽完优先奇遇；抽干后从冷却好的日常里抽
- 奇遇只给永久收益：功法、破境丹、剧情标记、大额修为
- 日常只给普通回报：修为 +5~10、止血草 / 回气丹 / 聚元丹
- **破境丹改为突破加成**：有丹 → 必定成功并消耗 1 枚；无丹 → 基础成功率 80%，失败扣 20% 修为（不扣丹）
- 因此破境丹可以只在奇遇掉落，不会造成卡关
