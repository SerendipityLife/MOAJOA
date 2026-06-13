# Design: 추출 → 공유 → 투표 자연 흐름

**Date:** 2026-06-14
**Status:** Approved (design), pending spec review
**Scope:** iOS 보드 화면 재구성 + 공유 흐름 + `share_board` 백엔드 1개

---

## Problem (고객 입장 재점검)

iOS에서 링크 추출은 되지만 그 직후가 비어 있다. 고객이 추출 후 막다른 곳에 빠진다:

- **장소가 안 보인다** — 보드 화면의 리스트는 *링크* 목록이고 ([`boards/[id].tsx:225`](../../../apps/ios/app/boards/[id].tsx)), 장소 리스트 UI가 없다. 장소는 지도 마커로만 존재.
- **지도가 자동으로 안 맞춰진다** — `initialRegion`이 첫 마운트(장소 0개) 때 1회만 잡히고, 장소 로드 후 갱신되지 않아 도쿄 기본값에 고정 ([`boards/[id].tsx:106`](../../../apps/ios/app/boards/[id].tsx)). `fitToCoordinates` 호출 없음.
- **공유/투표로 가는 다리가 없다** — 이 보드를 공유하는 버튼이 없고, 친구탭 공유는 범용 `moajoa.app` 링크 ([`friends.tsx:8`](../../../apps/ios/app/(tabs)/friends.tsx)).

정작 투표 경험(❤️ 가고싶어, 영상 점프, 구글맵 열기, 비로그인 참여)은 web `/b/[slug]`에 이미 완성돼 있다 ([`vote-island.tsx`](../../../apps/web/app/b/[slug]/_components/vote-island.tsx)). 빠진 것은 *iOS에서 보여주고 공유로 잇는 다리*다.

## Locked decisions (브레인스토밍)

1. **공유 순간** — 추출 직후 "친구와 정하기" 가이드 CTA + 상단 상시 공유 아이콘 (둘 다).
2. **큐레이션** — 다듬지 않고 바로 공유. 투표(❤️)가 자연스럽게 우선순위를 만든다.
3. **레이아웃** — A안(리스트 중심): 지도 띠(핀 자동맞춤) + CTA + 스크롤 장소 리스트.
4. **여러 영상 리스트 구조** — flat(평면). 장소마다 출처 영상 칩. 같은 place id는 한 줄로 합쳐(이미 DB upsert로 dedup) 투표가 모이게. 2뎁스 그룹은 같은 곳이 중복되어 투표가 분산되므로 채택 안 함.

## Design

### 1. iOS 보드 화면 — A 레이아웃 ([`boards/[id].tsx`](../../../apps/ios/app/boards/[id].tsx))

- **지도**: `MapView`에 `ref` 추가. 장소 로드/변경 시 `mapRef.fitToCoordinates(places.map(coord), { edgePadding, animated })` 호출. 장소 0개면 기존 도시 기본값 유지. (현 `initialRegion` 1회성 로직 대체.)
- **장소 리스트(신규, flat)**: 현재 링크 FlatList 자리를 장소 카드 리스트로. 각 카드:
  - 이름(`name_local`), 카테고리(`category`)
  - 출처 칩: `▶ {영상 타이틀 또는 아이콘}` → `source_timestamp_sec` 있으면 타임스탬프 라벨. (place.link_id → link.title)
  - AI/저신뢰 시각 신호는 기존 마커 규칙(`source_kind`/`confidence`) 재사용.
- **링크/추출 진행**: 상단에 작게 접어둔다(추출 중 StepIndicator는 유지). 보조 정보로 강등.
- **상단 상시 공유 아이콘** + 추출 완료 후 등장하는 **"친구와 정하기" CTA** 버튼.

### 2. 공유 흐름 (빠진 다리)

- CTA 또는 상단 아이콘 탭 → `shareBoard(supabase, boardId)`:
  - 보드가 `private`면 `visibility='shared'`로 전환하고 `share_slug`를 발급/반환.
  - 이미 shared/public이면 기존 slug 반환(멱등).
- 받은 slug로 네이티브 `Share.share({ message: `${webUrl}/b/${slug}` })`. `webUrl`은 `Constants.expoConfig.extra.webUrl` (app.config에 이미 wiring, [`app.config.ts:88`](../../../apps/ios/app.config.ts)).

### 3. 백엔드 — `share_board` RPC (신규, 마이그레이션 0014)

`ensure_share_slug` 트리거는 **BEFORE INSERT 전용**이라, 기존 보드의 visibility를 UPDATE해도 slug가 생성되지 않는다. 따라서:

- 새 마이그레이션 `0014_share_board_rpc.sql`: `share_board(p_board_id uuid) returns text` **SECURITY DEFINER** RPC.
  - `auth.uid()`가 보드 owner인지 확인(아니면 예외).
  - `visibility`가 `private`면 `shared`로 갱신.
  - `share_slug`가 null이면 `ensure_share_slug`와 동일 방식으로 생성.
  - 최종 `share_slug` 반환.
- CLAUDE.md 규칙 준수: append-only 새 번호 SQL, RLS는 SECURITY DEFINER 헬퍼 경유, 변경 후 `pnpm supabase:types`로 `database.ts` 재생성.
- `packages/api`에 `shareBoard()` 쿼리 래퍼 추가.

### 4. 친구 쪽 (web) — 재사용, 변경 없음

`/b/[slug]` → `vote-island`: ❤️ 투표(`castVote`/`retractVote`), 영상 타임스탬프 점프, 구글맵 열기(`buildGoogleMapsPlaceUrl`), 비로그인 `joinSharedBoard`. 이미 동작.

### 5. 결정/확정 — 재사용

❤️ 많은 순 정렬 + 주인 수동 확정(기존 재설계, `0012`/`0013` 반영). v1에서 주인은 web `/b/[slug]`에서 결과를 보고 확정한다.

## New vs Reuse

| 새로 만드는 것 | 재사용 |
|---|---|
| iOS flat 장소 리스트 UI (출처 칩) | `listPlacesByBoard` (데이터) |
| 지도 `fitToCoordinates` (+ ref) | `Share.share`, `webUrl` extra |
| `share_board` RPC + `0014` 마이그레이션 | web `vote-island` 전체 |
| `shareBoard()` api 래퍼 | 투표/확정/`joinSharedBoard` |

## Scope

- ✅ **In**: iOS 보드 화면 재구성(flat 리스트 + 지도 fit) · "친구와 정하기" + 상시 공유 흐름 · `share_board` 백엔드.
- ❌ **Out (후속)**: iOS 안에서 투표 결과/확정 보기(현재는 web에서) · 장소 큐레이션/삭제 UI 고도화 · 출처-영상 그룹 필터 토글 · cross-source place id 정규화(별도 todo).

## Open risks

- `share_board` RPC의 slug 생성 로직이 `ensure_share_slug`와 중복 — 공통 함수로 추출할지 plan에서 결정.
- 보드 도시와 장소 도시가 다를 때 `fitToCoordinates`가 정답(핀 기준). 도시 기본값은 장소 0개일 때만.
- 같은 실제 장소가 map-link `/g/..`와 Text-Search `ChIJ..`로 들어오면 dedup 안 됨(기존 todo). flat 합산은 동일 id에서만 성립.

## Success criteria (검증 가능)

1. 추출 완료 후 보드 화면에 장소가 **리스트로** 보인다(링크가 아니라 장소).
2. 장소가 1개 이상이면 지도가 **모든 핀을 담도록 자동 맞춤**된다(도쿄 고정 아님).
3. 여러 영상을 추가해도 리스트는 flat이고, 같은 place id는 **한 줄**로 합쳐진다.
4. "친구와 정하기"(또는 상시 공유) 탭 → 보드가 shared로 전환되고 `${webUrl}/b/{slug}` 공유 시트가 뜬다.
5. 그 URL을 비로그인으로 열면 web 투표 화면이 나오고 ❤️ 투표가 된다(기존 동작 회귀 없음).
