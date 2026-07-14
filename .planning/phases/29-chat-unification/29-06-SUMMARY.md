---
phase: 29-chat-unification
plan: 06
subsystem: ui
tags: [guest-surface, chat-affordance, moa-island, nickname-gate, supabase-rls]

# Dependency graph
requires:
  - phase: 25-guest-share
    provides: GuestSurface + ensureGuestMember(signInAnonymously+joinMoa) + NicknameGateSheet + MoaIsland(hideHostControls) 게스트 마운트 경로
  - phase: 26-realtime-chat
    provides: MoaChat + MoaTabBar(MoaTab 'moa'|'chat') + moa-island 채팅 뷰 wrapper
  - phase: 29-chat-unification
    provides: poll-guest-island 비회원 empty-state 채팅 어포던스 패턴(카피·토큰 클래스)
provides:
  - MoaIsland additive optional initialTab prop (미전달=기존 'moa' 기본, 호스트 무회귀)
  - 게스트 /t(places·dates·both) join 전 채팅 진입 어포던스(empty-state + readOnly 입력창 + 보내기)
  - chat-intent 게이트 브리지 — teaser focus/보내기 → 닉네임 게이트 → join 후 MoaIsland [채팅] 탭 착지
affects: [chat-unification, guest-share, host-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "additive optional initialTab prop으로 join 후 착지 탭 제어 — 미전달 무회귀(호스트 caller diff 0)"
    - "pendingChatIntent state로 게이트 진입점별 착지 탭 분기(채팅 teaser→'chat', 찜/투표→'moa')"
    - "비회원 채팅 teaser는 readOnly 입력창=게이트 트리거 — listTripMessages 미호출(RLS SELECT 멤버 전용 심층방어)"

key-files:
  created: []
  modified:
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/__tests__/moa-island.test.tsx
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/__tests__/guest-surface.test.tsx

key-decisions:
  - "initialTab은 additive optional — 호스트 /moa/[id] page.tsx는 미전달(diff 0), useState 초기값 한 줄만 교체"
  - "chatTeaser 입력창은 readOnly(게이트 트리거) — 실 compose는 join 후 MoaIsland가 소유(모바일 키보드 대신 게이트 시트만)"
  - "openGate/requireMember/handleCloseGate에 setPendingChatIntent(false) — 찜/투표 게이트 경로는 'moa' 탭 착지(leak 방지)"
  - "chatTeaser는 gate처럼 분기 공통 element로 정의 후 세 비join 분기(places·dates·both)에 재사용 — 신규 컴포넌트 0"

patterns-established:
  - "게이트 진입점별 착지 탭: intent flag(pendingChatIntent) → MoaIsland initialTab={flag ? 'chat' : undefined}"

requirements-completed: [CHAT-09]

# Metrics
duration: 18min
completed: 2026-07-15
---

# Phase 29 Plan 06: 게스트 /t 채팅 진입 어포던스 (CHAT-09) Summary

**게스트가 /t join 전 화면(places·dates·both 공통)에서 채팅 empty-state teaser(입력창+보내기)를 보고, focus/보내기 시 투표·찜과 동일한 닉네임 게이트를 태워 join 후 MoaIsland [채팅] 탭에 착지시키는 gap closure — 신규 컴포넌트 0, MoaIsland에 additive initialTab prop 한 줄 + guest-surface teaser·intent 브리지**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-15T07:43:00Z
- **Completed:** 2026-07-15T07:49:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4

## Accomplishments
- `MoaIsland` additive optional `initialTab?: MoaTab` — 미전달=기존 'moa' 기본(호스트 무회귀), `initialTab="chat"`이면 첫 렌더에 채팅 뷰 visible
- 게스트 /t 비join 3분기(places·dates·both)에 공통 채팅 teaser(empty-state 카피 + readOnly 입력창 + 보내기) — poll-guest-island 패턴 이식
- chat-intent 게이트 브리지: teaser focus/보내기 → `openChatGate`(pendingChatIntent=true) → 닉네임 게이트 → `ensureGuestMember` → join → MoaIsland `initialTab='chat'` 착지
- 찜/투표 게이트·재접속 멤버는 `pendingChatIntent` 리셋으로 기존대로 [모으기] 탭 착지(무회귀 검증 Test 7)
- 비회원은 `listTripMessages` 미호출 — 메시지 이력·닉네임·PII 노출 0 (T-29-06-01 mitigate)

## Task Commits

Each task committed atomically (TDD RED/GREEN in-process, one feat commit per task):

1. **Task 1: MoaIsland additive optional initialTab prop** - `b12f7c3` (feat)
2. **Task 2: guest-surface 채팅 teaser + chat-intent 게이트 → 채팅탭 착지** - `c3767ba` (feat)

**Plan metadata:** (docs commit — SUMMARY/STATE/ROADMAP)

## Files Created/Modified
- `apps/web/app/moa/[id]/_components/moa-island.tsx` - `initialTab?: MoaTab` prop 추가 + destructure + `useState<MoaTab>(initialTab ?? 'moa')` (3 라인, 나머지 무변경)
- `apps/web/__tests__/moa-island.test.tsx` - Test A(initialTab='chat' 착지)/B(미전달 hidden 무회귀)
- `apps/web/app/t/[slug]/_components/guest-surface.tsx` - `pendingChatIntent` state + `openChatGate` + `chatTeaser` element + 3분기 teaser 렌더 + 3 joined MoaIsland `initialTab` 배선 + 찜/투표/close 게이트 intent 리셋
- `apps/web/__tests__/guest-surface.test.tsx` - MoaIsland mock `data-initial-tab` 캡처 + Test 1~7(teaser 렌더 3모드·보내기/focus 게이트·채팅탭 착지·찜 무회귀)

## Decisions Made
None beyond plan — 플랜 원안 그대로. 착지 탭 분기 전략(pendingChatIntent flag), readOnly 입력창(게이트 트리거), chatTeaser 공통 element 재사용 전부 플랜 명세대로 구현.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Register Compliance
- **T-29-06-01 (Info Disclosure, mitigate):** teaser 비join 분기는 empty-state만 — `hydrateMember`/`listTripMessages` join 전 미호출. Test 1이 `listTripMessages` 미호출 검증. ✅
- **T-29-06-02 (Spoofing/Elevation, accept):** 기존 `ensureGuestMember`(signInAnonymously+joinMoa) 재사용 — 승격 메커니즘·RPC·RLS 무변경. ✅
- **T-29-06-03 (Tampering, accept):** initialTab은 클라이언트 초기 탭 표시일 뿐 — RLS가 실 send/read 게이트. additive optional, 호스트 diff 0. ✅

## Known Stubs
None — teaser 입력창은 의도적 readOnly 게이트 트리거(실 compose는 join 후 MoaIsland MoaChat 소유). placeholder/mock 데이터 소스 없음.

## Verification
- `CI=true pnpm --filter web test -- moa-island` → 39/39 그린 (Test A/B 포함)
- `CI=true pnpm --filter web test -- guest-surface` → 22/22 그린 (Test 1~7 포함)
- **전 web 스위트: 37 files / 338 tests 그린** (무회귀)
- `pnpm --filter web exec tsc --noEmit` → exit 0
- **web build PASS** (`ƒ /t/[slug]` 4.07 kB · `ƒ /moa/[id]` 187 B)
- 무회귀 앵커: `git diff apps/web/app/moa/[id]/page.tsx` 빈 diff(호스트 caller 미전달) · `apps/ios`/`packages/core`/`packages/api`/`supabase/migrations` 빈 diff · `한마디` grep 0 (HC-7 유지) · 신규 hex 0 · `.js` 워크스페이스 import 0
- acceptance grep 전종 통과 (initialTab?: MoaTab=1 · useState<MoaTab>(initialTab=1 · import MoaTab=1 · page.tsx initialTab=0 · empty-state 카피=1 · openChatGate=3 · initialTab={pendingChatIntent=3 · chatTeaser=4 · readOnly 입력 attribute 1건)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required (마이그레이션·백엔드 변경 0).

## Next Phase Readiness
- CHAT-09 코드 완료. 라이브 재검증(시크릿 브라우저 /t 게스트 → 채팅 teaser 보임 → 보내기 → 닉네임 게이트 → 채팅탭 착지)은 verify-work / 배포 후 몫.
- Phase 29 전 UAT gap 소진 — 잔여는 라이브 e2e 재검증만.

## Self-Check: PASSED
- FOUND: `.planning/phases/29-chat-unification/29-06-SUMMARY.md`
- FOUND: commit b12f7c3 (Task 1)
- FOUND: commit c3767ba (Task 2)

---
*Phase: 29-chat-unification*
*Completed: 2026-07-15*
