---
phase: 20-affiliate-booking
plan: "02"
subsystem: database
tags: [migration, rls, booking, checklist, supabase, postgres]
requires:
  - "0016: can_read_trip/can_edit_trip SECURITY DEFINER helpers + set_updated_at + booking_clicks baseline (L582-606)"
  - "0017: partial-unique + policy + trigger idioms (plans_one_draft_per_trip)"
  - "20-03: ChecklistItemSchema enum values (kind/status/source — locked character-for-character)"
  - "17-02: ClickTokenSchema regex ^c_[0-9A-Za-z]{8,30}$"
provides:
  - "live DB: booking_checklist_items table (RLS 4 policies via can_read/can_edit_trip, D-12 member-wide)"
  - "live DB: booking_clicks click_token + checklist_item_id columns + member INSERT/SELECT policies (D-11)"
  - "database.ts: booking_checklist_items Row/Insert/Update + booking_clicks token columns + checklist FK"
  - "schema_migrations '0021' recorded — future `supabase db push` skips it"
affects:
  - "20-04 (api reconcileChecklist/logBookingClick INSERT paths now work without 42501/42P01)"
  - "20-05..07 (iOS cards/checklist read-write against these tables)"
tech-stack:
  added: []
  patterns:
    - "trip-scoped checklist with NO plan FK — draft overwrite survives checked rows (D-13, Pitfall 3)"
    - "helper-direct RLS on trip_id-carrying table (no EXISTS at all — 42P17 guard)"
    - "additive booking_clicks alter: 0016 original untouched, new policies coexist permissively"
key-files:
  created:
    - supabase/migrations/0021_booking.sql
  modified:
    - packages/api/src/types/database.ts
decisions:
  - "schema_migrations '0021' row inserted with (version,name,statements) shape — verified live shape before write"
  - "database.ts manually derived (gen types --db-url requires container runtime; Docker absent on this machine) — reconcile with real `pnpm supabase:types` on next Mac session"
  - "live apply + RLS matrix executed by orchestrator under explicit user approval after this session's permission classifier blocked direct production DDL"
metrics:
  duration: ~40m (2 blocking checkpoints included)
  completed: 2026-07-02
status: complete
---

# Phase 20 Plan 02: Booking Migration (0021) + Live Apply Summary

**One-liner:** 0021_booking.sql — trip-scoped booking_checklist_items (no plan FK, D-13-safe) + booking_clicks click_token/checklist_item_id + member INSERT/SELECT policies — applied to the live cloud DB in one transaction with the RLS matrix (A–F) proving T-20-02/03/05.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | 0021_booking.sql 작성 (append-only) | e8618c5 |
| 2 | [BLOCKING] 라이브 DB 접속 자격 제공 | (gate — no files; user provided Session pooler string, path 1) |
| 3 | 라이브 적용 + database.ts 재생성 + RLS 매트릭스 | cebe0e9 |

## What was built

### 0021_booking.sql (Task 1, e8618c5)
- **booking_checklist_items**: id/trip_id(FK trips cascade)/place_id(FK places set-null, nullable)/kind/title(1..80)/status(default 'todo')/source(default 'auto')/timestamps. CHECK enums locked character-for-character to 20-03 `ChecklistItemSchema` (`stay|esim|transport|activity|custom`, `todo|clicked|done`, `auto|manual`).
- **No FK to plans/plan_items under any name** — generate-plan's draft delete→insert would destroy checked rows every regeneration (D-13 violation, RESEARCH Pitfall 3). Reference is trip_id + place_id only.
- Indexes: `checklist_trip_idx` + partial uniques `checklist_singleton_uq (trip_id,kind) where source='auto' and kind in ('stay','esim','transport')` / `checklist_place_uq (trip_id,place_id) where source='auto' and place_id is not null` (plans_one_draft_per_trip idiom).
- Trigger `booking_checklist_items_set_updated_at` reuses 0016 `set_updated_at()` (create function count 0).
- RLS: 4 policies calling `can_read_trip`/`can_edit_trip` DEFINER helpers **directly** (table carries trip_id — zero EXISTS, 42P17 guard). D-12: member-wide, no representative-only gate.
- **booking_clicks alter** (0016 original untouched): `click_token text CHECK (~ '^c_[0-9A-Za-z]{8,30}$')` NULLABLE + `checklist_item_id uuid FK set-null` + partial index; policies `"booking_clicks: member can insert own"` (`user_id = auth.uid() and can_read_trip(trip_id)`, T-20-02) + `"booking_clicks: member can read"` (`can_read_trip(trip_id)`, D-11/D-12 — coexists with 0016 owner-read).
- Structural gates all PASS: create policy 6 · plan_id/plan_item_id 0 · exists 0 · create function 0 · anon 0 · 0016–0018 git diff empty (append-only).

### Live apply (Task 3, orchestrator-executed under explicit user approval)
- Pre-checks: schema_migrations shape (version,name,statements) confirmed; existing versions 0016–0020; `booking_checklist_items` absent; then **single transaction**: full 0021 + history row '0021'.
- Post-apply structural verify: checklist_policies=4, clicks_policies=3 (owner-read + 2 new), rls_enabled=true, new_cols=2, checklist_indexes=4 (pkey + trip + 2 partial uniques), triggers=1.

### database.ts (Task 3, cebe0e9)
- `booking_checklist_items` Row/Insert/Update + places/trips FK Relationships; `booking_clicks` gains `click_token: string | null` + `checklist_item_id: string | null` + checklist FK Relationship.
- 64 insertions, 0 deletions — booking-only diff (verification "무관 테이블 diff 0" PASS).
- Gates: `grep -c booking_checklist_items` = 4 (≥3) · `grep -c click_token` = 3 (≥3) · `pnpm --filter @moajoa/api typecheck` exit 0 · `git grep pooler.supabase -- ':!*.md'` = 0.

## RLS Matrix (A–F, all PASS — BEGIN…ROLLBACK single transaction, live data untouched)

| Case | Assertion | Result |
|------|-----------|--------|
| A | 멤버가 자기 user_id로 booking_clicks INSERT | PASS — insert succeeds |
| B | 멤버가 **타인 user_id**로 INSERT (T-20-02 spoofing) | PASS — 42501 denied |
| C | 비멤버 authenticated INSERT | PASS — 42501 denied |
| D | 멤버 SELECT = 1행 / 비멤버 SELECT = 0행 (T-20-03) | PASS |
| E | 멤버 checklist INSERT/UPDATE/DELETE 성공 + 비멤버 INSERT 42501 (D-12, T-20-05) | PASS |
| F | click_token CHECK: 'bad.token' → 23514 / 'c_aB3xY9zQ' → 통과 | PASS |

42P17 recursion: 0건. Final ROLLBACK — no live data pollution. Threat register mitigations T-20-02/03/05/07 empirically verified; T-20-08 (pooler string) honored — string appears in no file/commit (grep gate 0), scratchpad scripts deleted after use.

## Deviations from Plan

### Auto-fixed / adapted

**1. [Rule 3 - Blocking] `supabase gen types --db-url` 불가 → database.ts 수동 유도**
- **Found during:** Task 3
- **Issue:** CLI `gen types --db-url`이 내부적으로 postgres-meta 컨테이너를 요구 — 이 머신은 Docker/podman 부재라 실행 불가.
- **Fix:** 기존 gen-types 관례(알파벳순 컬럼, `{table}_{column}_fkey` 명명, CHECK 텍스트 컬럼 = plain string)를 정확히 미러해 수동 유도. 64 insertions/0 deletions, api typecheck exit 0.
- **Follow-up:** 다음 Mac 세션에서 `pnpm supabase:types` 정식 재생성으로 화해 권장 (diff 0 기대).
- **Commit:** cebe0e9

**2. [Rule 3 - Blocking] `pg` 패키지 repo 부재 → 스크래치패드 one-off 설치**
- **Found during:** Task 3 준비
- **Issue:** `pg`가 워크스페이스 의존성이 아님.
- **Fix:** 세션 스크래치패드(임시 디렉토리)에 `npm i pg` — repo package.json/lockfile 무변경. 작업 후 스크립트 삭제.

### Authentication/permission gates (normal flow)

- **Task 2 (planned gate):** Session pooler connection string은 사용자만 보유 — 체크포인트 반환, 사용자가 경로 1(문자열 제공) 선택.
- **Task 3 (unplanned gate):** 세션 권한 시스템(auto mode classifier)이 프로덕션 DDL 직접 실행을 거부(코디네이터 경유 자격은 직접 사용자 의사로 불인정) → 체크포인트 반환 → **사용자 명시 승인 하에 orchestrator가 적용 + RLS 매트릭스 실행**, 결과(증거 포함)를 이 세션이 검증·기록.

## Known Stubs

None — this plan is DDL + types only; no UI/data-wiring surface.

## Threat Flags

None — all security surface introduced (booking_clicks INSERT path, checklist CRUD, pooler credential handling) was already in the plan's threat model (T-20-02/03/05/07/08) and each mitigation is verified above.

## Verification vs must_haves

- ✅ 라이브 DB에 booking_checklist_items 존재 + RLS가 can_read/can_edit_trip 헬퍼로 게이트 (post-apply: 4 policies, rls_enabled=true; matrix E)
- ✅ booking_clicks authenticated INSERT(user_id=auth.uid() AND can_read_trip) + 멤버 SELECT — 42501 없이 기록 (matrix A/D)
- ✅ database.ts에 booking_checklist_items Row/Insert/Update + booking_clicks.click_token 존재 (grep 4/3, typecheck 0)
- ✅ key_links: 0021 정책 → 0016 헬퍼 직호출 (EXISTS 0) · checklist_item_id nullable FK · 20-03 enum ↔ CHECK 완전 일치

## Self-Check: PASSED

- supabase/migrations/0021_booking.sql: FOUND
- packages/api/src/types/database.ts: FOUND
- commit e8618c5: FOUND
- commit cebe0e9: FOUND
