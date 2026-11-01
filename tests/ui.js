// 화면 확인: 사람 1명 + 컴퓨터로 직접 눌러 보며 스크린샷
const { chromium } = require('playwright');
const path = require('path');
const out = f => path.resolve(__dirname, '../shots', f);
(async () => {
  const base = 'file://' + path.resolve(__dirname, '../index.html');
  const browser = await chromium.launch();
  const sizes = [['mac', { width: 1440, height: 860 }], ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]];
  const errors = [];
  for (const [tag, vp] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(tag + ': ' + e.message));
    await page.goto(base + '?test=0.25');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.screenshot({ path: out(`${tag}-1-title.png`) });
    await page.click('#btnNew');
    await page.click('#countSeg [data-n="4"]');
    await page.screenshot({ path: out(`${tag}-2-setup.png`), fullPage: true });
    await page.click('#btnStart');
    await page.waitForSelector('#rollBtn:not([disabled])');
    await page.screenshot({ path: out(`${tag}-3-game.png`) });
    // 사람 차례를 여러 번 진행: 결정 창은 예를 누름
    let shotBuy = false, rolls = 0;
    for (let step = 0; step < 400 && rolls < 12; step++) {
      if (await page.isVisible('#rollBtn:not([disabled])') && await page.isHidden('#overlay')) { await page.click('#rollBtn', { force: true }); rolls++; continue; }
      const btn = await page.$('#overlay:not([hidden]) .btn.primary, #overlay:not([hidden]) .sell-list button');
      if (btn) {
        if (!shotBuy && await page.isVisible('#pop h3')) { await page.waitForTimeout(300); await page.screenshot({ path: out(`${tag}-4-popup.png`) }); shotBuy = true; }
        await btn.click(); continue;
      }
      if (await page.isVisible('.board.selecting')) { await page.click('.tile[data-i="0"]'); continue; }
      await page.waitForTimeout(100);
    }
    await page.waitForSelector('#rollBtn:not([disabled])');
    await page.screenshot({ path: out(`${tag}-5-midgame.png`) });
    await page.click('.tile[data-i="39"]');
    await page.waitForTimeout(300); await page.screenshot({ path: out(`${tag}-6-tileinfo.png`) });
    await page.click('#dialog .btn.primary');
    await page.click('#logo');
    await page.waitForTimeout(300); await page.screenshot({ path: out(`${tag}-7-exit.png`) });
    await page.click('#dialog .btn.primary'); // 저장하고 나가기
    const contDisabled = await page.isDisabled('#btnContinue');
    await page.click('#btnContinue');
    await page.waitForSelector('#screen-game:not([hidden])');
    const round = await page.evaluate(() => WM_game.s.round);
    console.log(tag, 'rolls', rolls, 'continue disabled?', contDisabled, 'resumed round', round);
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no errors');
})();
