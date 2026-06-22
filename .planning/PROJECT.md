# MOAJOA

## What This Is

유튜브·블로그·인스타 링크를 던지면 영상 속 장소를 자동으로 추출해 지도 보드로 만들고, 친구와 공유해 같이 투표·결정하는 도구. 2026-05-24 Flutter(ASIS) → TypeScript 모노레포로 피봇해서 새로 빌드 중. 2인 팀의 사이드 프로젝트.

## Core Value

**"링크 → 30초 안에 지도 위의 핀."** 사용자가 영상 URL을 던지면 손대지 않아도 그 안의 장소가 정확히 지도 위에 떠야 한다. 이게 안 되면 나머지(공유·투표·UI)는 의미 없음.

## Current Milestone: v2.0 — 전면 개편 (발견→예약→정산 풀 루프)

**Goal:** 추출+투표에 머물던 제품을 발견 → 결정 → 플랜 → 예약 → 정산의 풀 루프로 확장하고, 네비게이션을 여행 4단계(지도·플랜·예약·가계부)로 재편한다. 수익(제휴 수수료)을 MVP에 내장.

**Target features:**
- **시작 일정 분기** — 정해짐→날짜·도시 입력 / 미정→일행과 날짜 투표(초대 링크)
- **사용자 트리거 AI 플랜** — 추출로 장소를 모은 뒤 plan 탭 "플랜 만들기"로 AI 초안 생성(추출 직후 자동 아님). 투표는 같은 플랜 위에 얹는 옵션
- **가격비교 + 딥링크 제휴 예약** — Travelpayouts·Stay22(숙소·액티비티·교통·유심). 수수료 Day1
- **여행 가계부** — 개인 전용 주소로 예약 메일 전달 → AI 파싱(카드·통화·환율·결제시점)
- **네비게이션/IA 재편** — `trip/[id]/(tabs)`: 지도·플랜·예약·가계부. 1개면 바로 진입, 새 여행=컨텍스트
- **Android 앱(대표/결제자)** — 또는 임시 반응형 웹 예약

**범위 외 (이번 마일스톤):**
- **여행 당일 실시간**(항공 게이트·공항 주차) — phase 2 프리미엄
- **데이터 라이선싱 · 인앱 MOR 결제** — 장기
- **방문 인증(GPS·영수증)** — 제거 (신뢰 근거는 실제 예약·결제 데이터로)

*제품 단일 출처: [docs/PRODUCT.md](../docs/PRODUCT.md) · 재심사 지원서: [docs/MOAEUM-APPLICATION.md](../docs/MOAEUM-APPLICATION.md)*

## Requirements

### Validated

<!-- 기존 코드에서 추론. 베이스라인은 동작 중. -->

- ✓ **TS 모노레포 기본 구조** (`apps/web`, `apps/ios`, `packages/{core,api,ui-tokens}`) — pivot scaffolding
- ✓ **Supabase 스키마** (boards · memberships · links · places · votes · profiles) — migrations 0001~0006 적용됨
- ✓ **RLS 정책** (SECURITY DEFINER 헬퍼로 사이클 해소 완료) — 0002, 0005에서 안정화
- ✓ **YouTube 추출 Edge Function** (oEmbed → transcript → Claude → Places API → upsert) — baseline 동작
- ✓ **Web SSR 보드 열람 (`/b/[slug]`)** — Next.js 15 App Router에서 동작
- ✓ **이메일/매직링크 인증** — Web + iOS 양쪽

### Active

<!-- v1 (MVP) 범위. 셀프 도그푸딩 가능까지가 목표. -->

- [ ] **iOS 로컬 빌드 통과** — 현재 블로커. Expo SDK 54 + pnpm 모노레포 podspec 경로 이슈
- [ ] **iOS 핵심 동작 검증** — login → boards 탭 → 보드 상세 → 링크 추가 → 핀이 지도에 뜨는 것까지 실기기에서
- [ ] **Share Extension (iOS)** — 카톡/사파리에서 URL 받기 → 보드 선택 → 저장. dogfooding의 핵심 입력 경로
- [ ] **Web `/b/[slug]` 폴리시** — OG 이미지 자동 생성, SEO meta, 모바일 반응형, 핀 클릭 → 영상 타임스탬프 jump
- [ ] **Web의 dev tool UI 격리** — 현재 web에 있는 "보드 생성·링크 추가" 폼을 `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`일 때만 노출
- [ ] **추출 정확도 baseline 측정** — sample 영상 10~20개로 expected vs actual 비교 (개선은 v2)
- [ ] **App icon + splash + 워드마크** — iOS 빌드와 web 헤더에 필요
- [ ] **첫 보드 자동 생성 온보딩** — 첫 로그인 시 "내 첫 여행" 보드 + 짧은 튜토리얼

### Out of Scope (v1)

- **협업 보드 투표·결정 UI** — Phase 1.5로 분리. v1은 단독 저장 + 공개 열람만
- **공개 둘러보기 피드 (`/discover`)** — Phase 2. v1은 자기 보드 + 공유 링크 수신만
- **블로그·인스타 자동 추출** — v1은 유튜브만. 블로그·인스타는 manual queue로 대체 (운영진 추출, Phase 1.5)
- **Google/Apple OAuth** — 이메일/매직링크로 충분히 dogfooding 가능. OAuth는 외부 사용자 확장 시
- **다국어 UI (i18n)** — Phase 2. Place 이름 다국어 보존(`name_local`/`name_ko`/`name_en`)은 이미 스키마에 있음
- **다크 모드** — Phase 2. 토큰은 정의되어 있지만 매핑 안 함
- **에러 트래킹·CI** — dogfooding 단계에선 수동 확인으로 충분. 외부 사용자 받기 전에 도입
- **Flutter 코드 (`_archive_asis/`)** — 영구 archive. 절대 수정·참조 X

## Context

- **2인 팀, 사이드 프로젝트.** 조액(loose) 마감, 수주 단위로 자체 페이싱. 외부 마감·이해관계자 없음
- **피봇 직후 (2026-05-24).** 1년+ 작업한 Flutter 코드를 archive하고 새 스택에서 다시 빌드. 컨텍스트 스위칭 비용 줄이려고 한 언어(TS)로 통일
- **이전 Flutter 학습:** Supabase 스키마·RLS·extraction 로직은 ASIS에서 검증된 패턴을 그대로 가져옴. UI·앱 셸만 새로 만드는 중
- **Workstream 5개** (`docs/WORKSTREAMS.md`): iOS / Web / Backend / Design / Auth — 파일 경계가 거의 겹치지 않게 설계됨
- **현재 블로커는 iOS 빌드** — 백엔드·web은 동작 중이지만 iOS share extension이 안 되면 dogfooding이 안 됨
- **추출 정확도가 진짜 차별점.** Eval-driven 개선은 v2 마일스톤이지만, v1에서도 baseline 측정은 함

## Constraints

- **Tech stack**: TypeScript strict, Next.js 15 (App Router), Expo SDK 56, Supabase, Anthropic claude-sonnet-4-6, Google Places — 이 조합에서 벗어나지 않음
- **Backend**: Supabase only — Firebase/Firestore 재도입 금지 (피봇 결정)
- **DB migrations**: append-only — 기존 SQL 수정 금지, 새 번호 파일만 추가
- **Workspace imports**: `.js` extension 금지 (Turbopack 호환)
- **Web 역할 분리**: web에 *새로운* "보드 생성·링크 추가" UI 추가 금지. 그건 iOS 전용
- **Service role 노출 금지**: 클라이언트 번들에 service key 절대 X. Edge Function만 사용
- **Budget**: 추출 비용 영상당 < $0.005 (Places FieldMask 최소화). Anthropic + Places API 합산
- **Performance**: 공개 보드 SSR < 800ms TTFB, iOS cold start < 2s, 추출 e2e < 30s p90
- **언어**: 1차 한국어, 2차 일본어. UI 텍스트 i18n은 v2

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Flutter → TypeScript 모노레포 피봇 | 2인 팀 컨텍스트 스위칭 비용. Zod 스키마를 web/iOS/Edge가 공유 | — Pending (피봇 직후) |
| Supabase over Firebase | 관계형 데이터·RLS·PostGIS·Realtime·비용 모두 우위 | — Pending (베이스라인 동작) |
| Next.js Web (열람) + Expo iOS (저장) 역할 분리 | 공유 링크 비로그인 SSR 열람이 핵심 acquisition. Flutter Web으로 어려움 | — Pending |
| v1 = 단독 저장 + 공개 열람만 | dogfooding부터 검증. 협업·투표는 Phase 1.5 | — Pending (이번 마일스톤) |
| 성공 기준 = self dogfooding | 사용자 수·런칭 압박 없음. "내가 일본 여행 계획에 실제로 쓸 수 있는가" | — Pending |
| 마이그레이션 append-only | 한 번 prod 적용되면 영구. 0002에서 RLS 사이클 해소한 패턴 유지 | ✓ Good (이미 적용됨) |
| RLS 크로스 테이블 = SECURITY DEFINER 헬퍼 | 직접 EXISTS는 무한재귀. 0002·0005에서 학습 | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-21 — milestone v2.0 시작 (전면 개편: 발견→예약→정산). 이전: 2026-06-07 v1.1, 2026-05-25 brownfield init*
