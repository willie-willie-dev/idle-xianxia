import { writeFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const resolvePlaywright = () => {
  const dirs = [
    '/home/lovecactus/.openclaw/workspace/tmp-qa',
    '/home/lovecactus/projects/idle-xianxia',
  ];
  for (const d of dirs) {
    try {
      return require(join(d, 'node_modules/playwright'));
    } catch {
      /* try next */
    }
  }
  throw new Error('playwright not found in tmp-qa or idle-xianxia');
};

const OUT_DIR = '/home/lovecactus/.openclaw/workspace/tmp-qa';
const URL = 'https://www.feidee.com/cloud/#/account-export';
const PNG = join(OUT_DIR, 'sui-export-direct.png');
const MD = join(OUT_DIR, 'sui-export-direct.md');
const META = join(OUT_DIR, 'capture-meta.json');

function analyze(bodyText, finalUrl, title) {
  const needsLogin =
    /登录|扫码|验证码|手机号|密码|needLogin|sign\s*in/i.test(bodyText) ||
    /needLogin=true/i.test(finalUrl) ||
    finalUrl.replace(/#.*/, '') === 'https://www.feidee.com/cloud/' && !/account-export/i.test(finalUrl);

  const hasExport =
    /导出|账单导出|account-export|选择账本|导出格式|csv|excel/i.test(bodyText);

  let loginSteps = '未检测到登录界面（可能已展示导出页或页面仍在加载）。';
  if (/扫码|二维码/i.test(bodyText)) {
    loginSteps = '1. 打开登录页后选择「扫码登录」；2. 使用随手记 App 扫描页面二维码；3. 在手机上确认登录。';
  } else if (/手机|验证码/i.test(bodyText)) {
    loginSteps = '1. 选择「手机验证码登录」；2. 输入手机号；3. 获取并填写短信验证码；4. 登录成功后再访问导出页。';
  } else if (/密码|账号/i.test(bodyText)) {
    loginSteps = '1. 选择「账号密码登录」；2. 输入随手记账号与密码；3. 登录成功后进入导出功能。';
  } else if (needsLogin) {
    loginSteps =
      '根据路由分析：未登录访问 `#/account-export` 通常会跳转 `/?needLogin=true`。支持扫码（LoginQrcode）、账号密码（LoginPassword）、手机验证码（LoginVerification）三种方式。';
  }

  const md = `# 随手记 account-export 直链访问分析

> 抓取时间：${new Date().toISOString()}
> 目标 URL：${URL}
> 最终 URL：${finalUrl}
> 页面标题：${title}

## 1. 页面是否需要登录

**${needsLogin ? '是' : '否'}**

**依据：**
- 最终 URL：\`${finalUrl}\`
- 页面可见文本摘要（前 800 字）：

\`\`\`
${bodyText.slice(0, 800).trim() || '（无文本）'}
\`\`\`

## 2. 是否直接显示了导出界面

**${hasExport && !needsLogin ? '是' : '否'}**

**实际展示：**
${hasExport ? '- 页面包含导出相关文案（导出/账单/格式等）' : '- 未看到明确导出界面文案'}
${needsLogin ? '- 当前为登录或未授权状态，导出功能需登录后可用' : ''}
${!hasExport && !needsLogin ? '- 可能为加载中、浏览器提示页或空白壳页面，请结合截图确认' : ''}

## 3. 登录方式与步骤（如需要）

${loginSteps}

---

*本报告由 Playwright 无头浏览器（无 Cookie 新会话）自动生成。*
`;
  return { md, needsLogin, hasExport, loginSteps };
}

mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);

  const finalUrl = page.url();
  await page.screenshot({ path: PNG, fullPage: true });

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 15000) ?? '');

  const { md, needsLogin, hasExport } = analyze(bodyText, finalUrl, title);
  writeFileSync(MD, md, 'utf8');
  writeFileSync(META, JSON.stringify({ finalUrl, title, bodyText, needsLogin, hasExport }, null, 2), 'utf8');

  await browser.close();

  const pngSize = statSync(PNG).size;
  const mdSize = statSync(MD).size;
  console.log(
    JSON.stringify({ ok: true, finalUrl, png: PNG, md: MD, pngSize, mdSize, needsLogin, hasExport })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
