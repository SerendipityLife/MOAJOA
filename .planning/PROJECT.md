# MOAJOA

## What This Is

유튜브·블로그·인스타 링크를 던지면 영상 속 장소를 자동으로 추출해 지도 보드로 만들고, 친구와 공유해 같이 투표·결정하는 도구. 2026-05-24 Flutter(ASIS) → TypeScript 모노레포로 피봇해서 새로 빌드 중. 2인 팀의 사이드 프로젝트.

## Core Value

**"링크 → 30초 안에 지도 위의 핀."** 사용자가 영상 URL을 던지면 손대지 않아도 그 안의 장소가 정확히 지도 위에 떠야 한다. 이게 안 되면 나머지(공유·투표·UI)는 의미 없음.

## Current Milestone: v2.1 — 웹 퍼스트 지도탭 테스트

**Goal:** 유저 반응을 빠르게 관찰하기 위해, 웹에서 입력·저장·편집이 모두 가능한 지도탭(발견+결정) 테스트 버전을 출시한다. iOS는 이번 마일스톤 불변.

**Target features:**
- **온보딩 4단계** — 어디로(도시 칩 9+기타) → 날짜(확정/미정) → 누구랑 → 봐둔 곳(링크/장소검색/skip). 호스트 로그인 필수 + 카카오 OAuth 추가
- **`/moa/[id]` 메인 지도탭** — 순번 불변 장소 리스트(찜순 정렬) + 사람별 핀 색 + 아코디언 상세
- **웹 입력 개방** — 링크(유튜브·블로그) 자동 추출 + 구글 장소 검색 추가 (기존 "웹 생성 UI 금지" 룰 공식 반전)
- **함께 정하기** — 날짜/장소/둘다 모드 선택 → 공유링크 → `/t/[slug]` 통합 공유화면 (기존 /t·/poll 분리 구조 통합)
- **게스트 익명 인증** — 닉네임만으로 찜·날짜투표·장소추가·채팅, 재접속 식별
- **실시간 채팅** — presence + 장소 멘션 답장(#N 순번 지칭)
- **네이밍 개편** — 보드→"모아", 가고싶어→"찜" (유저 대면 카피)

**범위 외 (이번 마일스톤):**
- **플랜·예약·정산 탭 웹 이식** — 지도탭만. 나머지 루프는 반응 확인 후
- **iOS 변경** — 전면 동결
- **게스트 계정 승격 UI** — 익명→정식 전환은 다음 단계
- **스와이프 답장 제스처** — 답장 버튼으로 대체

**진행 상태:** Phase 23 완료 (2026-07-08) — 웹 퍼스트 기반 잠김: 0024 순번 채번(advisory-lock)·0025 share_mode/trip_messages/join_moa·익명 sign-in+카카오 provider(로컬·프로덕션 실증)·core/api 계약 seam·D26 반전. 원격 push(0024·0025)는 Phase 24 Preview e2e 전 필수.

**v2.0 잔여 (보존, 추후 마감):** Phase 19 UAT sign-off · Phase 21 CF 배포(동료 런북 `phases/21-travel-ledger/21-HANDOFF.md`) + device UAT · Phase 22 안드로이드 패러티(웹 테스트 결과 보고 재판단)

*제품 단일 출처: [docs/PRODUCT.md](../docs/PRODUCT.md) · 승인된 구현 설계: v2.1 approved plan (온보딩·스키마 0024/0025·통합 공유화면·채팅)*

## Requirements

### Validated

<!-- 기존 코드에서 추론. 베이스라인은 동작 중. -->

- ✓ **TS 모노레포 기본 구조** (`apps/web`, `apps/ios`, `packages/{core,api,ui-tokens}`) — pivot scaffolding
- ✓ **Supabase 스키마** (boards · memberships · links · places · votes · profiles) — migrations 0001~0006 적용됨
- ✓ **RLS 정책** (SECURITY DEFINER 헬퍼로 사이클 해소 완료) — 0002, 0005에서 안정화
- ✓ **YouTube 추출 Edge Function** (oEmbed → transcript → Claude → Places API → upsert) — baseline 동작
- ✓ **Web SSR 보드 열람 (`/b/[slug]`)** — Next.js 15 App Router에서 동작
- ✓ **이메일/매직링크 인증** — Web + iOS 양쪽
- ✓ **통일 채팅 (trip_messages 단일 표면)** — dates 게스트·/poll 방문자 포함 전 공유 모드가 같은 저장소·`moa:{tripId}` 채널에서 대화, 한마디(poll-chat/date_comments) 은퇴. Validated in Phase 29: Chat Unification (2026-07-14)

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
- ~~**Web 역할 분리**: web에 *새로운* "보드 생성·링크 추가" UI 추가 금지. 그건 iOS 전용~~ → **v2.1에서 공식 반전 (2026-07-07)**: 웹이 입력·저장·편집 풀 서피스. iOS는 동결
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
| 웹 퍼스트 피봇 (v2.1, 2026-07-07) | 유저 반응 검증이 최우선. iOS Share Extension 경로보다 웹 링크 유입이 빠른 실험. 웹 생성 UI 금지 룰(D26) 반전 | — Pending (이번 마일스톤) |
| 게스트 = 익명 인증 + 닉네임 | 익명도 auth.uid 발급·재접속 식별·계정 승격 가능. 기존 RLS가 anonymous를 authenticated로 취급해 재작성 불필요 | — Pending |
| 네이밍: 보드→모아, 가고싶어→찜 | 카톡 대화 발화 자연스러움("제주 모아 만들었어, 찜 해줘") = 바이럴 기준. 브랜드명(모아조아)과 직결 | — Pending |

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
*Last updated: 2026-07-14 — Phase 29 (Chat Unification) 완료: 채팅 단일화·한마디 은퇴·0032 원격 적용. 이전: 2026-07-08 Phase 23 (Web-First Foundation) 완료. 이전: 2026-07-07 milestone v2.1 시작, 2026-06-21 v2.0 (미완 잔여 보존: 19 UAT·21 배포·22), 2026-06-07 v1.1, 2026-05-25 brownfield init*
