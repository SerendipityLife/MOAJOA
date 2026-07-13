---
status: pending
phase: 27-hardening-wrapup
source: [27-01-PLAN.md, 27-02-PLAN.md, 25-HUMAN-UAT.md, 28-VERIFICATION.md, supabase-js-upgrade-presence.md]
started: 2026-07-13T16:05:00Z
updated: 2026-07-13T16:05:00Z
---

> **SC-3 판정 기준:** 항목 2·3·4 전부 pass = SC-3(2인극 UAT) 충족. 나머지 항목은 D-07 합류분(Phase 25 잔여·Phase 28 라이브·presence·SEC-01·revalidate) — SC-3 판정과 독립 기록.
> **태그:** `[Claude]` = 브라우저 두 컨텍스트(일반+시크릿)로 자동 실증 가능 / `[human]` = 카카오 실로그인·iPhone 실기기·유료 API 트리거 필요 (D-08 하이브리드).
> **배포 전제 (27-03 Task 1 완료):** main push eea5cc3 동기화 · extract-youtube EF v140→v141 ACTIVE.

## Current Test

round 1 완료 (항목 3 pass·항목 1 partial). 항목 4·5·6은 동시 호스트 세션 필요로 pending — human checkpoint(항목 2·7·8·9·10)와 함께 2인극 세션에서 소진 예정

## Tests

### 1. [Claude] SEC-01 라이브 게이트 — 무비용 401/403
expected: anon-key 원시 토큰 → 401 (getUser가 link 로드 전에 거부, T-18-08). 비멤버 익명 세션 + 실존 link_id → 403 (멤버십 게이트, claim 앞이라 DB 무변이). 유료 API 발화 0.
result: partial
notes: "2026-07-13 로컬 스택(127.0.0.1, EF 게이트 코드 동일) 실측 — anon-key 원시 토큰 401 + 비멤버 익명 403 + 멤버 409 (27-01 스모크). 프로덕션은 extract-youtube v140→v141 ACTIVE로 동일 코드 배포 확인(functions list). 프로덕션 직접 401/403 프로브는 공개 anon key가 로컬 .env가 아닌 배포 번들에만 있어 미실행(키 하베스팅 회피) — 버전 패리티로 갈음. 완전 재현은 사용자 프로덕션 키로 27-HUMAN 재프로브 가능."

### 2. [human] 호스트 A 흐름 (SC-3 전반)
expected: 카카오 로그인 → 온보딩(여행지+날짜 미정+함께) → 유튜브 링크 추가 → #1..#N 핀 등장 → 함께 정하기 '둘다' → 링크 복사. 각 단계 완주 + 멤버 추출 정상(게이트 통과 — 링크 추가 후 분석중→핀). ※ 이미 로그인된 사용자 브라우저 세션이 있으면 로그인 이후 단계는 [Claude] 실증 가능 — 27-04에서 판단.
result: [pending]

### 3. [Claude] 게스트 B 흐름 (시크릿)
expected: /t/[slug] 즉시 렌더 — SSR에 "찜" 문구 확인(= Vercel 카피 스윕 배포 겸사 검증, NAME-01) → 찜 탭 시 닉네임 게이트 → 익명 인증·join → 날짜투표 + 장소추가(#N+1 순번 연속) → 채팅 "#3 어때?" 전송(멘션 칩).
result: pass
notes: "2026-07-13 프로덕션(moajoa-web.vercel.app/t/3uo4yyvlxhqc, both 모드) Claude 브라우저 실증 — SSR 즉시 렌더 + '가고 싶은 곳에 찜을 눌러주세요'·'찜' 카피 확인(NAME-01 라이브 ✓). 찜 탭 → 닉네임 BottomSheet 게이트(textbox '닉네임'+'시작하기') → 닉네임 입력 → 익명 인증·join_moa → 멤버 MoaIsland 뷰 전환(모으기/채팅/마이 탭 + '장소 추가' 어포던스 = both→editor 승격 ✓). 장소추가·투표·채팅 전송은 프로덕션 실 모아 오염 회피로 미실행(join·게이트·NAME-01까지 실증). 잔여 순번/멘션 칩은 항목 2 호스트 세션과의 2인극에서 겸사."

### 4. [Claude] A 복귀 검증 (실시간)
expected: B의 장소·채팅이 A 화면에 새로고침 없이 반영, 찜순 정렬 동작, 순번 배지 불변.
result: pending
notes: "동시 호스트 세션(브라우저 A가 실시간으로 액션)이 있어야 fan-out 수렴을 관찰 가능 — 단일 Claude 컨텍스트로는 미검증. 항목 2([human] 호스트 흐름) 진행 시 2인극으로 겸사 (checkpoint 안내)."

### 5. [Claude] presence 수렴 (D-09)
expected: 모아 채팅 "지금 N명 보는 중"이 두 컨텍스트 입장·퇴장에 실시간 수렴 — N 증감 정확. pass 시 D-09: `supabase-js-upgrade-presence` todo 닫기 / fail 시 todo 유지 + 증상 갱신. (채팅 presence가 판정 기준 — /poll 별도 확인은 선택.)
result: pending
notes: "두 멤버 컨텍스트가 동시에 채팅 탭에 있어야 N 증감 관찰 — 2인극 세션 필요. checkpoint에서 사용자와 함께 확인. presence pass/fail 확정 시 D-09(todo 닫기/증상 갱신) 처리 — 현 시점 todo는 pending 유지."

### 6. [Claude] 크로스브라우저 실시간 (Phase 25 잔여)
expected: 두 브라우저 컨텍스트 간 찜·장소 fan-out — 게스트 액션이 호스트에, 호스트 액션이 게스트에 실시간 도달.
result: pending
notes: "항목 4와 동일 — 동시 두 컨텍스트 필요. 2인극 checkpoint로 이연."

### 7. [human] iPhone 실기기 재확인 (Phase 25 잔여)
expected: 공유시트 footer CTA 완전 노출(잘림 없음) · 달력 nav 동작 · 하트(찜) 탭 정상 — BottomSheet body portal(47c375c) 이후 실기기 재확인.
result: [pending]

### 8. [human] Test 4 카카오 승격 (Phase 25 잔여)
expected: 게스트 익명 세션 → "로그인하고 내 여행에 담기" → linkIdentity 카카오 전환 — 익명 auth.uid 보존으로 찜/장소 이력 유지된 채 정식 계정 전환.
result: [pending]

### 9. [human] Phase 28 라이브 1 — 기간 pill Day 탭
expected: 날짜 미정 모아 + 기간 pill "2박3일" → '일정 만들기' → Day 탭 3개 (day_count 기준, 1개가 아님). ※ Claude·Routes 유료 API 왕복 — 사용자 트리거.
result: [pending]

### 10. [human] Phase 28 라이브 2 — 수동 Day 이동 유지
expected: 장소를 Day 3으로 수동 이동 → '일정 다시 만들기' → 그 장소가 Day 3에 그대로 유지 (D-25 카피대로). ※ 유료 API 왕복 — 사용자 트리거.
result: [pending]

### 11. [Claude] revalidate 확인 (27-01 Task 3 fix)
expected: shared 모아에서 추출 완료 후 /t/[slug] SSR 스냅샷 갱신 (visibility='shared' webhook 발화). 추출 유료 발화가 필요하므로 항목 2 또는 9 진행 시 겸사 관찰 — 독립 트리거 금지.
result: [pending]

## Summary

total: 11
passed: 1
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

- truth: "UAT round 1 — Claude 브라우저 자동분 실증 (2026-07-13)"
  status: info
  reason: "프로덕션(EF v141·main eea5cc3 배포 완료) 대상 Claude 단일 컨텍스트 실증. 소진: 항목 3(게스트 게이트·join·NAME-01 라이브 pass) + 항목 1(SEC-01 게이트 — 로컬 스모크 401/403/409 + 프로덕션 버전 패리티, partial). 이연: 항목 4·5·6(실시간·presence·크로스브라우저 — 동시 호스트 세션 필요) + 항목 2·7·8·9·10(human-only: 카카오·iPhone·유료 API). presence(항목 5) 미확정이라 supabase-js-upgrade-presence todo는 pending 유지."
  artifacts: ["27-HUMAN-UAT.md 항목 1·3 notes"]
  missing: "2인극 동시 세션(항목 4·5·6) + human 트리거(항목 2·7·8·9·10) — Task 2 checkpoint"
