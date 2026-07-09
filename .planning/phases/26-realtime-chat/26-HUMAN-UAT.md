---
status: partial
phase: 26-realtime-chat
source: [26-VERIFICATION.md]
started: 2026-07-10T02:40:00Z
updated: 2026-07-10T02:40:00Z
---

## Current Test

number: 2
name: Presence "지금 N명 보는 중" 수렴
expected: |
  두 브라우저에서 채팅 탭 입장 시 2명, 한쪽이 닫으면 1명으로 실시간 수렴
awaiting: user 2-browser 관찰 (카카오 로그인 필요 — Claude 대행 불가)

## Tests

### 1. 실시간 메시지 전달 + 히스토리 (CHAT-01)
expected: 0028 배포 후, 두 브라우저(호스트+멤버)에서 같은 /moa/[id] 채팅 탭을 열고 메시지를 주고받으면 — 한쪽에서 보낸 메시지가 상대 화면에 실시간 도착(500 없이 send 성공), 새로고침 후에도 히스토리 유지
result: pass

## Deploy Gate (verified 2026-07-10)
- 0028 원격 Supabase 적용 확인: `supabase migration list` → Remote 0028 (publication + trigger 라이브)
- 프로덕션 배포 READY: Vercel dpl_7Y6391… commit 5d8c2b3 (= HEAD, 채팅 코드 + WR-01·IN-01 픽스 포함)
- 앱 접근성: /login 200, /moa 307→login (D-01 게이트 정상)
- 결론: 3건을 human_needed로 막았던 배포 게이트 해소. Test 2·3은 순수 2-브라우저 사람 관찰만 남음(인프라 blocker 아님).

### 2. Presence "지금 N명 보는 중" 수렴 (CHAT-02)
expected: 두 브라우저에서 채팅 탭 입장 시 2명, 한쪽이 닫으면 1명으로 실시간 수렴
result: [pending]

### 3. 장소 멘션 답장 라이브 왕복 (CHAT-03)
expected: 장소 행 답장 → 채팅 탭 전환+프리필 → 전송 메시지에 #N 장소명 칩 → 칩 탭 시 모으기 탭 전환+해당 장소 스크롤+ring 하이라이트가 라이브에서 동작
result: [pending]

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
