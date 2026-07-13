---
phase: 260713-iii-moa-placesheet
plan: 01
subsystem: web
status: complete
tags: [web, gestures, bottom-sheet, map]

requires:
  - PlaceSheet — /moa/[id] 지도탭 상시 드래그 시트 (D-09)
  - moa-island — controlled anchor 배선 (anchor / onAnchorChange)
provides:
  - PlaceSheet 제스처 소유권 계약 — 표면별 배타 (본문=스크롤, 핸들·헤더=드래그)
  - apps/web/__tests__/place-sheet.test.tsx — 계약 회귀 가드 (신규, 첫 테스트)
affects:
  - /moa/[id] 지도 탭 — 지도 팬 · 시트 드래그 · 리스트 스크롤 3제스처 분리

tech-stack:
  added: []
  patterns:
    - "제스처 소유권은 표면별로 배타적 — 한 DOM 노드가 스크롤+드래그를 겸하지 않는다"
    - "overscroll-contain으로 스크롤 체이닝 차단 (fixed 레이어가 document 탄성에 끌려가는 것 방지)"

key-files:
  created:
    - apps/web/__tests__/place-sheet.test.tsx
  modified:
    - apps/web/app/moa/[id]/_components/place-sheet.tsx

decisions:
  - "D-A: 방향 판정(direction detection) 미도입 — 사용자가 단순·결정적 쪽을 명시 선택. expanded + 리스트 최상단에서 아래로 스와이프해도 시트는 안 접힌다 (핸들로만)"
  - "D-B: scrollTop 가드(bodyDragAllowed)를 조건 완화가 아니라 통째로 제거 — 가드 자체가 '본문이 드래그 주인이기도 하다'는 전제의 산물"
  - "D-C: overscroll-contain은 시트 본문에만 (globals.css 전역 규칙 X) — 공유 파일 무변경"
  - "D-D: PointerEvent·setPointerCapture 스텁은 테스트 파일 로컬 — setup.ts는 무변경(다른 24개 스위트에 영향 X)"

metrics:
  duration: ~8min
  tasks: 2
  commits: 3
  files_changed: 2
  tests_added: 4
  completed: 2026-07-13
---

# Quick 260713-iii: PlaceSheet 제스처 소유권 분리 Summary

`/moa/[id]` 지도 탭에서 "어떨 땐 지도만, 어떨 땐 시트만, 어떨 땐 둘 다 움직이던" 제스처 충돌을 **표면별 배타적 소유권**으로 고정 — 본문 = 스크롤 전용, 핸들·헤더 = 드래그 전용.

## 무엇이 문제였나

시트 **본문**이 제스처 주인이 둘이었다. 같은 div가 `onPointerDown/Move/Up/Cancel`로 시트를 드래그하면서 동시에 `overflow-y-auto` 스크롤 컨테이너였다. 기존 `bodyDragAllowed()`(scrollTop>0이면 드래그 안 함)는 이 겹침을 **완화**하려는 가드였지, 없애는 게 아니었다 — 리스트 최상단(scrollTop=0)에서는 여전히 둘 다 살아 있었다.

두 번째 축: 프로젝트 전체에 `overscroll-behavior`가 없었다. 본문에 스크롤할 내용이 없을 때(장소 0개 = 빈 상태) 스크롤이 document까지 **체이닝**되고 페이지 전체가 탄성으로 밀린다. 이때 `fixed`로 깔린 지도와 시트가 한 덩어리로 같이 움직인다 — 사용자가 본 "둘 다 움직인다"의 정체.

## 무엇을 바꿨나

`place-sheet.tsx` 단일 파일:

1. 본문 div에서 포인터 핸들러 **4개 전부 제거** → 순수 스크롤 컨테이너
2. 본문에 `overscroll-contain` 추가 (`touch-pan-y` · `overflow-y-auto` 유지)
3. 내 변경이 만든 고아만 정리 — `bodyDragAllowed`, `bodyRef`, `startDrag`의 `allowed` 파라미터
4. 핸들·헤더는 **무변경** (`touch-none` + 드래그 핸들러가 이미 정상)
5. JSDoc에 새 계약 3줄 반영

`moa-map.tsx`(`gestureHandling: 'greedy'`), `globals.css`, `moa-island.tsx`는 손대지 않았다 — controlled anchor 계약이 그대로라 island는 배선 변경 0.

## 핵심 설계 선택

**방향 판정을 도입하지 않았다(D-A).** 통상적 해법(expanded + scrollTop=0 + 아래 방향이면 시트 접기)은 방향 판정 + 임계값 + 스크롤/드래그 전환 상태를 끌고 들어온다. 사용자가 명시적으로 단순·결정적 쪽을 골랐다 — 접기/펴기는 **핸들·헤더로만**. 대가는 "펼친 상태에서 리스트 맨 위를 아래로 당겨 접기"가 안 된다는 것 (핸들이 항상 화면에 있으므로 도달 가능).

**가드를 고치지 않고 없앴다(D-B).** `bodyDragAllowed`의 조건을 조이는 선택지도 있었지만, 그 함수의 존재 자체가 "본문도 드래그 주인"이라는 전제에서 나온다. 전제를 지우면 함수도 같이 사라진다.

## 검증

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` | **PASS — 25 파일 / 180 테스트** (176 → 180, 신규 4) |
| `pnpm --filter @moajoa/web typecheck` | **PASS** (`tsc --noEmit`, 출력 0줄) |
| 스코프: `git diff --name-only HEAD~2 HEAD` | **정확히 2개 파일** — place-sheet.tsx · place-sheet.test.tsx |
| `moa-map.tsx` · `globals.css` · `moa-island.tsx` | **diff 부재** ✅ |
| 회귀: 기존 24개 스위트 무수정 | **PASS** — 176/176 |

TDD 게이트: RED `49403ff` → GREEN `f006549`.

**RED 실측** (`49403ff` 시점, 4개 중 3개 실패 — 계획대로):
- Test 1 (본문 드래그 → 앵커 불변) ❌ `expected "spy" to not be called at all, but actually been called 1 times`
- Test 1b (collapsed 본문 드래그) ❌ 동일
- Test 3 (`overscroll-contain`) ❌ `expected 'flex-1 touch-pan-y overflow-y-auto px…' to contain 'overscroll-contain'`
- Test 2 (핸들 드래그 → 앵커 변경) ✅ 처음부터 통과 = **회귀 가드** (이 수정이 드래그를 죽이지 않았음을 증명)

jsdom 25는 `PointerEvent`·`setPointerCapture` 미구현 → 테스트 파일 **로컬** 스텁 (setup.ts 무변경). 높이가 0이라 `collapsedOffset`도 0이므로 Test 2는 "호출됐다"만 단언하고 최종 앵커 값은 단언하지 않는다.

## Deviations from Plan

없음 — 플랜대로 실행. 4개 파일 수정 지시(본문 핸들러 제거 / overscroll-contain / 고아 정리 / JSDoc)를 그대로 적용했고, 예상치 못한 버그·차단 이슈·아키텍처 결정은 발생하지 않았다.

계획 대비 추가 1건: 플랜의 Test 1(expanded 본문 드래그) 외에 **Test 1b (collapsed 본문 드래그)**를 넣었다. 기존 `bodyDragAllowed`가 `anchor === 'collapsed'`를 무조건 허용했으므로, collapsed 경로가 계약의 별개 구멍이었다 — 같은 단언을 앵커 양쪽에 건다.

## Self-Check: PASSED

- 파일 2/2 존재 확인
- 커밋 2/2 존재 확인 (`49403ff` · `f006549`)
- TDD 게이트 순서 확인: `test(` → `fix(`

## 사람 확인 필요 (human-check, `pnpm web:dev`)

드래그 체감·snap·탄성 스크롤은 jsdom 검증 불가 → 브라우저 UAT 몫 (place-sheet.tsx 주석에 명시된 프로젝트 관행). `/moa/<id>` 지도 탭, **장소 0개 보드**에서:

1. 지도 영역 드래그 → **지도만** 팬. 시트 고정.
2. 시트 핸들·헤더 드래그 → **시트만** 위아래. 지도 고정, 페이지 안 밀림.
3. 시트 본문(빈 상태 문구 영역) 드래그·트랙패드 스크롤 → **아무것도 안 움직인다** (← 이번 수정의 핵심. 이전엔 페이지 전체가 밀렸다)
4. 장소 여러 개인 보드에서 시트 펴고 리스트 스크롤 → **리스트만** 스크롤, 지도·시트 고정
5. (D-A 확인) expanded + 리스트 최상단에서 아래로 스와이프 → 시트 **안 접힘**. 의도된 동작 — 접으려면 핸들.

---

## 후속 (같은 세션, UAT 결과 반영)

위 수정을 배포한 뒤에도 사용자가 "핸들을 끌면 뒤의 지도가 같이 움직인다"고 보고. **핸들 드래그는 이번 수정 범위 밖**이라 원인이 따로 있었다.

### 재현으로 좁힌 과정

임시 dev 라우트(`/dev-gesture-repro`, 검증 후 삭제)에 실제 `MoaIsland`를 마운트하고 playwright-core + 실제 크롬으로 구동. 지도 상단 스트립의 **픽셀 해시**를 센서로 쓰고, 지도 직접 드래그를 대조군으로 두어 센서를 보정했다.

- 마우스 드래그(상/하/좌/우) · 터치 · wheel · 모바일폭/데스크톱폭 — **전부 지도 고정.** 코드는 정상.
- 처음 쓴 센서(`.gm-style` 하위 transform 비교)는 **틀린 센서**였다. 구글 지도는 팬 후 타일을 재배치하며 transform을 새 기준으로 리셋해서, 팬이 일어나도 같은 값으로 읽힐 수 있다. 픽셀 비교로 교체.

### 진짜 원인: 페이지 핀치줌 (visual viewport)

루트 layout의 `maximumScale: 5`(D-13) 때문에 페이지를 핀치줌할 수 있다. 줌이 1을 넘는 순간 **visual viewport가 패닝 가능**해지고, 그때부터는 어디를 끌든 `fixed` 레이어(지도 + 시트)가 통째로 따라 움직인다. CDP `Emulation.setPageScaleFactor: 2` 로 재현 확인 — 지도 영역·시트 영역 픽셀 해시가 **동시에** 바뀌고 `visualViewport.offsetLeft/Top`이 이동.

**합성기(compositor) 레벨이라 `touch-action`·`overscroll-behavior`·JS로 막을 수 없다.** 사용자 스크린샷에서 하단 탭바와 FAB이 사라져 있던 것이 정황 증거였다(줌으로 화면 밖 이탈).

### 결정: D-13 부분 재정의 (사용자 승인)

지도 서피스(`/moa/[id]`, `/t/[slug]`)에서만 route-level `viewport`로 페이지 줌을 끈다 (`maximumScale: 1`, `userScalable: false`). 지도 앱에서 핀치는 "지도 확대" 의도지 "페이지 확대"가 아니므로, 페이지 줌이 지도 줌을 가로채는 것 자체가 오작동.

- 루트 layout의 `maximumScale: 5`는 **그대로 유지** — 로그인·둘러보기·내정보 등 텍스트 화면은 WCAG 1.4.4 준수.
- 대가: 지도 서피스 두 곳에서는 장소 목록 텍스트를 확대할 수 없다. 사용자가 트레이드오프 인지하고 선택.

검증: `curl` 로 렌더된 meta 확인 — 덮어쓴 라우트 `maximum-scale=1, user-scalable=no` / `/login` `maximum-scale=5`.
