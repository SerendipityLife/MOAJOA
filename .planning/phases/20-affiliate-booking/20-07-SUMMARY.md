---
phase: 20-affiliate-booking
plan: 07
subsystem: ios
tags: [expo, booking, checklist, nativewind, bottom-sheet, appstate, affiliate]
requires:
  - "20-03: @moajoa/core deriveChecklistAutos/isDesynced/ManualItemTitleSchema + BOOKING_REGION_MAP/COMPARE_LABELS + buildSearchDestUrl/buildAiraloDestUrl"
  - "20-04: @moajoa/api listChecklist/addManualItem/setItemStatus/deleteChecklistItem/reconcileChecklist/listClickedChecklistItemIds"
  - "20-05: @/lib/booking openBooking/openDirectSearch/kkdayAvailable + CompareFrameCard embedded variant"
  - "20-06: plan 탭이 동일 checklist를 reconcile — 클릭이 item id 동반 로깅되어 book 탭 확인함이 즉시 정합"
provides:
  - "book.tsx 예약 체크리스트 홈 — loading/error/빈2종/활성 상태머신 + 3단 상태 + 수동 추가 + 삭제 + 조용한 복귀 refetch"
  - "ChecklistRow 컴포넌트 — 상태 컨트롤(neutral→brand→green) + 확인함/플랜에 없음 배지 + 확장 슬롯 + 삭제 숨김 규칙"
  - "me.tsx '제휴 안내' 정적 고지 섹션 (D-16 고지 홈)"
affects:
  - "phase 20 verify — 디바이스 UAT(복귀 전이·보존·수동 추가) 항목 등록"
tech-stack:
  added: []
  patterns:
    - "quiet refetch: AppState 'active' → load({quiet}) — 실패 시 기존 데이터 유지, 에러 화면 미전환 (D-15)"
    - "sheet 콘텐츠 addOpen 게이트 — jest pass-through 스텁에서도 오픈 계약 테스트 가능 (19-03 confirmOpen idiom)"
    - "un-check 착지 판정: listClickedChecklistItemIds Set으로 done 해제 → clicked/todo 분기 (클라 상태 아닌 클릭 기록 원천)"
key-files:
  created:
    - apps/ios/components/booking/checklist-row.tsx
    - apps/ios/__tests__/checklist-row.test.tsx
    - apps/ios/__tests__/book.test.tsx
  modified:
    - apps/ios/app/trip/[id]/(tabs)/book.tsx
    - apps/ios/app/me.tsx
key-decisions:
  - "kind 서브라인 라벨(숙소/유심/교통/액티비티/직접 추가)은 ChecklistRow 로컬 상수 — UI-SPEC이 라벨 문자열 미잠금, provider 카피는 여전히 core만"
  - "listClickedChecklistItemIds는 soft-fail(∅ Set) — 실패해도 탭이 죽지 않고 un-check 착지만 todo로 보수적 강등"
  - "조용한 refetch 실패는 error 화면 미전환 — D-15 '조용함'을 에러 경로에도 적용 (초기/재시도 로드만 State F)"
  - "desynced activity 정렬은 플랜 순 뒤(Infinity) — 배치 해제된 체크 기록이 목록 끝에 모임"
metrics:
  duration: "~15min"
  completed: "2026-07-04"
  tasks: 3
  tests: "iOS 17 suites / 123 tests green (신규 checklist-row 6 + book 5)"
status: complete
---

# Phase 20 Plan 07: book 탭 예약 체크리스트 홈 Summary

**One-liner:** 17-04 book 탭 스텁을 통합 예약 체크리스트 홈으로 교체 — 플랜 자동 파생 + 수동 추가 + 3단 상태(todo→확인함→완료) + 플랜 변경에도 체크 기록 보존('플랜에 없음' 배지) + AppState 복귀 시 팝업 없는 조용한 refetch, me 화면에 D-16 제휴 고지 섹션.

## What Was Built

### Task 1 — ChecklistRow (TDD: b0f9e7d RED → cf8ddf6 GREEN)

`apps/ios/components/booking/checklist-row.tsx` — plan-item-row 골격(ROW_SHADOW + `bg-white rounded-2xl mb-2.5 px-3 py-3`) 미러:

- **3단 상태 컨트롤** (w-11 h-11, `accessibilityRole="checkbox"` + `accessibilityState.checked`): todo=ellipse-outline #D1D5DB / clicked=ellipse-outline #2979FF / done=checkmark-circle #10B981 (semantic green, 브랜드 아님) — neutral→brand→green 진행이 한눈에 읽힘. 탭=onToggleDone 직행, 확인 다이얼로그 없음 (D-11).
- **배지**: '확인함' brand 칩(`bg-brand-50 text-[10px] text-brand-600`, 필수 태그 idiom) + '플랜에 없음' neutral 칩 (D-13, desynced prop — render-time). clicked 행은 서브라인이 kind 라벨 대신 힌트 '예약했으면 체크해주세요' (D-15).
- **kind 칩**: bed/cellular/train/ticket/create-outline, `bg-neutral-100` + neutral-600 glyph.
- **확장**: 본문 탭 → onToggleExpand; expanded 시 `border-t border-neutral-100 mt-3 pt-3` divider + children 슬롯 + '항목 삭제'(#EF4444, 44px 히트). **삭제 숨김: source 'auto' && status 'done'** (돈 쓴 기록 보존 — D-13); manual done은 삭제 유지.
- 테스트 6케이스 (todo/clicked/done/desynced/expanded/삭제숨김) green.

### Task 2 — book.tsx 체크리스트 홈 (6cbf43f)

스텁 전체 교체, plan.tsx early-return 사슬 미러:

- **상태머신**: !loaded → ActivityIndicator #2979FF / error → State F 미러('체크리스트를 불러오지 못했어요…' + 다시 시도=load 재실행) / dateless → '일정이 정해지면 예약을 시작할 수 있어요' / plan null → '먼저 플랜을 만들어주세요' + '플랜 탭으로 가기'(text-brand-600 → router.push) / 활성 → ScrollView px-6 pb-12.
- **load()**: Promise.all(getTrip·listPlacesByTrip·getPlanByTrip·listChecklist·listClickedChecklistItemIds(soft-fail ∅)·auth.getUser) → D-04 게이트 통과 시 `reconcileTripChecklist`(core deriveChecklistAutos 단일 호출 → diff 있을 때만 reconcileChecklist → 재조회, invisible·실패 quiet — 20-06 plan.tsx seam과 동일 미러).
- **활성 목록**: '예약 체크리스트' + '{done}/{total} 완료' caption; 정렬 싱글턴(숙소→유심→교통) → activity(플랜 day/sort 순, desynced는 뒤) → manual. desynced는 `isDesynced(item, 현 예약성 place_id Set)` 렌더 시 계산 (DB 상태 아님 — D-13).
- **상태 토글**: 낙관 업데이트 + 실패 원복 + 토스트. done 해제 → clickedIds.has(id) ? 'clicked' : 'todo' (UI-SPEC Screen 3).
- **행 확장 children**: kind별 CompareFrameCard embedded — activity=Klook/KKday 장소명 검색(D-07, kkdayAvailable 게이트), stay=Agoda/Booking openDirectSearch(도시+날짜 프리필), esim=Airalo(buildAiraloDestUrl), transport=단일 provider, custom=provider 행 없음. 모든 onView가 checklistItemId=item.id 동반 (확인함 전이 경로 — D-11); 완료 행도 [보기] 동작 (re-open 허용).
- **AppState 'active' → 조용한 refetch**: _layout.tsx idiom(inFlight ref 가드 + arrow-wrap sub.remove()); quiet 실패는 기존 데이터 유지 — 팝업·배너·토스트 0 (D-15).
- **수동 추가**: @gorhom/bottom-sheet('예약 항목 추가', placeholder '예: 항공권, 레스토랑 예약', maxLength 80, 빈 입력 시 '추가하기' disabled), 제출 전 `ManualItemTitleSchema.safeParse` (Zod 경계 — T-20-15). **삭제**: Alert '이 항목을 삭제할까요?' (삭제 destructive/취소) → deleteChecklistItem.

### Task 3 — me.tsx 제휴 안내 + book.test.tsx (7535ef5)

- me.tsx: 약관 섹션 아래·로그아웃 위 surgical append — '제휴 안내' heading + 'MOAJOA는 일부 예약 링크에서 제휴 수수료를 받을 수 있어요. 결제 금액은 달라지지 않아요.' (`bg-white rounded-3xl p-5 mb-4` + cardShadow, 브랜드·링크 없음). 카드 footer 고지 플래그는 기본 OFF 유지 (D-16 + RESEARCH Open Q2).
- book.test.tsx: plan.test.tsx 하네스 복사(9 api mock + booking stub + icons/bottom-sheet 스텁) + 5케이스 — dateless 빈 상태 / no-plan 빈 상태+링크 / 활성('예약 체크리스트'+'0/3 완료'+파생 3행) / clicked('확인함'+힌트) / 항목 추가 탭→시트 오픈.

## Verification Evidence

- `pnpm --filter @moajoa/ios test -- checklist-row --watchman=false` → 6/6 green (RED 선행 확인: 모듈 부재 실패)
- `pnpm --filter @moajoa/ios test -- book --watchman=false` → book 5/5 green
- **전체 suite: 17 suites / 123 tests green** (기존 15/112 → +2 suites/+11, 무회귀), `pnpm --filter @moajoa/ios typecheck` exit 0 (Task 2·3 각각)
- grep 게이트: checklist-row `확인함`==1·`플랜에 없음`==1·`checkmark-circle`==1·`accessibilityRole`==3(>=2) / book.tsx `예약은 곧 제공돼요`==0·`예약 체크리스트`==3(>=1)·`AppState`==4(>=2)·`이 항목을 삭제할까요?`==1 / me.tsx `제휴 안내`==1·`결제 금액은 달라지지 않아요`==1·`git diff grep -c "^-"`==1(diff 헤더뿐 — 순수 append)
- 카피는 UI-SPEC Copywriting Contract와 문자 일치 (타이틀·caption·배지·힌트·시트·Alert·빈 상태 2종·에러)

## TDD Gate Compliance

Task 1: RED(b0f9e7d, 모듈 부재로 6케이스 실패 확인) → GREEN(cf8ddf6, 6/6). Task 2·3은 plan 설계상 구현→테스트 순(Task 3의 book.test.tsx가 Task 2 계약 커버, plan verify가 typecheck/테스트로 명시) — plan type은 execute(플랜 레벨 TDD 게이트 비적용).

## Deviations from Plan

### Acceptance-gate 표기 차이 (코드 무결, 20-06 선례)

- `grep -c "deriveChecklistAutos" book.tsx` == 1 기대 → **실측 2** (named import 라인 + 단일 호출 지점). 의도(파생은 core 단일 정의 호출, 산재 0)는 충족 — 호출 지점은 `reconcileTripChecklist` 안 1곳뿐. 헤더 doc-comment의 심볼 언급은 게이트 오탐 방지를 위해 reword.
- checklist-row의 `플랜에 없음`/`checkmark-circle` 게이트(==1)도 doc-comment 언급이 2로 집계 → 코멘트 reword로 1 복원 (19-02 선례, 코드경로 무변경).

그 외 deviation 없음 — plan 스펙 그대로 실행.

## UAT Items (phase verify로 배치 — Task 3 human-check)

- 디바이스: 체크리스트 [보기] → Safari → 앱 복귀 → 해당 행 '확인함' 전환 + 인라인 힌트 (팝업 없음, D-15)
- 완료 체크·해제 (해제 시 클릭 흔적 있으면 확인함, 없으면 미완료 착지)
- 수동 항목 추가(시트 키보드 동작 포함)·삭제
- 플랜 재생성 후 체크된 항목 보존 + '플랜에 없음' 배지 (D-13)
- me 화면 제휴 안내 섹션 표시

## Known Stubs

None — 전 행이 실 데이터(checklist DB·BOOKING_REGION_MAP·plan_items) 배선. 수동(custom) 행의 확장은 설계상 provider 행 없음(삭제만) — 스텁 아님, UI-SPEC Screen 3 계약.

## Threat Flags

None — 신규 표면 없음. T-20-15(수동 title)는 ManualItemTitleSchema 경계 검증 + 0021 DB CHECK 이중화로 mitigate 이행; T-20-05는 can_edit_trip RLS 서버 게이트(클라 재구현 없음 — D-12).

## Self-Check: PASSED

- apps/ios/components/booking/checklist-row.tsx — FOUND
- apps/ios/app/trip/[id]/(tabs)/book.tsx (스텁 소멸) — FOUND
- apps/ios/app/me.tsx (제휴 안내) — FOUND
- apps/ios/__tests__/checklist-row.test.tsx / book.test.tsx — FOUND
- commits b0f9e7d / cf8ddf6 / 6cbf43f / 7535ef5 — FOUND
