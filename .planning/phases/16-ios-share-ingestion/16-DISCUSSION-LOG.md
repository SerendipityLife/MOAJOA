# Phase 16: iOS Share Ingestion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 16-ios-share-ingestion
**Areas discussed:** 보드 타겟팅, 공유 후 앱 진입 경험 (수신 아키텍처·익스텐션 범위는 Claude 재량으로 위임)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| 수신 아키텍처 (A vs B) | +native-intent 다리 vs ShareIntentProvider 통합 | (위임 → A) |
| 보드 타겟팅 (board_id 없음) | 어느 보드로 가나 | ✓ |
| 공유 후 앱 진입 경험 | 열릴 때 뭐가 보이나 | ✓ |
| 익스텐션 범위 | 시트 내 선택 UI vs 캡처만 | (위임 → 표준) |

**Notes:** 사용자가 두 UX 영역만 선택 → 기술 결정(A안, 표준 익스텐션)은 Claude 판단으로 잠금.

---

## 보드 타겟팅

방향 혼동 발생 → 명확화: 사용자가 "보드를 공유하는 개념 아닌가? 그냥 앱만 공유해?"라고 물음. Phase 16은 **수신(밖→MOAJOA)**, Phase 14는 **보드 공유(MOAJOA→밖)** 임을 비유(카톡→앨범)로 설명 후 재질문.

| Option | Description | Selected |
|--------|-------------|----------|
| 스마트: 1개면 자동, 여러개면 선택 | 보드 1개 자동, 2+개 피커. 도그푸딩 초기 마찰 0 | ✓ |
| 마지막 사용 보드로 항상 자동 | 빠르지만 틀린 보드 위험 | |
| 항상 인앱 보드 피커 | 명시적, 매번 탭 추가 | |

**User's choice:** 스마트 — 1개면 자동, 여러개면 선택
**Notes:** 0개/로그아웃 엣지는 큐 머묾(기존 drain) 으로 처리하기로.

---

## 공유 후 앱 진입 경험

### Q1: 자동 추가(보드 1개) 시 진입 화면

| Option | Description | Selected |
|--------|-------------|----------|
| 대상 보드로 이동 + 추출 진행 보임 | 핀 뜨는 과정 보임, "던졌다" 만족감 | ✓ |
| 조용히 백그라운드 + 토스트만 | 현 패턴, 최소 변경 | |
| boards 탭 + 해당 보드 하이라이트 | 목록서 강조, 상세 미진입 | |

**User's choice:** 대상 보드로 이동 + 추출 진행 보임

### Q2: 피커(보드 여러개) 타이밍

| Option | Description | Selected |
|--------|-------------|----------|
| 앱 열릴 때 인앱 바텀시트 피커 | PinBottomSheet 패턴 재사용 | ✓ |
| '미분류'로 두고 나중에 분류 | 마찰 0이나 미완료 항목 쌓임 | |

**User's choice:** 앱 열릴 때 인앱 바텀시트 피커

---

## Claude's Discretion (사용자 위임)

- 수신 아키텍처: **A안** (`+native-intent.tsx` → 기존 `enqueuePendingLink` 큐). 이유: 변경 표면 최소 + Phase 3/7 인프라 보존.
- 익스텐션 범위: **표준 캡처** (expo-share-intent 7 기본). 보드 선택은 인앱.

## Deferred Ideas

- 시트 내 네이티브 보드 선택 UI (SwiftUI)
- 안드로이드 공유 수신
- 다중 링크 일괄 공유 / 텍스트 본문 파싱
