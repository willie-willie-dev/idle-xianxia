# 登仙 · SPA 页面导航框架设计

> **状态**：可执行方案（与当前代码对齐，便于迭代实现）  
> **范围**：不引入 `react-router`，以 Zustand + `AppScreen` 枚举为核心。

---

## 一、现状分析

### 1.1 `App.tsx` 的路由机制

当前 `App` 是一个**纯手工的条件渲染路由器**：订阅 `useAccountStore` 的 `screen` 字段，按 `AppScreen` 取值挂载不同全屏组件。

```tsx
// 机制概要（非逐字引用）
const { screen } = useAccountStore();
if (screen === 'entry') return <EntryScreen />;
if (screen === 'create') return <CharacterCreate />;
if (screen === 'event') {
  // 从持久化存档读取 pendingEncounterKind，并注入 EventScreen
  return <EventScreen encounterKind={...} onComplete={() => navigateToGame()} />;
}
if (screen === 'character') return <CharacterScreen />;
return <GameScreen />;
```

特点：

- **单例顶层视图**：任意时刻只显示一个“屏幕”组件，符合轻量 SPA。
- **`event` 屏带参数**：`encounterKind` 不落 URL，而是由 `SavedGameState.pendingEncounterKind`（运行时写入、可序列化但注释标明为导航辅助）+ `App` 读取后作为 props 传入。
- **返回路径不统一**：部分页面用 `navigateToGame()`，创建页用 `navigateTo('entry')`，需在框架层区分“主导航”与“子栈返回”。

### 1.2 `src/screens/` 页面清单

| 文件 | 组件 | 对应 `AppScreen` | 说明 |
|------|------|------------------|------|
| `EntryScreen.tsx` | 入口 / 选角 | `entry` | 账号列表、登录、跳转创建 |
| `CharacterCreate.tsx` | 创建角色 | `create` | 完成后进入 `game` |
| `GameScreen.tsx` | 主玩法 | `game`（及 fallback） | 若 `screen !== 'game'` 或无存档会显示占位 |
| `CharacterScreen.tsx` | 人物详情 | `character` | 应从 `game` 进入 |
| `EventScreen.tsx` | 历练遭遇演出 | `event` | 由 `navigateToEvent(kind)` 进入，`onComplete` → `navigateToGame` |
| `GameScreen.tsx.bak` | — | — | 备份文件，不参与构建 |

### 1.3 屏幕状态实际所在：`accountStore`，不是 `gameStore`

- **`screen: AppScreen`** 与 **`navigateTo` / `navigateToGame` / `navigateToCharacter` / `navigateToEvent`** 均定义在 **`src/store/accountStore.ts`**。
- **`src/store/gameStore.ts`** 仍是另一套本地演示态（初始角色、独立 `GameState`），**与多账号持久化存档未打通**。

**重要技术债**：`CharacterScreen` 若使用 `useGameStore` 读取人物与背包，会与主流程的 `accountStore` + `storage.gameStates` **数据不一致**（界面可能显示默认初始角色而非当前账号）。人物页应与其他已接入存档的界面一致，**统一从 `accountStore.getActiveGameState()` / `storage` 推导**，或抽取只读的 `useActiveGameSelectors`。

`AppScreen` 定义见 `src/types/account.ts`：

```ts
export type AppScreen = 'entry' | 'create' | 'game' | 'event' | 'character';
```

---

## 二、设计问答

### a) 是否需要改造成基于 URL 的 SPA 路由（如 react-router）？

**建议：现阶段不必引入 react-router。**

| 维度 | 判断 |
|------|------|
| 产品形态 | 单机页游式、强状态在 Zustand + localStorage，深链分享需求弱 |
| 当前结构 | 顶层屏幕数量少，`AppScreen` 已能表达全集 |
| 迁移成本 | 需处理 `Set`/`Map` 等与 URL 不同步、以及 `pendingEncounterKind` 与历史栈的同步 |
| 何时再考虑 | 需要分享链接直达某角色、或 Web 嵌入多入口、或要做浏览器前进/后退与存档强一致时 |

若未来接入路由，也建议**保留 `AppScreen` 为单一真相**，URL 仅作为序列化视图（例如 `?screen=character`），而不是让路由表取代业务状态机。

### b) 在现有 Zustand 模型下，统一的页面跳转框架应如何设计？

推荐三层结构：

1. **`AppScreen` 枚举**  
   继续作为“顶层全屏视图”的唯一标识，扩展时只改类型 + 注册表。

2. **导航 API（accountStore）**  
   - **跃迁**：`navigateTo(screen: AppScreen)` — 用于 `entry` ↔ `create`、`login` 等到 `game` 等**已存在**的路径。  
   - **语义化封装**：`navigateToGame()`、`navigateToCharacter()`、`navigateToEvent(kind)` — 避免业务层散落魔法字符串，并在同一处写入与屏相关的存档字段（如 `pendingEncounterKind`）。

3. **（推荐新增）导航栈 `screenStack: AppScreen[]` 或 `previousScreen: AppScreen | null`**  
   - 用于 `character`、`event` 等“自 `game` 推出”的屏：**返回** = `pop` 或回到记录的 `previous`，而不是写死 `navigateToGame()`。  
   - 规则示例：`navigateToCharacter()` 执行 `set({ previousScreen: 'game', screen: 'character' })`；关闭人物页 `navigateBack()` → `set({ screen: previousScreen, previousScreen: null })`。  
   - `event` 完成时同样可走 `navigateBack()`，与“从哪来”一致（若永远是 `game`，可简化为仍调用 `navigateToGame()`）。

可选增强：

- **`ScreenRegistry`**：`Record<AppScreen, React.ComponentType<...>>` 或工厂函数，避免 `App.tsx` 无限 `if`。  
- **守卫**：`navigateTo('game')` 前校验 `activeAccountId` 与 `gameStates[id]` 存在，避免 `GameScreen` 出现“造化加载中”闪烁。

### c) 每个页面应有的通用组件？

建议抽 **一层极薄的布局原语**（名称可自定）：

| 组件 | 用途 |
|------|------|
| `ScreenRoot` | 统一全屏容器 class（`screen-root` / safe-area / 背景） |
| `ScreenHeader` | 左侧返回、中间标题、右侧可选操作；返回行为由 props 或 `navigateBack` 注入 |
| `ScreenBody` | 可滚动主区域（可选） |
| `ScreenFooter` | 底部主按钮区（可选） |

**按页面类型强制规范：**

| 页面类型 | 返回行为 | `ScreenHeader` |
|----------|----------|----------------|
| 入口 `entry` | 无（或仅“关于”类侧层） | 品牌区即可 |
| 引导 `create` | 返回 `entry` | **要**：返回 |
| 主壳 `game` | 无返回上一级；可提供“登出” | 已有 `game-header-xian`，保持 |
| 子页 `character` | 返回上一屏（通常为 `game`） | **要**：返回 |
| 流程屏 `event` | 流程结束 `onComplete`；可选“中途放弃” | **建议**：与设计一致时加“返回/跳过”（需定义是否回滚状态） |

---

## 三、页面清单与关系（更新版）

```
                    ┌─────────────┐
                    │ EntryScreen │ entry
                    └──────┬──────┘
           创建角色        │ login / 选角
           ┌───────────────┼───────────────┐
           ▼               ▼               │
    ┌──────────────┐   ┌──────────┐        │
    │CharacterCreate│   │ GameScreen│◄──────┘
    │    create     │   │   game   │
    └───────┬──────┘   └────┬─────┘
            │               │
            │      ┌────────┼────────┐
            │      ▼        ▼        ▼
            │ Character   Event    (未来子页)
            │   Screen     Screen
            │ character    event
            └──────────────► game（完成后）
```

- **主线**：`entry` → `create` → `game`；`entry` → `game`。  
- **支路**：`game` → `character` → `game`；`game` → `event` → `game`。

---

## 四、推荐的导航框架设计（Zustand + 枚举）

### 4.1 原则

1. **单一数据源**：`screen` 只在 `accountStore`；不另设全局 React Context 复制一份。  
2. **业务跳转只走 store 方法**：组件内避免 `navigateTo('game')` 与 `navigateToGame()` 混用，优先语义化方法。  
3. **子屏返回可扩展**：用 `previousScreen` 或栈，避免第三个子屏出现时全盘改 `App.tsx`。  
4. **与存档有关的“路由参数”**：继续放在 `SavedGameState` 的明确字段（如 `pendingEncounterKind`），并在文档中注明是否持久化。

### 4.2 `App.tsx` 改造建议：注册表 + 小组件映射

将分支逻辑收拢为 **屏幕注册表**，`App` 只负责根据 `screen` 取组件并传入仅限该屏的 props（如 `event` 的 `encounterKind`）。

```tsx
// 示例：src/navigation/screenRegistry.tsx（新文件，可按项目习惯放置）
import type { AppScreen } from '../types/account';
import type { EncounterKind } from '../systems/cultivationSystem';
import EntryScreen from '../screens/EntryScreen';
import CharacterCreate from '../screens/CharacterCreate';
import GameScreen from '../screens/GameScreen';
import CharacterScreen from '../screens/CharacterScreen';
import EventScreen from '../screens/EventScreen';

type ScreenRenderProps = {
  encounterKind: EncounterKind;
  onExitEvent: () => void;
};

export function renderActiveScreen(
  screen: AppScreen,
  props: ScreenRenderProps,
): JSX.Element {
  switch (screen) {
    case 'entry':
      return <EntryScreen />;
    case 'create':
      return <CharacterCreate />;
    case 'character':
      return <CharacterScreen />;
    case 'event':
      return (
        <EventScreen
          encounterKind={props.encounterKind}
          onComplete={props.onExitEvent}
        />
      );
    case 'game':
    default:
      return <GameScreen />;
  }
}
```

```tsx
// App.tsx 示例骨架
import { useAccountStore } from './store/accountStore';
import { renderActiveScreen } from './navigation/screenRegistry';

export default function App() {
  const screen = useAccountStore(s => s.screen);
  const storage = useAccountStore(s => s.storage);

  const id = storage.activeAccountId;
  const sgs = id ? storage.gameStates[id] : null;
  const encounterKind = sgs?.pendingEncounterKind ?? 'absorb';

  return renderActiveScreen(screen, {
    encounterKind,
    onExitEvent: () => useAccountStore.getState().navigateToGame(),
  });
}
```

（`event` 对 `encounterKind` 的读取方式可与当前 `App.tsx` 一致；若需减少重渲染，可对 `storage` 使用更细的选择器。）

### 4.3 `ScreenHeader` / `NavBar` 通用组件设计

```tsx
// 示例：src/components/ScreenHeader.tsx
import type { ReactNode } from 'react';

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
};

export function ScreenHeader({
  title,
  onBack,
  backLabel = '← 返回',
  right,
}: ScreenHeaderProps) {
  return (
    <header className="page-header screen-header">
      <div className="screen-header__left">
        {onBack ? (
          <button type="button" className="btn-back" onClick={onBack}>
            {backLabel}
          </button>
        ) : (
          <span className="screen-header__spacer" aria-hidden />
        )}
      </div>
      <h2 className="screen-header__title">{title}</h2>
      <div className="screen-header__right">{right ?? null}</div>
    </header>
  );
}
```

**与子页配合：**

```tsx
// CharacterScreen  conceptual sketch — 数据应来自 accountStore
import { ScreenHeader } from '../components/ScreenHeader';
import { useAccountStore } from '../store/accountStore';

export default function CharacterScreen() {
  const navigateBack = () => useAccountStore.getState().navigateToGame(); // 或 navigateBack()

  const gs = useAccountStore(s => {
    const id = s.storage.activeAccountId;
    return id ? s.storage.gameStates[id] : null;
  });
  const getFinalStats = useAccountStore(s => s.getFinalStats);

  if (!gs) {
    return <div className="panel panel-xianxia"><p className="empty-text">暂无角色数据</p></div>;
  }

  const stats = getFinalStats();

  return (
    <div className="screen-root">
      <ScreenHeader title="人物详情" onBack={navigateBack} />
      {/* CharacterPanel + EquipmentBag，数据来自 gs 与 store 方法 */}
    </div>
  );
}
```

样式上可与 `CharacterCreate` 的 `back-btn`、`event-screen` 的 `.event-screen-back` 逐步合并为同一 BEM 前缀，减少三套按钮视觉。

---

## 五、与当前问题的对应说明

| 问题 | 说明 |
|------|------|
| 人物页无返回 | 仓库中 `CharacterScreen` 已存在 `← 返回` + `navigateToGame`；若本地版本没有，按第四节 `ScreenHeader` 补齐即可。 |
| 跳转临时、不统一 | `App` 的 `if` 链与 `navigateTo` / `navigateToX` 并存；建议注册表 + `navigateBack` + 禁止业务层直接 `navigateTo('character')` 散弹调用（可 eslint 或封装私有方法）。 |
| `useGameStore` | 人物页应改为 **`accountStore` 活跃存档**，否则返回按钮存在也可能展示错误数据。 |

---

## 六、实现优先级建议

| 优先级 | 项 | 说明 |
|--------|----|------|
| **P0** | **CharacterScreen 数据源对齐 accountStore** | 与 `GameScreen` 一致，避免双 store。 |
| **P0** | **语义化返回**：`navigateBack` 或 `previousScreen` | 统一人物页、日后设置页等子屏行为。 |
| **P1** | 抽取 `ScreenHeader` + `ScreenRoot` | 创建页、人物页、事件页（如需）统一样式与无障碍。 |
| **P1** | `screenRegistry` + 精简 `App.tsx` | 降低新增屏幕时漏改分支的风险。 |
| **P2** | 导航守卫与加载态 | `game` 前校验账号；避免空白闪烁。 |
| **P3** | （可选）URL 同步 | `history.replaceState` 只读展示，不参与真实状态机。 |

---

## 七、小结

- **不必**为当前规模强上 react-router；**Zustand + `AppScreen` + 注册表 +（可选）返回栈**即可构成完整 SPA 导航层。  
- **`screen` 由 `accountStore` 管理**；`gameStore` 与人物页并存会导致行为与体验割裂，应收敛。  
- **每类子页**使用统一的 `ScreenHeader`（返回 + 标题 + 可选右侧动作），主界面 `GameScreen` 保持现有顶栏即可。

---

*本文档供登仙项目统一导航实现与 Code Review 对照使用。*
