# Phase 7: Pending-Failed Links Screen - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 07-pending-failed-links-screen
**Areas discussed:** 화면 형태 & 라우트, 행 표시 & 실패사유 카피, 재시도 UX, 삭제 UX

---

## 화면 형태 & 라우트

| Option | Description | Selected |
|--------|-------------|----------|
| 풀스크린 라우트 | app/boards/failed.tsx 풀스크린 push (router.push 방식 일치, _failed→failed). 뒤로가기 복귀. 목록 비면 empty state. | ✓ |
| 모달/바텀시트 | boards 위 오버레이. 닫으면 바로 boards. 딥링크·뒤로가기 일관성 약함. | |

**User's choice:** 풀스크린 라우트
**Notes:** 현재 배너가 `router.push`라 풀스크린이 자연스러움. 깨진 `/boards/_failed` → `/boards/failed`로 경로 교체.

---

## 행 표시 & 실패사유 카피

| Option | Description | Selected |
|--------|-------------|----------|
| URL+사유배지+상대시각 | URL 1줄 말줄임 + 사유 배지 + "3시간 전". 카피: network=네트워크 오류, auth=로그인 필요, api=서버 처리 실패, unknown=알 수 없는 오류. | ✓ |
| URL+사유만 (시각 생략) | 미니멀. 실패시각 비표시. | |
| URL+사유+재시도횟수 | "N회 시도 후 실패"까지 노출. 다소 잡음. | |

**User's choice:** URL+사유배지+상대시각
**Notes:** [id].tsx mapErrorReason 패턴 재사용. 상대시각 헬퍼는 신규(기존 없음).

---

## 재시도 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 행별 버튼 + 전체 재시도 | 각 행 [재시도] + 상단 "전체 재시도". retryFailedPending → 즉시 drainPendingLinks() → 행 사라짐 + 토스트. 자동 재시도 0 유지. | ✓ |
| 행 탭으로 재시도 (D-11) | 행 전체 탭 = 재시도. 버튼 없음. 삭제는 스와이프로 분리. | |
| 행별 버튼만 | 전체 재시도 없음. | |

**User's choice:** 행별 버튼 + 전체 재시도
**Notes:** 즉시 drain 트리거로 가시적 피드백 확보. Phase 5 D-12(자동 재시도 0) 위배 아님 — 사용자 명시 행동.

---

## 삭제 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 스와이프 + undo 토스트 | 왼쪽 스와이프 삭제. Alert 생략, "삭제됨 [실행취소]" 토스트(toast action slot). 가볍고 복구 가능. | ✓ |
| 행별 × 버튼 + Alert 확인 | 명시적 × + Alert.alert(Phase 3 D-09). 확실하나 탭 1회 추가. | |
| 스와이프, 확인/undo 없음 | 가장 가벼움. 복구 불가. | |

**User's choice:** 스와이프 + undo 토스트
**Notes:** 저장 데이터가 아닌 대기열 항목이라 Alert 대신 undo로 가볍게.

---

## Claude's Discretion

- 상대시각 포맷 세부 문자열("방금"/"N분 전"/"N시간 전"/"N일 전").
- 사유 배지 색/스타일(danger 토큰 계열), 스와이프·전체재시도 애니메이션 디테일.
- "전체 재시도" 버튼 노출 위치(헤더 vs 리스트 상단).

## Deferred Ideas

- 백그라운드 자동 재시도 — v2 (Phase 5 D-12, OBS-01 Sentry 측정 후).
- board_id 없는 pending 항목 해소 UI (Phase 3 D-03 board-picker) — pending이지 failed가 아님, 이 화면 밖.
