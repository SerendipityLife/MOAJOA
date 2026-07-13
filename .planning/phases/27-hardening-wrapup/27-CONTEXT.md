# Phase 27: Hardening & 마감 - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Mode:** 사용자 지시 "추천 방향으로 자동" — 전 회색지대를 권장안으로 잠금 (개별 Q&A 생략, 결정 근거는 각 D 항목에 기록)

<domain>
## Phase Boundary

테스트 버전을 외부 노출 가능한 상태로 마감한다:
1. **SEC-01** — 추출 트리거(Edge Function) 멤버십 게이트: 해당 모아의 멤버가 아닌 사용자(익명 세션 포함)의 추출 호출 거부
2. **NAME-01** — 유저 대면 카피 스윕 완성: 보드→"모아", 가고싶어→"찜" (코드 식별자 유지, 테스트 단언 같은 커밋 동기화)
3. WORKSTREAMS·ARCHITECTURE 문서 역할 기술 수정 + revalidate 확인
4. 2인극 UAT 전체 통과 (SC-3 시나리오)

새 기능 없음 — 게이트·카피·문서·검증만. iOS 전면 동결 유지.

</domain>

<decisions>
## Implementation Decisions

### SEC-01: 추출 게이트 설계
- **D-01: extract-youtube에 generate-plan의 멤버십 체크(T-18-09)를 미러.** 스카우트 실측: `extract-youtube`는 `verify_jwt=true` + `auth.getUser` 게이트(T-18-08, anon-key/service 토큰 거부)까지만 있고 **멤버십 체크가 없음** — 익명 세션도 real user session이라 getUser를 통과하므로 비멤버가 임의 `link_id`로 유료 LLM 왕복을 트리거 가능(SEC-01의 정확한 갭). `generate-plan/index.ts`가 이미 같은 EF에서 복사한 getUser 게이트 위에 can_edit_trip 미러 체크(T-18-09: service-role 쿼리로 owner OR accepted owner/editor membership, **유료 호출 전에** 검사)를 얹은 하우스 패턴이 있음 — extract-youtube는 `link_id → links.board_id(trip)` 경유로 같은 체크를 추가한다. 신규 마이그레이션·RPC 0 (기대).
- **D-02: 거부 응답은 generate-plan과 동일 포맷** — 유료 작업 전 403 `jsonError`. 클라이언트 신규 UI 0: `triggerExtraction`은 대부분 fire-and-forget(`.catch(console.error)`)이고 수동 재시도 경로는 기존 에러 토스트가 이미 처리. join_moa로 승격된 게스트(editor, accepted)는 멤버이므로 통과 — 게스트 링크 추가 흐름 무회귀.
- **D-03: 다른 유료 EF는 무변경.** `generate-plan`은 이미 게이트 완비(T-18-08/09). `resolve-place`는 온보딩 검색용으로 trip 컨텍스트가 없어 멤버십 게이트 자체가 부적용 — 범위 외. (research/plan 중 resolve-place에 getUser 게이트 부재가 확인되면 변경하지 말고 deferred로 flag만.)

### NAME-01: 카피 스윕 범위
- **D-04: 라이브 유저 대면 표면만 스윕.** 스카우트 실측: "보드"는 이미 스윕 완료(잔여 grep 히트는 클립보드/대시보드 오탐뿐). "가고싶어" 잔여 라이브 표면 = `apps/web/app/t/[slug]/_components/guest-surface.tsx`(aria-label + 버튼 카피) + `apps/web/app/t/[slug]/page.tsx`(안내 문구 "가고싶어!"). 랜딩·로그인·OG·poll 푸터는 plan 단계에서 grep 전수 재확인(현재 스카우트로는 잔여 0으로 보임). 코드 식별자(love, vote 등)·개발자 주석은 유지 — 유저 대면 문자열만.
- **D-05: 변경 파일의 테스트 카피 단언은 같은 커밋에서 동기화** (SC-2 명시 요건).
- **D-06: 레거시 `vote-island.tsx`는 스윕 제외.** 25-03에서 GuestSurface로 교체된 뒤 자기 테스트(`vote-island.test.tsx`)에서만 임포트되는 dead code — 유저 대면 아님. 삭제하지 않고(수술적 변경 원칙) deferred 정리 항목으로만 기록. 해당 테스트의 가고싶어 단언도 그대로 유지(컴포넌트와 일관).

### 2인극 UAT 구성
- **D-07: 통합 UAT — 잔여 검증 전부 합류** (사용자 지시: "28까지 완료 후 통합 UAT"). Phase 27 SC-3 시나리오(호스트 A: 로그인→온보딩→유튜브 링크→핀→'둘다' 공유 / 게스트 B 시크릿: 즉시 렌더→닉네임 게이트→날짜투표+장소추가→채팅 "#3 어때?" / A 복귀: 실시간·찜순·순번 불변)를 축으로, 다음을 같은 UAT 문서에 합류:
  - Phase 25 잔여: iPhone 실기기 재확인(공유시트 footer CTA·달력 nav·하트) · Test 4 카카오 승격(linkIdentity) · 크로스브라우저 실시간
  - Phase 28 라이브 2건: 날짜 미정+기간 pill "2박3일"→'일정 만들기'→Day 탭 3개 · 장소 Day 3 수동 이동→'일정 다시 만들기'→위치 유지
  - presence 확인: 채팅 "지금 N명 보는 중" 입장·퇴장 실시간 수렴 (folded todo — 아래 참조)
  - SEC-01 게이트 실증: 비멤버 익명 세션의 extract-youtube 직접 호출 403
- **D-08: 하이브리드 실행** — Claude가 브라우저 두 컨텍스트(일반+시크릿)로 자동 실증 가능한 항목을 먼저 소진하고, human-only 항목(카카오 실로그인·iPhone 실기기·카카오 승격)은 `27-HUMAN-UAT.md` 체크리스트로 분리(25-HUMAN-UAT 선례 포맷).
- **D-09: UAT에서 presence 정상 확인 시 `supabase-js-upgrade-presence` todo를 닫는다** — 근거(GAP-19D)는 supabase-js 2.45.4 시절이고 24-01에서 2.110.0으로 업그레이드됨, Phase 26 채팅 presence가 같은 스택 위에 구현됨. 확인 실패 시 todo 유지 + 증상 갱신.

### Claude's Discretion
- **문서 마감 깊이**: WORKSTREAMS.md·ARCHITECTURE.md의 역할 기술(웹=열람 전용 서술 등 v2.1 피봇 이전 잔재)을 현재 상태(웹=입력·저장·편집 풀 서피스, Phase 23~28 결과)로 갱신 — 범위·문장은 Claude 재량. 전면 재작성 아님, 역할 기술 수정 수준.
- **revalidate 확인 방법**: `/api/revalidate` 라우트 + `TRIP_REVALIDATE_TAG` 경로가 공유 페이지(/t/[slug]) 캐시를 실제로 갱신하는지 확인 — 스모크 방식은 재량.
- **UAT 문서 구조·순서**: SC-3 통과 판정 기준이 명확하면 시나리오 세부 구성은 재량.

### Folded Todos
- **supabase-js 업그레이드 (presence 복구)** (`.planning/todos/pending/supabase-js-upgrade-presence.md`) — 원 문제: /poll presence 미동작(GAP-19D, 2.45.4 시절). 24-01 업그레이드(2.110.0)로 stale 가능성 높음 → Phase 27 통합 UAT에 presence 확인 항목으로 폴드, 통과 시 닫기 (D-09).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SEC-01 게이트 패턴
- `supabase/functions/generate-plan/index.ts` L88~140 — 미러할 하우스 패턴: getUser 게이트(T-18-08) + can_edit_trip 멤버십 체크(T-18-09, service-role 쿼리, 유료 호출 전 선행)
- `supabase/functions/extract-youtube/index.ts` — 게이트를 추가할 대상 (기존 getUser 게이트 L57-79 유지, link_id→links.board_id 경유 멤버십 체크 추가)
- `supabase/migrations/0016_trips_baseline.sql` — can_edit_trip 헬퍼(L313-336) 시맨틱 원본 (owner OR accepted owner/editor)

### NAME-01 카피
- `.planning/REQUIREMENTS.md` — SEC-01·NAME-01 원문 (L361-362)
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` · `apps/web/app/t/[slug]/page.tsx` — 잔여 "가고싶어" 라이브 표면 실측 위치

### UAT
- `.planning/ROADMAP.md` Phase 27 섹션 — SC-1~3 원문 (2인극 UAT 시나리오 축)
- `.planning/phases/25-guest-unified-share/25-HUMAN-UAT.md` — human-UAT 문서 포맷 선례 + Phase 25 잔여 항목 원문
- `.planning/phases/28-add-trip-redesign-ai/28-VERIFICATION.md` — Phase 28 라이브 UAT pending 2건 원문 (uat_pending frontmatter)
- `.planning/todos/pending/supabase-js-upgrade-presence.md` — 폴드된 presence 확인 배경

### 문서 마감
- `docs/WORKSTREAMS.md` · `docs/ARCHITECTURE.md` — 역할 기술 수정 대상
- `apps/web/app/api/revalidate/route.ts` — revalidate 확인 대상 경로

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **generate-plan의 2단 게이트**(getUser + can_edit_trip 미러 쿼리): extract-youtube에 그대로 이식 가능한 검증된 패턴 — 신규 로직 설계 불필요
- **jsonError 헬퍼** (EF 공통): 403 응답 포맷 재사용
- **25-HUMAN-UAT.md 포맷**: round별 checklist + reason 필드 — 27-HUMAN-UAT가 그대로 계승

### Established Patterns
- EF 게이트는 **유료 API 호출 전에** 검사 (generate-plan 주석 명시 — "Must happen BEFORE any paid Claude/Routes call")
- 멤버십 시맨틱: owner OR accepted(accepted_at not null) owner/editor membership — join_moa 승격 게스트 포함
- 카피 스윕 시 테스트 단언 동커밋 갱신 (Phase 24 board→moa 스윕 선례)
- config.toml `verify_jwt` 상태: extract-youtube=true(유지), inbound/parse-email=false(x-ingest-secret 보상 통제 — 무접촉)

### Integration Points
- `triggerExtraction`(packages/api/src/queries/links.ts L61) — EF invoke 래퍼, 시그니처 무변경 (403은 기존 error throw 경로로 전파)
- 추출 트리거 호출부: onboarding 제출(fire-and-forget), add-sheet, moa-island 재시도 — 전부 멤버 컨텍스트라 실사용 무회귀 기대

</code_context>

<specifics>
## Specific Ideas

- 사용자 지시 2건: (1) 회색지대는 전부 권장안으로 자동 결정, (2) UAT는 "28까지 완료 후 통합 UAT" — Phase 25/28 잔여를 별도 트랙으로 남기지 말고 Phase 27 UAT에 합류.

</specifics>

<deferred>
## Deferred Ideas

- **레거시 `vote-island.tsx` + `vote-island.test.tsx` 삭제** — 25-03 GuestSurface 교체 후 dead code (자기 테스트에서만 임포트). 별도 정리 커밋/phase 몫 (D-06).
- **resolve-place getUser 게이트 여부** — 확인만, 이번 phase에서 변경 금지 (D-03). 부재 시 향후 하드닝 항목.

### Reviewed Todos (not folded)
- **eas-ios-sharesheet-verify** — iOS 실기기 share extension 검증. v2.1 iOS 전면 동결이라 범위 외.
- **maplink-place-enrichment** — GOOGLE_PLACES_SERVER_KEY 실검증 + 비용 결정에 블록. 범위 외.
- **transcript-fallback-no-description** — 외부 서비스(supadata/OpenAI) 가입·키에 블록. 범위 외.

</deferred>

---

*Phase: 27-hardening-wrapup*
*Context gathered: 2026-07-13*
