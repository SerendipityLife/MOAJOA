# Phase 17: Trip Foundation & IA 재편 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 17-trip-foundation-ia
**Areas discussed:** Trip↔Board 데이터 모델 / SubID·어트리뷰션 포맷 / 일정 정해짐 생성 입력 / 옛 링크 호환·라우트

---

## A. Trip ↔ Board 데이터 모델

| Option | Description | Selected |
|--------|-------------|----------|
| trip = board (1:1 별칭) | trip_id ≡ boards.id. 새 테이블·마이그레이션 없음 | ✓ |
| 새 trips 부모 테이블 | trips 1 : boards N | |
| trips 테이블 + 1:1 FK | 얇은 래퍼, 미래 1:N 여지 | |

**User's choice:** trip = board (1:1 별칭)

| Option | Description | Selected |
|--------|-------------|----------|
| boards 유지 + core 별칭 | DB는 boards, core가 Trip 노출 (저위험) | |
| boards → trips 물리 rename | 어휘 일관, 비용 큼 | ✓ |

**User's choice:** boards → trips 물리 rename. "기존 데이터, 데이터 구조 전면 재구축 상관없음."

| Option | Description | Selected |
|--------|-------------|----------|
| 0016 리네임(append-only 유지) | ALTER RENAME, 데이터 보존 | |
| 스키마 squash/리셋(trips-native) | 0001~0015 압축, 데이터 전소실 | ✓ |

**User's choice:** 스키마 squash/리셋
**Notes:** CLAUDE.md append-only 규칙을 이번 리셋에 한해 의도적으로 override. 외부 사용자 0명이라 감당 가능. 이후 append-only 재개.

---

## B. SubID / 어트리뷰션 포맷 (Day1 잠금)

| Option | Description | Selected |
|--------|-------------|----------|
| tripId.placeId.userId | 루프 완전 매칭 (placeId optional) | ✓ |
| tripId.userId | place 매칭 포기 | |
| tripId만 | 최소, BM 데이터 밀도 낮음 | |

**User's choice:** tripId.placeId.userId

| Option | Description | Selected |
|--------|-------------|----------|
| opaque click 토큰 | booking_clicks 행이 컨텍스트 보유, 길이 안전 | ✓ |
| raw 압축(short codes) | 자기완결, short-id 컬럼 필요 | |

**User's choice:** opaque click 토큰
**Notes:** Phase 17은 buildAffiliateUrl 시그니처 + 토큰 포맷 계약만 잠금. 토큰 민팅·redirect EF는 Phase 20. 빈 booking_clicks 테이블은 squash 스키마에 포함 권장(최종 plan-phase 판단).

---

## C. "일정 정해짐" 여행 생성 입력

| Option | Description | Selected |
|--------|-------------|----------|
| 프리셋 리스트(일본 도시) | 도쿄·오사카·교토 + 기타 | ✓ |
| Google 자동완성 | 확장성, 과잉 | |
| 자유 텍스트 | 단순, city_code 일관성 깨짐 | |

**User's choice:** 프리셋 리스트(일본 도시)

| Option | Description | Selected |
|--------|-------------|----------|
| 범위 필수(시작~종료) | 정해짐 경로의 정의 | ✓ |
| 시작만 필수, 종료 선택 | 유연, 일정 길이 모름 | |

**User's choice:** 범위 필수

| Option | Description | Selected |
|--------|-------------|----------|
| 생성자 자동 대표 | trips.representative_id, 솔로에 적합 | ✓ |
| 생성 시 명시 선택 | 마찰만 늘음 | |

**User's choice:** 생성자 자동 대표

| Option | Description | Selected |
|--------|-------------|----------|
| 분기 노출 + 미정 '준비 중' | IA 완성도, Phase 19가 채움 | ✓ |
| 정해짐만 노출 | 분기 질문 자체 없음 | |

**User's choice:** 분기 노출 + 미정 '준비 중'

---

## D. 옛 링크 호환 & 라우트

| Option | Description | Selected |
|--------|-------------|----------|
| 라우트 위생만(데이터 복구 X) | NAV-04를 라우트 레벨로 재해석 | ✓ |
| 데이터도 최대한 보존 | Area A(squash)와 충돌 | |

**User's choice:** 라우트 위생만

| Option | Description | Selected |
|--------|-------------|----------|
| 클린 브레이크(옛 라우트 제거) | boards/[id] 제거, share-handler repoint | ✓ |
| 리다이렉트 alias 유지 | 안전망, 유지비 | |

**User's choice:** 클린 브레이크

| Option | Description | Selected |
|--------|-------------|----------|
| /b/[slug] 그대로 | 이름 유지, slug만 trips로 | |
| /t/[slug] 또는 /trip/[slug] | trip 어휘 일관 | ✓ |

**User's choice:** /t/[slug] 또는 /trip/[slug]
**Notes:** D 결과로 NAV-04 / ROADMAP Success Criterion #5("옛 공유 링크 안 깨짐")가 문자 그대로는 충족 안 됨 → 사용자가 사실상 waive. 플래너·verifier는 하드 게이트 삼지 말 것. 요구사항/성공기준 갱신 권장.

## Claude's Discretion
- 기본 착지 탭(plan, 빈 상태) — PRODUCT §6 결정.
- "마지막 본 여행" 영속화 위치(로컬 vs profiles).
- 토큰 base62 구현, RLS 재구성, 프리셋 도시 목록 항목.

## Deferred Ideas
- Google Places Autocomplete 도시 입력 (Phase 2)
- 멀티시티 trip
- 대표 재지정 UI / 멤버 초대 (Phase 19+)
- 옛 boards/[id] 리다이렉트 alias (외부 사용자 생기면 재고)
