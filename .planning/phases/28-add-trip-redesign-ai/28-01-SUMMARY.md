---
phase: 28-add-trip-redesign-ai
plan: 01
subsystem: schema-day-count
tags: [migration, zod-schema, typegen, tdd, blocking-human]
status: complete

requires: []
provides:
  - "trips.day_count (int nullable, CHECK 1..30) — supabase/migrations/0031_trip_day_count.sql"
  - "Limits.TripDayCountMax = 30 (상한 단일 소스, packages/core/src/constants.ts)"
  - "TripSchema.day_count (required-nullable)"
  - "TripCreateDraftSchema.day_count (.default(null))"
  - "TripUpdateSchema pick += day_count"
  - "createMoaDraft INSERT += day_count"
  - "updateTrip 조건부 passthrough += day_count"
  - "packages/api/src/types/database.ts — day_count 반영 typegen 산출물"
affects:
  - 28-03 (generate-plan EF fallback이 trip.day_count를 computeDayCount보다 우선 소비)
  - 28-04 (위저드 기간 pill → build-draft가 TripCreateDraft.day_count에 실음, 캘린더 max = Limits.TripDayCountMax)
  - 28-05 (D-13 기간 게이트가 updateTrip(day_count)로 저장)
  - 28-06 (Day 수 기반 번호 핀)

tech-stack:
  added: []   # 신규 npm 패키지 0
  patterns:
    - "SQL 컬럼 ↔ core Zod 짝지어 변경 (CLAUDE.md §4.2)"
    - "required-nullable 필드 (share_mode/companion 선례) — 키 누락은 throw, null은 통과"
    - "상한 단일 소스 + 주석 결속 — SQL은 상수 import 불가라 헤더 주석이 유일한 결속 장치"
    - "additive nullable 컬럼 + CHECK — 레거시 행 무회귀 (0025 analog)"
    - "신규 RLS 0 — 기존 0016 owner-full-access UPDATE 정책 승계"

key-files:
  created:
    - supabase/migrations/0031_trip_day_count.sql
  modified:
    - packages/core/src/constants.ts
    - packages/core/src/schemas/trip.ts
    - packages/core/src/schemas/trip.test.ts
    - packages/api/src/queries/trips.ts
    - packages/api/src/queries/trips.test.ts
    - packages/api/src/types/database.ts
    - apps/web/__tests__/moa-island.test.tsx
    - apps/web/__tests__/guest-mocks.ts
    - apps/web/__tests__/share-sheet.test.tsx

decisions:
  - "마이그레이션 번호는 0031 (CONTEXT D-08·ROADMAP의 '0030' 리터럴은 stale — 0030_poll_write_hardening이 점유)"
  - "상한 30은 Limits.TripDayCountMax 한 곳에서만 정의 — Zod는 상수 import, SQL CHECK는 헤더 주석으로 결속"
  - "TripSchema는 required-nullable / TripCreateDraftSchema는 .default(null) — 기존 build-draft 호출부 무회귀"
  - "updateTrip은 `!== undefined` 검사 — null(기간 미정으로 되돌리기)이 정상 통과해야 하므로 truthy 검사 불가"
  - "신규 RLS·RPC 0 — editor 멤버에게 trips UPDATE를 여는 것은 phase 범위 밖 (보안 표면 확대 금지, T-28-01)"
  - "원격 db push는 사용자 몫 (24-01·25-01 선례) — 자동 모드는 프로덕션 배포를 실행하지 않는다"

metrics:
  duration: ~35m
  completed: 2026-07-13
  tasks: 3
  commits: 5
  files: 10
  tests: "core 187 · api 111 · web 191 · ios 128 — 전부 그린"
---

# Phase 28 Plan 01: trips.day_count 5레이어 seam Summary

`trips.day_count` 한 컬럼이 관통하는 5개 레이어(SQL → core Zod → api 래퍼 → typegen → 원격 DB)를 원자적으로 잠갔다. Phase 18 AI 엔진의 유일한 결함("날짜가 null이면 무조건 1일 플랜")을 컬럼 하나로 고치는 D-08의 백엔드 seam이며, 28-03/04/05/06이 전부 이 위에 얹힌다. **로컬은 전부 그린 · 원격 적용만 사용자 대기.**

## What Was Built

| 심볼 | 위치 | 소비자 |
|---|---|---|
| `Limits.TripDayCountMax` (= 30) | `packages/core/src/constants.ts` | core Zod · 캘린더 max(28-04) |
| `trips.day_count` (int nullable, CHECK 1..30) | `supabase/migrations/0031_trip_day_count.sql` | EF select(28-03) · api |
| `TripSchema.day_count` | `packages/core/src/schemas/trip.ts:30` | `Trip` 타입 전 소비자 |
| `TripCreateDraftSchema.day_count` | 동상 L70 (`.default(null)`) | `build-draft.ts`(28-04) |
| `TripUpdateSchema` pick += `day_count` | 동상 L87 | `updateTrip` |
| `createMoaDraft` INSERT += `day_count` | `packages/api/src/queries/trips.ts:124` | 위저드 제출(28-04) |
| `updateTrip` 조건부 passthrough | 동상 L158 | D-13 기간 게이트(28-05/06) |

### Task 1 — 0031 + 상한 상수 + core 스키마 짝지어 변경 (D-08) — RED `e3b35ab` → GREEN `4b40e0a`

- **번호는 0031** — `0030_poll_write_hardening.sql`(Phase 25 gap closure)이 0030을 이미 점유했다. CONTEXT D-08 / ROADMAP locked decision 5의 "0030" 리터럴은 **stale**이며, append-only 의도만 승계해 0031로 확정했다.
- `alter table trips add column day_count int check (day_count is null or (day_count between 1 and 30))` — additive nullable이라 레거시 모아는 전부 null로 안전(0025 share_mode/companion analog).
- **신규 RLS·트리거·함수 0** — 기존 0016 `"trips: owner full access"` UPDATE 정책을 그대로 승계(T-28-01). editor 멤버는 day_count 쓰기 불가.
- **상한 30 결속 (BLOCKER 수습):** `Limits.TripDayCountMax`가 **유일한 정의처**. Zod는 상수를 import(`z.number().int().min(1).max(Limits.TripDayCountMax).nullable()`)하고, SQL은 상수를 import할 수 없으므로 0031 헤더 주석이 결속 장치다. 세 숫자(constants · CHECK · 캘린더 max)가 어긋나면 **정상 입력(장기 여행)이 Zod를 통과해 INSERT까지 갔다가 DB CHECK에서 거부**되어 모아 생성이 통째로 실패한다 — 방어가 기능을 깨는 버그로 변한다. 스키마 리터럴 `30` 하드코딩 **0**.
- `TripSchema`는 **required-nullable**(share_mode 선례 — 키 누락 시 throw), `TripCreateDraftSchema`는 `.default(null)`로 기존 `build-draft` 호출부 무회귀. 기존 refine 2개(start/end 동시 null · end>=start)는 **무수정** — day_count는 refine 대상이 아니다.
- web `makeTrip` 팩토리 3곳(`moa-island.test.tsx` · `guest-mocks.ts` · `share-sheet.test.tsx`)에 `day_count: null` 추가 — `Trip`이 required가 되며 생긴 orphan 수습(CLAUDE.md §3.3, 플랜이 예상한 범위). **iOS는 diff 0**: `Trip`을 파라미터 타입 또는 `as unknown as Trip` 이중 캐스트로만 쓰므로 파급 없음(확인됨, SC-6).

### Task 2 — api trips.ts INSERT + passthrough (D-08) — RED `3f0162b` → GREEN `d396933`

- `createMoaDraft`: `.insert({...})`에 `day_count: input.day_count` 추가 (null도 키로 실림 — 누락 아님).
- `updateTrip`: `...(patch.day_count !== undefined && { day_count: patch.day_count })` — **`undefined` 검사여야** `null`(기간 미정으로 되돌리기)이 정상 통과한다. truthy 검사면 0/null이 조용히 누락된다.
- 다른 함수(`createTrip`·`shareTrip`·`shareMoa`·`getTrip`·`listMyTripsWithPreview`) diff **0**. 삭제 라인 **0**(순수 additive).
- doc 주석에 쓰기 게이트 명시: `updateTrip(day_count)`는 owner 전용 RLS이며 editor 멤버는 **조용히 0행 갱신**된다 → D-13 게이트 UI는 owner에게만(UI-SPEC A-9, 심층방어 2겹).

### Task 3 — 로컬 적용 + typegen (BLOCKING checkpoint) — `757f566`

- 로컬 supabase 스택(colima/docker) 기동 → 0016..0031 적용. `supabase migration list` **0031 포함** 확인.
- `pnpm supabase:types` 재생성 → `packages/api/src/types/database.ts`의 trips **Row/Insert/Update 3곳**에 `day_count: number | null`. **수기 편집 0** (typegen 산출물).
- **원격 `supabase db push`는 미실행** — 프로덕션 배포는 사용자 몫(24-01·25-01 선례). 아래 체크포인트 참조.

## Deviations from Plan

**None — plan 원안 그대로 실행.** Rule 1~3 auto-fix 발동 0건.

기록해 둘 환경 항목(deviation 아님): `apps/web`의 `test` 스크립트는 **watch 모드**(`vitest`)라 CI 검증에는 `test:run`(`vitest run --passWithNoTests`)을 써야 한다. 플랜 verification의 `pnpm --filter @moajoa/web test`를 그대로 돌리면 무한 대기한다.

## Verification

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/core test` | **187 그린** (11 파일, day_count 신규 케이스 포함 — 31 이상 거부 필수 케이스 포함) |
| `pnpm --filter @moajoa/api test` | **111 그린** (9 파일, day_count 신규 4케이스 포함) |
| `pnpm --filter @moajoa/web test:run` | **191 그린** (27 파일 — 픽스처 3곳 무회귀) |
| `pnpm --filter @moajoa/ios test` | **128 그린** (18 스위트 — core 변경의 iOS 무회귀, **코드 diff 0인 채로**) |
| `pnpm --filter @moajoa/{core,api,web} typecheck` | 전부 **exit 0** |
| `git diff --stat -- apps/ios` | **빈 출력** (SC-6) |
| `git diff --stat -- supabase/migrations/0016..0030` | **빈 출력** (append-only, T-28-03) |
| `grep -c 'TripDayCountMax'` constants / 0031 / trip.ts | 1 / 2 / 3 — 단일 소스 + SQL·Zod 양쪽 결속 |
| 리터럴 `30` 하드코딩 (trip.ts) | **0** (주석 1건뿐) |
| `grep -Ec 'create policy\|alter policy\|create function\|create trigger' 0031` | **0** (신규 RLS·함수 0) |
| `.js` 워크스페이스 import (packages/api/src) | **0** (CLAUDE.md §4.5) |
| `supabase migration list` Local | **0031 포함** |

TDD 게이트: Task 1·2 모두 RED(`test(...)`) → GREEN(`feat(...)`) 커밋 쌍 존재.

## Success Criteria

- [x] SC-2(부분): `trips.day_count` 컬럼이 존재하고 core·api가 그 값을 읽고 쓴다 — **로컬 검증 완료, 원격 적용 대기**
- [x] SC-6: `apps/ios` diff 0 · 기존 마이그레이션 diff 0
- [x] 하위 플랜(28-03/04/05/06)이 import할 계약(`TripCreateDraft.day_count` · `updateTrip`)이 잠겼다

## Threat Mitigations

| Threat ID | 상태 |
|---|---|
| T-28-01 (EoP — updateTrip) | **mitigated** — 신규 RLS 0, 0016 owner-only 승계. 게이트 UI owner 전용은 28-05 몫 |
| T-28-02 (DoS 비용 — 큰 day_count) | **mitigated** — 0031 CHECK `between 1 and 30` DB 레벨 강제 + Zod 상한(같은 상수) |
| T-28-03 (Tampering — 기존 마이그레이션) | **mitigated** — `git diff --stat` 빈 출력 확인 |
| T-28-04 (Info Disclosure — typegen) | accepted — 스키마 형태만, 비밀값 0 |

## Known Stubs

없음. 5레이어 중 4개(SQL 파일 · core · api · typegen)가 완결됐고, 남은 1개는 **원격 DB 적용**뿐이다 — 이건 코드가 아니라 사람의 배포 행위다.

## Pending — 원격 적용 (BLOCKING human-action)

⚠ 원격 적용 전에는 **프로덕션에서 기간 pill 저장·N일 일정 생성이 동작하지 않는다.** 빌드·타입체크·유닛테스트는 컬럼 없이도 전부 통과하므로(타입이 로컬 config에서 나옴) 이 상태를 놓치면 phase 전체가 false-positive 검증이 된다.

사용자 실행: `supabase db push` (옵션 A) 또는 `git push origin main`으로 Supabase↔GitHub 통합 자동 적용(옵션 B, 0028·0029 실증 경로).
확인: `supabase migration list`의 **Remote 컬럼에 0031** 표시.

## Self-Check: PASSED

- 생성/수정 파일 10종 전부 디스크에 존재 (`0031_trip_day_count.sql` 포함)
- 커밋 5종(`e3b35ab` `4b40e0a` `3f0162b` `d396933` `757f566`) 전부 git log에 존재
- 의도치 않은 파일 삭제 0
