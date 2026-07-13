---
phase: 28-add-trip-redesign-ai
plan: 04
subsystem: web-onboarding
tags: [wizard, restyle, day-count, duration-pills, calendar-cap, tdd]
status: complete

requires:
  - 28-01 (trips.day_count · Limits.TripDayCountMax · core Zod 상한)
  - 28-02 (SelectPill · DurationPills)
provides:
  - "buildDraft({ dayCount }) → TripCreateDraft.day_count"
  - "deriveDayCount(from, to) — 포함 일수 파생, 클램프 없음"
  - "isDayCountWithinLimit(n) — 상한 판정 한 벌 (Limits.TripDayCountMax)"
  - "DateMode 3택 타입 ('duration' | 'fixed' | 'unset')"
  - "StepDates 새 props (dayCount · onDayCountChange · 모드 3택)"
  - "HEADINGS → {icon, title, subtitle} Record"
affects:
  - 28-05 (DurationGateSheet가 DurationPills·isDayCountWithinLimit 재사용 가능)
  - 28-06 ([일정] 섹션이 trip.day_count를 Day 탭 수의 소스로 소비)

tech-stack:
  added: []   # 신규 npm 패키지 0
  patterns:
    - "상한 3겹 방어가 전부 INSERT 이전 — 캘린더 max(1차) → canProceed(2차) → Zod parse(3차)"
    - "판정 함수 한 벌 공유 — step-dates 안내 카피와 page.tsx CTA 게이트가 같은 함수를 써서 어긋남 0"
    - "파생 저장으로 fallback 드리프트 제거 — 캘린더 range에서 day_count를 파생해 함께 저장"
    - "모드가 단일 진실 — 매퍼가 stale 값을 흘리지 않음"

key-files:
  created: []
  modified:
    - apps/web/app/onboarding/_lib/build-draft.ts
    - apps/web/app/onboarding/_components/step-dates.tsx
    - apps/web/app/onboarding/_components/step-where.tsx
    - apps/web/app/onboarding/_components/step-who.tsx
    - apps/web/app/onboarding/_components/step-seed.tsx
    - apps/web/app/onboarding/page.tsx
    - apps/web/__tests__/build-draft.test.ts
    - apps/web/__tests__/onboarding.test.tsx

decisions:
  - "day_count 정합 규칙(D-08 재량 확정): day_count는 항상 채운다. 캘린더로 정확한 날짜를 정하면 그 범위에서 파생시켜 함께 저장한다 — EF fallback이 day_count를 항상 우선하므로(28-03) 파생하지 않으면 이전 pill 값이 새 날짜를 무시하는 드리프트가 생긴다(Pitfall 7)"
  - "deriveDayCount는 상한 클램프를 하지 않는다 — 35일을 고르면 35를 반환. 조용한 클램프는 사용자 의도를 말없이 바꾸는 것이라 금지, 판정은 호출부가"
  - "step 4 서브카피(D-22)는 step-seed가 소유 — page.tsx의 HEADINGS[4].subtitle을 null로 두어 중복 렌더 회피"
  - "onboarding.test.tsx에서 react-day-picker를 하네스로 모킹 — DayPicker max가 상한 초과 range를 애초에 막으므로 실제 캘린더 클릭으로는 2차/3차 방어를 검증할 수 없다"
  - "안내 카피의 '30'은 UI-SPEC verbatim 리터럴 — 상한 소스가 아니며 Limits 변경 시 함께 갱신 필요(아래 Deferred Issues)"

metrics:
  duration: ~25m
  completed: 2026-07-13
  tasks: 3
  commits: 6
  files: 8
  tests: "web 191 → 218 그린 (+27: build-draft +12 · onboarding +15)"
---

# Phase 28 Plan 04: 위저드 리스타일 + 기간 pill Summary

`/onboarding` 4단계 위저드를 레퍼런스(IMG_2918~2921) 룩으로 리스타일하고, 날짜 스텝을 **기간 pill 1차 + 캘린더 escape hatch** 구조로 바꿨다. 상태 소유 구조(page.tsx가 전부 소유 — Phase 24 D-02)는 그대로 두고 렌더 트리만 교체했다.

## What Was Built

| 심볼 | 위치 | 소비자 |
|---|---|---|
| `buildDraft({ dayCount })` → `day_count` | `_lib/build-draft.ts` | 위저드 제출(page.tsx) |
| `deriveDayCount(from, to)` | 동상 | step-dates(안내 카피) · page.tsx(`canProceed`) |
| `isDayCountWithinLimit(n)` | 동상 | 동상 — **상한 판정 한 벌 공유** |
| `DateMode` 3택 타입 | 동상 | page.tsx · step-dates |
| `StepDates` 새 props | `_components/step-dates.tsx` | page.tsx |
| `HEADINGS` → `{icon,title,subtitle}` | `page.tsx` | 위저드 셸 |

### Task 1 — build-draft day_count 매핑 (D-08 · Pitfall 7) — RED `d4c4166` → GREEN `01fae3c`

**정합 규칙을 확정했다 (D-08의 플래너 재량 지점):**

> **day_count는 항상 채운다. 캘린더로 정확한 날짜를 정하면 day_count를 그 범위에서 파생시켜 함께 저장한다.** 날짜를 아예 안 정하면 day_count만 있고 start/end는 null. 셋 다 안 정하면 전부 null.

근거: EF fallback이 `trip.day_count ?? computeDayCount(start,end)`로 **day_count를 항상 우선**하므로(28-03), 캘린더로 5일 범위를 정했는데 이전 pill의 `day_count=3`이 남아 있으면 5일 날짜가 조용히 무시된다(Pitfall 7). 파생 저장이 그 드리프트를 0으로 만든다 — 단일 fallback 순서를 유지하면서. 추가로 **모드를 단일 진실**로 삼아, `fixed` 모드에서는 들어온 `dayCount` 인자를 아예 무시하고 range에서만 파생한다(stale 값 미유출 — 테스트로 고정).

- `deriveDayCount`: 포함 일수(같은 날=1, 6/14~6/16=3, `to` 없으면 1). 로컬 자정 정규화 후 차분 — 기존 `fmt`의 로컬 타임존 관례를 깨지 않고(UTC 변환 0, 24-04 함정 회피) DST의 23/25시간 하루도 반올림으로 흡수. **상한 클램프 없음** — 35일은 35를 반환한다.
- `isDayCountWithinLimit`: `Limits.TripDayCountMax` 단일 소스. `null`(미정)은 통과.
- `TripCreateDraftSchema.parse` 제출 게이트 유지 — 상한 초과는 여기서 throw(3차 방어).

### Task 2 — step-dates 기간 pill + 캘린더 escape hatch (D-06 · D-07 · A-8) — RED `fcc277f` → GREEN `7929da5`

- `DurationPills`(28-02) 재사용 — 기간 옵션 단일 출처. **재구현 0.**
- **캘린더를 폐기하지 않고 진입점만 뒤로 옮겼다**(D-07): `정확한 날짜 고르기` 버튼 뒤 인라인 노출. `DAY_PICKER_CLASS_NAMES`·`locale={ko}`·`disabled={{before}}`·`mode="range"` 전부 **무수정**(share-sheet와의 클래스 미러 관계 보존).
- `나중에 정할게요` text 버튼 **존치**(A-8) — 레퍼런스엔 없지만 제거하면 ONBOARD-04(날짜 미정 통과) 요구사항 회귀.
- 세 경로 **상호 배타** — 전환 시 상대 값을 비운다(page.tsx 소유).
- `ModeCard` 로컬 컴포넌트는 pill로 대체되어 orphan → **제거**(내 변경이 만든 orphan만 — CLAUDE.md §3.3).
- `useState` grep **0** — 컴포넌트는 여전히 상태를 소유하지 않는다.

### Task 3 — 위저드 셸 리스타일 (D-01~D-05, D-22) — RED `cef7632` → GREEN `769a33b`

- **헤더(D-02):** 4-dot 인디케이터 **제거** → 우측 `N/4` 카운터(12/600 `text-brand-600`, `tabular-nums`). 스크린리더에는 문장형 라벨로 별도 전달(슬래시는 시각 전용 — A11y Contract). chevron·`pushState`/`popstate` 배선 **무수정** — 카운터는 `step`에서 파생이라 추가 배선 0.
- **타이틀 앙상블(D-03):** `HEADINGS`를 `{icon,title,subtitle}` Record로 확장(스텝별 if 분기 없이 유지). 중앙 이모지(🌏📅😎📍, `aria-hidden`, 신규 에셋 0 — A-6) → 24/600 중앙 타이틀 → 14/400 회색 서브카피.
- **CTA(D-05):** `Button` **무수정**(A-4). `disabled:text-white` 오버라이드만 얹어 "연한 파랑 bg + 흰 글씨"를 충족 — Button primary가 이미 `disabled:bg-brand-300`을 갖고 있고 기본 글씨가 반투명이라 그것만 덮으면 된다. **신규 variant 0.**
- **step-where / step-who(D-04):** `Chip` → `SelectPill`, `flex-wrap` → `grid grid-cols-2 gap-2`. 홀수 개면 마지막 pill이 1열만 점유(레퍼런스 동일). '기타' 직접입력 `Input`과 로직 **무수정**.
- **step-seed(D-22):** 안내 문구만 D-22 카피로 교체. **`AddContentTabs`는 한 줄도 안 건드렸다**(SC-3).
- **D-01:** 히어로 인트로 화면 없음 — `/onboarding` 진입 = 곧장 스텝 1.

## 상한 3겹 방어 (BLOCKER 수습)

장기 여행은 D-07이 전제하는 **정상 경로**다. 상한 초과가 런타임 에러로 새면 모아 생성이 통째로 실패하므로, 방어가 **전부 INSERT 이전**에 있다:

| # | 위치 | 동작 |
|---|------|------|
| 1차 | `step-dates` — `DayPicker max={Limits.TripDayCountMax}` | 31일 이상 range를 **애초에 선택 불가** |
| 2차 | `page.tsx` — `canProceed` | 상한 초과면 CTA disabled → **`createMoaDraft` INSERT가 물리적으로 발생하지 않음** |
| 3차 | `build-draft` — `TripCreateDraftSchema.parse` | 위 둘을 뚫고 온 값은 throw |

**네 숫자(캘린더 `max` · Zod · 0031 CHECK · 게이트)가 전부 `Limits.TripDayCountMax` 단일 소스**에서 온다 — 리터럴 `30` 하드코딩 0(카피 문구 제외, 아래 참조). 1차와 2차의 판정은 **같은 함수 한 벌**(`deriveDayCount` + `isDayCountWithinLimit`)을 공유하므로 "카피는 뜨는데 CTA는 눌린다" 같은 어긋남이 구조적으로 불가능하다.

## Deviations from Plan

### 1. [Rule 3 - Blocking] page.tsx 배선이 Task 3이 아니라 Task 2에 착지

- **Found during:** Task 2
- **Issue:** 플랜은 `page.tsx`를 Task 3의 파일로 배정했지만, Task 2가 `StepDates`의 props를 바꾸는 순간 `page.tsx`가 컴파일·렌더 불가가 된다 — Task 2 자신의 테스트(`OnboardingPage`를 렌더한다)가 통과할 수 없다.
- **Fix:** Task 2 커밋에 **최소 배선만** 포함 — `DateMode` 3택 상태 · `dayCount` 상태 · 상호 배타 핸들러 · `canProceed` 상한 게이트 · `buildDraft`에 `dayCount` 인자. 셸 리스타일(헤더·타이틀·CTA·pill 그리드)은 계획대로 Task 3.
- **영향:** 없음. Task 3 acceptance(`grep -c 'isDayCountWithinLimit' page.tsx` → 1 이상)는 최종 상태 기준이라 그대로 통과. 상한 CTA 게이트 테스트는 Task 3 RED에서 이미 그린이었다(게이트가 Task 2에 선행 착지했으므로) — 회귀 가드로 존치.
- **Files:** `apps/web/app/onboarding/page.tsx`
- **Commit:** `7929da5`

### 2. [Test harness] onboarding.test.tsx에서 react-day-picker 모킹

- **Found during:** Task 2 테스트 설계
- **Issue:** 플랜은 "상한 초과 range → CTA disabled" 케이스를 필수로 요구하지만, **실제 캘린더를 클릭해서는 상한 초과 range를 만들 수 없다** — 1차 방어(`max`)가 애초에 막기 때문. 즉 2차·3차 방어를 실제 캘린더 UI로는 검증할 수 없다.
- **Fix:** `DayPicker`를 하네스로 모킹해 (a) `max`가 실제로 전달되는지(`data-max`), (b) 상한 초과 range가 흘러들어왔을 때 우리 게이트(`canProceed` + 안내 카피)가 잡는지를 직접 검증. RDP의 `max` 동작 자체는 라이브러리 계약(9.14.0 `mode="range"`의 `max?: number` — 타입 실측 확인)이고, 우리가 지켜야 할 건 **우리 쪽 배선**이다. 캘린더 보존 자체는 구조적 grep(`DayPicker` ≥1, `DAY_PICKER_CLASS_NAMES` ≥2)과 프로덕션 빌드가 커버한다.
- **Files:** `apps/web/__tests__/onboarding.test.tsx`

### 3. [카피 계약] 기존 4케이스의 fixture 텍스트 갱신

`onboarding.test.tsx`의 기존 4케이스가 클릭하던 `아직 미정이에요` · `날짜 정했어요`는 D-06/D-07/A-8이 각각 `나중에 정할게요` · `정확한 날짜 고르기`로 **계약상 교체**한 카피다. 케이스 4개는 그대로 존치하고 **의미도 동일**(미정 경로 통과 / range 미선택 시 CTA disabled) — fixture 문자열만 새 카피로 갱신했다. 케이스 삭제 0.

### 4. [표현 조정 — deviation 아님] doc 주석 리워딩 2건

`step-dates.tsx`의 주석이 `useState`·`정확한 날짜 고르기`·`나중에 정할게요`를, `page.tsx`의 주석이 `4단계 중`을 포함해 acceptance grep을 오탐시켰다(코드가 아니라 주석에서 매치). 의미를 보존한 채 주석만 재서술 — 28-02/24-05/26-02와 동일한 선례.

### 5. [토큰] `text-danger-600` → `text-danger`

플랜은 안내 카피를 "`text-sm text-danger-600` **계열** 토큰"으로 지시했으나, `packages/ui-tokens`의 `semantic.danger`는 **스케일이 아니라 단일 값**이라 Tailwind 클래스가 `text-danger`다(기존 web 코드의 4개 사용처와 동일). 신규 hex 리터럴 0 — HC-2 유지.

## Deferred Issues

**안내 카피의 `30`은 리터럴이다.** `여행 기간은 최대 30일까지 정할 수 있어요…`는 UI-SPEC Copywriting Contract의 **verbatim 문구**이고 Task 2 acceptance가 이 문자열을 literal grep으로 강제한다. 상한 **소스**는 아니지만(코드는 전부 `Limits.TripDayCountMax`), `Limits.TripDayCountMax`가 30이 아닌 값으로 바뀌면 **이 카피만 조용히 거짓이 된다.** 지금은 진실이라 배포 가능. 상한을 바꾸는 변경이 생기면 이 문자열과 UI-SPEC을 함께 갱신할 것.

## Verification

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` 전 스위트 | **218 그린** (27 파일) — 191 → 218, **기존 케이스 무회귀** |
| `pnpm --filter @moajoa/web typecheck` | exit 0 |
| `pnpm --filter @moajoa/web build` | PASS — `/onboarding` 라우트 존재 (3.75 kB) |
| **SC-3:** `git diff --stat -- apps/web/components/add-content-tabs.tsx` | **빈 출력** (AddContentTabs 무수정 재사용) |
| `git diff --stat -- apps/web/components/button.tsx apps/web/components/chip.tsx` | **빈 출력** (A-4 · A-2 공유 컴포넌트 무수정) |
| **SC-6:** `git diff --stat -- apps/ios` | **빈 출력** |
| `git diff -- apps/web/__tests__/build-draft.test.ts \| grep -c '^-[^-]'` | **0** (기존 5케이스 삭제 라인 0) |
| 상한 단일 소스 | `TripDayCountMax` — build-draft 2 · step-dates 1. 리터럴 `30` 하드코딩 0(카피 제외) |
| 신규 hex 색 리터럴 | **0** (HC-2) |
| `.js` 워크스페이스 import | **0** |
| Task별 acceptance grep | 전종 통과 (`deriveDayCount`/`isDayCountWithinLimit` export=1 · `parse` 게이트=1 · `toISOString\|@moajoa/api\|getSupabaseBrowser`=0 · `max={`≥1 · 카피=1 · `ModeCard`=0 · `useState`=0 · `SelectPill`≥1 ×2 · `grid-cols-2`=1 · `4단계 중`=1 · `aria-label="뒤로"`=1 · D-22=1) |

TDD 게이트: 3사이클 전부 RED → GREEN. RED는 전부 **behavior 실패**(임포트 에러 아님).

## Success Criteria

- [x] **SC-1:** `/onboarding` 스텝이 레퍼런스 레이아웃(뒤로 chevron + N/4 카운터, 중앙 이모지, 큰 타이틀 + 서브카피, 2열 SelectPill 그리드, 하단 고정 CTA)으로 렌더된다
- [x] **SC-2:** 기간 pill 선택이 `trips.day_count`에 저장되고(테스트로 고정), 캘린더 버튼으로 정확한 날짜도 고를 수 있다(day_count 파생 동반 저장)
- [x] **SC-3:** 링크 붙여넣기·장소 검색이 기존과 동일 — `AddContentTabs` diff **0**
- [x] 긴 여행을 골라도 모아 생성이 실패하지 않는다 — 3겹 방어가 전부 INSERT 이전
- [x] 날짜를 안 정하고도 위저드 통과 (ONBOARD-04 회귀 없음)

## Known Stubs

없음 — 3개 태스크 모두 완전 구현. 시각 동일성(레퍼런스 IMG_2918~2921)의 최종 판정은 브라우저 UAT 몫이다(자동 검증은 구조·카피·토큰 레벨까지).

## Threat Flags

없음 — 신규 보안 표면 0. `T-28-14`(제출 페이로드 검증)는 `TripCreateDraftSchema.parse` 게이트 유지로, `T-28-15`(AddContentTabs 포크)는 diff 0으로, `T-28-17`(비활성 CTA 스푸핑)은 색만이 아닌 `disabled` 속성 전달로 각각 mitigate.

## Self-Check: PASSED

- 수정 파일 8종 전부 디스크에 존재
- 커밋 6종(`d4c4166` `01fae3c` `fcc277f` `7929da5` `cef7632` `769a33b`) 전부 git log에 존재
- 의도치 않은 파일 삭제 0
