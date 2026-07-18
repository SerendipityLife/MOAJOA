# MOAJOA

**링크 하나로 시작해 예약·정산까지 끝내는 AI 여행 플랫폼.**
콘텐츠(유튜브·블로그·인스타)에서 발견한 장소를 AI가 자동으로 지도·일정으로 만들고, 친구와 정하고, 예약하고, 결제 내역까지 정리한다. 그렇게 쌓인 데이터가 다음 여행을 더 똑똑하게 만든다.

> 제품 방향의 단일 출처: [`docs/PRODUCT.md`](docs/PRODUCT.md). 아래는 그 비전과, 지금 실제로 구현된 상태를 함께 적는다.

## Status

🔭 **전면 개편 완료 → 웹 퍼스트 검증 중.** 2026-05 피봇으로 시작한 지도 보드 baseline을 넘어, "발견→결정→설계→예약→정산" 전 주기 비전으로 개편했다. 현재는 **발견+결정을 웹 풀 서피스**로 검증하는 마일스톤 v2.1 진행 중.

- 기존 Flutter+Firebase ASIS는 [`SerendipityLife/MOAJOA_ASIS`](https://github.com/SerendipityLife/MOAJOA_ASIS)로 이동. 이 레포는 TypeScript 모노레포.
- **팀 협업 시작:** [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md) 트랙 확인 → [`.planning/STATE.md`](.planning/STATE.md) 현재 위치 파악.

## 서비스 흐름 & 구현 상태 (2026-07 기준)

비전은 5단계 자동화 레이어. 각 단계의 실제 구현 상태:

| 단계 | 내용 | 상태 |
|---|---|---|
| ① 발견·수집 | 링크 → AI 장소 자동 추출 (좌표·별칭·맥락) → 지도 보드 | ✅ iOS·Web (Claude + Places API) |
| ② 결정 (협업) | 보드 공유(앱 없이 웹 열람) · 실시간 투표 · 채팅 | ✅ Web (`/t/[slug]` 게스트 공유·날짜투표·실시간 채팅) |
| ③ 설계 (플랜) | 확정 장소 → AI가 동선·일정 자동 설계 | ✅ iOS·Web (사용자 트리거 AI 초안) |
| ④ 예약·결제 | 멀티플랫폼 가격비교 → 제휴 딥링크 예약 (수수료) | 🟡 iOS 딥링크 예약 구현 (라이브 배포 잔여) |
| ⑤ 정산 (가계부) | 예약 메일 전달 → AI 파싱 → 카드·통화·환율 자동 정리 | 🟡 iOS 코드 완료 (메일 인프라 배포 잔여) |
| — Android 패리티 | 대표(결제자) 대응 | ⬜ 미착수 (Phase 22) |

> 마일스톤 v2.0(발견→예약→정산 풀 루프, Phase 17~22)에서 iOS 4탭을 구현했고, v2.1(Phase 23~29)에서 발견+결정을 웹으로 확장했다. 단계별 상세는 [`.planning/ROADMAP.md`](.planning/ROADMAP.md).

## Stack

- **Web (발견·결정 풀 서피스 + 공개 열람):** Next.js 15 (App Router) · React 19 · Tailwind v4
- **iOS (저장·공유·플랜·예약·가계부):** Expo SDK 56 (React Native 0.85) · Expo Router · NativeWind v4
- **Backend:** Supabase — Postgres + PostGIS + Auth + Realtime + Storage + Edge Functions
- **Maps & Places:** Google Maps Platform (Maps JS, Maps SDK iOS, Places API New)
- **Extraction LLM:** Anthropic Claude (claude-sonnet-4-6)
- **Lang:** TypeScript end-to-end · Zod for runtime schemas
- **Mono:** pnpm workspaces

## Repo layout

```
moajoa/
├── apps/
│   ├── web/                       Next.js — 발견·결정 풀 서피스 (온보딩·지도탭·게스트 공유·투표·채팅) + 공개 열람
│   └── ios/                       Expo — 저장·공유·플랜·예약·가계부 4탭
├── packages/
│   ├── core/                      Zod 스키마, 도메인 상수, 공유 비즈니스 로직
│   ├── api/                       Supabase 클라이언트 + 타입드 쿼리
│   └── ui-tokens/                 디자인 토큰 (web/iOS 공유)
├── supabase/
│   ├── config.toml
│   ├── migrations/                SQL 마이그레이션 (RLS 포함, append-only)
│   ├── functions/
│   │   ├── extract-youtube/       YouTube → Claude → Places → DB 추출 파이프라인
│   │   ├── generate-plan/         확정 장소 → AI 동선·일정 초안
│   │   ├── inbound-email/         예약 메일 수신 (전용 전달주소)
│   │   ├── parse-email/           메일 → AI 파싱 → 가계부 항목
│   │   └── resolve-place/         장소 후보 → Google Places 확정
│   └── seed.sql
├── docs/                          제품·아키텍처·운영 문서 (제품 단일 출처: PRODUCT.md)
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
┌────────────────────┐    ┌──────────────────────────┐
│  apps/ios (Expo)   │    │  apps/web (Next)         │
│  4탭: 지도·플랜    │    │  온보딩·지도탭·게스트     │
│  ·예약·가계부      │    │  공유(/t)·투표·채팅·열람  │
└─────────┬──────────┘    └─────────┬────────────────┘
          │                         │
          └────────┬────────────────┘
                   ↓
        ┌────────────────────┐
        │  packages/api      │  공통 Supabase 클라이언트 + 쿼리
        │  packages/core     │  Zod 스키마 + 도메인 상수
        │  packages/ui-tokens│  디자인 토큰
        └─────────┬──────────┘
                  ↓
        ┌──────────────────────────┐
        │  Supabase                 │
        │  - Postgres + PostGIS     │
        │  - Auth (카카오·익명·Apple)│
        │  - Realtime (투표·채팅)   │
        │  - Edge Functions         │
        └─────────┬────────────────┘
                  ↓
   ┌──────────────┴───────────────────────────────┐
   │  Edge Functions                               │
   │  extract-youtube  링크 → Claude → Places → 핀 │
   │  generate-plan    확정 장소 → AI 동선·일정    │
   │  inbound-email    예약 메일 수신              │
   │  parse-email      메일 → AI 파싱 → 가계부     │
   │  resolve-place    후보 → Places 확정          │
   └───────────────────────────────────────────────┘
```

## Domain model

여행(`trip`)이 일급 컨텍스트. 전 주기 데이터를 담는 테이블 계열 (마이그레이션 `0016_trips_baseline.sql` 이후, append-only):

- **trip**: 여행 단위 큐레이션 + 컨텍스트 (날짜·도시·대표·공유 모드)
- **link / place**: 영상·글 출처와 추출/수동 핀
- **membership**: 공유 여행의 협업자 (owner/voter, 익명 게스트 포함)
- **date_poll / vote**: 날짜·장소 투표 (비로그인 초대 링크 지원)
- **plan**: AI가 짠 동선·일정 초안 (Day별)
- **booking**: 제휴 딥링크 예약 + SubID 어트리뷰션
- **ledger_entry**: 메일 파싱 가계부 (카드·통화·환율·결제시점 원자 저장)
- **trip_message**: 여행별 실시간 채팅 (`moa:{tripId}` 채널)

> 마이그레이션 히스토리는 [`supabase/migrations/`](supabase/migrations/) 참조. 구 `boards` 스키마는 0016에서 `trips`로 리네임되며 `_archive`로 이동.

## What's next

- [ ] Phase 19 날짜 투표 라이브 UAT sign-off
- [ ] Phase 21 가계부 메일 인프라 배포 (moajoa.app DNS → Cloudflare Email Routing + Worker)
- [ ] Phase 22 Android 패리티 (대표/결제자 대응)
- [ ] Phase 27 Hardening — 추출 멤버십 게이트(비용 남용 차단) + 카피 스윕 + 2인극 UAT
- [ ] 예약·가계부 라이브 배포 및 수수료 어트리뷰션 검증

## License

Proprietary — © SerendipityLife
