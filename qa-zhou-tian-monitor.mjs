import { chromium } from 'playwright';
import * as path from 'path';

const SCREENSHOT_DIR = '/home/lovecactus/.openclaw/workspace/tmp-qa';
const BASE_URL = 'http://127.0.0.1:30200';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/lovecactus/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
  });
  const page = await browser.newPage();
  
  await page.goto(BASE_URL);
  await page.waitForTimeout(1000);

  // Check if character exists
  const hasChar = await page.locator('[class*="char-card"]:not(.new-char-card)').count();
  console.log(`Existing chars: ${hasChar}`);

  if (hasChar === 0) {
    // Create a new character first
    await page.click('.new-char-card');
    await page.waitForTimeout(1200);
    console.log('Creating character...');
    
    // Fill name
    const nameInput = page.locator('input.form-input');
    await nameInput.fill('周天功法测试');
    await page.waitForTimeout(200);
    
    // Take screenshot of create screen
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'qa-zhou-00-create-screen.png'), fullPage: true });
    console.log('Create screen screenshot');

    // Click submit (踏入仙途) without changing spirit roots - use default
    await page.click('.btn-create');
    await page.waitForTimeout(2500);
    console.log('Character created, entered game');
  } else {
    // Click existing character
    await page.locator('[class*="char-card"]:not(.new-char-card)').first().click();
    await page.waitForTimeout(2000);
  }

  // Now we're in game screen
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'qa-zhou-01-game-screen.png'), fullPage: true });
  console.log('Game screen screenshot');
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Game screen text:\n', bodyText.slice(0, 400));

  // Find all buttons
  const btns = await page.locator('button').all();
  console.log(`\nFound ${btns.length} buttons`);
  for (const btn of btns) {
    const t = await btn.textContent();
    console.log(`  button: "${t?.trim()}"`);
  }

  // Try to find 功法 or 周天 button
  let found = false;
  for (const btn of btns) {
    const t = await btn.textContent();
    if (t && (t.includes('功') || t.includes('周天') || t.includes('紫薇'))) {
      console.log(`\nClicking: ${t.trim()}`);
      await btn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'qa-zhou-02-after-click.png'), fullPage: true });
      found = true;
      break;
    }
  }

  if (!found) {
    console.log('\nNo 功法 button found, checking all accordions...');
    // Look for 人物 button
    const personBtn = page.locator('button').filter({ hasText: /^(人物|行囊|功法)/ }).first();
    if (await personBtn.count() > 0) {
      await personBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'qa-zhou-02-accordion.png'), fullPage: true });
      
      const newBody = await page.evaluate(() => document.body.innerText);
      console.log('After accordion click:\n', newBody.slice(0, 600));
    }
  }

  // Try clicking on the hero card to go to full character screen
  const heroCard = page.locator('.game-hero-card, [class*="hero-card"]').first();
  if (await heroCard.count() > 0) {
    await heroCard.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'qa-zhou-03-character-screen.png'), fullPage: true });
    
    const charText = await page.evaluate(() => document.body.innerText);
    console.log('\nCharacter screen text:\n', charText.slice(0, 800));
  }

  await browser.close();
  console.log('\nDone');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});