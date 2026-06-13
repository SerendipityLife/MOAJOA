# Phase 14 SUMMARY — 추출→공유→투표 자연 흐름

**Executed:** 2026-06-14 · **Status:** code-complete 4/4 + GHRV 픽스 · 14-02 라이브 검증 · 잔여 tap-through UAT

## Commits
- `299033d` 14-01 `shareBoard()` api 래퍼
- `7b84289` 14-02 flat 장소 리스트 + 지도 fitToCoordinates
- `97e4e2a` 14-03 인앱 유튜브 임베드(react-native-webview, PinBottomSheet)
- `4b803aa` 14-04 친구와 정하기 CTA + 상시 공유 → shareBoard → 네이티브 Share
- `9f29c6c` GHRV 루트 래핑 픽스(기존 버그)

## Deviations
1. **14-01 마이그레이션 불필요** — 0001에 `boards_share_slug_before_update` 트리거가 이미 있어, owner가 visibility를 shared로 UPDATE하면 slug가 자동 생성됨(RLS owner 정책으로 UPDATE 허용). 계획했던 `0014_share_board_rpc.sql` + prod db push 게이트 삭제. `shareBoard()`는 순수 api 래퍼.
2. **GHRV 픽스 추가** — 루트 `_layout.tsx`가 `react-native-gesture-handler`를 side-import만 하고 `GestureHandlerRootView`로 안 감쌌음(기존 버그). PinBottomSheet(=14-03 플레이어) 등 모든 bottom-sheet가 GestureDetector 에러. 루트 래핑으로 수정.

## 검증
- **빌드:** SDK 56 + Google Maps + react-native-webview(13.16.1) prebuild+pod install+xcodebuild 성공. tsc 0 / jest 43.
- **라이브(시뮬레이터, 우창범 계정 신규 보드):** 삿포로 영상 `l8PRad4T-IY` 추출 → **19개 장소** ✅ flat 리스트(출처 ▶칩) ✅ 지도 도쿄→삿포로 fitToCoordinates(핀 표시) ✅ "친구와 정하기" CTA + 헤더 공유 버튼 ✅ "19개 핀 추가됨" 토스트.
- **잔여 tap-through UAT (시뮬레이터 macOS 알림센터 오버레이가 클릭 차단으로 미완):**
  - 장소 탭 → PinBottomSheet 임베드 플레이어가 영상 재생 (GHRV 픽스로 unblock됐을 것 — 시각 미확인).
  - 공유/CTA 탭 → 공유 시트에 `${webUrl}/b/{slug}` → 비로그인 web에서 투표.

## 비범위 (todo 유지)
iOS 내 투표결과/확정 보기 · 큐레이션/삭제 UI · 영상별 그룹 필터 · cross-source place id 정규화.
