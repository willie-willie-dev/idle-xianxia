#!/usr/bin/env python3
"""
idle-xianxia 审核 Cron Wrapper
职责：只运行检查脚本，不维护游戏进程，游戏挂了自己报 SERVICE_FAIL
"""
import subprocess, json, sys, os

BROWSER_PY = "/home/lovecactus/.browser-use-env/bin/python3"
HERMES_PY = "/home/lovecactus/hermes-agent/.venv/bin/python3"
SCRIPT_DIR = "/home/lovecactus/projects/idle-xianxia/audit-reports/scripts"
CHECK_JSON = "/tmp/audit_result.json"

def run(cmd, timeout=60):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.stdout, r.stderr, r.returncode

# ── Step 1: 运行 Playwright 检查 ────────────────────────────────────
print("=== audit_check ===")
out1, err1, code1 = run(f"{BROWSER_PY} {SCRIPT_DIR}/audit_check.py", timeout=60)
print(out1[-500:] if out1 else "(no stdout)")

if code1 != 0:
    # 游戏服务不可达或其他错误
    err_msg = (err1 + out1)[-300:]
    if "net::" in err_msg.lower() or "connect" in err_msg.lower():
        result = {"status": "SERVICE_FAIL", "report_file": None, "findings": 0, "error": f"游戏服务不可达: {err_msg[:150]}"}
    else:
        result = {"status": "SCRIPT_ERROR", "report_file": None, "findings": 0, "error": f"检查脚本执行失败: {err_msg[:150]}"}
    print("AUDIT_RESULT:", json.dumps(result))
    sys.exit(0)

# ── Step 2: 生成报告 ────────────────────────────────────────────────
print("=== generate_report ===")
out2, err2, code2 = run(f"{HERMES_PY} {SCRIPT_DIR}/generate_report.py {CHECK_JSON}", timeout=30)
print(out2)
if err2:
    print("[stderr]", err2[-300:])

filename, report_status, findings_info = None, "UNKNOWN", ""
for line in out2.split('\n'):
    if line.startswith('REPORT_WRITTEN:'):
        filename = line.split(':', 1)[1].strip()
    elif line.startswith('STATUS:'):
        report_status = line.split(':', 1)[1].strip()
    elif line.startswith('FINDINGS:'):
        findings_info = line.strip()

result = {
    "status": report_status,
    "report_file": f"/home/lovecactus/projects/idle-xianxia/audit-reports/{filename}" if filename else None,
    "findings_info": findings_info,
    "raw_output": out2[-500:],
}
print("AUDIT_RESULT:", json.dumps(result))
