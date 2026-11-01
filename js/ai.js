/*
 * World Marble — 컴퓨터 플레이어
 * 단순한 규칙으로 결정합니다.
 */
(function () {
  'use strict';
  const { TILES, RULES } = window.WM_DATA;

  const AI = {
    // 이 금액은 늘 남겨 두려고 합니다 (통행료 대비).
    reserve(g) { return Math.max(40, Math.round(g.s.startMoney * 0.15)); },

    groupCount(g, pid, group) {
      return TILES.reduce((n, t, i) => n + (t.group === group && g.s.tiles[i].owner === pid ? 1 : 0), 0);
    },

    decide(g, p, kind, info) {
      switch (kind) {
        case 'buy': return this.buy(g, p, info);
        case 'build': return p.money - info.cost >= this.reserve(g) + 10;
        case 'escape': return true;
        case 'sell': return this.sell(g, p, info);
        case 'space': return this.space(g, p);
      }
      return false;
    },

    buy(g, p, { tile, cost }) {
      const left = p.money - cost;
      const group = TILES[tile].group;
      // 같은 색을 이미 가지고 있으면 조금 더 과감하게 삽니다.
      const mine = this.groupCount(g, p.id, group);
      if (mine > 0) return left >= 15;
      return left >= this.reserve(g);
    },

    // 싼 것부터, 같은 색 모음을 깨지 않는 것부터 팝니다.
    sell(g, p, { owned }) {
      const score = i => {
        const t = TILES[i];
        const set = g.ownsGroup(p.id, t.group) ? 1000 : 0;
        return set + g.investedIn(i);
      };
      return [...owned].sort((a, b) => score(a) - score(b))[0];
    },

    space(g, p) {
      const money = p.money - RULES.spaceFee;
      let best = 0, bestScore = 1; // 기본: 출발 칸(월급)
      TILES.forEach((t, i) => {
        if (i === 30 || i === p.pos) return;
        let s = 0;
        if (t.type === 'city') {
          const st = g.s.tiles[i];
          if (st.owner === null && money - t.price >= 15) {
            s = 5 + t.price / 10 + (this.groupCount(g, p.id, t.group) > 0 ? 5 : 0);
          } else if (st.owner === p.id && st.level < 3 && money - t.build[st.level] >= 15) {
            s = 4 + t.build[st.level] / 10;
          } else if (st.owner !== null && st.owner !== p.id) {
            s = -100;
          }
        } else if (t.type === 'fundGet') {
          s = g.s.fund / 5;
        }
        if (s > bestScore) { bestScore = s; best = i; }
      });
      return best;
    },
  };

  window.WM_AI = AI;
})();
