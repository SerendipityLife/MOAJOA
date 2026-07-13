---
phase: 28-add-trip-redesign-ai
verified: 2026-07-13T21:25:00Z
status: passed
score: 6/6 must-haves verified (SC-1 ~ SC-6)
behavior_unverified: 0
overrides_applied: 0
mode: goal-backward (execute-phase 종료 게이트)
evidence:
  tests: "602 passing — web 267/267 · core 192/192 · api 112/112 · deno EF 31/31"
  typecheck: "6/6 workspace 통과 (동결된 apps/ios 포함)"
  freeze_gate: "apps/ios 0 · 마이그레이션 0016~0030 0 · add-content-tabs 0 · place-sheet 0"
uat_pending: # verification 실패 아님 — 유료 API 왕복이라 라이브 UAT 몫
  - test: "날짜 미정 모아 + 기간 pill '2박3일' → '일정 만들기'"
    expected: "Day 탭 3개 (day_count 기준). 1개가 아니어야 함"
    why_human: "Claude·Routes 유료 API 왕복. 단위 레벨(plan-section Test 9, EF dayCount fallback)은 통과"
  - test: "장소를 Day 3으로 수동 이동 → '일정 다시 만들기'"
    expected: "그 장소가 Day 3에 그대로 유지 (D-25 카피대로)"
    why_human: "유료 API 왕복. 4-링크 루프는 각 고리마다 단위 테스트 통과"
---

# Phase 28: Add-Trip Redesign (트리플 룩 위저드 + 웹 AI 일정) 검증 리포트

**Phase Goal:** `/onboarding` 위저드를 `references/add_trip` 레퍼런스 룩으로 개편하고, 기존 AI 일정 엔진(Phase 18)을 웹 결과 화면(Day 탭·번호 타임라인)으로 연결. 백엔드 신규는 `trips.day_count` 한 컬럼뿐.
**Verified:** 2026-07-13
**Status:** ✅ passed (6/6) — 라이브 UAT 2건 pending
**Re-verification:** No — 최초 검증

---

## Goal Achievement — Observable Truths

| # | Success Criterion | 상태 | 코드 증거 |
|---|---|---|---|
| SC-1 | 레퍼런스 레이아웃 (뒤로가기 + `N/총`, 중앙 아이콘, 큰 타이틀+서브카피, 2열 pill, 하단 고정 CTA) | ✅ VERIFIED | `page.tsx:153` ChevronLeft · `:162` `{step}/4` · `:170` `text-4xl` 중앙 아이콘 · `:173` `text-center text-2xl` 타이틀 · `:177` 서브카피 · `select-pill.tsx` + `grid-cols-2` (step-where·step-who·duration-pills) · `:232` 하단 고정 CTA (`disabled:bg-brand-300` + `disabled:text-white` = 연한 파랑 + 흰 글씨, D-05) |
| SC-2 | 기간 pill → `trips.day_count` 저장 + 캘린더 정확 날짜 | ✅ VERIFIED | `0031_trip_day_count.sql` (원격 적용 완료) · `duration-pills.tsx` · `build-draft.ts:83-98` (3경로 전부 `day_count` 채움, 캘린더는 파생) · `step-dates.tsx:98` 캘린더 escape hatch · `trips.ts` createMoaDraft INSERT |
| SC-3 | 링크·장소 검색이 기존과 동일 동작 (`AddContentTabs` 재사용, 병렬 구현 0) | ✅ VERIFIED | `step-seed.tsx:39` + `add-sheet.tsx:101`이 동일 컴포넌트 사용. **`add-content-tabs.tsx` diff = 0** — 재구현 0 |
| SC-4 | '일정 만들기' → Day 1~N 탭 + 번호 타임라인 (날짜 미정이어도 `day_count` 기준) | ✅ VERIFIED | EF `index.ts:177` `trip.day_count ?? computeDayCount(...)` · `plan-section.tsx:147` `Math.max(trip.day_count ?? 0, maxDayIndex+1, 1)` · 테스트 Test 9 (day_count=6, items Day 0~3 → **탭 6개**) 통과 |
| SC-5 | 장소 검색 시 Day 배치 질문 + '모르겠다' → AI 배치, 규칙이 카피로 노출 | ✅ VERIFIED | `add-sheet.tsx:85-91` D-19/D-20 분기 · `day-select-sheet.tsx` · 가이드 카피 4곳 전부 렌더 경로 (아래 표) |
| SC-6 | `apps/ios` 및 기존 마이그레이션 diff 0 | ✅ VERIFIED | `git diff --stat 4a206cd..HEAD` — apps/ios **0줄** · migrations는 `0031`만 추가 |

**Score: 6/6 verified · behavior_unverified 0**

---

## 지시된 심층 검증 8종 (SUMMARY 주장 불신 · 코드 직접 확인)

### 1. SC-4 핵심 결함 회귀 — ✅ 해소 확인

`supabase/functions/generate-plan/index.ts` 직접 확인:

```
L122:  .select('id, owner_id, start_date, end_date, day_count')
L177:  const dayCount = trip.day_count ?? computeDayCount(trip.start_date, trip.end_date);
L304:  day_count: dayCount,
```

기존 결함("날짜 null → 무조건 1일")이 실제로 고쳐졌다. `day_count`가 항상 **우선**하고, 없을 때만 날짜에서 파생. Deno 테스트 `buildPlanPrompt — includes the N-day count` 통과.

### 2. 스푸핑 표면 — ✅ 닫힘 (day_count가 요청 바디에 없음)

`RequestSchema` region-scoped 확인 결과 필드는 `trip_id` · `travel_mode` · `anchor_place_ids` · `removed_place_ids` · `pinned_placements` **5개뿐**. `day_count` **없음**. 서버가 `trips`에서 읽는다. 클라이언트가 Day 수를 부풀려 Claude·Routes 유료 호출을 조작하는 경로가 물리적으로 없다. 호출부(`moa-island.tsx:296`)도 `day_count`를 보내지 않으며 그 이유가 주석으로 잠겨 있다 (T-28-08).

### 3. D-21 루프 — ✅ 네 고리 전부 존재 + 각각 테스트 통과 → **D-25 카피는 진실**

| # | 고리 | 코드 | 테스트 |
|---|---|---|---|
| 1 | `moveToDay` → `is_anchor: true` insert | `plans.ts:143` `.insert({ ...input, is_anchor: true, ... })` | `plans.test.ts:154` ✅ |
| 2 | island이 `is_anchor` 항목에서 `{place_id, day_index}` 수집 | `moa-island.tsx:287-290` `.filter((it) => it.is_anchor).map(...)` | `moa-island.test.tsx:579` Test 21 ✅ |
| 3 | `pinned_placements`로 EF 전송 + 프롬프트 제약 | `moa-island.tsx:294` → `claude.ts:145` | `buildPlanPrompt — pinned place_id and its 1-based day (D-21)` ✅ |
| 4 | `enforcePinnedPlacements` 사후 강제 | `claude.ts` — intersect → clamp → strip → append 4단계 실알고리즘 (스텁 아님) | deno 6종 ✅ |

EF `index.ts:285`가 pinned를 **다시 `is_anchor: true`로 기록**해 루프가 닫힌다 (재생성 N회 반복해도 고정 유지). 실행 순서 계약도 올바름: `validatePlanIds`(환각 id 제거) → `enforcePinnedPlacements`(고정 강제). 보안: 타 trip·환각 id는 `inputSet` 교집합으로 차단(T-28-09), `day_index`는 `dayCount`로 클램프(T-28-10) — 둘 다 명시 테스트 통과.

**판정: 하나도 끊기지 않음. `plan-section.tsx:391` "직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요"는 코드가 뒷받침하는 참인 문장이다.**

### 4. 30일 상한 3겹 방어 — ✅ 전부 INSERT 이전 · 단일 소스

| 겹 | 위치 | 소스 |
|---|---|---|
| 1차 (캘린더) | `step-dates.tsx:98` `max={Limits.TripDayCountMax}` | 상수 ✅ |
| 2차 (게이트) | `page.tsx:97-105` `canProceed` → `isDayCountWithinLimit` | 상수 ✅ |
| 3차 (Zod) | `build-draft.ts:92` `TripCreateDraftSchema.parse` → throw | 상수 ✅ (`trip.ts:30,70` `.max(Limits.TripDayCountMax)`) |
| DB 최종 | `0031` `CHECK (day_count between 1 and 30)` | SQL은 import 불가 — 헤더 주석이 결속 |

세 방어가 **모두 `createMoaDraft` INSERT 이전**에 위치. `Limits.TripDayCountMax: 30` (`constants.ts:36`) 단일 소스. 리터럴 30 하드코딩은 **방어 레이어에 0건** — 유일한 리터럴은 안내 카피 문자열(`step-dates.tsx:107`, 아래 WARNING).

`build-draft.ts:31`이 상한 초과를 **조용히 클램프하지 않고** 그대로 돌려주는 설계도 옳다 — 사용자 의도를 말없이 바꾸지 않고 게이트가 막는다.

### 5. Day 탭 수 공식 — ✅ 정확히 일치

`plan-section.tsx:147`:
```ts
const dayTotal = Math.max(trip.day_count ?? 0, maxDayIndex + 1, 1);
```
요구된 `max(trip.day_count ?? 0, max(day_index)+1)`과 일치 (`, 1` 하한은 빈 플랜 방어). **`plan-section.test.tsx:268` Test 9가 정확히 그 시나리오를 검증**: `day_count=6`인데 items가 Day 0~3에만 있어도 탭 6개. SC-4의 "날짜 미정이어도 day_count 기준 Day 수" 충족.

### 6. 동결 게이트 — ✅ 전부 0

`git diff --stat 4a206cd..HEAD` 기준:

| 대상 | diff | 판정 |
|---|---|---|
| `apps/ios` | **0줄** | ✅ SC-6 (게다가 `apps/ios` typecheck 통과) |
| `supabase/migrations/0016~0030` | **0줄** (0031만 신규) | ✅ append-only |
| `apps/web/components/add-content-tabs.tsx` | **0줄** | ✅ SC-3 병렬 구현 0 |
| `apps/web/app/moa/[id]/_components/place-sheet.tsx` | **0줄** | ✅ HC-5 |
| 신규 제스처 핸들러 | **0건** | ✅ |

제스처 핸들러 grep 히트 3건(`onPointerDown` · `setPointerCapture` · `touch-none`)은 **전부 `place-sheet.tsx:66/118/119`** — diff 0인 파일, 즉 커밋 `3f32204`(직전 제스처 소유권 정리)의 기존 코드다. Phase 28이 추가한 제스처 핸들러는 없다. 가로 Day 탭 스트립이 place-sheet 제스처 경계를 건드릴 거라는 28-CONTEXT의 회귀 위험 지점이 **실제로 회피됐다**.

### 7. D-01~D-25 전수 — ✅ 반영 (지목된 3건 포함)

| 결정 | 판정 | 증거 |
|---|---|---|
| **D-01** 히어로 인트로 미추가 | ✅ | `_components/`에 인트로 파일 없음 (duration-pills·step-dates·step-seed·step-where·step-who 5개뿐). `/onboarding` = 곧장 스텝 1 |
| D-02~D-05 | ✅ | SC-1 행 참조 |
| D-06/D-07 | ✅ | `duration-pills.tsx` 6종 + 캘린더 escape hatch |
| D-08/D-09 | ✅ | 심층검증 1·4 |
| D-10 | ✅ | SC-3 |
| D-12 | ✅ | `plan-section.tsx` '일정 만들기' 버튼 |
| **D-13** 기간 게이트 **owner 전용** | ✅ | `plan-section.tsx:133-136` `isOwner = currentUserId === trip.owner_id` · `gateBlocked = durationUnset && !isOwner` · `:227` `if (durationUnset && isOwner)`. trips UPDATE RLS가 owner-only(0016)라 editor 저장이 조용히 실패하는 걸 UI가 앞에서 막는 **심층방어 2겹** |
| D-14 추출 대기 게이트 | ✅ | `plan-section.tsx:239` '영상에서 장소를 찾고 있어요 · N개 분석 중' |
| D-15/D-16 | ✅ | `moa-map.tsx:19,26` `labels`(번호 핀) + `fitKey`(강제 재조정) additive props |
| D-17 미배치 풀 | ✅ | `plan-section.tsx:377` '아직 안 넣은 곳 {pool.length}' |
| D-18 하단 액션 3종 | ✅ | `:387` 일정 다시 만들기 · `:31-33` 이동수단 전철/도보/차 · `:425` 일정 공유하기 |
| **D-19** 플랜 미생성 → 안 묻고 담기 | ✅ | `add-sheet.tsx:91` — `planExists` false면 시트 없이 토스트만 |
| **D-20** 플랜 존재 + '모르겠다' → 미배치 풀 | ✅ | `add-sheet.tsx:85-89` `if (planExists) { setPendingPlaceId(...) }` → `day-select-sheet.tsx` |
| D-21 | ✅ | 심층검증 3 (4-링크 루프) |
| D-22~D-25 | ✅ | 아래 표 |

### 8. 가이드 카피 4곳 — ✅ 전부 실제 렌더 경로

| 결정 | 문구 | 렌더 위치 |
|---|---|---|
| D-22 | "유튜브·블로그 링크를 넣으면 영상 속 장소를 찾아 AI가 일정을 짜드려요" | `step-seed.tsx:36` (JSX 본문) |
| D-23 | "링크를 넣거나 장소를 담고 일정 만들기를 누르면 AI가 동선을 짜드려요" | `plan-section.tsx:220` (빈 상태) |
| D-24 | "지도에 담았어요 — 일정 만들기를 누르면 며칠차에 넣을지 AI가 정해줘요" | `add-sheet.tsx:91` (토스트, D-19 경로) |
| D-25 | "직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요" | `plan-section.tsx:391` (재생성 버튼 하단) |

주석 안이 아니라 전부 JSX/토스트 호출 = **사용자 눈에 실제로 보인다**.

---

## 선언된 Deviation 4건 — 판정

| # | Deviation | 판정 | 근거 |
|---|---|---|---|
| 28-03 | `z.infer` → `z.input` 기반 `GeneratePlanRequestInput` export | ✅ **정당 (필수)** | `plan.ts:78`. `.default([])` 필드가 파스 후 타입에선 required가 되어 동결된 iOS `plan.tsx:359`(`pinned_placements` 미전달) 컴파일이 깨진다. **`apps/ios` typecheck 통과 + diff 0** = 이 선택이 SC-6 동결을 지킨 유일한 길임을 실증 |
| 28-05 | `renderPool` render prop 신설 | ✅ **정당** | `plan-section.tsx:74` 선언 → `:379` 소비, `moa-island.tsx:610`이 주입. 실제 배선됨(고아 아님). PlaceList의 12개 prop을 계약에 넣지 않고 소유권을 island에 유지 |
| 28-04 | page.tsx 배선이 Task 3 → Task 2로 앞당겨짐 | ✅ **정당 (무해)** | StepDates props 변경 시 컴파일 불가 — 플랜 내부 순서 조정일 뿐 목표·산출물 영향 0 |
| 28-04 | 안내 카피의 `30`이 리터럴 | ⚠️ **WARNING (수용)** | `step-dates.tsx:107` "여행 기간은 최대 30일까지…". UI-SPEC verbatim 문구이고 **방어 레이어가 아니다**(상한 소스 3겹은 전부 상수). 다만 `Limits.TripDayCountMax`를 바꾸면 이 문장만 남아 거짓말이 된다 — 아래 권고 |

---

## Anti-Patterns

Phase 28이 수정한 소스 16개 파일 전수 스캔: **TODO · FIXME · XXX · TBD · HACK · PLACEHOLDER · "not yet implemented" 0건.** 미해결 부채 마커 없음.

---

## 행동 증거 (Behavioral)

| 스위트 | 결과 |
|---|---|
| `apps/web` | ✅ 31 files / **267 tests** passed |
| `packages/core` | ✅ 11 files / **192 tests** passed |
| `packages/api` | ✅ 9 files / **112 tests** passed |
| `supabase/functions/generate-plan` (deno) | ✅ **31 tests** passed (0 failed) |
| **합계** | **602 passing** |
| `pnpm -r typecheck` | ✅ 6/6 workspace (동결된 `apps/ios` 포함) |

상태 전이·불변식을 직접 실행하는 명시 테스트 확인:
- `enforcePinnedPlacements — moves a pinned place off the wrong day onto its day` ✅
- `enforcePinnedPlacements — clamps a day_index beyond dayCount to the last day (T-28-10)` ✅
- `enforcePinnedPlacements — ignores a place_id outside the input set (T-28-09)` ✅
- `enforcePinnedPlacements — empty pinned is a no-op (무회귀)` ✅
- `moa-island Test 21: 재생성 → is_anchor 항목이 pinned_placements + anchor_place_ids로 전달 (D-21 루프)` ✅
- `plan-section Test 9: day_count=6인데 items가 Day 0~3에만 있어도 탭이 6개` ✅

→ SC-4·D-21의 behavior-dependent 불변식이 **presence가 아니라 실행으로** 증명됨. `behavior_unverified: 0`.

> 참고(Phase 무관): `apps/web/package.json`의 `"test": "vitest"`가 watch 모드라 `pnpm -r test`가 CI에서 멈춘다. 다른 패키지는 `vitest run`. Phase 28이 만든 문제가 아니라 기존 스크립트 이슈 — 별도 처리 권고.

---

## UAT Pending (verification 실패 아님)

유료 API 왕복이 필요해 자동 검증 범위 밖. 각 경로의 단위 레벨은 전부 통과했고, `0031`(원격 적용) · `generate-plan` EF(v2 ACTIVE) 둘 다 라이브다.

### 1. 날짜 미정 → Day 탭 수
**Test:** 날짜 미정 모아 생성 → 기간 pill '2박3일' → '일정 만들기'
**Expected:** Day 탭 **3개** (1개가 아님 — 이게 고친 결함)
**Why human:** Claude + Routes 유료 호출

### 2. 수동 배치 Day 고정
**Test:** 장소를 Day 3으로 수동 이동 → '일정 다시 만들기'
**Expected:** 그 장소가 **Day 3에 그대로** (D-25 카피대로)
**Why human:** 유료 왕복. 4-링크 루프는 각 고리마다 단위 테스트 통과

---

## 권고 (비차단)

1. **`step-dates.tsx:107` 안내 카피의 리터럴 `30`** — `여행 기간은 최대 {Limits.TripDayCountMax}일까지…`로 보간하면 상한 변경 시 문구 드리프트가 0이 된다. 방어 레이어가 아니라 차단 사유는 아니지만, "세 곳 동시 변경" 문서 계약에 네 번째 항목이 숨어 있는 셈.
2. **`apps/web` test script watch 모드** — `"test": "vitest run"`으로 통일 (Phase 28 무관, 기존 이슈).

---

## Gaps Summary

**없음.** SC-1~SC-6 전부 코드로 확인됐고, 지시된 심층 검증 8종 모두 통과했다.

가장 무너지기 쉬웠던 지점 — **D-21 4-링크 루프** — 이 네 고리 모두 실재하고 각각 테스트로 방어된다. 따라서 D-25 카피("직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요")는 사용자에게 하는 **참인 약속**이다. 이 루프가 하나라도 끊겼다면 카피가 거짓말이 되어 BLOCKER였을 것이다.

비용 조작 표면(`day_count` 스푸핑)도 닫혀 있고, 30일 상한 3겹 방어가 전부 INSERT 이전에 단일 소스로 걸려 있다. 동결 게이트(iOS·기존 마이그레이션·AddContentTabs·place-sheet)는 diff 0으로 완벽히 지켜졌다.

---

_Verified: 2026-07-13_
_Verifier: Claude (gsd-verifier) — goal-backward, FORCE stance_
