#!/usr/bin/env python3
"""登仙 · 角色头像套装生成器（Grok）

一条命令出「定妆 + 8 表情」一整套，风格/白底/角色卡全部固化。
密钥只从凭据库读，不进代码、不进 shell 历史。

用法示例：
  # 用内置风格 + 只给角色名和几个关键细节
  python3 gen-avatar-set.py --name suqing \\
      --hair "双丫髻左右各一，额前齐刘海，两侧鬓发垂至下颌" \\
      --ornament "仅右侧一支青玉云头簪配绿色丝穗及长及肩，左侧无" \\
      --robe "浅紫交领右衽上衣，领口白色内衬，衣身淡紫缠枝暗纹" \\
      --face "鹅蛋脸，下巴圆润不上翘" --eyes "杏眼，双眼皮，眼尾平"

  # 整套一张角色卡文件
  python3 gen-avatar-set.py --name suqing --card-file cards/suqing.json

  # 只要定妆图（先看脸）
  python3 gen-avatar-set.py --name suqing --card-file cards/suqing.json --only-master

  # 出 3 张定妆候选挑一张
  python3 gen-avatar-set.py --name suqing --card-file cards/suqing.json --seeds 3 --only-master

  # 换风格
  python3 gen-avatar-set.py --name suqing --card-file cards/suqing.json --style gongbi

成本：定妆 $0.04/张；每个表情 $0.04（2.0 模型）或 $0.02（1.0 模型）。
"""
import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

CRED_PATH = os.path.expanduser("~/.dsh/.credentials.yaml")
REF = "XAI_API_KEY"
API = "https://api.x.ai/v1/images/generations"
EDITS = "https://api.x.ai/v1/images/edits"
DEFAULT_OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "avatars"))
REMbg = "/tmp/rembg-env/bin/python"

# ---------------------------------------------------------------- 风格块（固化）
STYLES = {
    "cel": (
        "新中式国漫赛璐璐风格人物头像，清晰描边，平涂上色，柔和两段阴影，"
        "方形胸像构图，无文字无水印。"
    ),
    "gongbi": (
        "中国古风工笔淡彩人物头像，绢本设色，铁线描，矿物颜料，米黄绢底，"
        "胸像半身，柔和均匀布光，无文字无水印。"
    ),
    "pixel": (
        "16-bit 像素风人物头像，有限调色板约十六色，硬边像素块，无抗锯齿，"
        "复古游戏美术，方形胸像构图，无文字无水印。"
    ),
}

BACKGROUND = (
    "背景：纯白色（#FFFFFF）单一平涂背景，无渐变、无投影、无纹理、无边框、无装饰，"
    "背景颜色不得随情绪或服饰改变。"
)

KEEP = (
    "保持人物身份、脸型比例、发型、发饰（位置与数量都不得改变）、服饰、"
    "纯白背景与画风完全不变，只改变表情。"
)

NOCHANGE = (
    "不要改变发饰位置与数量，不要加耳饰，不要换衣领，不要改变脸型，"
    "不要改变画风，不要改变背景颜色。"
)

# ---------------------------------------------------------------- 表情模板（固化）
EXPRESSIONS = {
    "正常": "表情：视线平视镜头，眼睑自然睁开，眉毛平放，双唇自然闭合，嘴角平直。",
    "开心": ("表情：眼睛弯成月牙、下眼睑微鼓，颊上淡淡暖红，嘴角上扬约十五度，双唇轻闭。"),
    "大笑": ("表情：眼睛闭合成缝、眼角挤出细纹，双颊只是微微泛红，嘴张开露出上齿，头略后仰。"
             "禁止：不要腮红块、不要露龈过多、不要卡通夸张。"),
    "冷淡": ("表情：上眼睑半垂、眼神下移，面色偏白无血色，唇线平直、嘴角极轻微下压，下巴微抬。"
             "禁止：不要愤怒、不要冷笑。"),
    "愤怒": ("表情：眉心压低皱紧、眉梢上挑，眼睛睁大发亮，鼻翼微张，双唇紧抿，下颌前送。"
             "禁止：不要腮红感、不要青筋、不要扭曲脸型。"),
    "厌恶": ("表情：眼睛半眯、视线向下斜视，鼻梁明显皱起，上唇抬起、嘴角向一侧下拉，头略后仰偏开。"
             "禁止：不要吐舌、不要翻白眼、不要微笑。"),
    "害羞": ("表情：头向下低约十度、下巴内收，视线完全避开镜头落在左下方，上眼睑明显下垂遮住一半瞳孔，"
             "双颊颧骨处一层极淡且左右对称的薄红，双唇抿成一条放松的线、嘴角只有一丝极浅弧度。"
             "禁止：不要微笑、不要露齿、不要直视镜头、不要扩散红晕。"),
    "惊恐": ("表情：眉毛高高扬起、眉心起竖纹，眼睛瞪大、瞳孔略微缩小、露出一点眼白，肤色发白，"
             "嘴微张、唇瓣轻轻发抖，肩膀缩起。"
             "禁止：不要瞳孔放大（那是震惊）、不要尖叫过大。"),
}

DEFAULT_CARD = {
    "face": "鹅蛋脸，下巴圆润不上翘，颧骨不外扩",
    "eyes": "杏眼，双眼皮，眼尾平不挑，眉毛细长平直",
    "hair": "双丫髻，左右各一，位置在头顶两侧对称；额前齐刘海，两侧各留一缕鬓发垂至下颌",
    "ornament": "仅右侧一支青玉云头簪，簪头垂一枝绿色丝穗，长度及肩；左侧无任何发饰",
    "earring": "无",
    "robe": "浅紫交领右衽上衣，领口白色内衬露出约一指宽，衣身淡紫缠枝暗纹，无金边、无绣花、无披帛",
    "forbid": "不要长发披肩、不要单髻、不要中分、不要紫色流苏、不要金色流苏、不要双侧对称发饰、不要耳坠、不要衣领金边、不要额外花纹",
}


def die(msg, code=1):
    print("FAIL " + msg, file=sys.stderr)
    raise SystemExit(code)


def load_key():
    if not os.path.exists(CRED_PATH):
        die("凭据文件不存在：%s" % CRED_PATH)
    for line in open(CRED_PATH, encoding="utf-8"):
        m = re.match(r"\s*%s\s*:\s*(\S+)" % REF, line)
        if m:
            return m.group(1).strip().strip("'\"")
    die("凭据库找不到 %s" % REF)


def post(url, payload, key, timeout=180):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", "Bearer " + key)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        die("HTTP %s: %s" % (exc.code, exc.read().decode("utf-8", "replace")[:300]))
    except Exception as exc:  # noqa: BLE001
        die("网络错误 %s: %s" % (type(exc).__name__, exc))


def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(path, "wb") as fh:
        fh.write(resp.read())


def save_image(item, path):
    """优先用 b64_json 落盘；没有再退回下载 URL。"""
    if item.get("b64_json"):
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(item["b64_json"]))
        return path
    url = item.get("url")
    if not url:
        die("响应里既没有 b64_json 也没有 url")
    download(url, path)
    return path


def data_uri(path):
    raw = open(path, "rb").read()
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def build_master_prompt(style, card, theme="", persona=""):
    parts = [
        STYLES[style],
        BACKGROUND,
        "【不可变身份】脸型：%s。眼睛：%s。发型：%s。发饰：%s。耳饰：%s。服饰：%s。"
        % (card["face"], card["eyes"], card["hair"], card["ornament"], card.get("earring", "无"), card["robe"]),
        "【禁止项】" + card["forbid"] + "。",
    ]
    if theme:
        parts.append("【色调】" + theme + "。")
    if persona:
        parts.append("【气质】" + persona + "。")
    parts.append(EXPRESSIONS["正常"])
    return "".join(parts)


def corner_is_white(path, tol=250):
    try:
        from PIL import Image
    except ImportError:
        return None
    im = Image.open(path).convert("RGB")
    w, h = im.size
    pts = [(12, 12), (w - 13, 12), (12, h - 13), (w - 13, h - 13)]
    return all(min(im.getpixel(p)) >= tol for p in pts)


def main(argv=None):
    ap = argparse.ArgumentParser(description="登仙角色头像套装生成器（Grok）")
    ap.add_argument("--name", required=True, help="角色名，用作输出目录")
    ap.add_argument("--card-file", help="角色卡 JSON 文件（覆盖默认卡）")
    ap.add_argument("--face"); ap.add_argument("--eyes"); ap.add_argument("--hair")
    ap.add_argument("--ornament"); ap.add_argument("--robe"); ap.add_argument("--forbid")
    ap.add_argument("--style", default="cel", choices=sorted(STYLES))
    ap.add_argument("--model", default="grok-imagine-image-2.0")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--seeds", type=int, default=1, help="定妆候选数（>1 时只出定妆）")
    ap.add_argument("--only-master", action="store_true", help="只出定妆图")
    ap.add_argument("--expressions", default=",".join(EXPRESSIONS.keys()))
    ap.add_argument("--cutout", action="store_true", help="额外用 rembg 出透明 PNG（需要 /tmp/rembg-env）")
    ap.add_argument("--persona-on", default="正常,冷淡,害羞",
                    help="气质只作用于这些表情（默认 正常,冷淡,害羞）")
    ap.add_argument("--master", default="", help="复用已有定妆图，跳过重新生成")
    ap.add_argument("--theme", default="", help="色调约束，如「整体红色调：正红与金线为主」")
    ap.add_argument("--persona", default="", help="气质/性格，如「傲娇：下巴微抬、眼神不服气」")
    ap.add_argument("--aspect", default="1:1", help="输出宽高比，默认 1:1")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    card = dict(DEFAULT_CARD)
    if args.card_file:
        try:
            card.update(json.load(open(args.card_file, encoding="utf-8")))
        except Exception as exc:  # noqa: BLE001
            die("读取角色卡失败：%s" % exc)
    for field in ("face", "eyes", "hair", "ornament", "robe", "forbid"):
        val = getattr(args, field, None)
        if val:
            card[field] = val

    outdir = os.path.join(os.path.expanduser(args.out), args.name)
    os.makedirs(outdir, exist_ok=True)
    # 命令行优先；没给就用角色卡里的
    theme = args.theme or card.get("theme", "") or ""
    persona = args.persona or card.get("persona", "") or ""
    master_prompt = build_master_prompt(args.style, card, theme, persona)

    print("角色:", args.name)
    print("风格:", args.style, "| 模型:", args.model)
    print("输出:", outdir)
    print("定妆 prompt 长度:", len(master_prompt))
    if args.dry_run:
        print("\n--- 定妆 prompt ---\n" + master_prompt)
        print("\n--- 表情列表 ---\n" + ", ".join(args.expressions.split(",")))
        return

    key = load_key()
    manifest = {"name": args.name, "style": args.style, "model": args.model,
                "card": card, "theme": theme, "persona": persona, "master_prompt": master_prompt, "expressions": {}, "created": time.strftime("%Y-%m-%dT%H:%M:%S")}

    # ---- 1) 定妆（或复用已有）----
    masters = []
    if args.master:
        if not os.path.isfile(args.master):
            die("--master 指定的文件不存在：%s" % args.master)
        masters = [args.master]
        print("\n[定妆] 复用:", args.master)
    for i in range(1, max(1, args.seeds) + 1) if not args.master else []:
        print("\n[定妆 %d/%d] 生成中…" % (i, max(1, args.seeds)))
        data = post(API, {"model": args.model, "prompt": master_prompt,
                          "aspect_ratio": args.aspect, "response_format": "b64_json", "n": 1}, key)
        path = os.path.join(outdir, "定妆-%d.jpg" % i)
        save_image(data["data"][0], path)
        masters.append(path)
        print("  ->", path, "| 白底:", corner_is_white(path))
    manifest["masters"] = masters

    if args.seeds > 1 or args.only_master:
        json.dump(manifest, open(os.path.join(outdir, "manifest.json"), "w"), ensure_ascii=False, indent=1)
        print("\n已出 %d 张定妆。挑一张满意的，再用 --master 指它出表情。" % len(masters))
        return

    master = masters[0]

    # ---- 2) 表情 ----
    uri = data_uri(master)
    want = [e.strip() for e in args.expressions.split(",") if e.strip()]
    for idx, name in enumerate(want, start=1):  # idx 只用于进度显示
        if name not in EXPRESSIONS:
            print("跳过未知表情:", name)
            continue
        prompt = KEEP + EXPRESSIONS[name] + NOCHANGE
        if persona and name in [x.strip() for x in args.persona_on.split(",") if x.strip()]:
            prompt += "气质：" + persona + "。"
        if theme:
            prompt += "保持色调：" + theme + "。"
        print("\n[%d/%d] %s" % (idx, len(want), name))
        data = post(EDITS, {"model": args.model, "prompt": prompt,
                           "image": {"url": uri}, "aspect_ratio": args.aspect, "response_format": "b64_json", "n": 1}, key)
        order = list(EXPRESSIONS).index(name) + 1
        path = os.path.join(outdir, "%d-%s.jpg" % (order, name))
        save_image(data["data"][0], path)
        white = corner_is_white(path)
        manifest["expressions"][name] = {"file": os.path.basename(path), "prompt": prompt, "white_bg": white}
        print("  ->", path, "| 白底:", white)

    json.dump(manifest, open(os.path.join(outdir, "manifest.json"), "w"), ensure_ascii=False, indent=1)

    # ---- 3) 可选抠图 ----
    if args.cutout and os.path.exists(REMbg):
        print("\n[抠图] rembg…")
        alpha_dir = os.path.join(outdir, "alpha")
        os.makedirs(alpha_dir, exist_ok=True)
        for f in sorted(os.listdir(outdir)):
            if f.endswith(".jpg"):
                dst = os.path.join(alpha_dir, f.replace(".jpg", ".png"))
                os.system('%s /home/lovecactus/dsh-workspace/scripts/cutout-rembg.py "%s" "%s" >/dev/null 2>&1'
                          % (REMbg, os.path.join(outdir, f), dst))
        print("  ->", alpha_dir)

    print("\n完成。manifest:", os.path.join(outdir, "manifest.json"))


if __name__ == "__main__":
    main()
