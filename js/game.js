/*
 * World Marble — 게임 규칙 엔진
 * 화면과 분리되어 있고, 결정이 필요할 때 io(화면) 또는 ai(컴퓨터)에게 묻습니다.
 */
(function () {
  'use strict';
  const { RULES, GROUPS, TILES, CARDS, J } = window.WM_DATA;

  class Abort extends Error {}

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const LEVEL_NAMES = ['땅', '별장', '빌딩', '호텔'];

  class Game {
    /* setup: { players:[{name,color,isAI}], startMoney, maxTurns } */
    static newState(setup) {
      return {
        version: 1,
        startMoney: setup.startMoney,
        maxTurns: setup.maxTurns,
        players: setup.players.map((p, i) => ({
          id: i, name: p.name, color: p.color, isAI: !!p.isAI,
          money: setup.startMoney, pos: 0, island: 0, escape: 0,
          space: false, bankrupt: false,
        })),
        tiles: TILES.map(t => (t.type === 'city' ? { owner: null, level: 0 } : null)),
        fund: 0,
        round: 1,
        current: 0,
        deck: shuffle(CARDS.map((_, i) => i)),
        deckPos: 0,
        log: [],
        over: false,
      };
    }

    constructor(state, io, ai) {
      this.s = state;
      this.io = io;
      this.ai = ai;
      this.aborted = false;
    }

    /* ---------- 조회용 도우미 ---------- */
    get players() { return this.s.players; }
    get alive() { return this.s.players.filter(p => !p.bankrupt); }
    cur() { return this.s.players[this.s.current]; }

    ownedBy(p) {
      const out = [];
      this.s.tiles.forEach((t, i) => { if (t && t.owner === p.id) out.push(i); });
      return out;
    }
    ownsGroup(pid, group) {
      return TILES.every((t, i) => t.group !== group || this.s.tiles[i].owner === pid);
    }
    rentOf(i) {
      const t = TILES[i], st = this.s.tiles[i];
      if (!st || st.owner === null) return 0;
      let r = t.rent[st.level];
      if (st.level === 0 && this.ownsGroup(st.owner, t.group)) r *= RULES.groupBonus;
      return r;
    }
    investedIn(i) {
      const t = TILES[i], st = this.s.tiles[i];
      let v = t.price;
      for (let l = 0; l < st.level; l++) v += t.build[l];
      return v;
    }
    sellValue(i) { return Math.floor(this.investedIn(i) * RULES.sellRate); }
    propertyValue(p) { return this.ownedBy(p).reduce((a, i) => a + this.investedIn(i), 0); }
    totalAssets(p) { return p.bankrupt ? 0 : p.money + this.propertyValue(p); }
    liquidity(p) { return p.money + this.ownedBy(p).reduce((a, i) => a + this.sellValue(i), 0); }

    ranking() {
      return [...this.s.players].sort((a, b) => {
        if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
        if (a.bankrupt) return (b.outOrder || 0) - (a.outOrder || 0);
        return this.totalAssets(b) - this.totalAssets(a);
      }).map(p => ({
        player: p, money: p.bankrupt ? 0 : p.money,
        property: p.bankrupt ? 0 : this.propertyValue(p), total: this.totalAssets(p),
        cities: this.ownedBy(p).length,
      }));
    }

    /* ---------- 흐름 제어 ---------- */
    async w(promise) {
      const v = await promise;
      if (this.aborted) throw new Abort();
      return v;
    }
    pause(ms) { return this.w(this.io.wait(ms)); }
    log(msg) {
      this.s.log.push(msg);
      if (this.s.log.length > 30) this.s.log.shift();
      this.io.log(msg);
    }
    abort() { this.aborted = true; }

    /* 결정: 사람이면 화면에 묻고, 컴퓨터면 ai가 정한 뒤 잠깐 보여줍니다. */
    async decide(p, kind, info) {
      if (p.isAI) {
        const ans = this.ai.decide(this, p, kind, info);
        await this.w(this.io.aiThinking(p, kind, info, ans));
        return ans;
      }
      return this.w(this.io.ask(p, kind, info));
    }

    async run() {
      try {
        while (!this.s.over) {
          const p = this.cur();
          if (!p.bankrupt) {
            this.io.save(this.s);
            await this.playTurn(p);
            this.io.update();
            if (this.checkOver()) break;
          }
          this.nextPlayer();
          if (this.checkOver()) break;
        }
        this.s.over = true;
        this.io.save(null);
        this.io.gameOver(this.ranking());
      } catch (e) {
        if (!(e instanceof Abort)) throw e;
      }
    }

    nextPlayer() {
      const n = this.s.players.length;
      let i = this.s.current;
      do {
        i = (i + 1) % n;
        if (i === 0) this.s.round++;
      } while (this.s.players[i].bankrupt && this.alive.length > 0);
      this.s.current = i;
    }

    checkOver() {
      if (this.alive.length <= 1) { this.s.over = true; return true; }
      if (this.s.maxTurns > 0 && this.s.round > this.s.maxTurns) {
        this.s.round = this.s.maxTurns;
        this.s.over = true;
        return true;
      }
      return false;
    }

    rollDice() {
      return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    }

    /* 주사위: 사람은 버튼을 눌러야 굴러갑니다. */
    async roll(p) {
      if (p.isAI) await this.pause(this.io.aiDelay());
      else await this.w(this.io.waitRoll(p));
      const d = this.rollDice();
      await this.w(this.io.showDice(d));
      return d;
    }

    async playTurn(p) {
      this.io.update();
      await this.w(this.io.turnStart(p));

      // 우주여행: 원하는 칸으로 바로 이동
      if (p.space) {
        p.space = false;
        if (p.money >= RULES.spaceFee) {
          const target = await this.decide(p, 'space', {});
          p.money -= RULES.spaceFee;
          this.log(`🚀 ${p.name}: 우주여행 요금 ${RULES.spaceFee}만 원을 내고 ${J(TILES[target].name, '으로')} 날아갑니다.`);
          this.io.update();
          await this.moveTo(p, target, true);
          await this.land(p);
          return;
        }
        this.log(`🚀 ${p.name}: 요금이 모자라 우주여행을 못 갑니다. 주사위를 굴립니다.`);
      }

      // 무인도
      if (p.island > 0) {
        if (p.escape > 0 && await this.decide(p, 'escape', {})) {
          p.escape--;
          p.island = 0;
          this.log(`🎫 ${p.name}: 무인도 탈출권을 써서 빠져나옵니다.`);
          this.io.update();
        } else {
          const d = await this.roll(p);
          if (d[0] === d[1]) {
            p.island = 0;
            this.log(`🏝️ ${p.name}: 같은 숫자! 무인도를 탈출합니다.`);
            await this.moveSteps(p, d[0] + d[1]);
            await this.land(p);
          } else {
            p.island--;
            this.log(p.island > 0
              ? `🏝️ ${p.name}: 무인도에서 쉽니다. (${p.island}턴 남음)`
              : `🏝️ ${p.name}: 무인도에서 마지막으로 쉽니다. 다음 턴에 나갑니다.`);
          }
          this.io.update();
          return;
        }
      }

      let doubles = 0;
      for (;;) {
        const d = await this.roll(p);
        const dbl = d[0] === d[1];
        if (dbl) {
          doubles++;
          if (doubles === 3) {
            this.log(`🎲 ${p.name}: 같은 숫자가 세 번 연속! 무인도로 갑니다.`);
            await this.goIsland(p);
            return;
          }
        }
        await this.moveSteps(p, d[0] + d[1]);
        await this.land(p);
        this.io.update();
        if (!dbl || p.bankrupt || p.island > 0 || p.space || this.alive.length <= 1) return;
        this.log(`🎲 ${p.name}: 같은 숫자! 한 번 더 굴립니다.`);
      }
    }

    /* ---------- 이동 ---------- */
    async moveSteps(p, n) {
      const path = [];
      const dir = n >= 0 ? 1 : -1;
      let pos = p.pos;
      for (let k = 0; k < Math.abs(n); k++) {
        pos = (pos + dir + 40) % 40;
        path.push(pos);
        if (dir > 0 && pos === 0) this.paySalary(p);
      }
      await this.w(this.io.moveToken(p, path));
      p.pos = pos;
      this.io.update();
    }
    async moveTo(p, target, forward) {
      const n = forward ? (target - p.pos + 40) % 40 : target - p.pos;
      if (n !== 0) await this.moveSteps(p, n);
    }
    paySalary(p) {
      p.money += RULES.salary;
      this.log(`💰 ${p.name}: 출발 칸을 지나 월급 ${RULES.salary}만 원을 받습니다.`);
      this.io.update();
    }
    async goIsland(p) {
      await this.w(this.io.jumpToken(p, 10));
      p.pos = 10;
      p.island = RULES.islandTurns;
      this.io.update();
    }

    /* ---------- 칸에 도착 ---------- */
    async land(p) {
      const i = p.pos, t = TILES[i];
      switch (t.type) {
        case 'start': break;
        case 'island':
          p.island = RULES.islandTurns;
          this.log(`🏝️ ${p.name}: 무인도에 도착! ${RULES.islandTurns}턴 동안 쉽니다.`);
          break;
        case 'space':
          p.space = true;
          this.log(`🚀 ${p.name}: 우주여행 칸! 다음 턴에 원하는 칸으로 갈 수 있습니다.`);
          break;
        case 'fundGet':
          if (this.s.fund > 0) {
            this.log(`🎁 ${p.name}: 사회복지기금 ${this.s.fund}만 원을 모두 받습니다!`);
            p.money += this.s.fund;
            this.s.fund = 0;
          } else {
            this.log(`🎁 ${p.name}: 사회복지기금이 비어 있습니다.`);
          }
          break;
        case 'fundPay':
          this.log(`🏛️ ${p.name}: 사회복지기금 ${RULES.fundPay}만 원을 냅니다.`);
          await this.pay(p, RULES.fundPay, 'fund');
          break;
        case 'key':
          await this.drawCard(p);
          break;
        case 'city':
          await this.landCity(p, i);
          break;
      }
      this.io.update();
    }

    async landCity(p, i) {
      const t = TILES[i], st = this.s.tiles[i];
      if (st.owner === null) {
        if (p.money < t.price) {
          this.log(`🏙️ ${p.name}: ${J(t.name, '을')} 살 돈이 모자랍니다.`);
          return;
        }
        if (await this.decide(p, 'buy', { tile: i, cost: t.price })) {
          p.money -= t.price;
          st.owner = p.id;
          st.level = 0;
          this.log(`🏙️ ${p.name}: ${J(t.name, '을')} ${t.price}만 원에 샀습니다.`);
        } else {
          this.log(`🏙️ ${p.name}: ${J(t.name, '을')} 사지 않았습니다.`);
        }
      } else if (st.owner === p.id) {
        if (st.level >= 3) return;
        const cost = t.build[st.level];
        if (p.money < cost) {
          this.log(`🏗️ ${p.name}: ${J(LEVEL_NAMES[st.level + 1], '을')} 지을 돈이 모자랍니다.`);
          return;
        }
        if (await this.decide(p, 'build', { tile: i, cost, level: st.level + 1 })) {
          p.money -= cost;
          st.level++;
          this.log(`🏗️ ${p.name}: ${t.name}에 ${J(LEVEL_NAMES[st.level], '을')} 지었습니다. (${cost}만 원)`);
        }
      } else {
        const owner = this.s.players[st.owner];
        const rent = this.rentOf(i);
        await this.w(this.io.notify(p, 'rent', { tile: i, owner: owner.id, amount: rent }));
        this.log(`💸 ${p.name}: ${owner.name}에게 ${t.name} 통행료 ${rent}만 원을 냅니다.`);
        await this.pay(p, rent, owner);
      }
    }

    /* ---------- 돈 내기 / 팔기 / 파산 ---------- */
    // to: 플레이어 객체, 'fund', 또는 null(은행)
    async pay(p, amount, to) {
      if (amount <= 0) return true;
      if (p.money < amount) await this.raise(p, amount);
      if (p.money < amount) {
        const left = p.money;
        p.money = 0;
        this.credit(to, left);
        this.bankrupt(p);
        return false;
      }
      p.money -= amount;
      this.credit(to, amount);
      this.io.update();
      return true;
    }
    credit(to, amount) {
      if (to === 'fund') this.s.fund += amount;
      else if (to && typeof to === 'object') to.money += amount;
    }

    async raise(p, need) {
      if (this.liquidity(p) < need) {
        // 전부 팔아도 모자라면 바로 파산 처리
        if (this.ownedBy(p).length) this.log(`😵 ${p.name}: 도시를 모두 팔아도 ${need}만 원을 낼 수 없습니다.`);
        return;
      }
      while (p.money < need) {
        const owned = this.ownedBy(p);
        if (!owned.length) return;
        const i = await this.decide(p, 'sell', { need, owned });
        const v = this.sellValue(i);
        this.s.tiles[i].owner = null;
        this.s.tiles[i].level = 0;
        p.money += v;
        this.log(`🔻 ${p.name}: ${J(TILES[i].name, '을')} ${v}만 원에 팔았습니다.`);
        this.io.update();
      }
    }

    bankrupt(p) {
      p.bankrupt = true;
      p.outOrder = this.s.players.filter(x => x.bankrupt).length;
      p.island = 0; p.space = false; p.escape = 0;
      this.s.tiles.forEach(t => { if (t && t.owner === p.id) { t.owner = null; t.level = 0; } });
      this.log(`💥 ${p.name}: 파산했습니다!`);
      this.io.update();
      return this.w(this.io.notify(p, 'bankrupt', {}));
    }

    /* ---------- 황금열쇠 ---------- */
    async drawCard(p) {
      if (this.s.deckPos >= this.s.deck.length) {
        this.s.deck = shuffle(CARDS.map((_, i) => i));
        this.s.deckPos = 0;
      }
      const c = CARDS[this.s.deck[this.s.deckPos++]];
      this.log(`🔑 ${p.name}: 황금열쇠 「${c.title}」`);
      await this.w(this.io.notify(p, 'card', { card: c }));

      if (c.money > 0) p.money += c.money;
      else if (c.money < 0) await this.pay(p, -c.money, c.toFund ? 'fund' : null);
      else if (c.fromEach) {
        for (const o of this.alive) {
          if (o === p) continue;
          await this.pay(o, c.fromEach, p);
        }
      } else if (c.toEach) {
        for (const o of this.alive) {
          if (o === p || p.bankrupt) continue;
          await this.pay(p, c.toEach, o);
        }
      } else if (c.repair) {
        let cost = 0;
        for (const i of this.ownedBy(p)) {
          const lv = this.s.tiles[i].level;
          for (let l = 1; l <= lv; l++) cost += c.repair[l - 1];
        }
        if (cost > 0) {
          this.log(`🔧 ${p.name}: 수리비 ${cost}만 원을 냅니다.`);
          await this.pay(p, cost, null);
        } else this.log(`🔧 ${p.name}: 건물이 없어 낼 돈이 없습니다.`);
      } else if (c.escape) {
        p.escape++;
      } else if (c.island) {
        await this.goIsland(p);
      } else if (c.moveTo !== undefined) {
        await this.moveTo(p, c.moveTo, true);
        await this.land(p);
      } else if (c.moveBy) {
        await this.moveSteps(p, c.moveBy);
        await this.land(p);
      }
      this.io.update();
    }
  }

  window.WM_Game = Game;
  window.WM_LEVEL_NAMES = LEVEL_NAMES;
})();
