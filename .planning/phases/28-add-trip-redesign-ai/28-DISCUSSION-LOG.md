# Phase 28: Add-Trip Redesign (트리플 룩 위저드 + 웹 AI 일정) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 28-add-trip-redesign-ai
**Areas discussed:** 장소 검색→몇 일차 배치, 결과 화면 위치·형태, '일정 만들기' 버튼 게이트, 가이드 카피 노출

---

## Pre-discuss scope lock (roadmap 등록 전 사용자 확정)

레퍼런스 파악·코드 탐색 후, roadmap Phase 28 등록 전에 사용자가 잠근 결정 (CONTEXT D-01~D-11 대응):

| 질문 | 선택 |
|---|---|
| 날짜 스텝 처리 | 캘린더 유지, 스타일만 (→ 이후 기간 pill로 재논의) |
| 히어로 인트로 화면 | 추가하지 않는다 |
| 결과 화면 포함 여부 | 결과 화면도 포함 (→ generate-plan 엔진 존재 확인 후) |
| 결과 화면 엔진 | AI 일정 엔진 연결(유튜브 링크 유무 분기 필요) |
| 결과 화면 타이밍 | 보드로 보내고 버튼으로 생성 |
| 날짜 미정 Day 수 | 기간 pill 고르게 + 초과 시 캘린더 버튼 |
| 기간 저장 방식 | trips.day_count 컬럼 추가 |

---

## 장소 검색 → 몇 일차 배치

**Q1. 플랜 미생성 모아에서 장소 검색 담을 때 '몇 일차?' 묻나?**

| Option | Description | Selected |
|--------|-------------|----------|
| 안 물어본다 — 그냥 담기 | 플랜 없으면 Day 개념이 없으니 핀만. 나중에 '일정 만들기'로 AI 배치 | ✓ |
| 기간 기준 Day 후보 노출 | day_count로 Day 후보 보여주고 플랜 생성 시 반영 — 추가 설계 필요 | |

**Q2. 플랜 존재 + '모르겠다' 선택 시 그 장소의 이후 처리**

| Option | Description | Selected |
|--------|-------------|----------|
| 결과 화면 하단 '아직 안 넣은 곳' 섹션 노출 | 미배치 풀을 하단 섹션으로, 거기서 Day 배치. Phase 18 D-13 정합 | ✓ |
| 즉시 AI 재생성으로 끼워넣기 | 매번 Claude·Routes 비용 + 수동 편집 소실 | |
| 마지막 날 끝에 자동 append | 동선 엉망 위험 | |

**Q3. 수동 배치 장소가 있는데 '일정 다시 만들기' 누르면?**

| Option | Description | Selected |
|--------|-------------|----------|
| 수동 배치는 고정으로 지키기 | 사용자가 명시한 Day는 AI가 못 옮김. EF 계약 확장 필요 | ✓ |
| 덮어쓰고 모달로 경고 | Phase 18 D-11 그대로, 전체 재배치 | |

**Notes:** Q1·Q3 결과로 백엔드 제약 2건 부상 — (a) plan 미생성 시 moveToDay 불가(plan_id 필수), (b) 수동 배치 Day 고정을 재생성까지 살리는 계약은 현 anchor_place_ids로 불충분. CONTEXT D-21에 플래너 설계 항목으로 기록.

---

## 결과 화면 위치·형태

**Q1. Day 탭 + 타임라인 결과 화면 위치**

| Option | Description | Selected |
|--------|-------------|----------|
| 하단 탭에 [일정] 추가 — 3탭 | [모으기][일정][채팅] | |
| 별도 풀스크린 라우트 (/moa/[id]/plan) | X로 닫는 전체화면 | |
| 바텀시트로 올리기 | — | ✓ (재해석: place-sheet가 Day 그룹핑을 가짐) |

**Q2. 지도 연동**

| Option | Description | Selected |
|--------|-------------|----------|
| Day별 핀만 지도에 표시 | 탭 선택 시 그날 장소로 fitBounds + 번호 핀 | ✓ |
| 지도 없이 타임라인만 | 지도는 [모으기]에서 | |

**Q3. 하단 액션 버튼 (multiSelect)**

| Option | Description | Selected |
|--------|-------------|----------|
| 일정 다시 만들기 (재생성) | generate-plan 재호출, 수동 배치 고정 | ✓ |
| 이동수단 토글 (전철/도보/차) | Phase 18 D-08 setTravelMode | ✓ |
| 일정 공유하기 | 기존 share-sheet·shareMoa | ✓ |
| 아무것도 — 보기 전용 | | |

**Notes:** 사용자 재해석이 핵심 — "Place-sheet에 일정별로 장소가 추가되면 되는거니까". 별도 화면/탭 신설 대신 기존 place-sheet의 Day 그룹핑. 레퍼런스 '내 일정으로 담기'는 이미 내 모아라 제외.

---

## '일정 만들기' 버튼 게이트

**Q1. 기간·날짜 모두 미정 모아에서 버튼 누르면?**

| Option | Description | Selected |
|--------|-------------|----------|
| 기간부터 물어보기 | 기간 pill 시트 → day_count 저장 → 생성 | ✓ |
| 그냥 1일로 생성 | EF 기본값, 15개 장소가 Day 1에 다 쌓임 | |
| 버튼 비활성 + 안내 | 모아 설정에서 기간 고치게 | |

**Q2. 추출 중이라 장소 0개/일부일 때 버튼?**

| Option | Description | Selected |
|--------|-------------|----------|
| 추출 중이면 비활성 + 진행 표시 | '장소 찾는 중 N개 분석'. 절반짜리 재생성 방지 | ✓ |
| 언제든 활성 — 현재 장소로 생성 | 비용 중복 | |
| 장소 0개일 때만 막기 | EF 400 최소 가드만 | |

**Q3. '일정 만들기' 버튼 위치**

| Option | Description | Selected |
|--------|-------------|----------|
| place-sheet 안 [일정] 영역 상단 | 빈 상태 CTA → 생성 후 Day 탭으로 | ✓ |
| 지도 위 FAB로 별도 | FAB 2개, 시트 겹침 재발 | |

---

## 가이드 카피 노출 방식 (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| 위저드 '봐둔 곳' 스텝 서브카피 | step-seed 문구 교체, 신규 UI 0 | ✓ |
| 보드 [일정] 빈 상태 안내 | 빈 상태를 가이드로 | ✓ |
| 장소 검색 추가 직후 토스트 | '안 물어보기' 결정 맥락 보완 | ✓ |
| 재생성 버튼 근처 보조 문구 | 수동 배치 고정 규칙을 사용자에게 | ✓ |

**Notes:** 4곳 모두 채택. '몇 일차?' 질문을 없앤 대신, 분기 규칙(링크 유무·검색 추가·수동 배치 고정)을 카피로 전달.

---

## Claude's Discretion

- pill selected 변형: Chip 확장 vs 신규 컴포넌트
- day_count와 start/end_date 둘 다 있을 때 우선순위·정합 (플래너)
- 미배치 풀 → Day 이동 UI(드래그 vs 버튼) — 최소 버튼부터
- Day 그룹 UI를 place-sheet 세로 스크롤 안에 안착시키는 제스처 경계
- 스텝 카운터 표기·전환 애니메이션

## Deferred Ideas

- 결과 화면 Day 간 드래그 재배치 UI
- AI 플랜 품질 eval
- IMG_2926 travelog 피드
- '내 일정으로 담기'(추천 복사)
