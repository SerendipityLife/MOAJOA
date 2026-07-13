---
phase: 28-add-trip-redesign-ai
plan: 03
subsystem: plan-generation-contract
tags: [edge-function, zod-schema, tdd, llm-defense, d-21, d-09]
status: complete

requires:
  - "28-01 — trips.day_count (0031, 로컬·원격 적용 완료) · Limits.TripDayCountMax"
provides:
  - "PinnedPlacementSchema / PinnedPlacement (packages/core/src/schemas/plan.ts)"
  - "GeneratePlanRequestSchema.pinned_placements (.default([]) additive)"
  - "GeneratePlanRequestInput (z.input) — .default() 필드 추가가 기존 호출부를 깨지 않게 하는 타입 seam"
  - "moveToDay → is_anchor:true (수동 배치 = Day 고정 마커)"
  - "enforcePinnedPlacements(inputPlaceIds, pinned, dayCount, out) — EF claude.ts export"
  - "buildPlanPrompt(inputs.pinnedPlacements) — [N일차 고정/PINNED] 태그 + Constraints 제약"
  - "EF dayCount = trip.day_count ?? computeDayCount(start, end) (D-09)"
  - "EF itemRows.is_anchor = anchorSet ∪ pinnedSet (재생성 루프를 닫는 재기록)"
affects:
  - 28-05 (D-25 카피 '직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요' — 이제 진실이다)
  - 28-05/06 (재생성 호출부가 is_anchor 항목에서 pinned_placements를 수집해야 루프가 닫힌다)
  - 28-06 (EF 원격 배포 게이트 — Task 4 human-action이 소유)

tech-stack:
  added: []   # 신규 npm/deno 패키지 0
  patterns:
    - "사후 강제(post-hoc enforcement) — LLM 프롬프트 제약은 권유, 코드가 보장 (validatePlanIds T-18-12 idiom 미러)"
    - "신뢰 불가 입력 3단 방어 — 입력 집합 교집합 → 범위 클램프 → 제거 후 재삽입(정확히 1회)"
    - "z.input vs z.infer 분리 — .default() 필드의 additive 확장이 호출부를 깨지 않게 하는 타입 seam"
    - "Day 수는 서버가 결정 — 비용 조작 표면을 요청 바디에서 제거 (T-28-08)"
    - "빈 힌트 = 바이트 동일 프롬프트 (무회귀를 기존 테스트가 앵커)"

key-files:
  created: []
  modified:
    - packages/core/src/schemas/plan.ts
    - packages/core/src/schemas/plan.test.ts
    - packages/api/src/queries/plans.ts
    - packages/api/src/queries/plans.test.ts
    - supabase/functions/generate-plan/pipeline/claude.ts
    - supabase/functions/generate-plan/pipeline/claude.test.ts
    - supabase/functions/generate-plan/index.ts

decisions:
  - "day_count는 EF RequestSchema에 넣지 않는다 — 서버가 trips 행에서 읽는다 (T-28-08 비용 조작 차단). CONTEXT D-09의 'RequestSchema에 노출 필요'는 실측상 틀렸고, select 확장만 필요했다"
  - "GeneratePlanRequestInput(z.input) 신설 — z.infer(출력 타입)는 .default() 필드를 required로 만들어 기존 호출부 리터럴을 깬다. 동결된 iOS를 건드리지 않고 additive 확장을 성립시키는 유일한 방법"
  - "pinnedPlacements가 비면 프롬프트 블록을 통째로 생략 — 플랜 본문의 '(none) fallback' 대신 <behavior>의 '빈 배열이면 기존과 동일'을 채택 (무회귀 앵커가 더 강한 제약)"
  - "enforcePinnedPlacements는 validatePlanIds 이후 호출 — 환각 제거 → 고정 강제 순서를 뒤집으면 강제가 무효"
  - "EF is_anchor 재기록(앵커 ∪ pinned)이 D-21의 핵심 — 이 한 줄이 없으면 고정이 1회만 먹고 2회차 재생성에서 조용히 풀린다"
  - "유료 EF 스모크(Claude+Routes 실호출) 미실행 — select는 실제 로컬 Postgres 스키마로 검증, E2E는 28-06 배포 게이트가 소유"

metrics:
  duration: ~35m
  completed: 2026-07-13
  tasks: 3
  commits: 5
  files: 7
  tests: "core 192 · api 112 · web 191 · ios 128 · EF 31 — 전부 그린"
---

# Phase 28 Plan 03: pinned_placements 계약 + EF day_count fallback Summary

이 phase의 **유일한 미해결 설계물 D-21**(수동 배치 Day 고정)을 계약으로 확정하고 D-09(EF day_count fallback)를 함께 잠갔다. 핵심은 **LLM 프롬프트 제약을 보장으로 착각하지 않은 것** — 프롬프트는 권유일 뿐이고, `enforcePinnedPlacements`가 `validatePlanIds`와 같은 층위에서 사후 강제한다. 이제 28-05의 D-25 카피("직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요")가 **거짓말이 아니라 진실**이다.

## What Was Built

| 심볼 | 위치 | 소비자 |
|---|---|---|
| `PinnedPlacementSchema` / `PinnedPlacement` | `packages/core/src/schemas/plan.ts` | EF · 재생성 호출부(28-05/06) |
| `GeneratePlanRequestSchema.pinned_placements` | 동상 (`.default([])`) | `generatePlan` · EF |
| `GeneratePlanRequestInput` (`z.input`) | 동상 | `generatePlan` 시그니처 |
| `moveToDay` → `is_anchor: true` | `packages/api/src/queries/plans.ts:118` | 웹 DaySelectSheet(28-05) · iOS plan.tsx |
| `enforcePinnedPlacements(...)` | `supabase/functions/generate-plan/pipeline/claude.ts` | EF index.ts |
| `buildPlanPrompt` — `[N일차 고정/PINNED]` 태그 + 제약 | 동상 | Claude 프롬프트 |
| `dayCount = trip.day_count ?? computeDayCount(...)` | `supabase/functions/generate-plan/index.ts:204` | 라이브 N일 플랜 |

### Task 1 — core 요청 계약 + api moveToDay 앵커 전환 (D-21) — RED `1f772a3` → GREEN `c0851ea`

- `pinned_placements: z.array(PinnedPlacementSchema).default([])` — 기존 `anchor_place_ids`/`removed_place_ids`의 `.default([])` idiom 미러.
- **`day_count`는 요청 스키마에 없다 (T-28-08).** Day 수는 클라이언트가 보내는 값이 아니라 서버가 `trips` 행에서 읽는 값이다. 요청 바디로 받으면 Day 수를 부풀려 Claude·Routes 유료 호출 비용을 조작할 수 있다. **CONTEXT D-09의 "EF RequestSchema에 day_count 노출 필요"는 실측상 틀렸다** — select 확장만 필요했다. 이를 단언하는 테스트를 넣었다(스푸핑된 `day_count: 30`이 파스 결과에 남지 않음).
- `moveToDay`가 `is_anchor: false → true`. `leg_travel_seconds`는 여전히 `null`(다음 재생성 전까지 "이동시간 —").

### Task 2 — EF 프롬프트 제약 + `enforcePinnedPlacements` 사후 강제 — RED `81c66ef` → GREEN `33f96f2`

- **프롬프트(권유):** place 라인에 `[2일차 고정/PINNED]` 태그(1-based 사람 가독) + `# Constraints`에 "지정 day_index 고정, 다른 day 이동·unplaced 금지" + `place_id → day_index` 목록.
- **코드(보장):** `enforcePinnedPlacements`가 3단 방어로 강제한다 —
  1. `inputPlaceIds` 교집합만 수용 → 타 trip 장소·환각 uuid 탈락 (**T-28-09**, FK 위반 경로 소멸)
  2. `day_index`를 `[0, dayCount-1]`로 클램프 (**T-28-10**)
  3. 전 Day·풀에서 제거 후 지정 Day에 append → **정확히 1회 등장**(유실 0·중복 0)
- **빈 배열이면 블록 전체를 생략** → 프롬프트가 기존과 **바이트 동일**. 기존 프롬프트 테스트 6종이 무회귀 앵커다.
- 기존 테스트 **삭제 0** (`git diff` 검증), `routes.ts` **무접촉**.

### Task 3 — EF day_count fallback (D-09) + pinned 배선 3지점 — `4c49fe8`

- **select 확장:** `id, owner_id, start_date, end_date` → `+ day_count`.
- **fallback:** `trip.day_count ?? computeDayCount(start, end)` — 날짜가 null이면 무조건 1일이던 결함 해소. `computeDayCount` 본문은 **무수정**(뒷단으로 그대로 남는다).
- **배선 3지점:** (1) `callClaudePlan(pinnedPlacements)` 프롬프트 제약, (2) `validatePlanIds` **직후** `enforcePinnedPlacements` 사후 강제(순서를 뒤집으면 강제가 무효 — 이 결과가 Routes leg·itemRows에 쓰인다), (3) `itemRows.is_anchor = anchorSet ∪ pinnedSet`.
- **(3)이 D-21의 핵심이다.** pinned를 다시 앵커로 기록해야 **루프가 닫힌다** — 다음 재생성 때 클라이언트가 `is_anchor` 항목에서 `pinned_placements`를 다시 수집하므로 2회차·3회차에도 고정이 산다. 이 한 줄이 빠지면 고정이 **딱 한 번만 먹고 그 다음 재생성에서 조용히 풀린다.**

## ⚠ iOS 런타임 의미 변화 (파일 diff 0, 동작은 바뀜)

**HC 의무 기록.** `moveToDay`의 `is_anchor: false → true` 전환은 **동결된 iOS의 런타임 동작을 바꾼다.**

- `moveToDay`는 iOS `apps/ios/app/trip/[id]/(tabs)/plan.tsx:463`도 호출한다.
- **iOS는 웹과 달리 `setAnchor` 별표 UI를 실제로 노출한다**(Phase 18 D-10). 웹은 이 phase에서 별표 UI가 없다.
- 따라서 **iOS 사용자가 장소를 손으로 Day에 옮기면 그 장소가 별표(필수 앵커)로 승격되고**, 이후 iOS 재생성 시 `anchor_place_ids`(plan.tsx:404가 `is_anchor`로 수집)에 포함되어 "반드시 배치" 대상이 된다. **iOS의 재생성 동작이 바뀐다.**
- 이것은 **의도된 계약 통일**이다 — "손으로 옮긴 건 존중한다"가 두 플랫폼에서 같은 의미를 갖는다. iOS는 Day 고정까지는 못 받지만(`pinned_placements`를 안 보냄), "필수 배치"는 얻는다 — 기존보다 **덜 잃는** 방향이다.
- `apps/ios` **파일 diff 0** (SC-6 문자 그대로 준수), iOS 스위트 **128 그린**, iOS typecheck **exit 0**.
- 계약은 `moveToDay` doc 주석과 `PlanItemSchema.is_anchor` doc 주석에 명시했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `z.infer` 출력 타입이 additive `.default()` 확장을 막아 동결된 iOS typecheck를 깼다**

- **Found during:** Task 1 GREEN (`pnpm --filter @moajoa/ios typecheck` → `TS2345`)
- **Issue:** 플랜의 전제 — "`.default([])` idiom을 미러하므로 **기존 호출부는 전부 무변경으로 동작한다**(iOS 포함)" — 은 **런타임에선 참이지만 TS 타입 레벨에선 거짓**이었다. `GeneratePlanRequest = z.infer<...>`는 **출력(파스 후)** 타입이라 `.default()` 필드가 **required**가 된다. iOS `plan.tsx:359`는 파스된 객체가 아니라 **객체 리터럴**을 직접 넘기므로, 필드를 하나 추가하는 순간 iOS가 컴파일 실패한다. iOS는 v2.1 동결 대상이라 **고칠 수 없다**(SC-6/HC-3).
- **Fix:** core에 `GeneratePlanRequestInput = z.input<typeof GeneratePlanRequestSchema>`(pre-parse 타입)를 export하고, `generatePlan(body)`의 파라미터를 그것으로 넓혔다. **이것이 원래 옳은 타이핑이다** — 이 래퍼는 body를 파스하지 않고 EF로 그대로 넘기고, EF가 같은 스키마로 재파스하며 기본값을 채운다. 즉 body는 **pre-parse 데이터**다. 기존 `GeneratePlanRequest`(출력 타입)는 그대로 export 유지(EF 쪽 소비자용).
- **Impact:** 앞으로 `.default()` 필드를 additive로 추가해도 호출부가 깨지지 않는다 — 이 seam이 없었으면 D-21 확장이 iOS 동결과 정면충돌했다.
- **Files:** `packages/core/src/schemas/plan.ts`, `packages/api/src/queries/plans.ts`
- **Commit:** `c0851ea`

### 플랜 본문 내부 모순 해소 (판단)

**2. `buildPlanPrompt` 빈 배열 처리 — `(none)` fallback vs "추가 문자열 0"**

플랜 `<action>`은 "비어 있으면 `(none)`"이라 했지만, 같은 태스크의 `<behavior>`와 acceptance는 "**빈 배열이면 프롬프트가 기존과 동일**(무회귀 — 기존 테스트가 앵커)"을 요구한다. 두 문장은 양립 불가다. **`<behavior>`를 채택**(빈 배열 → 블록 전체 생략)했다 — 무회귀가 더 강한 제약이고, `(none)` 라인은 그 자체로 기존 프롬프트를 바꾸기 때문이다. `anchorLine`의 `(none)`은 무변경.

**3. EF 테스트 7 → 8케이스**

플랜의 7케이스에 "pinned 장소가 정확히 1회만 등장(중복·유실 0)" 불변식 케이스를 추가했다. LLM이 같은 장소를 두 Day에 넣고 풀에도 넣은 병리적 출력을 방어한다.

## Verification

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/core test` | **192 그린** (신규 5케이스) |
| `pnpm --filter @moajoa/api test` | **112 그린** (moveToDay 앵커 + leg null) |
| `pnpm --filter @moajoa/web test:run` | **191 그린** (무회귀) |
| `pnpm --filter @moajoa/ios test` | **128 그린** (**코드 diff 0인 채로**, SC-6) |
| `deno task --cwd supabase/functions/generate-plan test` | **31 그린** (기존 23 + 신규 8), exit 0 |
| `deno check` index.ts | **exit 0** |
| `pnpm --filter @moajoa/{core,api,web,ios} typecheck` | 전부 **exit 0** |
| `git diff --stat 757f566 HEAD -- apps/ios supabase/migrations` | **빈 출력** (iOS 동결 · 마이그레이션 append-only) |
| RequestSchema 블록 내 `day_count` (core / EF) | **0 / 0** (T-28-08 region-scoped grep) |
| `is_anchor: false` in plans.ts | **0** · `is_anchor: true` **1** |
| `validatePlanIds(` L204 < `enforcePinnedPlacements(` L206 | **호출 순서 계약 준수** |
| 기존 EF 테스트 삭제 라인 | **0** (무회귀 앵커 보존) · `routes.ts` diff **0** |
| `.js` 워크스페이스 import | **0** (CLAUDE.md §4.5) |

**실 스키마 검증 (로컬 Postgres):** EF의 **정확한 select**(`id, owner_id, start_date, end_date, day_count`)를 실제 `public.trips`에 대해 실행 → 파스 성공. `day_count` = `integer, nullable`, CHECK `(day_count IS NULL) OR (1..30)` 존재 확인. 즉 **select 확장은 실제 스키마에 대해 검증됐다.**

TDD 게이트: Task 1·2 모두 RED(`test(...)`) → GREEN(`feat(...)`) 커밋 쌍 존재.

## Success Criteria

- [x] SC-4(부분): 날짜 미정이어도 `day_count` 기준 Day 수로 플랜이 생성된다 (D-09) — 코드·스키마 검증 완료, 라이브 확인은 EF 배포 후
- [x] SC-5(부분): 수동 배치가 재생성을 견딘다 (D-21) — 계약 4겹(마커 → 힌트 → 프롬프트 → 사후 강제) + 재기록으로 루프 닫힘
- [x] 28-05의 D-25 카피가 배포 가능해진다 — 계약이 동작하므로 카피가 진실이 된다
- [x] SC-6: `apps/ios` 파일 diff 0 · 기존 마이그레이션 diff 0

## Threat Mitigations

| Threat ID | 상태 |
|---|---|
| T-28-08 (Tampering/DoS — Day 수 스푸핑) | **mitigated** — core·EF **양쪽** RequestSchema에 Day 수 필드 0건(region-scoped grep). 서버가 `trips` 행에서 읽고 0031 CHECK(1..30)가 DB 레벨 상한 강제. 스푸핑 시도가 파스 결과에 남지 않음을 단언하는 테스트 존재 |
| T-28-09 (Tampering — 타 trip/환각 place_id 주입) | **mitigated** — `enforcePinnedPlacements`가 `inputPlaceIds`(해당 trip의 placeable 집합) 교집합만 수용. 전용 테스트 존재 |
| T-28-10 (Tampering — day_index 범위 밖) | **mitigated** — `[0, dayCount-1]` 클램프(음수→0, 초과→마지막 Day). 전용 테스트 존재 |
| T-28-11 (EoP — EF 호출 권한) | accepted (무변경) — 기존 `can_edit_trip` 서버 재검증(T-18-09)이 게이트. `pinned_placements`는 사용자가 이미 `moveToDay`로 할 수 있는 일의 힌트일 뿐 — 신규 권한 상승 표면 0 |
| T-28-12 (DoS 비용 — 생성 연타) | **미해결 (28-05/06 소유)** — UI 단일 boolean 가드가 주 방어. 이 플랜은 EF 측만 다룸(멱등 덮어쓰기라 데이터 정합은 안전, 비용은 중복) |
| T-28-13 (Injection — 프롬프트) | accepted (무변경) — LLM 출력이 `validatePlanIds` uuid 교집합을 통과하지 못하면 DB에 도달 불가 |

## Known Stubs

없음. 계약 4겹이 전부 코드로 완결됐다.

**단, 루프를 닫는 마지막 배선은 이 플랜의 범위 밖이다:** EF는 `pinned_placements`를 **받아서** 강제하고 `is_anchor`로 재기록하지만, **클라이언트가 `is_anchor` 항목에서 `{place_id, day_index}`를 수집해 실제로 보내는 코드는 28-05/06이 소유한다.** 그때까지 웹 재생성은 `pinned_placements: []`로 호출되어 고정이 동작하지 않는다(무회귀 — 기존과 동일 동작). D-25 카피는 **그 배선이 붙은 뒤에** 노출해야 한다.

## Pending — EF 원격 배포 (28-06 Task 4 소유)

⚠ 이 플랜의 EF 변경(day_count fallback · pinned 강제)은 **코드 머지만으로 프로덕션에 반영되지 않는다.** `supabase functions deploy generate-plan`이 필요하며, 이는 **28-06 Task 4의 human-action 게이트**가 소유한다(환경 지침에 따라 이 플랜은 배포를 실행하지 않았다).

배포 전까지 프로덕션 EF는 **여전히 날짜 미정 모아를 1일 플랜으로 만든다.** 유닛 테스트·타입체크는 배포 없이도 전부 통과하므로 이 상태를 놓치면 phase 전체가 false-positive 검증이 된다.

**미실행 검증 (의도적):** 유료 EF 스모크(로컬 `functions serve` + 실제 Claude·Routes 호출로 `day_count: 3` 응답 확인). 로컬 DB에 trip 행이 0개라 user+trip+places 픽스처를 조작해야 하고 유료 API를 실호출한다. 대신 **EF의 정확한 select를 실제 로컬 Postgres 스키마에 대해 검증**했고(위 Verification), 나머지(`??` fallback·`enforcePinnedPlacements`)는 순수 로직으로 유닛 커버됐다. E2E는 28-06 배포 게이트에서 확인할 것.

## Self-Check: PASSED

- 수정 파일 7종 전부 디스크에 존재
- 커밋 5종(`1f772a3` `c0851ea` `81c66ef` `33f96f2` `4c49fe8`) 전부 git log에 존재
- 의도치 않은 파일 삭제 0 · `apps/ios`·`supabase/migrations` diff 0
