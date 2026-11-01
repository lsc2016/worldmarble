/*
 * World Marble — 화면 전환, 새 게임 설정, 저장, 메뉴
 */
(function () {
  'use strict';
  const { RULES } = window.WM_DATA;
  const Game = window.WM_Game, AI = window.WM_AI, UI = window.WM_UI;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SAVE_KEY = 'worldmarble.save.v1';
  const PREF_KEY = 'worldmarble.prefs.v1';
  const COLORS = ['#e63946', '#1d7bf2', '#2a9d3f', '#f4a100', '#8e44ad', '#00a6a6'];

  const params = new URLSearchParams(location.search);
  if (params.has('test')) window.WM_TEST_SPEED = Number(params.get('test')) || 0;

  /* ---------- 저장 ---------- */
  const Store = {
    load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } },
    save(state) {
      try {
        if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        else localStorage.removeItem(SAVE_KEY);
      } catch { /* 저장 공간 없음: 무시 */ }
    },
    prefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; } },
    setPrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { } },
  };
  let prefs = Object.assign({ speed: 'normal' }, Store.prefs());
  UI.setSpeed(prefs.speed);

  /* ---------- 공용 대화창 ---------- */
  const Dialog = {
    resolve: null,
    show(html, buttons) {
      if (this.resolve) this.resolve(undefined);
      $('#dialogBody').innerHTML = html;
      const box = $('#dialogBtns');
      box.innerHTML = '';
      return new Promise(res => {
        this.resolve = res;
        buttons.forEach(([label, val, cls]) => {
          const b = document.createElement('button');
          b.className = 'btn ' + (cls || '');
          b.textContent = label;
          b.onclick = () => this.close(val);
          box.appendChild(b);
        });
        $('#dialog').hidden = false;
      });
    },
    close(val) {
      $('#dialog').hidden = true;
      const r = this.resolve;
      this.resolve = null;
      if (r) r(val);
    },
  };
  window.WM_Dialog = Dialog;
  $('#dialog').addEventListener('click', e => { if (e.target.id === 'dialog') Dialog.close(undefined); });

  /* ---------- 화면 전환 ---------- */
  let game = null;
  let lastSnapshot = null;

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; });
    document.body.classList.toggle('playing', id === 'screen-game');
    if (id === 'screen-title') $('#btnContinue').disabled = !Store.load();
  }

  function stopGame() {
    if (game) game.abort();
    game = null;
    UI.closePop();
    UI.game = null;
  }

  async function goHome() {
    if (game && !game.s.over) {
      const ans = await Dialog.show(
        '<h3>첫 화면으로 갈까요?</h3><p>진행 중인 게임이 있습니다. 저장하고 나갈까요?<br><small class="muted">저장하면 첫 화면의 “이어하기”로 이번 차례 처음부터 계속할 수 있습니다.</small></p>',
        [['취소', 'cancel', 'ghost'], ['저장 안 함', 'discard'], ['저장하고 나가기', 'save', 'primary']]);
      if (!ans || ans === 'cancel') return;
      if (ans === 'save') Store.save(lastSnapshot);
      else Store.save(null);
    }
    stopGame();
    show('screen-title');
  }

  /* ---------- 게임 시작 / 이어하기 ---------- */
  UI.save = state => {
    lastSnapshot = state ? JSON.parse(JSON.stringify(state)) : null;
    Store.save(lastSnapshot);
  };
  UI.gameOver = ranking => showResult(ranking);

  function startGame(state) {
    stopGame();
    show('screen-game');
    UI.buildBoard();
    game = new Game(state, UI, AI);
    window.WM_game = game; // 디버그/테스트용
    UI.attach(game);
    game.run();
  }

  function showResult(ranking) {
    const g = game;
    const medals = ['🥇', '🥈', '🥉', '4위'];
    const reason = g.alive.length <= 1 ? '한 명만 남아 게임이 끝났습니다.' : `${g.s.maxTurns}턴이 모두 끝났습니다. 재산이 가장 많은 사람이 이깁니다.`;
    $('#resultSub').textContent = reason;
    $('#resultList').innerHTML = ranking.map((r, k) => `
      <li class="${r.player.bankrupt ? 'out' : ''}" style="--pc:${r.player.color}">
        <span class="rank">${medals[k]}</span>
        <span><b>${esc(r.player.name)}</b>${r.player.isAI ? ' <small style="display:inline">(컴퓨터)</small>' : ''}
          <small>${r.player.bankrupt ? '파산' : `현금 ${r.money}만 + 도시·건물 ${r.property}만 (도시 ${r.cities}개)`}</small></span>
        <span class="total">${r.total}만</span>
      </li>`).join('');
    game = null;
    show('screen-result');
  }

  /* ---------- 새 게임 설정 ---------- */
  let setup = null;
  function defaultSetup() {
    const saved = prefs.lastSetup;
    const base = [
      { name: '플레이어1', color: COLORS[0], isAI: false },
      { name: '컴퓨터2', color: COLORS[1], isAI: true },
      { name: '컴퓨터3', color: COLORS[2], isAI: true },
      { name: '컴퓨터4', color: COLORS[3], isAI: true },
    ];
    if (saved && Array.isArray(saved.players) && saved.players.length === 4) {
      return { count: saved.count, players: saved.players, startMoney: saved.startMoney, maxTurns: saved.maxTurns };
    }
    return { count: 2, players: base, startMoney: RULES.startMoney, maxTurns: RULES.maxTurns };
  }

  function renderSetup() {
    document.querySelectorAll('#countSeg button').forEach(b => b.classList.toggle('on', +b.dataset.n === setup.count));
    const rows = $('#playerRows');
    rows.innerHTML = '';
    for (let i = 0; i < setup.count; i++) {
      const p = setup.players[i];
      const row = document.createElement('div');
      row.className = 'prow';
      row.style.setProperty('--pc', p.color);
      const used = setup.players.slice(0, setup.count).filter((q, k) => k !== i).map(q => q.color);
      row.innerHTML = `
        <input type="text" maxlength="8" value="${esc(p.name)}" aria-label="이름">
        <div class="seg"><button data-ai="0" class="${p.isAI ? '' : 'on'}">🙂 사람</button><button data-ai="1" class="${p.isAI ? 'on' : ''}">🤖 컴퓨터</button></div>
        <div class="colors">${COLORS.map(c => `<button class="swatch ${c === p.color ? 'on' : ''}" data-c="${c}" style="background:${c}" ${used.includes(c) ? 'disabled' : ''} aria-label="색"></button>`).join('')}</div>`;
      const input = row.querySelector('input');
      input.oninput = () => { p.name = input.value; };
      row.querySelectorAll('[data-ai]').forEach(b => b.onclick = () => {
        const toAI = b.dataset.ai === '1';
        // 기본 이름이면 종류에 맞춰 이름도 바꿔 줍니다.
        if (/^(플레이어|컴퓨터)\d$/.test(p.name)) p.name = (toAI ? '컴퓨터' : '플레이어') + (i + 1);
        p.isAI = toAI;
        renderSetup();
      });
      row.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { p.color = b.dataset.c; renderSetup(); });
      rows.appendChild(row);
    }
    $('#startMoney').value = String(setup.startMoney);
    $('#maxTurns').value = String(setup.maxTurns);
  }

  function openSetup() {
    setup = defaultSetup();
    renderSetup();
    show('screen-setup');
  }

  document.querySelectorAll('#countSeg button').forEach(b => b.onclick = () => { setup.count = +b.dataset.n; renderSetup(); });
  $('#startMoney').onchange = e => { setup.startMoney = +e.target.value; };
  $('#maxTurns').onchange = e => { setup.maxTurns = +e.target.value; };
  $('#btnSetupBack').onclick = () => show('screen-title');
  $('#btnStart').onclick = () => {
    const players = setup.players.slice(0, setup.count).map((p, i) => ({
      name: (p.name || '').trim() || (p.isAI ? '컴퓨터' : '플레이어') + (i + 1),
      color: p.color, isAI: p.isAI,
    }));
    prefs.lastSetup = setup;
    Store.setPrefs(prefs);
    startGame(Game.newState({ players, startMoney: setup.startMoney, maxTurns: setup.maxTurns }));
  };

  /* ---------- 첫 화면 / 결과 ---------- */
  $('#btnNew').onclick = openSetup;
  $('#btnContinue').onclick = () => { const s = Store.load(); if (s) startGame(s); };
  $('#btnRules').onclick = showRules;
  $('#btnResultHome').onclick = () => show('screen-title');
  $('#btnResultAgain').onclick = openSetup;
  $('#logo').onclick = goHome;
  $('#rollBtn').onclick = () => UI.pressRoll();
  document.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && UI.rollResolve && $('#dialog').hidden && $('#overlay').hidden) {
      e.preventDefault();
      UI.pressRoll();
    }
  });

  /* ---------- 메뉴 ---------- */
  const menu = $('#menu');
  $('#menuBtn').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    menu.hidden = true;
    if (act === 'rules') showRules();
    if (act === 'settings') showSettings();
    if (act === 'save') {
      Store.save(lastSnapshot);
      Dialog.show('<h3>💾 저장했습니다</h3><p>이번 차례가 시작될 때의 상태로 저장됩니다. 게임은 차례마다 자동으로도 저장됩니다.</p>', [['확인', true, 'primary']]);
    }
    if (act === 'home') goHome();
  });

  async function showSettings() {
    const opts = [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게']];
    const html = `<h3>⚙️ 설정</h3>
      <div class="field"><label>애니메이션·컴퓨터 속도</label>
      <div class="seg" id="speedSeg">${opts.map(([k, n]) => `<button data-k="${k}" class="${prefs.speed === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
    const p = Dialog.show(html, [['닫기', true, 'primary']]);
    document.querySelectorAll('#speedSeg button').forEach(b => b.onclick = () => {
      prefs.speed = b.dataset.k;
      Store.setPrefs(prefs);
      UI.setSpeed(prefs.speed);
      document.querySelectorAll('#speedSeg button').forEach(x => x.classList.toggle('on', x === b));
    });
    await p;
  }

  function showRules() {
    const R = RULES;
    Dialog.show(`<div class="rules"><h3>📖 World Marble 규칙</h3>
      <h4>목표</h4><ul><li>세계 도시를 사고 건물을 지어 통행료를 받으세요.</li>
        <li>한 명만 남거나, 정한 턴 수가 끝났을 때 재산(현금 + 도시·건물 값)이 가장 많은 사람이 이깁니다.</li></ul>
      <h4>진행</h4><ul><li>주사위 2개를 굴려 나온 합만큼 갑니다.</li>
        <li>같은 숫자(더블)가 나오면 한 번 더! 세 번 연속이면 무인도로 갑니다.</li>
        <li>출발 칸을 지나면 월급 ${R.salary}만을 받습니다.</li></ul>
      <h4>도시</h4><ul><li>주인 없는 도시에 서면 살 수 있습니다.</li>
        <li>내 도시에 다시 서면 🏠별장 → 🏢빌딩 → 🏨호텔 순서로 하나씩 지을 수 있습니다.</li>
        <li>남의 도시에 서면 통행료를 냅니다. 건물이 클수록 비쌉니다. 같은 색 도시를 모두 가지면 땅 통행료가 ${R.groupBonus}배!</li>
        <li>돈이 모자라면 도시를 (지은 건물 포함) 반값에 팔아 냅니다. 그래도 모자라면 파산입니다.</li></ul>
      <h4>특별한 칸</h4><ul><li>🏝️ 무인도: ${R.islandTurns}턴 동안 쉽니다. 같은 숫자가 나오거나 탈출권을 쓰면 바로 나옵니다.</li>
        <li>🚀 우주여행: 다음 턴에 요금 ${R.spaceFee}만을 내고 원하는 칸으로 바로 갑니다.</li>
        <li>🏛️ 기금 내기: ${R.fundPay}만을 냅니다. 이 돈은 🎁 기금 받기 칸에 쌓이고, 거기 도착한 사람이 모두 가져갑니다.</li>
        <li>🔑 황금열쇠: 카드를 뽑습니다. 돈을 받거나 내고, 이동하거나, 무인도 탈출권을 얻습니다.</li></ul>
      <h4>조작</h4><ul><li>판 가운데 “굴리기” 버튼(또는 스페이스 키)으로 주사위를 굴립니다.</li>
        <li>도시 칸을 누르면 값·통행료·주인·건물을 볼 수 있습니다.</li>
        <li>게임은 차례마다 자동 저장됩니다.</li></ul></div>`, [['닫기', true, 'primary']]);
  }

  show('screen-title');
})();
