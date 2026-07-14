---
status: diagnosed
trigger: "Gap 3 [major]: 호스트가 공유페이지(/t/{slug})에 접속하면 바로 모으기 탭(MoaIsland)으로 이동되고, 모으기 탭에서 날짜 투표 현황을 확인할 방법이 없음"
created: 2026-07-14T00:00:00Z
updated: 2026-07-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — 호스트에게는 날짜 투표 현황 표면이 어디에도 없다 (설계 공백 + dates 한정 29-02 회귀)
test: 코드 경로 추적 완료 (guest-surface 분기 3종 + moa/[id] page + ShareSheet + 29-02 diff)
expecting: n/a
next_action: return diagnosis (goal: find_root_cause_only)

## Symptoms

expected: 호스트가 공유페이지(/t) 접속 시 날짜 투표 현황을 확인할 수 있다
actual: 호스트는 /t 접속 시 바로 모으기 탭(MoaIsland)으로 이동, 모으기 탭에 투표 현황 진입점 부재. 스크린샷("도쿄 모아"): 장소 리스트 + "아직 일정이 없어요/일정 만들기"만
errors: 없음 (silent)
reproduction: 호스트 로그인 브라우저에서 /t/3uo4yyvlxhqc (both 모드) 접속
started: Phase 29 UAT Test 2에서 발견

## Eliminated

- hypothesis: "public_trip_poll RPC grant가 anon 전용이라 호스트(authenticated) 호출 실패"
  evidence: 0029_public_trip_poll.sql:128 — `grant execute ... to authenticated, anon`. 0033 revoke 목록에 public_trip_poll 없음
  timestamp: 2026-07-14

- hypothesis: "PublicBoardView 스키마가 share_mode를 strip해 shareMode가 'places'로 fallback"
  evidence: trips.ts:240-249 getPublicTripBySlug는 Zod parse 없이 cast — share_mode 통과. 게스트가 날짜투표 섹션을 봤으므로 share_mode는 dates/both로 전달됨
  timestamp: 2026-07-14

- hypothesis: "서버/미들웨어가 호스트를 /t → /moa/[id]로 redirect"
  evidence: t/[slug]/page.tsx·middleware.ts·guest-surface.tsx·guest-promote.tsx 전수 — redirect/router.push 없음 (vote-island:160 login redirect는 레거시 미사용 경로)
  timestamp: 2026-07-14

- hypothesis: "getMyTripRole이 owner에게 null을 반환해 비join 뷰가 보임"
  evidence: memberships.ts:62-74 — trips.owner_id 직접 비교로 'owner' 반환. 증상도 MoaIsland 마운트("모으기 탭으로 이동")와 일치
  timestamp: 2026-07-14

## Evidence

- timestamp: 2026-07-14
  checked: guest-surface.tsx:99-124 (세션 effect)
  found: 호스트 uid → getMyTripRole='owner' → hydrateMember → setJoined(true) → dates/both/places 분기 모두 joined 시 MoaIsland(fixed inset-0) 마운트
  implication: "/t 접속 시 바로 모으기 탭으로 이동" 체감의 실제 메커니즘 — redirect가 아니라 fullscreen island 마운트

- timestamp: 2026-07-14
  checked: guest-surface.tsx:360-393 (both 분기), :332-358 (dates 분기)
  found: joined 멤버(호스트 포함)에게 pollSlot은 `pollMeta != null`일 때만 전달. pollMeta는 getPublicTripPoll 성공 시에만 set — 실패는 :135-137 catch에서 무음 스킵
  implication: RPC 실패/null 시 poll 섹션이 에러 없이 그냥 사라짐 — 증상과 정확히 일치하는 유일한 무음 실패 지점

- timestamp: 2026-07-14
  checked: apps/web/app/moa/[id]/page.tsx:77-91 + moa-island.tsx:587
  found: 호스트 본 화면 /moa/[id]는 pollSlot을 전달하지 않음(주석 "호스트 /moa는 미전달=diff 0"). MoaIsland 자체에 poll 조회 코드 0. ShareSheet(share-sheet.tsx)는 후보 세팅 step만 — 집계/투표자 표시 없음
  implication: 호스트의 본 표면에는 날짜 투표 현황 UI가 어느 phase에도 존재한 적 없음 (신규 요구)

- timestamp: 2026-07-14
  checked: 스크린샷 내용 vs hideHostControls
  found: "아직 일정이 없어요/일정 만들기" = PlanSection(plan-section.tsx:218,234), moa-island.tsx:593에서 `!hideHostControls`일 때만 렌더. /t 3분기 전부 hideHostControls 전달(guest-surface.tsx:341,369,398)
  implication: 스크린샷은 /t가 아니라 호스트 본인의 /moa/[id] 화면 — 사용자가 투표 현황을 찾으러 간 곳이 본 화면이고 거기에 아무것도 없음

- timestamp: 2026-07-14
  checked: git show 314f4f0 (29-02 D-01)
  found: dates 분기가 `{pollSection}` 무조건 렌더(전 방문자에게 full-page PollVoteIsland+집계)에서 `joined ? MoaIsland+pollSlot : pollSection`으로 변경
  implication: dates 모드 한정, 호스트가 /t에서 보던 전면 투표 현황이 시트 내 임베드로 격하 — Phase 29 회귀. 단 both 분기는 25-07(e516f8f) 이후 무변경

- timestamp: 2026-07-14
  checked: 27-HUMAN-UAT.md:32
  found: 테스트 트립 /t/3uo4yyvlxhqc는 both 모드
  implication: 이번 UAT 호스트 경로는 both 분기 — 코드상 pollSlot이 전달되어야 하므로, /t에서 poll이 정말 안 보였다면 런타임 pollMeta=null(무음 catch) 재현 확인 필요

## Resolution

root_cause: |
  복합 (2 표면):
  (1) 호스트 본 표면 /moa/[id]에 날짜 투표 현황 UI가 원래 없음 — page.tsx가 pollSlot 미전달(moa/[id]/page.tsx:77-91),
      MoaIsland에 poll 코드 0(moa-island.tsx:587은 prop seam만), ShareSheet는 후보 세팅만. 설계 공백(신규 요구).
  (2) /t의 dates 모드는 29-02(314f4f0)가 호스트를 full-page pollSection에서 MoaIsland로 수렴시켜 현황 노출이 격하됨(회귀).
      both 모드(실제 테스트 트립)는 25-07 이후 무변경이나, pollSlot은 pollMeta 의존이며 getPublicTripPoll 실패가
      guest-surface.tsx:135-137에서 무음 스킵되어 poll 섹션이 흔적 없이 사라질 수 있음.
fix: (diagnose-only — 미적용)
verification: (미적용)
files_changed: []
