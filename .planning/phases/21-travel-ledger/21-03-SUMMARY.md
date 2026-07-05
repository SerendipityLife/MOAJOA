---
phase: 21-travel-ledger
plan: 03
subsystem: "@moajoa/api"
status: complete
tags: [ledger, forwarding, query-layer, tdd, rls]
requires:
  - "21-01: 0022 migration applied + database.ts regenerated (ledger_entries + forwarding_addresses Row/Insert/Update)"
  - "21-02: @moajoa/core ledger contract (LedgerEntry, LedgerStatus, FxSource)"
provides:
  - "listLedger / listUnassignedLedger / listNeedsReview / assignTripToEntry / updateLedgerEntry / deleteLedgerEntry"
  - "getOrCreateForwardingAddress"
affects:
  - "21-05 (iOS): consumes ledger + forwarding queries via @moajoa/api barrel"
tech-stack:
  added: []
  patterns:
    - "bookings.ts house contract: (client, ...) => Promise<T>, const {data,error}=...; if (error) throw error"
    - "RLS-only authorization (0022) — no redundant client-side ownership check (T-21-09)"
    - "derivation stays in EF/core — api layer is CRUD only (T-21-10)"
    - "makeChain/makeClient vitest harness mirrored from bookings.test.ts (+auth.getUser mock)"
key-files:
  created:
    - "packages/api/src/queries/ledger.ts"
    - "packages/api/src/queries/forwarding.ts"
    - "packages/api/src/queries/ledger.test.ts"
  modified:
    - "packages/api/src/queries/index.ts"
decisions:
  - "getOrCreateForwardingAddress supplies user_id from client.auth.getUser() to satisfy the 0022 insert WITH CHECK — the table has no user_id default and RLS still enforces the match, so this is a required column value, not a redundant ownership check."
  - "listNeedsReview scopes by both trip_id and status='needs_review' (it receives tripId) — a trip's review inbox, not a global scan."
  - "updateLedgerEntry takes Partial<LedgerEntry> and mirrors it verbatim — no amount_krw / FX re-derivation here (EF/core owns it)."
metrics:
  duration: "~5m"
  completed: "2026-07-05"
  tasks: 2
  files: 4
---

# Phase 21 Plan 03: @moajoa/api Ledger + Forwarding Query Layer Summary

타입드 ledger·forwarding 쿼리 계층을 `@moajoa/api`에 신설 — bookings.ts house 계약(client-first `{error}` throw, 순수 CRUD, 파생 로직 0)을 미러해 가계부 조회/배정/수정/삭제 + 전달주소 발급 래퍼를 TDD(RED→GREEN)로 구현. iOS(21-05)가 raw supabase 호출 대신 소비.

## What Was Built

- **`ledger.ts`** — 6개 쿼리, 전부 `(client, ...) => Promise<T>` house 계약:
  - `listLedger(client, tripId)` → `.eq('trip_id',tripId).order('paid_at',{ascending:false})`
  - `listUnassignedLedger(client)` → `.is('trip_id',null).order('created_at')` (미분류 인박스 — RLS가 owner-only 보장)
  - `listNeedsReview(client, tripId)` → `.eq('trip_id',tripId).eq('status','needs_review')`
  - `assignTripToEntry(client, entryId, tripId)` → `.update({trip_id}).eq('id',entryId).select('*').single()` (1탭 배정, D-05)
  - `updateLedgerEntry(client, entryId, patch)` → `.update(patch)...single()` (needs_review 수정)
  - `deleteLedgerEntry(client, entryId)` → `.delete().eq('id',entryId)` (owner-only via 0022 RLS)
- **`forwarding.ts`** — `getOrCreateForwardingAddress(client): Promise<{token:string}>`. 기존 행 있으면 `.select('token').maybeSingle()` 반환; 없으면 `auth.getUser()`로 user_id 확보 → `.insert({user_id}).select('token').single()` (0022 트리거가 token 생성).
- **`index.ts`** 배럴에 `export * from './ledger'` + `export * from './forwarding'` (`.js` extension 없음, Turbopack 호환).
- **`ledger.test.ts`** — bookings.test.ts makeChain/makeClient 하네스 복사(+ `auth.getUser` mock). 함수별 테이블/필터/payload 단언 + `{error}→rejects` 페어. forwarding은 read-path/create-path/error 3케이스.

## How It Works

- **관심사 분리:** api는 CRUD·diff만. 환율(Frankfurter)·파싱·`amount_krw` 파생은 parse-email EF와 `@moajoa/core`(`deriveAmountKrw`) 소유. `LedgerEntry` 타입은 `@moajoa/core`에서 import — 재선언 없음.
- **RLS-only 인가:** 0022 정책이 게이트 — SELECT는 `trip_id` NULL 분기(owner-private) vs `can_read_trip` DEFINER 헬퍼(trip-shared), write는 `owner_user_id=auth.uid()`. 쿼리 래퍼에 redundant 클라 소유권 체크 0 (T-21-09).
- **forwarding user_id:** 테이블에 user_id default 없음 + RLS `with check (user_id=auth.uid())`. 클라가 `auth.getUser()`로 user_id를 채워 insert — RLS가 여전히 일치를 강제하므로 spoof는 thrown 42501로 표면화. 트리거가 token 생성.

## Verification

- `pnpm --filter @moajoa/api test` → 74 passed (ledger 15/15 포함), 무회귀.
- `pnpm --filter @moajoa/api typecheck` → exit 0.
- Grep 게이트: `export * from './ledger'`==1, `export * from './forwarding'`==1, `amount_krw.*=|fx_rate.*\*|frankfurter` in ledger.ts ==0 (파생 로직 api 금지, T-21-10).
- TDD gate: `test(21-03)` RED 커밋(8f2c0c9) → `feat(21-03)` GREEN 커밋(7be789a) 순서 준수.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] needs_review patch 리터럴 status 타입 확장**
- **Found during:** Task 2 (typecheck)
- **Issue:** 테스트의 `updateLedgerEntry` patch 리터럴 `{ ..., status: 'ready' }`에서 `status`가 `string`으로 넓어져 `Partial<LedgerEntry>`(enum)에 비할당 — TS2345.
- **Fix:** `status: 'ready' as const`로 리터럴 좁힘 (테스트 측만).
- **Files modified:** packages/api/src/queries/ledger.test.ts
- **Commit:** 7be789a

### Planner-judgment resolutions (플랜이 명시 위임한 결정)

- Plan Task 2가 `.insert({})`로 표기했으나 0022 `forwarding_addresses.user_id`는 NOT NULL + default 없음 → `.insert({user_id})` 필수. `client.auth.getUser()`로 user_id 확보(플랜 "user_id는 클라가 auth.uid()로 채움" 지시 정합). 테스트 하네스에 `auth.getUser` mock 추가.
- `listNeedsReview`는 tripId를 받으므로 `trip_id` + `status` 둘 다 필터(트립별 리뷰 인박스).

## Known Stubs

None.

## Threat Flags

None — 새 보안 표면 없음. 모든 인가는 기존 0022 RLS 정책이 게이트, api 래퍼는 순수 CRUD.

## Self-Check: PASSED

- packages/api/src/queries/ledger.ts — FOUND
- packages/api/src/queries/forwarding.ts — FOUND
- packages/api/src/queries/ledger.test.ts — FOUND
- commit 8f2c0c9 (RED) — FOUND
- commit 7be789a (GREEN) — FOUND
