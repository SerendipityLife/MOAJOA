# Phase 24: Host Flow (온보딩·지도탭) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 24-host-flow
**Areas discussed:** 온보딩 구조·저장 시점, 지도탭 레이아웃, 링크 추출 진행 UX, 함께 정하기 시트+핀 색

---

## 온보딩 구조·저장 시점

| Option | Description | Selected |
|--------|-------------|----------|
| iOS 패턴 미러 | 모아 0개→/onboarding, 1개→그 모아로 바로, 2개+→/moa 리스트 (Phase 17 분기 규칙 이식) | ✓ |
| 항상 /moa 리스트 | 로그인 후 무조건 리스트, 빈 상태에서 온보딩 유도 | |
| 항상 온보딩 먼저 | 로그인하면 무조건 온보딩 시작 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 단일 라우트+스텝 상태 | /onboarding 하나에 클라이언트 스텝 상태 | ✓ |
| 스텝별 라우트 | /onboarding/where 등 라우트 분리 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 마지막에 한 번 | 마지막 단계 완료 시 TripCreateDraft로 한 번에 생성 | ✓ |
| 1단계 후 생성+패치 | 도시 입력 직후 생성, 단계마다 UPDATE | |

| Option | Description | Selected |
|--------|-------------|----------|
| 소실 허용 | 중도 이탈 시 입력값 소실 | ✓ |
| localStorage 초안 보존 | 단계별 입력 저장, 재진입 시 이어서 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 단일 선택 (도시) | 칩 9개 중 하나 또는 기타 직접입력 1개 | ✓ |
| 복수 선택 | 여러 도시 투어 지원 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 캘린더 range 픽커 | 한 캘린더에서 시작·종료 탭 2번 | ✓ |
| 네이티브 date input 2개 | OS 기본 UI, 제작 비용 0 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 칩+직접입력 (누구랑) | 혼자/연인/친구/가족/동료 칩 + 기타 | ✓ |
| 자유 텍스트만 | 입력 필드 하나 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 여러 개 추가 가능 (봐둔 곳) | 담아두고 '완료', 생성 후 일괄 addLink+추출 | ✓ |
| 1개만 추가 | 하나 추가하면 바로 완료 | |

---

## 지도탭 레이아웃

| Option | Description | Selected |
|--------|-------------|----------|
| 풀 지도+드래그 바텀시트 | 지도 전체화면, 리스트는 앵커 2~3단 바텀시트 | ✓ |
| 상단 지도 고정+하단 리스트 | 지도 40~50% 고정, 아래 스크롤 리스트 | |
| 지도/리스트 토글 | 버튼으로 뷰 전환 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 모바일 레이아웃 중앙 고정 | max-width 컨테이너, 구현 1벌 | ✓ |
| 데스크톱 2컬럼 | 지도 좌+리스트 우 | |

| Option | Description | Selected |
|--------|-------------|----------|
| + 버튼→추가 시트 | 하단 고정 + 버튼 → 링크/장소검색 바텀시트 | ✓ |
| 리스트 상단 상시 입력바 | 항상 보이는 입력 필드 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 미니멀 (/moa 리스트) | 모아 카드+새 모아 CTA만 | ✓ |
| 관리 기능 포함 | 이름 변경·삭제 등 | |

---

## 링크 추출 진행 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 리스트에 분석 중 행 | 링크가 '분석 중…' 카드로 바로 뜨고 완료 시 장소 행 전환 | ✓ |
| 토스트+상단 배너만 | 리스트는 장소만 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Realtime 구독 | postgres_changes(places/links) — Phase 25·26 인프라 선행 확보, presence 회피 | ✓ |
| 폴링 | 추출 중일 때만 n초 간격 refetch | |

| Option | Description | Selected |
|--------|-------------|----------|
| 실패 행+재시도 | 실패 상태 유지 + 재시도 버튼 (retry-extraction-button 재사용) | ✓ |
| 토스트만 | 실패 알림 후 행 제거 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 바운드 재조정+토스트 | fitBounds + '장소 N개 추가됨' | ✓ |
| 조용히 추가 | 카메라 유지 | |

---

## 함께 정하기 시트+핀 색

| Option | Description | Selected |
|--------|-------------|----------|
| 바텀시트 3택 카드 | 날짜/장소/둘다 카드, 날짜 확정 시 2택 | ✓ |
| 토글 2개 조합 | 스위치 2개 조합으로 mode 결정 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 복사+시스템 공유 | 클립보드 + 모바일 navigator.share (카톡 도달) | ✓ |
| 복사만 | 클립보드+토스트로 끝 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 현재 모드 표시+변경 허용 | 재공유 시 현재 mode 표시, 변경 시 갱신+재복사 (shareMoa 계약 노출) | ✓ |
| 링크 복사 전용 | 재진입 시 복사만, 모드 변경 숨김 | |

| Option | Description | Selected |
|--------|-------------|----------|
| join 순서로 팔레트 순환 | memberships 가입 순서로 ui-tokens 팔레트(6~8색) 순환 | ✓ |
| user_id 해시 | 결정적 해시로 색 선택 (한 모아 내 충돌 가능) | |

---

## Claude's Discretion

- 캘린더 range 픽커 구체 구현 (자체 vs 경량 라이브러리)
- 바텀시트 앵커 단수·드래그 물리
- 온보딩 스텝 인디케이터·전환 애니메이션
- Realtime 채널 구성 세부 (moaChannelName 규약·"한 토픽 채널 2개 금지" 준수)
- 아코디언 상세 정보 배치 순서

## Deferred Ideas

없음 — 논의가 phase 범위 안에 머묾. pending todo 4건은 검토 후 미포함 (CONTEXT.md deferred 참조).
