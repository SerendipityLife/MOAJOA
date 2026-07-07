---
phase: 23-web-first-foundation
plan: 05
subsystem: core-contracts
tags: [zod, vitest, tdd, share-mode, realtime-channel, trip-messages, seq-no]

# Dependency graph
requires:
  - phase: 23-web-first-foundation (23-01)
    provides: 0024_place_seq.sql — places.seq_no 컬럼 + advisory-lock 채번 트리거
  - phase: 23-web-first-foundation (23-02)
    provides: 0025_web_share.sql — trips.share_mode/companion + trip_messages + join_moa
  - phase: 23-web-first-foundation (23-04)
    provides: 0024·0025 로컬 실적용 + database.ts 재생성 (스키마가 진실인 상태)
provides:
  - ShareMode/ShareModeType 상수 — 0025 CHECK 문자 단위 잠금 + .toEqual 회귀 가드
  - MOA_CHANNEL_PREFIX + moaChannelName(tripId) — Phase 26 단일 채널 빌더
  - TripMessageSchema/TripMessageCreateSchema (schemas/chat.ts 신규, barrel 등록)
  - TripCreateDraftSchema — 온보딩 dates-optional 계약 (refine 2개)
  - TripSchema.share_mode/companion + PlaceSchema.seq_no — DB 미러
affects: [24-onboarding, 25-join-favorites, 26-chat, packages/api 23-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "enum ↔ DB CHECK 문자 단위 잠금 + vitest .toEqual 회귀 테스트 (21-02 ledger 선례 재적용)"
    - "채널 빌더 PREFIX 상수 + name(tripId) 함수 쌍 (planChannelName/pollChannelName 미러)"

key-files:
  created:
    - packages/core/src/schemas/chat.ts
    - packages/core/src/schemas/chat.test.ts
    - packages/core/src/schemas/place.test.ts
  modified:
    - packages/core/src/constants.ts
    - packages/core/src/schemas/index.ts
    - packages/core/src/schemas/trip.ts
    - packages/core/src/schemas/trip.test.ts
    - packages/core/src/schemas/place.ts

key-decisions:
  - "ShareMode·moaChannelName 테스트를 chat.test.ts에 배치 — share/chat 도메인 응집 (플랜 지시)"
  - "TripSchema에 share_mode/companion을 required-nullable로 추가 (ledger Row 1:1 idiom) — 기존 trip.test.ts fullTrip 픽스처에 두 키(null) 추가로 수반 갱신"
  - "Phase 25 익명 세션 호출 계약(signInAnonymously metadata 주입)을 chat.ts 파일 헤더 주석에 명문화"

patterns-established:
  - "TripCreateDraftSchema 공존 패턴: iOS 동결 스키마(TripCreateSchema)는 무수정, 웹 전용 계약을 바로 아래 별도 선언"
  - "seq_no 계약 주석: Source of truth = migration 0024 트리거, client forge 불가 (T-23-01 transfer 명시)"

requirements-completed: [MOA-01]

# Metrics
duration: 7min
completed: 2026-07-08
---

# Phase 23 Plan 05: Core 계약 Seam Summary

**ShareMode(0025 CHECK 잠금)·moaChannelName·TripMessage·TripCreateDraft·seq_no 등 Phase 24~26이 import할 core 계약 5종을 TDD(RED→GREEN 2사이클)로 잠금 — core 169 tests 그린**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-07T17:30:45Z
- **Completed:** 2026-07-07T17:37:30Z (UTC)
- **Tasks:** 2 (TDD — 커밋 4개)
- **Files modified:** 8 (신규 3 + 수정 5)

## Accomplishments

- **ShareMode 드리프트 가드 (T-23-14 mitigate):** `['dates', 'places', 'both'] as const` — 0025 CHECK와 문자 단위·순서 일치, `expect(ShareMode).toEqual([...])` 회귀 테스트로 잠금
- **moaChannelName:** planChannelName/pollChannelName 미러 + "ONE channel per screen" 단일 채널 규약 주석 (Phase 19/20 교훈, Phase 26 소비)
- **schemas/chat.ts 신규:** TripMessageSchema(0025 trip_messages 컬럼 1:1, body 1~140 = CHECK 이중화 T-23-15) + TripMessageCreateSchema(id/user_id/created_at은 서버/RLS 몫) + D-A2 nickname 비정규화 + Phase 25 `signInAnonymously({ options: { data: { name } } })` 호출 계약 주석
- **TripCreateDraftSchema:** 온보딩 dates-optional (미정 = 둘 다 null) — refine 2개("both set or both null" + "end >= start"), companion ≤20. 기존 TripCreateSchema(iOS)는 diff 0
- **TripSchema 0025 미러:** share_mode(z.enum(ShareMode).nullable()) + companion — **PlaceSchema.seq_no:** int positive, 0024 트리거 채번·forge 불가 주석. board_id 레거시 드리프트 무접촉 (Surgical Changes)
- **검증:** core 169 tests 그린 (기존 143 무회귀 + 신규 26), core·api typecheck exit 0, api 74 tests 무회귀, `.js` import 확장자 0

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: ShareMode·moaChannelName·TripMessage 실패 테스트** - `c307512` (test)
2. **Task 1 GREEN: constants + chat.ts + barrel 구현** - `bf392b7` (feat)
3. **Task 2 RED: TripCreateDraft·share_mode·seq_no 실패 테스트** - `5b2c69d` (test)
4. **Task 2 GREEN: trip.ts Draft/미러 + place.ts seq_no 구현** - `3c24130` (feat)

REFACTOR 커밋 없음 — GREEN 산출물이 house style에 이미 정합해 정리 불필요.

## Files Created/Modified

- `packages/core/src/schemas/chat.ts` - TripMessageSchema/TripMessageCreateSchema (0025 trip_messages 계약, 신규)
- `packages/core/src/schemas/chat.test.ts` - ShareMode .toEqual 잠금 + 채널 빌더 + 메시지 스키마 12케이스 (신규)
- `packages/core/src/schemas/place.test.ts` - seq_no 양의 정수/0/음수/소수 4케이스 (신규)
- `packages/core/src/constants.ts` - ShareMode 쌍 + MOA_CHANNEL_PREFIX/moaChannelName (맨 끝 append)
- `packages/core/src/schemas/index.ts` - `export * from './chat'` barrel 한 줄
- `packages/core/src/schemas/trip.ts` - TripCreateDraftSchema + TripSchema share_mode/companion 미러
- `packages/core/src/schemas/trip.test.ts` - Draft 6케이스 + share_mode/companion 4케이스 append, fullTrip 픽스처 2키 추가
- `packages/core/src/schemas/place.ts` - PlaceSchema.seq_no (confidence migration-번호 주석 idiom)

## Decisions Made

- share_mode/companion을 TripSchema에 **required-nullable**(`.nullable()`, `.optional()` 아님)로 추가 — ledger Row 스키마의 "DB 컬럼 1:1" idiom 유지. 수반하여 기존 trip.test.ts fullTrip 픽스처에 두 키(null)를 추가 (스키마 변경의 직접 결과, 계획된 파일 범위 내)
- ShareMode·moaChannelName 테스트는 chat.test.ts에 응집 배치 (플랜 지시 — share/chat 도메인 응집)

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED 게이트: `c307512`(Task 1)·`5b2c69d`(Task 2) — 각각 실행으로 실패 확인 후 커밋 (Task 1: chat 모듈 부재 suite fail, Task 2: 10 tests fail)
- GREEN 게이트: `bf392b7`·`3c24130` — 각 RED 직후 전체 그린 확인 후 커밋
- REFACTOR: 불필요 (변경 없음 → 커밋 생략)

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 4 = 23-06 (@moajoa/api 계약 TDD) 언블록: joinMoa/shareMoa가 import할 `ShareModeType`·`TripMessage` 등 core seam 완비
- Phase 24(온보딩)는 TripCreateDraftSchema, Phase 25(join·찜)는 join_moa+signInAnonymously 계약 주석, Phase 26(채팅)은 moaChannelName+TripMessageSchema를 import하면 됨
- 주의(하류 영향): TripSchema에 required-nullable 2필드 추가 — TripSchema.parse 대상 row는 0025 적용 DB에서 select 시 항상 두 컬럼 포함이므로 런타임 영향 없음. Trip 객체 리터럴을 손으로 만드는 코드는 두 키 필요 (api 74 tests·typecheck 무회귀 확인 완료)

---
*Phase: 23-web-first-foundation*
*Completed: 2026-07-08*

## Self-Check: PASSED

- 생성 파일 4종 존재 확인 (chat.ts·chat.test.ts·place.test.ts·SUMMARY.md)
- 커밋 4개 존재 확인 (c307512·bf392b7·5b2c69d·3c24130)
