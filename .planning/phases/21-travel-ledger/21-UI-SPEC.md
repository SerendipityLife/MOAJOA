---
phase: 21
slug: travel-ledger
status: approved
reviewed_at: 2026-07-05
shadcn_initialized: false
preset: none
created: 2026-07-05
---

# Phase 21 — UI Design Contract

> 메일 전달 가계부(Travel Ledger) phase의 시각·상호작용 계약. 20-UI-SPEC 토큰·이디엄을 상속(신규 토큰 0). iOS 전용(Expo/NativeWind) — 웹 가계부 표면은 CONTEXT deferred.
> 인바운드 인프라(CF Worker/EF)·환율 API·파싱 파이프라인은 **UI 표면 0** — 이 계약 밖.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn — RN 표면) |
| Component library | none — hand-rolled NativeWind. 시트 = `@gorhom/bottom-sheet`(book.tsx 선례) |
| Icon library | `@expo/vector-icons` Ionicons (기존 idiom) |
| Font | Pretendard → Apple SD Gothic Neo → Noto Sans KR fallback |

Sources: 20-UI-SPEC.md(approved), `packages/ui-tokens/src/index.ts`, `apps/ios/app/trip/[id]/(tabs)/{ledger.tsx(스텁),book.tsx}`, `components/booking/checklist-row.tsx`, `me.tsx`.

---

## Spacing Scale

20-UI-SPEC에서 상속(무변경). 4px base. 카드 내부 `px-4 py-4`(md 16px), 화면 거터 `px-6`(lg 24px), 행 리듬 `mb-2.5`(10px, checklist-row 예외 계승), ScrollView `paddingBottom:48`. 히트타깃 ≥44px(`minHeight:44`/`w-11 h-11`). 시트 top radius `radii.3xl`(28px).

---

## Typography

20-UI-SPEC 상속. Body 14px/400, Label 16px/600, Heading 18px/600, Display 20px/600(빈 상태 heading). Caption 12px/400 neutral-400/500(금액 캡션·환율 출처·상태 힌트). 금액 숫자는 Label(16px/600) — 가계부의 핵심 값.

---

## Color

60/30/10. 가계부도 광고판처럼 읽히면 안 됨 — 카드 흰/neutral, brand는 아래 소수만.

| Role | Value | Usage |
|------|-------|-------|
| Dominant(60%) | `#FFFFFF` / `neutral-50` | 화면 배경, 카드/시트 표면 |
| Secondary(30%) | `neutral-100/200` | 플랫폼 아이콘 칩(`bg-neutral-100`+`neutral-600`), 경계, 캡션 |
| Accent(10%) | `brand-500/600/50` | 아래 reserved만 |
| Success | `semantic.success #10B981` | 'email' fx_source 실청구 확인 배지(실제 청구액 = 신뢰) |
| Warning | `semantic.warning` | 'unavailable' 환율 확인 안 됨(주의) |
| Destructive | `semantic.danger #EF4444` | 항목 삭제 action+confirm |

**Accent reserved(명시):**
- **전달 주소 복사 버튼**(me/온보딩) — `bg-brand-50` + `text-brand-600` (이 phase의 시작 CTA)
- **미분류/needs_review 배지** — `bg-brand-50` chip + `text-brand-600 text-[10px]`(확인 유도)
- **1탭 확인·배정 CTA**(시트 확인 버튼) — `bg-brand-500` Pressable
- **"플랜 탭으로" 류 text link** — `text-brand-600`
- Neutral-only(NOT brand): 플랫폼 아이콘 칩, merchant/플랫폼 라벨, 금액 텍스트(기본), 섹션 라벨, 환율 캡션(email/frankfurter 구분은 배지 색으로).

**환율 출처 3색 규칙(D-06 가시화):** fx_source='email'→success 배지("실청구"), 'frankfurter'→neutral 캡션("추정 환율"), 'unavailable'→warning 캡션("환율 확인 안 됨"). 원통화 금액은 항상 표시, KRW는 파생 캡션.

---

## Copywriting Contract

전부 한국어, warm/casual(기존 톤 "곧 제공돼요"/"이동시간 —"/"친구와 같이 정하기").

| Element | Copy |
|---------|------|
| ledger 탭 제목 | **가계부** · caption **{총액}** 또는 **{N}건** |
| 전달 주소 카드 제목(me/온보딩) | **내 예약 메일 주소** |
| 전달 주소 설명 | **예약·결제 메일을 이 주소로 전달하면 가계부에 자동으로 정리돼요.** |
| 전달 주소 복사 버튼 | **주소 복사** → 복사 후 토스트 **주소를 복사했어요** |
| 미분류 인박스 섹션 라벨 | **어느 여행인지 확인해주세요** (`text-sm font-semibold text-neutral-500`) |
| 미분류 배지 | **미분류** (`bg-brand-50 text-brand-600 text-[10px]`) |
| needs_review 배지 | **확인 필요** (`bg-brand-50 text-brand-600 text-[10px]`) |
| 환율 출처 — email | **실청구** (`semantic.success` 배지) |
| 환율 출처 — frankfurter | **추정 환율** (`text-xs text-neutral-400`) |
| 환율 출처 — unavailable | **환율 확인 안 됨** (`text-xs` warning) |
| 금액 표시 | `{amount_foreign} {currency}` (Label) + `≈ ₩{amount_krw}` (caption) |
| 미분류 1탭 시트 제목 | **어느 여행의 예약인가요?** — trip 리스트 tap 선택 |
| needs_review 1탭 시트 제목 | **결제 정보를 확인해주세요** — 금액/통화/결제일 필드 + **확인** 버튼 |
| 시트 확인 버튼 | **확인** (`bg-brand-500`) |
| 항목 삭제 confirm | **이 항목을 삭제할까요?** / **삭제**(danger) · **취소** (`Alert.alert`) |
| 빈 상태(가계부 비어있음) | heading **아직 정리된 예약이 없어요** / body **예약·결제 메일을 내 주소로 전달하면 여기에 자동으로 쌓여요.** + text link **내 주소 보기** |
| 로드 실패 | **가계부를 불러오지 못했어요. 잠시 후 다시 시도해주세요.** + **다시 시도** |
| 파싱 실패 항목(status='failed') | **이 메일은 읽지 못했어요** (drop 안 하고 표시 — 사용자 인지) |

---

## Registry Safety

| Registry | Blocks | Gate |
|----------|--------|------|
| shadcn | none | n/a (RN) |
| third-party | none | n/a |

hand-rolled. 신규 npm: postal-mime(EF/Worker — UI 아님), expo-clipboard(전달주소 복사, 선택).

---

## Screen Contracts

3개 iOS 표면 + 2개 컴포넌트. Icon: Ionicons.

### Component 0 — LedgerRow (shared)
**File:** new `apps/ios/components/ledger/ledger-row.tsx` (checklist-row.tsx 미러)
**Goal:** 한 결제 = 한 행. 좌 플랫폼 칩 · 중앙 merchant+메타 · 우 금액+환율.
- 컨테이너: `ROW_SHADOW` `bg-white rounded-2xl mb-2.5 px-3 py-3 flex-row items-center`.
- 좌: `w-11 h-11 rounded-xl bg-neutral-100` + 플랫폼 아이콘(Ionicons `airplane`/`bed`/`ticket`/`card` — platform 매핑, 기본 `receipt-outline`) `#4B5563`.
- 중앙(flex-1 ml-3): merchant `text-sm font-semibold text-neutral-900`; 캡션 `text-xs text-neutral-400` = `{platform} · {card_last4 있으면 ••••{last4}} · {paid_at MM.DD}`.
- 우: 금액 `{amount_foreign} {currency}` `text-base font-semibold`; 아래 캡션 `≈ ₩{amount_krw}` + 환율 출처 배지(email=success/frankfurter=neutral/unavailable=warning).
- 미분류/needs_review면 우상단 배지(brand-50) + 행 탭 → 시트. ready면 탭 무동작(또는 상세).

### Component 1 — LedgerEntrySheet (shared)
**File:** new `apps/ios/components/ledger/ledger-entry-sheet.tsx` (book BottomSheet + me profile-sheets 미러)
- `@gorhom/bottom-sheet` `snapPoints ['55%']` `enablePanDownToClose`, `{open && ...}` 게이팅.
- **미분류 모드:** 제목 "어느 여행의 예약인가요?" + 사용자 trip 리스트(각 tap → `assignTripToEntry`). "여행 없음 유지" 옵션.
- **needs_review 모드:** 제목 "결제 정보를 확인해주세요" + 필드(금액 numeric, 통화 3자, 결제일 date) + **확인**(`bg-brand-500`) → `updateLedgerEntry` status='ready'.
- 낙관적 반영 + 롤백 + showToast.

### Screen 1 — Ledger Tab 홈 (LEDGER-06 확인 흐름)
**File:** `apps/ios/app/trip/[id]/(tabs)/ledger.tsx` (스텁 재작성, book.tsx 상태머신)
- 상태머신 early-return: `!loaded`→ActivityIndicator(`#2979FF`); `error`→다시 시도; 비어있음(ledger+미분류 0)→빈 온보딩("아직 정리된 예약이 없어요" + "내 주소 보기" link→me).
- 리스트(활성): 상단 **미분류/needs_review 섹션**(있으면, "어느 여행인지 확인해주세요" 라벨 + LedgerRow들, 1탭 시트) → **확정 항목 섹션**(paid_at desc, trip 배정된 것 + 총액 캡션).
- AppState quiet refetch(파이프라인이 백그라운드로 채우므로 복귀 시 갱신).
- **날짜 게이트 없음** — 가계부는 plan/날짜 무관(LEDGER-04 앱 미경유 예약). trip 컨텍스트만 있으면 열림.

### Screen 2 — 전달 주소 카드 (LEDGER-01)
**File:** `apps/ios/app/me.tsx` 수정(20-07 제휴 안내 삽입 선례) + `lib/forwarding-address.ts`
- me 스크린 제휴 안내 카드 인접에 **내 예약 메일 주소** 카드(`bg-white rounded-3xl p-5` `cardShadow`): 제목 + 설명 + `{token}@{forwardingDomain}` 표시(선택 가능 텍스트) + **주소 복사** 버튼(`bg-brand-50 text-brand-600`).
- 복사 → expo-clipboard(권장) `Clipboard.setStringAsync` + showToast("주소를 복사했어요"). (Share.share 대안 — planner 판단.)
- 최초 진입 시 `getOrCreateForwardingAddress`로 발급(1회).

### Screen 3 — 빈 온보딩(ledger 탭 최초)
가계부 비어있고 미분류도 0 → Display heading + body + "내 주소 보기" text link(→me 전달주소 카드). receipt-outline neutral 글리프(스텁 계승).

---

## Cross-Screen Interaction Notes

- **파이프라인 비동기성:** 메일 전달 → 파싱까지 수 초. ledger.tsx는 pending/processing 행을 "정리 중…" 스켈레톤 또는 숨김(planner 판단). AppState 복귀 refetch로 채움. Realtime broadcast는 선택(파싱 짧아 폴링/복귀갱신으로 충분).
- **미분류→배정→멤버 공유:** 미분류(본인만) 행을 trip 배정하면 RLS상 즉시 멤버 공유. 시트에서 배정 후 토스트로 "'{trip}' 가계부에 추가했어요" 피드백.
- **환율 출처 신뢰 표시:** email=실청구(초록)가 가장 신뢰, frankfurter=추정(회색)은 참고, unavailable=경고. 사용자가 출처를 한눈에.

---

## Checker Sign-Off

- [x] 신규 토큰 0 — 20/19-UI-SPEC 상속
- [x] brand accent reserved 명시(광고판 방지 계승)
- [x] 전 카피 한국어·기존 톤
- [x] 3색 환율 출처 규칙(D-06 가시화) 정의
- [x] 컴포넌트 analog(checklist-row/book sheet) 명시
- [x] iOS 전용(웹 표면 deferred) 확인

**Approval:** approved 2026-07-05
