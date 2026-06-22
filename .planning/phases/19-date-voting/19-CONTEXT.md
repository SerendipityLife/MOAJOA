# Phase 19: Date Voting (일정 미정 분기) - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

일정이 **미정**일 때: 호스트가 **날짜 투표**를 만들고 → 초대 링크/코드로 일행을 부르고 → 일행이 **무설치(웹)**로 가능한 날짜에 투표하고 → 호스트가 집계를 보고 **확정**하면 그 날짜가 **해당 trip의 일정(start/end_date)으로 전환**된다. 투표 페이지에는 익명 **댓글 스레드**가 함께 붙는다. (POLL-01/02/03)

**In scope:** date_polls/options/votes/comments 데이터 모델(0018 append-only) + anon-write RLS(코드=bearer) · 온보딩 "미정" 카드 활성화 → 날짜없는 trip create · plan 탭 상단 "날짜 투표" 관리 카드(생성·집계·초대·확정) · 웹 비로그인 투표 island(닉네임+기기토큰) · 두 투표 모드(범위형 + per-day 그리드) · 호스트 확정 → trip 날짜 UPDATE · 확정 결과 화면 + 가입 전환 CTA · 익명 flat 댓글 스레드(실시간).

**Out of scope:** *장소* 투표 UI(기존 votes/Phase 18) · 예약(Phase 20) · 시간대/시각 단위 투표 · 마감일 자동확정 · 이메일 초대 발송 인프라 · 중첩 답글/멘션/이미지 댓글.
</domain>

<decisions>
## Implementation Decisions

### 투표자 신원·초대 (Area 1)
- **D-01:** 투표자 = **비로그인**(앱·계정 불필요) + **닉네임 필수** + 기기 토큰(localStorage UUID)으로 중복 방지. "무설치"=완전 익명(계정 없음)이되, 호스트 집계가 "누가 어떤 날짜 되는지" 보이도록 닉네임으로 식별. 이름 없는 진짜 익명은 집계 무의미 → 금지. **Phase 10의 "익명 X" 결정은 *장소* 투표 맥락 — *날짜* 투표는 pre-trip 일회성 조율이라 익명 허용으로 분기.**
- **D-02:** 초대 = **링크 + 코드**. poll code가 **bearer capability** — 코드/링크 소지 = 투표·댓글 권한. (trip `share_slug`/`ensure_share_slug` 재사용 검토하되, `join_shared_trip`은 로그인 필요라 호스트/가입 전환에만 쓰고, 익명 투표 경로는 별도 코드 검증.)
- **D-03:** 가입(고객) 전환 = **확정 결과 화면 중심**. 투표 중 로그인 0(마찰=이탈). 확정 후 "이 여행에 함께하기" → 매직링크 가입(확정 일정·플랜·예약 payoff가 생긴 뒤). 투표 직후엔 optional soft nudge("결과 정해지면 알림 받기")만, 페이월 아님.

### Trip ↔ Poll 생애주기·데이터 모델 (Area 2)
- **D-04:** 온보딩 "미정" 선택 → **날짜 없는 trip 즉시 생성**(trips.start/end_date는 DB nullable, 0007) + `date_polls.trip_id` FK로 poll 부착. 호스트는 바로 trip 진입 → 장소 모으면서 동시에 날짜 투표. 확정 시 `trip.start_date/end_date` UPDATE만. share_slug·4탭 셸 전부 재사용. trip 목록엔 "일정 미정" 배지 노출. → **날짜 optional한 새 create 경로 필요**(TripCreateSchema는 날짜 필수 D-09라 미정용 변형/RPC 추가).
- **D-05:** 호스트 poll 관리 표면 = **plan 탭 상단 카드**(날짜 미정 trip일 때만). 진행상황·집계·초대 링크/코드·확정 버튼. plan.tsx(Phase 18 상태머신)에 surgical 분기 추가. 확정되면 카드 사라지고 일반 플랜 진행.
- **D-06:** 온보딩 "미정" 카드 활성화 — 현재 disabled(17-05 D-11, neutral "곧 제공" 스텁). 이 phase가 활성화해 미정 trip create 플로우 진입점으로 만든다.

### 투표 대상 구조 (Area 3)
- **D-07:** **두 투표 모드**, 호스트가 생성 시 선택. `date_polls.mode ['range','grid']`.
  - **range:** 호스트가 후보 날짜범위 N개 제안 → `date_poll_options(start_date, end_date)`. 투표자는 각 옵션에 가능/불가.
  - **grid:** poll 윈도우(예: 한 달) + per-day 투표(when2meet식). 집계는 날짜별 가능 카운트 + 연속블록 추론.
  - 데이터 모델은 통합 votes(availability) 위에 두 모드를 얹는다(단일일 = start==end 자연 확장).
- **D-08:** 가능성 = **가능/불가 2단**(binary enum). 호스트 최종확정이 타이브레이커라 "가능하면" 중간값 불필요(도그푸딩서 필요성 보이면 enum에 값 추가로 확장). maybe 과다 → 재투표 강제 없음(자동확정 아님).

### 집계·확정 전환 (Area 4)
- **D-09:** 확정 = **호스트만**. 집계는 모두 열람(anon-grant). range=후보 옵션 하나 선택, grid=날짜별 집계 보고 연속블록(N박) 선택 → 어느 모드든 최종 `(start_date, end_date)`가 `trip` 날짜로 기록. **최다득표 자동확정 없음**(동률·소수의견·호스트 사정은 사람이 판단).
- **D-10:** 확정 후 = poll `status='closed'`(결과 읽기전용 보존, 투표 마감). trip은 일정 확정 상태로 전환 → plan 탭 일반 플랜 진행. 웹 투표페이지는 "확정: 6/14–16" 결과 + "이 여행에 함께하기" 가입 CTA로 전환. 재투표 = 호스트가 새 poll 생성(재오픈 없음 — 상태/날짜 되돌림 복잡 회피).

### 댓글 스레드 (Area 4 추가 — 사용자 결정, 추천 override)
- **D-11:** **댓글 스레드를 이번 phase에 포함**한다(사용자 명시 결정). MVP 제약으로 범위 고정:
  - poll(trip)당 **단일 flat 스레드**(중첩 답글/멘션/이미지 X).
  - 작성자 = 투표자와 **동일 익명 모델**(닉네임 + 기기토큰, 로그인 X) + 호스트.
  - 삭제 = 호스트 any / 작성자 own(기기토큰 일치).
  - 실시간 = 기존 Supabase broadcast 패턴 재사용(`subscribeExtractProgress`/`subscribePlanProgress`의 `*:{trip_id}` 채널 idiom).
  - 어뷰즈 = votes와 동일 기기토큰 + 레이트 제한.
  - **익명 write는 votes로 이미 구축할 보안면(anon RLS + 코드=bearer)을 재사용 → 증분이지 새 모델 아님.**

### Claude's Discretion
- 옵션 개수 상한(2–10 권장), poll code 형식(trip share_slug 파생 vs 독립 코드), 정확한 테이블 분할(votes 통합 vs range/grid 분리, comments 테이블), 실시간 채널명, 웹 라우트(`/poll/[code]` 신규 vs `/t/[slug]` 재사용), soft nudge 정확 문구·배치, 기기토큰 생성/저장 방식.
- **권장(보안):** 익명 INSERT는 RLS 직접 anon insert보다, **코드를 검증한 뒤 삽입하는 SECURITY DEFINER RPC(anon grant)** 패턴이 안전(0009 join_shared_trip / vote_counts_for_places anon-grant idiom 미러).

### 범위 노트 (planner 주의)
- 두 투표 모드(D-07) + 댓글 스레드(D-11)로 phase가 커짐 → **추정 ~5 플랜**(초기 ROADMAP 추정 3에서 증가). 대략: (1) 0018 마이그레이션 + anon RLS/RPC 헬퍼, (2) @moajoa/core 스키마 + @moajoa/api 쿼리, (3) iOS 미정 create + plan 탭 관리 카드 + 확정, (4) 웹 비로그인 투표 island(두 모드) + 집계 + 가입 CTA, (5) 댓글 스레드(익명 + 실시간 + 모더레이션).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항·로드맵
- `.planning/ROADMAP.md` §"Phase 19: Date Voting" — goal, success criteria, plans 추정
- `.planning/REQUIREMENTS.md` — POLL-01(투표 생성+초대), POLL-02(무설치 웹 투표), POLL-03(집계→일정 전환)

### 데이터·RLS (append-only 새 마이그레이션 0018)
- `supabase/migrations/0016_trips_baseline.sql` — trips(start/end_date nullable), `share_slug` + `ensure_share_slug` 트리거, `join_shared_trip`(로그인), `public_trip_view`(anon grant), `votes`(장소투표)/`can_vote_trip`, `accepted_member_count`(anon), `vote_counts_for_places`(anon grant) — **SECURITY DEFINER 헬퍼 RLS 패턴 + anon-grant RPC idiom을 0018이 미러**. ⚠️ 기존 SQL 수정 금지, 0018 새 파일만.
- `packages/api/src/types/database.ts` — 0018 적용 후 `pnpm supabase:types` 재생성 대상.

### 클라이언트 통합 지점
- `apps/ios/app/onboarding.tsx` — "미정" 카드(현재 disabled, L65-81) 활성화 → 미정 trip create 진입.
- `apps/ios/app/trip/create.tsx` — "정해짐" create 폼(날짜 필수); 미정 create 경로(날짜 optional) 분기 참조.
- `apps/ios/app/trip/[id]/plan.tsx` (Phase 18) — plan 탭 상단 "날짜 투표" 관리 카드 surgical 확장 지점(상태머신 분기).
- `apps/web/app/t/[slug]/` + `_components/vote-island.tsx` — 웹 클라 island 패턴(비로그인 hydrate, 공개 SSR 캐시 cookies-free 미접촉). 신규 날짜투표 island가 미러.
- `apps/ios/lib/realtime.ts` (`subscribeExtractProgress`/`subscribePlanProgress`) — 실시간 구독 패턴(투표 진행·댓글 재사용).
- `packages/core/src/schemas/trip.ts` (`TripCreateSchema`) — 날짜 optional create 변형 추가 지점.

### 이전 phase 결정
- `.planning/phases/10-web-voting/10-CONTEXT.md` — slug=bearer 초대, anon-grant 집계 RPC, **단일 공유 URL**, 공개 SSR 캐시 GOTCHA(client island로 hydrate), **login-gated 결정**(이번 phase는 익명으로 의도적 분기 — 차이 명시).
- `.planning/phases/18-auto-plan-ai/18-CONTEXT.md` — `plans.collaborative` 플래그(D-14, 실제 투표는 Phase 19 위임), `planChannelName` 실시간 채널 빌더 패턴.
- `.planning/phases/17-trip-foundation-ia/17-CONTEXT.md` — trips-native 식별자 계약, 온보딩 미정 분기(D-11), share_slug 재사용.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `share_slug` + `ensure_share_slug` 트리거(0016) — trip 공유 슬러그 자동 생성. 초대 링크 기반.
- anon-grant RPC idiom(`vote_counts_for_places`, `public_trip_view`, `accepted_member_count`) — 공개 집계/읽기를 anon에 grant하는 검증된 패턴 → 날짜 집계 RPC 미러.
- `join_shared_trip`(0009 패턴) — 코드 검증 후 멤버십 upsert SECURITY DEFINER RPC. **익명 vote/comment 삽입 RPC의 템플릿**(코드=bearer 검증 → 삽입).
- 웹 `vote-island.tsx` — 'use client' island, 비로그인 hydrate, 공개 SSR 캐시 미접촉. 신규 date-vote island 구조 참조.
- iOS `realtime.ts` subscribe 패턴 — 투표 진행·댓글 실시간에 재사용.
- 4탭 trip 셸 + trip create 폼 + 온보딩 분기 — 미정 경로가 끼어드는 자리.

### Established Patterns
- **RLS = SECURITY DEFINER 헬퍼 경유**(직접 cross-table EXISTS 금지, 42P17 가드). 익명 경로도 RPC로.
- **append-only 마이그레이션** — 0018 새 번호만. 기존 0016 무수정.
- 공개 SSR 캐시는 cookies-free(unstable_cache) — 투표/댓글 상태는 client island로 hydrate.
- 외부 입력 Zod validate(@moajoa/core/schemas).

### Integration Points
- 온보딩 미정 카드 → trip create(날짜 optional) → plan 탭 관리 카드.
- 웹 `/t/[slug]` 트리(또는 신규 `/poll/[code]`) → 비로그인 투표 island + 댓글.

### ⚠️ 신규 보안면 (Phase 10이 회피했던 것)
- **anon INSERT**(votes + comments) — 익명 쓰기. **poll code = bearer capability로 스코프** + 기기토큰 dedup + 레이트 제한으로 완화. RLS 직접 anon insert보다 **코드 검증 SECURITY DEFINER RPC(anon grant)** 권장. researcher/security가 어뷰즈 모델 검토 필요.
</code_context>

<specifics>
## Specific Ideas

- 투표 UX 레퍼런스: range 모드 = Doodle "specific dates"(후보 범위 카드 + 가능/불가 토글), grid 모드 = when2meet(달력 per-day 칠하기).
- 확정 결과 화면이 **고객 전환의 핵심 지점** — payoff(확정 일정) 뒤에 "이 여행에 함께하기" 가입.
- 댓글 = 익명(닉네임) **flat** 스레드, 실시간, 호스트 모더레이션.
- 호스트는 항상 로그인 상태(온보딩 진입). 익명은 *초대받은 일행*만.
</specifics>

<deferred>
## Deferred Ideas

- **마감일 자동확정** — 호스트 확정 + 마감일 지나면 최다 자동. 이번엔 호스트 수동확정만.
- **3단 가능성(가능/가능하면/불가)** — 도그푸딩에서 maybe 필요성 보이면 enum 값 추가로 확장.
- **댓글 고도화** — 중첩 답글·멘션·이미지·이모지 반응. 이번엔 flat 스레드만.
- **이메일 초대 발송** — 링크/코드 공유만(카톡 등 OS 공유). 이메일 발송 인프라는 Phase 21 메일 인프라와 연계 후속.
- **poll 재오픈/재확정** — 확정 후 되돌림. 재투표는 새 poll 생성으로 대체.
- **장소 투표를 날짜 poll에 결합** — 날짜+장소 동시 투표. 별개 흐름(장소투표는 기존 votes/Phase 18).

</deferred>

---

*Phase: 19-date-voting*
*Context gathered: 2026-06-23*
