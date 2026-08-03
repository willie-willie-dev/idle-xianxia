import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = '/home/lovecactus/.openclaw/workspace/tmp-qa';
const BASE_URL = 'http://127.0.0.1:30200';

const screenshot = (page, name) => {
  const p = path.join(SCREENSHOT_DIR, `qa-final-${name}.png`);
  page.screenshot({ path: p });
  console.log(`📸 Saved: ${p}`);
  return p;
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto(BASE_URL);
  await page.waitForTimeout(800);
  
  // Step 1: Entry screen
  screenshot(page, '01-entry');
  console.log('Step 1: Entry screen OK');

  // Step 2: Click create character
  await page.click('.new-char-card');
  await page.waitForTimeout(1200);
  
  screenshot(page, '02-create-screen');
  console.log('Step 2: Create screen OK');

  // Step 3: Fill name
  await page.fill('input.form-input', '火灵根终验');
  await page.waitForTimeout(200);

  // Step 4: Fill all spirit root inputs (fire=100, others=0)
  const inputs = await page.locator('input.root-input-num').all();
  const targetVals = ['0', '100', '0', '0', '0', '0'];
  
  for (let i = 0; i < inputs.length; i++) {
    await inputs[i].fill(targetVals[i]);
    await page.waitForTimeout(150);
  }
  
  const domBefore = await page.evaluate(() => {
    const els = document.querySelectorAll('input.root-input-num');
    return Array.from(els).map(e => `${e.dataset.spiritKey}=${e.value}`).join(', ');
  });
  console.log(`DOM before submit: ${domBefore}`);

  const kunText = await page.evaluate(() => {
    const kun = document.querySelector('.root-auto-val');
    return kun ? kun.textContent : 'not found';
  });
  console.log(`Kun auto value: ${kunText}`);

  screenshot(page, '03-create-filled');
  console.log('Step 3: Spirit roots filled');

  // Step 5: Submit
  await page.click('.btn-create');
  await page.waitForTimeout(2500);
  
  console.log(`URL after submit: ${page.url()}`);
  screenshot(page, '04-game-screen');
  console.log('Step 4: Game screen OK');

  // Step 6: Check HeroSummary
  const heroInfo = await page.evaluate(() => {
    const badge = document.querySelector('.realm-badge');
    const nameEl = document.querySelector('.game-hero-name');
    return {
      spiritRootLabel: badge ? badge.textContent.trim() : 'not found',
      charName: nameEl ? nameEl.textContent.trim() : 'not found',
    };
  });
  console.log(`Hero badge: "${heroInfo.spiritRootLabel}"`);
  console.log(`Hero name: "${heroInfo.charName}"`);

  // Step 7: Click 人物 button
  const personBtn = await page.locator('button').filter({ hasText: '人物' }).first();
  const btnExists = await personBtn.count() > 0;
  console.log(`人物 button exists: ${btnExists}`);
  
  if (btnExists) {
    await personBtn.click();
    await page.waitForTimeout(800);
    screenshot(page, '05-accordion-open');
    console.log('Step 5: Accordion opened');
    
    // Try clicking hero card to enter full character screen
    const heroCard = page.locator('.game-hero-card').first();
    const heroExists = await heroCard.count() > 0;
    if (heroExists) {
      await heroCard.click();
      await page.waitForTimeout(1200);
      screenshot(page, '06-character-screen');
      console.log('Step 6: Character screen');
    }
  }

  // Step 8: Read character screen content
  const charText = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('\n=== Character screen text ===');
  console.log(charText.slice(0, 500));

  // Step 9: Check localStorage
  const storedRoots = await page.evaluate(() => {
    try {
      const storage = localStorage.getItem('idle_xianxia_accounts');
      if (!storage) return 'no storage';
      const data = JSON.parse(storage);
      const accounts = data.accounts || [];
      if (accounts.length === 0) return 'no accounts';
      const lastAccount = accounts[accounts.length - 1];
      const gs = data.gameStates ? data.gameStates[lastAccount.id] : null;
      if (!gs) return 'no gameState';
      return JSON.stringify(gs.character.spiritRoots);
    } catch (e) {
      return 'error: ' + e.message;
    }
  });
  console.log(`\nStored spirit roots: ${storedRoots}`);

  await browser.close();
  console.log('\n✅ QA test complete');
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});