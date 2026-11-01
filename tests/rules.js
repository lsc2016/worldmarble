// 규칙 단위 확인: node tests/rules.js
global.window = {};
require('../js/data.js'); require('../js/game.js'); require('../js/ai.js');
const Game = window.WM_Game, AI = window.WM_AI, { TILES, RULES } = window.WM_DATA;
const assert = require('assert');

function make(n = 2, opts = {}) {
  const st = Game.newState({ players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, color: '#000', isAI: true })), startMoney: 300, maxTurns: 30 });
  const io = {
    wait: async () => {}, log: () => {}, update: () => {}, save: () => {}, gameOver: () => {},
    aiThinking: async () => {}, ask: async () => false, notify: async () => {}, waitRoll: async () => {},
    showDice: async () => {}, moveToken: async () => {}, jumpToken: async () => {}, turnStart: async () => {}, aiDelay: () => 0,
  };
  const g = new Game(st, io, opts.ai || AI);
  return g;
}
function dice(g, rolls) { g.rollDice = () => rolls.shift(); }
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

(async () => {
  await t('주사위 합만큼 이동 + 출발 지나면 월급', async () => {
    const g = make(); const p = g.players[0]; p.pos = 36; dice(g, [[3, 4]]);
    await g.playTurn(p);
    assert.equal(p.pos, 3); // 36+7=43 → 3 (베이징)
    assert(p.money === 300 + RULES.salary - (g.s.tiles[3].owner === 0 ? 5 : 0));
  });
  await t('더블이면 한 번 더, 세 번 연속 더블은 무인도', async () => {
    const g = make(); const p = g.players[0]; dice(g, [[1, 1], [2, 2], [3, 3]]);
    g.ai = { decide: () => false };
    await g.playTurn(p);
    assert.equal(p.pos, 10); assert.equal(p.island, RULES.islandTurns);
  });
  await t('무인도: 같은 숫자면 탈출, 아니면 쉼, 3턴 뒤 자유', async () => {
    const g = make(); const p = g.players[0]; g.ai = { decide: () => false };
    p.pos = 10; p.island = 3; dice(g, [[1, 2], [3, 4], [5, 6], [1, 2]]);
    await g.playTurn(p); assert.equal(p.island, 2); assert.equal(p.pos, 10);
    await g.playTurn(p); await g.playTurn(p); assert.equal(p.island, 0); assert.equal(p.pos, 10);
    await g.playTurn(p); assert.equal(p.pos, 13);
    p.pos = 10; p.island = 3; dice(g, [[2, 2], [5, 6]]);
    await g.playTurn(p); assert.equal(p.island, 0); assert.equal(p.pos, 14, '더블 탈출 후 추가 굴림 없음');
  });
  await t('무인도 탈출권', async () => {
    const g = make(); const p = g.players[0]; g.ai = { decide: (g, p, k) => k === 'escape' };
    p.pos = 10; p.island = 3; p.escape = 1; dice(g, [[1, 2]]);
    await g.playTurn(p); assert.equal(p.escape, 0); assert.equal(p.pos, 13);
  });
  await t('우주여행: 다음 턴 요금 내고 원하는 칸으로', async () => {
    const g = make(); const p = g.players[0]; g.ai = { decide: (g, p, k) => (k === 'space' ? 5 : false) };
    p.pos = 26; dice(g, [[1, 3]]);
    await g.playTurn(p); assert.equal(p.pos, 30); assert(p.space);
    await g.playTurn(p); assert.equal(p.pos, 5); assert(!p.space);
    assert.equal(p.money, 300 - RULES.spaceFee + RULES.salary);
  });
  await t('사회복지기금: 내는 칸에 쌓이고 받는 칸에서 모두 받음', async () => {
    const g = make(); const [a, b] = g.players; g.ai = { decide: () => false };
    a.pos = 35; dice(g, [[1, 2], [6, 6], [6, 5]]);
    await g.playTurn(a); assert.equal(g.s.fund, RULES.fundPay); assert.equal(a.money, 300 - RULES.fundPay);
    b.pos = 8; await g.playTurn(b); assert.equal(b.pos, 31); // 8+12=20 → 기금 받고 더블 → 31
    assert.equal(g.s.fund, 0); assert.equal(b.money, 300 + RULES.fundPay);
  });
  await t('사기, 짓기, 통행료(같은 색 2배, 건물)', async () => {
    const g = make(); const [a, b] = g.players;
    g.ai = { decide: (g, p, k) => k === 'buy' || k === 'build' };
    dice(g, [[1, 2], [1, 2]]);
    await g.playTurn(a); assert.equal(g.s.tiles[3].owner, 0); assert.equal(a.money, 295);
    a.pos = 0; await g.playTurn(a); assert.equal(g.s.tiles[3].level, 1); assert.equal(a.money, 292);
    assert.equal(g.rentOf(3), TILES[3].rent[1]);
    g.s.tiles[1].owner = 0; g.s.tiles[4].owner = 0;
    assert.equal(g.rentOf(1), TILES[1].rent[0] * RULES.groupBonus);
    g.ai = { decide: () => false };
    dice(g, [[1, 2]]); await g.playTurn(b);
    assert.equal(b.money, 300 - TILES[3].rent[1]); assert.equal(a.money, 292 + TILES[3].rent[1]);
  });
  await t('돈이 모자라면 싼 것부터 반값에 팔고, 그래도 못 내면 파산', async () => {
    const g = make(3); const [a, b, c] = g.players;
    g.s.tiles[39].owner = 0; g.s.tiles[39].level = 3; // 뉴욕 호텔 250
    b.money = 100; g.s.tiles[1].owner = 1; g.s.tiles[38 - 1].owner = 1; // 타이베이(5), 워싱턴(40)
    b.pos = 36; dice(g, [[1, 2]]); g.ai = { decide: AI.decide.bind(AI) };
    await g.playTurn(b);
    assert(b.bankrupt, '전부 팔아도 100+2+20 < 250 → 파산');
    assert.equal(g.s.tiles[1].owner, null);
    c.money = 240; g.s.tiles[5].owner = 2; g.s.tiles[23].owner = 2; g.s.tiles[23].level = 1; // 방콕 8, 리마 24+12
    c.pos = 36; dice(g, [[1, 2]]);
    await g.playTurn(c);
    assert(!c.bankrupt); assert.equal(g.s.tiles[5].owner, null, '방콕(싼 것) 먼저 팜'); assert.equal(g.s.tiles[23].owner, null);
    assert.equal(c.money, 240 + 4 + 18 - 250);
  });
  await t('한 명 남으면 끝, 순위', async () => {
    const g = make(3); g.players[1].bankrupt = true; g.players[2].bankrupt = true;
    assert(g.checkOver()); assert.equal(g.ranking()[0].player.id, 0);
  });
  await t('황금열쇠 덱 모두 처리 가능', async () => {
    for (let k = 0; k < window.WM_DATA.CARDS.length; k++) {
      const g = make(); const p = g.players[0]; p.pos = 2;
      g.s.deck = [k]; g.s.deckPos = 0; g.ai = { decide: () => false };
      await g.drawCard(p);
    }
    assert(window.WM_DATA.CARDS.length >= 15 && window.WM_DATA.CARDS.length <= 20);
  });
  console.log(`\n${n} passed`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
