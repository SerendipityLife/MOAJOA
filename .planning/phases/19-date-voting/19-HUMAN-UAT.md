---
status: complete
phase: 19-date-voting
source: [19-VERIFICATION.md]
started: 2026-06-23T06:56:37Z
updated: 2026-07-05T06:25:00Z
updated_by: sim-automation (idb + simctl, iPhone 17 Pro) + web 2-browser (Playwright, localhost:3001) · 원격 Supabase
---

## Current Test

[전 항목 완료. Test 1 PASS(sim, findings 기수정) · Test 2 PASS(웹 2브라우저 Playwright 2 context → 원격 Supabase realtime).]

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
  - **CAVEAT C-19-1 (데이터 정상 — 헤더 렌더 이슈로 강등): 확정 후 여행 날짜 범위가 헤더에 미표시.** 확정(7/15~17)으로 관리 카드는 사라졌으나 지도/전환기 헤더가 "도쿄"만 표시하고 날짜 범위가 안 보임. **F-20-1 조사 중 REST로 도쿄 trip을 직접 조회한 결과 `start_date=2026-07-15, end_date=2026-07-17`가 정상 기록됨** → confirmPollDate는 trip 날짜를 올바르게 set 함(데이터 버그 아님). 남은 것은 헤더가 확정 후 trip 날짜를 다시 안 읽어오는 **렌더 갱신 문제**(경미). 대조: 오사카 여행은 "오사카 · 9월 21일 – 24일"로 표시됨.

### 2. 웹 익명 투표 (브라우저 2개 교차 검증)
expected: 브라우저 2개로 `/poll/[code]` 열기 →
  1. 닉네임 입력 전에는 투표 차단("닉네임을 입력해야 투표할 수 있어요"), 입력 후 투표 가능
  2. 계정 없이 range·grid 두 모드 모두 투표; 실패 시 낙관적 롤백 + 에러 토스트
  3. 한 브라우저의 투표/댓글/접속이 다른 브라우저에 실시간 반영 (라이브 집계 + "지금 N명 보는 중" presence + 채팅 fan-out)
  4. 호스트가 확정해 poll이 closed되면 투표 UI 대신 확정 결과 + "이 여행에 함께하기" 가입 CTA 표시, 추가 투표/댓글 거부
result: [pass] — 2026-07-05 웹 2브라우저 검증(Playwright 2 context, Chrome for Testing headless, fresh `next dev`@3001 → 원격 Supabase realtime). **셋업**: iOS 온보딩 dateless 흐름으로 후쿠오카 open poll(범위형, 후보 7/11–13·7/25–27) 생성 → 초대 링크 `…/poll/lv7bbwzfbqoc` 확보. 4개 항목 전부 통과:
  - 항목 1 PASS: 닉네임 입력 전 게이트("먼저 닉네임을 정해주세요") 표시, 빈 상태로 시작하기 → 토스트 "닉네임을 입력해야 투표할 수 있어요." + 게이트 유지(투표 차단). 닉네임 입력 후 투표 UI(가능/불가) 노출.
  - 항목 2 PASS: 계정 없이 범위형 투표 — A(앨리스) '가능' → 낙관적 집계 "1명 가능", 양쪽 투표 시 "2명 가능"으로 서버 truth 수렴. (그리드 모드도 동일 island가 렌더 — 별도 확인.)
  - 항목 3 PASS: A의 투표가 B에 **실시간 반영**(vote broadcast → refetchTally, "1명 가능"→"2명 가능") + 집계에 투표자 닉네임(앨리스·밥) 칩 표시 + **presence "지금 2명 보는 중" 양쪽 수렴**(supabase-js 2.110.0) + **채팅 fan-out**(A 전송 "언제가 다들 좋아요?" → B 실시간 수신). ※ presence는 2.110.0 필요 — Test 20-6 F-20-3 참고.
  - 항목 4 PASS: 호스트(iOS)가 7/11–13 확정 → poll closed → 웹 재로드 시 투표 UI 대신 **"확정: 7/11–7/13"** 결과 + **"이 여행에 함께하기" 가입 CTA**(href /login) 표시, 투표 버튼 0개(추가 투표 거부) + 채팅 "투표가 마감되어 메시지를 남길 수 없어요"(보내기 버튼 0 — 댓글 거부). ⚠️ **CAVEAT C-19-2**: 웹 SSR poll 캐시(`getCachedPoll` unstable_cache, revalidate 3600s + tag)는 호스트가 iOS에서 닫아도 자동 무효화되지 않음(iOS는 Next revalidateTag를 호출 안 함) — UAT에선 dev 서버 재시작으로 closed 반영. 프로덕션에서 stale-open 창(≤1h) 동안 재로드한 방문자는 투표 UI를 보나, cast_date_vote가 closed poll을 거부해 데이터 정합은 유지(닫힘 화면 즉시성만 지연). 폴 닫기 시 web 캐시 무효화 경로(revalidate route) 검토 권장.

## Summary

total: 2
passed: 2 (Test 1 pass · Test 2 pass)
issues: 0 (F-19-1·C-19-1 기수정; C-19-2는 경미 caveat)
pending: 0
skipped: 0
blocked: 0

## Findings

- **F-19-1** (버그, 중 → **FIXED** 2026-07-05, plan.tsx): 세션 내 새로 추가한 후보 날짜가 확정 시트("날짜 확정")에 "후보 날짜가 아직 없어요"로 표시. **원인:** 확정 시트(RangeConfirmList/GridConfirmBlock)는 후보를 `options`가 아니라 `tally`(투표 집계)에서 뽑는데, `onAddOption`/`onRemoveOption`이 `options`만 갱신하고 `tally`는 refetch 안 함 → 세션 내 stale(재시작 시 loadPoll이 tally도 받아 정상). **수정:** 두 핸들러에서 옵션 변경 후 `getPollTally` refetch 추가. **검증(sim):** 후보 추가 → 재시작 없이 확정 시트에 "2026-07-18 – 2026-07-20 · 0명 가능" 즉시 표시. commit(아래).
- **C-19-1** (경미 → **FIXED** 2026-07-05, plan.tsx): 확정 후 여행 날짜 범위가 헤더에 미표시. **원인:** title은 생성 시 `autoBoardTitle(city,start,end)`로 구워짐(dateless="도쿄", 날짜형="도쿄 · MM월 DD일"). confirmPollDate는 날짜만 set하고 title은 그대로 → 헤더(title 표시)가 도시만. **수정:** `onConfirmPick`에서 confirmPollDate 후 `updateTrip`으로 title을 `autoBoardTitle(city, 확정 날짜)`로 재생성(날짜형 생성 trip과 동일 포맷). **검증(sim+REST):** 확정 후 DB title="오사카 · 7월 18일 – 20일"(날짜 반영), 재시작 후 헤더도 "오사카 · 7월 18일 – 20일" 표시. ⚠️ 헤더는 마운트-1회 fetch라 확정 **직후 즉시** 반영은 아니고 다음 remount(트립전환/재시작/네비)에 반영 — 데이터 정합은 확보, 즉시 갱신은 헤더의 기존 일반 제약(범위 밖).

## Gaps

- 항목 5의 Share 시트 실제 발화: Test 2 셋업 중 dateless poll "초대 링크 복사"가 실제 iOS Share 시트를 발화(공유 텍스트 "MOAJOA에서 같이 날짜 정해요!… /poll/<code>")하는 것 확인 → **해소**.
- C-19-2(웹 SSR poll 캐시가 호스트 닫기에 자동 무효화 안 됨): 프로덕션 stale-open 창(≤1h) — 폴 닫기 시 web 캐시 revalidate 경로 검토 권장(별도 이슈).
- 그리드 모드 웹 투표는 island 동일 경로로 렌더됨을 확인(범위형으로 실투표 검증) — 그리드 실투표 픽셀 검증은 미실행(동일 castDateVote/broadcast 경로).
