---
phase: 20-affiliate-booking
plan: 05
subsystem: ios
tags: [expo, booking, affiliate, travelpayouts, click-attribution, nativewind, tdd]
requires:
  - "20-03: @moajoa/core buildAffiliateUrl 실규격 (marker-dot + sub_id) + buildDirectSearchUrl + COMPARE_LABELS"
  - "20-04: @moajoa/api logBookingClick (click INSERT + todo→clicked 전이)"
provides:
  - "apps/ios/lib/booking.ts — mintClickToken / openBooking / openDirectSearch / kkdayAvailable (20-06/07 클릭 핸들러 seam)"
  - "apps/ios/components/booking/compare-frame-card.tsx — CompareFrameCard full/compact (BOOK-03 시각 계약)"
  - "app.config.ts extra 5키: tpMarker/tpTrs/tpKkdayP/tpKkdayCampaignId/tpKkdayFallback"
  - "KKday 딥링크 템플릿 실값 확보 (p=9074 / campaign_id=633) — env 기입만 남음"
affects:
  - "20-06 plan 탭 여행 준비 클러스터 / 20-07 book 탭 체크리스트가 이 두 파일 위에 표면만 얹는다"
tech-stack:
  added: []
  patterns:
    - "오픈-선행 클릭 핸들러: Linking.openURL 즉시 발화 → logBookingClick .catch(() => {}) fire-and-forget (D-14)"
    - "jest expo-constants mock은 lazy getter 필수 — hoisted factory가 mockExtra 초기화 전에 캡처하는 함정"
    - "URL·copy 무지 컴포넌트: onView 콜백 + core COMPARE_LABELS 주입 (조립 지식 격리)"
key-files:
  created:
    - apps/ios/lib/booking.ts
    - apps/ios/components/booking/compare-frame-card.tsx
    - apps/ios/__tests__/booking-open.test.ts
    - apps/ios/__tests__/compare-frame-card.test.tsx
  modified:
    - apps/ios/app.config.ts
    - packages/api/src/queries/bookings.ts
key-decisions:
  - "openBooking은 marker 미배선 시 열지 않고 console.warn — 무귀속 클릭 소모 방지 (dev 안전)"
  - "BookingClickInput.provider를 string으로 확장 — DB free-text 컬럼 + plan 계약(klook/kkday/airalo/{name}_direct 로깅) 충족 (Rule 3)"
  - "providerLabel은 dev-safety warn 메시지에만 사용 — URL/카피 파생 없음"
  - "KKday 템플릿 획득 완료 (skip 아님) — tp.st 폴백 경로도 테스트로 고정되어 이중 안전"
metrics:
  duration: "~15min (코드) + 체크포인트 대기"
  completed: "2026-07-04"
  tasks: 3
  tests: "iOS 15 suites / 107 tests green (booking-open 12 + compare-frame-card 6 신규)"
status: complete
---

# Phase 20 Plan 05: iOS 예약 기반 계층 Summary

**One-liner:** mint→open→log 클릭 핸들러(lib/booking.ts, 오픈-선행 D-14 기계 고정) + CompareFrameCard 비교 프레임(가격 자리 spacer 포함) + Travelpayouts env 5키 배선 — KKday 딥링크 템플릿 실값(p=9074/campaign_id=633)까지 확보.

## What Was Built

### Task 1 — lib/booking.ts + env 배선 (TDD: 8472a23 RED → e5a1fd0 GREEN)

`apps/ios/lib/booking.ts` — 유일한 예약 클릭 핸들러:

| Export | Behavior |
|---|---|
| `mintClickToken()` | expo-crypto `getRandomValues` 16바이트 → base62 16자 → `c_{body}` → `ClickTokenSchema.parse` (~95bit, T-20-04) |
| `openBooking({program, destUrl, ctx, checklistItemId?, providerLabel})` | env marker/trs 읽기 → `buildAffiliateUrl('travelpayouts', …)` 조립 → **`Linking.openURL` 즉시 발화** → `logBookingClick(supabase, …).catch(() => {})` 백그라운드 (D-14). marker 부재 시 열지 않고 warn |
| `openDirectSearch({provider, params, ctx, checklistItemId?})` | D-05 비제휴 agoda/booking — `buildDirectSearchUrl` 경유 동일 순서, provider `'{name}_direct'` 로깅 ('확인함' 전이용) |
| `kkdayAvailable()` | env에 (p+campaign_id) 또는 fallback 존재 여부 — 없으면 KKday 버튼 숨김 (graceful hide) |

`app.config.ts` extra에 5키 append (기존 키·eas 블록 무수정): `tpMarker/tpTrs/tpKkdayP/tpKkdayCampaignId/tpKkdayFallback` ← 대응 `EXPO_PUBLIC_TP_*`, default 없음.

`booking-open.test.ts` 12케이스 — 오픈-선행 `invocationCallOrder` 단언, 영영 pending인 로깅에도 openBooking resolve, reject 삼키기(unhandled 0), 열리는 URL == `buildAffiliateUrl` 산출물(트래킹 도메인 `c137.travelpayouts.com`, 목적지 도메인 직접 오픈 0 — Anti-pattern 1), kkday tp.st 폴백, marker 미배선 가드, 100회 mint 유일성.

### Task 2 — CompareFrameCard (TDD: eb5c8ab RED → 09dca53 GREEN)

`compare-frame-card.tsx` — UI-SPEC Component 0 anatomy 그대로:

- **full:** 아이콘 칩(`w-10 h-10 rounded-xl bg-neutral-100`) + title + 우측 caption 헤더 → provider 행 = 이름 · `─` · 정적 라벨 · **`<View className="flex-1" />` 가격 자리 spacer (D-06)** · [보기]. embedded prop으로 borderless 변형.
- **compact:** `bg-neutral-50 border-neutral-100 rounded-xl` 스트립 — ticket 글리프 + '예약 비교' + provider명 + 미니 [보기].
- [보기]만 brand(`bg-brand-50`/`text-brand-600`), hitSlop ≥44px, a11y `{provider}에서 보기`, `active:opacity-70`, 로딩 상태 없음 (D-14).
- footerVisible(기본 false) → '예약 시 수수료를 받을 수 있어요' (D-16 flag-gated).
- **URL·provider copy 완전 무지** — onView 콜백 + core `COMPARE_LABELS` 주입만 (테스트가 실제 core 상수로 주입 seam 증명).

### Task 3 — KKday 딥링크 템플릿 + 실 env 값 (checkpoint:human-action → 값 전부 획득)

사용자가 Travelpayouts 대시보드(marker 745749)에서 딥링크 3개 생성, **skip 아닌 실값 확보**:

| Program | p | campaign_id | 검증 |
|---|---|---|---|
| **KKday** | **9074** | **633** | Open Q1 해소 — tp.media/r 템플릿 확정 |
| Klook | 4110 | 137 | **A5 대조 성공** — p=4110 == RESEARCH promo_id 4110, campaign 137 == c137.travelpayouts.com 도메인 정합 |
| Airalo | 8310 | 541 | RESEARCH 실측(TP_PROGRAMS.airalo)과 완전 일치 |

- **trs (A3):** 전 프로그램 공통 **545555** — `EXPO_PUBLIC_TP_TRS` 귀속 확인.
- 대시보드 생성 링크는 `marker=745749` 플레인 형태지만, 우리 어트리뷰션은 기설계(marker-dot `{marker}.{token}` + 중복 `sub_id`) 유지 — 이 값들은 env 기입용.
- 위 값들은 모든 제휴 링크에 노출되는 **공개값**이라 SUMMARY 기록 무방 (CONTEXT 판단과 동일 근거).

## User Action Required (env 기입 — 코드 변경 불필요)

`.env.local` / `.env.local.example`은 권한 설정으로 에이전트 쓰기 차단 (plan 예상 케이스 — 우회 안 함). 아래를 직접 기입하면 KKday 포함 전 프로그램이 활성화된다:

`apps/ios/.env.local` (실값):
```
EXPO_PUBLIC_TP_MARKER=745749
EXPO_PUBLIC_TP_TRS=545555
EXPO_PUBLIC_TP_KKDAY_P=9074
EXPO_PUBLIC_TP_KKDAY_CAMPAIGN_ID=633
EXPO_PUBLIC_TP_KKDAY_FALLBACK=https://kkday.tp.st/gVbA69Yv
```

`apps/ios/.env.local.example` (placeholder 5줄):
```
EXPO_PUBLIC_TP_MARKER=
EXPO_PUBLIC_TP_TRS=
EXPO_PUBLIC_TP_KKDAY_P=
EXPO_PUBLIC_TP_KKDAY_CAMPAIGN_ID=
EXPO_PUBLIC_TP_KKDAY_FALLBACK=
```

미기입 상태여도 안전: marker 부재 → openBooking이 열지 않고 warn, KKday env 부재 → `kkdayAvailable()` false로 버튼 숨김, fallback만 있으면 tp.st 경로 (테스트 고정).

## Verification Evidence

- TDD 게이트: RED `8472a23` → GREEN `e5a1fd0` (Task 1), RED `eb5c8ab` → GREEN `09dca53` (Task 2)
- **iOS 15 suites / 107 tests GREEN** (기존 13/89 → +2 suites/+18 tests), iOS typecheck exit 0
- api 회귀: vitest 59/59 GREEN + typecheck exit 0 (provider 확장 후)
- grep 게이트 전부 PASS: `Linking.openURL` == 2 (booking.ts 실호출만) · `expo-web-browser` == 0 · `Math.random` == 0 · `745749` 하드코딩 == 0 (booking.ts + app.config.ts) · `tpMarker` == 1 · 컴포넌트 `flex-1` == 3 (>=2) · 컴포넌트 `Linking` == 0 · `즉시확정|한국어 가이드` == 0 · `보기` >= 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BookingClickInput.provider 타입 확장 (AffiliateProviderType → string)**
- **Found during:** Task 1 GREEN
- **Issue:** 20-04의 `provider: AffiliateProviderType`('travelpayouts'|'stay22')로는 plan 계약(program별 klook/kkday/airalo + 'agoda_direct'/'booking_direct' 로깅)이 타입 에러. DB `booking_clicks.provider`는 free text.
- **Fix:** `provider: string`으로 확장 + 값 도메인 doc-comment. 미사용이 된 `AffiliateProviderType` import 제거.
- **Files modified:** packages/api/src/queries/bookings.ts
- **Commit:** e5a1fd0 (api 59/59 무회귀)

**2. [Rule 1 - Bug] expo-constants jest mock hoisting — lazy getter로 수정**
- **Found during:** Task 1 GREEN 첫 실행 (7 fail)
- **Issue:** hoisted `jest.mock` factory가 `const mockExtra` 초기화 전에 객체를 캡처 → `Constants.expoConfig.extra`가 빈 값 → marker 미배선 경로로 오탐.
- **Fix:** mock을 `get expoConfig()` lazy getter로 — 접근 시점 캡처.
- **Files modified:** apps/ios/__tests__/booking-open.test.ts
- **Commit:** e5a1fd0

**3. [Rule 1 - 게이트 정합] booking.ts 주석 리워딩**
- **Issue:** 헤더 주석의 `Linking.openURL`/`expo-web-browser`/`Math.random` 리터럴이 grep 게이트(호출 지점 카운트 의도)를 오염 (openURL 4로 카운트).
- **Fix:** 의미 유지 리워딩 — 코드 경로 무변경. 게이트 2/0/0 복원.

### 표면화 (plan 명시 케이스, deviation 아님)

- `apps/ios/.env.local.example` 쓰기 차단 → plan 지시대로 우회하지 않고 5줄을 사용자 액션으로 표면화 (위 섹션).

## 핸드오프 (20-06 / 20-07)

- 클릭 핸들러: `import { openBooking, openDirectSearch, kkdayAvailable } from '@/lib/booking'` — 컴포넌트는 URL을 모른다. destUrl은 core `buildSearchDestUrl`/`buildAiraloDestUrl`로 부모가 조립.
- 비교 프레임: `<CompareFrameCard variant="full|compact" rows={[{providerName, labelKo: COMPARE_LABELS.x, onView}]} … />` — 라벨은 항상 core 주입.
- KKday [보기]는 `kkdayAvailable()` 게이트 후 렌더. env 기입 즉시 템플릿 경로(p=9074/campaign_id=633) 활성 — 코드 무수정.
- stay22 배선은 후속 phase (17-02 계약 유지).

## Self-Check: PASSED

- apps/ios/lib/booking.ts — FOUND
- apps/ios/components/booking/compare-frame-card.tsx — FOUND
- apps/ios/__tests__/booking-open.test.ts — FOUND
- apps/ios/__tests__/compare-frame-card.test.tsx — FOUND
- commits 8472a23 / e5a1fd0 / eb5c8ab / 09dca53 — FOUND
