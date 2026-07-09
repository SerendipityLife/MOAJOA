---
status: partial
phase: 26-realtime-chat
source: [26-VERIFICATION.md]
started: 2026-07-10T02:40:00Z
updated: 2026-07-10T02:40:00Z
---

## Current Test

[awaiting human testing — 선행 조건: 0028을 origin/main에 push (Supabase↔GitHub 자동 적용)]

## Tests

### 1. 실시간 메시지 전달 + 히스토리 (CHAT-01)
expected: 0028 배포 후, 두 브라우저(호스트+멤버)에서 같은 /moa/[id] 채팅 탭을 열고 메시지를 주고받으면 — 한쪽에서 보낸 메시지가 상대 화면에 실시간 도착(500 없이 send 성공), 새로고침 후에도 히스토리 유지
result: [pending]

### 2. Presence "지금 N명 보는 중" 수렴 (CHAT-02)
expected: 두 브라우저에서 채팅 탭 입장 시 2명, 한쪽이 닫으면 1명으로 실시간 수렴
result: [pending]

### 3. 장소 멘션 답장 라이브 왕복 (CHAT-03)
expected: 장소 행 답장 → 채팅 탭 전환+프리필 → 전송 메시지에 #N 장소명 칩 → 칩 탭 시 모으기 탭 전환+해당 장소 스크롤+ring 하이라이트가 라이브에서 동작
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
