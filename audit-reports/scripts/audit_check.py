#!/usr/bin/env python3
"""idle-xianxia quick audit check — runs in ~20s"""
import sys
import json
import os

sys.path.insert(0, '/home/lovecactus/.browser-use-env/lib/python3.12/site-packages')
from playwright.sync_api import sync_playwright

for k in list(os.environ.keys()):
    if 'proxy' in k.lower():
        del os.environ[k]

def get_state(page):
    return page.evaluate("""
        () => {
            const spans = Array.from(document.querySelectorAll('span'));
            const stats = {};
            let key = '';
            spans.forEach(s => {
                const t = s.textContent.trim();
                if (['气血','灵力','修为','攻击','防御','速度','神识','灵石'].includes(t)) key = t;
                else if (key && /^\d+\/\d+$|^\d+$/.test(t)) { stats[key] = t; key = ''; }
            });
            const logs = Array.from(document.querySelectorAll('.log-entry')).map(e => e.textContent.trim()).filter(t => t.length > 0);
            const btns = Array.from(document.querySelectorAll('button')).map(e => ({ t: e.textContent.trim(), d: e.disabled }));
            // 抓境界 badge
            const realmEl = document.querySelector('.realm-badge, .realm, [class*="realm"]');
            const realm = realmEl ? realmEl.textContent.trim() : '';
            return { stats, logs, btns, realm };
        }
    """)

def get_tab_content(page, tab_name):
    """抓取指定 Tab 的内容区文字，只取 .tab-content 的文本"""
    return page.evaluate(f"""
        () => {{
            const tc = document.querySelector('.tab-content');
            if (!tc) return '';
            return tc.textContent.replace(/\\s+/g, ' ').trim().slice(0, 400);
        }}
    """)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    page.goto('http://localhost:5173', wait_until='load')
    page.wait_for_timeout(2000)

    r = {"initial": get_state(page)}

    for name, text in [("equip","装备"),("skill","技能"),("bag","背包")]:
        page.click(f'button.tab-btn:has-text("{text}")')
        page.wait_for_timeout(800)
        r[f"tab_{name}"] = get_tab_content(page, text)

    page.click('button:has-text("属性")')
    page.wait_for_timeout(500)
    page.click('button:has-text("历练")')
    page.wait_for_timeout(1500)
    r["after_battle"] = get_state(page)

    with open('/tmp/audit_result.json', 'w') as f:
        f.write(json.dumps(r, ensure_ascii=False, indent=2))
    browser.close()
