---
phase: 21-travel-ledger
plan: 02
subsystem: core

# Dependency graph
requires:
  - phase: 21-01
    provides: 0022_ledger.sql (ledger_entries + forwarding_addresses tables, status/fx_source CHECK constraints, regenerated database.ts)
provides:
  - "@moajoa/core ledger 도메인 계약: LedgerStatus/FxSource const-enum (0022 CHECK 문자 단위 일치)"
  - "LedgerEntrySchema — 5요소 FX 원자저장 + trip_id nullable + status enum (0022 컬럼 정합)"
  - "LedgerParseOutputSchema — LLM 파싱출력 정본 (parse-email EF가 로컬 재선언할 계약)"
  - "deriveAmountKrw/needsReview 순수함수 (KRW=파생, 원천 아님)"
affects: [21-03 api ledger queries, 21-04 parse-email EF pipeline, 21-05 iOS ledger screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "const-enum + z.enum(constArray) 2쌍을 스키마 파일 내부에 배치 (checklist.ts idiom, constants.ts 미사용)"
    - "5요소 FX 원자저장 + 파생값(amount_krw) 순수함수 분리 (원천/표시값 구조적 분리, Pitfall 4)"
    - "LLM 출력 스키마를 core에 정본화 → 소비 EF가 로컬 재선언 (drift 방지 seam)"

key-files:
  created:
    - packages/core/src/schemas/ledger.ts
    - packages/core/src/schemas/ledger.test.ts
  modified:
    - packages/core/src/schemas/index.ts

key-decisions:
  - "ledger enum을 constants.ts append가 아닌 ledger.ts 내부에 배치 (checklist.ts 선례 — 도메인 스키마와 enum 동거)"
  - "src/index.ts는 미수정 — ledger는 schemas/index barrel을 통해 전이 노출 (checklist는 root라 직접 export였던 것과 대비)"
  - "amount_krw를 스키마 필드로는 nullable 저장하되 파생 진실은 deriveAmountKrw 순수함수로 강제 (원천은 5요소)"

patterns-established:
  - "const-enum 값을 SQL CHECK 제약과 문자/순서 단위로 락하고 테스트로 .toEqual 대조"
  - "LLM 파싱출력을 core 스키마로 정본화하여 EF/api/iOS drift를 컴파일타임에 봉쇄"

requirements-completed: [LEDGER-02, LEDGER-03, LEDGER-06]

coverage:
  - id: D1
    description: "LedgerStatus(5)/FxSource(3) const-enum이 0022 CHECK 값과 문자·순서 단위로 일치"
    requirement: "LEDGER-03"
    verification:
      - kind: unit
        ref: "packages/core/src/schemas/ledger.test.ts#Ledger enums — locked to 0022 CHECK constraints"
        status: pass
    human_judgment: false
  - id: D2
    description: "LedgerEntrySchema가 5요소 FX + trip_id nullable + status enum을 검증 (0022 컬럼 정합, bad status/fx_source/card_last4/currency reject)"
    requirement: "LEDGER-02"
    verification:
      - kind: unit
        ref: "packages/core/src/schemas/ledger.test.ts#LedgerEntrySchema — ledger row (0022, 5-element FX record)"
        status: pass
    human_judgment: false
  - id: D3
    description: "LedgerParseOutputSchema가 LLM 결제정보 추출 출력을 검증 (confidence enum, card_last4 regex, matched_trip_id uuid reject)"
    requirement: "LEDGER-06"
    verification:
      - kind: unit
        ref: "packages/core/src/schemas/ledger.test.ts#LedgerParseOutputSchema — LLM parse contract (21-04 정본)"
        status: pass
    human_judgment: false
  - id: D4
    description: "deriveAmountKrw(원화 파생, null 전파) + needsReview 순수함수"
    requirement: "LEDGER-03"
    verification:
      - kind: unit
        ref: "packages/core/src/schemas/ledger.test.ts#deriveAmountKrw — KRW is derived, not stored source (Pitfall 4)"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-05
status: complete
---

# Phase 21 Plan 02: Travel Ledger 도메인 계약 락 Summary

**@moajoa/core에 ledger 계약 seam 신설 — LedgerEntry(5요소 FX)·LedgerParseOutput(LLM 정본) Zod 스키마 + deriveAmountKrw/needsReview 순수함수, enum은 0022 CHECK와 문자 단위 일치**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-05T21:08Z
- **Completed:** 2026-07-05T21:11Z
- **Tasks:** 1
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `LedgerStatus`(pending/processing/ready/needs_review/failed) + `FxSource`(email/frankfurter/unavailable) const-enum을 0022 CHECK 값·순서와 문자 단위로 락, 테스트로 회귀 방지
- `LedgerEntrySchema`: 5요소 FX 원자저장(amount_foreign/currency/fx_rate/fx_source/fx_as_of) + `trip_id` nullable(미분류=owner-private, D-05) + status enum, 0022 컬럼 정합
- `LedgerParseOutputSchema`: LLM 결제정보 추출 출력 정본(플랫폼/카드4/통화/금액/결제일/krw_amount?/fx_rate?/matched_trip_id?/confidence) — parse-email EF(21-04)가 로컬 재선언할 계약
- `deriveAmountKrw`(fx_rate null → null, 아니면 반올림 원화)·`needsReview` 순수함수로 원천(원통화)/표시값(KRW) 구조적 분리 (Pitfall 4)
- ledger.test.ts 18케이스 green, core 전체 143 tests 무회귀, typecheck exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: ledger.ts 스키마 + 순수함수 (TDD)** - `875ead5` (feat)

**Plan metadata:** (this commit — docs)

_스키마·테스트·barrel을 단일 원자 커밋으로 처리 (단일 task 플랜)._

## Files Created/Modified
- `packages/core/src/schemas/ledger.ts` - const-enum 2쌍 + LedgerEntrySchema + LedgerParseOutputSchema + deriveAmountKrw/needsReview
- `packages/core/src/schemas/ledger.test.ts` - enum 락 대조 + 5요소 파싱 + null FX + reject + KRW 파생 + needsReview (18케이스)
- `packages/core/src/schemas/index.ts` - `export * from './ledger'` barrel 배선

## Decisions Made
- **enum 배치:** constants.ts append 대신 ledger.ts 내부 (checklist.ts 선례 — 도메인 스키마와 enum 동거). 플랜은 constants.ts를 files_modified에 넣었으나 "필요 시 append"였고, checklist idiom상 불필요해 미수정.
- **src/index.ts 미수정:** ledger는 schemas/ 하위라 이미 `schemas/index` barrel을 통해 전이 노출됨. checklist(root 위치)가 src/index.ts에 직접 export였던 것과 대비. acceptance grep은 schemas/index.ts만 대상이라 정합.
- **amount_krw:** 스키마 필드는 nullable로 두되(0022 컬럼 존재) 파생 진실은 deriveAmountKrw로 강제 — 원천은 5요소.

## Deviations from Plan

None — plan executed exactly as written. (constants.ts는 플랜의 "필요 시 append" 조건부 항목으로, checklist idiom상 불필요하여 손대지 않음 — 스코프 축소 아닌 조건 미충족.)

## Issues Encountered
None. zod ^3.23.8이지만 `z.enum(constArray)`가 기존 date-poll.ts에서 컴파일·동작 검증되어 동일 idiom을 그대로 적용.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ledger 계약 락 완료 — 21-03(api ledger/forwarding queries)·21-04(parse-email EF pipeline)·21-05(iOS ledger screen)가 동일 정의를 import하여 병렬 빌드 가능.
- `LedgerParseOutputSchema`는 21-04 pipeline/claude.ts가 로컬 재선언할 정본. 재선언 시 이 스키마와 필드/타입 일치 필수.

---
*Phase: 21-travel-ledger*
*Completed: 2026-07-05*
