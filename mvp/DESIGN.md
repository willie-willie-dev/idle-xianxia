# 登仙 · MVP 实现设计 v0.1

> 代码区文档，**不进 `design-docs/`**。等 MVP 跑通后与设计文档对账再统一。
> 决议依据：`notes/2026-11-16-dengxian-mvp-decisions.md`（R1–R5 已临时拍板）。

## 1. 目标与非目标

**目标**：一个本地 HTML 项目，能创建角色、存档、按“吸收 → 修炼 → 突破 → 事件”循环不断转起来，刷新后进度还在。

**非目标**：战斗、装备、多角色账号、性格/战意/精神状态、奇遇生成器、任何后端。

## 2. 分层

```
UI (index.html + src/ui/*)        只做渲染与事件绑定，不含规则
   ↕
应用层 (src/app.ts)               编排：一次“吸收/突破/事件”= 读档→算→写档→渲染
   ↕
领域层 (src/systems/*.ts)         纯函数，无 I/O：absorb / cultivate / breakthrough / event
   ↕
存储层 (src/storage/*.ts)         CharacterRepository 接口 + IndexedDB 实现 + Memory 实现
```

**铁律**：领域层不 import 存储层和 DOM；存储层不 import 领域层（只存结构化的 `MvpCharacter`）。

## 3. 数据模型

```ts
type WuXing = '金' | '木' | '水' | '火' | '土';
type Realm = '炼气' | '筑基' | '金丹';
type RealmStage = '前期' | '中期' | '后期';        // 9 阶 = 3 境界 × 3 阶
type TechniqueId = 'qingmu' | 'liehuo' | 'houtu' | 'gengjin' | 'xuanshui';
type SpiritRootKey = 'fire' | 'water' | 'wood' | 'metal' | 'earth' | 'qian' | 'kun';
type Roots = Record<SpiritRootKey, number>;          // 复用 mvp/absorb.ts，合计 100

interface TimeState {            // v0.2：天为最小单位，不引入时辰/phase
  day: number;                   // 第几天，从 1 开始
  tick: number;                  // 累计推进天数
}

interface MvpCharacter {
  id: string;                    // crypto.randomUUID()
  name: string;
  spiritRoots: Roots;
  element: WuXing;
  realm: Realm;
  stage: RealmStage;             // 境界内阶位，展示为「炼气·中期」
  cultivation: number;
  cultivationMax: number;
  nextThreshold: number;         // 进入下一阶所需修为；顶阶 = 自身阈值
  techniques: Technique[];       // 功法三槽，长度恒为 3（不再有单 technique 字段）
  activeSlot: 0 | 1 | 2;         // 当前生效槽位，吸收只用 techniques[activeSlot]
  eventState: { doneIds: string[]; count: number };
  plotFlags: string[];           // R3 剧情标记，去重累积（2026-11-16 实现期补充）
  time: TimeState;
  rngSeed: number;
  saveVersion: 1;
  createdAt: number;             // epoch ms，列表排序用
  updatedAt: number;
}

interface CharacterSummary {     // 列表只读这几个字段，避免拉全量
  id: string; name: string; realm: Realm; stage: RealmStage;
  cultivation: number; day: number; createdAt: number;   // 摘要仍用扁平 day
}
```

## 4. 存储设计（IndexedDB）

库名 `dengxian-mvp`，版本 `1`：

| objectStore | keyPath | 索引 | 内容 |
|---|---|---|---|
| `characters` | `id` | `createdAt` | 完整 `MvpCharacter` |
| `meta` | `key` | — | `{key:'activeId', value:string}`、`{key:'schemaVersion', value:1}` |

**迁移策略**：`onupgradeneeded` 里按 `oldVersion` 递进建表；`schemaVersion` 与 `saveVersion` 分开（前者是库结构，后者是角色数据格式）。
读取时用 `withDefaults()` 兜底补齐后加字段（`plotFlags`、`eventState`），避免老存档在无迁移脚本时报错。

**接口**（`CharacterRepository`）：

```ts
interface CharacterRepository {
  list(): Promise<CharacterSummary[]>;
  get(id: string): Promise<MvpCharacter | null>;
  create(input: CreateCharacterInput): Promise<MvpCharacter>;
  update(id: string, patch: Partial<MvpCharacter>): Promise<MvpCharacter>;
  remove(id: string): Promise<void>;
  getActiveId(): Promise<string | null>;
  setActiveId(id: string | null): Promise<void>;
}
```

实现两份：
- `IndexedDbCharacterRepository`（浏览器）
- `MemoryCharacterRepository`（单测，行为一致）

## 5. 领域函数（纯函数）

```ts
// 吸收：输入地点、灵根、功法 → 产出修为增量（复用 absorb()）
cultivate(absorbResult): { cultivationGain: number }

// 突破：输入 cultivation / nextThreshold / rng → 结果
tryBreakthrough({cultivation, nextThreshold, realm, stage}, rngSeed): {
  success: boolean;
  realm: Realm; stage: RealmStage;
  cultivation: number; cultivationMax: number; nextThreshold: number;
  lost: number;               // 失败扣除量
  nextSeed: number;           // 线性同余，保证可复现
}

// 事件：从池里抽一条（按境界 + 未完成 + 种子），应用选项回报
pickEvent({realm, doneIds, seed}) : { event, nextSeed }
applyOption(character, event, optionIndex): { cultivation, plotFlags, nextSeed }
```

**数值常量**集中在 `src/data/balance.ts`，全部可调：

| 常量 | 值 |
|---|---|
| FAIL_LOSS_RATE | 0.20（失败扣当前修为，阶位不变） |
| DEFAULT_ROOTS | 乾15 坤10 五行各15 |
| LOCATIONS | 火山（火200+土30）、灵泉（水200+木50） |
| EVENT_POOL | 24 条（每境界 8 条，文案 v0.2 已写完），单选项 +5~15 修为或剧情标记 |
| ACTION_DAYS | 吸收 1 天 / 历练 0 天 / 突破 0 天（事件可用 `days` 覆盖为 2~7 天） |

**阶位表（`STAGE_TABLE`，9 项，索引即阶位）**：

| # | 阶位 | 进入所需修为 | 本阶上限 |
|---|---|---|---|
| 0 | 炼气·前期 | 0 | 400 |
| 1 | 炼气·中期 | 100 | 960 |
| 2 | 炼气·后期 | 240 | 1720 |
| 3 | 筑基·前期 | 430 | 2800 |
| 4 | 筑基·中期 | 700 | 4320 |
| 5 | 筑基·后期 | 1080 | 6400 |
| 6 | 金丹·前期 | 1600 | 9200 |
| 7 | 金丹·中期 | 2300 | 12800 |
| 8 | 金丹·后期 | 3200 | 12800（顶阶，自身阈值 ×4） |

- `nextThreshold` = 下一阶阈值；顶阶回落到自身阈值。
- 本阶上限 = 下一阶阈值 × 4（`CULTIVATION_MAX_FACTOR`）。
- 突破成功：阶位 +1（前期→中期→后期→下一境界·前期），`cultivation -= nextThreshold`（不为负）。
- 突破失败：扣当前修为 20%，阶位不变；顶阶再突破：失败、不扣、保持原状。

**功法库（`TECHNIQUE_LIBRARY`，综合效率 = absorbRate × convertRate）**：

| id | 名称 | absorbRate | convertRate | 综合效率 |
|---|---|---|---|---|
| `qingmu` | 青木诀 | 0.40 | 0.30 | 0.120 |
| `liehuo` | 烈火诀 | 0.60 | 0.25 | 0.150 |
| `houtu` | 厚土诀 | 0.35 | 0.50 | 0.175 |
| `gengjin` | 庚金诀 | 0.50 | 0.40 | 0.200 |
| `xuanshui` | 玄水诀 | 0.25 | 0.90 | 0.225 |

- 默认三槽：`[青木诀, 烈火诀, 厚土诀]`，`activeSlot = 0`（`START_TECHNIQUE` = 青木诀）。
- `app.setActiveSlot(index)` 切换生效槽位；`app.setSlotTechnique(slot, id)` 从库里换功法（未知 id / 槽位越界抛错）。
- 老存档迁移：缺 `stage` → 前期；缺 `techniques` → 由旧 `technique` 生成 `[旧功法, 烈火诀, 厚土诀]`；两者都缺 → 默认三槽；随后删除旧 `technique` 字段。

## 6. 一个循环的时序

```
用户点「吸收」
 → app: repo.get(activeId)
 → domain: absorb(location, roots, techniques[activeSlot]) → cultivate()
 → character.cultivation = min(cultivation + gain, cultivationMax)
 → time: TimeService.advance(character.time, ACTION_DAYS.absorb, 'absorb') ; rngSeed 推进
 → repo.update() → 渲染
（修为 ≥ nextThreshold 时，「突破」按钮亮起）

用户点「突破」
 → domain: tryBreakthrough()（20% 失败扣当前修为）
 → 成功：阶位 +1（realm/stage 一起推进）、修为扣阈值、阈值与上限更新
 → time: advance(0 天) 只走 action 钩子
 → repo.update() → 渲染

用户点「历练」
 → domain: pickEvent() → 用户选择 → applyOption()
 → time: advance(event.days ?? ACTION_DAYS.event, 'event')（耗时事件 2~7 天）
 → 修为/剧情标记写入 → repo.update()
```

## 7. 文件树

```
mvp/
├── DESIGN.md                  本文件
├── DECISIONS.md               临时拍板记录（对账用）
├── package.json               vite + typescript（仅浏览器构建用，测试不需要）
├── index.html
├── src/
│   ├── types.ts               MvpCharacter 等全部类型
│   ├── data/balance.ts        数值常量
│   ├── data/locations.ts
│   ├── data/events.ts         24 条事件
│   ├── systems/absorb.ts      已有（PR #4）
│   ├── systems/cultivate.ts
│   ├── systems/breakthrough.ts
│   ├── systems/event.ts
│   ├── time/types.ts           TimeState / TimeReason / TimeHook
│   ├── time/time-service.ts    TimeService（逐天推进、钩子排序与隔离）
│   ├── storage/repository.ts  接口 + 内存实现
│   ├── storage/indexeddb.ts   IndexedDB 实现
│   ├── app.ts                 编排
│   └── ui/render.ts           最小 DOM 渲染
└── tests/
    ├── repository.test.ts     CRUD 全链路（内存实现）
    ├── cultivate.test.ts
    ├── breakthrough.test.ts   成功/失败/阈值递推
    ├── stage.test.ts          9 阶阈值表、逐阶推进、顶阶、失败扣 20%
    ├── technique.test.ts      三槽默认值、换功法产出、迁移
    ├── time.test.ts           0/1/多天推进、钩子顺序与隔离、非法天数
    └── event.test.ts          抽事件、禁空结算、种子可复现
```

## 8. 测试策略

- 用 `node --test mvp/tests/*.test.ts`（Node 24 原生跑 ts，无需 tsc）
- 领域函数：纯输入输出，覆盖边界（修为刚好等于阈值、上限封顶、失败扣到负数）
- 存储层：内存实现跑完整 CRUD；IndexedDB 实现只做“接口对齐 + 手动验证”
- 每个测试文件独立，不共享状态

## 9. 验收（人肉，最后一关）

1. 新建角色 → 出现在列表 → 进入游戏
2. 连点吸收 8–12 次 → 修为到 100 → 突破成功 → 阶位变「炼气·中期」
3. 刷新浏览器 → 角色与进度还在
4. 删除角色 → 列表消失、`activeId` 清空
5. 断网（或直接 file:// 打开）不报错

## 10. 风险

| 风险 | 处理 |
|---|---|
| IndexedDB 在 file:// 下不可用 | 提供 `?storage=memory` 降级参数，或文档要求用 `npm run dev` |
| 临时数值与设计文档冲突 | 全部集中在 `balance.ts`，对账时只改一处 |
| 事件池内容质量低 | 先 24 条占位，跑通后再写 |
