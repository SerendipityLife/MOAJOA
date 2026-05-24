# MOAJOA

여행 정보를 모아두는 지도. 유튜브 영상 링크를 던지면 영상 속 장소를 자동으로 추출해 지도 보드로 만들고, 친구와 공유해 같이 투표·결정할 수 있는 도구.

## Status

🚧 **Pivot in progress (2026-05-24~)** — 기존 Flutter+Firebase ASIS는 [`SerendipityLife/MOAJOA_ASIS`](https://github.com/SerendipityLife/MOAJOA_ASIS)로 이동. 이 레포는 TypeScript 모노레포로 새로 시작.

**팀 협업을 시작하신다면:** [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md)에서 자신의 트랙 확인 → [`docs/SESSION-NOTES-2026-05-25.md`](docs/SESSION-NOTES-2026-05-25.md)에서 현재 상태 파악.

## 현재 동작 상태 (2026-05-25 기준)

| 영역 | 상태 |
|---|---|
| Web SSR + Auth (이메일+비밀번호, 매직 링크) | ✅ |
| Supabase 마이그레이션 + RLS + Edge Function 배포 | ✅ |
| 유튜브 추출 파이프라인 (Claude + Places API) | ✅ baseline (정교화 필요) |
| iOS 앱 로컬 빌드 | ⚠️ pnpm + RN podspec 이슈로 보류 — `docs/WORKSTREAMS.md § 1` 참조 |
| Google/Apple OAuth | ⚠️ UI만 있고 provider 설정 미완 |
| 공개 보드 `/b/[slug]` 폴리시 (OG, SEO) | ⚠️ baseline만 |

## Stack

- **Web (열람·공개 보드):** Next.js 15 (App Router) · React 19 · Tailwind v4
- **iOS (저장·공유·투표):** Expo SDK 54 (React Native 0.81) · Expo Router · NativeWind v4
- **Backend:** Supabase — Postgres + PostGIS + Auth + Realtime + Storage + Edge Functions
- **Maps & Places:** Google Maps Platform (Maps JS, Maps SDK iOS, Places API New)
- **Extraction LLM:** Anthropic Claude (claude-sonnet-4-6)
- **Lang:** TypeScript end-to-end · Zod for runtime schemas
- **Mono:** pnpm workspaces

## Repo layout

```
moajoa/
├── apps/
│   ├── web/                       Next.js — 공개 보드 SSR, OG, SEO, 비로그인 열람
│   └── ios/                       Expo — share extension 기반 저장, 협업·투표
├── packages/
│   ├── core/                      Zod 스키마, 도메인 상수, 공유 비즈니스 로직
│   ├── api/                       Supabase 클라이언트 + 타입드 쿼리
│   └── ui-tokens/                 디자인 토큰 (web/iOS 공유)
├── supabase/
│   ├── config.toml
│   ├── migrations/                SQL 마이그레이션 (RLS 포함)
│   ├── functions/extract-youtube/ YouTube → Claude → Places → DB 파이프라인
│   └── seed.sql
├── docs/                          아키텍처·운영 문서
└── _archive_asis/                 (gitignored) 이전 Flutter 코드 로컬 백업
```

## Getting started

### Prerequisites

- Node 22+ (`nvm use` — `.nvmrc` 참조)
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Xcode 26+ (iOS 빌드)
- 활성화된 Google Maps Platform 키 (Maps JS + Places API New + Maps SDK iOS)

### Install

```bash
pnpm install
```

### Environment

1. 루트 `.env.example` 참조해 각 위치에 채우기:
   - `apps/web/.env.local`
   - `apps/ios/.env.local`
   - `supabase/.env.local`

2. Supabase 프로젝트 만들기:
   ```bash
   # 로컬 dev
   supabase start
   supabase db reset                 # apply migrations + seed

   # 또는 클라우드 프로젝트와 연결
   supabase link --project-ref <your-ref>
   supabase db push
   supabase functions deploy extract-youtube --no-verify-jwt
   ```

3. DB 타입 재생성 (스키마 바뀔 때마다):
   ```bash
   pnpm supabase:types
   ```

### Run

```bash
# 1. Supabase 로컬 시작 (별도 터미널)
pnpm supabase:start

# 2. Edge Function 핫리로드 서버
pnpm supabase:functions:serve

# 3. Web
pnpm web:dev          # http://localhost:3000

# 4. iOS (별도 터미널)
pnpm ios:start        # Expo dev server
pnpm ios:run          # 시뮬레이터에 빌드 (한 번만)
```

## Architecture (요약)

```
┌────────────────────┐    ┌────────────────────┐
│  apps/ios (Expo)   │    │  apps/web (Next)   │
│  - share extension │    │  - SSR public view │
│  - 저장/투표       │    │  - OG tags         │
└─────────┬──────────┘    └─────────┬──────────┘
          │                         │
          └────────┬────────────────┘
                   ↓
        ┌────────────────────┐
        │  packages/api      │  공통 Supabase 클라이언트 + 쿼리
        │  packages/core     │  Zod 스키마 + 도메인 상수
        │  packages/ui-tokens│  디자인 토큰
        └─────────┬──────────┘
                  ↓
        ┌────────────────────┐
        │  Supabase           │
        │  - Postgres+PostGIS │
        │  - Auth (Apple/G)   │
        │  - Realtime (vote)  │
        │  - Edge Functions   │
        └─────────┬──────────┘
                  ↓
   ┌──────────────┴────────────────┐
   │  extract-youtube Edge Function│
   │  1. YouTube oEmbed/Data API   │
   │  2. timedtext transcript      │
   │  3. Claude → place candidates │
   │  4. Google Places API resolve │
   │  5. DB upsert places          │
   └───────────────────────────────┘
```

## Domain model

핵심 5개 테이블: `profiles`, `boards`, `memberships`, `links`, `places`, `votes`. 자세한 스키마는 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

- **Board**: 여행 단위 큐레이션 묶음 (사용자당 N개)
- **Link**: 영상/블로그/인스타 출처
- **Place**: 영상에서 추출되거나 사용자가 직접 추가한 핀
- **Membership**: 공유 보드의 협업자 (owner/editor/voter)
- **Vote**: place에 대한 ❤️ — 참여자 절반 이상이면 "확정"

## What's next

- [ ] Supabase 프로젝트 생성 + 키 채우기
- [ ] Google Maps Platform 키 발급 + restriction 설정
- [ ] Anthropic API 키 발급
- [ ] iOS share extension 풀 구현 (URL 받아 보드 선택 → 저장)
- [ ] 협업 보드 초대 플로우 (이메일 invite)
- [ ] 투표 라이브 동기화 (Supabase Realtime)
- [ ] 공개 보드 OG 카드 이미지 자동 생성
- [ ] 운영진용 인스타·블로그 보정 어드민 UI

## License

Proprietary — © SerendipityLife
