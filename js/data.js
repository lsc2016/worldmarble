/*
 * World Marble — 판·칸·카드 데이터
 * 여기 숫자만 고치면 게임 밸런스를 바꿀 수 있습니다.
 * 금액 단위: 만 원
 *
 * 도시 필드
 *   name  : 이름          short : 휴대폰처럼 좁은 화면에서 보일 짧은 이름
 *   group : 색 묶음 번호   price : 땅값
 *   build : [별장, 빌딩, 호텔] 짓는 값
 *   rent  : [땅만, 별장, 빌딩, 호텔] 통행료
 */
(function () {
  'use strict';

  const RULES = {
    startMoney: 300,      // 기본 시작 돈
    maxTurns: 30,         // 기본 끝나는 턴(바퀴) 수
    salary: 20,           // 출발 칸을 지날 때 받는 월급
    spaceFee: 20,         // 우주여행 요금
    fundPay: 15,          // 사회복지기금(내는 칸)에서 내는 돈
    islandTurns: 3,       // 무인도에서 쉬는 턴 수
    sellRate: 0.5,        // 팔 때 받는 비율 (반값)
    groupBonus: 2,        // 같은 색을 모두 가졌을 때 땅 통행료 배수
  };

  const GROUPS = [
    null,
    { name: '동아시아',   color: '#9ccc65' },
    { name: '아시아 허브', color: '#26a69a' },
    { name: '동유럽',     color: '#4fc3f7' },
    { name: '중부유럽',   color: '#5c6bc0' },
    { name: '서유럽',     color: '#ab47bc' },
    { name: '남아메리카', color: '#ffb300' },
    { name: '북아메리카', color: '#fb8c00' },
    { name: '미국 서부',  color: '#ef5350' },
    { name: '미국 동부',  color: '#8d1b3d' },
  ];

  // 칸 40개. 0번 = 출발(오른쪽 아래), 시계 반대 방향으로 번호가 늘어납니다.
  const TILES = [
    { type: 'start', name: '출발', short: '출발' },
    { type: 'city', name: '타이베이', short: '타이베이', group: 1, price: 5, build: [3, 4, 5], rent: [2, 6, 13, 25] },
    { type: 'key', name: '황금열쇠', short: '열쇠' },
    { type: 'city', name: '베이징', short: '베이징', group: 1, price: 5, build: [3, 4, 5], rent: [2, 6, 13, 25] },
    { type: 'city', name: '마닐라', short: '마닐라', group: 1, price: 6, build: [3, 5, 6], rent: [2, 7, 15, 30] },
    { type: 'city', name: '방콕', short: '방콕', group: 2, price: 8, build: [4, 6, 8], rent: [3, 10, 20, 40] },
    { type: 'city', name: '싱가포르', short: '싱가포르', group: 2, price: 8, build: [4, 6, 8], rent: [3, 10, 20, 40] },
    { type: 'key', name: '황금열쇠', short: '열쇠' },
    { type: 'city', name: '홍콩', short: '홍콩', group: 2, price: 10, build: [5, 8, 10], rent: [4, 12, 25, 50] },
    { type: 'city', name: '도쿄', short: '도쿄', group: 2, price: 10, build: [5, 8, 10], rent: [4, 12, 25, 50] },
    { type: 'island', name: '무인도', short: '무인도' },
    { type: 'city', name: '이스탄불', short: '이스탄불', group: 3, price: 12, build: [6, 9, 12], rent: [5, 14, 30, 60] },
    { type: 'city', name: '아테네', short: '아테네', group: 3, price: 12, build: [6, 9, 12], rent: [5, 14, 30, 60] },
    { type: 'city', name: '프라하', short: '프라하', group: 3, price: 14, build: [7, 11, 14], rent: [6, 17, 35, 70] },
    { type: 'city', name: '빈', short: '빈', group: 4, price: 16, build: [8, 12, 16], rent: [6, 19, 40, 80] },
    { type: 'city', name: '베를린', short: '베를린', group: 4, price: 16, build: [8, 12, 16], rent: [6, 19, 40, 80] },
    { type: 'city', name: '마드리드', short: '마드리드', group: 4, price: 18, build: [9, 14, 18], rent: [7, 22, 45, 90] },
    { type: 'key', name: '황금열쇠', short: '열쇠' },
    { type: 'city', name: '로마', short: '로마', group: 5, price: 20, build: [10, 15, 20], rent: [8, 24, 50, 100] },
    { type: 'city', name: '파리', short: '파리', group: 5, price: 20, build: [10, 15, 20], rent: [8, 24, 50, 100] },
    { type: 'fundGet', name: '사회복지기금', short: '기금받기' },
    { type: 'city', name: '런던', short: '런던', group: 5, price: 22, build: [11, 17, 22], rent: [9, 26, 55, 110] },
    { type: 'key', name: '황금열쇠', short: '열쇠' },
    { type: 'city', name: '리마', short: '리마', group: 6, price: 24, build: [12, 18, 24], rent: [10, 29, 60, 120] },
    { type: 'city', name: '부에노스아이레스', short: '부에노스', group: 6, price: 24, build: [12, 18, 24], rent: [10, 29, 60, 120] },
    { type: 'city', name: '상파울루', short: '상파울루', group: 6, price: 26, build: [13, 20, 26], rent: [10, 31, 65, 130] },
    { type: 'city', name: '멕시코시티', short: '멕시코', group: 7, price: 28, build: [14, 21, 28], rent: [11, 34, 70, 140] },
    { type: 'city', name: '토론토', short: '토론토', group: 7, price: 28, build: [14, 21, 28], rent: [11, 34, 70, 140] },
    { type: 'city', name: '밴쿠버', short: '밴쿠버', group: 7, price: 30, build: [15, 23, 30], rent: [12, 36, 75, 150] },
    { type: 'city', name: '시카고', short: '시카고', group: 7, price: 30, build: [15, 23, 30], rent: [12, 36, 75, 150] },
    { type: 'space', name: '우주여행', short: '우주여행' },
    { type: 'city', name: '시애틀', short: '시애틀', group: 8, price: 32, build: [16, 24, 32], rent: [13, 38, 80, 160] },
    { type: 'city', name: '샌프란시스코', short: '샌프란', group: 8, price: 32, build: [16, 24, 32], rent: [13, 38, 80, 160] },
    { type: 'city', name: '라스베이거스', short: '베가스', group: 8, price: 35, build: [18, 26, 35], rent: [14, 42, 88, 175] },
    { type: 'city', name: '로스앤젤레스', short: 'LA', group: 8, price: 35, build: [18, 26, 35], rent: [14, 42, 88, 175] },
    { type: 'key', name: '황금열쇠', short: '열쇠' },
    { type: 'city', name: '보스턴', short: '보스턴', group: 9, price: 38, build: [19, 29, 38], rent: [15, 46, 95, 190] },
    { type: 'city', name: '워싱턴', short: '워싱턴', group: 9, price: 40, build: [20, 30, 40], rent: [16, 48, 100, 200] },
    { type: 'fundPay', name: '사회복지기금 내기', short: '기금내기' },
    { type: 'city', name: '뉴욕', short: '뉴욕', group: 9, price: 50, build: [25, 38, 50], rent: [20, 60, 125, 250] },
  ];

  /*
   * 황금열쇠 카드
   *   money     : 받기(+) / 내기(-)          toFund : true면 낸 돈이 사회복지기금에 쌓임
   *   fromEach  : 다른 사람 모두에게서 받기    toEach : 다른 사람 모두에게 주기
   *   moveTo    : 그 칸으로 앞으로 이동(출발을 지나면 월급)
   *   moveBy    : 앞(+)/뒤(-)로 이동         island : 무인도로 바로 감
   *   escape    : 무인도 탈출권               repair : [별장, 빌딩, 호텔] 한 채당 수리비
   */
  const CARDS = [
    { title: '복권 당첨', text: '복권에 당첨되었습니다! 30만 원을 받습니다.', money: 30 },
    { title: '장학금', text: '장학금 10만 원을 받습니다.', money: 10 },
    { title: '노벨상 수상', text: '상금 25만 원을 받습니다.', money: 25 },
    { title: '주식 배당', text: '배당금 15만 원을 받습니다.', money: 15 },
    { title: '생일 축하', text: '모든 플레이어에게서 축하금 5만 원씩 받습니다.', fromEach: 5 },
    { title: '한턱 쏘기', text: '모든 플레이어에게 5만 원씩 줍니다.', toEach: 5 },
    { title: '과속 벌금', text: '벌금 8만 원을 냅니다.', money: -8 },
    { title: '병원비', text: '병원비 10만 원을 냅니다.', money: -10 },
    { title: '해외 유학', text: '학비 15만 원을 냅니다.', money: -15 },
    { title: '기부 천사', text: '사회복지기금에 10만 원을 냅니다.', money: -10, toFund: true },
    { title: '건물 수리', text: '건물 수리비를 냅니다. (별장 3만, 빌딩 6만, 호텔 10만 원씩)', repair: [3, 6, 10] },
    { title: '고향 방문', text: '출발 칸으로 이동합니다. 월급을 받습니다.', moveTo: 0 },
    { title: '뉴욕 출장', text: '뉴욕으로 이동합니다.', moveTo: 39 },
    { title: '우주여행 초대', text: '우주여행 칸으로 이동합니다.', moveTo: 30 },
    { title: '기금 행사 초대', text: '사회복지기금(받는 칸)으로 이동합니다.', moveTo: 20 },
    { title: '길을 잃었다', text: '뒤로 3칸 이동합니다.', moveBy: -3 },
    { title: '폭풍우', text: '배가 난파되어 무인도로 갑니다.', island: true },
    { title: '무인도 탈출권', text: '무인도에 갇혔을 때 바로 나올 수 있는 카드입니다. 가지고 있습니다.', escape: true },
  ];

  // 받침에 맞는 조사 붙이기: J('뉴욕', '을') → '뉴욕을', J('파리', '을') → '파리를'
  const PAIRS = { '을': ['을', '를'], '를': ['을', '를'], '이': ['이', '가'], '가': ['이', '가'],
    '은': ['은', '는'], '는': ['은', '는'], '으로': ['으로', '로'], '로': ['으로', '로'], '과': ['과', '와'], '와': ['과', '와'] };
  function J(word, p) {
    const w = String(word);
    const code = w.charCodeAt(w.length - 1) - 0xAC00;
    const pair = PAIRS[p];
    if (code < 0 || code > 11171) return w + pair[1];
    const jong = code % 28;
    if (p === '으로' || p === '로') return w + (jong === 0 || jong === 8 ? '로' : '으로');
    return w + (jong ? pair[0] : pair[1]);
  }

  window.WM_DATA = { RULES, GROUPS, TILES, CARDS, J };
})();
