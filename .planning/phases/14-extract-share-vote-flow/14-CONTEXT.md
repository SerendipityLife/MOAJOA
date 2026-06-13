# Phase 14 CONTEXT — 추출→공유→투표 자연 흐름

**Milestone:** v1.3
**Design spec:** [docs/superpowers/specs/2026-06-14-extract-to-vote-flow-design.md](../../../docs/superpowers/specs/2026-06-14-extract-to-vote-flow-design.md)

## 문제 (고객 재점검)
추출 직후가 비어 있음: 장소 리스트 UI 없음(링크 목록만, `boards/[id].tsx:225`), 지도 `initialRegion` 1회성으로 도쿄 고정(`:106`), 이 보드 공유/투표 진입점 없음. 투표 경험은 web `/b/[slug]` `vote-island`에 완성됨.

## 잠금 결정
- 공유 순간: "친구와 정하기" CTA + 상단 상시 공유 (둘 다)
- 큐레이션: 없음 — 바로 공유, ❤️가 우선순위
- 레이아웃: A안(리스트 중심)
- 여러 영상: flat + 출처 ▶칩, place id dedup
- 장소 ▶: 앱 안 임베드 플레이어(`source_timestamp_sec`부터)

## 재사용 (이미 존재)
- web: `vote-island`(❤️ castVote/retractVote, getVoteCounts), `joinSharedBoard`, `buildGoogleMapsPlaceUrl`, `buildYouTubeWatchUrl`
- api: `listPlacesByBoard`, `getBoard`, votes/memberships 헬퍼
- core: `extractVideoId`(youtube id 파서), `detectSourceKind`
- iOS: `PinBottomSheet`(장소 상세 시트 골격), `Share.share`(friends.tsx 패턴), `Constants.expoConfig.extra.webUrl`
- DB: `boards.visibility`/`share_slug`, `ensure_share_slug`(BEFORE INSERT 전용 — UPDATE엔 안 걸림 → 14-01에서 RPC로 보완)

## 신규
- 마이그레이션 `0014_share_board_rpc.sql` (SECURITY DEFINER `share_board`)
- `packages/api` `shareBoard()` 래퍼
- iOS flat 장소 리스트 UI, 지도 `fitToCoordinates`, 임베드 플레이어 시트, 공유 CTA
- 의존성 `react-native-webview` (Expo config-plugin; prebuild+pod install 필요)

## 컨벤션 (CLAUDE.md)
- 마이그레이션 append-only, 새 번호만. RLS는 SECURITY DEFINER 헬퍼 경유.
- 변경 후 `pnpm supabase:types`로 `packages/api/src/types/database.ts` 재생성.
- 워크스페이스 import에 `.js` extension 금지. Zod validate. strict TS.
- react-native-webview 추가 후 빌드: `pnpm install` → `expo prebuild --clean -p ios` → `LANG/LC_ALL=…UTF-8 pod install` → `pnpm sim`.

## 비범위 (후속)
iOS 내 투표결과/확정 보기 · 큐레이션/삭제 UI · 영상별 그룹 필터 · cross-source place id 정규화.
