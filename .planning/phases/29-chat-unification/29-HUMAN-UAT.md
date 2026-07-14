---
status: partial
phase: 29-chat-unification
source: [29-VERIFICATION.md]
started: 2026-07-14T06:20:00Z
updated: 2026-07-14T06:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. /poll 통일 채팅 라이브 (a/b/c)
expected: 시크릿 브라우저에서 기존 `/poll/{code}` 열기 → 투표 UI 아래 "채팅" 섹션 + "참여하면 지금까지의 대화를 볼 수 있어요" 빈상태 카피 (한마디 없음). 메시지 입력→보내기→닉네임 게이트→시작하기→메시지가 목록에 나타남. 호스트 브라우저의 /moa 채팅탭에 같은 메시지가 보이고(SC2), 호스트 답장이 /poll 쪽에 실시간 수신됨.
result: [pending]

### 2. dates 공유 게스트 라이브 채팅
expected: 2-브라우저 — dates 공유 링크에서 게스트 join 후 MoaIsland 채팅탭 동작, 장소 추가 FAB 없음(hidePlaceAdd).
result: [pending]

### 3. Presence 카운트 (통일 moa:{tripId})
expected: 2세션 동시 접속 시 "지금 2명 보는 중" 표시 (Phase 27 UAT 항목 5 이관분).
result: [pending]

### 4. iOS 투표 broadcast 수신 (low-risk)
expected: 웹 /poll 투표 시 iOS 호스트가 기존 `poll:{tripId}` 'vote' broadcast 수신 유지 (채널 계약 grep-anchored, iOS diff 0).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
