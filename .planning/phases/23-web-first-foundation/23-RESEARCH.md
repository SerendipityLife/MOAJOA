# Phase 23: Web-First Foundation - Research

**Researched:** 2026-07-07
**Domain:** Supabase(Postgres 17) 마이그레이션 + 인증(익명/카카오) + 모노레포 계약 seam
**Confidence:** HIGH (코드베이스 직접 검증 + 공식 문서 + 로컬 DB 실검증)

## Summary

Phase 23은 신규 라이브러리가 **0개**인 순수 기반 phase다. 필요한 모든 재료가 이미 레포와 스택 안에 있다: (1) MOA-01 순번 영구 채번은 Postgres advisory-lock 트리거로 — `pg_advisory_xact_lock` + trips 행의 단조증가 카운터 조합이 "동시 삽입 무중복·무결번 + 절대 재부여 금지"를 모두 만족한다 (`hashtextextended`는 로컬 PG 17.6에서 실검증 완료). (2) 0025의 share_mode·trip_messages·join_moa는 기존 0016/0018의 검증된 idiom(SECURITY DEFINER 헬퍼, `join_shared_trip` RPC 미러, `date_comments` 테이블 shape)을 그대로 재사용한다. (3) 익명 sign-in은 config.toml 한 줄(`enable_anonymous_sign_ins = true`)이며, 익명 유저는 `authenticated` Postgres role을 받으므로 **기존 RLS 정책 재작성이 전혀 불필요**하다 — PROJECT.md의 핵심 결정이 공식 문서로 확인됨. (4) 카카오 provider는 supabase CLI가 공식 지원하는 provider 목록에 있어 `[auth.external.kakao]` 블록 + env placeholder로 끝난다.

가장 큰 설계 함정은 순번 채번에서 "max+1" 단순 구현이다: places에는 hard DELETE RLS 정책이 이미 존재하므로, 최고 순번 행이 hard delete되면 max+1이 그 번호를 **재사용**해 MOA-01("절대 재부여되지 않는다")을 위반한다. 따라서 max() 스캔이 아닌 trips 행 카운터(`last_place_seq`) 방식을 권장한다. 두 번째 함정: 채번 트리거가 trips 행을 UPDATE하는데 editor 멤버는 trips UPDATE RLS가 없으므로 트리거 함수는 반드시 `SECURITY DEFINER set search_path = public`이어야 한다(0016 헬퍼 idiom과 동일).

로컬 환경은 완비 상태다: supabase CLI 2.101.0, colima+docker 가동 중, 로컬 스택 **현재 실행 중**(auth health 200), psql/pgbench 사용 가능. 동시성 테스트는 `xargs -P` 병렬 psql 또는 pgbench 커스텀 스크립트로 로컬 54322 포트에 직접 수행하면 된다.

**Primary recommendation:** 0024 = `places.seq_no` + `trips.last_place_seq` 카운터 + advisory-lock DEFINER 트리거(+기존 행 backfill), 0025 = 0018 idiom 미러(share_mode 컬럼 + date_comments-shape trip_messages + join_shared_trip 미러 join_moa), config.toml 2블록 스위치, core/api는 기존 house style 그대로 확장. 신규 설치 0.

## Project Constraints (from CLAUDE.md)

플래너가 준수 검증해야 할 CLAUDE.md 지시사항:

| 출처 | 지시 | Phase 23 영향 |
|------|------|---------------|
| §2 | 트리비얼 아닌 작업은 GSD 명령 경유 | 본 phase 자체가 GSD 플로우 |
| §4.2 | `packages/core/schemas/*` 변경은 SQL 마이그레이션과 짝지어 | 0024/0025 ↔ PlaceSchema seq_no·chat 스키마 같은 phase에서 |
| §4.3 | 마이그레이션 **append-only** — 0016~0023 무수정, 새 번호만 | 신규 = 0024, 0025 (0023은 이미 존재 — ledger UPDATE CHECK 픽스) |
| §4.3 | 컬럼 추가는 NULLABLE 또는 DEFAULT | `seq_no`는 backfill 후 NOT NULL 승격 (마이그레이션 내 원자 처리) |
| §4.3 | 변경 후 항상 `pnpm supabase:types` → database.ts 재생성 | 성공 기준 1의 일부 |
| §4.4 | RLS deny-by-default, 크로스 테이블은 SECURITY DEFINER 헬퍼만 (42P17) | trip_messages RLS·join_moa·채번 트리거 전부 해당 |
| §4.5 | TS strict · 워크스페이스 import에 `.js` 확장자 금지 · 외부 입력 Zod validate | core/api 계약 작성 시 |
| §4.6 | Conventional Commits · 마이그레이션 PR에 `BREAKING DB CHANGE` | |
| §4.7 | env 실제값 커밋 금지, placeholder는 `.env.local.example` | KAKAO_* 시크릿 |
| §5 | **D26 불릿("Web에 새로운 보드 생성·링크 추가 UI 금지")** — 이번 phase에서 공식 반전 대상 | 성공 기준 5 |
| §5 | 서비스 롤 키 클라이언트 노출 금지 · `.env.local` 커밋 금지 | |

**참고:** `23-CONTEXT.md` 없음 (discuss 미수행) — user constraints 섹션 없음. ROADMAP.md의 Phase 23 Goal/Success Criteria가 사실상의 잠긴 결정이다 (0024/0025 번호, advisory-lock 트리거, 익명+카카오 스위치, 계약 목록, D26 반전).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOA-01 | 장소는 추가 시점에 모아별 순번(#1, #2…)이 채번되고 이후 절대 재부여되지 않는다 (동시 추가에도 중복·결번 없음, 삭제·복원에도 원래 순번 유지) | Pattern 1 (advisory-lock + 카운터 트리거), Pitfall 1~3, Code Example 1~2 (트리거 SQL + 동시성 하네스), Validation Architecture REQ 매핑 |

(AUTH-07/08·SHARE-03·SEC-01의 **백엔드 기반**도 이 phase 산출물이지만, 각 REQ의 e2e 검증은 Phase 24/25/27에 매핑 — ROADMAP 명시)
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 순번 채번 (MOA-01) | Database (trigger) | — | 동시성 정합은 DB만 보장 가능. 클라이언트/EF 채번은 race 필연 |
| 순번 backfill | Database (0024 내부) | — | 마이그레이션 원자성 — 코드 배포와 분리 불가 |
| share_mode·companion·trip_messages 스키마 | Database (0025) | packages/core (Zod 미러) | DB가 진실, core는 계약 미러 (§4.2 짝지음 룰) |
| join_moa 멤버십 부여 | Database (SECURITY DEFINER RPC) | packages/api (래퍼) | 권한 부여 = 신규 권리 grant → DEFINER RPC가 유일 안전 경로 (0016 join_shared_trip 선례) |
| 익명 sign-in 활성화 | Supabase Auth (config.toml + 대시보드) | apps/web (Phase 25에서 signInAnonymously 호출) | GoTrue 설정 — 코드 아님 |
| 카카오 provider | Supabase Auth (config.toml + 대시보드) + Kakao console | apps/web (Phase 24 버튼) | OAuth 브로커는 GoTrue. 이번 phase는 설정만 |
| TripCreateDraft·chat 스키마·moaChannelName | packages/core | — | web/iOS/EF 공유 계약의 단일 출처 (기존 컨벤션) |
| joinMoa/shareMoa 쿼리 | packages/api | — | typed query 레이어 (joinSharedTrip/shareTrip 미러) |
| D26 룰 반전 | CLAUDE.md (문서) | — | 이후 세션 행동 지침 |

## Standard Stack

### Core (전부 기존 — 신규 설치 0)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase CLI | 2.101.0 `[VERIFIED: 로컬 command -v]` | db reset·types gen·config.toml | 프로젝트 표준 |
| Postgres | 17.6 `[VERIFIED: 로컬 psql select version()]` | advisory lock·트리거·RLS | supabase local major_version 17 |
| @supabase/supabase-js | 2.110.0 (워크스페이스 고정) `[VERIFIED: package.json]` | signInAnonymously/signInWithOAuth | signInAnonymously는 v2.42+ 포함 — 2.110.0에서 사용 가능 `[CITED: supabase.com/docs/reference/javascript/auth-signinanonymously]` |
| zod | ^3.23.8 `[VERIFIED: core package.json]` | 계약 스키마 | house style |
| vitest | (core/api 기존 설정) `[VERIFIED: vitest.config.ts]` | core/api 테스트 | `pnpm --filter @moajoa/core test` |
| psql / pgbench | 14.18 (Homebrew) `[VERIFIED: 로컬]` | SQL 동시성 테스트 하네스 | PG17 서버에 클라이언트 14로 접속 가능 (Pitfall 8 참고) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| trips 행 카운터(`last_place_seq`) + advisory lock | `max(seq_no)+1` + advisory lock | max+1은 단순하지만 **hard delete 시 번호 재사용** → MOA-01 위반. 카운터는 단조증가라 어떤 삭제 경로에서도 재부여 불가 |
| advisory-lock 트리거 | Postgres SEQUENCE per trip | trip마다 시퀀스 객체 생성/관리 — 운영 부담, 카탈로그 오염. 기각 |
| advisory-lock 트리거 | `serializable` 격리 + 재시도 | 클라이언트 재시도 로직 필요 — supabase-js 경유 insert에 부적합 |
| 익명 인증 (auth.uid 발급) | 기존 device_token localStorage 패턴(0018) | device_token은 RLS·votes·places FK와 통합 불가. 익명 auth는 profiles 행 자동 생성 + 기존 `to authenticated` RLS 그대로 적용 — PROJECT.md 잠긴 결정 |

**Installation:** 없음. `pnpm install` 불필요.

## Architecture Patterns

### System Architecture Diagram

```
[성공 기준 2 — 순번 채번 데이터 플로우]

 web/iOS/EF insert                       ┌────────────────────────────────┐
 (seq_no 미지정) ──▶ places BEFORE INSERT │ assign_place_seq() [DEFINER]   │
                     trigger             │ 1. pg_advisory_xact_lock(      │
                                         │      hashtextextended(         │
                                         │        'place_seq:'||trip_id)) │──▶ 동일 trip 동시 INSERT 직렬화
                                         │ 2. UPDATE trips                │
                                         │    SET last_place_seq += 1     │
                                         │    RETURNING → NEW.seq_no      │──▶ 단조증가: 재부여 불가
                                         └────────────────────────────────┘
 soft delete: UPDATE places SET hidden_at = now()   → seq_no 불변 (행 보존)
 restore:     UPDATE places SET hidden_at = null    → 원래 seq_no 그대로

[성공 기준 3 — 익명 세션 + join_moa 플로우]

 브라우저 ──POST /auth/v1/signup {}──▶ GoTrue (enable_anonymous_sign_ins=true)
          ◀── JWT { role:'authenticated', is_anonymous:true } + profiles 행
              (handle_new_auth_user 트리거: display_name ← user_metadata.name)
          ──rpc join_moa(p_share_slug)──▶ [DEFINER] slug 검증 → share_mode 분기
                                          ├ 'places'|'both' → memberships role='editor'
                                          └ 'dates'|null    → memberships role='voter'
          ◀── trip_id — 이후 can_read/edit/vote_trip 헬퍼가 멤버십 반영

[성공 기준 4 — 카카오 (설정만, e2e는 Phase 24)]

 config.toml [auth.external.kakao] + env(KAKAO_*)  → 로컬 GoTrue
 Supabase 대시보드 provider 설정 + Kakao console   → 프로덕션 GoTrue
 (redirect: https://<ref>.supabase.co/auth/v1/callback)
```

### Recommended Change Structure

```
supabase/
├── migrations/0024_place_seq.sql        # seq_no + last_place_seq + backfill + 트리거
├── migrations/0025_web_share.sql        # share_mode·companion·trip_messages·join_moa
└── config.toml                          # enable_anonymous_sign_ins + [auth.external.kakao]
packages/core/src/
├── constants.ts                         # ShareMode·MOA_CHANNEL_PREFIX·moaChannelName 추가
├── schemas/trip.ts                      # TripCreateDraftSchema 추가
├── schemas/place.ts                     # PlaceSchema에 seq_no 추가
└── schemas/chat.ts (신규)               # TripMessageSchema + Create (barrel export 추가)
packages/api/src/queries/
├── trips.ts                             # shareMoa (shareTrip 미러 + share_mode)
├── memberships.ts                       # joinMoa (joinSharedTrip 미러)
└── (types/database.ts — supabase:types로 재생성)
CLAUDE.md                                # §5 D26 불릿 반전 (+§4.1 web/ios 역할 한 줄 정합)
supabase/.env.local.example 또는 루트    # KAKAO_REST_API_KEY / KAKAO_CLIENT_SECRET placeholder
```

### Pattern 1: Advisory-lock 채번 트리거 (MOA-01의 심장)

**What:** BEFORE INSERT 트리거가 trip 단위 advisory lock을 잡고 trips 행의 단조증가 카운터를 올려 `NEW.seq_no`에 할당.
**When to use:** 동일 trip 동시 INSERT에서 무중복·무결번 + 영구 번호가 필요할 때.
**핵심 근거:**
- `pg_advisory_xact_lock(bigint)`은 **트랜잭션 끝(commit/rollback)에 자동 해제**, 획득 불가 시 **대기(블로킹)** → 동일 키의 동시 트랜잭션이 직렬화됨 `[CITED: postgresql.org/docs/17/functions-admin.html]`
- `hashtextextended(text, 0)` → bigint 키 생성 — 로컬 PG 17.6에서 실행 확인 `[VERIFIED: psql select hashtextextended('place_seq:abc',0) → -6466985036598052104]`
- 트랜잭션 rollback 시 카운터 증가도 함께 rollback → 결번 없음
- 카운터는 감소하는 경로가 없으므로 hard delete가 일어나도 번호 재사용 불가

**주의 (RLS):** 트리거 함수가 trips를 UPDATE하는데 editor 멤버에게는 trips UPDATE 정책이 없다 → 함수는 반드시 `security definer set search_path = public` (0016 헬퍼 idiom, 0019/0020 search_path 픽스 선례). 클라이언트가 보낸 seq_no는 **무조건 무시**하고 트리거가 덮어쓴다 (forge 차단).

### Pattern 2: join_moa RPC — join_shared_trip 미러 + share_mode 분기

**What:** 0016 `join_shared_trip`(L631~665)의 검증된 보안 shape를 그대로 가져와 role만 share_mode 기반으로 분기.
**유지할 안전장치 (0016 검증):** bearer slug 검증(`visibility in ('shared','public')`) · `user_id = auth.uid()` 본인만 join · owner self-join 가드(denominator 이중 카운트 방지) · `on conflict do nothing` 멱등 · DEFINER + search_path 핀.
**신규 분기:** `share_mode in ('places','both')` → `'editor'` (장소/링크 추가 가능 — can_edit_trip 통과), 그 외(`'dates'` 또는 null 레거시) → `'voter'`. 기존 role 시맨틱과 정합: can_edit_trip = owner|editor, can_vote_trip = 모든 accepted member `[VERIFIED: 0016 L313~358]`.
**grant:** `to authenticated`만. 익명 유저도 `authenticated` role이므로 anon grant 불필요 `[CITED: supabase.com/docs/guides/auth/auth-anonymous]`.

### Pattern 3: trip_messages — date_comments shape + user_id 신원

**What:** 0018 `date_comments`(nickname 비정규화 + body 길이 CHECK)를 미러하되 device_token 대신 `user_id references profiles`(익명도 profiles 행 보유).
**RLS:** SELECT = `can_read_trip(trip_id)` (Phase 26 전제: "채팅 히스토리 RLS SELECT = join 멤버십") / INSERT = `user_id = auth.uid() and can_vote_trip(trip_id)` (voter도 채팅 가능) / DELETE = 본인 or `am_trip_owner` (delete_poll_comment 모더레이션 선례). 직접 크로스 테이블 EXISTS 0 — 헬퍼만 (42P17 가드).
**nickname 비정규화 권장 이유:** 익명 유저는 장기적으로 purge될 수 있고(공식 문서 권장 사항), 조인 없이 히스토리 렌더 가능. profiles.display_name과 이중화되지만 chat은 "발화 시점 닉네임" 스냅샷이 UX상 자연스러움. `[ASSUMED]` — 플래너/discuss 확정 필요 (A2).
**reply_to_place_id:** `references places(id) on delete set null` — 장소 hard delete 시 칩만 사라지고 메시지 보존 (CHAT-03 기반).

### Pattern 4: config.toml 스위치 (로컬) + 대시보드 (프로덕션)

**What:** config.toml은 **로컬 전용** — link된 배포 프로젝트는 대시보드 설정이 우선 `[VERIFIED: config.toml 헤더 주석 L2-3]`.
- 익명: `enable_anonymous_sign_ins = true` (기본 false, 현재 false `[VERIFIED: config.toml L48]`) + 선택적 `[auth.rate_limit] anonymous_users = 30`(기본 30/hr/IP) `[CITED: supabase.com/docs/guides/local-development/cli/config]`
- 카카오: CLI 지원 provider 목록에 `kakao` 포함 확인. `[auth.external.kakao]` 블록에 `enabled/client_id/secret` (+선택 `redirect_uri`) — 기존 apple/google 블록(L55~63)과 동일 idiom, `env()` 치환 `[CITED: 동일 config 레퍼런스]`
- 프로덕션은 **수동 단계 2개**: Supabase 대시보드(Auth > Providers에서 anonymous 토글 + kakao client_id/secret 입력) + Kakao developers console(REST API key = client_id, Client Secret 활성화, Redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, 동의항목 profile_nickname·profile_image; account_email은 Biz App 전용) `[CITED: supabase.com/docs/guides/auth/social-login/auth-kakao]`

### Pattern 5: core/api 계약 house style

기존 파일에서 확인된 컨벤션 `[VERIFIED: constants.ts·trip.ts·trips.ts·memberships.ts 직접 열람]`:
- 채널 빌더: `PREFIX 상수 + 함수` 쌍 — `moaChannelName(tripId) => \`moa:${tripId}\`` 는 `planChannelName`/`pollChannelName` 미러. "한 토픽 채널 2개 금지" 교훈 → 화면당 단일 채널 상수만 (Phase 26 소비)
- enum: `as const 배열 + (typeof X)[number]` 타입 쌍 — `ShareMode = ['dates','places','both'] as const`. **DB CHECK 값과 문자 단위 일치 + 테스트 `.toEqual` 회귀 가드** (21-02 ledger 선례)
- Zod 스키마: DB 컬럼 1:1 미러 + 주석에 migration 번호 명시 (place.ts confidence 주석 스타일)
- api 쿼리: `(client: MoajoaSupabaseClient, ...)` 시그니처, `if (error) throw error`, rpc 래퍼는 memberships.ts `joinSharedTrip` shape
- TripCreateDraft: 기존 `TripCreateSchema`(dates 필수)와 별도로 온보딩용 dates-optional draft — `.refine`으로 "둘 다 있거나 둘 다 없거나 + end>=start"
- 신규 스키마 파일은 TDD (21-02 선례: 스키마 + 테스트 같은 plan)

### Anti-Patterns to Avoid

- **`select max(seq_no)+1` (락 없이):** 동시 INSERT에서 중복 채번 — 대표적 race
- **RLS 정책 안 직접 크로스 테이블 EXISTS:** 42P17 무한재귀 (0002에서 학습, §4.4) — trip_messages 정책은 can_*_trip 헬퍼만
- **`is_anonymous` 무시하고 익명 차단을 RLS 재작성으로:** 불필요 — 익명 허용이 이번 설계의 의도. 차단이 필요한 곳(추출 EF)은 Phase 27 SEC-01
- **config.toml만 바꾸고 대시보드 생략:** 프로덕션에서 익명/카카오 미동작 — 성공 기준 4는 "config.toml·대시보드" 둘 다 명시
- **0023 건너뛰고 0024 대신 0023 재사용:** 0023은 이미 존재(ledger UPDATE CHECK) `[VERIFIED: ls migrations]` — ROADMAP의 0024/0025 번호가 정확함

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 게스트 신원 | localStorage device_token 확장 | Supabase 익명 인증 (`signInAnonymously`) | auth.uid 발급 → 기존 RLS·FK·profiles 트리거 전부 무료로 작동. 재접속 식별·계정 승격(`linkIdentity`) 내장 `[CITED: auth-anonymous 문서]` |
| 카카오 OAuth | 커스텀 OAuth 핸드셰이크/토큰 교환 | GoTrue `[auth.external.kakao]` + `signInWithOAuth({provider:'kakao'})` | state/nonce/토큰 교환/세션 발급 전부 GoTrue가 처리 |
| 동시성 직렬화 | 앱 레벨 뮤텍스/큐, EF에서 채번 | `pg_advisory_xact_lock` 트리거 | DB 밖 직렬화는 다중 인스턴스에서 무의미. insert 경로가 3개(web·iOS·EF)라 DB가 유일한 관문 |
| slug/코드 생성 | 새 랜덤 문자열 로직 | 0016 `ensure_share_slug` 기존 트리거 (이미 있음 — 재사용) | share_mode를 켜는 shareMoa는 visibility='shared' UPDATE만 하면 기존 트리거가 slug 생성 |
| 멤버십 부여 | 클라이언트에서 memberships INSERT | SECURITY DEFINER `join_moa` RPC | memberships INSERT 정책은 trip owner 전용 — 게스트 self-join은 DEFINER만 가능 (0016 선례) |

**Key insight:** 이 phase의 모든 문제는 "이미 레포에 검증된 선례가 있는 문제"다. 새 발명 = 리스크. 미러 대상: join_shared_trip(→join_moa), ensure_share_slug(→재사용), date_comments(→trip_messages), planChannelName(→moaChannelName), shareTrip(→shareMoa).

## Runtime State Inventory

(마이그레이션 phase — 5개 카테고리 명시 점검)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **places 기존 행**: 로컬 0행 `[VERIFIED: psql count]`. 원격(linked prod)은 v2.0 잔여 데이터 존재 가능성 있음 — 0024에 **backfill UPDATE 포함 필수**(created_at 순 row_number per trip) + trips.last_place_seq를 max로 동기화. backfill이 있으면 로컬/원격 어느 쪽이든 안전 | 0024 마이그레이션 내 데이터 마이그레이션 |
| Live service config | (1) **Supabase 대시보드**: anonymous sign-in 토글 + Kakao provider — git 밖, 수동. (2) **Kakao developers console**: 앱 생성·REST API key·Client Secret·Redirect URI·동의항목 — 사용자 계정 작업 (Phase 21 CF 배포와 같은 human-action 체크포인트 성격). (3) 원격 DB 마이그레이션 상태: 0023이 원격에 push됐는지 미확인 — push 전 `supabase migration list` 확인 필요 | 대시보드/콘솔 수동 단계 + 원격 상태 확인 |
| OS-registered state | 없음 — 이 phase는 데몬/스케줄러/네이티브 등록 무관 (verified: 변경 대상이 SQL·config·TS·MD뿐) | 없음 |
| Secrets/env vars | 신규 2개: `KAKAO_REST_API_KEY`(client_id)·`KAKAO_CLIENT_SECRET` — config.toml `env()` 치환용. placeholder를 `.env.local.example`에 추가 (§4.7), 실값은 1Password/노션 | placeholder 추가 + 사용자 실값 준비 |
| Build artifacts | `packages/api/src/types/database.ts` — 0024/0025 적용 후 stale → `pnpm supabase:types` 재생성 필수 (seq_no·share_mode·companion·trip_messages·join_moa 타입 반영) | 재생성 + api typecheck |

## Common Pitfalls

### Pitfall 1: max+1 채번의 hard-delete 번호 재사용
**What goes wrong:** `coalesce(max(seq_no),0)+1` 방식에서 최고 순번 장소가 hard delete되면(places DELETE 정책 존재 `[VERIFIED: 0016 L488-494]`) 다음 insert가 그 번호를 재사용 → "절대 재부여되지 않는다" 위반.
**Why it happens:** max는 현존 행만 본다. soft delete(hidden_at)는 행이 남아 안전하지만 hard delete는 흔적이 없다.
**How to avoid:** trips 행 단조증가 카운터(`last_place_seq`)에서 채번. 삭제 경로와 완전히 독립.
**Warning signs:** 동시성 테스트에 "hard delete 후 재삽입" 케이스가 없으면 이 버그는 테스트를 통과해버림 — 검증 시나리오에 반드시 포함.

### Pitfall 2: 채번 트리거의 RLS 권한 부족
**What goes wrong:** editor 멤버(특히 익명 게스트)가 place를 insert하면 트리거의 `UPDATE trips`가 RLS에 걸려 실패 — trips UPDATE는 owner 전용.
**How to avoid:** 트리거 함수 `security definer set search_path = public` (0016 헬퍼·0019/0020 픽스 idiom). service-role EF insert는 원래 RLS 우회라 무관.
**Warning signs:** owner로만 테스트하면 안 잡힘 — editor 멤버십 세션으로 insert 테스트 필수.

### Pitfall 3: backfill 전 NOT NULL / UNIQUE 선언 순서
**What goes wrong:** `add column seq_no int not null` → 기존 행에서 즉시 실패. 또는 backfill 전 unique index → 무관. backfill의 row_number가 `order by created_at`만이면 created_at 동률(같은 추출 배치의 장소들!)에서 순서 비결정.
**How to avoid:** ① nullable로 추가 → ② `row_number() over (partition by trip_id order by created_at, id)` backfill (동률 tiebreak = id) → ③ `set not null` → ④ `unique (trip_id, seq_no)` 인덱스 → ⑤ trips.last_place_seq를 per-trip max로 UPDATE. 전부 0024 한 파일 안에서.

### Pitfall 4: 익명 유저 profiles.display_name 함정
**What goes wrong:** `handle_new_auth_user` 트리거는 `raw_user_meta_data->>'name'` 없고 email도 null이면 display_name='user'가 됨 `[VERIFIED: 0016 L84-98]`. 닉네임 게이트에서 익명 세션 생성 시 metadata를 안 넘기면 전원 'user'.
**How to avoid:** Phase 25 소비 시 `signInAnonymously({ options: { data: { name: nickname } } })`로 생성 시점에 주입 — **이번 phase 산출물(계약 문서/주석)에 이 호출 계약을 명시**해 seam으로 잠글 것.

### Pitfall 5: config.toml은 로컬만 — 대시보드 별도
**What goes wrong:** config.toml에 kakao/anonymous 켜고 "완료" 처리 → Vercel Preview(프로덕션 Supabase)에서 미동작.
**How to avoid:** 성공 기준 4대로 대시보드 설정을 human-action 체크포인트로 plan에 명시 (21-04 Task 5 선례). Kakao console 쪽 리드타임(동의항목 심사 등)도 존재 가능.

### Pitfall 6: 익명 rate limit + 어뷰즈 표면
**What goes wrong:** 익명 sign-in은 IP당 30/hr 기본 제한 — 2인극 UAT/자동 테스트에서 반복 생성하면 로컬에서도 걸릴 수 있음. 또 익명 세션도 JWT를 받으므로 `verify_jwt=true`인 extract-youtube를 **호출할 수 있게 됨** — 멤버십 게이트(SEC-01)는 의도적으로 Phase 27.
**How to avoid:** 테스트에서 세션 재사용. SEC-01 전까지 외부 공유를 시작하지 않는 것이 마일스톤 시퀀스의 전제임을 plan에 기록. 프로덕션 노출 시 CAPTCHA(Turnstile) 권장은 공식 문서 사항 `[CITED: auth-anonymous]` — v2.1 범위 외로 defer 명시.

### Pitfall 7: 42P17 재귀 (반복 경고)
**What goes wrong:** trip_messages RLS나 join_moa에서 직접 크로스 테이블 EXISTS → `supabase db reset`에서 42P17.
**How to avoid:** can_read_trip/can_vote_trip/am_trip_owner 헬퍼만. 허용된 shape는 "부모 테이블 EXISTS가 내부에서 DEFINER 헬퍼 호출"(0018 date_poll_options 정책 선례) — trip_messages는 trip_id 직접 보유라 그마저 불필요.

### Pitfall 8: psql/pgbench 클라이언트 14 vs 서버 17
**What goes wrong:** 대부분 무해하나 pgbench 초기화류 명령이나 신규 psql 메타커맨드에서 경고 가능.
**How to avoid:** pgbench는 `-n`(no vacuum) + 커스텀 스크립트(`-f`)만 사용, psql은 표준 SQL만 — 이 용도로는 문제없음. `[ASSUMED]` — 실행 시 확인 (저위험).

### Pitfall 9: supabase local은 colima 필요
**What goes wrong:** colima 중지 상태에서 `pnpm supabase:reset` 실패.
**How to avoid:** 현재 가동 중 `[VERIFIED: docker daemon UP, auth health 200]`. plan 선행 체크로 `docker info` 확인 (STATE/메모리 선례: analytics 비활성화 픽스 이미 적용됨 `[VERIFIED: config.toml L81-82]`).

## Code Examples

### 1. 0024 — seq_no + 카운터 + backfill + advisory-lock 트리거 (권장 shape)

```sql
-- Source: postgresql.org/docs/17/functions-admin.html (advisory lock 시맨틱)
--         + 0016 DEFINER/search_path idiom. 로컬 PG17.6에서 hashtextextended 검증.
alter table trips add column last_place_seq int not null default 0;
alter table places add column seq_no int;

-- backfill: created_at 순, 동률은 id로 tiebreak. hidden 행 포함(순번 영구성).
with numbered as (
  select id, row_number() over (partition by trip_id order by created_at, id) as rn
  from places
)
update places p set seq_no = n.rn from numbered n where p.id = n.id;

update trips t set last_place_seq = coalesce(
  (select max(seq_no) from places where trip_id = t.id), 0);

alter table places alter column seq_no set not null;
create unique index places_trip_seq_key on places (trip_id, seq_no);

create or replace function assign_place_seq()
returns trigger
language plpgsql
security definer            -- editor/익명 멤버는 trips UPDATE RLS 없음 (Pitfall 2)
set search_path = public    -- 0019/0020 search_path 핀 idiom
as $$
begin
  -- 클라이언트 제공 seq_no는 신뢰하지 않음 — 항상 트리거가 채번 (forge 차단)
  perform pg_advisory_xact_lock(hashtextextended('place_seq:' || new.trip_id::text, 0));
  update trips set last_place_seq = last_place_seq + 1
    where id = new.trip_id
    returning last_place_seq into new.seq_no;
  if new.seq_no is null then
    raise exception 'trip % not found for seq assignment', new.trip_id;
  end if;
  return new;
end;
$$;

create trigger places_seq_before_insert
  before insert on places
  for each row execute function assign_place_seq();
```

### 2. 동시성 테스트 하네스 (성공 기준 2 검증)

```bash
# Source: 로컬 검증된 접속 문자열 (supabase local 54322)
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# (셋업) 테스트 유저 + trip — superuser라 RLS 우회하지만 트리거는 동일하게 발화
USER_ID=$(psql "$DB" -tAc "select id from auth.users limit 1")   # 없으면 curl signup으로 생성
TRIP=$(psql "$DB" -tAc "insert into trips (owner_id, title) values ('$USER_ID','seq-test') returning id")

# (1) 동시 40건 삽입, 8-way 병렬
seq 1 40 | xargs -P 8 -I{} psql "$DB" -qc \
  "insert into places (trip_id, added_by, name_local, lat, lng)
   values ('$TRIP','$USER_ID','p{}',35.0,139.0)"

# (2) 단언: 40 | 40 | 40  (count = distinct = max → 무중복·무결번)
psql "$DB" -tAc "select count(*), count(distinct seq_no), max(seq_no)
                 from places where trip_id='$TRIP'"

# (3) 소프트삭제·복원 후 순번 유지 + hard delete 후 무재사용
psql "$DB" <<SQL
update places set hidden_at = now() where trip_id='$TRIP' and seq_no = 3;
delete from places where trip_id='$TRIP' and seq_no = 40;              -- hard delete 최고번호
insert into places (trip_id, added_by, name_local, lat, lng)
  values ('$TRIP','$USER_ID','after-delete',35,139);
update places set hidden_at = null where trip_id='$TRIP' and seq_no = 3;
select seq_no from places where trip_id='$TRIP' and name_local='after-delete'; -- 기대: 41 (40 재사용 금지)
select seq_no, hidden_at is null as visible from places
  where trip_id='$TRIP' and seq_no = 3;                                 -- 기대: 3 | t
SQL
```

(pgbench 대안: `pgbench -n -c 8 -t 5 -f insert_place.sql "$DB"` — 스크립트에 동일 INSERT.)

### 3. 익명 세션 curl (성공 기준 3 전반부)

```bash
# Source: supabase.com/docs/reference/javascript/auth-signinanonymously +
#         github.com/supabase/auth-js/issues/943 (빈 email/password → anonymous 동작 확인)
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')
curl -s -X POST "http://127.0.0.1:54321/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"data":{"name":"게스트닉네임"}}' | tee /tmp/anon.json
# 기대: access_token 발급. JWT payload에 "is_anonymous": true, role "authenticated"
python3 -c "import json,base64,sys; t=json.load(open('/tmp/anon.json'))['access_token'].split('.')[1]; print(json.dumps(json.loads(base64.urlsafe_b64decode(t+'==')), indent=2))"
```

### 4. join_moa 검증 (성공 기준 3 후반부)

```bash
JWT=$(python3 -c "import json;print(json.load(open('/tmp/anon.json'))['access_token'])")
curl -s -X POST "http://127.0.0.1:54321/rest/v1/rpc/join_moa" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" -d "{\"p_share_slug\":\"$SLUG\"}"
# 이후 psql로 role 단언:
psql "$DB" -tAc "select role from memberships where trip_id='$TRIP'
                 order by created_at desc limit 1"
# share_mode='both' trip → 'editor', 'dates' trip → 'voter'
```

### 5. config.toml 변경분 (성공 기준 3·4)

```toml
# Source: supabase.com/docs/guides/local-development/cli/config (kakao 지원 확인)
[auth]
# ...기존 유지...
enable_anonymous_sign_ins = true          # 기존 false → true

[auth.external.kakao]                      # 기존 apple/google 블록 idiom 미러
enabled = true
client_id = "env(KAKAO_REST_API_KEY)"     # Kakao REST API 키
secret = "env(KAKAO_CLIENT_SECRET)"       # Kakao Login Client Secret (콘솔에서 활성화 필요)
```

### 6. core 계약 스케치 (house style 미러)

```typescript
// constants.ts — planChannelName/pollChannelName 미러 [VERIFIED: constants.ts L211-237]
export const ShareMode = ['dates', 'places', 'both'] as const;   // 0025 CHECK와 문자 단위 일치 (21-02 회귀 가드 선례)
export type ShareModeType = (typeof ShareMode)[number];
export const MOA_CHANNEL_PREFIX = 'moa:';
export function moaChannelName(tripId: string): string {
  return `moa:${tripId}`;                  // Phase 26: presence+message+vote+place_added 단일 채널
}

// schemas/trip.ts — 온보딩 draft (dates optional, TripCreateSchema와 공존)
export const TripCreateDraftSchema = z
  .object({
    title: z.string().min(1).max(Limits.TripTitleMax),
    city_code: z.string().max(20),
    start_date: z.string().date().nullable(),   // 미정 = null (ONBOARD-04)
    end_date: z.string().date().nullable(),
    companion: z.string().max(20).nullable(),   // 누구랑 (0025 컬럼 미러)
  })
  .refine((v) => (v.start_date === null) === (v.end_date === null), { message: 'dates must be both set or both null' })
  .refine((v) => v.start_date === null || v.end_date! >= v.start_date, { message: 'end_date must be >= start_date' });

// queries/memberships.ts — joinSharedTrip 미러 [VERIFIED: memberships.ts L8-15]
export async function joinMoa(client: MoajoaSupabaseClient, shareSlug: string): Promise<string> {
  const { data, error } = await client.rpc('join_moa', { p_share_slug: shareSlug });
  if (error) throw error;
  return data as string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 게스트 = device_token localStorage (0018 poll) | 익명 인증 auth.uid (Phase 25에서 `device_token := auth.uid`) | v2.1 설계 승인 (2026-07-07) | 0018 poll RPC는 그대로 두고 호출부만 토큰 소스 교체 — 마이그레이션 불필요 |
| 웹 생성 UI 금지 (D26) | 웹 = 입력·저장·편집 풀 서피스 | v2.1 (PROJECT.md 이미 반영, CLAUDE.md는 이번 phase) | 성공 기준 5 |
| `/t/[slug]` 열람 + `/poll/[code]` 투표 분리 | `/t/[slug]` share_mode 통합 (Phase 25) | v2.1 | 이번 phase는 share_mode 컬럼만 놓음. `/poll/[code]`는 레거시 호환 유지 (Out of Scope 명시) |
| join_shared_trip role='voter' 고정 | join_moa share_mode 기반 editor/voter | 이번 phase | 기존 RPC는 삭제하지 않음 — iOS 동결 (기존 호출부 보존) |

**Deprecated/outdated:** 없음 — 기존 RPC/스키마 제거 대상 없음 (iOS 동결 + append-only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | join_moa role 매핑: places/both→editor, dates→voter | Pattern 2 | 게스트 권한 과다/과소 — Phase 25 SHARE-03 동작 어긋남. discuss/plan에서 확정 권장 |
| A2 | trip_messages에 nickname 비정규화(date_comments 미러) vs profiles 조인 | Pattern 3 | 스키마 재작업(append-only라 새 마이그레이션 필요). Phase 26 렌더 방식에 영향 |
| A3 | companion = 자유 텍스트(길이 CHECK)로 충분, enum 불필요 | 계약 스케치 | 온보딩 UI(Phase 24)가 칩 선택이면 enum이 나았을 수 있음 — core 상수 추가로 흡수 가능 |
| A4 | 이미 share된 trip의 재-join 시 role 유지(`on conflict do nothing`) — 모드 변경 후 자동 승격 없음 | Pattern 2 | 호스트가 dates→both로 바꾸면 기존 voter 게스트가 수동 재조치 필요. UX 결정 사항 |
| A5 | 빈 body `POST /auth/v1/signup`의 정확한 응답 shape (curl 검증용) | Code Example 3 | 실행 시 즉시 확인됨 — supabase-js `signInAnonymously`가 공식 경로라 클라이언트 통합엔 무영향 |
| A6 | pgbench/psql 14 클라이언트 ↔ PG17 서버 호환 (이 용도 한정) | Pitfall 8 | xargs -P psql 병렬 방식으로 대체 가능 — 하네스 선택지 2개 |
| A7 | seq 컬럼/카운터 네이밍 (`seq_no`/`last_place_seq`) | 전반 | 순수 네이밍 — 플래너 재량 |

## Open Questions

1. **원격(linked prod) DB의 마이그레이션 적용 상태**
   - What we know: 로컬은 0016~0023 클린. 17-03에서 "remote reset deferred" 기록, 0022/0023의 원격 push 여부 미기록
   - What's unclear: `supabase db push` 시점에 원격이 어디까지 적용돼 있는지
   - Recommendation: plan에 `supabase migration list` 선행 확인 태스크 (원격 push가 이 phase 범위인지 자체도 결정 필요 — 성공 기준은 전부 로컬 검증 가능)
2. **Kakao console 준비물 리드타임**
   - What we know: REST API key·Client Secret·Redirect URI·동의항목 설정 필요. account_email은 Biz App 전용
   - What's unclear: 사용자의 Kakao developers 앱 존재 여부, 동의항목 심사 소요
   - Recommendation: human-action 체크포인트로 분리 (21-04 Task 5 선례). 성공 기준 4는 "설정되어 플로우 시작 가능"까지만 — e2e는 Phase 24
3. **shareMoa의 share_mode 변경 시맨틱** — 이미 공유된 모아의 모드 변경 허용? 날짜 확정 모아의 'dates' 숨김(SHARE-01)은 클라이언트 몫인가 DB CHECK인가 → 클라이언트 몫 권장(DB는 3값 CHECK만), plan에서 확정
4. **PlaceSchema의 `board_id` 레거시 드리프트** — DB는 trip_id인데 PlaceSchema는 board_id `[VERIFIED: place.ts L15]`. seq_no 추가 시 같이 고칠지(소비처 캐스케이드 위험) 그대로 둘지 — Surgical Changes 원칙상 **그대로 두고 seq_no만 추가** 권장, 드리프트는 별도 기록

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| supabase CLI | db reset·types·config | ✓ | 2.101.0 | — |
| colima + docker | supabase local | ✓ (가동 중) | colima 0.10.3 / docker 29.6.0 | — |
| supabase 로컬 스택 | 전체 검증 | ✓ (실행 중, auth health 200) | PG 17.6 | `pnpm supabase:start` |
| psql | SQL 검증·하네스 | ✓ | 14.18 | supabase db 컨테이너 내 psql |
| pgbench | 동시성 부하 (선택) | ✓ | 14.18 | `xargs -P` + psql (Code Example 2) |
| node / pnpm | core·api 테스트 | ✓ | v22.17.0 / 9.12.0 | — |
| Kakao developers 계정/앱 | 성공 기준 4 (대시보드·콘솔) | 미확인 (사용자 계정) | — | 로컬 config만 선행, 콘솔은 human-action |
| Supabase 대시보드 접근 | 프로덕션 provider 설정 | 미확인 (사용자 계정) | — | human-action 체크포인트 |

**Missing dependencies with no fallback:** 없음 (자동화 가능 범위 내 전부 가용)
**Missing dependencies with fallback:** Kakao console·Supabase 대시보드 — human-action으로 분리 가능, 로컬 검증은 차단 안 됨

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (packages/core·packages/api, 기존 설정) + psql/bash SQL 하네스 + curl |
| Config file | `packages/core/vitest.config.ts` (존재) / api 동일 / SQL 하네스는 **없음 — Wave 0** |
| Quick run command | `pnpm --filter @moajoa/core test` |
| Full suite command | `pnpm --filter @moajoa/core test && pnpm --filter @moajoa/api test && pnpm --filter @moajoa/core typecheck && pnpm --filter @moajoa/api typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOA-01 | 동시 삽입 무중복·무결번 | SQL 동시성 | Code Example 2 하네스 (`xargs -P 8` psql → count=distinct=max 단언) | ❌ Wave 0 |
| MOA-01 | 소프트삭제·복원 후 순번 유지 + hard delete 후 무재사용 | SQL | Code Example 2 (3) 블록 — 기대값 41 / 3 유지 | ❌ Wave 0 |
| 기준 1 | db reset 클린 (42P17=0) + 타입 재생성 + 테스트 그린 | integration | `pnpm supabase:reset && pnpm supabase:types && pnpm --filter @moajoa/core test && pnpm --filter @moajoa/api test` | ✅ (스크립트 존재) |
| 기준 3 | 익명 세션 발급 (is_anonymous 클레임) | curl smoke | Code Example 3 | ❌ Wave 0 (스크립트화) |
| 기준 3 | join_moa share_mode별 editor/voter 부여 | curl + psql | Code Example 4 + role 단언 (both→editor, dates→voter 두 케이스) | ❌ Wave 0 |
| 기준 4 | 카카오 config 존재 | grep + manual | `grep -A3 'auth.external.kakao' supabase/config.toml`; 대시보드는 human-verify | ✅ grep / ❌ 대시보드(human) |
| 기준 5 | CLAUDE.md D26 반전 | grep | `grep -n '보드 생성' CLAUDE.md` — 금지 불릿 부재 + 반전 문구 존재 단언 | ✅ |
| 계약 | ShareMode 등 enum이 DB CHECK와 문자 일치 | unit (vitest) | core 신규 테스트 `.toEqual` 회귀 가드 (21-02 선례) | ❌ Wave 0 (신규 스키마와 함께 TDD) |

### Sampling Rate
- **Per task commit:** `pnpm --filter @moajoa/core test` (또는 해당 패키지 test) + typecheck
- **Per wave merge:** full suite command + (SQL wave면) `pnpm supabase:reset` 클린 확인
- **Phase gate:** full suite + SQL 동시성 하네스 + curl smoke 전부 green → `/gsd-verify-work`

### Wave 0 Gaps
- [ ] SQL 동시성 하네스 스크립트 (예: `supabase/tests/place_seq_concurrency.sh` — 위치는 플래너 재량; 21-01은 인라인 BEGIN…ROLLBACK psql 선례)
- [ ] 익명 세션 + join_moa curl smoke 스크립트
- [ ] core 신규 스키마 테스트 파일 (`chat.test.ts`, trip.ts draft 테스트, constants ShareMode 가드) — 신규 코드와 함께 TDD
- 프레임워크 설치: 불필요 (vitest 기설정)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase GoTrue (익명 + Kakao OAuth) — 커스텀 인증 로직 0 |
| V3 Session Management | yes | GoTrue JWT + refresh rotation (config 기존 설정 유지) |
| V4 Access Control | yes | RLS deny-by-default + SECURITY DEFINER 헬퍼 + join_moa role 최소부여 (editor는 share_mode 명시 시만) |
| V5 Input Validation | yes | Zod (`@moajoa/core/schemas`) + SQL CHECK (share_mode 3값, body 길이) + RPC 내 인자 검증 (0018 선례) |
| V6 Cryptography | yes | slug/코드 = `gen_random_bytes` 기존 idiom (~60bit) — 직접 구현 금지 |

### Known Threat Patterns for 이 phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 익명 계정 대량 생성 (DB 팽창·비용) | DoS | GoTrue rate limit 30/hr/IP (기본) `[CITED]`; 프로덕션 CAPTCHA는 defer 기록 |
| 익명 세션의 추출 EF 비용 남용 | Elevation/DoS | **이번 phase에서 열리는 표면** — SEC-01(Phase 27) 멤버십 게이트가 닫음. 그 전 외부 노출 금지가 마일스톤 전제 (Pitfall 6) |
| seq_no 클라이언트 위조 | Tampering | 트리거가 클라이언트 값 무시하고 항상 채번 + unique(trip_id, seq_no) |
| join_moa로 임의 trip 잠입 | Elevation | slug = bearer 검증 + `visibility in ('shared','public')` 게이트 + role은 서버 결정 (클라이언트 role 인자 없음) — join_shared_trip 검증 shape 유지 |
| trip_messages 크로스 trip 읽기/쓰기 | Info Disclosure / Tampering | SELECT=can_read_trip, INSERT=`user_id=auth.uid() and can_vote_trip` — 0023 CR-01 교훈(WITH CHECK에 trip 접근 검사) 반영 |
| RLS 재귀 (42P17) | DoS | 헬퍼 경유 only — db reset이 게이트 (성공 기준 1) |
| Kakao 시크릿 유출 | Info Disclosure | env() 치환 + `.env.local.example` placeholder만 커밋 (§4.7) |

## Sources

### Primary (HIGH confidence)
- 레포 직접 검증: `supabase/migrations/0016·0018·0023`, `supabase/config.toml`, `packages/core/src/{constants.ts,schemas/trip.ts,schemas/place.ts}`, `packages/api/src/{client.ts,queries/trips.ts,queries/memberships.ts}`, `apps/web/lib/supabase/browser.ts`, 루트 `package.json`, `.planning/{ROADMAP,STATE,PROJECT,REQUIREMENTS}.md`
- 로컬 실행 검증: PG 17.6 `hashtextextended` 동작, places 스키마/행수, supabase 스택 health, 도구 버전 일괄
- [postgresql.org/docs/17/functions-admin.html](https://www.postgresql.org/docs/17/functions-admin.html) — pg_advisory_xact_lock 시맨틱 (트랜잭션 해제·블로킹·2인자 변형)
- [supabase.com/docs/guides/auth/auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous) — authenticated role·is_anonymous 클레임·rate limit·linkIdentity
- [supabase.com/docs/guides/local-development/cli/config](https://supabase.com/docs/guides/local-development/cli/config) — enable_anonymous_sign_ins 키·kakao provider 지원·rate_limit.anonymous_users

### Secondary (MEDIUM confidence)
- [supabase.com/docs/guides/auth/social-login/auth-kakao](https://supabase.com/docs/guides/auth/social-login/auth-kakao) — Kakao console 절차 (콘솔 UI는 변동 가능)
- [github.com/supabase/auth-js/issues/943](https://github.com/supabase/auth-js/issues/943) — 빈 email/password signup → anonymous 동작 (curl shape 근거)

### Tertiary (LOW confidence)
- pgbench 14↔PG17 커스텀 스크립트 호환 (A6 — 실행 시 확인, 대체 하네스 존재)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 신규 의존성 0, 전부 로컬 검증
- Architecture (0024/0025 패턴): HIGH — advisory lock은 PG 공식 문서 + 로컬 실검증, 나머지는 레포 내 검증된 선례 미러. 세부 네이밍/role 매핑만 ASSUMED (A1~A4)
- Pitfalls: HIGH — hard-delete 재사용·트리거 RLS 권한은 코드 판독으로 도출, 42P17·colima는 프로젝트 이력에서 확인

**Research date:** 2026-07-07
**Valid until:** 2026-08-07 (안정 스택 — supabase CLI/config 키 변동만 주의)
