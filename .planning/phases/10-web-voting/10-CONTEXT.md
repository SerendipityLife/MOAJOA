# Phase 10: 웹 투표 (협업) - Context

**Gathered:** 2026-06-08 (autonomous — discuss 생략, 코드 정찰 기반)
**Status:** Ready for planning
**Source:** SESSION-NOTES §3(웹 = 조회+공유+투표) + 코드 정찰. 백엔드 데이터/RLS는 대부분 이미 존재 → 이 phase는 "self-join + 웹 투표 UI"가 핵심.

<domain>
## Phase Boundary

**IN (COLLAB-01/02):** 공유 보드 링크(slug)를 받은 사용자가 무설치 웹에서 **멤버로 참여**(COLLAB-01)하고, 로그인 멤버가 핀에 **❤️ 투표**(COLLAB-02)하며, `love/멤버 ≥ 0.5` 핀이 "확정"으로 필터/강조된다.

**OUT:** iOS 투표 UI(앱은 캡처/편집 전담 — SESSION-NOTES §3), 댓글(Out of Scope), 'love' 외 투표 종류(스키마 `kind in ('love')` 고정), 이메일 초대 발송(InviteCreate는 기존; 이번은 slug 자가참여).
</domain>

<evidence>
## Codebase Evidence (정찰 — 대부분 이미 존재)

1. **votes 테이블 + RLS 완비** (`0001`): `votes: read if can read board` / `insert if can_vote_board` / `delete own`. `votes_default_user_id()` 트리거가 `auth.uid()` 자동 주입. `vote_counts_for_places(uuid[])` RPC가 love 카운트 반환 — **`authenticated, anon` 둘 다 grant**(공개 페이지서 집계 가능).
2. **`can_vote_board(board_id)`** SECURITY DEFINER 헬퍼 존재: owner이거나 `memberships.accepted_at is not null` 멤버면 true. → **투표 권한 RLS는 이미 배선됨.**
3. **memberships** RLS: read own+owner / **owner insert** / **user can accept own invite(update accepted_at)** / owner|self delete. role enum = `owner|editor|voter` (**`voter`** 역할이 이 목적용으로 이미 존재).
4. **API 헬퍼 존재** (`packages/api/src/queries/votes.ts`): `castVote`(idempotent upsert), `retractVote`(delete), `getVoteCounts`(RPC). → 투표 클라 호출 재사용.
5. **"확정" 규칙은 이미 순수 함수** (`packages/core` `vote.ts`): `isPlaceConfirmed(loveCount, totalMembers) = love/total ≥ 0.5`, `isPlaceCandidate(love) = love ≥ 1`. → UI는 이 함수 재사용(중복 금지).
6. **웹 공개 보드**: `apps/web/app/b/[slug]/page.tsx`(SSR, 비로그인 public, revalidateTag 캐시) + `_components/{public-board-map, place-summary-list}`. **클라 island 패턴 존재**: `boards/[id]/_components/{add-link-form, retry-extraction-button}.tsx`가 `'use client'` 컴포넌트.
7. **누락(이 phase가 채움):** ① slug **자가참여 정책 없음**(insert는 owner만) → 새 SECURITY DEFINER RPC 필요. ② **웹 투표 UI 없음**. ③ "확정" 분모(멤버 수) 헬퍼 없음.
</evidence>

<decisions>
## Implementation Decisions (autonomous — 추천 선택, AUTONOMOUS-LOG 기록)

### A. 인증 모델 (회색지대 → 추천 결정)
- **투표는 로그인한 멤버만.** 익명 투표 X (RLS·트리거가 `auth.uid()` 의존; 익명은 어뷰즈/중복 표 위험). 추천 흐름: 공유 링크 → `/b/[slug]` → "참여해서 투표하기" → **매직링크 로그인**(기존 web auth) → **slug 자가참여** → ❤️ 투표.

### B. 자가참여 (COLLAB-01) — 새 SECURITY DEFINER RPC
- 새 마이그레이션 `0009_join_shared_board.sql`: `join_shared_board(p_share_slug text)` — `auth.uid()`에 대해, `visibility in ('shared','public')` & `share_slug=p_share_slug` 보드에 `memberships(role='voter', accepted_at=now())` upsert(이미 멤버면 no-op), board_id 반환. `security definer set search_path=public`, grant authenticated. **slug 소지 = bearer 초대**(친구 여행 도구 공유 모델). append-only.
- (`+ accepted_member_count(p_board_id uuid)` RPC, grant authenticated+anon — "확정" 분모용.)

### C. 투표 표면 (COLLAB-02) — 기존 `/b/[slug]`에 클라 island
- 단일 공유 URL 유지(=acquisition 핵심) + 공개 SSR 캐시 유지. 투표 affordance는 **클라이언트 컴포넌트**로 하이드레이트(브라우저 세션 확인). 새 라우트 X.
  - 비로그인 → "참여해서 투표하기" CTA(로그인).
  - 로그인+멤버 → 핀별 ❤️ 토글 + 카운트 + **"확정" 필터/강조**(`isPlaceConfirmed`).
  - 로그인+비멤버 → "이 보드에 참여하기"(`join_shared_board`) CTA.
- 투표 호출 = 기존 `castVote`/`retractVote`/`getVoteCounts`. 분모 = `accepted_member_count`.

### D. 범위/검증
- **autonomous:** 마이그레이션 SQL 작성, api 헬퍼(`joinSharedBoard`, `getAcceptedMemberCount`), 웹 투표 island + 필터, 단위 테스트(vitest/RTL: 비로그인/멤버/비멤버/확정).
- **autonomous:false 모닝 게이트:** `supabase db push`(0009) + `pnpm supabase:types` + 실브라우저 라이브 흐름(로그인→참여→투표→확정) 검증.

### E. CLAUDE.md 웹 역할 갱신 → **모닝 게이트(자동 편집 X)**
- SESSION-NOTES §3가 사전 지정: `web/ = 열람·공개` → `열람·공개+투표 참여`, `ios/ = 저장·공유·캡처·편집` 중심. 하드룰(웹 보드생성·링크추가 금지)은 **유지**. 거버넌스 문서라 자동 편집 대신 **추천 diff를 Morning to-dos에 제시**, 사용자 확인 후 적용.

## Claude's Discretion (planner)
- island 컴포넌트 분해(VoteButton/확정 토글), 카운트 fetch 타이밍(서버 prefetch vs 클라), 필터 UX 디테일 — 기존 토큰/패턴 재사용.
</decisions>

<canonical_refs>
- `supabase/migrations/0001_init.sql` — votes/memberships/RLS/`can_vote_board`/`vote_counts_for_places` (재사용·참고), `0002` RLS 재귀 해소 패턴
- `supabase/migrations/0009_join_shared_board.sql` — **신규**(append-only): `join_shared_board` + `accepted_member_count` SECURITY DEFINER RPC
- `packages/api/src/queries/votes.ts` — `castVote/retractVote/getVoteCounts` 재사용. 신규 `memberships.ts`(joinSharedBoard, getAcceptedMemberCount)
- `packages/core/src/schemas/vote.ts` — `isPlaceConfirmed/isPlaceCandidate` 재사용(중복 금지)
- `apps/web/app/b/[slug]/page.tsx` + `_components/` — 투표 island 추가 지점. 클라 island 패턴: `boards/[id]/_components/retry-extraction-button.tsx`
- `docs/SESSION-NOTES-2026-06-07.md` §3
</canonical_refs>

<constraints>
- RLS/정책 변경은 **SECURITY DEFINER 헬퍼 경유**(CLAUDE.md 4.4) + append-only **새** 마이그레이션. 적용(`db push`)은 모닝 게이트.
- 웹 새 "보드 생성·링크 추가" UI 금지(하드룰 유지) — 투표/참여 UI는 허용(SESSION-NOTES §3, 사용자 확인).
- 'love' 외 투표 종류 추가 금지(스키마 고정). `isPlaceConfirmed` 단일 출처 재사용.
- 외부 입력 Zod validate. `.js` import 금지. 공개 SSR 캐시 깨지 않게(투표는 클라 island).
- 레거시(멤버 0·투표 0) 보드에서 UI 안 깨짐.
</constraints>

<deferred>
- iOS 투표 UI (앱은 캡처/편집 — out of scope)
- 이메일 초대 발송 흐름(기존 InviteCreate; 이번은 slug 자가참여만)
- 'confirmed' 알림 트리거(vote.ts 주석의 notification — v2)
</deferred>

---
*Phase: 10-web-voting*
*Context: 2026-06-08 autonomous, 코드 정찰 기반(백엔드 대부분 기존)*
