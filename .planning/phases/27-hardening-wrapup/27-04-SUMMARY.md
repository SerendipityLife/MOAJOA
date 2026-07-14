---
phase: 27-hardening-wrapup
plan: 04
subtitle: 통합 UAT 하이브리드 실행 — round 1 완료, human checkpoint 대기
status: checkpoint
completed: 2026-07-13
requirements: [SEC-01, NAME-01]
commits:
  - dfe681d: "docs(27-04): UAT round 1 — Claude browser verification results"
key-files:
  created: []
  modified:
    - .planning/phases/27-hardening-wrapup/27-HUMAN-UAT.md
---

# 27-04 SUMMARY — 통합 UAT (하이브리드) round 1

**상태: CHECKPOINT — human-only 항목 대기.** Task 1(Claude 자동 실증) 완료, Task 2(human-verify checkpoint)는 사용자 몫이라 자동 승인 불가(허위 pass 금지, plan 명문). Task 3(최종 판정)은 사용자 보고 수신 후.

## Task 1 완료 (dfe681d) — Claude 브라우저 자동 실증

프로덕션(moajoa-web.vercel.app/t/3uo4yyvlxhqc, both 모드 · EF v141 · main eea5cc3 배포 완료) 대상 Claude 단일 컨텍스트 실증:

- **항목 3 (게스트 B) = PASS:** SSR 즉시 렌더 + "가고 싶은 곳에 찜을 눌러주세요"·"찜" 카피 확인(**NAME-01 라이브 ✓**) → 찜 탭 → 닉네임 BottomSheet 게이트 → 닉네임 입력 → 익명 인증·join_moa → 멤버 MoaIsland 뷰(모으기/채팅/마이 + "장소 추가" = both→editor 승격 ✓). 장소추가·투표·채팅은 프로덕션 실 모아 오염 회피로 미실행.
- **항목 1 (SEC-01 게이트) = PARTIAL:** 로컬 스택(EF 게이트 코드 동일) 401/403/409 스모크 통과(27-01) + 프로덕션 v140→v141 ACTIVE 버전 패리티. 프로덕션 직접 프로브는 공개 anon key가 배포 번들에만 있어 미실행(키 하베스팅 회피).
- **항목 4·5·6 (실시간·presence·크로스브라우저) = PENDING:** 동시 호스트 세션이 있어야 fan-out/presence 수렴 관찰 가능 — 단일 컨텍스트로 미검증. 2인극 세션(항목 2와 병행)으로 이연.

**Summary 집계:** total 11 / passed 1 / pending 10.

## Task 2 (checkpoint:human-verify) — 사용자 대기

아래 human-only 5건은 카카오 실계정·iPhone 실기기·유료 API 왕복이라 Claude 대행 불가:
- 항목 2: 호스트 A 흐름 (카카오 로그인→온보딩→유튜브 링크→핀→'둘다' 공유)
- 항목 7: iPhone 실기기 (공유시트 footer CTA·달력 nav·하트)
- 항목 8: 카카오 승격 (linkIdentity 익명→정식, 이력 유지)
- 항목 9: AI 일정 1 (기간 "2박3일"→Day 탭 3개, 유료 1회)
- 항목 10: AI 일정 2 (Day 3 수동 이동→재생성 유지, 유료 1회)
- (겸사) 항목 4·5·6·11: 호스트 세션이 있으면 2인극으로 실시간·presence·revalidate 동시 관찰

## D-09 (presence todo) — 보류

presence(항목 5) 미확정 → `supabase-js-upgrade-presence` todo는 **pending 유지**. 2인극 세션에서 presence 확정 시 처리.

## SC-3 판정 — PENDING

항목 3 pass, 항목 2·4 대기 → SC-3(2인극 UAT) 미충족(미완). 코드·배포는 완료, 라이브 2인극 검증만 잔여.

## 다음 액션

사용자가 human checkpoint 5건 + 2인극 세션(항목 2·4·5·6·11)을 실행하고 결과를 보고하면, Task 3에서 27-HUMAN-UAT.md 최종 판정 기록 + presence todo 처리(D-09) + SC-3 확정. blocker 발견 시 `/gsd-plan-phase 27 --gaps`.

## Self-Check: PASSED (부분 — checkpoint)

- Task 1 automated: round 1 엔트리 존재 ✓ · 항목 3 result=pass ✓ · 비밀값 grep 0 ✓
- Task 2/3: 사용자 대기 (checkpoint) — 허위 완료 마킹 없음
