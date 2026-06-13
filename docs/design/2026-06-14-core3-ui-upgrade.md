# Core 3-Screen UI/UX Upgrade — Design Decisions

> 2026-06-14 디자인 세션 결과. 대상: 핵심 흐름 3화면 (내 여행/홈 · 보드 상세/지도 · 공유/투표).
> 이 문서는 **Phase 14 (추출→공유→투표 자연 흐름)** 의 시각 계약(UI-SPEC) 입력 소스다.
> 시안 목업: `docs/design/mockups/*.html` (브라우저로 열어 확인).

## 한 줄 요약

새 디자인 시스템을 만드는 게 아니라, **이미 정의된 토큰**(`packages/ui-tokens`)을 제대로 활용해
기능 MVP 비주얼 → 소비자용 여행 앱 비주얼로 끌어올린다. 무드는 **클린 미니멀**(Airbnb 위시리스트 + 토스 톤).

## 확정된 방향 (locked)

| 항목 | 결정 |
|---|---|
| 범위 | 핵심 흐름 3화면 (홈 · 상세/지도 · 공유/투표) |
| 무드 | 클린 미니멀 — 흰 배경, 브랜드 블루(#2979FF) 액센트, 볼드 헤드라인, 넉넉한 여백, 카드 radius 16 |
| 홈 커버 | **하이브리드 C+B** — 제목 중심(장소명 칩)이 기본, 대표 장소 사진이 있으면 사진 커버로 자동 업그레이드 |
| 폰트 | Pretendard (기존 토큰 그대로) |

### 홈 커버가 하이브리드인 이유 (사용자 통찰)

미니 지도 썸네일은 **서로 비슷해 보여서 보드 구분이 안 된다** ("지도는 다 비슷비슷하잖아").
구분을 실제로 해주는 건 ① 제목/장소 이름(텍스트), ② 실제 장소 사진, ③ 지역 라벨.
→ 그래서 **장소명 칩(C)을 기본 식별자**로, 사진이 있을 때만 사진 커버(B)로 업그레이드.
폴백 걱정 없음(사진 없어도 항상 장소명으로 구분), 데이터 의존 최소.

## 화면별 디자인

### 1. 내 여행 (홈) — `apps/ios/app/(tabs)/boards.tsx`
- 기존 인사말 헤더 + 날짜칩 톤 유지(이미 좋음).
- 보드 = **커버 카드**: 제목(볼드) + 장소명 칩(상위 3개 + `+N`) + `장소 N · 참여 M명` 배지.
  - 대표 장소 사진이 있으면 상단 히어로 사진 + 하단 반투명 바에 제목/메타 오버레이.
- 수정/삭제 아이콘을 카드 앞에 노출하지 않는다 → **스와이프로 숨김** (파괴적 액션 전면 배치 제거).
- 분석 중 보드는 카드에 인라인 `분석 중…` 표시(기존 extraction-store 활용).

### 2. 보드 상세 / 지도 — `apps/ios/app/boards/[id].tsx`
- **지도가 주인공** + 하단 **드래그 바텀시트**(이미 `@gorhom/bottom-sheet` 사용 중).
- 핀 색 = **카테고리 색** (`colors.category`: nature/food/culture/wellness/shopping).
- 핀 상태 = **핀 토큰** (`colors.pin`: candidate=회색/loved=블루/confirmed=초록/hidden).
- 득표 랭킹 1·2·3위 = **메달 색** (`colors.medal`: gold/silver/bronze).
- 바텀시트 상단 카테고리 필터칩(전체/맛집/명소…), 각 장소 카드: 랭크 메달 + 카테고리 점 + 이름 + 주소 + 하트 수.
- 헤더에 참여자 아바타 스택 + 공유 아이콘.

### 3. 공유 / 투표 — (Phase 14 투표 화면)
- 옵션 카드 + **한 탭 하트 투표** + 실시간 막대 + 참여자 아바타 스택.
- 과반 득표 시 **confirmed 초록 "결정됨"** 상태 전환(2px 초록 테두리 + 칩).
- 마감 D-카운트 칩(`warning` 색).
- 하단 **초대 링크 복사** 바(브랜드 블루 primary) — `shareBoard()` slug 활용(14-01 완료).

## 차용한 레퍼런스

| 화면 | 레퍼런스 | 빌려온 패턴 |
|---|---|---|
| 홈 | Airbnb 위시리스트, 토스 | 저장 장소 모음 카드 + 큰 볼드 헤드라인·따뜻한 톤 |
| 상세 | Google/네이버 지도, Beli | 지도 + 드래그 바텀시트, 랭킹 리스트 |
| 투표 | OpenTable 그룹폴, Fair Pick, 인스타 투표 | 한 탭 즉시 투표 + 실시간 집계 + 마감 |

출처:
- https://pixso.net/tips/travel-app-ui/
- https://codiant.com/blog/ui-design-kit-for-travel-apps/
- https://medium.com/@trshly/opentable-group-poll-feature-ux-ui-case-study-5c2fe60bc5cc
- https://apps.apple.com/mx/app/fair-pick/id6738675363

## 토큰 매핑 (새 토큰 추가 0개)

| 용도 | 토큰 |
|---|---|
| 액센트/primary | `brand.500` #2979FF, `brand.600` 버튼 |
| 카테고리 핀 | `category.{nature,food,culture,wellness,shopping}` |
| 핀 상태 | `pin.{candidate,loved,confirmed,hidden}` |
| 득표 랭킹 | `medal.{gold,silver,bronze}` |
| 결정됨 | `pin.confirmed` / `semantic.success` |
| 마감 임박 | `semantic.warning` |
| 카드 radius | `radii.xl` (16px) |

## 다음 단계

`/gsd-ui-phase 14` 로 이 문서를 시각 계약(UI-SPEC.md)으로 형식화 → `/gsd-plan-phase` → `/gsd-execute-phase`.
