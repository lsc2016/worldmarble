// 컴퓨터 4명으로 여러 판을 빠르게 돌려 오류 없이 끝나는지 확인
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const url = 'file://' + path.resolve(__dirname, '../index.html') + '?test=0';
  const browser = await chromium.launch();
  const games = +(process.argv[2] || 5);
  let fail = 0;
  for (let k = 0; k < games; k++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.evaluate(() => localStorage.clear());
    await page.click('#btnNew');
    await page.click('#countSeg [data-n="4"]');
    await page.click('.prow [data-ai="1"]'); // 1번도 컴퓨터로
    await page.selectOption('#maxTurns', k % 2 ? '0' : '30');
    await page.click('#btnStart');
    try {
      await page.waitForSelector('#screen-result:not([hidden])', { timeout: 60000 });
      const res = await page.$$eval('#resultList li', ls => ls.map(l => l.innerText.replace(/\s+/g, ' ')));
      const sub = await page.textContent('#resultSub');
      console.log(`game ${k}: ${sub}\n  ` + res.join('\n  '));
    } catch (e) {
      fail++;
      const st = await page.evaluate(() => window.WM_game && { round: WM_game.s.round, cur: WM_game.s.current, log: WM_game.s.log.slice(-5) });
      console.log(`game ${k}: TIMEOUT`, JSON.stringify(st));
    }
    if (errors.length) { fail++; console.log('ERRORS', errors); }
    await page.close();
  }
  await browser.close();
  console.log(fail ? `FAILED ${fail}` : 'ALL OK');
  process.exit(fail ? 1 : 0);
})();
