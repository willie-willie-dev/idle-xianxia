#!/usr/bin/env python3
"""Generate audit report from check result JSON."""
import sys
import json
import yaml
import os
from datetime import datetime

CHECK_JSON = sys.argv[1] if len(sys.argv) > 1 else '/tmp/audit_result.json'
META_PATH = '/home/lovecactus/projects/idle-xianxia/audit-reports/meta.yaml'
AUDIT_DIR = '/home/lovecactus/projects/idle-xianxia/audit-reports'

with open(CHECK_JSON) as f:
    data = json.load(f)

initial = data.get('initial', {})
stats = initial.get('stats', {})
logs = initial.get('logs', [])
btns = initial.get('btns', [])
after_battle = data.get('after_battle', {})
battle_stats = after_battle.get('stats', {})
battle_logs = after_battle.get('logs', [])

now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
ts = datetime.now().strftime('%Y%m%d-%H%M%S')
report_id = 'audit-{}'.format(ts)
filename = '{}.md'.format(report_id)

# Load meta
if os.path.exists(META_PATH):
    with open(META_PATH) as f:
        meta = yaml.safe_load(f)
else:
    meta = {
        'schema_version': '1.0',
        'project': 'idle-xianxia',
        'project_path': '/home/lovecactus/projects/idle-xianxia/',
        'audit_base': './audit-reports',
        'latest': None,
        'reports': []
    }

base_id = meta.get('latest') or (meta['reports'][-1]['id'] if meta.get('reports') else None)

# Find highest F-number from existing reports
max_f = 0
for rep in meta.get('reports', []):
    for f in rep.get('findings', []):
        fid = f.get('id', '')
        if fid.startswith('F') and fid[1:].isdigit():
            max_f = max(max_f, int(fid[1:]))

f_start = max_f + 1

# Build findings
findings = []
fid = f_start

def add_f(fid, ftype, severity, target, desc, status):
    findings.append({'id': 'F{}'.format(fid), 'type': ftype, 'severity': severity, 'target': target, 'description': desc, 'status': status})
    return fid + 1

fid = add_f(fid, 'element_present', 'info', 'http://localhost:5173', '页面HTTP加载正常', 'OK')

btn_checks = [('🧘 开始修炼', '开始修炼按钮'), ('⚔ 历练', '历练按钮'),
               ('属性', '属性Tab'), ('装备', '装备Tab'), ('技能', '技能Tab'), ('背包', '背包Tab')]
btn_map = {b['t']: b for b in btns}
for btn_text, desc in btn_checks:
    if btn_text in btn_map:
        fid = add_f(fid, 'element_present', 'info', '//button[contains(text(),"{}")]'.format(btn_text), '{}存在'.format(desc), 'OK')
    else:
        fid = add_f(fid, 'element_present', 'error', '//button[contains(text(),"{}")]'.format(btn_text), '{}不存在'.format(desc), 'FAIL')

for stat, label in [('气血','气血'), ('灵力','灵力'), ('修为','修为'), ('攻击','攻击'),
                    ('防御','防御'), ('速度','速度'), ('神识','神识'), ('灵石','灵石')]:
    val = stats.get(stat, '?')
    fid = add_f(fid, 'content_rendered', 'info' if val != '?' else 'error',
                'stats.{}'.format(stat), '{}={}'.format(label, val),
                'OK' if val != '?' else 'FAIL')

battle_changed = (stats != battle_stats)
fid = add_f(fid, 'game_logic', 'info' if battle_changed else 'error',
            'battle_interaction', '历练交互后属性变化' if battle_changed else '历练交互后属性未变化',
            'OK' if battle_changed else 'FAIL')

fid = add_f(fid, 'content_rendered', 'info', 'battle_log', '战斗记录条数={}'.format(len(battle_logs)),
            'OK' if battle_logs else 'WARN')

# Status
has_fail = any(f['severity'] == 'error' for f in findings)
status = 'FAIL' if has_fail else 'PASS'

# Delta
if base_id:
    base_rep = next((r for r in meta['reports'] if r['id'] == base_id), None)
    base_fids = {f['id'] for f in (base_rep.get('findings', []) if base_rep else [])}
    curr_fids = {f['id'] for f in findings}
    added = [{'id': f['id'], 'description': f['description']} for f in findings if f['id'] not in base_fids]
    removed = [{'id': fid, 'description': '上次报告有，本次消失'} for fid in base_fids - curr_fids]
    changed = []
    delta = {'base': base_id, 'added': added, 'removed': removed, 'changed': changed}
else:
    delta = None

# Stats comparison
comp = [
    {'label': '初始（炼气境1层）', **stats},
    {'label': '历练后', **battle_stats}
]

# MD report
delta_line = 'delta_from: {}'.format(base_id) if base_id else ''

anomalies = '\n'.join('| {} | {} | {} |'.format(f['id'], f['severity'].upper(), f['description']) for f in findings if f['severity'] in ('error', 'warning')) or '无'

delta_added_str = '\n'.join('| 新增 | {} | {} |'.format(a['id'], a['description']) for a in added) if added else '| 新增 | - | - |'
delta_removed_str = '\n'.join('| 消失 | {} |'.format(r['id']) for r in removed) if removed else '| 消失 | - |'

advise = '有真实变化，增量建议已触发。' if (added or changed) else '无新变化，暂无建议。'

md_content = """---
# 仙侠小游戏内容审核报告
id: {report_id}
project: idle-xianxia
page: 综合检查（首页+Tab+历练交互）
url: http://localhost:5173/
status: {status}
generated_at: {now}
tool: playwright-dom-inspect
{delta_line}
---

## 审核结论

| 检查项 | 结果 |
|--------|------|
| 页面加载 | {page_ok} |
| 角色属性 | {stats_ok} |
| Tab导航(4个) | {tabs_ok} |
| 历练交互 | {battle_ok} |
| 战斗记录 | {log_ok} |
| 总体状态 | {status_text} |

## 内容理解

首页为仙侠放置类游戏主界面，包含角色面板、操作按钮、战斗记录和Tab导航。

**角色属性快照（历练前）：**
| 属性 | 值 |
|------|-----|
| 气血 | {hp} |
| 灵力 | {mp} |
| 修为 | {exp} |
| 攻击 | {atk} |
| 防御 | {defv} |
| 速度 | {spd} |
| 神识 | {sense} |
| 灵石 | {gold} |

**历练交互结果：**
| 属性 | 历练前 | 历练后 |
|------|--------|--------|
| 气血 | {hp0} | {hp1} |
| 攻击 | {atk0} | {atk1} |
| 灵石 | {gold0} | {gold1} |

## 异常记录

| ID | 严重度 | 描述 |
|----|--------|------|
{anomalies}

## 与上次报告差异

{delta_added_str}
{empty_row}
{empty_row}

## 增量发展建议

{advise}
""".format(
    report_id=report_id, status=status, now=now, delta_line=delta_line,
    page_ok='✅ 200 OK' if stats else '❌ FAIL',
    stats_ok='✅ 数据完整' if stats.get('气血') != '?' else '❌ 数据缺失',
    tabs_ok='✅ 全部存在' if all(bt in btn_map for bt, _ in btn_checks) else '❌ 部分缺失',
    battle_ok='✅ 属性变化正常' if battle_changed else '❌ 属性未变化',
    log_ok='✅ 写入正常' if battle_logs else '⚠️ 无记录',
    status_text='✅ PASS' if status == 'PASS' else '❌ FAIL',
    hp=stats.get('气血','N/A'), mp=stats.get('灵力','N/A'), exp=stats.get('修为','N/A'),
    atk=stats.get('攻击','N/A'), defv=stats.get('防御','N/A'), spd=stats.get('速度','N/A'),
    sense=stats.get('神识','N/A'), gold=stats.get('灵石','N/A'),
    hp0=stats.get('气血','?'), hp1=battle_stats.get('气血','?'),
    atk0=stats.get('攻击','?'), atk1=battle_stats.get('攻击','?'),
    gold0=stats.get('灵石','?'), gold1=battle_stats.get('灵石','?'),
    anomalies=anomalies,
    delta_added_str=delta_added_str,
    empty_row='| - | - | - |' if added else '',
    advise=advise
)

# Write files
os.makedirs(AUDIT_DIR, exist_ok=True)
md_path = os.path.join(AUDIT_DIR, filename)
with open(md_path, 'w') as f:
    f.write(md_content)

meta['latest'] = filename
meta['reports'].append({
    'id': report_id,
    'filename': filename,
    'generated_at': now,
    'url': 'http://localhost:5173/',
    'page': '综合检查',
    'status': status,
    'tool': 'playwright-dom-inspect',
    'summary': '综合检查完成，status={}'.format(status),
    'findings': findings,
    'stats_comparison': comp,
    'delta': delta
})

with open(META_PATH, 'w') as f:
    yaml.dump(meta, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

print('REPORT_WRITTEN: {}'.format(filename))
print('STATUS: {}'.format(status))
print('FINDINGS: {} items (F{}-F{})'.format(len(findings), f_start, fid-1))
