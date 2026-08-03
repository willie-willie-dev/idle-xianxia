import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:30200';
const OUT = '/home/lovecactus/.openclaw/workspace/tmp-qa';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  try {
    console.log('=== Phase 1: 创角 + 坤灵根验证 ===');

    // 1. 打开选角页
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/qa-kun-00-select-page.png` });

    // 2. 点击创建角色
    await page.locator('text=+创建角色').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/qa-kun-debug-01-create-page.png` });

    // 3. 输入角色名
    const nameInput = page.locator('input[placeholder*="2-8"]');
    await nameInput.fill('坤灵根验收');
    await nameInput.blur();
    await page.waitForTimeout(500);

    // 4. 设置灵根
    const numberInputs = page.locator('input[type="number"]');
    for (let i = 0; i < 6; i++) {
      await numberInputs.nth(i).fill('0');
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${OUT}/qa-kun-debug-03-linggen-set.png` });

    // 验证值
    const vCount = await numberInputs.count();
    console.log('验证灵根值:');
    for (let i = 0; i < vCount; i++) {
      process.stdout.write(`${await numberInputs.nth(i).inputValue()} `);
    }
    console.log('');

    // 5. 点击踏入仙途 (用 evaluate)
    const enterBtn = page.locator('button:has-text("踏入仙途")');
    await enterBtn.evaluate(el => {
      console.log('Clicking button:', el.textContent.trim());
      el.click();
    });
    console.log('Button clicked');
    await page.waitForTimeout(5000);

    // 6. 截图并检查 URL (including hash)
    await page.screenshot({ path: `${OUT}/qa-kun-01-game-screen.png` });
    const url = page.url();
    const hash = page.evaluate(() => window.location.hash);
    console.log('URL:', url);
    console.log('Hash:', hash);

    // Check if we're still on the select page or moved
    const stillOnSelectPage = await page.locator('text=+创建角色').isVisible().catch(() => false);
    const onCreatePage = await page.locator('text=踏入仙途').isVisible().catch(() => false);
    console.log('Still on select page:', stillOnSelectPage);
    console.log('On create page:', onCreatePage);

    // Check for any errors on screen
    const bodyText = await page.locator('body').innerText();
    console.log('Body text snippet:', bodyText.substring(0, 300));

    console.log('\n=== 测试完成 ===');

  } catch (err) {
    console.error('测试出错:', err.message);
    await page.screenshot({ path: `${OUT}/qa-kun-error.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main();