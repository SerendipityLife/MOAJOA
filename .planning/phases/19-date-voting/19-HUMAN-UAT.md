---
status: partial
phase: 19-date-voting
source: [19-VERIFICATION.md]
started: 2026-06-23T06:56:37Z
updated: 2026-06-23T06:56:37Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. iOS 호스트 플로우 (디바이스/시뮬레이터)
expected: `pnpm sim`으로 앱 실행 →
  1. 온보딩 "미정" 카드가 활성·브랜드 강조로 보이고 탭하면 날짜없는 여행 생성 플로우(`/trip/create?dateless=1`)로 이동
  2. 도시만 입력해도 저장 가능, "날짜 투표 시작하기" CTA → 날짜 없는 여행 + open poll 생성 후 plan 탭 착지
  3. plan 탭에 "날짜 투표 진행 중" 관리 카드 표시 (dateless + status≠closed일 때만)
  4. 첫 투표/공유 전(0표)에는 range↔grid 모드 토글(D-07) 가능, 투표가 생기면 토글 잠김
  5. 초대 링크/코드 공유(Share 시트)
  6. 호스트 "확정" → Alert 확인 → 여행 날짜 기록 + poll 닫힘 → 관리 카드 사라짐
result: [pending]

### 2. 웹 익명 투표 (브라우저 2개 교차 검증)
expected: 브라우저 2개로 `/poll/[code]` 열기 →
  1. 닉네임 입력 전에는 투표 차단("닉네임을 입력해야 투표할 수 있어요"), 입력 후 투표 가능
  2. 계정 없이 range·grid 두 모드 모두 투표; 실패 시 낙관적 롤백 + 에러 토스트
  3. 한 브라우저의 투표/댓글/접속이 다른 브라우저에 실시간 반영 (라이브 집계 + "지금 N명 보는 중" presence + 채팅 fan-out)
  4. 호스트가 확정해 poll이 closed되면 투표 UI 대신 확정 결과 + "이 여행에 함께하기" 가입 CTA 표시, 추가 투표/댓글 거부
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
