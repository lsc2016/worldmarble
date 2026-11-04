# World Marble — 에이전트 안내

## 이 프로젝트는
- 브라우저에서 바로 하는 세계 도시 보드게임 (부루마블 비슷한 것). 한 기기에서 2~4명, 사람 또는 컴퓨터.
- 설치·서버 없이 `index.html` 을 열면 된다. 빌드 없음, 순수 HTML/CSS/JS.
- 저장은 브라우저 localStorage(브라우저 안 저장 공간)에만 한다.

## 폴더 지도
| 이름 | 한 줄 |
|---|---|
| `index.html` | 화면 4개 (첫 화면 / 새 게임 설정 / 게임 / 결과) + 공용 대화창 |
| `css/style.css` | 디자인, 맥북·휴대폰 배치 |
| `js/data.js` | 판·도시·통행료·황금열쇠·규칙 숫자 (밸런스는 여기만) |
| `js/game.js` | 게임 규칙 (`WM_Game`) |
| `js/ai.js` | 컴퓨터 플레이어 판단 (`WM_AI`) |
| `js/ui.js` | 판 그리기, 애니메이션, 결정 창 (`WM_UI`) |
| `js/main.js` | 화면 전환, 설정, 메뉴, 자동 저장 |
| `tests/` | `rules.js`(Node 만), `sim.js`·`ui.js`(Playwright 필요) |
| `shots/` | ⛔ ui 시험이 만드는 스크린샷 (.gitignore 됨) |

## 시작점
- 실행: `index.html` 을 브라우저로 열기. `index.html?test=0.3` 이면 애니메이션 빠르게.
- 읽기: `README.md` → `js/main.js`(화면 흐름) → `js/game.js`(규칙).
- 스크립트 순서가 중요하다: data → game → ai → ui → main (각 파일이 `window.WM_*` 로 다음 파일에 넘김).
- 시험: `node tests/rules.js`. `sim.js`·`ui.js` 는 `playwright` 가 깔려 있어야 함 (package.json 없음).

## 고치는 규칙
- 있는 것을 지우고 새로 만들지 말고, 더하고 보완하기.
- 사람이 승인하기 전에 데이터 파일·설정 파일을 지우거나 덮어쓰지 않기.
- 삭제 명령(rm -rf 등)은 쓰지 않기.
- 어느 화면에서든 첫 화면으로 돌아갈 길(로고 누르면 첫 화면)을 없애지 않기. 지금은 `#logo` → `goHome()` (js/main.js), 메뉴의 "🏠 첫 화면으로", 결과 화면의 "첫 화면".
- 저장 키(`worldmarble.save.v1`, `worldmarble.prefs.v1`)의 모양을 바꾸면 예전 저장이 깨진다 — 바꿀 땐 키 이름의 v 숫자를 올리기.

## 읽는 양 줄이기
| 이런 일이면 | 이 파일만 읽어라 |
|---|---|
| 돈·통행료·카드·도시 바꾸기 | `js/data.js` |
| 규칙(이동, 통행료, 파산, 승패) | `js/game.js` (+ `tests/rules.js`) |
| 컴퓨터가 너무 세다/약하다 | `js/ai.js` |
| 판 모양, 말 움직임, 결정 창 | `js/ui.js`, `css/style.css` |
| 화면 이동, 저장/이어하기, 메뉴, 규칙 글 | `js/main.js`, `index.html` |

열지 말 것: `shots/` (그림), `node_modules/` (있다면).

## 용어
| 우리말 | 코드 |
|---|---|
| 별장 / 빌딩 / 호텔 | `level` 1 / 2 / 3, `build[]` |
| 통행료 | `rent[]` |
| 색 묶음 | `group`, `GROUPS` |
| 황금열쇠 | `CARDS` |
| 기금 | `fund`, 칸 `fundGet`·`fundPay` |
| 우주여행 / 무인도 | `space` / `island` |

## 다른 프로젝트와의 연결
- 없음 (다른 폴더를 읽거나 쓰지 않는다).

## 저장소 밖
- `playwright` (Node 꾸러미) — `tests/sim.js`, `tests/ui.js` 만.

## 모르는 것
- 어디에 올려 두고 쓰는지(GitHub Pages 등) — 확인 필요.
- 기본 브랜치가 `claude/affectionate-tesla-heby28` 인 까닭, main 으로 합칠 계획 — 확인 필요.
