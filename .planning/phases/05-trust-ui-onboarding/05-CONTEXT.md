# Phase 5: Trust UI & Onboarding — Context

**Gathered:** 2026-05-26
**Mode:** smart-discuss (auto)
**Status:** Ready for planning

<domain>
## Phase Boundary

dogfooding 신뢰의 1번 위협(confident-wrong, Pitfall 1)을 시각·인터랙션 contract로 차단하고, 신규 사용자의 빈 상태 마찰을 제거한다. 6개 요구사항(TRUST-01~04 + ONBOARD-01~02)을 iOS + Web 양쪽에서 동시 lock:

1. **TRUST-01:** AI 추출 핀 vs 사용자 수동 핀이 한눈에 구분됨 (iOS + Web)
2. **TRUST-02:** 추출 진행 중인 링크의 현재 단계가 UI에 노출됨 (Phase 2의 5단계 broadcast 활용)
3. **TRUST-03:** 추출 실패 시 사유 + 1탭 retry
4. **TRUST-04:** `confidence < 0.7` 핀은 시각적으로 약하게 + 사용자가 confirm/reject 가능
5. **ONBOARD-01:** 신규 가입자 첫 로그인 → "내 첫 여행" 보드 자동 1개 생성
6. **ONBOARD-02:** 첫 보드 상세 진입 → "유튜브 링크를 붙여넣어 보세요" 안내 카드 1회 표시 후 dismiss 영구

**Scope lock:**
- **iOS 주 surface (TRUST + ONBOARD 모두).** Web은 `/b/[slug]` readonly이므로 Phase 4 D-17 lock 유지: web에 trust 인터랙션(confirm/reject) 추가 X. **Web은 TRUST-01 시각 구분만 미니멀하게 반영** (점선·옅은 색 marker 분기). TRUST-02/03/04/ONBOARD-01/02는 iOS 전용.
- 파일 경계: `apps/ios/app/boards/[id].tsx`, `apps/ios/app/(tabs)/boards.tsx`, `apps/web/app/b/[slug]/_components/public-board-map.tsx`(read-only 색 분기만), `packages/api/src/queries/{places,boards}.ts`, `packages/core/src/schemas/*` (Zod 확장), `supabase/migrations/0006_*.sql` (per-place confidence + first_board 트리거)
- Edge Function 변경: `extract-youtube/index.ts` places insert 시 per-place `confidence` 저장 한 줄 추가만 (이미 LLM 출력에 있음 — Phase 2 D-04에서 도입한 schema의 confidence를 places 행에 wire)
- Phase 3 D-10이 임시로 둔 단순 spinner를 **5단계 step indicator로 augment**. spinner는 idle/transition fallback으로 남김.
- Phase 3 UI-SPEC §Typography에서 reserved한 `text-xs` (12px) + `font-medium` (500)을 본 phase에서 도입 (low_confidence 라벨 위계 + step indicator 텍스트)

</domain>

<decisions>
## Implementation Decisions

### Per-place confidence 컬럼 (TRUST-04 prerequisite)

- **D-01:** **`places.confidence numeric(3,2)` 컬럼을 새 마이그레이션 `0006_per_place_confidence.sql`로 추가.** nullable, CHECK `(confidence is null or confidence between 0 and 1)`. 기존 `links.extraction_confidence`(평균)는 그대로 유지 (역할 분리: links는 영상 단위 신뢰도, places는 핀 단위). `0006_per_place_confidence.sql`은 Phase 5 첫 plan에서 생성 → CLAUDE.md §4.3 append-only 준수. **0006 번호 충돌 확인 필요**(현재 0005까지 — 0001~0006이 PROJECT.md에서 언급되지만 실제 0005가 마지막인지 첫 plan에서 verify).
- **D-02:** **`extract-youtube/index.ts`의 places upsert 시 `confidence: candidate.confidence` 한 줄 추가.** Phase 2 D-04 Zod 스키마가 이미 `confidence` 필드를 받고 있으므로 wire만 하면 됨. Edge Function 외 변경 없음.
- **D-03:** **`public_board_view` RPC + `listPlacesByBoard` 헬퍼가 `confidence` 컬럼을 추가로 반환하도록 0006 마이그레이션에서 RPC redefine + `packages/api/src/queries/places.ts` 매핑 확장.** 기존 컬럼·반환 구조는 그대로(append only — 신규 컬럼 추가만). Type regen 필수 (`pnpm supabase:types`).
- **D-04:** **`confidence` confirm/reject 상태는 별도 컬럼으로 저장 X — `source_kind` 전환으로 처리.** 사용자가 low-confidence AI 핀을 "확인" 누르면 `source_kind: 'ai' → 'manual'`로 PATCH(= 사용자가 확정한 핀이 됨, 더 이상 옅게 표시 X) + `confidence: null`. "reject" 누르면 `hidden_at = now()` set (soft delete — `places_board_idx where hidden_at is null` 기존 인덱스 그대로 활용). **별도 `confirmed_at` 컬럼 도입 X** (스키마 단순화, v1 lock). Phase 1.5 협업 투표 도입 시 재설계.

### TRUST-01: AI 핀 vs 수동 핀 시각 구분

- **D-05:** **iOS = marker 색 + opacity 차이.** react-native-maps `<Marker>`의 `pinColor` prop으로 차별화:
  - `source_kind='ai'` (confidence ≥ 0.7) → `pinColor='#F97316'` (brand-500, opacity 1.0)
  - `source_kind='ai'` (confidence < 0.7) → `pinColor='#F97316'` + `opacity={0.5}` + 마커에 점선 ring effect는 react-native-maps Default 마커로 표현 어려움 → **opacity 0.5 + 마커 위에 작은 `?` 배지(custom marker view)**로 처리 (D-08 참조)
  - `source_kind='manual'` → `pinColor='#0F172A'` (neutral-900, opacity 1.0) — "사용자가 직접 추가" = 더 진한 색·실체감
  - **점선 marker 시각은 native PinView로는 어려워서 채택 X** (CONTEXT.md domain에 명시되었지만 ROADMAP 본문 "점선·옅은 색"의 "점선"은 v1 fidelity 안 추구). UI-SPEC에서 reassign.
- **D-06:** **Web (`/b/[slug]` PublicBoardMap) = Google Maps Marker icon SVG로 색 + 투명도 차이만.**
  - `source_kind='ai'` (high conf) → 주황색 SVG marker (`#F97316`, opacity 1)
  - `source_kind='ai'` (low conf, confidence < 0.7) → 주황색 + opacity 0.45 + 흰색 `?` 글자 inline
  - `source_kind='manual'` → 짙은 회색·검정 톤 (`#0F172A`, opacity 1)
  - InfoWindow / 클릭 핸들러 변경 없음 — Phase 4 D-14 (`window.open YouTube`) 그대로. **Web에는 confirm/reject 인터랙션 도입 X (D-17 lock 유지)**.

### TRUST-02: 추출 진행 단계 UI

- **D-07:** **5단계 step indicator 도입 — text-only progress strip.** progress bar(연속) vs step indicator(이산) 중 **이산 채택**. 이유:
  - Phase 2 D-02 broadcast가 5단계 이산 신호(`metadata` → `transcript` → `llm` → `places` → `done`)
  - 각 단계의 duration이 가변(transcript fetch가 1초~15초 분포). 연속 progress bar는 가짜 보간이 필요해 정직성 ↓
  - Karpathy 4.4 검증 가능성: "현재 step === 'llm'을 사용자가 보고 있다"가 falsifiable
- **D-08:** **Layout = Phase 3 spinner overlay 자리 그대로, 컨텐츠만 step list로 교체.**
  - `bg-white/70` full-screen overlay (Phase 3 D-10 카드 보존) — 화면 상호작용 차단 유지
  - 중앙 column:
    1. `ActivityIndicator` (brand-500) — 항상 spinning (idle/transition feedback)
    2. 그 아래 5줄 step list:
       - 각 줄: `[●] 영상 정보 가져오는 중`, `[●] 자막 읽는 중`, `[●] 장소 찾는 중`, `[●] 지도에 표시하는 중`, `[●] 완료`
       - 현재 단계 = `text-base font-semibold text-brand-500` + 채워진 dot (`●`)
       - 완료된 단계 = `text-sm font-regular text-neutral-500` + 채워진 dot
       - 미래 단계 = `text-sm font-regular text-neutral-300` + 빈 dot (`○`)
       - **font-medium은 Phase 3 holdout 해제 — step list의 "예상되는 단계지만 아직 안 옴" 라벨에 12 / 500 사용 (Phase 3 UI-SPEC §Typography reserved 회수)**
  - broadcast 메시지가 **raw 그대로 노출 X** — Phase 2 step name → 한국어 카피 매핑 fixture (D-09)
- **D-09:** **Step name → 한국어 카피 fixture (UI-SPEC에서 lock):**
  | broadcast.step | 한국어 표시 |
  |---|---|
  | `metadata` | "영상 정보 가져오는 중" |
  | `transcript` | "자막 읽는 중" |
  | `llm` | "장소 찾는 중" |
  | `places` | "지도에 표시하는 중" |
  | `done` | (overlay dismiss) |
  | `error` | (overlay dismiss + error toast — D-10 참조) |

### TRUST-03: 실패 retry UX

- **D-10:** **Retry = error toast에 inline [재시도] 버튼.** Phase 3의 error toast(D-10)를 확장:
  - 기존: `"분석 실패: {reason}"` 단순 dismiss
  - 신규: toast 우측에 `[재시도]` Pressable 추가. 1탭 = `triggerExtraction(supabase, link_id)` 재호출 + overlay 재진입 (D-08)
  - toast auto-dismiss = 8초 (Phase 3 5초 → 8초, retry 누를 시간 확보)
  - 사용자가 dismiss하면 retry 기회 사라짐 — 보드 상세의 링크 리스트에서 `extraction_status='failed'` 링크를 탭하면 retry 가능 (D-11)
- **D-11:** **링크 리스트 행에 status 시각 + 탭 시 retry.** 보드 상세 하단 링크 리스트 행 표시:
  - 상태별 표시: `pending` = "분석 대기", `processing` = "분석 중...", `ready` = "분석 완료", `failed` = `text-danger` "분석 실패 — 탭하여 재시도", `manual_review` = "재추출 필요"
  - `failed` 행 탭 → `triggerExtraction` 재호출 + 보드 상세 spinner overlay (D-08) 진입
  - 재시도 max 3회는 client-side counter X — `links.extraction_status`가 그대로 라이프사이클. Edge Function 자체 idempotency는 이미 Phase 2가 처리 (`already processing` 가드).
- **D-12:** **자동 재시도 횟수 = 0 (사용자 명시 행동만).** Phase 3 D-06(Share Extension `retry_count ≤ 3` silent retry)는 enqueue drain용. 추출 자체는 자동 retry 안 함:
  - 자동 retry는 LLM·Places API quota burst를 악화
  - 사용자가 retry 결정해야 의도/맥락이 살아있음 (예: 네트워크 변경 후 재시도)
  - 백그라운드 retry는 v2 (OBS-01 Sentry로 실패 패턴 측정 후)

### TRUST-04: low_confidence 시각 + confirm/reject

- **D-13:** **시각 표현 = opacity 0.5 + `?` 배지.** D-05/D-06 marker 시각이 1차. 핀 bottom sheet 진입 시 2차 표시:
  - Bottom sheet 헤더에 `text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700` 배지 `"신뢰도 낮음"` (text-xs · font-medium reserved holdout 회수)
  - 배지 아래 한 줄 안내 `text-sm text-neutral-600`: `"AI가 자신 없어해요. 맞으면 확인, 아니면 삭제해 주세요."`
- **D-14:** **Confirm/Reject 액션 = bottom sheet 기존 버튼 stack에 인서트 (Phase 3 D-09 single sheet 확장).**
  - low_confidence (`source_kind='ai'` AND `confidence < 0.7`)일 때만 다음 두 버튼 visibility 추가:
    - `[확인]` (primary, `bg-brand-500 text-white`) → `places.update({ source_kind: 'manual', confidence: null })` (D-04 lock)
    - `[잘못됨]` (destructive secondary, `bg-white border border-danger text-danger`) → soft delete (`hidden_at = now()`)
  - `[삭제]` (기존 D-09 액션)은 별도 — 직접 영구 삭제(`Alert.alert` confirm)로 동작 유지
  - `[이름 수정]`, `[영상에서 위치]`는 기존 그대로
- **D-15:** **Threshold = 0.7 정확히 매칭.** `confidence < 0.7` (REQUIREMENTS.md 그대로). `confidence is null` (= 이전 데이터·manual)은 low_confidence로 취급 X (manual 핀은 항상 high confidence). **threshold는 `packages/core/src/constants.ts`에 `LOW_CONFIDENCE_THRESHOLD = 0.7` 상수 export** — UI 양쪽에서 단일 출처.

### ONBOARD-01: 첫 보드 자동 생성

- **D-16:** **Postgres 트리거로 처리 — 클라이언트 코드 X.** `0006_per_place_confidence.sql`(또는 `0007_first_board.sql` 분리)에 `auth.users` 또는 `profiles` insert 후 트리거. profiles 행이 생성될 때 same user_id로 `boards (owner_id, title, visibility)` 1개 insert:
  - title = `"내 첫 여행"` (D-19에서 카피 lock)
  - visibility = `'private'`
  - description = NULL
  - 트리거가 멱등 (`on conflict do nothing` — owner_id에 이미 보드 있으면 skip은 어렵지만 `if not exists (select 1 from boards where owner_id = NEW.id)` 가드로 처리)
- **D-17:** **트리거 함수 = SECURITY DEFINER + search_path 명시 (CLAUDE.md §4.4 lock 준수).** profiles 행이 RLS-bound이므로 트리거가 service-level로 boards insert. `am_board_owner` 등 기존 헬퍼 패턴 따라감. 기존 `0002_fix_rls_recursion.sql` 패턴 차용.
- **D-18:** **기존 사용자(이미 가입한 dogfooder 본인) backfill = 별도 1회 SQL.** 마이그레이션 끝에 `insert into boards (owner_id, title, visibility) select id, '내 첫 여행', 'private' from profiles p where not exists (select 1 from boards where owner_id = p.id);` — 트리거가 이미 활성된 후의 신규 가입자만 자동 처리이므로, 기존 dogfooder도 동일 경험을 위해 1회 backfill.

### ONBOARD-02: 안내 카드

- **D-19:** **카드 = 보드 상세 내부 inline dismissible banner (modal/overlay 아님).** 위치:
  - 보드 상세 `[id].tsx`의 URL TextInput 위 (helper text 위치) — placeholder와 자연스럽게 시각적 연결
  - Style: `mx-6 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex-row items-start`
  - 좌측 이모지 또는 lucide icon (`💡` 또는 `Sparkles`) `mr-3 mt-0.5`
  - 본문: `text-sm text-neutral-800 flex-1` (14 / 400)
    - 헤더 줄: `font-semibold text-neutral-900` `"유튜브 링크를 붙여넣어 보세요"`
    - 본문 줄: `text-sm text-neutral-700 mt-1` `"영상 속 장소가 30초 안에 지도로 떠요"`
  - 우측 닫기 버튼 `Pressable` `text-neutral-400 text-lg` `"×"`
- **D-20:** **Dismiss persistence = AsyncStorage `@moajoa/onboard:link_card_dismissed = true` (글로벌 1회).** AsyncStorage 키 1개로 모든 보드에서 한번만 보임. 보드별 dismiss는 v1 과잉. **AsyncStorage 키는 `packages/core/src/constants.ts` `OnboardKeys.LinkCardDismissed`로 export** (SharedDefaultsKeys 패턴 차용).
  - 가시성 조건: `OnboardKeys.LinkCardDismissed`가 falsy AND (보드 places.length === 0) AND (보드 links.length === 0)
  - 핀이 1개라도 생기면 자연스럽게 숨김 (조건문)
  - 명시적 `×` 탭하면 영구 dismiss
- **D-21:** **카드는 첫 보드(트리거 생성)에 한정하지 않음.** 모든 빈 보드(D-20 조건 충족 시)에서 표시. 신규/기존 사용자가 새 보드 만들었을 때도 동일 학습 가치 + 구현 간단.

### Phase 3 UI-SPEC holdout 회수 (typography)

- **D-22:** **`text-xs` (12px)와 `font-medium` (500)을 본 phase에서 활성화.**
  - `text-xs` 사용 site: low_confidence 배지 ("신뢰도 낮음"), step indicator 미래 단계 라벨, OG image 메타(web — Phase 4 미사용이었으므로 holdout 영향 없음)
  - `font-medium` 사용 site: step indicator 현재/미래 단계 텍스트 위계 분리(현재 600 vs 미래 500 vs 완료 400). 추가로 안내 카드 헤더에 적용 가능.
  - Phase 3에서 reassign된 use site(badge·banner 등)는 그대로 14 / 400 유지 — **신규 use site에만 적용** (회귀 회피).
- **D-23:** **UI-SPEC 작성 시 Phase 3 UI-SPEC `Tokens available but NOT used` 표 갱신**: text-xs·font-medium은 "Phase 5에서 도입" → "Phase 5에서 활성"으로 reassign 명시 (cross-phase trace).

### Web parity (TRUST-01만)

- **D-24:** **Web public board는 marker 색 분기만, 인터랙션 0.** Phase 4 D-17 lock 유지: web에 confirm/reject·step indicator·안내 카드 도입 X. `apps/web/app/b/[slug]/_components/public-board-map.tsx`에 marker icon 분기 코드 ~10줄 추가. 기존 onClick→YouTube 동작 변경 없음.
- **D-25:** **Web OG image (Phase 4 D-06)는 본 phase 변경 없음.** AI/manual 비율을 OG에 노출은 v2 polish.

### Claude's Discretion (researcher/planner가 정함)

- 마이그레이션 번호 (0006 vs 0007 분리 — confidence 컬럼 1개 vs first_board 트리거 1개)
- AsyncStorage 라이브러리 선택 (`@react-native-async-storage/async-storage` 표준)
- `?` 배지 marker custom view 구현 방식 (react-native-maps `<Marker>` children vs `image` prop)
- 안내 카드 좌측 아이콘 (emoji vs lucide-react-native `<Sparkles />`)
- step indicator 5줄 list의 dot 컴포넌트 (단순 Text `●`/`○` vs SVG circle)
- low_confidence 배지 색 (amber-50/700 vs neutral-100/600 — 노출 너무 강하면 사용자 피로)
- ONBOARD-01 트리거 vs Edge Function 호출 (트리거가 단순하지만 profile insert 시점·테스트 어려움 검토)

</decisions>

<deferred_ideas>
## Deferred Ideas (out of Phase 5 scope)

- **A/B testing 안내 카드 카피·위치 비교:** v2. PostHog 등 obs 인프라 도입(OBS-01) 후.
- **Native push notification "분석 완료":** REQUIREMENTS.md Out of Scope에 명시. v1 dogfooding 단계에서 무가치.
- **스플래시 튜토리얼(여러 슬라이드 onboarding):** v1 ONBOARD-02는 보드 상세 1회 카드만. multi-step tutorial은 외부 사용자 acquisition 단계(v2).
- **AI 핀 confidence를 영상 전체 평균과 비교 시각 (예: 이 영상의 모든 핀이 낮음):** v2. UX 노이즈.
- **수동 핀에 사용자 별점·메모(❤️·comment):** COLLAB-01/02 (v2).
- **Empty board state illustration (보드 상세에 일러스트):** 안내 카드(D-19)가 그 역할 일부 — 일러스트는 디자인 리소스 작성 필요해 v2.
- **저신뢰 핀을 영상 전체 polling으로 사용자에게 confirm 권고하는 modal:** D-14 sheet 액션으로 충분. modal 강제는 사용자 거부감 ↑.
- **첫 보드 자동 생성 시 sample 영상 1개 자동 추가:** "공식 sample 보드"가 사용자의 진짜 첫 행동을 가리게 됨. dogfooding에 노이즈.
- **확률을 숫자로 표시 (`confidence: 0.42`):** ML score 노출은 사용자 인지부담 ↑. v2 power-user 토글.
- **Web에 trust 인터랙션 도입:** D-17 lock 그대로 v2.
- **TRUST-04 reject 시 "왜 잘못됐나요?" 피드백 prompt:** v2. EXTRACT-08 evaluation dataset과 짝지어.
- **Onboarding telemetry (카드 dismiss 비율, 첫 보드 핀 추가까지 시간):** v2. OBS-01 도입 후.
- **다국어(ja-JP, en-US) 안내 카드:** I18N-01 v2.
- **다크 모드 token mapping (low_confidence amber 색):** THEME-01 v2.
- **Apple/Google OAuth 직후 onboarding 흐름:** AUTH-05/06 v2. 현재 이메일+비번/매직링크 흐름만.

</deferred_ideas>

<specifics>
## Specific Ideas

### 5단계 step indicator wireframe (D-07/D-08)

```
┌────────────────────────────────────┐
│ ░░░░░ overlay bg-white/70 ░░░░░░░ │
│                                    │
│         ◌ Spinner (brand-500)      │
│                                    │
│   ● 영상 정보 가져오는 중   (완료, 14/400 neutral-500)
│   ● 자막 읽는 중           (현재, 16/600 brand-500)
│   ○ 장소 찾는 중           (미래, 12/500 neutral-300)
│   ○ 지도에 표시하는 중      (미래, 12/500 neutral-300)
│                                    │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────┘
```

### Marker 시각 차별화 (D-05)

| condition | iOS pinColor | iOS opacity | iOS badge | Web SVG fill | Web opacity | Web badge |
|---|---|---|---|---|---|---|
| ai + high conf | brand-500 (#F97316) | 1.0 | (none) | #F97316 | 1.0 | (none) |
| ai + low conf | brand-500 | 0.5 | "?" custom view | #F97316 | 0.45 | "?" inline |
| manual | neutral-900 (#0F172A) | 1.0 | (none) | #0F172A | 1.0 | (none) |

### Bottom sheet low_confidence variant (D-13/D-14)

```
   ───── (handle)
┌──────────────────────────────────────┐
│ 마쓰모토 라멘                        │  18/600
│ 도쿄도 시부야구 ...                  │  14/400 neutral-600
│ [AI]  [신뢰도 낮음]                  │  badges (14/400 + 12/500 amber)
│ AI가 자신 없어해요. 맞으면           │  14/400 neutral-600
│ 확인, 아니면 삭제해 주세요.          │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │            확인                  │ │  brand-500 (primary)
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │           잘못됨                 │ │  border danger (destructive)
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │         이름 수정                │ │  neutral-100 (기존)
│ └──────────────────────────────────┘ │
│ ...                                  │
└──────────────────────────────────────┘
```

### Onboarding 안내 카드 wireframe (D-19)

```
┌──────────────────────────────────────┐
│ ← 뒤로  내 첫 여행         [+ 핀]    │
├──────────────────────────────────────┤
│ ┌─ amber-50 / amber-200 ──────────┐ │
│ │ 💡 유튜브 링크를 붙여넣어 보세요 │×│  헤더 14/600 neutral-900
│ │    영상 속 장소가 30초 안에     │ │  본문 14/400 neutral-700
│ │    지도로 떠요                  │ │
│ └─────────────────────────────────┘ │
│ [유튜브 / 블로그 / 인스타 링크]  [추가]│
└──────────────────────────────────────┘
```

### Error toast retry variant (D-10)

```
┌────────────────────────────────────┐
│ 분석 실패: 자막이 없는 영상  [재시도]│  bg-danger, text-white, 14/400
└────────────────────────────────────┘
   (auto-dismiss 8s, tap-to-dismiss)
```

### Migration 0006 skeleton (D-01/D-16)

```sql
-- 0006_trust_ui_onboarding.sql
-- Part 1: per-place confidence
alter table places
  add column if not exists confidence numeric(3,2)
    check (confidence is null or confidence between 0 and 1);

-- Part 2: public_board_view RPC redefinition (append confidence)
-- (full SELECT list + 'confidence', p.confidence)

-- Part 3: first board auto-create trigger
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

create trigger profiles_first_board_trigger
  after insert on profiles
  for each row execute function profiles_create_first_board();

-- Part 4: backfill for existing users
insert into boards (owner_id, title, visibility)
select p.id, '내 첫 여행', 'private'
from profiles p
where not exists (select 1 from boards where owner_id = p.id);
```

### Step name 한국어 fixture (D-09)

`packages/core/src/constants.ts`에 export:
```ts
export const EXTRACT_STEP_KO = {
  metadata: '영상 정보 가져오는 중',
  transcript: '자막 읽는 중',
  llm: '장소 찾는 중',
  places: '지도에 표시하는 중',
} as const;

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export const OnboardKeys = {
  LinkCardDismissed: '@moajoa/onboard:link_card_dismissed',
} as const;
```

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context (필수)
- `CLAUDE.md` — Karpathy 4 원칙, §4.3 마이그레이션 append-only, §4.4 RLS SECURITY DEFINER, §4.5 NO `.js` extension
- `.planning/PROJECT.md` — Core Value, "첫 보드 자동 생성 온보딩" Active line, Out of Scope (Push notification, COLLAB)
- `.planning/REQUIREMENTS.md` §"Trust UI (TRUST)" + §"Onboarding (ONBOARD)" — TRUST-01~04, ONBOARD-01~02 falsifiable acceptance criteria
- `.planning/ROADMAP.md` §"Phase 5: Trust UI & Onboarding" — phase goal, 6 success criteria, depends on Phase 2/3/4
- `docs/WORKSTREAMS.md` — 파일 경계 (iOS·Web·Backend·Design cross-cut phase 명시)

### Prior phase decisions (lock 유지)
- `.planning/phases/01-build-unblock-hygiene/01-CONTEXT.md` — D-WEB-01/02 (dev-tool 게이트), D-08 (Pretendard 4 weight)
- `.planning/phases/02-extraction-pipeline-hardening/02-CONTEXT.md` — D-01/02 (broadcast 5단계 채널), D-04 (Zod confidence 필드 존재), D-06 (source_kind/inferred_city), D-07 (source_timestamp_sec rename 금지), D-08 (extraction_costs 스키마), D-11 (extraction_costs RLS service-role only)
- `.planning/phases/03-ios-save-flow/03-CONTEXT.md` — D-09 (single bottom sheet UI for AI/manual), D-10 (Phase 3 spinner — Phase 5에서 augment), D-11 (p90 측정 SQL)
- `.planning/phases/03-ios-save-flow/03-UI-SPEC.md` — §Typography "Tokens available but NOT used in Phase 3" (text-xs, font-medium reserved for Phase 5 — 본 phase에서 활성), §Color Source kind badge 색 정의(현재 동일 neutral — Phase 5에서 marker는 차별, badge는 유지)
- `.planning/phases/04-public-board-web/04-CONTEXT.md` — D-17/D-18 (web readonly anon — confirm/reject 인터랙션 도입 X), D-14 (pin onClick → YouTube), D-03 (revalidateTag로 confidence 변경 시 web 재검증 가능)

### Schema + types (구현 시 import)
- `supabase/migrations/0001_init.sql` lines 347~370 — places 테이블 (confidence 컬럼 추가 대상), `places_default_added_by` 트리거 패턴
- `supabase/migrations/0001_init.sql` lines 487~551 — `public_board_view(p_slug)` RPC (confidence 컬럼 추가 시 SELECT list 갱신)
- `supabase/migrations/0002_fix_rls_recursion.sql` — SECURITY DEFINER 헬퍼 패턴 (D-17 first_board trigger에 차용)
- `supabase/migrations/0004_extraction_hardening.sql` — `places.source_kind`, `places.inferred_city` 컬럼 + extraction_costs RLS
- `supabase/migrations/0005_*.sql` — Phase 3 마이그레이션 (extraction_costs.link_id nullable). Phase 5는 0006부터.
- `packages/api/src/types/database.ts` — 0006 적용 후 `pnpm supabase:types` 재생성 필수
- `packages/core/src/schemas/*.ts` — PlaceCandidate Zod 스키마 (confidence 필드 이미 존재, ManualPlaceAdd 등 확장 위치)

### Edge Functions (작은 수정만)
- `supabase/functions/extract-youtube/index.ts` lines 200~230 — places upsert 위치. `confidence: candidate.confidence` 한 줄 추가 (D-02)
- `supabase/functions/extract-youtube/pipeline/claude.ts` — `confidence` Zod 필드 이미 존재(Phase 2). 추가 변경 없음.

### iOS scaffold (수정 시작점)
- `apps/ios/app/boards/[id].tsx` — analyzing overlay (D-08 step indicator로 augment), 링크 리스트 failed retry (D-11), 안내 카드 banner (D-19), Marker opacity/badge (D-05)
- `apps/ios/app/boards/_pin-sheet.tsx` — Phase 3 PinBottomSheet (D-13/D-14 low_confidence badge + 확인/잘못됨 액션 추가)
- `apps/ios/app/(tabs)/boards.tsx` — 안내 카드는 보드 상세에만 (boards 목록 변경 없음 — Phase 3 시스템 banner 그대로)
- `apps/ios/lib/realtime.ts` — `subscribeExtractProgress` 콜백이 이미 metadata/transcript/llm/places 모두 받음 (Phase 3에서는 done/error만 사용했지만 broadcast 자체는 5단계 전송 중). 본 phase는 콜백 분기 확장만.
- `apps/ios/lib/toast.tsx` — error toast에 action button slot 추가 (D-10 [재시도])
- `apps/ios/lib/onboarding.ts` (신규) — AsyncStorage wrapper for `OnboardKeys.LinkCardDismissed`
- `packages/api/src/queries/places.ts` — `confirmAiPlace` (source_kind 전환), `rejectAiPlace` (soft delete) helper 신규
- `packages/core/src/constants.ts` — `EXTRACT_STEP_KO`, `LOW_CONFIDENCE_THRESHOLD`, `OnboardKeys` export

### Web scaffold (TRUST-01만)
- `apps/web/app/b/[slug]/_components/public-board-map.tsx` — Marker icon 분기 (D-06). 다른 변경 없음.
- `apps/web/app/b/[slug]/page.tsx` — `public_board_view` RPC 결과의 `confidence` 필드 client component로 pass-through (props 추가)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`subscribeExtractProgress`** (`apps/ios/lib/realtime.ts`) — Phase 3가 만든 helper. 콜백 payload `{ step, progress_pct, places_extracted?, error? }` 이미 metadata/transcript/llm/places/done/error 모두 수신 가능. Phase 3는 done/error만 분기했음 — 본 phase는 metadata/transcript/llm/places 분기 추가만.
- **PinBottomSheet** (`apps/ios/app/boards/_pin-sheet.tsx`) — Phase 3 D-09 single sheet. low_confidence variant는 props에 confidence 추가 + 조건부 액션 stack inserter.
- **`places` 테이블 `hidden_at` 컬럼** (0001_init.sql:364) — TRUST-04 reject = soft delete에 그대로 사용 (D-04). `places_board_idx where hidden_at is null` 인덱스가 이미 hidden 핀 자동 제외.
- **LLM `confidence` 출력** (`pipeline/claude.ts:16`) — Zod 스키마에 `confidence: z.number().min(0).max(1).default(0.5)` 이미 존재. places upsert에 wire만 하면 D-02 완료.
- **`am_board_owner` SECURITY DEFINER 헬퍼** (0002) — first_board 트리거의 RLS 우회 패턴 참고용 (트리거 자체는 SECURITY DEFINER로 처리).
- **Toast 컴포넌트** (`apps/ios/lib/toast.tsx`) — Phase 3 단일 인스턴스. action button slot 추가는 props 확장 1개로 가능.

### Established Patterns
- Edge Function의 places upsert는 admin client(service role) — RLS 우회. confidence 컬럼 추가는 INSERT 컬럼 list에 한 줄.
- `public_board_view` RPC는 jsonb 반환 — 컬럼 추가 시 SELECT 절 확장만, RPC 시그니처(p_slug) 변경 없음
- iOS 보드 상세에서 places reload는 `load()` 호출 — confirmAiPlace/rejectAiPlace 호출 후 동일 패턴
- Step indicator는 모두 한국어 fixture — packages/core constants 단일 출처 (i18n은 v2)
- AsyncStorage 직접 import 안 함 — `lib/onboarding.ts` 같은 wrapper로 type-safe key 사용 (SharedDefaults 패턴 차용)

### Known Pitfalls (재발 방지)
- **`places.confidence` 컬럼 추가 후 RPC 재정의 누락:** Phase 2 D-07 lesson(컬럼 이름 변경 X)과 비슷. 0006 마이그레이션이 컬럼 추가 + `public_board_view` 재정의를 한 번에 하지 않으면 web SSR이 confidence 못 받음 → TRUST-01 web parity(D-06) 깨짐. 마이그레이션 한 파일에서 묶음 처리.
- **`pnpm supabase:types` 재생성 누락:** TypeScript 타입에 confidence 없으면 lib에서 undefined로 떨어짐. CLAUDE.md §4.3에 명시.
- **react-native-maps `<Marker>` opacity prop iOS Apple Maps provider 호환성:** AppleMaps는 opacity 무시 가능. researcher가 첫 plan에서 확인 — 호환 안 되면 custom marker view(Image alpha)로 fallback.
- **AsyncStorage v1+ migration warning:** `@react-native-async-storage/async-storage`가 SDK 54와 호환되는 버전 확인. 이미 monorepo에 있으면 재사용.
- **profiles 트리거 vs auth.users 트리거:** `auth.users` 직접 트리거는 Supabase가 권장 X (auth schema 보호). `profiles` insert에 트리거 거는 것이 표준. 단 `profiles`가 user signup 시 자동 생성되는지 확인 — 0001_init.sql 또는 0002에서 `handle_new_user` 트리거가 이미 있음. 그 trigger와 동시 발생하므로 순서·트랜잭션 안전성 검토.
- **Step indicator overlay와 사용자 인터랙션:** Phase 3 D-10 overlay는 `pointerEvents="auto"` — 사용자가 핀 탭·다른 버튼 클릭 모두 막힘. 본 phase에서 그대로 유지 (5단계 진행 중 다른 핀 탭 = race condition).
- **첫 보드 자동 생성과 빈 보드 안내 카드 중복:** 첫 보드 = 빈 보드 = D-19 카드 표시. 사용자가 "내 첫 여행" 들어가면 자동 카드 1회 노출 — 의도된 흐름. 단 dismiss 후 다른 보드로 갔다 와도 안 보임(D-20 글로벌 키).

</code_context>

<open_questions>
## Open Questions (RESOLVED)

모든 grey area가 D-01~D-25로 lock됨. 다음 항목은 plan 단계에서 researcher의 1차 확인 사항이지만 blocking 아님:

- **마이그레이션 번호 0006 충돌:** PROJECT.md Validated가 "0001~0006 적용됨"으로 언급하지만 실제 디렉토리는 0005까지로 보임. 첫 plan에서 `ls supabase/migrations/` 확인 후 next 번호 확정. (D-01 lock은 "다음 번호" 의도)
- **react-native-maps Marker opacity iOS 호환:** Apple Maps provider에서 opacity prop 작동 여부 — researcher 1순위 확인. 비호환 시 custom marker view(View + opacity Tailwind)로 fallback. **D-05 시각 의도(low conf = 옅음)는 유지**, 구현 방식만 조정.
- **`profiles` 신규 가입 trigger 순서:** 기존 `handle_new_user` 트리거(0001 또는 0002)와 D-16/D-17 first_board 트리거의 발생 순서. 같은 NEW.id를 참조하므로 같은 트랜잭션 안에 있으면 안전, 분리 시 race 가능 — researcher가 0001/0002 트리거 확인 후 적용 시점 결정.
- **`@react-native-async-storage/async-storage` 모노레포 dep 존재:** 이미 있으면 재사용, 없으면 `apps/ios/package.json`에 추가 + pnpm hoist (Phase 1 D-02 패턴).

위 4개는 plan-checker가 blocking으로 잡지 않음 — 모두 실행 단계 detail.

---

**Next:** `/gsd-plan-phase 5` — researcher가 위 결정에 기반해 RESEARCH.md, planner가 PLAN.md 작성. UI-SPEC은 `/gsd-ui-phase 5`로 별도(Phase 3/4 패턴과 동일).

</open_questions>
