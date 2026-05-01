#!/bin/bash
# audit-proposal-generator.sh
# Cron触发器：启动一个orchestrator agent，由它负责读取报告→分析建议→调度子agents实施

AUDIT_DIR="/home/lovecactus/projects/idle-xianxia/audit-reports"
PROPOSALS_DIR="$AUDIT_DIR/proposals"
SCRIPT_DIR="$AUDIT_DIR/scripts"
STATE_FILE="$SCRIPT_DIR/last_processed.txt"
LOG_FILE="$SCRIPT_DIR/cron.log"

mkdir -p "$PROPOSALS_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Cron Trigger: Starting Orchestrator Agent ==="

# 获取上次处理到的报告
LAST_PROCESSED=""
[ -f "$STATE_FILE" ] && LAST_PROCESSED=$(cat "$STATE_FILE")

# 获取所有报告（最新在前）
ALL_REPORTS=$(ls -t "$AUDIT_DIR"/audit-*.md 2>/dev/null)
[ -z "$ALL_REPORTS" ] && log "No audit reports found." && exit 0

# 找新增报告
NEW_REPORTS=""
if [ -n "$LAST_PROCESSED" ]; then
  for report in $ALL_REPORTS; do
    [ "$report" = "$LAST_PROCESSED" ] && break
    NEW_REPORTS="$report $NEW_REPORTS"
  done
else
  NEW_REPORTS=$(echo "$ALL_REPORTS" | head -1)
fi

[ -z "$NEW_REPORTS" ] && log "No new reports since last run." && exit 0

# 取最新那份报告
LATEST_REPORT=$(echo "$NEW_REPORTS" | awk '{print $1}')
REPORT_ID=$(basename "$LATEST_REPORT" .md)
REPORT_CONTENT=$(cat "$LATEST_REPORT")
REPORT_CONTENT_ESCAPED=$(echo "$REPORT_CONTENT" | sed 's/"/\\"/g' | tr '\n' '|')

log "Latest new report: $REPORT_ID"
log "Spawning orchestrator agent..."

# 启动orchestrator agent
# 它会：读取报告→判断建议→分配子agents→收集结果→写proposal
openclaw agent spawn \
  --label "audit-orchestrator-$(date +%H%M%S)" \
  --task "你在 /home/lovecactus 目录下工作。

**背景：** 有一个修仙小游戏项目 idle-xianxia，位于 /home/lovecactus/projects/idle-xianxia
另一个Agent定期对它进行审计，审计报告放在 /home/lovecactus/projects/idle-xianxia/audit-reports/

**你的职责：** 作为 Orchestrator，从 cron 触发后，负责整个「读取报告→分析建议→调度实施→验证」的流程。

**工作流程：**

## 阶段1：读取并分析报告
读取报告文件：$LATEST_REPORT
分析内容：
- 状态是 PASS 还是 FAIL
- 有没有"建议"、"优化"、"问题"等关键词
- 如果是 PASS 且无具体建议 → 生成proposal说明"无需处理"，写入 /home/lovecactus/projects/idle-xianxia/audit-reports/proposals/
- 如果有具体建议 → 进入阶段2

## 阶段2：拆解建议，分配子agents
对于每个具体建议，启动一个专门负责实施的子agent（使用 sessions_spawn）：
- 子agent负责：用Cursor（agent -p "..." --trust）实施对应的代码修改
- 每次修改后运行构建验证：cd /home/lovecactus/projects/idle-xianxia/frontend && npm run build
- 失败则回滚：cd /home/lovecactus/projects/idle-xianxia && git checkout -- .

## 阶段3：验证
所有修改完成后：
- 启动dev server验证：cd /home/lovecactus/projects/idle-xianxia/frontend && npm run dev &
- 等5秒后检查是否正常启动
- 用Playwright或curl验证页面可访问

## 阶段4：汇总
生成最终proposal文件（Markdown），内容包含：
- 父报告信息
- 识别出的建议列表
- 哪些已实施、哪些失败
- 最终项目状态
- 写入 /home/lovecactus/projects/idle-xianxia/audit-reports/proposals/proposal-$(date +%Y%m%d-%H%M%S).md

**重要约束：**
- 只实施你完全理解的、风险低的改动
- 每次代码修改后必须验证构建
- 不要碰复杂业务逻辑
- 报告要详细，失败也要如实记录

**最终输出要求：**
完成所有阶段后，输出一份结构化的执行报告给我，说明：
1. 识别到几个建议
2. 实施了哪些
3. 验证结果如何
4. 最终状态" >> "$LOG_FILE" 2>&1

log "Orchestrator agent spawned successfully"

# 更新状态
echo "$LATEST_REPORT" > "$STATE_FILE"
log "State updated: $REPORT_ID"

exit 0