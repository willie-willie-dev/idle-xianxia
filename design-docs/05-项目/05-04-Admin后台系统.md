# 05-04-Admin 后台系统

> 版本：v0.2（单端口单服务）
> 状态：重构中
> 说明：游戏与后台合并为**一个服务、一个端口**（3210）。根路径给游戏，`/admin` 给后台，`/api` 给接口。可局域网访问，由 systemd 用户服务常驻。不改 `mvp/src` 源码。

---

## 1. 定位与边界

**是什么**：一个跑在本机、不打包进游戏的后台工具，用来在开发期反复试生成与配数据。

**不是什么**：不是游戏的一部分，不参与构建，不进 `mvp/dist`，不对公网暴露。

| 项 | 边界 |
|---|---|
| 与 `mvp/` 的关系 | **只读** `mvp/src/data/*.ts`（事件）。不修改、不 import 其运行时代码 |
| 与 `05-03` 的关系 | 后台调用 `tools/avatar-gen/gen-avatar-set.py`，是它的 Web 外壳 |
| 产物位置 | 头像 `assets/avatars/`（已 gitignore）；角色与事件覆盖 `data/` |
| 端口 | **单端口** `3210`，绑 `0.0.0.0`（局域网可访问） |
| 进程 | **单进程** `node admin/server.ts`，同时托管游戏与后台 |
| 常驻 | systemd 用户服务 `dengxian.service`，开机自启、崩溃自拉 |

---

## 2. 技术选型与路由

一个 Node 进程，零第三方依赖，TypeScript 由 Node 24 类型擦除直接运行。

```
admin/
├── server.ts          # node:http：路由 + 静态托管 + 生成任务队列 + 构建触发
├── lib/read-events.mjs # 动态 import mvp/src/data/*.ts 读事件
├── public/            # 后台单页（挂在 /admin）
├── package.json       # 仅 {"type":"module"}
└── README.md
```

### 2.1 路由表（单端口）

| 路径 | 来源 | 说明 |
|---|---|---|
| `GET /` | `mvp/dist/index.html` | 游戏入口；未构建时返回提示页并给构建命令 |
| `GET /assets/*` | `mvp/dist/assets/*` | 游戏构建产物 |
| `GET /admin` `/admin/*` | `admin/public/*` | 后台单页；资源用相对路径 `./style.css` |
| `GET /api/*` | `server.ts` | 后台接口 |
| `GET /avatars/*` | 仓库 `assets/avatars/*` | 头像图（**独立前缀，避免与游戏 `/assets` 冲突**） |

**关键改动**：头像静态前缀从 `/assets/avatars/*` 改为 `/avatars/*`，否则会和游戏构建产物的 `/assets/*` 打架。

### 2.2 构建与启动

```sh
# 构建游戏前端（Vite）
cd mvp && npm run build

# 启动统一服务
node admin/server.ts            # 前台
```

提供 `admin/run.sh`：先构建（`--no-build` 可跳过）再启动，供 systemd 使用。

## 3. 页面

### 3.1 头像生成（对接 05-03）

```
┌─ 左：角色卡列表 ────────────────────────────────┐
│ cards/aojiao-hong.json  [选中]                   │
│ cards/jianxiu.json                               │
└──────────────────────────────────────────────────┘
┌─ 右：参数 + 任务 ────────────────────────────────┐
│ 风格  (cel / gongbi / pixel)                     │
│ 表情  8 个 checkbox（默认全选）                    │
│ 定妆候选数 (1-3)                                 │
│ [仅出定妆]  [生成整套]                            │
│                                                  │
│ 任务：#1 运行中 3/9 …  [日志]                     │
│ 结果：九宫格缩略图，点开看大图，白底标记           │
└──────────────────────────────────────────────────┘
```

- 点「生成整套」→ 后台 spawn `python3 tools/avatar-gen/gen-avatar-set.py --name <card> --card-file <path> ...`
- 任务有状态：`queued / running / done / failed`，前端每 2 秒轮询
- 完成后展示 `assets/avatars/<name>/` 内的图（URL 走 `/avatars/<name>/...`）；每张标注白底检测结果（读 manifest.json）

### 3.2 角色

```
列表：id | 名字 | 境界 | 灵根 | 头像套装 | 操作
操作：新建 / 编辑 / 删除（删除需二次确认）
表单：名字、境界、灵根七项（合计必须 100）、性情标签、备注、绑定头像套装
存储：data/characters/<id>.json
```

角色卡是**新数据**，不写进 `mvp/src`。是否进入游戏由后续同步决定，v1 只管维护。

### 3.3 事件

```
列表：id | 类型(story/daily) | 境界 | 阶段 | 标题 | 选项数 | 是否有覆盖
详情：正文 + 选项（文字 / 修为 / 灵根 / plotFlag / grants / 体力）
编辑：仅允许覆盖「数值与文案」，保存到 data/event-overrides.json
```

- 列表数据**只读自 `mvp/src/data/events.ts` 与 `daily-events.ts`**
- 读取方式：用一个独立的读取脚本 `admin/lib/read-events.mjs`，用 Node 直接 import 这两个 .ts 模块并序列化成 JSON（Node 24 支持 .ts 类型擦除），**不在 admin 里跑 vite**
- 编辑结果不直接改源码，写 `data/event-overrides.json`：
  ```json
  { "lianqi-01": { "title": "…", "options": [{ "cultivationGain": 10 }] } }
  ```
  游戏侧接入覆盖层是 v2 的事，本版只保证后台可编辑、可导出

### 3.4 系统

显示：端口、绑定地址、当前用户、Node 版本、`tools/avatar-gen` 是否可执行、`assets/avatars` 占用空间、最近任务。

---

## 4. API 契约

所有接口返回 JSON；错误统一 `{ "error": "..." }` + 4xx/5xx。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | `{ ok, port, bind, node, uptime }` |
| GET | `/api/cards` | 角色卡列表（`tools/avatar-gen/cards/*.json`） |
| GET | `/api/cards/:id` | 单张角色卡全文 |
| POST | `/api/avatars/jobs` | 建任务 `{ cardId, style, expressions[], seeds, onlyMaster }` → `{ jobId }` |
| GET | `/api/avatars/jobs` | 任务列表（最近 20 条） |
| GET | `/api/avatars/jobs/:id` | 单任务状态 + 日志尾部 + 产物列表 |
| GET | `/api/avatars/sets` | 已生成的套装目录与图片清单 |
| GET | `/api/characters` | 角色列表 |
| POST | `/api/characters` | 新建 `{ name, realm, roots, tags, note, avatarSet }` |
| PUT | `/api/characters/:id` | 更新 |
| DELETE | `/api/characters/:id` | 删除 |
| GET | `/api/events` | 事件列表（合并 overrides 后的视图） |
| GET | `/api/events/:id` | 事件详情 |
| PUT | `/api/events/:id` | 写入覆盖 |
| DELETE | `/api/events/:id/override` | 撤销覆盖 |
| GET | `/api/system` | 系统信息（含游戏是否已构建、dist 时间） |
| POST | `/api/system/build` | 触发 `cd mvp && npm run build`，返回 `{ ok, exitCode, log }` |

静态：`/` → `admin/public/index.html`；`/assets/avatars/*` → 仓库 `assets/avatars/`（只读）。

---

## 5. 数据布局

```
data/
├── characters/
│   ├── <id>.json        # 角色
└── event-overrides.json # 事件覆盖（单文件，键为事件 id）
```

### 5.1 部署：systemd 用户服务（整机一套）

```ini
# ~/.config/systemd/user/dengxian.service
[Unit]
Description=Dengxian (game + admin, single port 3210)
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/lovecactus/projects/idle-xianxia
ExecStart=/bin/bash admin/run.sh --no-build
Restart=always
RestartSec=3
Environment=PORT=3210

[Install]
WantedBy=default.target
```

- 启动前先 `cd mvp && npm run build`（或调用 `POST /api/system/build` 在线重建）
- 启停：`systemctl --user start|stop|status dengxian`
- 开机自启：`systemctl --user enable dengxian`（需要 `loginctl enable-linger` 才能在未登录时也运行）

`data/` 进 git（是策划数据）；`assets/` 不进（可重生成）。

---

## 6. 安全

| 项 | 做法 |
|---|---|
| 绑定 | `0.0.0.0:3210`，仅局域网可达；**不开公网映射** |
| 鉴权 | 可选 `ADMIN_TOKEN`。设置后所有 `/api/*` 需 `?token=` 或 `x-admin-token` 头；未设置则启动日志打印警告 |
| 危险操作 | 生成任务（花钱）、删除角色都不做二次确认以外的保护；文档里写明「这是本地开发工具」 |
| 路径穿越 | 静态文件与角色读写都要 `path.resolve` 后校验前缀 |

默认建议：**开 `ADMIN_TOKEN`**，因为生成接口会消耗 xAI 额度。

---

## 7. 不在 v1 范围

- 不做用户体系、不做多项目切换
- 不做事件的直接源码写回（只做覆盖 + 导出）
- 不做头像的背景合成与降采样（05-03 的 `--cutout` 后续接）
- 不做部署/守护进程（先 `node admin/server.ts` 前台跑；要长期跑再上 systemd）

---

## 8. 端口只有一个

| 用途 | 地址 |
|---|---|
| 游戏 | `http://<LAN IP>:3210/` |
| 后台 | `http://<LAN IP>:3210/admin` |
| 接口 | `http://<LAN IP>:3210/api/...` |

`mvp` 自带的 `npm run dev`（5173）只作为**开发时热更新**的可选项，不是部署形态；部署只认 3210。

---

## 9. 验收标准

1. `node admin/server.ts` 启动后**只有一个端口**：`0.0.0.0:3210`
2. `GET /` 返回游戏页面（已构建时）；`GET /admin` 返回后台页面
3. `GET /assets/index-*.js` 能取到游戏脚本；`GET /avatars/<套装>/<文件>` 能取到头像
4. `GET /api/health`、`/api/cards`、`/api/events`（33 条）、`/api/system` 全部 200
5. 从后台点「生成整套」能起任务并完成，产物可在结果区看到（走 `/avatars/` 前缀）
6. `POST /api/system/build` 能触发前端构建并返回退出码
7. `systemctl --user status dengxian` 为 active；局域网另一台机器能打开 `http://<LAN IP>:3210/` 与 `/admin`
8. `git status` 除 `admin/`、`data/`、`design-docs` 改动外**没有**其他变化（不得改 `mvp/src`）

---

## 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-11-22 | 首版设计：独立端口 3210、三页面、API 契约、数据布局、验收标准 |
| v0.2 | 2026-11-22 | 改为**单端口单服务**：游戏与后台同进程托管；头像静态前缀改 `/avatars/` 避开游戏 `/assets`；新增 `POST /api/system/build`；补 systemd 部署与验收 |
