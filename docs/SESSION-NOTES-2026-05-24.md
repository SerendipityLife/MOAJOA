# Session Notes — 2026-05-24 Pivot Bootstrap

## What landed

새 MOAJOA(영상 큐레이션 보드 모델)의 0번째 마일스톤 스캐폴드.

- **Repo:** https://github.com/SerendipityLife/MOAJOA — main 브랜치에 초기 커밋 푸시 완료 (`6e26e90`)
- **로컬 dir:** `/Users/wcb/Documents/MOAJOA/`
  - 기존 Flutter 코드 → `_archive_asis/` (gitignored, ASIS 원격 보존: https://github.com/SerendipityLife/MOAJOA_ASIS)
- **파일 79개** (코드 + 문서)

### 디렉터리 구조

```
moajoa/
├── apps/
│   ├── web/                     Next.js 15 App Router
│   └── ios/                     Expo SDK 51
├── packages/
│   ├── core/                    Zod 스키마 + 도메인 상수
│   ├── api/                     Supabase 클라이언트 + 쿼리
│   └── ui-tokens/               디자인 토큰
├── supabase/
│   ├── config.toml
│   ├── migrations/0001_init.sql RLS·PostGIS·트리거·RPC 포함
│   ├── functions/extract-youtube/   파이프라인 (Claude + Places API)
│   └── seed.sql
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CREDENTIALS-CHECKLIST.md
│   └── SESSION-NOTES-2026-05-24.md  (이 파일)
├── README.md
├── package.json                 pnpm workspaces
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── .env.example
```

## 주요 결정사항 (이번 세션에서 잠긴 것)

| 결정 | 선택 | 이유 |
|---|---|---|
| 스택 | Next.js + Expo + Supabase | 공유 링크 SSR/OG/SEO가 acquisition의 전부, 관계형 모델, RLS, PostGIS |
| 단일 언어 | TypeScript end-to-end | 2인팀 컨텍스트 비용 최소화 |
| 1차 추출 | 유튜브만 자동, 블로그·인스타는 운영진 수기 | 인스타 자동 추출은 기술적 폭탄 |
| 저장/열람 분리 | 앱(저장) + Web(열람·공개 보드) | 비로그인 공유 열람 = 핵심 acquisition |
| 협업 단위 | 보드(공유 보드 1개 = N개 링크) | 단체 여행 친구들이 같이 편집·투표 |
| 투표 | ❤️ 단일, 과반=확정 | 만장일치 강요하면 결정 멈춤 |
| 수동 핀 추가 | Google Places Autocomplete + URL 붙여넣기 | 좌표 검증, 메타데이터 풍부 |
| 기존 자산 | 안 가져옴 | fresh start로 의존성·기술 부채 깔끔 |

## 동작 가능 상태

### ✅ 코드 레벨 완성
- 타입 시스템 일관성 (`@moajoa/core` 스키마 → web/iOS/Edge Function 공유)
- Supabase 마이그레이션 SQL (실행하면 즉시 동작)
- Edge Function 파이프라인 (모든 단계 구현, 모의 단위 테스트 1개)
- Web 5개 라우트: `/`, `/login`, `/boards`, `/boards/[id]`, `/b/[slug]`
- iOS 5개 화면: 인트로, 로그인, 보드 탭(3개 탭), 보드 생성, 보드 상세

### ⚠️ 실제 동작에 필요한 것 (다녀와서)
1. **`pnpm install`** — node_modules 셋업
2. **API 키 채우기** — 자세한 건 [`CREDENTIALS-CHECKLIST.md`](./CREDENTIALS-CHECKLIST.md)
3. **Supabase 프로젝트 생성** → `supabase link` → `supabase db push`
4. **Edge Function 배포** → `supabase functions deploy extract-youtube`
5. **iOS prebuild** → `cd apps/ios && pnpm prebuild` (네이티브 프로젝트 생성)

## 알려진 한계/TODO

### 🔴 막힐 가능성 (다녀와서 손봐야 할 수 있음)
- **iOS Share Extension**: `expo-share-intent` 플러그인 설정만 했고 실제 수신 핸들러 미구현. `apps/ios/app/_layout.tsx`에서 share intent 받아 `/boards/[id]?prefill_url=...`로 라우팅 추가 필요.
- **add_manual_place RPC**: 현재 클라이언트가 보낸 좌표/이름을 그대로 신뢰. 보안상 Edge Function `resolve-place`가 Places API로 서버사이드 resolve해야 함. Phase 1.5.
- **Supabase 타입**: `packages/api/src/types/database.ts`는 placeholder. 실제 프로젝트 연결 후 `pnpm supabase:types`로 생성.
- **Next.js 15 + Tailwind v4 beta** — beta 의존성. 안 맞으면 `tailwindcss@^3.4.0`으로 다운그레이드 (lib에서 사용한 클래스는 v3 호환).

### 🟡 Phase 1.5에 들어갈 것
- 협업 보드 초대 (이메일 invite + magic link으로 가입)
- 투표 라이브 동기화 (Supabase Realtime 채널 구독)
- 운영진용 인스타·블로그 수기 보정 어드민 UI
- `resolve-place` Edge Function (Places API 서버 프록시)
- OG 카드 이미지 자동 생성 (`@vercel/og`)

### 🟢 Phase 2에 들어갈 것
- "결정 완료" 필터 UI (`isPlaceConfirmed` 헬퍼는 이미 `@moajoa/core`에 있음)
- 둘러보기 탭 (공개 보드 발견)
- 운영진 큐 시스템
- 분석(PostHog) + 에러 트래킹(Sentry)

## GSD 워크플로우 도입 (다음 세션 시작 시)

CLAUDE.md 규칙대로 `/gsd:new-project`로 `.planning/` 초기화 권장. 다만:

- 이번 스캐폴드 단계는 user 승인 하에 명시적으로 bypass
- `.planning/`은 ASIS에 있는 것 → `_archive_asis/.planning/`로 함께 archived
- 새 프로젝트 PROJECT.md / ROADMAP.md는 이번 결정사항 (위 표) 기반으로 작성

다음 세션 첫 명령 후보:
```
/gsd:new-project
```
→ PROJECT.md (위 결정사항 반영) → ROADMAP.md (Phase 1: 인증·보드 CRUD·유튜브 추출 / Phase 1.5: 협업·투표 / Phase 2: 발견·정책)

## 다음 세션 시작 시 체크리스트

1. [ ] `pnpm install` 통과 확인
2. [ ] [`docs/CREDENTIALS-CHECKLIST.md`](./CREDENTIALS-CHECKLIST.md) P0 항목 발급
3. [ ] `apps/web/.env.local`, `apps/ios/.env.local`, `supabase/.env.local` 채우기
4. [ ] `supabase start` → `supabase db reset` → 마이그레이션 정상 적용 확인
5. [ ] `pnpm web:dev` 실행 → http://localhost:3000 접근 (로그인 화면 표시되어야 함)
6. [ ] `pnpm ios:start` 실행 → 시뮬레이터에 앱 빌드 (한 번만, 이후는 HMR)
7. [ ] 매직 링크 로그인 → 보드 생성 → 유튜브 링크 추가 → 추출 동작 확인
8. [ ] CLAUDE.md 새로 작성 (현재 ASIS 버전이 archive에 있으므로 신규 필요)
9. [ ] `/gsd:new-project` 실행해서 `.planning/` 초기화

## 비용 예상 (월간, dev 단계)

| 서비스 | 무료 한도 | dev 예상 비용 |
|---|---|---|
| Supabase | 500MB DB, 1GB storage, 2GB egress, 500K Edge Function invocations | $0 |
| Vercel (web hosting) | hobby tier | $0 |
| Apple Developer | — | $99/year |
| Google Maps Platform | $200 크레딧/월 | ~$0–$50 (사용량 기반) |
| Anthropic Claude | — | ~$5–$20 (영상 100~500개 분석 가정) |
| **합계** | | **~$10–$80/월** |
