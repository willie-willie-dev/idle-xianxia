# 角色头像生成

给角色模板出一套头像：先一张定妆，再派生 8 个表情。风格、纯白背景和表情措辞都写死在 `gen-avatar-set.py` 里。角色卡放在 `cards/`。

密钥只从本机凭据库读取（`~/.dsh/.credentials.yaml` 中的 `XAI_API_KEY`），不写进仓库、不进命令历史。

## 依赖

零第三方依赖。生成、落盘、`--dry-run` 只用 Python 3 标准库（`argparse`、`json`、`urllib`、`base64`）。

Pillow 可选。装了才检查四个角是不是纯白；没装时检查结果为空，生成继续。

`--cutout` 会另调本机 `/tmp/rembg-env` 做抠图，不属于默认依赖。

## 例行用法

在仓库根目录执行。

整套（1 张定妆 + 8 个表情）：

```bash
python3 tools/avatar-gen/gen-avatar-set.py --name aojiao-hong --card-file tools/avatar-gen/cards/aojiao-hong.json
```

只出定妆，先看脸：

```bash
python3 tools/avatar-gen/gen-avatar-set.py --name aojiao-hong --card-file tools/avatar-gen/cards/aojiao-hong.json --only-master
```

出 3 张定妆候选再挑一张：

```bash
python3 tools/avatar-gen/gen-avatar-set.py --name aojiao-hong --card-file tools/avatar-gen/cards/aojiao-hong.json --seeds 3 --only-master
```

挑中之后，用 `--master <定妆.jpg>` 再跑同一条命令（去掉 `--seeds` 和 `--only-master`）派生表情。`--theme`、`--persona` 需要显式传入；角色卡里的同名字段不会自动写进提示词。

默认输出目录是仓库内的 `assets/avatars/<角色名>/`。

## 成本

默认模型 `grok-imagine-image-2.0`：定妆 $0.04/张，每个表情 $0.04。一套是 9 张（1 定妆 + 8 表情），约 $0.36。

1.0 模型的表情编辑是 $0.02/张。`--seeds 3 --only-master` 只出 3 张定妆，成本 3 × $0.04。

## 四个坑

1. **`/v1/images/generations` 会忽略 `image` 参数。** 定妆走这个端点。表情必须走 `/v1/images/edits`，并把定妆图放进 `image.url`。把参考图塞进 generations，身份条件等于没传，每张都会换一张脸。
2. **必须传 `aspect_ratio`。** 默认 `1:1`。不传时比例不稳定，胸像套装对不齐。
3. **用 `b64_json`。** 请求里带 `response_format: b64_json`，落盘优先解 base64。只拿 URL 会过期或下不下来。
4. **不支持 `size` 参数。** 不要传 OpenAI 那种 `1024x1024`。分辨率交给后处理降采样（256 / 128），接口侧只用 `aspect_ratio`。
