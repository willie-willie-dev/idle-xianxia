# 登仙 · 设计文档 ↔ 代码实现 ↔ 手工测试清单

> 仓库：`/home/lovecactus/projects/idle-xianxia`  
> 生成基准：源码与 `docs/` 下全部 `.md` 文件梳理（不包含未纳入版本库的其它路径）。  

---

## 一、文档与功能模块总览

| 设计文档 | 功能模块摘要 | 与实现对齐备注 |
|-----------|----------------|----------------|
| `01-角色属性系统.md` | 六项属性、等级经验、五行成长倍率、境界倍率、`calculateFinalStats` 合成规则 | ✅ `systems/characterSystem.ts`、`Character` 存档字段 |
| `02-装备系统.md` | 五槽穿戴、品质、掉落/强化公式、`getEnhancedStats` | ⚠️ 主流程行囊 UI 在主界面为 `GameScreen` 内嵌实现；`components/EquipmentBag.tsx` 走 `gameStore`，与存档主链路分离 |
| `03-技能与战斗系统.md` | 技能类型、`Skill` 数据、被动/天赋写入面板加成、`combatSystem` | ⚠️ `accountStore.getFinalStats` 已汇总被动增益；**无挂载 `SkillPanel` 的页面**（`SkillPanel.tsx` 仅演示 `gameStore`） |
| `04-事件系统.md` | 随机事件触发、`GameEvent`、`resolveEvent`、奖励结算 | ✅ `eventSystem`、`accountStore.resolveEvent`、`GameScreen` 弹窗 |
| `05-周天系统.md` | 五槽功法、紫薇中枢、固定灵根开销等 | ❌ UI 未接：`GameScreen` 中周天按钮与 `RefineModal` 已注释；`doRefineSpirit` 在 store 存在但无入口 |
| `06-时间系统.md` | `GameTime`、闰年、历练/周天消耗天数、顶栏显示 | ⚠️ `types/time.ts` 与 `formatGameTime` 显示一致；**`accountStore` 路径下 `gameTime` 仅在创角时初始化，未随历练/挂机推进**（与文档「操作消耗时间」不完全一致） |
| `07-页面导航框架.md` | `AppScreen`、全屏页切换、`accountStore` 导航 | ✅ `App.tsx` + `accountStore`；文档指出的 `CharacterScreen`/`gameStore` 数据不一致风险仍存在 |
| `页面切换动画框架设计.md` | 全局转场与修仙动效方案 | ⚠️ 设计未落地；仅 `EventScreen` 使用 `framer-motion` 入场 |
| `角色模板设计规范.md` | 角色纸面模板：七灵根 100%、灵气上限表、遭遇书写格式 | ✅ 与创角七灵根、`cultivationSystem` 灵气上限方向一致；物品块多为占位 |
| `多角色账号系统.md` | 多角色、`localStorage`、Entry/Create/Game | ✅ `entry` / `create` / `game`；删除为二次确认弹层（非长按） |
| `事件链模板.md` | 事件链/类型策划指引（含 `spiritReward` 等） | 📋 策划文档；实现以 `src/data/events.ts` + `eventSystem` 为准 |
| `机缘事件模板.md` | 机缘类 YAML 模板示例 | 📋 与 `事件链模板.md` 同类；**与当前 TS 事件表无自动对应关系** |

---

## 二、设计文档 → 功能 → 页面/组件对照表

| 文档 | 功能域 | 实际入口（UI / 组件） | 关键代码位置 |
|------|--------|------------------------|--------------|
| `多角色账号系统.md`、`07-页面导航框架.md` | 选角、登录、登出 | **选角**：`EntryScreen`；**辞行**：`GameScreen` 顶栏「辞行」 | `App.tsx`，`store/accountStore.ts` |
| `多角色账号系统.md`、`角色模板设计规范.md`（灵根） | 创角 | **创建角色**：`CharacterCreate`（名、七灵根滑条、性别） | `screens/CharacterCreate.tsx` |
| `01-角色属性系统.md`、`角色模板设计规范.md` | 境界名、道种进度、资源条 | **主界面**英雄卡 `HeroSummary`；顶栏境界/道种；手风琴「人物」内 `CharacterResourcesStrip` | `screens/GameScreen.tsx` |
| `01-角色属性系统.md`、`角色模板设计规范.md`（灵气） | 灵根配比、各系灵气条、小境界道种 | **人物详情全屏**或主界面手风琴展开「人物」→ `CharacterPanel` | `navigateToCharacter` → `CharacterScreen`；`GameScreen` 手风琴 |
| `02-装备系统.md` | 背包列表、佩戴、淬炼 | **主界面**手风琴「行囊」→ 内嵌行囊列表 | `GameScreen` 内 `EquipmentBag` 局部组件（非 `components/EquipmentBag.tsx`） |
| `02-装备系统.md` | （独立人物页的背包） | **人物详情**底部 `EquipmentBag` | ⚠️ `CharacterScreen` 引用 `components/EquipmentBag.tsx`，该组件**不接受** `bag` props，实际仍读 `gameStore`，与多角色存档**易不一致** |
| `03-技能与战斗系统.md` | 技能列表展示 | **当前无主流程页面挂载** | `components/SkillPanel.tsx`（未在 `App` 或 `GameScreen` 引用） |
| `04-事件系统.md` | 事件弹窗选择与结算 | 满足触发条件后 **主界面遮罩** `EventModal` | `GameScreen` 内联 `EventModal` + `accountStore.resolveEvent` / `dismissEvent` |
| `04-事件系统.md` / 历练 | 三象历练：吸纳/奇遇/争斗 | **历练**按钮 → `EncounterSelectModal` → `EventScreen` | `GameScreen`，`components/EncounterSelectModal.tsx`，`screens/EventScreen.tsx` |
| `05-周天系统.md` | 周天/功法槽 | **无**（按钮与 `RefineModal` 注释） | `GameScreen` 注释；`components/RefineModal.tsx`；`doRefineSpirit` |
| `06-时间系统.md` | 游戏内日期显示 | **顶栏**标题块下方 `formatGameTime(gs.gameTime)` | `GameScreen` header |
| `06-时间系统.md` | 时间随操作推进 | **主存档链路未完整实现** | `gameStore.tickIdle` 有 `advanceDays`；`accountStore` 未写回 `gameTime` |
| `页面切换动画框架设计.md` | 页面转场 | 仅历练结算页有入场动效 | `EventScreen` `motion.div` |

---

## 三、手工测试清单

以下每条均包含：**入口**、**预期**、**验证方式**（含建议截图点）。

### 3.1 导航与多角色（`多角色账号系统.md`、`07-页面导航框架.md`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| N-01 | 启动应用 → `EntryScreen` | 显示已有角色卡片与「创建角色」（未满 3 人时） | 全屏选角页截图 |
| N-02 | 点击某角色卡片 | 进入 `GameScreen`，顶栏显示该角色名与境界信息 | 主界面截图 |
| N-03 | 主界面「辞行」 | 回到 `EntryScreen`，不丢失其它槽位角色（`localStorage`） | 辞行前后各一张；刷新页面后角色仍在 |
| N-04 | `EntryScreen` 卡片上 🗑️ → 确认删除 | 该角色从列表消失，存档删除 | 删除前后列表截图 |

### 3.2 创建角色（`角色模板设计规范.md`、`多角色账号系统.md`、`01-角色属性系统.md` 灵根部分）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| C-01 | 选角页「创建角色」 | 进入 `CharacterCreate` | 截图 |
| C-02 | 角色名：非法字符/过短/重名 | 表单错误提示；重名不可创建 | 故意输入英文、1 字、重复名各试一次并截图 |
| C-03 | 七灵根滑条（非坤） | 步进 5%；六项调整后坤自动为 `100 - 和` | 拖动后截图数值行 |
| C-04 | 「踏入仙途」成功 | 进入 `GameScreen`，日志有欢迎语；英雄卡灵根类型与配比合理 | 主界面 + 人物面板截图 |

### 3.3 主界面与角色信息（`01-角色属性系统.md`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| H-01 | `GameScreen` 顶栏 | 显示游戏内时间字符串、境界名、道种进度数字 | 顶栏截图 |
| H-02 | 英雄卡 `HeroSummary` | 显示姓名、灵根类型标签、境界行、道种进度条 | 卡片截图 |
| H-03 | 手风琴「人物」 | 展开后见资源条（灵石/修为/气血/灵力）与 `CharacterPanel` | 展开态截图 |
| H-04 | `CharacterPanel` 内灵根饼图与灵气条 | 仅非零灵根显示；灵气条上限与灵根比例相关文案存在 | 人物区截图 |
| H-05 | 手风琴「人物」行点击（整行） | 导航到 `CharacterScreen`（全屏人物详情） | 操作录屏或跳转前后对比截图 |
| H-06 | `CharacterScreen`「返回」 | 回到 `GameScreen` | 返回后主界面截图 |

### 3.4 装备与行囊（`02-装备系统.md`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| E-01 | 主界面手风琴「行囊」 | 列表显示背包物、基础属性标签、「佩戴」「淬炼」 | 非空背包截图 |
| E-02 | 「佩戴」 | 装备进入对应槽位，原槽装备回包（若存在） | 佩戴前后属性/行囊对比 |
| E-03 | 「淬炼」 | 消耗灵石（费用随强化等级变化），`+N` 增长 | 淬炼前后灵石与等级截图 |
| E-04 | `CharacterScreen` 底部背包 | ⚠️ **预期应显示当前账号背包**；若仍显示默认 `gameStore` 数据则记缺陷 | 与主界面行囊列表对比截图（应一致） |

### 3.5 历练与遭遇 UI（`04-事件系统.md`、`角色模板设计规范.md` 遭遇、`data/encounters.ts`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| M-01 | 「⚔ 历练」 | 弹出 `EncounterSelectModal`，含吸纳/奇遇/争斗等选项 | 弹层截图 |
| M-02 | 选择「吸纳灵气」等 | 进入 `EventScreen` 叙事页 → 「继续」→ 结算页 | 两屏各截图 |
| M-03 | `EventScreen`「完成」 | 回到 `GameScreen`；`executeEncounter` 已写入存档（修为/灵气/日志） | 「仙途札记」出现「机缘落定」类日志截图 |
| M-04 | 第四格「危机四伏」 | 当前为 **占位**：`kind` 仍为 `absorb`，行为同吸纳或与预期不符时需记 **待开发** | 选第四项并截图结算 |

### 3.6 随机事件弹窗（`04-事件系统.md`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| V-01 | 触发挂机 `tickIdle` / 战斗等能产生事件的逻辑（若在 UI 可调） | 出现 `EventModal` 遮罩，展示标题、描述、选项 | 弹窗截图 |
| V-02 | 选择某一选项 | 执行 `resolveEvent`：属性/修为/金石/灵气/装备进包等按数据结算；弹窗关闭 | 前后角色面板或日志截图 |
| V-03 | 点击遮罩空白（若有 `onDismiss`） | **当前实现：** `dismissEvent` 关闭事件且不结算 | 截图 + 札记确认无选中记录 |

### 3.7 大境界突破（`01-角色属性系统.md` 与存档内 `performMajorRealmBreakthrough`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| B-01 | 「🌟 踏入…」在满足条件时可点 | 成功则境界提升、`SKILLS_DATA` 中新城解锁技能并入 `gs.skills`；日志有大境界文案 | 突破前后境界与技能列表（若可查 devtools/localStorage）截图 |

### 3.8 时间与周天（`06-时间系统.md`、`05-周天系统.md`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| T-01 | 任意多次历练完成 | **设计预期：**游戏内日期应按规则前进 | ⚠️ 当前 `accountStore` 不写 `gameTime`：多日历练后日期**可能不变**，记一致性缺陷或「仅显示静态初值」 |
| T-02 | 「周天」类按钮 | 设计文档中的紫薇槽运转 | ❌ UI 未开放；不测功能，仅核对无入口截图 |
| Z-01 | — | **设计：**`doRefineSpirit` / `RefineModal` | 源码存在无入口；不测 UI |

### 3.9 技能系统（`03-技能与战斗系统.md`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| S-01 | 战斗中或技能面板 | 文档描述的主动技能释放与 CD | **当前无主界面技能面板**；可通过最终属性是否含被动增益间接验证 |
| S-02 | DevTools：`localStorage['idle_xianxia_accounts']` | `skills` 数组随解锁变化 | JSON 摘录截图 |

### 3.10 页面动效（`页面切换动画框架设计.md`、`07-页面导航框架.md`）

| ID | 入口 | 预期 | 如何验证 |
|----|------|------|----------|
| A-01 | `entry`→`game` 等全局切换 | 设计：统一 blur/fade | ⚠️ 当前无明显转场（除 EventScreen）；录屏即可 |
| A-02 | 进入 `EventScreen` | 淡入位移动效 | 录屏截取前 0.5s |

---

## 四、建议在回归前确认的「已知缺口」清单（便于与策划对齐）

1. **`CharacterScreen` + `components/EquipmentBag`**：组件 API 不匹配，数据源为 `gameStore`，与持久化存档易错位（见 `07-页面导航框架.md` 技术债描述）。  
2. **`SkillPanel`**：未挂载，玩家不可见技能列表。  
3. **`gameTime`**：帐号主链路未递增，与设计文档 PART 二中「历练消耗时间」段落存在差距。  
4. **`ENCOUNTER_OPTIONS` 第四项**：占位重复的 `absorb`。  
5. **`05-周天系统.md`**：槽位 UI 未实现，`RefineModal` 待命。

---

## 五、交付物说明

- **文件路径：** `docs/设计UI测试清单.md`  
- **内容结构：** § 一文档—模块映射；§ 二文档→UI 对照表；§ 三分模块测试清单；§ 四实现缺口备忘。

如需将本节导出为 QA 工单表格（CSV/Issue），可在此文件基础上分列 `ID / 严重性 / Owner`。
