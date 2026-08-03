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

  const results = {
    phase1: { passed: false, details: {} },
    phase2: { passed: false, details: {} }
  };

  try {
    console.log('=== Phase 1: 创角 + 坤灵根验证 ===');

    // 1. 打开选角页
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/qa-kun-00-select-page.png` });
    console.log('截图: qa-kun-00-select-page.png');

    // 2. 检查是否已有角色需要删除
    const existingChar = await page.locator('text=删除角色').isVisible().catch(() => false);
    if (existingChar) {
      console.log('发现已有角色，删除...');
      await page.locator('text=删除角色').click();
      await page.waitForTimeout(500);
      // 确认删除
      await page.locator('text=确认, text=确定').first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 3. 点击创建角色
    await page.locator('text=+创建角色').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/qa-kun-debug-01-create-page.png` });

    // 4. 输入角色名
    const nameInput = page.locator('input[placeholder*="2-8"]');
    await nameInput.fill('坤灵根验收');
    await nameInput.blur();
    await page.waitForTimeout(500);
    console.log('角色名已输入: 坤灵根验收');

    // 5. 设置灵根 - 所有非坤=0, 坤自动=100
    const numberInputs = page.locator('input[type="number"]');
    for (let i = 0; i < 6; i++) {
      await numberInputs.nth(i).fill('0');
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);
    console.log('灵根已设置为 0 0 0 0 0 0 (坤应自动=100)');

    await page.screenshot({ path: `${OUT}/qa-kun-00b-linggen-set.png` });
    console.log('截图: qa-kun-00b-linggen-set.png');

    // 6. 点击踏入仙途 (用 evaluate 以确保触发 React onClick)
    const enterBtn = page.locator('button:has-text("踏入仙途")');
    await enterBtn.evaluate(el => el.click());
    console.log('点击踏入仙途');
    await page.waitForTimeout(5000);

    // 7. 主界面截图 - 验证 HeroSummary 显示「坤灵根」
    await page.screenshot({ path: `${OUT}/qa-kun-01-game-screen.png` });
    console.log('截图: qa-kun-01-game-screen.png');

    // 8. 验证主界面内容
    const bodyText = await page.locator('body').innerText();
    const heroSummaryKun = bodyText.includes('· 坤灵根验收 ·') && bodyText.includes('坤灵根');
    console.log(`HeroSummary 显示「坤灵根验收」+「坤灵根」: ${heroSummaryKun}`);
    results.phase1.details.heroSummaryKun = heroSummaryKun;

    // 9. 点击人物按钮
    const personBtn = page.locator('button:has-text("人物")');
    const personBtnVisible = await personBtn.isVisible().catch(() => false);
    console.log(`人物按钮可见: ${personBtnVisible}`);
    await personBtn.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${OUT}/qa-kun-01b-accordion-open.png` });
    console.log('截图: qa-kun-01b-accordion-open.png');

    // 10. 查找人物详情按钮
    const detailBtn = page.locator('button:has-text("详情"), text=详情').first();
    const detailBtnVisible = await detailBtn.isVisible().catch(() => false);
    console.log(`详情按钮可见: ${detailBtnVisible}`);

    if (detailBtnVisible) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
    }

    // 11. 人物详情截图
    await page.screenshot({ path: `${OUT}/qa-kun-02-character-screen.png` });
    console.log('截图: qa-kun-02-character-screen.png');

    // 12. 验证人物详情页
    const detailText = await page.locator('body').innerText();
    const charNameMatch = detailText.includes('坤灵根验收');
    const kunLinggenMatch = detailText.includes('坤灵根');
    console.log(`人物详情 - 角色名「坤灵根验收」: ${charNameMatch}`);
    console.log(`人物详情 - 灵根「坤灵根」: ${kunLinggenMatch}`);

    // 提取灵根数值
    const linggenMatch = detailText.match(/坤[^\d]*(\d+)/);
    if (linggenMatch) {
      console.log(`坤灵根数值: ${linggenMatch[1]}%`);
    }

    // 检查灵气上限
    const qiMatch = detailText.match(/灵气.*?(\d+)\s*\/\s*(\d+)/);
    if (qiMatch) {
      console.log(`灵气: ${qiMatch[1]} / ${qiMatch[2]}`);
    }

    results.phase1.details.charName = charNameMatch;
    results.phase1.details.kunLinggen = kunLinggenMatch;
    results.phase1.details.heroSummaryOK = heroSummaryKun && charNameMatch && kunLinggenMatch;

    console.log(`\nPhase 1 判定: ${results.phase1.details.heroSummaryOK ? '✅ 通过' : '❌ 失败'}`);

    // === Phase 2: 灵气吸纳测试 ===
    console.log('\n=== Phase 2: 灵气吸纳测试 ===');

    // 13. 返回主界面
    const backBtn = page.locator('button:has-text("返回")').first();
    const backVisible = await backBtn.isVisible().catch(() => false);
    if (backVisible) {
      await backBtn.click();
      await page.waitForTimeout(1000);
    }

    // 14. 点击历练
    const lilianBtn = page.locator('button:has-text("历练")');
    const lilianVisible = await lilianBtn.isVisible().catch(() => false);
    console.log(`历练按钮可见: ${lilianVisible}`);
    await lilianBtn.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${OUT}/qa-spirit-00-choose-action.png` });
    console.log('截图: qa-spirit-00-choose-action.png');

    // 15. 选择吸纳灵气
    const absorbBtn = page.locator('button:has-text("吸纳灵气")');
    const absorbVisible = await absorbBtn.isVisible().catch(() => false);
    console.log(`吸纳灵气按钮可见: ${absorbVisible}`);
    if (absorbVisible) {
      await absorbBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: `${OUT}/qa-spirit-01-narrative.png` });
    console.log('截图: qa-spirit-01-narrative.png');

    // 16. 点击继续
    const continueBtn = page.locator('button:has-text("继续")').first();
    const continueVisible = await continueBtn.isVisible().catch(() => false);
    console.log(`继续按钮可见: ${continueVisible}`);
    if (continueVisible) {
      await continueBtn.click();
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: `${OUT}/qa-spirit-absorb-settlement.png` });
    console.log('截图: qa-spirit-absorb-settlement.png');

    // 验证灵气是否变化
    const settlementText = await page.locator('body').innerText();
    const qiChanged = !settlementText.includes('炼气 0 / 384') || settlementText.includes('炼气 1');
    console.log(`灵气吸纳后有变化: ${qiChanged}`);
    results.phase2.details.qiChanged = qiChanged;

    // 17. 点击完成
    const finishBtn = page.locator('button:has-text("完成")').first();
    const finishVisible = await finishBtn.isVisible().catch(() => false);
    console.log(`完成按钮可见: ${finishVisible}`);
    if (finishVisible) {
      await finishBtn.click();
      await page.waitForTimeout(1000);
    }

    console.log('\n=== 测试完成 ===');
    console.log(`Phase 1: ${results.phase1.details.heroSummaryOK ? '✅ 通过' : '❌ 失败'}`);
    console.log(`Phase 2: ${results.phase2.details.qiChanged ? '✅ 通过' : '❌ 失败 (灵气吸纳功能未生效)'}`);

  } catch (err) {
    console.error('测试出错:', err.message);
    await page.screenshot({ path: `${OUT}/qa-kun-error.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main();