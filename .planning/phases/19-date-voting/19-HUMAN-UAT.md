---
status: partial
phase: 19-date-voting
source: [19-VERIFICATION.md]
started: 2026-06-23T06:56:37Z
updated: 2026-07-05T04:07:37Z
updated_by: sim-automation (idb + simctl, iPhone 17 Pro, 원격 Supabase)
---

## Current Test

[Test 1 완료 — sim 자동화로 검증. Test 2는 웹 2브라우저 realtime 환경 필요로 미실행]

## Tests

### 1. iOS 호스트 플로우 (디바이스/시뮬레이터)
expected: `pnpm sim`으로 앱 실행 →
  1. 온보딩 "미정" 카드가 활성·브랜드 강조로 보이고 탭하면 날짜없는 여행 생성 플로우(`/trip/create?dateless=1`)로 이동
  2. 도시만 입력해도 저장 가능, "날짜 투표 시작하기" CTA → 날짜 없는 여행 + open poll 생성 후 plan 탭 착지
  3. plan 탭에 "날짜 투표 진행 중" 관리 카드 표시 (dateless + status≠closed일 때만)
  4. 첫 투표/공유 전(0표)에는 range↔grid 모드 토글(D-07) 가능, 투표가 생기면 토글 잠김
  5. 초대 링크/코드 공유(Share 시트)
  6. 호스트 "확정" → Alert 확인 → 여행 날짜 기록 + poll 닫힘 → 관리 카드 사라짐
result: [pass-with-findings] — 2026-07-05 sim 자동화(idb) 검증. 화면 흐름 전 단계 통과, 2건 이슈 발견.
  - 항목 1 PASS: 온보딩 "아직 미정이에요 · 친구, 가족, 연인과 함께 투표로 정해요" 카드가 활성·브랜드 캘린더 아이콘+chevron(정해짐 카드와 동일 처리, 17의 비활성 "곧 제공" 스텁에서 활성화됨). 탭 → dateless 생성 화면("어디로 떠나볼까요? / 여행지만 정하면 바로 시작할 수 있어요", 날짜 필드 없음) 이동.
  - 항목 2 PASS: 도쿄만 선택(날짜 필드 없음) → "날짜 투표 시작하기" → dateless 여행 + open poll 생성 → plan 탭 관리 카드 착지.
  - 항목 3 PASS: plan 탭 "날짜 투표 진행 중" 관리 카드 표시(도쿄 · dateless · open). 확정 후 카드 사라짐 확인(항목 6).
  - 항목 4 PASS: 0표에서 범위형↔그리드 토글 동작. 그리드=기본값(투표 기간), 범위형=후보 날짜(2개 이상). 토글 시 하단 콘텐츠가 모드별로 전환됨.
  - 항목 5 PASS(렌더): "초대 링크 복사" / "코드 공유" 버튼 렌더 확인(투표 기간/후보 미설정 시 비활성 + "투표 기간을 정하면 친구를 초대할 수 있어요"). 실제 Share 시트 발화는 미탭(Share.share 네이티브).
  - 항목 6 PASS(핵심 흐름): 후보 날짜 2개(7/15~17, 7/22~24) 등록 → 확정 → destructive Alert("이 날짜로 확정하면 투표가 마감돼요. / 다시 투표를 받으려면 새 투표를 만들어야 해요.") → 확정하기 → 관리 카드 사라지고 정상 plan 탭("아직 플랜이 없어요")으로 전환. poll 닫힘 확인됨.
  - **FINDING F-19-1 (버그, 중): 범위형 확정 시트 stale 상태.** 같은 세션에서 "후보 날짜 추가"로 방금 등록한 후보들이 확정 시트("날짜 확정")에 반영되지 않고 "후보 날짜가 아직 없어요"로 표시됨. 앱 재시작(poll 재로드) 후에는 정상적으로 후보 날짜 2개 + "N명 가능"이 표시됨. 즉 확정 시트가 세션 내 새로 추가된 옵션을 다시 읽지 못함(재시작으로 우회 가능하나 호스트가 "후보 추가 → 바로 확정" 시 확정 불가). plan.tsx의 RangeConfirmList가 최신 poll 옵션을 재조회/재파생하지 않는 것으로 추정.
  - **CAVEAT C-19-1 (확인 필요): 확정 후 여행 날짜 범위가 헤더에 미표시.** 확정(7/15~17)으로 관리 카드는 사라졌으나(=poll closed), 지도/전환기 헤더가 "도쿄"만 표시하고 날짜 범위("· 7월 15일 – 17일")가 안 보임(앱 재시작 2회 후에도 동일). 대조: 세션 시작 시 있던 오사카 여행은 "오사카 · 9월 21일 – 24일"로 날짜 표시됨. confirmPollDate가 trip.start/end_date를 실제로 set 하는지(또는 헤더가 반영하는지) DB 확인 필요. ※ 관리 카드 사라짐은 poll.status='closed'만으로도 성립하므로 "여행 날짜 기록"의 시각적 확인은 미완.

### 2. 웹 익명 투표 (브라우저 2개 교차 검증)
expected: 브라우저 2개로 `/poll/[code]` 열기 →
  1. 닉네임 입력 전에는 투표 차단("닉네임을 입력해야 투표할 수 있어요"), 입력 후 투표 가능
  2. 계정 없이 range·grid 두 모드 모두 투표; 실패 시 낙관적 롤백 + 에러 토스트
  3. 한 브라우저의 투표/댓글/접속이 다른 브라우저에 실시간 반영 (라이브 집계 + "지금 N명 보는 중" presence + 채팅 fan-out)
  4. 호스트가 확정해 poll이 closed되면 투표 UI 대신 확정 결과 + "이 여행에 함께하기" 가입 CTA 표시, 추가 투표/댓글 거부
result: [not-run] — 2브라우저 realtime 교차 검증 환경(웹 서버는 :3000 구동 중이나 2개 브라우저 컨텍스트 + 유효 poll code + presence 수렴 관찰)이 sim 자동화 범위 밖. 사람 검증 필요(또는 별도 브라우저 자동화 세션). 유효 poll code는 항목 6에서 생성한 도쿄 poll이 이미 closed되어 신규 open poll 필요.

## Summary

total: 2
passed: 1 (pass-with-findings)
issues: 2 (F-19-1 버그, C-19-1 확인필요)
pending: 1 (Test 2 — 미실행)
skipped: 0
blocked: 0

## Findings

- **F-19-1** (버그, 중, plan.tsx 범위형 확정 시트): 세션 내 새로 추가한 후보 날짜가 확정 시트에 "후보 날짜가 아직 없어요"로 표시됨. 재시작 후 정상. RangeConfirmList가 최신 poll 옵션 미재조회.
- **C-19-1** (확인 필요, confirmPollDate / 헤더): 확정 후 관리 카드는 사라지나 여행 날짜 범위가 헤더에 미표시. trip.start/end_date 기록 여부 DB 확인 필요.

## Gaps

- Test 2(웹 2브라우저 presence/realtime/채팅/closed CTA)는 미실행 — 사람 또는 브라우저 자동화 필요.
- 항목 5의 Share 시트 실제 발화는 미검증(버튼 렌더만 확인).
