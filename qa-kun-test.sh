#!/bin/bash
# 登仙项目 - 坤灵根 QA 验收测试（使用 agent-browser）

OUT=/home/lovecactus/.openclaw/workspace/tmp-qa
BASE=http://127.0.0.1:30200

export NO_PROXY="*"

echo "=== Phase 1: 创角 + 坤灵根验证 ==="

# 1. 打开选角页
agent-browser open "$BASE"
agent-browser wait --load networkidle
agent-browser snapshot -i --json
echo "截图: qa-kun-00-select-page.png"

# 2. 查看是否有删除按钮（已存在角色）
agent-browser snapshot -i --json
# 找删除按钮
DELETE_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("删除")) | .ref' | head -1)
if [ -n "$DELETE_REF" ]; then
  echo "找到删除按钮: $DELETE_REF"
  agent-browser click "@$DELETE_REF"
  agent-browser wait 1000
fi

# 3. 点击创建角色
agent-browser snapshot -i --json
CREATE_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("创建")) | .ref' | head -1)
echo "创建按钮 ref: $CREATE_REF"
agent-browser click "@$CREATE_REF"
agent-browser wait 1500

# 4. 填写角色名
agent-browser snapshot -i --json
agent-browser fill @e3 "坤灵根验收"
agent-browser wait 200

agent-browser screenshot "$OUT/qa-kun-00a-named.png"
echo "截图: qa-kun-00a-named.png"

# 5. 设置灵根滑条 - 所有非坤=0%
# spinbuttons: e6=乾, e8=火, e10=水, e12=木, e14=金, e16=土
agent-browser fill @e6 "0"
agent-browser wait 150
agent-browser fill @e8 "0"
agent-browser wait 150
agent-browser fill @e10 "0"
agent-browser wait 150
agent-browser fill @e12 "0"
agent-browser wait 150
agent-browser fill @e14 "0"
agent-browser wait 150
agent-browser fill @e16 "0"
agent-browser wait 150

agent-browser screenshot "$OUT/qa-kun-00b-linggen-set.png"
echo "截图: qa-kun-00b-linggen-set.png"

# 6. 点击踏入仙途
agent-browser click @e20
agent-browser wait 3000

agent-browser screenshot "$OUT/qa-kun-01-game-screen.png"
echo "截图: qa-kun-01-game-screen.png"

# 7. 点击人物按钮
agent-browser snapshot -i --json
# 找人物按钮
PERSON_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("人物")) | .ref' | head -1)
echo "人物按钮 ref: $PERSON_REF"
agent-browser click "@$PERSON_REF"
agent-browser wait 1500

agent-browser screenshot "$OUT/qa-kun-01b-accordion-open.png"
echo "截图: qa-kun-01b-accordion-open.png"

# 8. 进入人物详情页
agent-browser snapshot -i --json
DETAIL_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("详情")) | .ref' | head -1)
if [ -n "$DETAIL_REF" ]; then
  echo "详情按钮 ref: $DETAIL_REF"
  agent-browser click "@$DETAIL_REF"
  agent-browser wait 1500
fi

agent-browser screenshot "$OUT/qa-kun-02-character-screen.png"
echo "截图: qa-kun-02-character-screen.png"

# 9. 验证灵根
agent-browser snapshot -i --json
PAGE_TEXT=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.snapshot')
echo "=== 验证结果 ==="
echo "$PAGE_TEXT" | grep -o "坤灵根" | head -3
echo "$PAGE_TEXT" | grep -o "[0-9]\+%" | head -10

echo ""
echo "=== Phase 2: 灵气吸纳测试 ==="

# 返回
BACK_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("返回")) | .ref' | head -1)
if [ -n "$BACK_REF" ]; then
  agent-browser click "@$BACK_REF"
  agent-browser wait 1000
fi

# 点击历练
agent-browser snapshot -i --json
LIAN_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("历练")) | .ref' | head -1)
echo "历练按钮 ref: $LIAN_REF"
agent-browser click "@$LIAN_REF"
agent-browser wait 1500

agent-browser screenshot "$OUT/qa-spirit-00-choose-action.png"
echo "截图: qa-spirit-00-choose-action.png"

# 选择吸纳灵气
agent-browser snapshot -i --json
ABSORB_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("吸纳灵气")) | .ref' | head -1)
echo "吸纳灵气 ref: $ABSORB_REF"
if [ -n "$ABSORB_REF" ]; then
  agent-browser click "@$ABSORB_REF"
  agent-browser wait 2000
fi

agent-browser screenshot "$OUT/qa-spirit-01-narrative.png"
echo "截图: qa-spirit-01-narrative.png"

# 点击继续
agent-browser snapshot -i --json
CONTINUE_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("继续")) | .ref' | head -1)
echo "继续按钮 ref: $CONTINUE_REF"
agent-browser click "@$CONTINUE_REF"
agent-browser wait 3000

agent-browser screenshot "$OUT/qa-spirit-absorb-settlement.png"
echo "截图: qa-spirit-absorb-settlement.png"

# 点击完成
agent-browser snapshot -i --json
FINISH_REF=$(agent-browser snapshot -i --json 2>/dev/null | jq -r '.data.refs[] | select(.name | contains("完成")) | .ref' | head -1)
echo "完成按钮 ref: $FINISH_REF"
agent-browser click "@$FINISH_REF"
agent-browser wait 1000

echo ""
echo "=== 测试完成 ==="
echo "所有截图保存在: $OUT/qa-kun-*.png"