# 多角色账号系统设计

## 概述

游戏启动时显示 Entry Screen（角色选择界面），支持多角色创建、管理和切换。所有角色数据通过 `localStorage` 持久化存储。

## 数据结构

### 存储 Key
`idle_xianxia_accounts`

### Storage 接口
```typescript
interface Account {
  id: string;           // UUID
  name: string;         // 角色名
  attribute: WuXing;     // 五行属性
  createdAt: number;     // 创建时间戳
  lastPlayedAt: number;  // 最后游玩时间戳
}

interface SavedGameState {
  character: Character;
  equipped: EquippedSlots;
  bag: EquipBase[];
  skills: Skill[];
  logs: LogEntry[];
  isIdling: boolean;
  logCounter: number;
  currentEvent: GameEvent | null;
  triggeredEvents: string[]; // localStorage序列化用string[]
}

interface Storage {
  accounts: Account[];
  activeAccountId: string | null;
  gameStates: Record<string, SavedGameState>;
}
```

## 界面

### EntryScreen (`/screens/EntryScreen.tsx`)
- 显示所有已创建角色卡片（头像/名称/境界/属性/创建时间）
- 点击卡片进入游戏（`loginAccount`）
- 点击"创建角色"进入 `CharacterCreate` 界面
- 长按/右键删除角色（二次确认）
- 最多 3 个角色

### CharacterCreate (`/screens/CharacterCreate.tsx`)
- 输入角色名（2-8中文字符，唯一性校验）
- 选择五行属性（影响初始成长方向）
- 点击"踏入仙途"创建并进入游戏

### GameScreen (`/screens/GameScreen.tsx`)
- 与原有游戏界面一致，通过 `accountStore` 驱动游戏逻辑
- 右上角显示退出按钮，返回 Entry Screen

## 五行属性

| 属性 | 图标 | 描述 |
|------|------|------|
| 金   | ⚔   | 攻击+10 / 防御-5 |
| 木   | 🌿   | 气血+20 / 攻击-3 |
| 水   | 💧   | 灵力+15 / 速度+5 |
| 火   | 🔥   | 攻击+8 / 灵力-5 |
| 土   | 🪨   | 防御+12 / 气血+10 |

## 路由/状态设计

使用 Zustand `accountStore.screen` 状态管理路由：
- `'entry'` → EntryScreen（角色选择）
- `'create'` → CharacterCreate（创建角色）
- `'game'` → GameScreen（主游戏）

## 文件清单

| 文件 | 说明 |
|------|------|
| `src/types/account.ts` | Account / Storage / SavedGameState 类型 |
| `src/store/accountStore.ts` | 账号状态管理（Zustand） |
| `src/screens/EntryScreen.tsx` | 角色选择界面 |
| `src/screens/CharacterCreate.tsx` | 角色创建界面 |
| `src/screens/GameScreen.tsx` | 主游戏界面 |
| `src/App.tsx` | 根组件，按 screen 状态渲染对应界面 |
| `src/store/gameStore.ts` | 原有游戏状态（interface GameState 改为 export） |

## 持久化方案

- `localStorage` key: `idle_xianxia_accounts`
- `triggeredEvents` 存储时序列化为 `string[]`，加载时恢复为 `Set<string>`
- 每次状态变更后立即 `saveStorage()` 持久化
- 页面刷新后恢复 `Storage` 结构，重新登录账号时恢复游戏状态

## 向后兼容

- 首次加载时 `Storage` 默认 `{ accounts: [], activeAccountId: null, gameStates: {} }`
- 旧存档（single-character localStorage key）暂不迁移
