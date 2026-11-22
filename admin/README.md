# 登仙 Admin

游戏和后台是**一个进程、一个端口**。不参与 `mvp` 的源码，不进游戏逻辑；本服务只是把构建好的 `mvp/dist` 和后台页面一起托管出来。

这是本地开发工具。生成头像会消耗 xAI 额度。不要把 `3210` 映射到公网。

## 单端口

默认监听 `0.0.0.0:3210`（局域网可访问）。环境变量 `PORT` 可改端口。

| 入口 | 地址 |
|---|---|
| 游戏 | `http://<局域网 IP>:3210/` |
| 后台 | `http://<局域网 IP>:3210/admin` |
| 接口 | `http://<局域网 IP>:3210/api/...` |
| 游戏脚本 | `http://<局域网 IP>:3210/assets/...`（`mvp/dist/assets`） |
| 头像 | `http://<局域网 IP>:3210/avatars/...`（仓库 `assets/avatars`） |

`mvp` 的 `npm run dev`（5173）只给开发时热更新，部署只认这一个端口。

`GET /` 与 `GET /index.html` 返回 `mvp/dist/index.html`。还没构建时，根路径是一段提示页，写着构建命令，并链到 `/admin`。

## 运行

在仓库根目录：

```bash
node admin/server.ts
```

或用启动脚本（脚本自己定位仓库根，不写死绝对路径）：

```bash
bash admin/run.sh              # 先 cd mvp && npm run build，再启动
bash admin/run.sh --no-build   # 跳过构建，直接启动
bash admin/run.sh --help
```

Node 24 直接跑 `admin/server.ts`（类型擦除），不需要 tsx / ts-node，也不需要在 `admin/` 里 `npm install`。`admin/package.json` 只有 `"type": "module"`。服务只用 `node:http`、`node:fs`、`node:path`、`node:child_process`、`node:crypto`。

建议打开令牌。令牌只放在环境变量里，不要写进仓库：

```bash
ADMIN_TOKEN='自己设一串' node admin/server.ts
```

设置之后，所有 `/api/*` 都要带 `?token=` 或请求头 `x-admin-token`。页面可以用 `http://<IP>:3210/admin?token=...` 打开一次，令牌会留在本机 sessionStorage。未设置 `ADMIN_TOKEN` 时，启动日志会打印警告。

后台侧栏有「打开游戏」（回到 `/`）和「重建前端」（`POST /api/system/build`，页面显示 exitCode 和日志尾部）。

## systemd 用户服务

unit 文件在仓库 `deploy/dengxian.service`，不会自动安装。装到用户服务需要这三条命令：

```bash
mkdir -p ~/.config/systemd/user && cp deploy/dengxian.service ~/.config/systemd/user/dengxian.service
systemctl --user daemon-reload
systemctl --user enable --now dengxian
```

服务执行 `admin/run.sh --no-build`，端口 `3210`，崩溃会拉起。开机后若未登录也要跑，再执行 `loginctl enable-linger`。启停看状态：`systemctl --user start|stop|status dengxian`。更新代码后若要重新构建前端，可在后台点「重建前端」，或先 `cd mvp && npm run build` 再重启服务。

## 页面

- 头像生成：列出 `tools/avatar-gen/cards/*.json`，调用 `python3 tools/avatar-gen/gen-avatar-set.py`。任务状态 `queued / running / done / failed`，日志在内存环形缓冲里，页面每 2 秒轮询。
- 角色：读写 `data/characters/<id>.json`。七灵根合计必须是 100。删除有二次确认。
- 事件：只读 `mvp/src/data/events.ts` 与 `daily-events.ts`（经 `admin/lib/read-events.mjs` 动态 import）。覆盖只写 `data/event-overrides.json`，不改 `mvp/`。
- 系统：端口、绑定地址、当前用户、Node 版本、生成器是否可调用、`assets/avatars` 占用、游戏是否已构建（`distBuilt` / `distMtime`）、最近任务。

## 数据

```
data/
├── characters/
│   └── <id>.json
└── event-overrides.json
```

头像产物在 `assets/avatars/<角色卡 id>/`（已 gitignore）。静态路径 `/avatars/*` 只读映射到这个目录，并做路径前缀校验。这个前缀和游戏构建产物的 `/assets/*` 分开，避免抢路径。
