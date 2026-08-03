#!/usr/bin/env python3
"""Generate game record log from check result JSON."""
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
realm_text = initial.get('realm', '') if isinstance(initial, dict) else ''
after_battle = data.get('after_battle', {})
battle_stats = after_battle.get('stats', {})
battle_logs = after_battle.get('logs', [])

now = datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00')
ts = datetime.now().strftime('%Y%m%d-%H%M%S')
report_id = 'record-{}'.format(ts)
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

# Determine anomalies (things that are broken/missing)
anomalies = []

btn_map = {b['t']: b for b in btns}
missing_btns = []
for btn_text, _ in [('开始修炼', '开始修炼'), ('历练', '历练'),
                     ('属性', '属性Tab'), ('装备', '装备Tab'),
                     ('技能', '技能Tab'), ('背包', '背包Tab')]:
    if btn_text not in btn_map:
        missing_btns.append(btn_text)
if missing_btns:
    anomalies.append('按钮缺失：{}'.format('、'.join(missing_btns)))

if not stats.get('气血'):
    anomalies.append('角色属性数据缺失')

# Check tab content
tab_equip = data.get('tab_equip', '').strip()
tab_skill = data.get('tab_skill', '').strip()
tab_bag = data.get('tab_bag', '').strip()

if not tab_equip:
    anomalies.append('装备Tab内容为空')
if not tab_skill:
    anomalies.append('技能Tab内容为空')
if not tab_bag:
    anomalies.append('背包Tab内容为空')

battle_changed = (stats != battle_stats)
if not battle_changed:
    anomalies.append('历练交互后属性无变化（可能异常）')

# Stats
def fmt_val(v, key=''):
    if v is None or v == '?':
        return '—'
    return str(v)

qi = stats.get('气血', '?')
ling = stats.get('灵力', '?')
xiuwei = stats.get('修为', '?')
atk = stats.get('攻击', '?')
deff = stats.get('防御', '?')
spd = stats.get('速度', '?')
shen = stats.get('神识', '?')
stone = stats.get('灵石', '?')

# Recent battle log entries (last 5)
recent_logs = battle_logs[-5:] if battle_logs else logs[-5:] if logs else []

# Pre-compute values before format()
equip_content = tab_equip if tab_equip else '(暂无装备)'
skill_content = tab_skill if tab_skill else '(暂无技能)'
bag_content = tab_bag if tab_bag else '(暂无物品)'
logs_content = '\n'.join(f"- {log}" for log in recent_logs) if recent_logs else '（无记录）'
anomalies_content = '\n'.join(f"- {a}" for a in anomalies) if anomalies else '无'

md_content = """---
# 仙侠小游戏游戏记录
id: {report_id}
project: idle-xianxia
recorded_at: {now}
url: http://localhost:5173/
tool: playwright-dom-inspect
---

## 角色信息

| 属性 | 数值 |
|------|------|
| 境界 | {realm} |
| 气血 | {qi} |
| 灵力 | {ling} |
| 修为 | {xiuwei} |
| 攻击 | {atk} |
| 防御 | {deff} |
| 速度 | {spd} |
| 神识 | {shen} |
| 灵石 | {stone} |

## 装备

{equip_content}

## 技能

{skill_content}

## 背包

{bag_content}

## 战斗记录（近5条）

{logs_content}

## 备注

{anomalies_content}
""".format(
    report_id=report_id,
    now=now,
    realm=realm_text or '—',
    qi=fmt_val(qi),
    ling=fmt_val(ling),
    xiuwei=fmt_val(xiuwei),
    atk=fmt_val(atk),
    deff=fmt_val(deff),
    spd=fmt_val(spd),
    shen=fmt_val(shen),
    stone=fmt_val(stone),
    equip_content=equip_content,
    skill_content=skill_content,
    bag_content=bag_content,
    logs_content=logs_content,
    anomalies_content=anomalies_content,
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
    'page': '游戏记录',
    'status': 'OK' if not anomalies else 'WARN',
    'tool': 'playwright-dom-inspect',
    'summary': '游戏记录，异常{}项'.format(len(anomalies)),
    'stats': stats,
    'realm': realm_text,
    'log_count': len(recent_logs),
})

with open(META_PATH, 'w') as f:
    yaml.dump(meta, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

print('REPORT_WRITTEN: {}'.format(filename))
print('STATUS: {}'.format('OK' if not anomalies else 'WARN'))
print('ANOMALIES: {} items'.format(len(anomalies)))
