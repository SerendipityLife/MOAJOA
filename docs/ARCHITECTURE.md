# MOAJOA Architecture

## Why this stack

### TypeScript monorepo (Next.js + Expo + shared packages)

- **2인팀 컨텍스트 스위칭 최소화** — 한 언어, 한 타입 시스템.
- **Zod 스키마는 web·iOS·Edge Function이 동시에 import** → API 계약 drift 없음.
- **pnpm workspaces** (turbo 없음, 단순성 우선) — `pnpm -r` 한 줄로 전 패키지 typecheck/lint.

### Supabase over Firebase

- **관계형 데이터** — boards ↔ links ↔ places ↔ votes ↔ memberships. Firestore에서 같은 그래프를 만들면 denormalization 비용 큼.
- **RLS** — "이 사용자가 이 보드의 멤버일 때만 vote INSERT 허용"이 SQL 한 줄. Firestore Rules보다 훨씬 명료.
- **PostGIS** — 지도 영역(viewport) 내 핀 쿼리, 거리 기반 정렬. Firestore의 geo는 약하고 hacky.
- **Realtime** — 협업 보드 투표 라이브 반영을 Postgres replication으로 받음.
- **비용** — read 무료 청구 모델이 Firestore보다 훨씬 우호적.

### Next.js for Web (입력·저장·편집 풀 서피스), Expo for iOS (v2.1 동결)

- **v2.1 웹 퍼스트 피봇(Phase 23, 2026-07)** — 웹이 입력·저장·편집 풀 서피스 (공유 열람·투표·채팅 포함).
- **공유 링크 비로그인 열람이 핵심 acquisition.** 카톡으로 받은 링크 → SSR로 즉시 렌더링 → OG 카드 → 가입 전환. Flutter Web으로는 이 경험을 만들기 어렵.
- **iOS Share Extension은 Expo로도 가능** — `expo-share-intent` config plugin 사용. 첫 셋업 0.5–1주. (v2.1 웹 퍼스트 동안 iOS 전면 동결 — 작업 보류.)

## Data flow: 링크 추가 → 장소 추출

```
[Web] /onboarding 추가 위저드 또는 /moa/[id] add-sheet에 링크 입력
   ↓
[Web] supabase.from('links').insert({ trip_id, url, source_kind:'youtube' })
   ↓ (RLS: user must be trip editor (can_edit_trip))
[Supabase] links 행 생성, extraction_status='pending'
   ↓
[Web] supabase.functions.invoke('extract-youtube', { link_id })
   ↓
[Edge Function] YouTube oEmbed/Data API → 메타데이터
   ↓
[Edge Function] timedtext → transcript (ko → ja → en 폴백)
   ↓
[Edge Function] Anthropic API (claude-sonnet-4-6) → place candidates JSON
   ↓
[Edge Function] Google Places Text Search → 각 후보 → place_id + lat/lng
   ↓
[Edge Function] places 테이블 upsert (on conflict: trip_id + google_place_id)
   ↓
[Edge Function] links UPDATE extraction_status='ready'
   ↓
[Web] Supabase Realtime 구독으로 places 변경 감지 → 지도 갱신
```

## Data flow: 협업 보드 투표 (Phase 1.5)

```
[A user] 트립 visibility='shared' 설정 → trips.share_slug 자동 생성
   ↓
[A user] /t/[slug] 공유 링크를 카톡에 붙여 친구 B에게 전송
   ↓
[B user] /t/[slug] 클릭 → Next.js SSR로 즉시 렌더링 (비로그인 OK)
   ↓
[B user] "투표하려면 로그인" → magic link → 가입
   ↓
[A user]가 memberships에 B 추가 (role='editor' 또는 'voter')
   ↓
[B user] place에 ❤️ → votes INSERT
   ↓
[Supabase Realtime] votes 채널 → 보드의 모든 멤버 클라이언트가 즉시 update
   ↓
[UI] vote_counts_for_places RPC로 집계 → "확정" 필터 = love/총멤버 >= 0.5
```

## Security model

### RLS 핵심 규칙

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | 모든 인증자 | (auto via trigger) | 본인만 | (cascade) |
| boards | owner + 멤버 (수락됨) | 인증자 (owner=self) | owner | owner |
| memberships | 본인 + 보드 owner | 보드 owner | 본인 (accept) | 본인 또는 owner |
| links | board 읽기 가능자 | board 편집 가능자 | (없음) | 추가자 또는 board owner |
| places | board 읽기 가능자 | board 편집 가능자 | board 편집 가능자 | 추가자 또는 board owner |
| votes | board 읽기 가능자 | board 투표 가능자 (= 멤버) | (없음) | 본인 |

### 공개 보드 익명 접근

직접 테이블 SELECT는 anon에 허용하지 않음. 대신 `public_board_view(slug)` RPC가 SECURITY DEFINER로 동작 — visibility='public' 보드만 노출, share_slug로만 접근 가능 (열거 방지).

### 신뢰 경계

- **클라이언트는 좌표를 보낼 수 없음** — `add_manual_place` RPC가 google_place_id만 받고, Edge Function이 서버사이드에서 Places API로 좌표 resolve. (현재 RPC는 placeholder로 직접 받음, Phase 1.5에 resolve-place Edge Function 추가 예정.)
- **Edge Function은 service role 사용** — 호출자 JWT 검증 후 service role로 DB 쓰기 (RLS bypass). 임의 anon이 호출 불가.
- **API 키 분리** — Google Maps 키는 플랫폼별로 분리·restriction:
  - Web: HTTP referrer (moajoa.app)
  - iOS: bundle ID (com.serendipitylife.moajoa)
  - Server (Places Text Search): IP/no restriction (Edge Function only)

## Localization

- 1차: 한국어 (`ko`) 기본, 일본어 (`ja`) 보조
- Place 이름은 3개 필드 보존: `name_local` (canonical, ja for Tokyo), `name_ko` (사용자 모국어), `name_en` (선택)
- UI 텍스트 i18n은 Phase 2 (`next-intl` + `expo-localization`)

## Performance budgets

- 공개 보드 페이지 SSR: < 800ms TTFB (Vercel Edge)
- iOS 앱 cold start: < 2s (target Expo SDK 51 + Hermes)
- YouTube 추출 end-to-end: < 30s (90th percentile)
- Places API 호출당 비용 < $0.005 (FieldMask 최소화)
