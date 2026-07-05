---
phase: 21-travel-ledger
verified: 2026-07-05T22:10:00Z
status: human_needed
score: 3/6 must-haves verified
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "예약 메일을 전달하면 AI가 플랫폼·카드·통화·금액·결제일을 파싱해 가계부에 자동 정리한다 (LEDGER-02, SC2)"
    test: "CF 파이프라인 배포 후, me 탭 전달주소로 실제 예약/카드 결제 메일 1건을 전달하고 ledger 탭에서 항목이 자동 생성 + 필드(플랫폼/카드4/통화/금액/결제일)가 정확히 채워지는지 확인"
    expected: "메일 수신 → inbound-email INSERT(pending) → parse-email이 claude 추출 → status='ready' 또는 'needs_review'로 전이, 필드 정확"
    why_human: "실제 LLM 파싱 정확도 + 라이브 EF 실행은 정적으로 검증 불가 — CF 인프라 배포(21-04 T5)와 실메일이 필요. 파이프라인 코드/유닛테스트(deno 21 green)는 통과했으나 end-to-end 런타임 미실증"
  - truth: "앱을 거치지 않은 예약(직접 예약 항공권 등)도 메일만 오면 가계부에 포착된다 (LEDGER-04, SC4)"
    test: "앱에서 만든 plan과 무관한 항공권/호텔 예약 메일을 전달 → trip_id=null 미분류 항목으로 ledger에 생성되는지 확인"
    expected: "plan/plan_item 참조 없이 owner_user_id만으로 미분류(trip_id NULL) 행 생성 → 미분류 인박스에 노출"
    why_human: "라이브 파이프라인의 실제 메일 포착은 런타임 — CF 배포 전제. 미분류 INSERT 경로 코드는 존재(inbound-email trip_id 미지정)하나 실수신 미실증"
  - truth: "등록된 주소(To 토큰 매칭 + SPF/DKIM 검증)에서 온 메일만 수신·처리한다 (LEDGER-05, SC5)"
    test: "등록 토큰 주소로 온 메일 → 처리 / 미등록 토큰·위조 발신 메일 → drop(202) & SPF/DKIM 실패 거부를 실환경에서 확인"
    expected: "To 토큰 매칭 시 처리, 미매칭 시 202 ignored(존재 미노출), SPF/DKIM 실패는 CF 수신단 거부"
    why_human: "SPF/DKIM 검증은 CF Email Routing 인프라(미배포)에 위임됨. To-토큰 게이트 코드는 inbound-email에 존재하나 EF 유닛테스트 부재 + 실메일 수신 미실증"
human_verification:
  - test: "[선행/BLOCKING] 21-04 Task 5 — CF 인프라 배포 + DNS 이전 + 시크릿 배선"
    expected: "moajoa.app DNS를 Cloudflare로 이전 → Email Routing 활성화 + Worker(moajoa-inbound-email) 지정 → INGEST_SECRET 양쪽(Worker+EF) 동일 배선 → supabase functions deploy inbound-email parse-email + wrangler deploy → EXPO_PUBLIC_FORWARDING_DOMAIN 확정. 스모크: 본인 메일 1건 → ledger_entries 행 생성 확인"
    why_human: "사용자 계정 작업(DNS 소유권 이전 + CF 대시보드) — 리드타임 있는 계정 태스크. 사용자가 실행 중 '코드만 커밋' 결정(의도적 defer, gap 아님)"
  - test: "[21-05 Task 5] 디바이스 가계부 흐름 + 실메일 파싱 UAT (CF 배포 완료 전제)"
    expected: "1) pnpm sim/실기기 → me 탭 전달주소 복사(LEDGER-01 copy UX) 2) 예약/카드 메일 전달 → ledger 탭 항목 자동 생성 + 환율 출처 배지(실청구/추정/확인안됨) 정확성(LEDGER-03) 3) 미분류→1탭 배정→멤버 공유, needs_review→1탭 수정→ready(LEDGER-06) 4) 외화 메일로 5요소 보존 + KRW 파생 확인(LEDGER-03) 5) 한국 카드사 실포맷 claude 프롬프트 정확도(RESEARCH A3)"
    why_human: "실기기 + 실제 메일 전달 + 라이브 파이프라인 필요 — 자동화 불가. 21-04 Task 5 CF 배포에 의존. Phase 18/19 선례대로 phase-verify 이관(코드+자동테스트 완료, 디바이스 UAT는 인간)"
---

# Phase 21: Travel Ledger 검증 리포트

**Phase Goal:** 각 사용자에게 개인 전용 전달 주소가 발급되고, 예약 메일을 전달하면 AI가 파싱해 가계부에 자동 정리한다. 외화 결제의 통화·환율·결제 시점이 원자적으로 보존되고, 앱을 거치지 않은 예약도 메일만 오면 포착되며, 애매하면 1탭 수정한다.
**Verified:** 2026-07-05T22:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

이 phase는 SEQUENTIAL 모드로 실행됐고 5개 plan의 코드가 전부 커밋·테스트 완료(core 143 + api 74 + iOS 127 + deno 21 = 전부 green, 본 검증에서 재실행 확인). 두 개의 human 항목은 사용자 결정으로 **의도적 defer**(gap/failure 아님): (1) 21-04 Task 5 CF 인프라 배포 + DNS 이전, (2) 21-05 Task 5 디바이스 UAT. end-to-end 런타임 목표(실메일 → 파싱된 가계부 행)는 라이브 CF 파이프라인이 있어야만 검증 가능하므로 human verification으로 분류.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (SC) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 각 사용자에게 개인 전용 전달 주소(opaque To 토큰)가 발급된다 (LEDGER-01) | ✓ VERIFIED | 0022 `forwarding_addresses` + `ensure_forwarding_token` BEFORE INSERT 트리거(share_slug idiom, 12자 base62 token) + `unique(user_id)`. RLS 매트릭스 case A가 토큰 생성 실증(`token='hy4gns324pwc'`, 12자). api `getOrCreateForwardingAddress`(get-or-create, auth.getUser로 user_id) — api 테스트 GREEN. me.tsx 발급+표시 카드 wired |
| 2 | 예약 메일을 전달하면 AI가 파싱해 가계부에 자동 정리한다 (LEDGER-02) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | parse-email EF + pipeline/claude.ts(claude-sonnet-4-6, temperature 0, buildLedgerPrompt/parseLedgerOutput/validateTripId) + deno test 11 green. 코드 완비·wired이나 실메일 LLM 파싱은 라이브 EF 런타임 필요 — CF 미배포로 end-to-end 미실증. human_verification |
| 3 | 외화 결제 5요소(원통화·통화·환율·fx_source·fx_as_of)가 원자적으로 보존된다 (LEDGER-03) | ✓ VERIFIED | 0022에 5개 컬럼 + fx_source/currency CHECK. fx.ts `resolveFx`(email>frankfurter>unavailable, fx_as_of=응답date, KRW rate=1) deno 7케이스 green. core `deriveAmountKrw`/`LedgerEntrySchema` 18케이스 green. LedgerRow 3색 배지 렌더. 원자 보존 불변식이 유닛테스트로 실증 |
| 4 | 앱 미경유 예약도 메일만 오면 가계부에 포착된다 (LEDGER-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 0022 ledger_entries에 plan/plan_item FK 0(grep 확인) — trip_id만 참조 + nullable. inbound-email이 trip_id 미지정으로 INSERT(미분류). 구조/코드 완비이나 실메일 수신 포착은 라이브 파이프라인 런타임 필요. human_verification |
| 5 | 등록된 주소(To 토큰 + SPF/DKIM)에서 온 메일만 수신·처리한다 (LEDGER-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | inbound-email: x-ingest-secret 게이트(401) + To 토큰 매칭(미매칭 202 ignored, T-21-12) 코드 존재. SPF/DKIM은 CF Email Routing(미배포)에 위임. EF 레벨 유닛테스트 부재 + 실수신 미실증 → human_verification |
| 6 | 파싱이 애매하면 사용자가 1탭으로 확인·수정한다 (LEDGER-06) | ✓ VERIFIED | ledger.tsx 상태머신 4분기 + 확인섹션(미분류∪needs_review) 1탭 → LedgerEntrySheet(assign/review 2모드). jest 4케이스 green(빈온보딩·미분류 인박스·needs_review 1탭 시트·낙관적 assign 롤백). 상태 전이가 RNTL 테스트로 실증 |

**Score:** 3/6 truths verified (3 present, behavior-unverified — 코드+wiring 완비, 라이브 파이프라인 런타임 미실증)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/0022_ledger.sql` | forwarding_addresses + ledger_entries + 5 RLS + 트리거 2 | ✓ VERIFIED | 141줄. 5 policy, trip_id NULL CASE 분기, plan FK 0, exists 0(헬퍼만), anon 0. append-only(0016~0021 무수정) |
| `packages/api/src/types/database.ts` | ledger/forwarding 타입 재생성 | ✓ VERIFIED | ledger_entries/forwarding_addresses/fx_source/amount_foreign 9회 참조. api typecheck 0 |
| `packages/core/src/schemas/ledger.ts` | 5요소 스키마 + 파싱출력 + 순수함수 | ✓ VERIFIED | 104줄. LedgerEntrySchema + LedgerParseOutputSchema + deriveAmountKrw/needsReview, enum 0022 CHECK 문자 일치 |
| `packages/core/src/schemas/ledger.test.ts` | 스키마+파생 테스트 | ✓ VERIFIED | 18케이스 green |
| `packages/api/src/queries/ledger.ts` | 6 CRUD 쿼리 | ✓ VERIFIED | list/assign/update/delete, house 계약, 파생 로직 0 |
| `packages/api/src/queries/forwarding.ts` | getOrCreate 래퍼 | ✓ VERIFIED | maybeSingle→insert, auth.getUser user_id |
| `packages/api/src/queries/ledger.test.ts` | 쿼리 테스트 | ✓ VERIFIED | 15케이스 green |
| `supabase/functions/inbound-email/index.ts` | 시크릿+토큰 게이트+저장+트리거 | ✓ VERIFIED | 170줄. x-ingest-secret 401, To토큰 매칭, 미매칭 202, fire-and-forget(no await) |
| `supabase/functions/parse-email/index.ts` | claim+오케스트레이션 | ✓ VERIFIED | 254줄. atomic claim(in status), parseMime→claude→validateTripId→resolveFx, raw_mime=null 폐기, cost 로깅 |
| `supabase/functions/parse-email/pipeline/{mail,claude,fx}.ts` | 파이프라인 3파일 + 테스트 | ✓ VERIFIED | deno test 21 green(mail 3/claude 11/fx 7) |
| `workers/inbound-email/` | 얇은 CF Worker | ✓ VERIFIED | async email, x-ingest-secret, DB/LLM 키 0, rawSize>5MB reject |
| `supabase/config.toml` | verify_jwt=false 2건 | ✓ VERIFIED | inbound-email(L72)/parse-email(L75) verify_jwt=false |
| `apps/ios/app/trip/[id]/(tabs)/ledger.tsx` | 스텁→홈 상태머신 | ✓ VERIFIED | 302줄. useGlobalSearchParams(F-20-1), 4분기, 확인섹션, 낙관적 롤백. 스텁 문자열 0 |
| `apps/ios/components/ledger/{ledger-row,ledger-entry-sheet}.tsx` | 행+시트 | ✓ VERIFIED | LedgerRow 3색 배지 + deriveAmountKrw, LedgerEntrySheet assign/review |
| `apps/ios/lib/forwarding-address.ts` | 주소 조립+복사 | ✓ VERIFIED | buildForwardingAddress + expo-clipboard copyForwardingAddress |
| `apps/ios/__tests__/ledger.test.tsx` | RNTL 상태별 | ✓ VERIFIED | 4케이스 green, iOS 127 무회귀 |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| 0022 RLS | 0016 can_read_trip DEFINER | CASE 비-null arm 헬퍼 호출(직접 EXISTS 0) | ✓ WIRED |
| ledger.tsx | @moajoa/api ledger/forwarding | import + Promise.all 호출 | ✓ WIRED (barrel export * ledger/forwarding) |
| ledger.tsx | @moajoa/core deriveAmountKrw/LedgerEntry | import + totalKrw 계산 | ✓ WIRED |
| Worker | inbound-email EF | fetch(INBOUND_EF_URL, x-ingest-secret) | ✓ WIRED (코드) / 런타임은 CF 배포 대기 |
| inbound-email | forwarding_addresses → ledger_entries → parse-email | To토큰 조회→INSERT→fire-forget | ✓ WIRED |
| parse-email/claude.ts | LedgerParseOutput(21-02 정본 미러) | 로컬 재선언 + validateTripId | ✓ WIRED |
| parse-email/fx.ts | Frankfurter null-on-failure | fetch try/catch→null | ✓ WIRED (deno 테스트 stub) |
| me.tsx forwarding card | getOrCreateForwardingAddress + app.config.forwardingDomain | 발급→buildForwardingAddress | ✓ WIRED (도메인 env, 미배선 시 placeholder) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| LEDGER-01 | 21-01, 03, 05 | ✓ SATISFIED | forwarding_addresses + 트리거 + getOrCreate + me 카드 (발급 메커니즘 실증) |
| LEDGER-02 | 21-02, 04 | ? NEEDS HUMAN | parse-email + claude 파이프라인 코드+deno테스트 완비, 실메일 LLM 파싱 런타임 미실증 |
| LEDGER-03 | 21-01, 02, 04, 05 | ✓ SATISFIED | 5요소 컬럼 + resolveFx(7 테스트) + LedgerRow 배지 + deriveAmountKrw |
| LEDGER-04 | 21-01, 04 | ? NEEDS HUMAN | plan FK 0 + trip_id nullable INSERT 코드, 실메일 포착 런타임 미실증 |
| LEDGER-05 | 21-01, 03, 04 | ? NEEDS HUMAN | To토큰+시크릿 게이트 코드, SPF/DKIM=CF 인프라(미배포) + 실수신 미실증 |
| LEDGER-06 | 21-02, 03, 05 | ✓ SATISFIED | ledger.tsx 확인 흐름 + LedgerEntrySheet, jest 실증 |

전 6개 요구사항이 plan frontmatter에 정의됨 (LEDGER-01..06). **ORPHAN 없음.** REQUIREMENTS.md도 이미 LEDGER-02/04/05를 Pending으로 표기 — 라이브 파이프라인 의존을 반영.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| core ledger 스키마+파생 | `pnpm --filter @moajoa/core test` | 143 passed (ledger 18) | ✓ PASS |
| api ledger/forwarding 쿼리 | `pnpm --filter @moajoa/api test` | 74 passed (ledger 15) | ✓ PASS |
| iOS ledger UI 상태별 | `pnpm --filter @moajoa/ios test --watchman=false` | 127 passed (ledger 4) | ✓ PASS |
| parse-email pipeline(mail/claude/fx) | `deno test --allow-net --allow-env pipeline/` | 21 passed / 0 failed | ✓ PASS |
| 실메일 → 파싱된 가계부 행 (end-to-end) | (라이브 CF 파이프라인 필요) | — | ? SKIP → human |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| ledger.tsx | 3 | "placeholder" 문자열 | ℹ️ Info | 주석이 "17-04 placeholder stub을 완전 교체"를 서술 — 실제 스텁 아님(스텁 문자열 grep 0). 무해 |

디버트 마커(TODO/FIXME/XXX/TBD) 0, 실제 스텁 0, 하드코딩 시크릿/URL 0.

### Human Verification Required

라이브 end-to-end 목표(실메일 → 파싱 가계부 행)는 두 의도적-defer 항목에 의존. **이들은 gap/failure가 아니라 사용자 결정으로 defer된 human verification 항목:**

#### 1. [선행/BLOCKING] CF 인프라 배포 + DNS 이전 (21-04 Task 5)
- **Test:** moajoa.app DNS를 Cloudflare로 이전 → Email Routing 활성화 + Worker 지정 → INGEST_SECRET 양쪽 동일 배선 → `supabase functions deploy inbound-email parse-email` + `wrangler deploy` → EXPO_PUBLIC_FORWARDING_DOMAIN 확정. 스모크: 본인 메일 1건 → ledger_entries 행 생성.
- **Expected:** 파이프라인 라이브, 스모크 행 생성.
- **Why human:** DNS 소유권 이전 + CF 대시보드 = 사용자 계정 작업(리드타임). 실행 중 사용자가 "코드만 커밋" 선택.

#### 2. [21-05 Task 5] 디바이스 가계부 흐름 + 실메일 파싱 UAT
- **Test:** sim/실기기 → me 탭 주소 복사 → 예약/카드 메일 전달 → ledger 항목 자동 생성 + 환율 배지 정확성 → 미분류 1탭 배정(멤버 공유) → needs_review 1탭 수정(ready) → 외화 5요소+KRW 파생 → 한국 카드사 실포맷 claude 정확도.
- **Expected:** LEDGER-01/02/03/06 런타임 sign-off.
- **Why human:** 실기기+실메일+라이브 파이프라인 필요, 1번에 의존. Phase 18/19 선례(자동테스트 완료, 디바이스 UAT는 phase-verify).

### Gaps Summary

**gap 없음.** 정적으로 검증 가능한 전부(0022 DB+RLS 정책, core/api 스키마·쿼리, EF/Worker 코드+deno 테스트, iOS 표면+jest, 요구사항 추적)가 통과. 4개 테스트 스위트(core 143 / api 74 / iOS 127 / deno 21) 전부 green으로 재확인. 미완은 오직 라이브 CF 파이프라인 배포와 그에 의존하는 디바이스 UAT — 사용자가 실행 중 의도적으로 defer한 human verification 항목. LEDGER-02/04/05는 런타임 행위-의존적(⚠️ PRESENT_BEHAVIOR_UNVERIFIED)이라 human verification으로 이관, gaps_found 아님.

**의사결정 트리 결과:** FAILED/MISSING/STUB/NOT_WIRED/blocker 없음 → gaps_found 아님. Human verification 항목 존재(3개 behavior-unverified + 2개 UAT 체크) → **status: human_needed.**

---

_Verified: 2026-07-05T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
