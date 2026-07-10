# Phase 25: Guest Unified Share - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 25-guest-unified-share
**Areas discussed:** 게스트 신원 모델, 닉네임 게이트 & 재접속, 모드별 화면 구성, 게스트 권한 & 추출 비용

---

## 게스트 신원 모델

| Question | Options | Selected |
|----------|---------|----------|
| 기존 poll device_token 처리 | auth.uid 전면 통일 ✓ / 병행 / device_token 유지 | **auth.uid로 전면 통일** |
| 익명 세션 발급 시점 | 첫 참여 액션 ✓ / 페이지 로드 즉시 | **첫 참여 액션 시** |
| 계정 승격 범위 | 범위 밖(defer) / 포함 ✓ | **이번 범위에 포함** |
| (승격 수준 후속) | 최소 심 linkIdentity ✓ / 전체 승격 / 이연 | **최소 심 — linkIdentity 이력 유지** |

**Notes:** 계정 승격은 로드맵/REQUIREMENTS엔 "다음 단계"로 이연돼 있던 항목 — 사용자가 명시적으로 포함 선택, 단 최소 심(별도 병합 화면 없이 linkIdentity로 익명 auth.uid 정식 전환)으로 범위 한정. 스코프 확장을 surface하고 확인함.

---

## 닉네임 게이트 & 재접속

| Question | Options | Selected |
|----------|---------|----------|
| 닉네임 수정 가능 여부 | 고정 ✓ / 언제든 수정 | **고정** |
| 닉네임 중복 | 허용 ✓ / 차단 | **허용** |
| 게스트 색 배정 | member-color 재사용 ✓ / 다른 방식 | **기존 member-color 재사용** |

**Notes:** 게이트 트리거 시점은 신원 모델의 "첫 참여 액션"과 결합되어 이미 확정.

---

## 모드별 화면 구성

| Question | Options | Selected |
|----------|---------|----------|
| 호스트 화면 재현 정도 | 호스트 컴포넌트 재사용 ✓ / 경량 참여뷰 | **호스트 컴포넌트 재사용** |
| dates/both 날짜투표 배치 | share_mode가 구성 결정 ✓ / 별도 탭 | **share_mode가 구성 결정** |
| /poll 라우트 처리 | 유지(레거시) ✓ / /t로 리다이렉트 | **유지(레거시), 신규는 /t 통일** |

---

## 게스트 권한 & 추출 비용

| Question | Options | Selected |
|----------|---------|----------|
| 게스트 링크추가 추출 트리거 | 허용(호스트 동일) ✓ / 장소 직접추가만 | **허용 — 호스트와 동일** |
| 게스트 자기 삭제 | 자기 것만 삭제 ✓ / 삭제 불가 | **자기 것만 삭제 가능** |
| SEC-01 경계 | 멤버십 전제만 세팅 ✓ / 이번에 EF 게이트 구현 | **멤버십 전제만 세팅 (실구현 Phase 27)** |

## Claude's Discretion

- 익명 세션 lazy-init 트리거 위치, poll RPC 임베드 방식, SSR 캐시 경계 — planner/research 재량.

## Deferred Ideas

- 게스트 계정 승격 전체 UX / 닉네임 수정 UI / 추출 EF 멤버십 게이트 실구현(Phase 27) / 카피 스윕(Phase 27).
