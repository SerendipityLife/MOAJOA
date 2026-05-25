# Phase 5: Trust UI & Onboarding — Research

**Researched:** 2026-05-26
**Domain:** iOS 신뢰 시각 UI (react-native-maps marker variants + bottom sheet 확장 + step indicator) + Web 미니멀 parity + Postgres trigger 기반 첫 보드 자동 생성 + AsyncStorage 1회 안내 카드
**Confidence:** HIGH (모든 핵심 결정 lock + 코드베이스 verified + native dep 버전 확정)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 ~ D-25)

**Per-place confidence (TRUST-04 prerequisite):**
- **D-01:** `places.confidence numeric(3,2)` 컬럼을 새 마이그레이션 `0006_per_place_confidence.sql`로 추가. nullable, CHECK `(confidence is null or confidence between 0 and 1)`. `links.extraction_confidence`(평균)는 그대로 유지 — 역할 분리.
- **D-02:** `extract-youtube/index.ts`의 places upsert 시 `confidence: candidate.confidence` 한 줄 추가. (`ExtractedPlaceCandidate` Zod 스키마에 이미 `confidence: z.number().min(0).max(1).default(0.5)` 존재 — wire만)
- **D-03:** `public_board_view` RPC + `listPlacesByBoard` 헬퍼가 `confidence` 컬럼을 추가로 반환. 0006에서 RPC redefine + `packages/api/src/queries/places.ts` 매핑 확장. Type regen 필수 (`pnpm supabase:types`).
- **D-04:** confirm/reject 상태는 별도 컬럼 X — confirm = `source_kind: 'ai' → 'manual'` PATCH + `confidence: null`; reject = `hidden_at = now()` (soft delete, 기존 `places_board_idx where hidden_at is null` 인덱스 활용). 별도 `confirmed_at` 컬럼 도입 X.

**TRUST-01 AI vs manual 시각:**
- **D-05:** iOS — marker `pinColor` 차이. AI high conf: `#F97316` opacity 1.0 / AI low conf (<0.7): `#F97316` opacity 0.5 + `?` 배지 custom view / manual: `#0F172A` opacity 1.0. **점선 시각 채택 X** (native PinView 한계).
- **D-06:** Web — Google Maps Marker SVG icon으로 색 + 투명도 차이만. ai high: `#F97316`/1.0, ai low: `#F97316`/0.45 + 흰색 `?`, manual: `#0F172A`/1.0. InfoWindow/클릭 핸들러 변경 X (Phase 4 D-14 그대로). **Web에 confirm/reject 인터랙션 도입 X (D-17 lock 유지).**

**TRUST-02 추출 진행 단계 UI:**
- **D-07:** 5단계 step indicator — text-only progress strip (이산). 연속 progress bar X (Phase 2 broadcast가 이산 5단계 + duration 가변).
- **D-08:** Layout = Phase 3 spinner overlay 자리 그대로, 컨텐츠만 step list로 교체. `bg-white/70` full-screen overlay 유지. 중앙 column: ActivityIndicator(brand-500) + 5줄 step list (완료=●14/400 neutral-500, 현재=●16/600 brand-500, 미래=○12/500 neutral-300).
- **D-09:** Step name → 한국어 카피 fixture:
  | step | 한국어 |
  |---|---|
  | metadata | 영상 정보 가져오는 중 |
  | transcript | 자막 읽는 중 |
  | llm | 장소 찾는 중 |
  | places | 지도에 표시하는 중 |
  | done | overlay dismiss |
  | error | overlay dismiss + error toast (D-10) |

**TRUST-03 실패 retry UX:**
- **D-10:** Retry = error toast에 inline `[재시도]` 버튼. auto-dismiss 5초→8초 연장. 사용자 dismiss 시 retry 기회 사라짐 (링크 리스트에서 재시도 가능 D-11).
- **D-11:** 링크 리스트 행 status: pending/processing/ready/manual_review = neutral, failed = `text-danger` "분석 실패 — 탭하여 재시도". failed 행 탭 = `triggerExtraction` 재호출 + overlay 진입. Edge Function idempotency는 Phase 2가 처리.
- **D-12:** 자동 재시도 횟수 = 0 (사용자 명시 행동만).

**TRUST-04 low_confidence:**
- **D-13:** 시각 = opacity 0.5 + `?` 배지(D-05). bottom sheet 헤더에 `text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700` 배지 "신뢰도 낮음" + 한 줄 안내 `"AI가 자신 없어해요. 맞으면 확인, 아니면 삭제해 주세요."`
- **D-14:** 액션 = bottom sheet 기존 버튼 stack에 인서트. `[확인]` (primary, brand-500) → `[잘못됨]` (destructive secondary, border-danger). 기존 `[삭제]`는 별도 (영구 삭제, Alert confirm).
- **D-15:** Threshold = `confidence < 0.7` 정확히. `confidence is null` = low_confidence X (manual or legacy data). `LOW_CONFIDENCE_THRESHOLD = 0.7` 상수 `packages/core/src/constants.ts` export.

**ONBOARD-01 첫 보드 자동 생성:**
- **D-16:** Postgres 트리거 — 클라이언트 코드 X. `profiles` insert 후 트리거. title `"내 첫 여행"`, visibility `private`. `if not exists (select 1 from boards where owner_id = NEW.id)` 가드.
- **D-17:** 트리거 함수 = SECURITY DEFINER + `set search_path = public, auth`. 0002 `am_board_owner` 헬퍼 패턴 차용.
- **D-18:** 기존 사용자 = 별도 1회 backfill SQL 마이그레이션 끝에 포함.

**ONBOARD-02 안내 카드:**
- **D-19:** 카드 = 보드 상세 inline dismissible banner (modal X). 위치: URL TextInput 위. `mx-6 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex-row items-start`. 좌측 `💡` 또는 lucide `<Sparkles />`. 우측 `×`.
- **D-20:** AsyncStorage 글로벌 1회 `@moajoa/onboard:link_card_dismissed`. 가시성: `!dismissed && places.length === 0 && links.length === 0`. `OnboardKeys.LinkCardDismissed` 상수 export.
- **D-21:** 모든 빈 보드에서 표시 (첫 보드 한정 X — dismiss 안 됐다면).

**Phase 3 UI-SPEC holdout 회수:**
- **D-22:** `text-xs` (12px) + `font-medium` (500) 본 phase에서 활성화. low_confidence 배지, step indicator 미래 단계, 안내 카드 헤더.
- **D-23:** Phase 3 UI-SPEC `Tokens available but NOT used` 표 갱신.

**Web parity:**
- **D-24:** Web public board는 marker 색 분기만, 인터랙션 0. ~10줄 코드 추가.
- **D-25:** OG image 변경 없음.

### Claude's Discretion (researcher/planner가 정함)

- 마이그레이션 번호 (0006 단일 vs 0006/0007 분리 — confidence 컬럼 + first_board 트리거)
- AsyncStorage 라이브러리 선택 (`@react-native-async-storage/async-storage` 표준)
- `?` 배지 marker custom view 구현 방식 (Marker children vs `image` prop)
- 안내 카드 좌측 아이콘 (emoji vs lucide)
- step indicator dot 컴포넌트 (Text `●`/`○` vs SVG)
- low_confidence 배지 색 (amber-50/700 vs neutral-100/600)
- ONBOARD-01 트리거 vs Edge Function 호출

### Deferred Ideas (OUT OF SCOPE)

A/B testing 안내 카드, Native push notification "분석 완료", multi-step splash 튜토리얼, AI confidence 영상 평균 비교 시각, 수동 핀 별점/메모, Empty board illustration, low_confidence modal 강제, 첫 보드 sample 영상 자동 추가, confidence 숫자 노출 (0.42), Web confirm/reject 인터랙션 (D-17 lock), Reject 피드백 prompt, Onboarding telemetry, 다국어 안내 카드, 다크 모드 amber, Apple/Google OAuth 직후 onboarding.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRUST-01 | AI vs 수동 핀 시각적 구분 (점선·실선, 아이콘 색) | iOS: react-native-maps `<Marker pinColor opacity>` + custom view children (D-05 §Marker pattern). Web: Google Maps SVG icon `data:image/svg+xml` (D-06 §Web SVG marker). Confidence 값은 D-01 마이그레이션으로 places 컬럼 추가 + D-03 RPC 확장 후 client wire. |
| TRUST-02 | 추출 진행 단계 UI 노출 (`extract:{link_id}` 구독) | Phase 3 `subscribeExtractProgress` (`apps/ios/lib/realtime.ts`)이 이미 metadata/transcript/llm/places/done/error 모든 step 수신. UI 분기만 확장 (D-07/D-08). 한국어 fixture는 `packages/core/src/constants.ts` `EXTRACT_STEP_KO` 신규 export (D-09). |
| TRUST-03 | 추출 실패 시 사유 + 1탭 retry | `apps/ios/lib/toast.tsx` `showToast(message, kind, durationMs)` 시그니처에 `action?: { label, onPress }` 추가 (Phase 3 toast 확장 D-10). `triggerExtraction(supabase, link_id)`는 Phase 3가 이미 export. 링크 리스트 행 D-11 = `FlatList renderItem` Pressable wrap. |
| TRUST-04 | confidence<0.7 시각 약화 + confirm/reject | D-13 bottom sheet variant (`apps/ios/app/boards/_pin-sheet.tsx` props 분기) + D-14 액션 인서트. confirm/reject helper = `packages/api/src/queries/places.ts`에 `confirmAiPlace` (= UPDATE source_kind, confidence) + `rejectAiPlace` (= alias hidePlace 또는 UPDATE hidden_at). |
| ONBOARD-01 | 신규 가입 시 "내 첫 여행" 보드 자동 생성 | Postgres trigger AFTER INSERT on `profiles` (D-16/D-17). 0001_init.sql `handle_new_auth_user` 트리거가 auth.users → profiles insert 처리 중 — 본 trigger는 profiles에 chain. Backfill SQL 포함 (D-18). |
| ONBOARD-02 | 첫 진입 시 "유튜브 링크 붙여넣기" 안내 1회 표시 | AsyncStorage 3.1.0 already in apps/ios deps (verified — v2.2.0 actual, SDK 54 호환). `apps/ios/lib/onboarding.ts` 신규 wrapper (SharedDefaults 패턴 차용 D-20). 보드 상세 [id].tsx URL TextInput 위에 banner. |

</phase_requirements>

## Summary

Phase 5는 dogfooding 신뢰의 1번 위협(confident-wrong)을 시각·인터랙션 contract로 차단하는 phase다. iOS가 주 surface (TRUST + ONBOARD 모두), Web은 TRUST-01 marker 색 분기만 미니멀하게 반영. 6개 요구사항 모두 **기존 Phase 2/3/4 인프라 확장으로 처리** — 신규 라이브러리 도입 0개, 신규 native 의존성 0개 (AsyncStorage·gorhom/bottom-sheet·react-native-maps 모두 이미 설치됨).

핵심 작업 5개: (1) 0006 마이그레이션 — `places.confidence` 컬럼 + `public_board_view` RPC 재정의 + `profiles_create_first_board` 트리거 + backfill, (2) Edge Function `extract-youtube/index.ts` places upsert에 `confidence` wire, (3) `packages/core/src/constants.ts`에 `EXTRACT_STEP_KO`/`LOW_CONFIDENCE_THRESHOLD`/`OnboardKeys` 추가 + `packages/api/src/queries/places.ts`에 confirm/reject helper, (4) iOS UI — step indicator overlay + low_confidence bottom sheet variant + error toast retry + 링크 리스트 status + Marker 분기 + 안내 카드, (5) Web `public-board-map.tsx` Marker SVG 분기.

**Primary recommendation:** 마이그레이션 단일 파일 `0006_trust_ui_onboarding.sql`로 통합 (per-place confidence + RPC 재정의 + first_board 트리거 + backfill 한 트랜잭션). 별도 0006/0007 분리하면 RPC 갱신 누락 위험 — Phase 2 D-07 lesson(컬럼 rename → RPC 안 깜) 패턴 회피.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `places.confidence` 컬럼 추가 + CHECK | Database / Storage | — | 스키마 변경. append-only 마이그레이션 (CLAUDE.md §4.3). |
| Edge Function의 confidence wire | API / Backend (Deno Edge Function) | Database | Service role insert. Phase 2가 만든 admin client에 한 줄 추가. |
| `public_board_view` RPC 확장 | Database (SECURITY DEFINER RPC) | — | 0001_init.sql:487 jsonb 반환에 confidence 키 추가. |
| `listPlacesByBoard` 매핑 확장 | API / Backend (`packages/api/src/queries/places.ts`) | — | `select('*')`로 이미 confidence 자동 포함, Type 재생성만 필요. |
| `confirmAiPlace` / `rejectAiPlace` | API / Backend (`packages/api/src/queries/places.ts`) | Database (RLS — `places: update if can_edit_board`) | UPDATE RPC도 RLS-bound, 기존 정책 그대로. confirm = UPDATE 2 컬럼, reject = alias hidePlace. |
| Step indicator overlay UI | Browser / Client (iOS RN) | — | broadcast subscribe는 Phase 3가 만든 helper, UI 분기만 확장. |
| Marker 시각 분기 (iOS) | Browser / Client (iOS RN) | — | react-native-maps `<Marker>` props. |
| Marker 시각 분기 (Web) | Browser / Client (Next.js client component) | — | Google Maps JS API `Marker` icon prop. |
| Error toast retry button | Browser / Client (iOS RN) | — | `showToast` API 확장 (action slot). |
| 링크 리스트 failed retry | Browser / Client (iOS RN) | — | FlatList renderItem Pressable 분기. |
| Low confidence bottom sheet variant | Browser / Client (iOS RN) | — | PinBottomSheet props 분기. confirm/reject helper만 API. |
| ONBOARD-01 첫 보드 생성 | Database (Postgres trigger SECURITY DEFINER) | — | RLS bypass for service-level insert. 0001 `handle_new_auth_user` 패턴 차용. |
| ONBOARD-01 backfill | Database (one-time SQL in migration) | — | 마이그레이션 끝에 `insert ... where not exists` 한 줄. |
| ONBOARD-02 안내 카드 | Browser / Client (iOS RN) | — | AsyncStorage wrapper + 보드 상세 inline banner. |

## Standard Stack

### Core (이미 설치됨 — 신규 0개)

| Library | Version (installed) | Latest | Purpose | Why Standard |
|---------|---------------------|--------|---------|--------------|
| `react-native-maps` | `1.20.1` | 1.27.2 [VERIFIED: npm view] | iOS Marker + opacity prop + children custom view | Expo SDK 54 표준 map 라이브러리. Apple Maps + Google Maps 양쪽 지원. |
| `@gorhom/bottom-sheet` | `^5.2.14` | 5.2.14 [VERIFIED: npm view] | Pin bottom sheet (Phase 3 도입) — low_confidence variant 확장에 props 추가만 | RN 표준 bottom sheet. Phase 3에서 이미 NativeWind 호환 패턴 검증 (RESEARCH Pitfall 3 inline backgroundStyle). |
| `@react-native-async-storage/async-storage` | `2.2.0` | 3.1.0 [VERIFIED: npm view] | ONBOARD-02 dismiss persistence | Expo SDK 54 호환 표준 storage. 모노레포에 이미 설치됨 ([VERIFIED: `apps/ios/package.json`]) — pnpm hoist 작업 불필요. |
| Google Maps JS API | (browser CDN) | — | Web Marker SVG icon (Phase 4 도입) | Phase 4 D-14가 Marker 인터랙션 lock — Phase 5는 icon prop만 추가. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react-native` | not installed | 안내 카드 좌측 `<Sparkles />` 아이콘 (optional) | researcher 재량 D-21. **권장: 미채택** (라이브러리 의존성 추가 회피, emoji `💡` 충분 + 한국어 OS 모두 지원). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<Marker pinColor opacity>` (iOS) | `react-native-svg`로 custom SVG marker | SVG marker가 시각 자유도는 ↑이지만 라이브러리 추가 + 성능 부담. **`pinColor + opacity + children View` lock** — Apple Maps 호환 시 단순. |
| Postgres trigger (ONBOARD-01) | Edge Function 또는 클라이언트 첫 로그인 후 INSERT | (1) 트리거 = 동일 트랜잭션 안전성 (auth.users 생성과 atomic). (2) Edge Function = 별도 호출 — 실패 시 첫 보드 없음. (3) 클라이언트 = RLS 통과만 가능하지만 사용자가 "내 첫 여행"을 만지면 dirty. **트리거 lock (D-16).** |
| `font-bold` (700) for 안내 카드 헤더 | font-semibold (600) | Phase 4 OG로 hold-out. 본 phase 안 씀 — 600으로 충분. |
| 별도 `confirmed_at` 컬럼 | confidence = null + source_kind = 'manual' 전환 | confirmed_at은 v2 협업 투표 도입 시점 재설계. v1 스키마 단순화 lock (D-04). |
| 마이그레이션 0006 + 0007 분리 | 단일 0006 | 분리 시 RPC 재정의 누락 위험 (Phase 2 D-07 lesson). **단일 파일 권장.** |

**Installation:** None — 모든 dep 이미 설치됨. AsyncStorage 2.2.0 hoist 확인은 첫 plan에서 (이미 apps/ios/package.json에 있음).

**Version verification:**
```bash
npm view react-native-maps version       # 1.27.2 (latest) — project 1.20.1 (SDK 54 호환 stable)
npm view @react-native-async-storage/async-storage version  # 3.1.0 — project 2.2.0 (SDK 54 호환)
npm view @gorhom/bottom-sheet version    # 5.2.14 (latest) — project ^5.2.14 (정확 일치)
```
[VERIFIED: npm registry 2026-05-26]. **버전 업그레이드 불필요** — project 버전이 모두 Expo SDK 54와 호환되며 dogfooding 단계에서 안정성 우선.

## Architecture Patterns

### System Architecture Diagram

```
신규 가입 흐름 (ONBOARD-01)
─────────────────────────
auth.users INSERT
  ↓ trigger: on_auth_user_created
profiles INSERT (handle_new_auth_user — 0001)
  ↓ trigger: profiles_first_board_trigger (D-16/D-17 — NEW Phase 5)
boards INSERT ("내 첫 여행", private)
  ↓
iOS app: 보드 목록 진입 → "내 첫 여행" 1개 노출 (empty state 안 보임)
  ↓ 사용자가 "내 첫 여행" 탭
보드 상세 진입 → ONBOARD-02 안내 카드 자동 노출 (places=0, links=0, AsyncStorage falsy)


추출 흐름 + Trust UI (TRUST-02/03/04/TRUST-01)
─────────────────────────
사용자가 URL TextInput에 YouTube URL 붙여넣기
  ↓ onAddLink()
links INSERT → triggerExtraction(supabase, link_id)
  ↓ Edge Function extract-youtube
broadcast: metadata → step indicator "영상 정보 가져오는 중" (D-08)
broadcast: transcript → step indicator "자막 읽는 중"
broadcast: llm → step indicator "장소 찾는 중"
broadcast: places → step indicator "지도에 표시하는 중"
  ↓ places INSERT (with NEW confidence wire D-02)
broadcast: done → overlay dismiss + "X개 핀 추가됨" toast
  OR broadcast: error → overlay dismiss + error toast (D-10: [재시도] 버튼)
  ↓ load() 호출 → places reload
  ↓ Marker 시각 분기 (D-05):
    - source_kind='ai' && confidence < 0.7 → opacity 0.5 + ? 배지
    - source_kind='ai' && confidence >= 0.7 → brand-500 opacity 1.0
    - source_kind='manual' → neutral-900 opacity 1.0
  ↓ 사용자가 low_confidence marker 탭 → bottom sheet
PinBottomSheet (D-13/D-14 low_confidence variant):
  - "신뢰도 낮음" 배지 + 안내 한 줄
  - [확인] → confirmAiPlace → source_kind='manual', confidence=null → marker 재렌더 (manual 색)
  - [잘못됨] → rejectAiPlace (= hidePlace) → marker 사라짐


Public Board Web (TRUST-01 only — D-06/D-24)
─────────────────────────
/b/[slug] SSR
  ↓ public_board_view(slug) RPC (D-03 redefine: confidence 컬럼 추가)
PublicBoardMap (client component)
  ↓ Marker SVG icon 분기 (source_kind + confidence)
사용자 marker 클릭 → window.open YouTube (Phase 4 D-14 그대로)
```

### Recommended Project Structure

```
supabase/migrations/
└── 0006_trust_ui_onboarding.sql          # NEW: places.confidence + RPC redef + first_board trigger + backfill

supabase/functions/extract-youtube/
└── index.ts                              # MODIFY: places upsert에 confidence: r.cand.confidence 한 줄

packages/core/src/
└── constants.ts                          # MODIFY: EXTRACT_STEP_KO, LOW_CONFIDENCE_THRESHOLD, OnboardKeys export

packages/core/src/schemas/
└── place.ts                              # MODIFY: PlaceSchema에 confidence: z.number().nullable() 추가

packages/api/src/
├── types/database.ts                     # REGEN: pnpm supabase:types 후
└── queries/places.ts                     # MODIFY: confirmAiPlace, rejectAiPlace (= deletePlace alias) 추가

apps/ios/lib/
├── toast.tsx                             # MODIFY: ToastState에 action?: { label, onPress } 추가
├── onboarding.ts                         # NEW: AsyncStorage wrapper for OnboardKeys
└── realtime.ts                           # NO CHANGE — Phase 3 helper 그대로 사용

apps/ios/app/boards/
├── [id].tsx                              # MODIFY: step indicator overlay 확장 + 안내 카드 + 링크 리스트 status + Marker 분기
└── _pin-sheet.tsx                        # MODIFY: confidence props + low_confidence variant + 확인/잘못됨 액션

apps/web/app/b/[slug]/
├── page.tsx                              # MODIFY: confidence pass-through to client component (props 1개 추가)
└── _components/public-board-map.tsx      # MODIFY: Marker SVG icon 분기 (~10 lines)
```

### Pattern 1: react-native-maps Marker with opacity + children custom view (iOS)

**What:** AI low-confidence 핀을 opacity로 흐리게 + `?` 배지로 의문 시그널.
**When to use:** `source_kind === 'ai' && confidence !== null && confidence < 0.7`.

```tsx
// Source: react-native-maps docs - https://github.com/react-native-maps/react-native-maps/blob/master/docs/marker.md
// [CITED: marker.md] opacity prop documented (0.0-1.0, default 1.0). No platform caveat noted.
<Marker
  coordinate={{ latitude: place.lat, longitude: place.lng }}
  pinColor={place.source_kind === 'ai' ? '#F97316' : '#0F172A'}
  opacity={
    place.source_kind === 'ai' &&
    place.confidence !== null &&
    place.confidence < 0.7
      ? 0.5
      : 1.0
  }
  onPress={() => setSelectedPlace(place)}
>
  {/* children View를 두면 default pin 대신 custom marker가 렌더됨.
      Apple Maps에서 opacity prop이 무시될 가능성에 대한 fallback도 겸함. */}
  {place.source_kind === 'ai' &&
   place.confidence !== null &&
   place.confidence < 0.7 ? (
    <View className="w-7 h-7 items-center justify-center rounded-full bg-brand-500/50 border border-white">
      <Text className="text-xs font-medium text-white">?</Text>
    </View>
  ) : null}
</Marker>
```

> **iOS Apple Maps 호환 — verified [CITED: marker.md]:** docs는 opacity prop에 platform-specific caveat을 명시하지 않음 (다른 props는 "Note: iOS Apple Maps only" 등 명시됨). MEDIUM confidence — 첫 plan task에서 실기기 smoke test로 확정. 비호환 시 default pin 자리에 children View만 사용 (자동 fallback). 시각 의도(low conf = 옅음)는 양쪽 모두 유지.

### Pattern 2: Web Marker SVG icon 분기 (Google Maps JS API)

**What:** Web public board에서 같은 시각 contract.
**When to use:** `apps/web/app/b/[slug]/_components/public-board-map.tsx`의 Marker 생성 시.

```ts
// Source: Phase 4 public-board-map.tsx 기존 패턴 확장
// Google Maps JS Marker icon prop은 URL string 또는 Icon object 둘 다 허용 [CITED: Google Maps JS API docs]
for (const p of places) {
  const isAi = p.source_kind === 'ai';
  const isLowConf = isAi && p.confidence !== null && p.confidence < 0.7;
  const fill = isAi ? '#F97316' : '#0F172A';
  const opacity = isLowConf ? 0.45 : 1.0;
  const qBadge = isLowConf
    ? `<text x="16" y="22" text-anchor="middle" font-size="14" font-family="sans-serif" fill="white">?</text>`
    : '';

  const svgIcon = {
    url:
      `data:image/svg+xml;utf-8,` +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">` +
          `<path d="M16 0C7.16 0 0 7.16 0 16c0 9.6 16 24 16 24s16-14.4 16-24C32 7.16 24.84 0 16 0z" ` +
            `fill="${fill}" fill-opacity="${opacity}"/>` +
          qBadge +
        `</svg>`,
      ),
    scaledSize: new (g as typeof google.maps).Size(32, 40),
  };

  const marker = new g.Marker({
    map,
    position: { lat: p.lat, lng: p.lng },
    title: p.name_local,
    icon: svgIcon,
  });

  // Phase 4 D-14 click 동작 그대로 (변경 없음)
  if (p.link_id) { /* ... */ }
}
```

### Pattern 3: Step indicator (React Native Text-only)

**What:** broadcast step → 한국어 라벨 stack with 3-tier hierarchy.
**When to use:** Phase 3 spinner overlay 내부 column.

```tsx
// Source: CONTEXT D-08/D-09 + 05-UI-SPEC §1
const STEPS: { key: string; ko: string }[] = [
  { key: 'metadata', ko: EXTRACT_STEP_KO.metadata },
  { key: 'transcript', ko: EXTRACT_STEP_KO.transcript },
  { key: 'llm', ko: EXTRACT_STEP_KO.llm },
  { key: 'places', ko: EXTRACT_STEP_KO.places },
];

function StepIndicator({ currentStep }: { currentStep: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <View className="items-start gap-2 mt-3">
      {STEPS.map((s, idx) => {
        const status =
          idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'future';
        const dot = status === 'future' ? '○' : '●';
        const dotColor =
          status === 'done' ? 'text-neutral-500'
          : status === 'current' ? 'text-brand-500'
          : 'text-neutral-300';
        const labelClass =
          status === 'done' ? 'text-sm text-neutral-500'
          : status === 'current' ? 'text-base font-semibold text-brand-500'
          : 'text-xs font-medium text-neutral-300';
        return (
          <View key={s.key} className="flex-row items-center gap-2">
            <Text className={`text-base ${dotColor}`}>{dot}</Text>
            <Text className={labelClass}>{s.ko}</Text>
          </View>
        );
      })}
    </View>
  );
}
```

### Pattern 4: Postgres trigger for first board (SECURITY DEFINER)

**What:** profiles INSERT → boards INSERT with idempotency guard.
**When to use:** ONBOARD-01.

```sql
-- Source: 0001_init.sql:62-88 (handle_new_auth_user) pattern + CLAUDE.md §4.4 RLS rules
-- [CITED: supabase.com/docs/guides/database/postgres/triggers]
create or replace function profiles_create_first_board()
returns trigger
language plpgsql
security definer
set search_path = public, auth   -- 0001 pattern: explicit search_path for SECURITY DEFINER
as $$
begin
  -- Idempotency: skip if user already has any board
  if not exists (select 1 from boards where owner_id = NEW.id) then
    insert into boards (owner_id, title, visibility)
    values (NEW.id, '내 첫 여행', 'private');
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_first_board_trigger on profiles;
create trigger profiles_first_board_trigger
  after insert on profiles
  for each row execute function profiles_create_first_board();

-- D-18: Backfill existing users (idempotent)
insert into boards (owner_id, title, visibility)
select p.id, '내 첫 여행', 'private'
from profiles p
where not exists (select 1 from boards where owner_id = p.id);
```

> **순서 안전성 [CITED: supabase.com/docs/guides/database/postgres/triggers]:** 트리거는 동일 트랜잭션 안에서 실행 — auth.users INSERT → `on_auth_user_created` (0001) → profiles INSERT → `profiles_first_board_trigger` (NEW) → boards INSERT. 모두 atomic. 어느 단계라도 실패하면 전체 rollback. **별도 race condition 없음.**

### Pattern 5: AsyncStorage wrapper (lib/onboarding.ts)

**What:** Type-safe key 사용 (SharedDefaults 패턴 차용).
**When to use:** ONBOARD-02 dismiss persistence + 향후 onboarding flag 확장 시.

```ts
// Source: apps/ios/lib/shared-defaults.ts 패턴 차용
// [CITED: @react-native-async-storage/async-storage README]
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardKeys } from '@moajoa/core';

export const Onboarding = {
  async isLinkCardDismissed(): Promise<boolean> {
    try {
      const v = await AsyncStorage.getItem(OnboardKeys.LinkCardDismissed);
      return v === 'true';
    } catch {
      return false; // 실패 시 안내 카드 표시 (사용자에 무해)
    }
  },
  async dismissLinkCard(): Promise<void> {
    try {
      await AsyncStorage.setItem(OnboardKeys.LinkCardDismissed, 'true');
    } catch (e) {
      console.warn('[Onboarding.dismissLinkCard]', e);
    }
  },
};
```

### Pattern 6: Toast action button slot (toast.tsx 확장)

**What:** error toast에 inline `[재시도]` 버튼.

```ts
// Source: apps/ios/lib/toast.tsx 확장
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
  durationMs: number;
  action?: { label: string; onPress: () => void };  // NEW
}

export function showToast(
  message: string,
  kind: ToastKind = 'info',
  options?: { durationMs?: number; action?: { label: string; onPress: () => void } },
): void { /* ... */ }

// 보드 상세 [id].tsx에서:
showToast(`분석 실패: ${mapErrorReason(p.error)}`, 'error', {
  durationMs: 8000,  // D-10: 5초 → 8초
  action: { label: '재시도', onPress: () => {
    setAnalyzing(linkId);
    triggerExtraction(supabase, linkId).catch(console.warn);
  }},
});
```

### Anti-Patterns to Avoid

- **클라이언트가 첫 보드 생성:** 신규 가입 후 첫 진입 시 클라이언트에서 INSERT — RLS 통과는 되지만 race ("내 첫 여행"이 만들어지기 전에 사용자가 다른 보드 만들기 가능). **트리거로 atomic 처리 (D-16 lock).**
- **점선 marker via Marker children:** custom view로 점선 border를 그릴 수 있지만 Apple Maps marker rendering 한계 (rotate/clip 불안정). **CONTEXT 시 채택 X — opacity + ? 배지로 충분.**
- **`confidence` 컬럼 추가 후 RPC 재정의 누락:** Phase 2 D-07 lesson. 마이그레이션 한 파일에 묶음 처리.
- **`pnpm supabase:types` 누락:** confidence 컬럼이 TypeScript에 안 잡혀 undefined 떨어짐 (CLAUDE.md §4.3).
- **TextInput 위 안내 카드를 places.length 체크 없이 노출:** 핀이 추가된 빈 보드(예: 외부에서 받은 보드)에서 의미 없음. **D-20 가시성 조건 (places=0 AND links=0) 필수.**
- **자동 재시도 도입:** D-12 lock — 자동 retry는 LLM quota burst 악화 + 사용자 의도 분실. 사용자 명시 행동만.
- **`?` 배지에 brand-500 진한 색:** brand-500 자체가 의문이 아닌 신뢰 색. `bg-brand-500/50` (50% opacity)로 의문성 강조.
- **Toast queue 도입:** Phase 3 lock — 단일 인스턴스. 새 toast가 기존 replace. queue는 v2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AsyncStorage type-safe key 관리 | 매번 string literal 직접 사용 | `OnboardKeys` 상수 객체 + `Onboarding` wrapper (lib/onboarding.ts) | SharedDefaults 패턴 — 키 typo가 silent data loss (Phase 3 Pitfall 2 유사). |
| Postgres trigger 안 쓰고 클라이언트 첫 보드 생성 | 보드 목록 마운트 시 `count === 0`이면 INSERT | `profiles_create_first_board` 트리거 (D-16) | atomic transaction + 클라이언트 코드 0줄 + race 없음. |
| 별도 `confirmed_at` 컬럼 도입 | 새 timestamptz 컬럼 + UPDATE 시 set | D-04 lock — `source_kind: 'ai' → 'manual'` 전환 + `confidence: null` | v1 스키마 단순. v2 협업 투표 도입 시 재설계. |
| 자동 재시도 client-side | `retryCount < 3`이면 setTimeout retry | D-12 lock — 사용자 명시 행동만 | LLM/Places quota 보호 + 사용자 의도 보존. |
| Step indicator dot에 SVG circle 도입 | react-native-svg `<Circle>` | Text `●` / `○` (D-22) | 단순성. animation은 v2. |
| 안내 카드 lucide icon 도입 | `lucide-react-native` 추가 | emoji `💡` (D-21 default) | 라이브러리 의존성 0개 + 모든 한국어 OS에서 렌더링됨. |
| Marker children에서 점선 border 직접 그리기 | custom View + Tailwind border-dashed | opacity + ? 배지 (D-05) | Apple Maps marker rendering은 children View의 transform/clip 불안정. CONTEXT 시 채택 X. |
| confidence threshold UI 양쪽에 hardcode | iOS와 Web 각자 `0.7` literal | `LOW_CONFIDENCE_THRESHOLD` from `@moajoa/core` (D-15) | Phase 6에서 threshold 조정 시 단일 출처. |
| Edge Function에서 confidence 산식 직접 작성 | `place.confidence = some_calc()` | LLM이 이미 반환 — `r.cand.confidence` wire만 (D-02) | Phase 2 D-04가 이미 Zod 스키마에 default(0.5)로 처리. |

**Key insight:** Phase 5 작업의 90%는 **wiring**이다. 새 로직은 confirm/reject helper 2개 + 안내 카드 가시성 조건 1개뿐. 나머지는 Phase 2 broadcast + Phase 3 spinner/toast/sheet + Phase 4 web marker를 확장만.

## Runtime State Inventory

> 본 phase는 신규 컬럼·트리거 추가 + 코드 변경이 주이지만, 일부 데이터 마이그레이션이 있어 explicit 체크.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (1) `places.confidence` — 기존 row는 NULL (D-01 nullable). 기존 데이터는 "confidence 정보 없음" = low_confidence X (D-15 lock — null != low). (2) Phase 4 OG image 캐시는 confidence 안 쓰므로 invalidation 불필요. | **Data migration:** None (NULL 채택, 기존 row 그대로). **Code edit:** 신규 Edge Function 호출 시점부터 confidence 기록. **Backfill 옵션:** Phase 2 데이터를 다시 추출해서 confidence 채울지는 v2 (EXTRACT-08 evaluation dataset와 연결). |
| **Live service config** | None. Supabase Realtime broadcast 채널명·payload schema 변경 없음 (`extract:{link_id}` 그대로, `{step, progress_pct, places_extracted?, error?}` 그대로). Edge Function env vars 변경 없음. | None. |
| **OS-registered state** | None. iOS Share Extension entitlements / App Group ID 변경 없음. AsyncStorage 키 추가는 OS-level 등록 없음 (앱 내부 sandbox). | None. |
| **Secrets / env vars** | None. 신규 API key / secret 도입 없음. | None. |
| **Build artifacts / installed packages** | (1) `packages/api/src/types/database.ts` — `pnpm supabase:types`로 재생성 필요 (places.confidence 컬럼 반영). (2) iOS prebuild — native dep 추가 없으므로 prebuild 재실행 불필요. (3) Edge Function deploy — `extract-youtube` 변경 시 `supabase functions deploy extract-youtube` 필요. | **Required actions:** (1) `pnpm supabase:types` after migration applied. (2) `supabase functions deploy extract-youtube` after index.ts wire 추가. (3) `supabase db push` for migration. |

**The canonical question:** 모든 파일이 업데이트된 후 confidence 데이터가 어떻게 흘러가나? — 답: 새 추출만 confidence 값을 가짐. 기존 핀은 confidence=null로 정상 marker(low conf X) 표시. 사용자가 confirm/reject한 핀은 source_kind='manual' + confidence=null (D-04). 일관성 OK.

## Common Pitfalls

### Pitfall 1: `places.confidence` 추가 후 `public_board_view` RPC 재정의 누락 (HIGH risk)

**What goes wrong:** 0006 마이그레이션이 컬럼만 추가하고 RPC SELECT 절에 컬럼 안 넣으면 web SSR이 confidence를 못 받아 TRUST-01 web parity 깨짐.
**Why it happens:** Phase 2 D-07 lesson과 동일 패턴. RPC는 jsonb_build_object 안의 SELECT 절을 명시적으로 갱신해야 함.
**How to avoid:** 0006_trust_ui_onboarding.sql 단일 파일에서 (1) ALTER TABLE + (2) `create or replace function public_board_view(...)` 묶음 처리. 별도 마이그레이션 분리 X.
**Warning signs:** Web에서 모든 핀이 high confidence처럼 보임 (confidence undefined로 false 분기).

### Pitfall 2: `pnpm supabase:types` 누락 (HIGH risk)

**What goes wrong:** TypeScript 타입에 confidence 없으면 `place.confidence`가 컴파일 에러 또는 `as any` 우회 → 런타임에 undefined 떨어져 분기 잘못됨.
**Why it happens:** CLAUDE.md §4.3 명시. 마이그레이션 후 자동 안 됨.
**How to avoid:** 마이그레이션 task 직후 다음 task에 `pnpm supabase:types` 명시 + `git diff packages/api/src/types/database.ts` 검증.
**Warning signs:** `Property 'confidence' does not exist on type 'Place'`.

### Pitfall 3: react-native-maps Marker opacity Apple Maps 비호환 (MEDIUM risk)

**What goes wrong:** D-05 lock한 opacity 0.5 시각이 iOS Apple Maps provider에서 무시됨 — low conf 핀이 high conf와 똑같이 보임.
**Why it happens:** [CITED: marker.md] docs는 platform caveat을 명시 안 하지만, Apple MapKit의 MKPinAnnotationView는 opacity prop을 native 차원에서 지원 않을 수 있음. react-native-maps는 wrapper.
**How to avoid:** **첫 plan task로 실기기 smoke test.** 비호환 시 자동 fallback: children View를 렌더 (Marker default pin 사라지고 custom view가 marker) — children에 `<View className="opacity-50">` + 핀 모양 SVG (또는 Image) + `?` 배지. **시각 의도(옅음)는 양쪽 모두 유지.**
**Warning signs:** 실기기 시뮬레이터에서 opacity 차이 0 — 그러나 simulator는 신뢰 X, 실기기로 확인.

### Pitfall 4: profiles 트리거가 handle_new_auth_user보다 먼저 실행 (LOW risk — 잘못된 가정)

**What goes wrong:** 0001 `on_auth_user_created` trigger는 `auth.users` AFTER INSERT — 그게 profiles INSERT를 트리거. 새 trigger는 `profiles` AFTER INSERT. **순서: auth.users INSERT → handle_new_auth_user → profiles INSERT → profiles_first_board_trigger → boards INSERT.** 한 트랜잭션 내 순차.
**Why it happens:** 두 trigger가 서로 다른 테이블이라 race condition은 발생 안 함. CONTEXT open question은 안전 사이드 확인일 뿐.
**How to avoid:** profiles 트리거를 AFTER INSERT (BEFORE INSERT X)로 명시. SECURITY DEFINER로 RLS 우회. [VERIFIED: 0001_init.sql:85-88 + supabase.com/docs/guides/database/postgres/triggers]
**Warning signs:** 신규 가입 후 "내 첫 여행" 보드가 안 보이면 trigger 실행 안 됨 → `select * from boards where owner_id = '<new_user_id>'`로 직접 확인.

### Pitfall 5: 안내 카드를 첫 보드 한정으로 처리 (D-21과 충돌)

**What goes wrong:** 안내 카드를 "내 첫 여행" 보드 한정으로 노출하면 사용자가 새 보드 만들 때 학습 가치 사라짐.
**Why it happens:** D-19에서 wireframe이 "내 첫 여행" 보드 위에 그려져서 오해 가능.
**How to avoid:** D-21 lock — **모든 빈 보드에서 표시.** 가시성 조건은 보드 ID와 무관 (places=0 AND links=0 AND AsyncStorage falsy). 첫 보드는 가장 첫 노출 케이스일 뿐.
**Warning signs:** 새 보드 만들고 들어가도 카드 안 보임 → 가시성 조건에 보드 ID 비교 코드가 들어갔는지 확인.

### Pitfall 6: AsyncStorage dismiss 후 dev 환경에서 안 사라지는 카드 (LOW risk)

**What goes wrong:** AsyncStorage 값이 영구이므로 dev에서 카드 다시 보고 싶을 때 dismiss 풀 방법 없음.
**Why it happens:** D-20 글로벌 1회 lock.
**How to avoid:** dev에서는 React Native Debugger에서 AsyncStorage clear. 또는 `apps/ios/lib/onboarding.ts`에 `__resetForDev()` 추가 (`__DEV__` 가드).
**Warning signs:** "왜 카드 안 보이지?" → AsyncStorage.getItem 직접 확인.

### Pitfall 7: confirm 액션 후 marker가 즉시 안 바뀜

**What goes wrong:** 사용자가 `[확인]` 탭 → `confirmAiPlace` 호출 성공 → sheet dismiss했지만 marker는 여전히 low conf 시각 (opacity 0.5 + ?). `load()` 누락 시 발생.
**Why it happens:** confirm 액션 후 places state reload 필요.
**How to avoid:** `confirmAiPlace` 호출 → `onChanged()` 콜백 (= `load()`) → places state 갱신 → marker 재렌더. Phase 3 패턴 그대로.
**Warning signs:** 핀 marker 색·opacity가 변하지 않음.

### Pitfall 8: bottom sheet 액션 stack 순서 잘못 (D-14)

**What goes wrong:** `[확인]`/`[잘못됨]`을 아래로 인서트하면 사용자가 destructive `[삭제]`와 혼동.
**Why it happens:** Phase 3 sheet에서 `[삭제]`가 가장 아래 — 본능적으로 confirm/reject를 같은 위치에 둠.
**How to avoid:** **위쪽 인서트 lock (D-14):** `[확인]` → `[잘못됨]` → `[이름 수정]` → `[영상에서 위치]` → `[삭제]`. UI-SPEC §5 wireframe 그대로.
**Warning signs:** UAT에서 사용자가 reject 누르려다 delete 누름.

## Code Examples

### Migration 0006 — places.confidence + RPC redef + first_board trigger + backfill

```sql
-- supabase/migrations/0006_trust_ui_onboarding.sql
-- Source: Phase 5 CONTEXT D-01/D-03/D-16/D-17/D-18 + 0001_init.sql RPC pattern + 0004 ALTER pattern
-- [CITED: CLAUDE.md §4.3 append-only, §4.4 SECURITY DEFINER]

-- ============================================================================
-- Part 1: per-place confidence column (D-01)
-- ============================================================================
alter table places
  add column if not exists confidence numeric(3,2)
    check (confidence is null or confidence between 0 and 1);

-- ============================================================================
-- Part 2: public_board_view RPC redef (D-03) — add confidence to SELECT list
-- ============================================================================
create or replace function public_board_view(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_board boards%rowtype;
  v_owner profiles%rowtype;
  v_result jsonb;
begin
  select * into v_board from boards
  where share_slug = p_slug and visibility = 'public'
  limit 1;

  if not found then return null; end if;

  select * into v_owner from profiles where id = v_board.owner_id;

  v_result := jsonb_build_object(
    'board', jsonb_build_object(
      'id', v_board.id,
      'title', v_board.title,
      'description', v_board.description,
      'city_code', v_board.city_code,
      'cover_image_url', v_board.cover_image_url,
      'updated_at', v_board.updated_at
    ),
    'owner_display_name', coalesce(v_owner.display_name, 'MOAJOA user'),
    'links', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'source_kind', l.source_kind,
        'url', l.url,
        'title', l.title,
        'thumbnail_url', l.thumbnail_url,
        'author_name', l.author_name
      ) order by l.created_at desc)
      from links l where l.board_id = v_board.id and l.extraction_status = 'ready'),
      '[]'::jsonb
    ),
    'places', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'link_id', p.link_id,
        'name_local', p.name_local,
        'name_ko', p.name_ko,
        'name_en', p.name_en,
        'lat', p.lat,
        'lng', p.lng,
        'category', p.category,
        'source_timestamp_sec', p.source_timestamp_sec,
        'source_kind', p.source_kind,          -- already exists from 0004
        'confidence', p.confidence              -- NEW Phase 5
      ) order by p.created_at)
      from places p where p.board_id = v_board.id and p.hidden_at is null),
      '[]'::jsonb
    )
  );

  return v_result;
end;
$$;

-- grant unchanged (already to authenticated, anon)

-- ============================================================================
-- Part 3: first board auto-create trigger (D-16/D-17)
-- ============================================================================
create or replace function profiles_create_first_board()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from boards where owner_id = NEW.id) then
    insert into boards (owner_id, title, visibility)
    values (NEW.id, '내 첫 여행', 'private');
  end if;
  return NEW;
end;
$$;

drop trigger if exists profiles_first_board_trigger on profiles;
create trigger profiles_first_board_trigger
  after insert on profiles
  for each row execute function profiles_create_first_board();

-- ============================================================================
-- Part 4: backfill existing users (D-18) — idempotent
-- ============================================================================
insert into boards (owner_id, title, visibility)
select p.id, '내 첫 여행', 'private'
from profiles p
where not exists (select 1 from boards where owner_id = p.id);
```

### Edge Function wire (extract-youtube/index.ts ~line 207)

```ts
// Source: supabase/functions/extract-youtube/index.ts existing places upsert
// D-02: one-line wire of per-candidate confidence
const rows = resolved.map((r) => ({
  board_id: link.board_id,
  link_id: link.id,
  added_by: link.added_by,
  google_place_id: r.place.placeId,
  name_local: r.place.displayName,
  name_ko: r.cand.name_ko ?? null,
  name_en: r.place.displayNameEn ?? null,
  lat: r.place.lat,
  lng: r.place.lng,
  category: r.place.primaryType ?? null,
  address: r.place.formattedAddress ?? null,
  source_timestamp_sec: r.cand.source_timestamp_sec ?? null,
  source_quote: r.cand.source_quote ?? null,
  source_kind: 'ai',
  inferred_city: r.cand.inferred_city ?? null,
  confidence: r.cand.confidence,        // NEW Phase 5 D-02
}));
```

### packages/core/src/constants.ts additions

```ts
// Append to existing constants.ts
// Source: Phase 5 CONTEXT D-09/D-15/D-20 + SharedDefaultsKeys pattern

/**
 * Step name → 한국어 카피 fixture (D-09).
 * UI에서 broadcast.step → EXTRACT_STEP_KO[step]으로 노출.
 * Note: 'done' 'error'는 overlay dismiss + toast 처리이므로 fixture 외 처리.
 */
export const EXTRACT_STEP_KO: Readonly<Record<'metadata' | 'transcript' | 'llm' | 'places', string>> = {
  metadata: '영상 정보 가져오는 중',
  transcript: '자막 읽는 중',
  llm: '장소 찾는 중',
  places: '지도에 표시하는 중',
} as const;

/**
 * confidence < 이 값이면 low_confidence로 시각 약화 + bottom sheet에 확인/잘못됨 액션 노출.
 * source_kind='ai' AND confidence is not null AND confidence < threshold (D-15).
 * confidence is null (manual or legacy)은 low_confidence X.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * AsyncStorage 키 single source. iOS와 (향후 web onboarding 도입 시) 같은 키 사용 보장.
 * SharedDefaultsKeys 패턴 차용.
 */
export const OnboardKeys = {
  /** 보드 상세 "유튜브 링크 붙여넣기" 안내 카드 영구 dismiss. */
  LinkCardDismissed: '@moajoa/onboard:link_card_dismissed',
} as const;
```

### confirmAiPlace / rejectAiPlace helpers (packages/api/src/queries/places.ts)

```ts
// Append to existing places.ts
// Source: Phase 5 CONTEXT D-04 + existing renamePlace/hidePlace patterns

/**
 * Confirm an AI-extracted pin as correct. Transitions source_kind to 'manual'
 * (the pin is now user-confirmed = full ownership) and clears confidence
 * (no longer relevant — user vouches for it).
 *
 * RLS: `places: update if can_edit_board` (0001) gates this UPDATE.
 *
 * Per Phase 5 D-04/D-14: bottom sheet low_confidence variant "확인" action.
 */
export async function confirmAiPlace(
  client: MoajoaSupabaseClient,
  id: string,
): Promise<Place> {
  const { data, error } = await client
    .from('places')
    .update({ source_kind: 'manual', confidence: null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Place;
}

/**
 * Reject an AI-extracted pin as wrong. Soft delete via hidden_at.
 *
 * Aliased to deletePlace (= hidePlace) — same soft-delete semantics. UI uses
 * distinct names because the user intent is different (reject AI suggestion
 * vs delete a confirmed pin), but the data operation is identical.
 *
 * Per Phase 5 D-04/D-14: bottom sheet low_confidence variant "잘못됨" action.
 */
export const rejectAiPlace = hidePlace;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 3 단순 spinner "분석 중..." | Phase 5 5단계 step indicator with 한국어 fixture | Phase 5 (D-07/D-08) | broadcast 5단계 신호가 사용자에 가시화 — 신뢰감 ↑ |
| Phase 3 error toast 자동 dismiss only | Phase 5 toast `[재시도]` inline action | Phase 5 (D-10) | 1탭 retry — 사용자가 toast 사라지기 전 행동 가능 |
| Phase 3 bottom sheet 단일 variant | Phase 5 low_confidence variant + 확인/잘못됨 액션 | Phase 5 (D-13/D-14) | confident-wrong AI 차단 |
| 평균 confidence만 links.extraction_confidence에 저장 | per-place confidence도 places.confidence에 저장 | Phase 5 (D-01) | 핀 단위 시각 분기 가능 |
| 신규 가입자 빈 보드 목록 + empty state | 신규 가입자 = "내 첫 여행" 1개 자동 보드 | Phase 5 (D-16) | 첫 인상 마찰 제거 |
| Web public board 모든 마커 동일 시각 | source_kind + confidence 분기 SVG icon | Phase 5 (D-06/D-24) | TRUST-01 cross-platform parity |
| Phase 3 4 sizes / 2 weights typography | Phase 5 5 sizes (+12) / 3 weights (+500) | Phase 5 (D-22/D-23) | low_confidence 배지 + step indicator 미래 단계 위계 |

**Deprecated/outdated:** None — Phase 5는 모두 확장 (deletion 없음).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | react-native-maps `<Marker opacity>` prop이 iOS Apple Maps에서 정상 작동 | Code Examples Pattern 1 + Pitfall 3 | TRUST-04 low conf 시각이 simulator에서 정상이어도 실기기에서 무시될 수 있음. **첫 plan task로 실기기 smoke test 명시.** 비호환 시 children View opacity fallback (시각 의도는 유지). |
| A2 | Marker `<Text>` 안의 emoji `💡`가 모든 iOS 버전에서 정상 렌더됨 | Pattern (안내 카드) | iOS 13+ emoji는 안정적. SDK 54 = iOS 13.4+ minimum이므로 안전. **위험 매우 낮음.** |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

→ A1만 first plan에서 verify 필요. A2는 SDK 54 minimum constraint로 자동 충족.

## Open Questions (RESOLVED)

모든 CONTEXT.md open question + 본 research에서 추가로 발생한 항목이 inline RESOLVED:

1. **마이그레이션 번호 0006 충돌 — RESOLVED**
   - What we know: `ls supabase/migrations/` = 0001~0005까지 (verified via Bash).
   - Resolution: `0006_trust_ui_onboarding.sql` 단일 파일 (per-place confidence + RPC redef + first_board trigger + backfill 통합). 0006/0007 분리 X — RPC 재정의 누락 위험 회피 (Phase 2 D-07 lesson).

2. **react-native-maps Marker opacity iOS Apple Maps 호환 — RESOLVED (with verification task)**
   - What we know: [CITED: marker.md] opacity prop documented (0.0-1.0). Platform caveat 명시 없음. 다른 props는 "iOS Apple Maps only" 등 명시 케이스가 있어 누락 = 양쪽 지원으로 해석 가능. 단 단정 위험.
   - Resolution: D-05 시각 contract는 lock. 첫 plan task에 **실기기 smoke test** 명시 — 비호환 시 children View `<View className="opacity-50">` 자동 fallback (시각 의도 유지). UI-SPEC §"Open Items Resolved"에 이미 명시됨.

3. **profiles 신규 가입 trigger 순서 — RESOLVED**
   - What we know: 0001_init.sql:85-88 `on_auth_user_created` AFTER INSERT on auth.users → 같은 트랜잭션 안에서 profiles INSERT. 새 `profiles_first_board_trigger` AFTER INSERT on profiles는 그 다음 fire. **모두 동일 트랜잭션 atomic.**
   - Resolution: 순서 race 없음. Pitfall 4 참조. SECURITY DEFINER + search_path 명시로 RLS·extension 안전.

4. **`@react-native-async-storage/async-storage` 모노레포 dep 존재 — RESOLVED**
   - What we know: `apps/ios/package.json`에 `"@react-native-async-storage/async-storage": "2.2.0"` 이미 존재 [VERIFIED: grep].
   - Resolution: 추가 작업 0개. SDK 54 호환 stable 버전. 업그레이드 불필요 (3.1.0 latest이지만 안정성 우선).

5. **`?` 배지 marker custom view 구현 방식 (Discretion) — RESOLVED**
   - What we know: react-native-maps `<Marker>` children는 default pin 대체. `image` prop은 static asset만.
   - Resolution: **children `<View>` 채택** (D-05 lock 보강). dynamic 분기 + Tailwind className 사용 가능. Pattern 1 code example 참조.

6. **안내 카드 좌측 아이콘 (Discretion) — RESOLVED**
   - What we know: emoji `💡` = 의존성 0개. lucide-react-native `<Sparkles />` = tree-shakable but 라이브러리 추가.
   - Resolution: **emoji `💡` 채택** (D-21 default lock). lucide 도입은 v2 design polish.

7. **step indicator dot 컴포넌트 (Discretion) — RESOLVED**
   - Resolution: **Text `●` / `○` 채택** (UI-SPEC §Open Items). SVG circle은 animation v2.

8. **low_confidence 배지 색 (Discretion) — RESOLVED**
   - Resolution: **`bg-amber-50 text-amber-700` 채택** (UI-SPEC §Open Items). neutral은 의미 전달 약함.

9. **confirmAiPlace / rejectAiPlace toast 노이즈 (Discretion) — RESOLVED**
   - Resolution: **toast 생략** (UI-SPEC §Open Items). marker 시각 변화 (low → high marker, 또는 사라짐)로 피드백 충분.

10. **ONBOARD-01 트리거 vs Edge Function (Discretion) — RESOLVED**
    - Resolution: **트리거 lock (D-16).** Don't Hand-Roll 표 참조. atomic + 클라이언트 코드 0줄 + race 없음.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | migration `db push`, `supabase:types` 재생성 | (assumed available — Phase 1~4에서 사용 중) | — | — |
| Postgres `pgcrypto` extension | 기존 사용 (gen_random_uuid) | ✓ | (0001_init.sql `create extension`) | — |
| Postgres `postgis` extension | 기존 사용 (places.geog) | ✓ | (0001_init.sql) | — |
| Anthropic Claude API | 추출 자체 (Phase 2 사용 중) | ✓ | (Phase 2 verified) | — |
| Google Places API | 핀 resolve (Phase 2 사용 중) | ✓ | (Phase 2 verified) | — |
| iOS 실기기 | Pitfall 3 검증 (Marker opacity Apple Maps smoke test) | (사용자 확보 필요) | — | simulator first, 실기기 확인은 phase 끝 UAT에 포함 |
| `@react-native-async-storage/async-storage` | ONBOARD-02 dismiss | ✓ | 2.2.0 (project) [VERIFIED: package.json] | — |
| `react-native-maps` | iOS Marker | ✓ | 1.20.1 (project) [VERIFIED: package.json] | — |
| `@gorhom/bottom-sheet` | PinBottomSheet | ✓ | ^5.2.14 [VERIFIED: package.json] | — |
| Google Maps JS API | Web Marker SVG icon | ✓ (Phase 4 도입) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 29.7 + jest-expo ~54.0 (`apps/ios/package.json`) [VERIFIED: package.json] |
| Config file | `apps/ios/package.json` `test` script: `jest --passWithNoTests` — no separate jest.config detected. Wave 0에서 `jest.config.js` 또는 package.json `jest` key 추가 필요. |
| Quick run command | `pnpm --filter @moajoa/ios test -- --findRelatedTests <files>` |
| Full suite command | `pnpm -r --parallel run test` (모노레포 root scripts.test) |

> **SQL trigger 테스트 인프라:** Supabase JS client + admin client로 통합 테스트 가능. `supabase/tests/` 디렉토리 미존재 — Wave 0에서 추가 또는 manual SQL UAT.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRUST-01 (iOS) | source_kind 분기 marker rendering | unit (RTL) | `pnpm --filter @moajoa/ios test -- boards/__tests__/marker-variant.test.tsx` | ❌ Wave 0 |
| TRUST-01 (Web) | source_kind 분기 SVG icon | unit (jsdom) | `pnpm --filter @moajoa/web test -- public-board-map.test.tsx` | ❌ Wave 0 (web test infra 별도 셋업) |
| TRUST-02 | step indicator 한국어 라벨 + 단계 분기 | unit (RTL) | `pnpm --filter @moajoa/ios test -- boards/__tests__/step-indicator.test.tsx` | ❌ Wave 0 |
| TRUST-02 | EXTRACT_STEP_KO fixture export | unit (core) | `pnpm --filter @moajoa/core test -- constants.test.ts` | ❌ Wave 0 |
| TRUST-03 | error toast retry action 호출 | unit (RTL) | `pnpm --filter @moajoa/ios test -- toast.test.tsx` | ❌ Wave 0 |
| TRUST-03 | 링크 리스트 failed row tap → triggerExtraction | unit (RTL) | `pnpm --filter @moajoa/ios test -- boards/__tests__/link-row-retry.test.tsx` | ❌ Wave 0 |
| TRUST-04 | low_confidence bottom sheet variant rendering | unit (RTL) | `pnpm --filter @moajoa/ios test -- boards/__tests__/pin-sheet-low-conf.test.tsx` | ❌ Wave 0 |
| TRUST-04 | confirmAiPlace UPDATE source_kind+confidence | integration (Supabase) | `pnpm --filter @moajoa/api test -- places.confirm.test.ts` | ❌ Wave 0 (Supabase test client 셋업) |
| TRUST-04 | rejectAiPlace = hidden_at set | integration | `pnpm --filter @moajoa/api test -- places.reject.test.ts` | ❌ Wave 0 |
| ONBOARD-01 | profiles INSERT trigger → boards row 생성 | manual SQL UAT (또는 supabase/tests) | `psql -f tests/onboard-01.sql` (or manual via Supabase SQL editor) | ❌ Wave 0 / manual |
| ONBOARD-01 | backfill 1회 실행 후 모든 기존 user에 board 1개 | manual SQL UAT | `select count(*) from boards b join profiles p on p.id = b.owner_id;` | manual |
| ONBOARD-02 | 안내 카드 가시성 조건 (places=0, links=0, dismissed=false) | unit (RTL) | `pnpm --filter @moajoa/ios test -- boards/__tests__/onboard-banner.test.tsx` | ❌ Wave 0 |
| ONBOARD-02 | AsyncStorage dismiss → 영구 숨김 | unit (RTL with mock) | `pnpm --filter @moajoa/ios test -- onboarding.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @moajoa/ios test -- --findRelatedTests <changed files>` (단일 component 단위)
- **Per wave merge:** `pnpm --filter @moajoa/ios test` + `pnpm --filter @moajoa/api test` + `pnpm --filter @moajoa/core test`
- **Phase gate:** `pnpm -r --parallel run test` 전체 green + iOS 실기기 UAT (Marker opacity 호환 + ONBOARD-01 신규 가입 흐름 + ONBOARD-02 안내 카드)

### Wave 0 Gaps

- [ ] `apps/ios/jest.config.js` 또는 `package.json` `jest` key — jest-expo preset 적용 + React Native module mock setup
- [ ] `apps/ios/jest.setup.ts` — `@react-native-async-storage/async-storage/jest/async-storage-mock` import
- [ ] `apps/ios/__mocks__/react-native-maps.ts` — Marker / MapView mock for RTL rendering
- [ ] `packages/core/__tests__/constants.test.ts` — EXTRACT_STEP_KO / LOW_CONFIDENCE_THRESHOLD / OnboardKeys export 검증
- [ ] `packages/api/__tests__/places.confirm.test.ts` + `places.reject.test.ts` — Supabase admin client integration (또는 local Supabase + service role)
- [ ] **Manual UAT script:** `docs/UAT-PHASE-5.md` — 신규 가입 가짜 계정 흐름 + 실기기 Marker opacity 시각 확인 + 안내 카드 dismiss + retry 동작 + 5단계 step indicator 가시화

*(Wave 0가 무겁다 — phase가 cross-platform이고 신규 ts 테스트 인프라 추가. **대안: Wave 0 최소화 — manual UAT 위주 + 핵심 helper(confirmAiPlace, EXTRACT_STEP_KO mapping)만 unit test.** planner가 결정.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 5 변경 없음 (Supabase Auth 기존 사용) |
| V3 Session Management | no | 기존 anon key / authenticated 분리 그대로 |
| V4 Access Control | yes | RLS — `places: update if can_edit_board` (0001) + 신규 트리거 SECURITY DEFINER + search_path 명시 (CLAUDE.md §4.4) |
| V5 Input Validation | yes | confidence 컬럼 CHECK `(0~1)` (D-01) + Zod PlaceSchema 확장 + ResolvePlaceRequestSchema 그대로 |
| V6 Cryptography | no | 신규 암호화 도입 없음 |
| V10 Malicious Code / API Abuse | yes | Edge Function rate limit (Phase 2 quota guard) — D-12 자동 재시도 X (사용자 명시 행동) |

### Known Threat Patterns for stack (TS + Supabase + RN)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 클라이언트가 confidence 변경 가능 (`places.confidence` 직접 UPDATE) | Tampering | RLS `places: update if can_edit_board` — 보드 멤버만 UPDATE 가능. **confirm은 의도된 UPDATE** (source_kind 전환). 악의 가능성: 멤버가 다른 사람의 핀의 confidence를 999로 변경? — CHECK constraint (0~1)로 차단. |
| confirm/reject 액션 RLS 우회 시도 | Elevation of Privilege | UPDATE는 RLS 통과 — `can_edit_board(NEW.board_id)` 검사. 비-멤버는 자동 차단. |
| profiles 트리거가 다른 user의 boards 생성 | Spoofing | trigger NEW.id = 본인. SECURITY DEFINER로 자동. |
| Postgres trigger SQL injection | Tampering | 트리거 함수에 user input 직접 삽입 없음 (`NEW.id` UUID only). 안전. |
| AsyncStorage 키 충돌 (다른 라이브러리가 같은 키 사용) | Tampering | 키 prefix `@moajoa/onboard:` — 충돌 없음. |
| Web client component가 confidence 잘못 표시 | Information Disclosure | confidence 자체는 공개 가능 정보 (low/high만 시각). 숫자 노출은 v2 deferred. |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/05-trust-ui-onboarding/05-CONTEXT.md` — D-01 ~ D-25 lock + canonical references
- `.planning/phases/05-trust-ui-onboarding/05-UI-SPEC.md` — 시각 contract + Open Items Resolved
- `.planning/REQUIREMENTS.md` — TRUST-01~04 + ONBOARD-01~02 falsifiable criteria
- `CLAUDE.md` — §4.3 마이그레이션 append-only, §4.4 RLS + SECURITY DEFINER + service role 분리, §4.5 NO `.js` extension
- `supabase/migrations/0001_init.sql` — places 테이블, public_board_view RPC, handle_new_auth_user trigger 패턴
- `supabase/migrations/0002_fix_rls_recursion.sql` — SECURITY DEFINER 헬퍼 패턴
- `supabase/migrations/0004_extraction_hardening.sql` — places.source_kind 추가 패턴
- `supabase/migrations/0005_extraction_costs_link_id_nullable.sql` — 마지막 마이그레이션 번호 verification
- `supabase/functions/extract-youtube/index.ts` — places upsert (~line 207)
- `supabase/functions/extract-youtube/pipeline/claude.ts` — PlaceCandidate Zod schema confidence 필드
- `packages/core/src/schemas/place.ts` — PlaceSchema 확장 위치 + ExtractedPlaceCandidate
- `packages/core/src/constants.ts` — EXTRACT_STEP_KO / LOW_CONFIDENCE_THRESHOLD / OnboardKeys 추가 위치 + SharedDefaultsKeys 패턴 차용
- `packages/api/src/queries/places.ts` — confirmAiPlace / rejectAiPlace 추가 위치 + renamePlace / hidePlace 패턴
- `apps/ios/app/boards/[id].tsx` — step indicator overlay 확장 위치 (line 202~220 기존 spinner overlay)
- `apps/ios/app/boards/_pin-sheet.tsx` — low_confidence variant 분기 위치 (line 24~45 props)
- `apps/ios/lib/realtime.ts` — subscribeExtractProgress (변경 없음, callback 분기만 확장)
- `apps/ios/lib/toast.tsx` — ToastState 시그니처 (line 4~12 + showToast line 21)
- `apps/web/app/b/[slug]/_components/public-board-map.tsx` — Marker icon 분기 위치 (line 49~68)
- `apps/ios/package.json` — react-native-maps 1.20.1, async-storage 2.2.0, @gorhom/bottom-sheet ^5.2.14 [VERIFIED: grep]

### Secondary (MEDIUM confidence)
- [react-native-maps marker docs (master branch)](https://github.com/react-native-maps/react-native-maps/blob/master/docs/marker.md) — opacity prop documented, platform caveat 없음
- [Supabase Postgres triggers docs](https://supabase.com/docs/guides/database/postgres/triggers) — atomic trigger transaction semantics
- [Supabase troubleshooting: errors on user creation](https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A) — handle_new_user trigger pattern
- npm registry [VERIFIED 2026-05-26]: react-native-maps 1.27.2 latest, async-storage 3.1.0 latest, @gorhom/bottom-sheet 5.2.14 latest

### Tertiary (LOW confidence)
- None — all critical claims verified via codebase grep or cited docs.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — 모든 dep 이미 설치 + npm registry verified
- Architecture: **HIGH** — Phase 2/3/4 패턴 그대로 확장 + 신규 로직은 trigger 1개 + helper 2개
- Pitfalls: **MEDIUM-HIGH** — Pitfall 3 (react-native-maps Apple Maps opacity)만 실기기 검증 필요, 나머지 HIGH
- Validation: **MEDIUM** — Wave 0 가 무거움 (jest 인프라 신규 셋업) — planner가 manual UAT 위주 vs 자동 test 비율 결정 필요

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — react-native-maps 1.20 → 1.27 같은 minor 업그레이드 가능하지만 stable; SDK 54 호환만 유지)
