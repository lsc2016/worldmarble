/*
 * World Marble — 화면 (게임판 그리기, 애니메이션, 결정 창)
 * game.js 가 부르는 io 인터페이스를 구현합니다.
 */
(function () {
  'use strict';
  const { RULES, GROUPS, TILES, J } = window.WM_DATA;
  const LV = window.WM_LEVEL_NAMES;
  const BLD = ['', '🏠', '🏢', '🏨'];
  const ICON = { start: '🏁', island: '🏝️', fundGet: '🎁', space: '🚀', key: '🔑', fundPay: '🏛️' };

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const won = n => `${n}만`;

  // 칸 번호 → 판 위 (행, 열). 0번은 오른쪽 아래, 시계 반대 방향.
  function cell(i) {
    if (i <= 10) return { r: 11, c: 11 - i, side: 'b' };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, side: 'l' };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), side: 't' };
    return { r: 1 + (i - 30), c: 11, side: 'r' };
  }

  const SPEEDS = { slow: 1.6, normal: 1, fast: 0.45 };

  const UI = {
    game: null,
    speed: 1,
    tileEls: [],
    tokenEls: [],
    rollResolve: null,
    selectResolve: null,
    onSave: null,
    onGameOver: null,

    ms(n) { return Math.round(n * this.speed); },
    wait(n) { return new Promise(r => setTimeout(r, Math.max(0, n))); },
    aiDelay() { return this.ms(650); },
    setSpeed(key) { this.speed = window.WM_TEST_SPEED ?? SPEEDS[key] ?? 1; },

    /* ---------- 판 만들기 ---------- */
    buildBoard() {
      const board = $('#board');
      board.querySelectorAll('.tile').forEach(e => e.remove());
      this.tileEls = TILES.map((t, i) => {
        const { r, c, side } = cell(i);
        const el = document.createElement('div');
        const corner = i % 10 === 0;
        el.className = `tile side-${side} ${t.type}` + (corner ? ' corner' : '') + (t.type !== 'city' && !corner ? ' special' : '');
        el.style.gridRow = r; el.style.gridColumn = c;
        el.dataset.i = i;
        if (t.type === 'city') {
          el.innerHTML = `<div class="band" style="background:${GROUPS[t.group].color}"></div>
            <div class="nm"><span class="full${t.name.length > 4 ? ' long' : ''}">${esc(t.name)}</span><span class="short">${esc(t.short)}</span></div>
            <div class="pr">${won(t.price)}</div>`;
        } else {
          el.innerHTML = `<div class="ico">${ICON[t.type]}</div>
            <div class="nm"><span class="full">${esc(t.name)}</span><span class="short">${esc(t.short)}</span></div>
            ${t.type === 'fundGet' ? '<div class="fundamt"></div>' : ''}`;
        }
        el.addEventListener('click', () => this.onTileClick(i));
        board.insertBefore(el, board.querySelector('.center'));
        return el;
      });
    },

    attach(game) {
      this.game = game;
      this.closePop();
      $('#banner').hidden = true;
      $('#board').classList.remove('selecting');
      this.rollResolve = null;
      this.selectResolve = null;
      const tokens = $('#tokens');
      tokens.innerHTML = '';
      this.tokenEls = game.players.map((p, i) => {
        const el = document.createElement('div');
        el.className = 'token';
        el.style.setProperty('--pc', p.color);
        el.textContent = i + 1;
        tokens.appendChild(el);
        return el;
      });
      game.players.forEach(p => { p._vpos = p.pos; });
      $('#log').innerHTML = '';
      game.s.log.slice(-4).forEach(m => this.log(m));
      this.renderPanels();
      this.update();
      requestAnimationFrame(() => this.placeTokens(false));
    },

    /* ---------- 다시 그리기 ---------- */
    renderPanels() {
      const ps = this.game.players;
      const a = $('#playersA'), b = $('#playersB');
      a.innerHTML = ''; b.innerHTML = '';
      ps.forEach((p, i) => {
        const el = document.createElement('div');
        el.className = 'pcard';
        el.id = `pcard${i}`;
        el.style.setProperty('--pc', p.color);
        (i < 2 ? a : b).appendChild(el);
      });
    },

    update() {
      const g = this.game;
      if (!g) return;
      const s = g.s;
      g.players.forEach((p, i) => {
        const el = $(`#pcard${i}`);
        if (!el) return;
        el.classList.toggle('active', s.current === i && !s.over);
        el.classList.toggle('out', p.bankrupt);
        const st = [];
        if (p.island > 0) st.push(`🏝️${p.island}`);
        if (p.space) st.push('🚀');
        if (p.escape > 0) st.push(`🎫${p.escape}`);
        el.innerHTML = `<div class="pname">${esc(p.name)}${p.isAI ? '<span class="tag">컴퓨터</span>' : ''}</div>
          <div class="money">${p.bankrupt ? '파산' : won(p.money)}</div>
          <div class="meta"><span>🏙️ ${g.ownedBy(p).length}</span>${st.map(x => `<span>${x}</span>`).join('')}</div>`;
      });
      this.tileEls.forEach((el, i) => {
        const t = TILES[i];
        if (t.type === 'city') {
          const st = s.tiles[i];
          const owned = st.owner !== null;
          el.classList.toggle('owned', owned);
          if (owned) el.style.setProperty('--oc', g.players[st.owner].color);
          el.querySelector('.band').textContent = owned ? BLD[st.level] : '';
        } else if (t.type === 'fundGet') {
          el.querySelector('.fundamt').textContent = s.fund ? won(s.fund) : '';
        }
      });
      const p = g.cur();
      $('#turnLabel').innerHTML = `<span class="dot" style="--pc:${p.color}"></span>${esc(p.name)} 차례
        <small>· ${s.round}${s.maxTurns ? '/' + s.maxTurns : ''}턴</small>`;
      $('#fundLabel').textContent = `🎁 사회복지기금 ${won(s.fund)}`;
      this.tokenEls.forEach((el, i) => {
        el.hidden = g.players[i].bankrupt;
        el.classList.toggle('active', i === s.current);
      });
    },

    log(msg) {
      const ul = $('#log');
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
      while (ul.children.length > 4) ul.firstChild.remove();
    },

    // 말은 칸의 바깥쪽에 놓아 도시 이름을 가리지 않게 합니다.
    tileCenter(i) {
      const el = this.tileEls[i];
      const w = el.offsetWidth, h = el.offsetHeight;
      let x = el.offsetLeft + w / 2, y = el.offsetTop + h / 2;
      if (i % 10 !== 0) {
        const side = cell(i).side;
        if (side === 'b') y += h * 0.34;
        if (side === 't') y -= h * 0.34;
        if (side === 'l') x -= w * 0.34;
        if (side === 'r') x += w * 0.34;
      }
      return { x, y };
    },
    placeTokens(animate = true) {
      if (!this.game) return;
      const ps = this.game.players;
      const OFF = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      const unit = $('#board').offsetWidth * 0.017;
      ps.forEach((p, i) => {
        const el = this.tokenEls[i];
        if (p.bankrupt) return;
        const pos = p._vpos ?? p.pos;
        const same = ps.filter(q => !q.bankrupt && (q._vpos ?? q.pos) === pos);
        const c = this.tileCenter(pos);
        let dx = 0, dy = 0;
        if (same.length > 1) { const k = same.indexOf(p); [dx, dy] = OFF[k].map(v => v * unit); }
        if (!animate) el.style.transition = 'none';
        el.style.left = `${c.x + dx}px`;
        el.style.top = `${c.y + dy}px`;
        if (!animate) { el.offsetWidth; el.style.transition = ''; }
      });
    },

    /* ---------- io: 애니메이션 ---------- */
    async turnStart(p) {
      this.update();
      if (!this.game.players.some(q => !q.isAI && !q.bankrupt) && this.speed < 0.1) return;
      await this.showBanner(`${p.name} 차례`, p.color, this.ms(p.isAI ? 500 : 800));
    },
    async showBanner(text, color, ms, hint) {
      const b = $('#banner');
      b.textContent = text;
      b.className = 'banner' + (hint ? ' hint' : '');
      b.style.setProperty('--pc', color || '#14213d');
      b.hidden = false;
      if (ms) { await this.wait(ms); b.hidden = true; }
    },

    waitRoll(p) {
      const btn = $('#rollBtn');
      btn.disabled = false;
      btn.textContent = '🎲 굴리기';
      btn.focus({ preventScroll: true });
      return new Promise(res => { this.rollResolve = res; });
    },
    pressRoll() {
      if (!this.rollResolve) return;
      const r = this.rollResolve;
      this.rollResolve = null;
      $('#rollBtn').disabled = true;
      r();
    },

    async showDice(d) {
      const box = $('#dice');
      const dice = box.querySelectorAll('.die');
      const btn = $('#rollBtn');
      btn.disabled = true;
      box.classList.remove('double');
      box.classList.add('rolling');
      const end = Date.now() + this.ms(650);
      while (Date.now() < end) {
        dice.forEach(el => { el.dataset.v = 1 + Math.floor(Math.random() * 6); });
        await this.wait(70);
      }
      box.classList.remove('rolling');
      dice[0].dataset.v = d[0]; dice[1].dataset.v = d[1];
      if (d[0] === d[1]) box.classList.add('double');
      btn.textContent = `${d[0] + d[1]}${d[0] === d[1] ? ' · 더블!' : ''}`;
      await this.wait(this.ms(350));
    },

    async moveToken(p, path) {
      const el = this.tokenEls[p.id];
      const step = this.ms(170);
      for (const pos of path) {
        p._vpos = pos;
        el.classList.remove('hop'); el.offsetWidth; el.classList.add('hop');
        this.placeTokens();
        this.update();
        await this.wait(step);
      }
      p._vpos = undefined;
      await this.wait(this.ms(150));
    },
    async jumpToken(p, pos) {
      const el = this.tokenEls[p.id];
      el.classList.add('jump');
      p._vpos = pos;
      this.placeTokens();
      await this.wait(this.ms(600));
      el.classList.remove('jump');
      p._vpos = undefined;
    },

    /* ---------- io: 판 위 결정 창 ---------- */
    openPop(html, cls = '') {
      const pop = $('#pop');
      pop.className = 'pop ' + cls;
      pop.innerHTML = html;
      $('#overlay').hidden = false;
      return pop;
    },
    closePop() { $('#overlay').hidden = true; $('#pop').innerHTML = ''; },

    popButtons(pop, buttons) {
      return new Promise(res => {
        const box = document.createElement('div');
        box.className = 'btns';
        buttons.forEach(([label, val, cls]) => {
          const b = document.createElement('button');
          b.className = 'btn ' + (cls || '');
          b.textContent = label;
          b.onclick = () => { this.closePop(); res(val); };
          box.appendChild(b);
        });
        pop.appendChild(box);
        box.querySelector('.primary')?.focus({ preventScroll: true });
      });
    },

    cityHead(i) {
      const t = TILES[i];
      return `<div class="band-lg" style="background:${GROUPS[t.group].color}"></div>
        <h3>${esc(t.name)}</h3>`;
    },

    async aiThinking(p, kind, info, ans) {
      if (this.speed < 0.05) return;
      let text;
      if (kind === 'buy') text = ans ? `🏙️ ${J(TILES[info.tile].name, '을')} 삽니다!` : `🤔 ${J(TILES[info.tile].name, '은')} 사지 않습니다.`;
      else if (kind === 'build') text = ans ? `🏗️ ${TILES[info.tile].name}에 ${J(LV[info.level], '을')} 짓습니다!` : `🤔 이번엔 짓지 않습니다.`;
      else if (kind === 'escape') text = '🎫 무인도 탈출권을 씁니다!';
      else if (kind === 'sell') text = `🔻 ${J(TILES[ans].name, '을')} 팝니다.`;
      else if (kind === 'space') {
        text = `🚀 ${J(TILES[ans].name, '으로')} 갑니다!`;
        this.tileEls[ans].classList.add('hl');
      }
      this.openPop(`<div style="color:${p.color}">🤖 ${esc(p.name)}</div><p>${esc(text)}</p>`, 'ai');
      await this.wait(this.ms(900));
      this.closePop();
      if (kind === 'space') this.tileEls[ans].classList.remove('hl');
    },

    rentRows(i, highlight) {
      const t = TILES[i];
      return `<table>${LV.map((n, l) => `<tr${l === highlight ? ' style="background:#fff3c4"' : ''}><td>${l ? BLD[l] + ' ' : ''}${n}${l === 0 ? ' (같은 색 모두 가지면 ×' + RULES.groupBonus + ')' : ''}</td><td>${won(t.rent[l])}</td></tr>`).join('')}</table>`;
    },

    ask(p, kind, info) {
      const g = this.game;
      if (kind === 'buy') {
        const t = TILES[info.tile];
        const pop = this.openPop(`${this.cityHead(info.tile)}
          <p>땅값 <b>${won(t.price)}</b> · 통행료 ${won(t.rent[0])}부터</p>
          <p class="money-line">${esc(p.name)}의 돈 ${won(p.money)} → ${won(p.money - t.price)}</p>
          <p>이 도시를 살까요?</p>`);
        return this.popButtons(pop, [['아니오', false], ['예, 삽니다', true, 'primary']]);
      }
      if (kind === 'build') {
        const t = TILES[info.tile];
        const pop = this.openPop(`${this.cityHead(info.tile)}
          <div class="big-ico">${BLD[info.level]}</div>
          <p><b>${LV[info.level]}</b>${J(LV[info.level], '을').slice(-1)} ${won(info.cost)}에 지을까요?</p>
          <p>통행료 ${won(g.rentOf(info.tile))} → <b>${won(t.rent[info.level])}</b></p>
          <p class="money-line">${esc(p.name)}의 돈 ${won(p.money)} → ${won(p.money - info.cost)}</p>`);
        return this.popButtons(pop, [['아니오', false], ['예, 짓습니다', true, 'primary']]);
      }
      if (kind === 'escape') {
        const pop = this.openPop(`<div class="big-ico">🎫</div><h3>무인도 탈출권</h3>
          <p>탈출권을 써서 바로 나갈까요?<br><small>아니오를 누르면 주사위를 굴려 같은 숫자를 노립니다.</small></p>`);
        return this.popButtons(pop, [['아니오', false], ['예, 씁니다', true, 'primary']]);
      }
      if (kind === 'sell') {
        return new Promise(res => {
          const pop = this.openPop(`<div class="big-ico">😰</div><h3>돈이 모자랍니다</h3>
            <p>내야 할 돈 <b>${won(info.need)}</b> · 가진 돈 <b>${won(p.money)}</b></p>
            <p>팔 도시를 고르세요. (지은 값까지 합쳐 반값)</p><div class="sell-list"></div>`);
          const list = pop.querySelector('.sell-list');
          info.owned.forEach(i => {
            const b = document.createElement('button');
            const lv = g.s.tiles[i].level;
            b.style.setProperty('--gc', GROUPS[TILES[i].group].color);
            b.innerHTML = `<span>${esc(TILES[i].name)} ${BLD[lv]}</span><b>+${won(g.sellValue(i))}</b>`;
            b.onclick = () => { this.closePop(); res(i); };
            list.appendChild(b);
          });
        });
      }
      if (kind === 'space') return this.chooseSpace(p);
      return Promise.resolve(false);
    },

    async chooseSpace(p) {
      const board = $('#board');
      for (;;) {
        board.classList.add('selecting');
        this.showBanner(`🚀 갈 칸을 누르세요 (요금 ${won(RULES.spaceFee)})`, null, 0, true);
        const i = await new Promise(res => { this.selectResolve = res; });
        this.selectResolve = null;
        board.classList.remove('selecting');
        $('#banner').hidden = true;
        this.tileEls[i].classList.add('hl');
        const t = TILES[i];
        let extra = '';
        if (t.type === 'city') {
          const st = this.game.s.tiles[i];
          if (st.owner === null) extra = `주인 없는 도시 (${won(t.price)})`;
          else if (st.owner === p.id) extra = '내 도시';
          else extra = `${esc(this.game.players[st.owner].name)}의 도시 · 통행료 ${won(this.game.rentOf(i))}`;
        }
        const pop = this.openPop(`<div class="big-ico">🚀</div><h3>${esc(t.name)}</h3>
          ${extra ? `<p>${extra}</p>` : ''}<p>이 칸으로 갈까요?</p>`);
        const ok = await this.popButtons(pop, [['다시 고르기', false], ['예, 갑니다', true, 'primary']]);
        this.tileEls[i].classList.remove('hl');
        if (ok) return i;
      }
    },

    onTileClick(i) {
      if (this.selectResolve) {
        if (i !== 30) this.selectResolve(i);
        return;
      }
      this.showTileInfo(i);
    },

    async notify(p, kind, info) {
      let html, cls = '';
      if (kind === 'rent') {
        const o = this.game.players[info.owner];
        const lv = this.game.s.tiles[info.tile].level;
        html = `${this.cityHead(info.tile)}<div class="big-ico">💸${BLD[lv]}</div>
          <p><b style="color:${p.color}">${esc(p.name)}</b> → <b style="color:${o.color}">${esc(o.name)}</b></p>
          <p>통행료 <b>${won(info.amount)}</b>을 냅니다.</p>`;
      } else if (kind === 'card') {
        cls = 'card';
        html = `<div class="big-ico">🔑</div><div>황금열쇠</div><h3>${esc(info.card.title)}</h3><p>${esc(info.card.text)}</p>`;
      } else if (kind === 'bankrupt') {
        html = `<div class="big-ico">💥</div><h3>${esc(p.name)} 파산!</h3><p>가진 도시는 모두 주인 없는 땅이 됩니다.</p>`;
      }
      const pop = this.openPop(html, cls);
      if (p.isAI) {
        if (this.speed < 0.05) { this.closePop(); return; }
        await this.wait(this.ms(1300));
        this.closePop();
        return;
      }
      await this.popButtons(pop, [['확인', true, 'primary']]);
    },

    /* ---------- 도시 정보 (공용 대화창) ---------- */
    showTileInfo(i) {
      const t = TILES[i];
      const g = this.game;
      let html;
      if (t.type === 'city') {
        const st = g.s.tiles[i];
        const owner = st.owner !== null ? g.players[st.owner] : null;
        html = `<div class="band-lg" style="background:${GROUPS[t.group].color}"></div>
          <h3>${esc(t.name)} <small class="muted">${GROUPS[t.group].name}</small></h3>
          <table>
            <tr><td>땅값</td><td>${won(t.price)}</td></tr>
            <tr><td>주인</td><td>${owner ? `<span style="color:${owner.color}">● ${esc(owner.name)}</span>` : '없음'}</td></tr>
            <tr><td>건물</td><td>${owner ? (st.level ? BLD[st.level] + ' ' + LV[st.level] : '땅만') : '-'}</td></tr>
            ${owner ? `<tr><td>지금 통행료</td><td>${won(g.rentOf(i))}</td></tr>` : ''}
          </table>
          <h4 style="margin:12px 0 2px">통행료</h4>${this.rentRows(i, owner ? st.level : -1)}
          <h4 style="margin:12px 0 2px">짓는 값</h4>
          <table>${[1, 2, 3].map(l => `<tr><td>${BLD[l]} ${LV[l]}</td><td>${won(t.build[l - 1])}</td></tr>`).join('')}</table>`;
      } else {
        const desc = {
          start: `지나가거나 도착하면 월급 ${J(won(RULES.salary), '을')} 받습니다.`,
          island: `도착하면 ${RULES.islandTurns}턴 동안 쉽니다. 같은 숫자가 나오거나 탈출권을 쓰면 바로 나옵니다.`,
          fundGet: `쌓인 사회복지기금을 모두 받습니다. 지금 ${won(g.s.fund)}.`,
          fundPay: `사회복지기금 ${J(won(RULES.fundPay), '을')} 냅니다. 이 돈은 받는 칸에 쌓입니다.`,
          space: `다음 턴에 요금 ${J(won(RULES.spaceFee), '을')} 내고 원하는 칸으로 바로 갑니다.`,
          key: '황금열쇠 카드를 한 장 뽑습니다.',
        }[t.type];
        html = `<h3>${ICON[t.type]} ${esc(t.name)}</h3><p>${desc}</p>`;
      }
      window.WM_Dialog.show(html, [['닫기', true, 'primary']]);
    },
  };

  window.addEventListener('resize', () => UI.placeTokens(false));
  window.WM_UI = UI;
})();
