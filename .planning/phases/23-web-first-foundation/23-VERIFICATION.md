---
phase: 23-web-first-foundation
verified: 2026-07-08T00:15:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
deferred:
  - truth: "AUTH-07 — 웹에서 카카오 계정 로그인 e2e (버튼 UI 포함)"
    addressed_in: "Phase 24"
    evidence: "ROADMAP SC4 괄호 명시 '버튼 UI·e2e 검증은 Phase 24' + REQUIREMENTS traceability AUTH-07→Phase 24"
  - truth: "SHARE-01 — [함께 정하기] 모드 선택·공유링크 생성 UI"
    addressed_in: "Phase 24"
    evidence: "REQUIREMENTS traceability SHARE-01→Phase 24 (23-06은 shareMoa api seam만 제공)"
  - truth: "AUTH-08 — 게스트 닉네임 게이트 + 익명 인증 재접속 동일 신원 e2e"
    addressed_in: "Phase 25"
    evidence: "REQUIREMENTS traceability AUTH-08→Phase 25 (23은 백엔드 기반만 — 23-02 SUMMARY key-decision 명시)"
  - truth: "SHARE-03 — 게스트가 공유 모드에 따라 참여하는 e2e"
    addressed_in: "Phase 25"
    evidence: "REQUIREMENTS traceability SHARE-03→Phase 25 (23은 join_moa RPC·joinMoa 래퍼까지)"
  - truth: "CHAT-01 — 실시간 채팅 + 히스토리 유지 e2e"
    addressed_in: "Phase 26"
    evidence: "REQUIREMENTS traceability CHAT-01→Phase 26 (23은 trip_messages 테이블·RLS·moaChannelName·chat 스키마까지)"
  - truth: "원격 프로덕션 DB에 0024·0025 적용 (db push)"
    addressed_in: "Phase 24 (전제 작업)"
    evidence: "23-07 Open Q1 확정 — 'push는 phase 23 범위 외, Phase 24 Preview e2e 전 필수 후속 잠금' 기록"
---

# Phase 23: Web-First Foundation Verification Report

**Phase Goal:** 웹 퍼스트에 필요한 데이터·인증·계약 기반이 잠긴다 — 장소 순번 영구 채번(0024), share_mode·companion·trip_messages·join_moa RPC(0025), 익명 sign-in + 카카오 provider 스위치, packages/core+api 계약, CLAUDE.md D26 룰 공식 반전. 이후 모든 phase가 import할 seam.
**Verified:** 2026-07-08T00:15:00Z
**Status:** passed
**Re-verification:** No — 최초 검증

## Goal Achievement

### Observable Truths

ROADMAP Success Criteria 5개 + 플랜 must_haves 고유 truth 7개를 병합해 검증했다.

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | (SC1) `supabase db reset`이 0024·0025 포함 클린 통과(42P17=0)하고 재생성 타입 위에서 core/api 테스트 그린 | ✓ VERIFIED | 오케스트레이터 게이트 실증: reset 클린(0016~0025, 42P17=0) + 회귀 core 169 · api 81 · web 65 · ios 128 전부 그린. database.ts에 trip_messages(4)·seq_no(4)·share_mode(3)·join_moa(1)·last_place_seq(3) 반영 확인 |
| 2  | (SC2) 동시 삽입 무중복·무결번, hard-delete 무재사용, soft-delete 복원 순번 유지 — MOA-01 | ✓ VERIFIED | 하네스 라이브 PASS(40\|40\|40, hard-delete→41, soft-restore 3\|true, forge 999→42). 정적 확인: 0024 L40 `pg_advisory_xact_lock`, L41~43 `UPDATE…RETURNING last_place_seq INTO NEW.seq_no`, L52 `before insert on places`, L28 unique(trip_id, seq_no), 하네스 L24 `xargs -P 8` |
| 3  | (SC3) 익명 세션(is_anonymous) 발급 + join_moa가 share_mode 분기로 editor/voter 부여 | ✓ VERIFIED | smoke 라이브 PASS(anon is_anonymous=true + both→editor / dates→voter + trip_messages RLS 200). 원격도 익명 signup is_anonymous:true 실증(23-07). 0025 L91 `case when v_share_mode in ('places','both') then 'editor' else 'voter'` |
| 4  | (SC4) 카카오 provider가 config.toml·대시보드에 설정되어 OAuth 플로우 시작 가능 | ✓ VERIFIED | config.toml L48 `enable_anonymous_sign_ins = true` + L65~68 `[auth.external.kakao]` env() 치환. 로컬 authorize→kauth.kakao.com redirect(smoke) + 원격 authorize→kauth.kakao.com 200·KOE 0 실증(23-07 human-action approved) |
| 5  | (SC5) CLAUDE.md §5 D26 불릿 반전 — 웹 생성·편집 UI 작업 허용 | ✓ VERIFIED | CLAUDE.md L212~216: 구 룰 "Web 생성·링크 추가 UI 금지" → "❌ iOS 코드 변경 — 전면 동결"로 교체, 반전 이력(Phase 23, 2026-07) 괄호 보존. §4.1 L144 web 역할 "입력·저장·편집 풀 서피스"로 정합 |
| 6  | join_moa가 join_shared_trip 안전장치 5종 유지 (bearer slug·self-join only·owner 가드·멱등·DEFINER+search_path) | ✓ VERIFIED | 0025 L64~97 전문 확인: `security definer` + `set search_path = public`, slug+visibility 검증, `auth.uid()`만 사용(role 인자 없음), owner early-return, `on conflict do nothing` |
| 7  | trip_messages RLS가 헬퍼-only (직접 EXISTS 0 — 42P17 가드) | ✓ VERIFIED | 0025 L44~57: select→`can_read_trip`, insert→`user_id=auth.uid() and can_vote_trip`, delete→`user_id=auth.uid() or am_trip_owner`. 직접 EXISTS 0건 + 런타임 프로브 200 |
| 8  | KAKAO 시크릿은 placeholder만 커밋 (실값 0) | ✓ VERIFIED | `.env.local.example` L15~16 `KAKAO_*=...` placeholder만. `supabase/.env.local`은 gitignored 확인 |
| 9  | ShareMode 상수가 0025 CHECK와 문자 단위 일치 + 회귀 테스트 가드 | ✓ VERIFIED | constants.ts L257 `['dates', 'places', 'both']` = 0025 L24 CHECK. chat.test.ts L10 `.toEqual(['dates','places','both'])` 회귀 가드 |
| 10 | moaChannelName이 poll/plan 채널 빌더 미러 + "화면당 단일 채널" 규약 주석 | ✓ VERIFIED | constants.ts L260~268: "ONE channel per screen carries presence + message + vote + place_added — never open two channels" 주석 + `moa:` PREFIX·빌더 쌍. 스팟체크 `moaChannelName('t1')`→`moa:t1` |
| 11 | TripCreateDraftSchema refine 2개(dates-optional 계약) + TripMessage·seq_no가 DB 컬럼 1:1 | ✓ VERIFIED | trip.ts L49~63 refine 2개(양쪽 null 동시성 + end≥start). 스팟체크: 한쪽만 null 거부, body 141자 거부, seq_no 0 거부 전부 통과 |
| 12 | joinMoa·shareMoa가 house 계약으로 잠기고 기존 joinSharedTrip·shareTrip 무수정 (iOS 동결) | ✓ VERIFIED | memberships.ts L28 `client.rpc('join_moa', { p_share_slug })`, trips.ts L163~178 `shareMoa` 단일 UPDATE(`visibility: 'shared', share_mode`)→share_slug 반환. joinSharedTrip(L8)·shareTrip(L130) 원형 유지. queries barrel export 확인 |

**Score:** 12/12 truths verified

### Deferred Items

이번 phase에서 백엔드 기반만 놓고, e2e는 후속 phase가 소유하는 항목 (traceability 명시 — 갭 아님).

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | AUTH-07 카카오 로그인 e2e (버튼 UI) | Phase 24 | ROADMAP SC4 "버튼 UI·e2e 검증은 Phase 24" |
| 2 | SHARE-01 공유링크 생성 UI | Phase 24 | traceability SHARE-01→Phase 24 |
| 3 | AUTH-08 게스트 닉네임 게이트·재접속 신원 e2e | Phase 25 | traceability AUTH-08→Phase 25 |
| 4 | SHARE-03 게스트 참여 e2e | Phase 25 | traceability SHARE-03→Phase 25 |
| 5 | CHAT-01 실시간 채팅 e2e | Phase 26 | traceability CHAT-01→Phase 26 |
| 6 | 원격 DB 0024·0025 push | Phase 24 전 | 23-07 Open Q1 확정 기록 (원격 0016~0023 정합·0024/0025 미적용 실측) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0024_place_seq.sql` | seq_no+카운터+backfill+advisory-lock DEFINER 트리거 | ✓ VERIFIED | 53줄, `pg_advisory_xact_lock` L40, backfill→not null→unique 순서 정합, 로컬 실적용됨 |
| `supabase/tests/place_seq_concurrency.sh` | MOA-01 4시나리오 동시성 하네스 | ✓ VERIFIED | 47줄, `xargs -P 8` L24, exit-code 단언 4종, 라이브 PASS |
| `supabase/migrations/0025_web_share.sql` | share_mode·companion+trip_messages(RLS)+join_moa | ✓ VERIFIED | 99줄, `create or replace function join_moa` L64, CHECK L24, RLS 3정책 헬퍼-only, 로컬 실적용됨 |
| `supabase/tests/web_share_smoke.sh` | 익명+join분기+RLS프로브+kakao smoke | ✓ VERIFIED | 64줄, `is_anonymous` L20~24, 라이브 PASS |
| `supabase/config.toml` | 익명 ON + [auth.external.kakao] | ✓ VERIFIED | L48·L65~68, env() 치환만 (실값 0) |
| `supabase/.env.local.example` | KAKAO placeholder | ✓ VERIFIED | L15~16 |
| `CLAUDE.md` | §5 D26 반전 + §4.1 정합 | ✓ VERIFIED | L212~216 반전, L144 web 역할 갱신 |
| `packages/api/src/types/database.ts` | 재생성 타입 (trip_messages·seq_no 등) | ✓ VERIFIED | 2123줄, 신규 심볼 5종 전부 반영, 그 위에서 api 81 tests 그린 |
| `packages/core/src/constants.ts` | ShareMode+moaChannelName | ✓ VERIFIED | L257~268, core barrel export 확인 |
| `packages/core/src/schemas/chat.ts` | TripMessageSchema+CreateSchema | ✓ VERIFIED | 36줄, barrel(index.ts L11) export |
| `packages/core/src/schemas/trip.ts` | TripCreateDraftSchema + share_mode/companion 미러 | ✓ VERIFIED | L22~24 required-nullable, L49~63 draft |
| `packages/core/src/schemas/place.ts` | PlaceSchema.seq_no | ✓ VERIFIED | L75 `int().positive()`, 0024 출처 주석 |
| `packages/api/src/queries/memberships.ts` | joinMoa 래퍼 | ✓ VERIFIED | L24~28, rpc('join_moa'), 테스트 3건 |
| `packages/api/src/queries/trips.ts` | shareMoa 단일 UPDATE | ✓ VERIFIED | L163~178, 테스트 4건 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| 0024_place_seq.sql | places BEFORE INSERT | create trigger | ✓ WIRED | L52 `before insert on places` |
| assign_place_seq() | trips.last_place_seq | UPDATE…RETURNING INTO | ✓ WIRED | L41~43 |
| join_moa(p_share_slug) | memberships | share_mode 분기 INSERT | ✓ WIRED | L89~93 case-when editor/voter |
| trip_messages RLS | can_read/vote_trip·am_trip_owner | DEFINER 헬퍼-only | ✓ WIRED | L44~57, 런타임 프로브 200 |
| config.toml | .env.local.example | env() 치환 | ✓ WIRED | `env(KAKAO_REST_API_KEY)` L67 |
| db reset | database.ts | 적용→재생성 순서 | ✓ WIRED | trip_messages 등 신규 심볼 반영 확인 |
| constants.ts ShareMode | 0025 CHECK | .toEqual 회귀 테스트 | ✓ WIRED | chat.test.ts L10 |
| schemas/index.ts | chat.ts | barrel export | ✓ WIRED | L11 `export * from './chat'` |
| memberships.ts | 0025 join_moa RPC | client.rpc('join_moa') | ✓ WIRED | L28, database.ts Functions 시그니처 존재 |
| trips.ts shareMoa | 0016 ensure_share_slug 트리거 | visibility 'shared' UPDATE | ✓ WIRED | L169~170, slug null이면 throw |

### Data-Flow Trace (Level 4)

이 phase는 UI 없는 seam phase — 렌더링 아티팩트 없음. 대신 DB→타입→계약→쿼리 흐름을 추적했다.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| joinMoa | trip_id (uuid) | join_moa RPC → memberships INSERT | 하네스·smoke 라이브 실증 (both→editor, dates→voter) | ✓ FLOWING |
| shareMoa | share_slug | trips UPDATE → ensure_share_slug 트리거 | slug null 시 throw 가드, 테스트 4건 | ✓ FLOWING |
| assign_place_seq | NEW.seq_no | trips.last_place_seq 카운터 | 동시 40건 실 INSERT에서 40\|40\|40 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ShareMode 3값 export | tsx import 실행 | `["dates","places","both"]` | ✓ PASS |
| moaChannelName 빌더 | `moaChannelName('t1')` | `moa:t1` | ✓ PASS |
| TripMessage body 141자 거부 | Zod safeParse | 거부 true | ✓ PASS |
| Draft dates 한쪽만 null 거부 | Zod safeParse | 거부 true | ✓ PASS |
| PlaceSchema seq_no 0 거부 | Zod safeParse | 거부 true | ✓ PASS |
| 하네스·smoke·reset·회귀 4패키지 | (오케스트레이터 기실행) | 전부 PASS/그린 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MOA-01 | 23-01, 23-04, 23-05 | 장소 순번 영구 채번 (동시성·삭제·복원 무결) | ✓ SATISFIED | 하네스 라이브 PASS + REQUIREMENTS.md L339 [x] 마킹 + traceability L379 Complete |
| AUTH-07 | 23-03, 23-07 | 카카오 로그인 | ⏳ DEFERRED→Phase 24 | 스위치·프로덕션 설정 절반 완료 (authorize 실증), e2e는 Phase 24 소유 |
| AUTH-08 | 23-02, 23-03, 23-07 | 익명 인증 게스트 참여 | ⏳ DEFERRED→Phase 25 | 익명 sign-in 백엔드 실증 완료, 닉네임 게이트 e2e는 Phase 25 소유 |
| SHARE-01 | 23-06 | 공유 모드 선택·링크 생성 | ⏳ DEFERRED→Phase 24 | shareMoa api seam 완료, UI는 Phase 24 소유 |
| SHARE-03 | 23-02, 23-06 | 게스트 모드별 참여 | ⏳ DEFERRED→Phase 25 | join_moa RPC·joinMoa 래퍼 완료, e2e는 Phase 25 소유 |
| CHAT-01 | 23-02 | 실시간 채팅 | ⏳ DEFERRED→Phase 26 | trip_messages·RLS·chat 스키마·채널 빌더 완료, e2e는 Phase 26 소유 |

고아 요구사항 없음 — REQUIREMENTS.md traceability(L408)는 Phase 23에 MOA-01만 단일 매핑하며, 플랜들의 AUTH/SHARE/CHAT 표기는 "백엔드 기반만" 주석과 함께 후속 phase 소유를 명시한다 (23-02 SUMMARY key-decision에 근거 기록).

### Anti-Patterns Found

수정 파일 전체 스캔: TODO/FIXME/placeholder/빈 구현 0건. 23-REVIEW.md(critical 0)의 warning 2건을 승계 기록한다.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| packages/api/src/queries/trips.ts | 163~178 | WR-01: shareMoa가 public trip을 조용히 shared로 강등 (shareTrip과 비대칭) | ⚠️ Warning | 현 웹 플로우에 public trip 실사용 없음 — goal 비차단. Phase 24 UI 연결 시 docstring 명시 또는 visibility 조건부 승격 권장 |
| supabase/migrations/0025_web_share.sql | 34 | WR-02: trip_messages.nickname DB CHECK 부재 + Zod max 부재 | ⚠️ Warning | 직접 INSERT 경로에서 빈/무제한 닉네임 가능 — Phase 26 채팅 UI 전 0026 마이그레이션 + chat.ts max 동기화 권장 |
| supabase/migrations/0024_place_seq.sql | 41~43 | IN-02: 장소 INSERT마다 trips.updated_at 갱신 부수효과 | ℹ️ Info | 목록 정렬에 "최근 활동" 효과 — 의도 기록 권장 |

### Human Verification Required

없음. 프로덕션 설정(카카오 provider·익명 sign-in)은 23-07 human-action 체크포인트에서 이미 사용자 승인 + 원격 실증(authorize 200·anon signup) 완료. 이 phase 목표 범위의 잔여 인간 검증 항목 없음 — UI e2e는 전부 후속 phase 소유(deferred).

### Gaps Summary

갭 없음. 5개 Success Criteria 전부 라이브 실증(reset 게이트·하네스·smoke·원격 프로브) + 정적 검증으로 확인됐고, 12개 병합 truth 전부 VERIFIED. 이후 phase가 import할 seam(0024/0025 스키마, ShareMode·chat·draft 계약, joinMoa/shareMoa 쿼리, D26 반전)이 실제 코드베이스에 잠겨 있으며 barrel export·생성 타입·테스트 회귀 가드까지 배선 완료. 후속 주의점 2가지: (1) Phase 24 Preview e2e 전 원격 0024·0025 push 필수(23-07 기록), (2) Phase 26 전 WR-02 nickname 제약 보강 권장.

---

_Verified: 2026-07-08T00:15:00Z_
_Verifier: Claude (gsd-verifier)_
