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
  reason: "User reported: 호스트는 공유페이지 접속 시 바로 모으기 탭(MoaIsland)으로 이동하고, 모으기 탭에는 날짜 투표 현황을 확인할 방법이 없음 (스크린샷: 도쿄 모아 — 장소 리스트만, poll 섹션/진입점 부재)"
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "dates/both 공유 게스트가 join 후 MoaIsland(채팅탭 포함)를 본다"
  status: failed
  reason: "User reported: 게스트(공유링크 /t)는 채팅이 보이지 않음 — 투표 섹션·장소는 렌더되나 탭바 자체 부재. 게스트가 투표자 목록에 있어 join 상태로 추정 → join됐는데도 MoaIsland 미마운트 의심"
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "게스트가 시크릿 브라우저에서 투표 UI 아래 통일 채팅 섹션을 보고 메시지를 보낼 수 있다"
  status: failed
  reason: "User reported: 투표 UI 아래 채팅 섹션이 없음 — 채팅 섹션이 없어서 메시지를 못 보냄"
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "호스트 /moa 채팅탭 입력창·보내기 버튼이 온전히 보인다 (CHAT-07 무회귀)"
  status: failed
  reason: "User reported: 호스트 채팅 탭에서 메시지 입력창과 버튼이 살짝 가려져 있음 (하단 탭바와 겹침 추정, 스크린샷 확인)"
  severity: minor
  test: 2
  artifacts: []
  missing: []
