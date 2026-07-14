---
status: partial
phase: 29-chat-unification
source: [29-VERIFICATION.md]
started: 2026-07-14T06:20:00Z
updated: 2026-07-14T14:05:00Z
---

## Current Test

[testing complete — Test 3 blocked, 픽스 후 재검증]

## Tests

### 1. /poll 통일 채팅 라이브 (a/b/c)
expected: 시크릿 브라우저에서 기존 `/poll/{code}` 열기 → 투표 UI 아래 "채팅" 섹션 + "참여하면 지금까지의 대화를 볼 수 있어요" 빈상태 카피 (한마디 없음). 메시지 입력→보내기→닉네임 게이트→시작하기→메시지가 목록에 나타남. 호스트 브라우저의 /moa 채팅탭에 같은 메시지가 보이고(SC2), 호스트 답장이 /poll 쪽에 실시간 수신됨.
result: issue
reported: "시크릿 브라우저에서 투표 UI 아래 채팅 섹션이 없음. 채팅 섹션이 없어서 메시지를 못 보냄."
severity: major

### 2. dates 공유 게스트 라이브 채팅
expected: 2-브라우저 — dates 공유 링크에서 게스트 join 후 MoaIsland 채팅탭 동작, 장소 추가 FAB 없음(hidePlaceAdd).
result: issue
reported: "게스트(공유링크 /t/3...)는 채팅이 보이지 않아. 스크린샷: 게스트 화면에 날짜투표 섹션+장소 1곳은 렌더되나 탭바(모으기/채팅/마이) 자체가 없음. 게스트 '클로드게스트'는 투표자 목록에 있어 join된 것으로 보임 — join됐는데도 MoaIsland 미마운트 의심."
severity: major

### 3. Presence 카운트 (통일 moa:{tripId})
expected: 2세션 동시 접속 시 "지금 2명 보는 중" 표시 (Phase 27 UAT 항목 5 이관분).
result: blocked
blocked_by: other
reason: "게스트 채팅 표면 미표시(Test 1/2 이슈)로 2인극 presence 테스트 불가 — 게스트 채팅 픽스 후 재검증"

### 4. iOS 투표 broadcast 수신 (low-risk)
expected: 웹 /poll 투표 시 iOS 호스트가 기존 `poll:{tripId}` 'vote' broadcast 수신 유지 (채널 계약 grep-anchored, iOS diff 0).
result: skipped
reason: "v2.1 웹 퍼스트 — iOS 전면 동결(CLAUDE.md §5), 실기기 테스트 대상 아님. 코드 레벨은 이미 검증됨(channelRef·'vote' broadcast 유지, apps/ios diff 0)."

## Summary

total: 4
passed: 0
issues: 2
pending: 0
skipped: 1
blocked: 1

## Gaps

- truth: "호스트가 /moa 본화면에서 날짜 투표 현황을 확인할 수 있다"
  status: resolved
  resolution: "29-05 (c9b8c3d) — host /moa/[id] RSC가 getPollByTrip(owner RLS)로 poll 조회 → 존재 시 PollVoteIsland 현황 뷰를 기존 pollSlot seam으로 전달. both 무음 catch에 console.error 추가(a5e2701). 라이브 재검증은 verify-work."
  reason: "User reported: 호스트는 공유페이지 접속 시 바로 모으기 탭(MoaIsland)으로 이동하고, 모으기 탭에는 날짜 투표 현황을 확인할 방법이 없음"
  severity: major
  test: 2
  diagnosis: "CONFIRMED 실제 결함(복합). (1) /t dates 모드는 Phase 29 회귀 — 29-02 commit 314f4f0(D-01)이 전 방문자에게 무조건 렌더되던 full-page PollVoteIsland(집계·투표자 목록)를 joined면 pollSlot 임베드로 격하시킴 → 호스트(joined owner)가 보던 전면 투표 현황이 시트 안으로 축소. (2) 호스트 본 화면 /moa/[id]는 poll 현황 표면이 어느 phase에도 없었음 = 신규 요구 (page.tsx:77-91 pollSlot 미전달; ShareSheet는 후보 세팅만·집계 없음). (3) both 모드는 코드상 pollSlot 렌더되어야 하나 getPublicTripPoll 실패를 guest-surface.tsx:135-137이 무음 catch → 런타임 1회 확인 필요. debug: .planning/debug/host-t-no-poll-status.md"
  artifacts: ["apps/web/app/moa/[id]/page.tsx:77-91", "apps/web/app/t/[slug]/_components/guest-surface.tsx:135-137,343-377"]
  missing: ["host MoaIsland pollSlot (현황 뷰) 배선", "무음 catch 로깅"]

- truth: "dates/both 공유 게스트가 join 후 MoaIsland(채팅탭 포함)를 본다"
  status: resolved
  resolution: "재검증(2026-07-15) 확정: join(투표/닉네임) 후 게스트가 통합 MoaIsland(호스트형 앱쉘, hideHostControls)로 전환됨 = Phase 29 D-01 설계대로 동작. 사용자 결정: '이대로 유지'(설계 의도). 채팅은 그 [채팅] 탭 경유. 최초 오독('탭바 없음')은 비join 뷰를 본 것 + 죽은 세션 투표자 잔재."
  severity: major
  test: 2
  artifacts: ["apps/web/app/t/[slug]/_components/guest-surface.tsx"]
  missing: []

- truth: "게스트 /t 뷰(join 전)에 채팅 진입 어포던스가 있고, 입력 시도 시 투표와 동일하게 닉네임 게이트→앱쉘 채팅탭으로 이동한다"
  status: resolved
  resolution: "29-06 (b12f7c3·c3767ba) 배포·확인(2026-07-15 IMG_8668): /t 게스트 뷰에 '채팅' 섹션+입력창 표시, 입력 시도→닉네임 게이트→join→MoaIsland 채팅탭 착지. join 후 메시지 정상 열람(사용자 확인)."
  severity: enhancement
  test: 2
  planned_by: 29-06
  artifacts: ["apps/web/app/t/[slug]/_components/guest-surface.tsx", "apps/web/app/moa/[id]/_components/moa-island.tsx (initialTab)"]

- truth: "게스트가 /t join 전에도 실제 채팅 대화를 읽을 수 있다 (empty-state 대신 메시지 스냅샷)"
  status: new_request
  reason: "사용자 결정(2026-07-15, IMG_8667 호스트 메시지 vs IMG_8668 게스트 empty-state 대조): 'join 전에도 메시지 보이게'. 근거: /t는 이미 투표자 이름·장소를 anon-with-link에 노출(public_trip_poll/view) → 채팅도 동일 정책 일관. 로드맵 SC2 '서로 메시지가 보임' 부합. 현재 trip_messages RLS는 멤버 SELECT만이라 비회원은 empty-state. 신설 필요: slug→메시지 anon-grant DEFINER 읽기 RPC(0034, public_trip_poll 0029 미러). 제약: 비회원 스냅샷은 realtime 구독 불가(WALRUS 멤버 전제) → 로드 시 1회 fetch, 라이브는 join 후. 입력 시도 시 게이트는 29-06 그대로."
  severity: enhancement
  test: 2
  planned_by: 29-07
  artifacts: ["supabase/migrations/0034_public_trip_messages.sql (신규)", "packages/api/src/queries/chat.ts", "apps/web/app/t/[slug]/_components/guest-surface.tsx"]
  missing: ["slug→messages anon-grant RPC(0034) + smoke", "api 래퍼", "guest-surface teaser가 empty-state 대신 스냅샷 메시지 렌더(read-only, 입력 게이트 유지)"]

- truth: "게스트가 /poll/{code}에서 투표 UI 아래 통일 채팅 섹션을 보고 메시지를 보낼 수 있다"
  status: needs_retest
  reason: "User reported: 투표 UI 아래 채팅 섹션 없음. 단, 사용자 스크린샷 우측은 /t/3... 링크였고 /poll/{code}를 실제로 열었는지 불확실(두 서피스 혼동 가능). 진단: 라이브 /poll HTML에 'poll-guest-island'가 '참여하면 지금까지의 대화를 볼 수 있어요' 카피와 함께 무조건 렌더됨(poll-guest-island.tsx:252-300) → 신코드에서 채팅 섹션 부재는 구조적으로 불가능. 배포 전 구코드(/poll=한마디만) 관찰 가능성."
  severity: major
  test: 1
  diagnosis: "NOT A DEPLOYED-CODE DEFECT. 재검증 필요: 배포 후 새 시크릿 창에서 실제 /poll/{code} 링크(공유시트 날짜투표 링크)를 열어 채팅 섹션 확인. debug: .planning/debug/guest-chat-island-not-mounted.md"
  artifacts: ["apps/web/app/poll/[code]/_components/poll-guest-island.tsx:252-300"]
  missing: []

- truth: "호스트 /moa 채팅탭·모으기탭 하단 콘텐츠가 탭바에 안 가린다"
  status: reopened_deferred
  reason: "재검증(2026-07-15): 7a6d156(pb-72) 이후에도 채팅 입력부 여전히 잘림 + 모으기탭 하단(장소 리스트)도 잘림. 근본원인 변경 — 동료 병합(1421a2b·31199a8 바나나 팔레트)이 moa-tab-bar 아이콘에 pill(px-5 py-1, :56-65) 추가로 탭바 높이 ~65→~74px 증가. pb-[72px]가 다시 부족해짐. 두 탭 공통 뿌리. 사용자 결정(2026-07-15): #4 게스트 채팅 확인 후 일괄 처리로 보류."
  severity: minor
  test: 2
  artifacts: ["apps/web/app/moa/[id]/_components/moa-island.tsx:665", "apps/web/app/moa/[id]/_components/moa-tab-bar.tsx:56"]
  missing: ["새 탭바 높이(~74px)에 맞춘 모으기탭+채팅탭 하단 여백 재조정 (견고하게 — 하드코딩 지양)"]
