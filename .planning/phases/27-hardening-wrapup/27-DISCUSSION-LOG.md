# Phase 27: Hardening & 마감 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 27-hardening-wrapup
**Areas discussed:** 추출 게이트 설계(SEC-01), 카피 스윕 범위(NAME-01), 2인극 UAT 구성, 문서·revalidate 마감, 펜딩 todo 교차 확인

---

## 영역 선택

| Option | Description | Selected |
|--------|-------------|----------|
| 추출 게이트 설계 (SEC-01) | 멤버십 검증 위치·타 유료 EF 포함 여부·거부 UX | (자동) |
| 카피 스윕 범위 (NAME-01) | 레거시 vote-island 포함 여부·추가 카피 톤 | (자동) |
| 2인극 UAT 구성 | Claude 주도 vs 수동 vs 하이브리드·잔여 UAT 합류 | (자동) |
| 문서·revalidate 마감 범위 | 문서 수정 깊이·revalidate 확인 방법 | (자동) |

**User's choice:** "추천 방향으로 자동" (free-text) — 전 영역을 Claude 권장안으로 잠금. 개별 Q&A 생략.

---

## 추출 게이트 설계 (SEC-01) — 자동 결정

권장안 채택: extract-youtube에 generate-plan의 기존 2단 게이트(T-18-08 getUser + T-18-09 can_edit_trip 미러)를 link_id→board_id 경유로 이식. 유료 호출 전 403. 타 EF 무변경(generate-plan 이미 게이트됨·resolve-place는 trip 컨텍스트 없음).

**근거:** 스카우트 실측 — extract-youtube는 getUser 게이트까지만 있고 멤버십 체크 부재(익명 세션이 정확히 뚫는 갭). 하우스 패턴이 이미 존재해 신규 설계 불필요.

---

## 카피 스윕 범위 (NAME-01) — 자동 결정

권장안 채택: 라이브 표면만("가고싶어"→"찜": guest-surface·/t/[slug] page). "보드"는 이미 완료 확인. 레거시 vote-island(dead code)는 제외·삭제 안 함(deferred 기록). 변경 파일 테스트 단언 동커밋 동기화.

---

## 2인극 UAT 구성 — 자동 결정 + 사용자 지시

| Option | Description | Selected |
|--------|-------------|----------|
| UAT에서 확인 후 닫기 (Recommended) | presence 확인 항목 포함, 통과 시 todo 닫기 | |
| 범위 밖 — 그대로 보류 | deferred로만 기록 | |
| (free-text) "28까지 완료 후 통합 uat" | Phase 25/28 잔여 전부 + presence를 Phase 27 통합 UAT에 합류 | ✓ |

**User's choice:** "28까지 완료 후 통합 uat" — 통합 UAT 방침 확정.
**Notes:** 실행 방식은 하이브리드(Claude 브라우저 자동 실증 우선, human-only는 27-HUMAN-UAT 체크리스트) 권장안 채택.

---

## Claude's Discretion

- 문서 마감 깊이 (WORKSTREAMS·ARCHITECTURE 역할 기술 수정 수준)
- revalidate 확인 방법 (스모크 방식)
- UAT 문서 구조·순서

## Deferred Ideas

- 레거시 vote-island.tsx + test 삭제 (별도 정리)
- resolve-place getUser 게이트 부재 시 향후 하드닝 항목
- Reviewed-not-folded todos: eas-ios-sharesheet-verify(iOS 동결), maplink-place-enrichment(키 블록), transcript-fallback-no-description(외부 서비스 블록)
