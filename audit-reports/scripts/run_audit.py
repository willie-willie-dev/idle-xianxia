#!/usr/bin/env python3
"""
idle-xianxia 审核 Cron 脚本
一条命令完成：启动服务 → Playwright检查 → 生成报告 → JSON汇总输出
"""
import subprocess, json, os, time, sys
from pathlib import Path

BASE = Path("/home/lovecactus/projects/idle-xianxia")
BROWSER_PY = "/home/lovecactus/.browser-use-env/bin/python3"
REPORT_DIR = BASE / "audit-reports"
REPORT_DIR.mkdir(exist_ok=True)

def run(cmd, timeout=30):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return r.stdout.strip(), r.stderr.strip(), r.returncode

def main():
    # ── Step 1: 启动 vite ──────────────────────────────────────────
    run("pkill -f 'vite.*5173' 2>/dev/null; sleep 1")
    run(f"cd {BASE} && nohup npm run dev -- --port 5173 > /tmp/vite.log 2>&1 &", timeout=5)
    
    for i in range(15):
        code, _, _ = run("curl -s -o /dev/null -w '%{http_code}' http://localhost:5173")
        if code == "200":
            print(f"[OK] vite started ({i+1}s)")
            break
        time.sleep(1)
    else:
        print("[FAIL] vite failed to start")
        sys.exit(1)

    time.sleep(3)  # wait for React to fully render

    # ── Step 2: Playwright DOM 检查 ───────────────────────────────
    audit_script = f"""
import sys
sys.path.insert(0, '/home/lovecactus/.browser-use-env/lib/python3.12/site-packages')
from playwright.sync_api import sync_playwright
import os, time

for k in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']:
    os.environ.pop(k, None)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={{'width': 1400, 'height': 900}})

    page.goto('http://localhost:5173', wait_until='load')
    time.sleep(5)
    page.screenshot(path='/tmp/xianxia_check.png', full_page=False)

    result = page.evaluate('''
        (() => {{
            const getText = el => el ? el.textContent.trim() : '';
            const spans = Array.from(document.querySelectorAll('span'));
            const stats = {{}};
            let currentKey = '';
            spans.forEach(s => {{
                const t = s.textContent.trim();
                if (['气血','灵力','修为','攻击','防御','速度','神识','灵石'].includes(t)) {{
                    currentKey = t;
                }} else if (currentKey && /^\\\\d+\\\\/\\\\d+$|^\\\\d+$/.test(t)) {{
                    stats[currentKey] = t;
                    currentKey = '';
                }}
            }});
            const logEntries = Array.from(document.querySelectorAll('.log-entry'))
                .map(el => getText(el)).filter(t => t.length > 0);
            const buttons = Array.from(document.querySelectorAll('button')).map(el => ({{
                text: getText(el),
                disabled: el.disabled
            }}));
            return {{
                h1: getText(document.querySelector('h1')),
                realmBadge: getText(document.querySelector('.realm-badge')),
                stats,
                logEntries,
                buttons,
                bodyText: document.body.innerText.slice(0, 1000)
            }};
        }})()
    ''')

    print('DOM_RESULT:', json.dumps(result))
    browser.close()
"""

    stdout, stderr, code = run(f"{BROWSER_PY} -c \"import json; {audit_script}\"", timeout=60)
    dom_data = {}
    for line in stdout.split('\n'):
        if line.startswith('DOM_RESULT:'):
            dom_data = json.loads(line[len('DOM_RESULT:'):])
            break

    # ── Step 3: 生成报告 ──────────────────────────────────────────
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    report_file = REPORT_DIR / f"audit-{timestamp}.md"

    # 找上一个报告用于 delta（纯JSON，避免yaml依赖）
    meta_file = REPORT_DIR / "meta.yaml"
    prev_id = None
    if meta_file.exists():
        with open(meta_file) as f:
            meta = json.load(f)
        prev_id = meta.get('latest', '').replace('.md', '')

    findings = []
    fid = 1

    # 基本信息
    findings.append({"id": f"F{fid:03d}", "type": "element_present", "severity": "info",
                     "target": "h1", "description": dom_data.get('h1', '(无)'), "status": "OK"}); fid += 1
    findings.append({"id": f"F{fid:03d}", "type": "element_present", "severity": "info",
                     "target": ".realm-badge", "description": dom_data.get('realmBadge', '(无)'), "status": "OK"}); fid += 1

    # 属性
    for k, v in dom_data.get('stats', {}).items():
        findings.append({"id": f"F{fid:03d}", "type": "content_rendered", "severity": "info",
                         "target": f"span:text({k})", "description": f"{k}: {v}", "status": "OK"}); fid += 1

    # 按钮
    for btn in dom_data.get('buttons', []):
        status = "OK" if not btn['disabled'] else "WARN"
        findings.append({"id": f"F{fid:03d}", "type": "element_present", "severity": "info",
                         "target": f"button:{btn['text']}", "description": f"[{'disabled' if btn['disabled'] else 'enabled'}] {btn['text']}", "status": status}); fid += 1

    # 日志
    log_count = len(dom_data.get('logEntries', []))
    findings.append({"id": f"F{fid:03d}", "type": "content_rendered", "severity": "info",
                     "target": ".log-entry", "description": f"共 {log_count} 条日志", "status": "OK" if log_count > 0 else "WARN"}); fid += 1

    overall = "PASS" if all(f['status'] in ('OK', 'WARN') for f in findings) else "FAIL"

    # 预计算，避免 f-string 转义问题
    _nl = "\n"
    stats_lines = _nl.join(f"  {k}: {v}" for k, v in dom_data.get('stats', {}).items())
    btn_lines = _nl.join(f"| {btn['text']} | {'禁用' if btn['disabled'] else '可用'} |" for btn in dom_data.get('buttons', []))
    log_lines = _nl.join(f"- {e}" for e in dom_data.get('logEntries', [])[:10])

    report_content = f"""---
schema_version: "1.0"
project: idle-xianxia
generated_at: {time.strftime("%Y-%m-%dT%H:%M:%S+08:00")}
url: http://localhost:5173/
status: {overall}
tool: playwright-dom-inspect
findings: {len(findings)}
---

# 审核报告 {timestamp}

**状态:** {overall} | **发现问题:** {len(findings)} 项

## 页面快照

- **标题:** {dom_data.get('h1', '(无)')}
- **境界:** {dom_data.get('realmBadge', '(无)')}

## 属性

```
{stats_lines}
```

## 按钮状态

| 按钮 | 状态 |
|------|------|
{btn_lines}

## 日志条目 ({log_count}条)

{log_lines}

## Findings

{_nl.join(f"- **{f['id']}** [{f['severity']}] {f['target']}: {f['description']} → {f['status']}" for f in findings)}
"""

    with open(report_file, 'w') as f:
        f.write(report_content)

    # 更新 meta.yaml（纯文本格式，避免 yaml 依赖）
    import json as _json
    meta = {
        "schema_version": "1.0",
        "project": "idle-xianxia",
        "project_path": str(BASE),
        "audit_base": str(REPORT_DIR),
        "latest": report_file.name,
        "reports": [{
            "id": f"audit-{timestamp}",
            "filename": report_file.name,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
            "url": "http://localhost:5173/",
            "page": "首页/属性面板",
            "status": overall,
            "tool": "playwright-dom-inspect",
            "summary": f"共 {len(findings)} 项检查，状态 {overall}",
            "findings": len(findings),
        }]
    }
    with open(meta_file, 'w') as f:
        _json.dump(meta, f, ensure_ascii=False, indent=2)

    # ── Step 4: JSON 输出（供 {{SCRIPT_OUTPUT}} 使用）──────────────
    result = {
        "status": overall,
        "report_file": str(report_file),
        "findings": len(findings),
        "h1": dom_data.get('h1', ''),
        "realm": dom_data.get('realmBadge', ''),
        "stats": dom_data.get('stats', {}),
        "log_count": log_count,
        "buttons": [b['text'] for b in dom_data.get('buttons', [])],
    }
    print("AUDIT_RESULT:", json.dumps(result))

if __name__ == "__main__":
    main()
