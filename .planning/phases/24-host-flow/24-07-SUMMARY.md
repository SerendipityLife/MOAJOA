---
phase: 24-host-flow
plan: 07
subsystem: web-map-tab
tags: [web, share, clipboard, navigator-share, add-sheet, reuse, phase-gate]
requires:
  - "@moajoa/core (ShareModeType·Trip·ShareMode)"
  - "@moajoa/api (addLink·addManualPlace·triggerExtraction·shareMoa)"
  - "apps/web/components/add-content-tabs.tsx (24-04 — D-11 재사용)"
  - "apps/web/components/bottom-sheet.tsx (모달 시트 셸)"
  - "apps/web/app/moa/[id]/_components/moa-island.tsx (24-06 — 배선 대상)"
provides:
  - "AddSheet — FAB [+] 링크/검색 2탭 추가 시트 (MOA-03/04, AddContentTabs 재사용)"
  - "ShareSheet — 함께 정하기 모드 3택 + 클립보드/navigator.share (SHARE-01)"
  - "/moa/[id] 지도탭 로컬 표면 완성 — Phase 25가 소비할 /t/{slug} 공유링크 생성 경로"
affects:
  - "Phase 25(공유 열람·투표)가 ShareSheet가 발급한 /t/{slug} 링크를 소비"
tech-stack:
  added: []
  patterns:
    - "AddContentTabs 재사용(온보딩 step-seed와 동일 컴포넌트) — 탭 재구현 0 (D-11)"
    - "fire-and-forget triggerExtraction(비-manual) — 완료 반영은 realtime reconcile (D-13)"
    - "클립보드 복사 우선 + navigator.share 추가 제공, AbortError 무시 (D-18·Pitfall 5)"
    - "shareMoa 단일 UPDATE — 재호출 mode 갱신·slug 보존, D-17 dates 숨김은 클라 몫"
    - "island 테스트가 신규 자식(AddSheet/ShareSheet)을 스텁 mock — 배선만 검증(자체 테스트 분리)"
key-files:
  created:
    - "apps/web/app/moa/[id]/_components/add-sheet.tsx"
    - "apps/web/app/moa/[id]/_components/share-sheet.tsx"
    - "apps/web/__tests__/add-sheet.test.tsx"
    - "apps/web/__tests__/share-sheet.test.tsx"
  modified:
    - "apps/web/app/moa/[id]/_components/moa-island.tsx"
    - "apps/web/__tests__/moa-island.test.tsx"
decisions:
  - "add-sheet BottomSheet에 title='추가하기' 부여 — UI-SPEC은 미명시지만 BottomSheet가 title을 aria-label로 쓰므로 모달 a11y 위해 추가(비-blocking dim2 FLAG 정합)"
  - "검색 탭(addManualPlace)은 onAdded 미호출 — 장소 등장·토스트는 island의 places INSERT realtime 경로 담당(D-16 중복 토스트 금지). 링크 탭만 onAdded→reconcile(links INSERT 비구독)"
  - "ShareSheet 프리셋 = trip.share_mode ?? (start_date ? 'places' : null), open 전환 시 useEffect로 재동기화(재열림 D-19 일관성)"
  - "FAB z-[60](시트보다 위)·bottom-[136px](collapsed 시트 상단 +16px)·brand-600 56px shadow-fab — expanded에서도 접근 가능(UI-SPEC §FAB)"
  - "gate 실행 시 core/api는 test:run 아닌 test 스크립트(=vitest run, 비-watch) 사용 — 실 스크립트명 정합, 결과 동일"
metrics:
  duration: "~20분"
  completed: "2026-07-08"
  tasks: 3
  files: 6
---

# Phase 24 Plan 07: 추가·공유 시트 + Phase 게이트 Summary

지도탭의 마지막 두 진입점을 붙이고 Phase 24 전체를 자동 검증했다. FAB [+]는 온보딩과 동일한 `AddContentTabs`(D-11)를 재사용한 `AddSheet`로 링크 자동추출·장소 검색 추가를 열고, 상단 바 [함께 정하기]는 `ShareSheet`로 모드 3택(날짜 확정 시 2택) → `shareMoa` slug 발급·클립보드 복사·`navigator.share`까지 잇는다. Phase 25가 소비할 `/t/{slug}` 생성 경로가 여기서 확립됐다. 3패키지(core 169·api 88·web 110)·web build·iOS 128 전부 그린, 안티패턴 grep 6종 0, iOS diff 0.

## Tasks Completed

**Task 1 — add-sheet + island FAB (test bb66a46 → feat d9358e6, TDD):** `add-sheet.tsx`(58줄) 신규 — `<BottomSheet title="추가하기">` 안에 `AddContentTabs`(D-11 재사용, 자체 탭 재구현 0). `handleAddLink`: `addLink(client, {board_id: tripId, url})` → `link.source_kind !== 'manual'`이면 `triggerExtraction(client, link.id).catch(console.error)`(fire-and-forget, D-13 — 진행 상태는 reconcile이 반영) → `onAdded()` → `onClose()`. `handlePickPlace`: `addManualPlace(client, {board_id: tripId, google_place_id: place.id})` → `onClose()`만(장소 등장·토스트는 island places INSERT realtime — D-16 중복 방지, onAdded 미호출). 실패 시 try/catch + `toast('추가하지 못했어요. 다시 시도해 주세요', {variant:'error'})` + 시트 유지. `isDevToolsEnabled` 게이트 0(add-link-form L13 복사 금지 준수). `moa-island.tsx` surgical 수정: `addOpen` 상태 + brand-600 56px 원형 FAB(`aria-label="장소 추가"`·lucide `Plus`·`shadow-fab`·`z-[60]`·`bottom-[136px] right-4`) + `<AddSheet onAdded={() => void reconcile()}>`. RED는 import 실패로 확인, `add-sheet.test.tsx` 4케이스(MOA-03 링크+trigger+onAdded+닫힘 / manual은 trigger 미호출 / MOA-04 addManualPlace+닫힘+onAdded 미호출 / reject 시 에러 토스트+시트 유지) GREEN.

**Task 2 — share-sheet + island 함께 정하기 (test 6d1f2a9 → feat a45dfe7, TDD):** `share-sheet.tsx`(100줄) 신규 — `<BottomSheet title="함께 정하기">` + 모드 카드 세로 스택(제목 16/600·설명 14/400 neutral-500·radius xl·p-4, 선택 시 `border-brand-500 bg-brand-50`·`aria-pressed`). Copywriting Contract verbatim("날짜 정하기/언제 갈지 투표로 정해요", "장소 정하기/어디 갈지 찜으로 정해요", "둘다 정하기/날짜와 장소 모두 함께 정해요"). **D-17:** `trip.start_date !== null`이면 'dates' 카드 미렌더(filter, disabled 아님) → 2택. **D-19:** 프리셋 = `trip.share_mode ?? (start_date ? 'places' : null)`, `open` 전환 시 useEffect로 재동기화. CTA "링크 복사하기"(full-width, `disabled={!selected}`): `shareMoa(client, trip.id, selected)` → `url = \`${window.location.origin}/t/${slug}\`` → `navigator.clipboard.writeText(url)`(D-18 복사 우선) → `toast('링크를 복사했어요')` → `onShared?.(mode)` → `navigator.share` 있으면 `share({url})`(AbortError만 무시, Pitfall 5). 실패 시 `toast('링크를 만들지 못했어요. 다시 시도해 주세요', {variant:'error'})`. `moa-island.tsx` surgical: `shareOpen` + `localShareMode`(초기 trip.share_mode, `onShared`로 갱신) 상태 + 상단 바 우측 `<Button size="sm">함께 정하기</Button>` 오버레이 + `<ShareSheet trip={{...trip, share_mode: localShareMode}}>`(재열림 프리셋 일관성). `share-sheet.test.tsx` 5케이스(SHARE-01 3택+places→shareMoa+클립보드+토스트 / D-17 dates 미렌더 2택 / D-19 both 프리셋 aria-pressed / Pitfall5 share AbortError 에러토스트 없음 / shareMoa reject 실패토스트) GREEN.

**Task 3 — Phase 24 마감 게이트 (검증 전용, 커밋 없음):** 순차 실행(`pnpm -r test` 금지 준수):
- `@moajoa/core test` — **169 passed** (11 파일)
- `@moajoa/api test` + `typecheck` — **88 passed** · tsc 0 에러
- `@moajoa/web test:run` + `typecheck` — **110 passed** (20 파일) · tsc 0 에러
- `@moajoa/web build` — **Compiled successfully**, 라우트 테이블에 `ƒ /onboarding`·`ƒ /moa`·`ƒ /moa/[id]`(7.94kB) 존재
- `@moajoa/ios test` — **128 passed** (18 스위트, ui-tokens 무회귀)
- 안티패턴 grep 6종 전부 **0건**: isDevToolsEnabled / presence / seq_no insert·payload / dangerouslySetInnerHTML / `.js` workspace import / react-day-picker/style.css
- `git diff --stat apps/ios` — **0** (iOS 동결 준수)

## Verification

| Gate | Result |
|------|--------|
| add-sheet.test (4) | ✅ green |
| share-sheet.test (5) | ✅ green |
| moa-island.test 무회귀 (5) | ✅ green |
| core 169 · api 88 · web 110 · ios 128 | ✅ green |
| web typecheck · api typecheck | ✅ 0 에러 |
| web build (/onboarding·/moa·/moa/[id]) | ✅ PASS |
| 안티패턴 grep 6종 | ✅ 0건 |
| iOS diff | ✅ 0 |

Acceptance grep(계획 명세): `AddContentTabs`(1+)·`triggerExtraction`+`.catch`·`aria-label="장소 추가"`(1)·`isDevToolsEnabled`(0) / `shareMoa`·`/t/`(1)·`AbortError`·모드 카피 3종·island `함께 정하기`(≥1) 전부 충족.

## Deviations from Plan

**None (기능 편차 0).** 계획 action을 verbatim 이행. 아래는 계획 문구와 실제 리포 정합을 위한 무편차 조정(신규 로직·범위 변경 없음):

1. **[정합] core/api gate 스크립트명** — 계획은 `test:run`을 참조하나 `packages/core`·`packages/api`의 실 스크립트는 `test`(= `vitest run`, 비-watch). 실명으로 호출 — 결과·비-watch 보장 동일.
2. **[정합] moa-island.test mock 확장** — 신규 자식 컴포넌트(AddSheet/ShareSheet)와 island의 `Button` 사용 때문에 island 테스트의 `@/components`·컴포넌트 경로 mock에 `Button`·`AddSheet`/`ShareSheet` 스텁을 추가(24-06 moa-map 스텁 선례 동일). 배선만 검증하고 자식 로직은 각자 테스트가 소유하는 표준 idiom.
3. **[a11y 보강] add-sheet title="추가하기"** — UI-SPEC은 add-sheet 타이틀 미명시지만 BottomSheet가 title을 `aria-label`로 사용하므로 모달 접근성 위해 부여(UI-SPEC dim2 비-blocking FLAG "icon-only aria-label 권고"와 정합). Rule 2(correctness/a11y) 범주.

## Known Stubs

없음 — AddSheet/ShareSheet 모두 실제 `@moajoa/api` mutation(addLink·addManualPlace·shareMoa)에 배선됨. 하드코딩 빈값·placeholder 없음.

## Phase 24 Gate Note

이 plan이 Phase 24의 로컬 표면 마지막 조각이다. 자동 검증 전량 그린 → `/gsd-verify-work`(로컬 realtime 브라우저 스모크 + Vercel Preview 카카오 e2e)로 인계 가능. 단, **원격 db push(0024·0025·0026)는 여전히 human-action 게이트 open**(사용자 터미널 `supabase db push`) — MOA-03/06의 라이브 realtime 반영·SHARE-01의 실제 slug 발급 e2e는 push 선행 필요.

## Self-Check: PASSED

생성 파일 5종·커밋 4종(test/feat×2쌍) 전부 확인. Task 3는 검증 전용(커밋 없음).
