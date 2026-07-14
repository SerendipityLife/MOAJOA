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

- truth: "호스트가 공유페이지(/t) 접속 시 날짜 투표 현황을 확인할 수 있다"
  status: failed
  reason: "User reported: 호스트는 공유페이지 접속 시 바로 모으기 탭(MoaIsland)으로 이동하고, 모으기 탭에는 날짜 투표 현황을 확인할 방법이 없음"
  severity: major
  test: 2
  diagnosis: "CONFIRMED 실제 결함(복합). (1) /t dates 모드는 Phase 29 회귀 — 29-02 commit 314f4f0(D-01)이 전 방문자에게 무조건 렌더되던 full-page PollVoteIsland(집계·투표자 목록)를 joined면 pollSlot 임베드로 격하시킴 → 호스트(joined owner)가 보던 전면 투표 현황이 시트 안으로 축소. (2) 호스트 본 화면 /moa/[id]는 poll 현황 표면이 어느 phase에도 없었음 = 신규 요구 (page.tsx:77-91 pollSlot 미전달; ShareSheet는 후보 세팅만·집계 없음). (3) both 모드는 코드상 pollSlot 렌더되어야 하나 getPublicTripPoll 실패를 guest-surface.tsx:135-137이 무음 catch → 런타임 1회 확인 필요. debug: .planning/debug/host-t-no-poll-status.md"
  artifacts: ["apps/web/app/moa/[id]/page.tsx:77-91", "apps/web/app/t/[slug]/_components/guest-surface.tsx:135-137,343-377"]
  missing: ["host MoaIsland pollSlot (현황 뷰) 배선", "무음 catch 로깅"]

- truth: "dates/both 공유 게스트가 join 후 MoaIsland(채팅탭 포함)를 본다"
  status: needs_retest
  reason: "User reported: 게스트(/t)는 탭바·채팅 미표시. 진단 결과 관찰 오류 가능성 높음 — 시크릿 창은 세션 없음→joined=false→비join 뷰(투표+장소, 탭바 없음)가 UI-SPEC A-2 설계 그대로. 투표자 목록의 '클로드게스트'는 2026-07-12 죽은 세션 잔재(현재 세션 join 증거 아님). 라이브 재현 프로브에서 익명 join→hydrate 전 쿼리(getTrip/places/messages/members) 성공 = 코드 결함 반증."
  severity: major
  test: 2
  diagnosis: "NOT A DEPLOYED-CODE DEFECT (H1~H4 전부 반증). 재검증 필요: 배포 후 새 시크릿 창에서 반드시 join 액션(투표/찜/전송→닉네임 게이트) 수행 후 탭바/채팅 확인. debug: .planning/debug/guest-chat-island-not-mounted.md. 부차 취약점: guest-surface.tsx:114 hydrateMember try/catch 부재(일시 실패 시 무증상 감금) — 강건화는 별도."
  artifacts: ["apps/web/app/t/[slug]/_components/guest-surface.tsx:114,191"]
  missing: []

- truth: "게스트가 /poll/{code}에서 투표 UI 아래 통일 채팅 섹션을 보고 메시지를 보낼 수 있다"
  status: needs_retest
  reason: "User reported: 투표 UI 아래 채팅 섹션 없음. 단, 사용자 스크린샷 우측은 /t/3... 링크였고 /poll/{code}를 실제로 열었는지 불확실(두 서피스 혼동 가능). 진단: 라이브 /poll HTML에 'poll-guest-island'가 '참여하면 지금까지의 대화를 볼 수 있어요' 카피와 함께 무조건 렌더됨(poll-guest-island.tsx:252-300) → 신코드에서 채팅 섹션 부재는 구조적으로 불가능. 배포 전 구코드(/poll=한마디만) 관찰 가능성."
  severity: major
  test: 1
  diagnosis: "NOT A DEPLOYED-CODE DEFECT. 재검증 필요: 배포 후 새 시크릿 창에서 실제 /poll/{code} 링크(공유시트 날짜투표 링크)를 열어 채팅 섹션 확인. debug: .planning/debug/guest-chat-island-not-mounted.md"
  artifacts: ["apps/web/app/poll/[code]/_components/poll-guest-island.tsx:252-300"]
  missing: []

- truth: "호스트 /moa 채팅탭 입력창·보내기 버튼이 온전히 보인다 (CHAT-07 무회귀)"
  status: failed
  reason: "User reported: 호스트 채팅 탭에서 메시지 입력창과 버튼이 살짝 가려짐"
  severity: minor
  test: 2
  diagnosis: "CONFIRMED. moa-island.tsx:665 채팅탭 컨테이너 pb-[64px]가 실제 탭바 높이(≈65.5px — moa-tab-bar.tsx:40-63 border+py-2.5+icon+gap+11px 라벨 line-height)보다 작아 compose row 하단 ~1.5–2px가 탭바 뒤로 겹침. Phase 26 기원(26-03 2eeb9b5), Phase 29 회귀 아님. debug: .planning/debug/chat-input-covered-by-tabbar.md"
  fix_hint: "moa-island.tsx:665 pb-[64px] → pb-[72px] (탭바 계약 HC-6 무접촉, 한 클래스)"
  severity: minor
  test: 2
  artifacts: ["apps/web/app/moa/[id]/_components/moa-island.tsx:665"]
  missing: []
