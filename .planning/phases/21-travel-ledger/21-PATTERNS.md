# Phase 21: Travel Ledger (메일 전달 가계부) - Pattern Map

**Mapped:** 2026-07-05
**Basis:** 21-RESEARCH.md + codebase 실측(extract-youtube·generate-plan·0016/0018/0021·book.tsx·bookings.ts·checklist.ts)

> 각 신설·수정 파일이 미러링할 기존 정본(analog)과 패턴을 지정한다. Downstream executor는 analog 파일을 read_first로 열고 idiom을 verbatim 따른다.

---

## File Classification

| File | Type | Action | Analog (미러 정본) |
|------|------|--------|--------------------|
| `supabase/migrations/0022_ledger.sql` | migration (DDL+RLS) | 신설 | 0021_booking.sql + 0016 ensure_share_slug + 0018 ensure_poll_code |
| `packages/core/src/schemas/ledger.ts` | schema+enum | 신설 | schemas/date-poll.ts + checklist.ts (const-enum) |
| `packages/core/src/schemas/ledger.test.ts` | test | 신설 (Wave 0) | date-poll.test.ts |
| `packages/core/src/constants.ts` | constants | 수정(append) | 기존 채널/Keys append idiom |
| `packages/api/src/queries/ledger.ts` | service CRUD | 신설 | queries/bookings.ts (house 계약) |
| `packages/api/src/queries/forwarding.ts` | service | 신설 | queries/bookings.ts (얇은 래퍼) |
| `packages/api/src/queries/ledger.test.ts` | test | 신설 (Wave 0) | bookings.test.ts (makeChain/makeClient) |
| `packages/api/src/queries/index.ts` | barrel | 수정 | `export * from './ledger'` |
| `workers/inbound-email/src/index.ts` | CF Worker | 신설 | (선례 없음 — RESEARCH Pattern 1) |
| `workers/inbound-email/wrangler.toml` | config | 신설 | (CF 표준) |
| `supabase/functions/inbound-email/index.ts` | EF | 신설 | extract-youtube/index.ts (골격) |
| `supabase/functions/parse-email/index.ts` | EF | 신설 | generate-plan/index.ts (claim+멱등) |
| `supabase/functions/parse-email/pipeline/mail.ts` | EF lib | 신설 | (postal-mime, RESEARCH) |
| `supabase/functions/parse-email/pipeline/claude.ts` | EF lib | 신설 | generate-plan/pipeline/claude.ts (verbatim, 프롬프트 교체) |
| `supabase/functions/parse-email/pipeline/fx.ts` | EF lib | 신설 | generate-plan/pipeline/routes.ts (null-on-failure) |
| `supabase/functions/parse-email/pipeline/*.test.ts` | test | 신설 (Wave 0) | generate-plan/pipeline/*.test.ts (deno) |
| `supabase/functions/*/deno.json` | config | 신설 | extract-youtube/deno.json (복사 + postal-mime) |
| `supabase/config.toml` | config | 수정 | [functions.inbound-email]/[functions.parse-email] verify_jwt=false |
| `packages/api/src/types/database.ts` | generated | 재생성 | 0022 apply 후 supabase:types |
| `apps/ios/app/trip/[id]/(tabs)/ledger.tsx` | screen | 재작성 | book.tsx (상태머신) |
| `apps/ios/components/ledger/ledger-row.tsx` | component | 신설 | components/booking/checklist-row.tsx |
| `apps/ios/components/ledger/ledger-entry-sheet.tsx` | component | 신설 | book.tsx BottomSheet + me profile-sheets |
| `apps/ios/app/me.tsx` | screen | 수정 | 20-07 제휴 안내 카드 삽입 선례 |
| `apps/ios/lib/forwarding-address.ts` | lib | 신설 | lib/share-board.ts (얇은 래퍼) |
| `apps/ios/__tests__/ledger.test.tsx` | test | 신설 (Wave 0) | __tests__/book.test.tsx (RNTL 하네스) |
| `apps/ios/app.config.ts` | config | 수정 | extra에 forwarding domain(EXPO_PUBLIC) |

---

## Shared Patterns (모든 파일 공통)

- **마이그레이션 append-only** — 0016~0021 무수정, 0022 신설. RLS는 DEFINER 헬퍼(can_read_trip/can_edit_trip) 경유, 직접 cross-table EXISTS 0 (42P17 가드, 0016 L28/0021 L3 반복 강조).
- **EF 골격** — `Deno.serve` + OPTIONS/POST 게이트 + `corsHeaders/jsonError/jsonOk` + service-role admin(`persistSession:false`) + Zod `safeParse`.
- **house 계약(api)** — `(client, ...) => Promise<T>`, `const {data,error}=...; if(error) throw error`. 배럴 재노출.
- **const-enum(core)** — `export const X=[...] as const; export type XType=(typeof X)[number]`. DB CHECK와 문자 일치 주석. 스키마 `z.enum(X).default(...)`.
- **NativeWind only(ios)** — `className` 유틸, 인라인 style은 히트타깃(minHeight:44)·ScrollView contentContainerStyle·그림자 상수만. 하드코딩 hex는 아이콘 color prop만.
- **jest(ios)** — `__tests__/*.test.tsx`, 파일-스코프 mock(@moajoa/api·@/lib/supabase·expo-router·@expo/vector-icons·@gorhom/bottom-sheet 스텁), RNTL render/waitFor.

---

## Pattern Assignments

### `supabase/migrations/0022_ledger.sql` (migration)
**Analog:** 0021_booking.sql(테이블+RLS+additive) · 0016 ensure_share_slug(L158-182) · 0018 ensure_poll_code
**패턴:**
1. **forwarding_addresses 테이블:** `id uuid pk`, `user_id uuid not null references auth.users(id) on delete cascade`, `token text not null unique`, `created_at timestamptz default now()`. `ensure_forwarding_token` 트리거(gen_random_bytes(8) base64→translate→regexp_replace→최소 12자, ensure_share_slug idiom verbatim, share_slug→token 리네임만). unique(user_id) — 사용자당 1개(재발급은 UPDATE).
2. **ledger_entries 테이블:**
   - `id uuid pk default gen_random_uuid()`
   - `owner_user_id uuid not null references auth.users(id) on delete cascade` — 전달한 사람(D-04 write 소유자)
   - `trip_id uuid references trips(id) on delete set null` — **nullable**(미분류, D-05/LEDGER-04)
   - `status text not null default 'pending' check (status in ('pending','processing','ready','needs_review','failed'))`
   - `platform text` / `card_last4 text check (card_last4 ~ '^[0-9]{4}$')` / `merchant text`
   - `amount_foreign numeric(14,2)` / `currency text check (char_length(currency)=3)` — 5요소 ①②
   - `fx_rate numeric(18,8)` / `fx_source text check (fx_source in ('email','frankfurter','unavailable'))` / `fx_as_of date` — 5요소 ③④⑤
   - `amount_krw numeric(14,2)` — 파생(generated 또는 파이프라인 계산; generated면 `generated always as (round(amount_foreign*fx_rate)) stored` 단 fx_rate null 허용 위해 파이프라인 계산 권장)
   - `paid_at timestamptz` / `raw_mime text` / `raw_expires_at timestamptz` — 최소저장+TTL(D-03)
   - `created_at/updated_at timestamptz default now()`
3. **인덱스:** `ledger_owner_idx (owner_user_id)`, `ledger_trip_idx (trip_id) where trip_id is not null`, `ledger_status_idx (status) where status in ('pending','processing')` (파이프라인 claim용).
4. **updated_at 트리거:** `ledger_entries_set_updated_at` — 0016 set_updated_at() 재사용, **재정의 금지**.
5. **RLS(핵심 — RESEARCH Pattern 4):** `enable row level security` +
   - SELECT: `case when trip_id is null then owner_user_id=auth.uid() else can_read_trip(trip_id) end` (미분류 본인·배정 멤버)
   - UPDATE: using+with check `owner_user_id=auth.uid()` (행 소유자만, D-04)
   - DELETE: using `owner_user_id=auth.uid()`
   - INSERT: **정책 없음/deny** — 앱 클라는 INSERT 안 함(파이프라인 EF service-role만). forwarding_addresses는 SELECT `user_id=auth.uid()` + INSERT `user_id=auth.uid()`(getOrCreate).
6. **anon 정책 0** — authenticated + service-role만.

**Acceptance grep:**
- `grep -c "create policy" 0022` >= 5 (ledger 3 + forwarding 2)
- `grep -cE "plan_id|plan_item_id" 0022` == 0 (가계부는 plan 무관, LEDGER-04)
- `grep -c "exists" 0022` == 0 (헬퍼 경유)
- `grep -c "create function" 0022` <= 1 (ensure_forwarding_token만; set_updated_at 재정의 0)
- `git diff --stat 0016..0021` 빈 출력 (append-only)
- `grep -c "to anon\|grant.*anon" 0022` == 0

---

### `packages/core/src/schemas/ledger.ts` (schema+enum)
**Analog:** schemas/date-poll.ts + checklist.ts
**패턴:**
- const-enum 3쌍: `LedgerStatus=['pending','processing','ready','needs_review','failed']`, `FxSource=['email','frankfurter','unavailable']`, (통화는 열림 — `CurrencySchema=z.string().length(3)`).
- `LedgerEntrySchema = z.object({ id, owner_user_id, trip_id: z.string().uuid().nullable(), status: z.enum(LedgerStatus), platform: z.string().nullable(), card_last4: z.string().regex(/^\d{4}$/).nullable(), merchant, amount_foreign: z.number().nullable(), currency: CurrencySchema.nullable(), fx_rate, fx_source, fx_as_of, amount_krw, paid_at, created_at, updated_at })`.
- **파싱 출력 스키마(LLM 계약, EF가 로컬 재선언하지만 core가 정본):** `LedgerParseOutputSchema = z.object({ platform: z.string().nullable(), card_last4: z.string().regex(/^\d{4}$/).nullable(), merchant: z.string().nullable(), amount_foreign: z.number().nullable(), currency: z.string().length(3).nullable(), paid_at: z.string().nullable(), krw_amount: z.number().nullable(), fx_rate: z.number().nullable(), matched_trip_id: z.string().uuid().nullable(), confidence: z.enum(['high','low']) })` — matched_trip_id는 입력 trip 집합 교집합만(EF서 validatePlanIds idiom으로 방어).
- 순수 파생 헬퍼: `deriveAmountKrw(amount_foreign, fx_rate): number|null`, `needsReview(status): boolean`.

**Acceptance grep:** `grep -c "LedgerParseOutputSchema\|LedgerEntrySchema" ledger.ts` >= 2; core test green.

---

### `packages/core/src/constants.ts` (수정, append)
**패턴:** 기존 Keys/채널 append idiom 그대로. `LedgerKeys = { ... } as const`(필요 시), 파이프라인 채널명 필요하면 `LEDGER_CHANNEL_PREFIX='ledger:'` + `ledgerChannelName(userId)` — 단 realtime 진행 표시가 필요할 때만(파싱은 짧아 폴링으로 충분할 수 있음 — planner 판단). extraction 블록 무수정.

---

### `packages/api/src/queries/ledger.ts` + `forwarding.ts` (service)
**Analog:** queries/bookings.ts
**패턴(ledger.ts):**
- `listLedger(client, tripId): Promise<LedgerEntry[]>` — `.select('*').eq('trip_id',tripId).order('paid_at',{ascending:false})`
- `listUnassignedLedger(client): Promise<LedgerEntry[]>` — `.select('*').is('trip_id',null).order('created_at')` (미분류 인박스; RLS가 본인-only 보장)
- `listNeedsReview(client, tripId): Promise<LedgerEntry[]>` — `.eq('status','needs_review')`
- `assignTripToEntry(client, entryId, tripId): Promise<LedgerEntry>` — `.update({trip_id}).eq('id',entryId).select('*').single()` (1탭 배정, D-05)
- `updateLedgerEntry(client, entryId, patch): Promise<LedgerEntry>` — needs_review 수정(금액/통화/날짜/status→'ready')
- `deleteLedgerEntry(client, entryId): Promise<void>`
- 파생·환율은 EF 소유. api는 CRUD만(주석: 파싱 로직 api 금지).

**패턴(forwarding.ts):**
- `getOrCreateForwardingAddress(client): Promise<{token:string}>` — `.select('token').maybeSingle()` 없으면 `.insert({user_id:auth.uid()})`(트리거가 token 생성) `.select('token').single()`. RLS가 user_id=auth.uid() 게이트.

**테스트(ledger.test.ts):** bookings.test.ts makeChain/makeClient 복사. 각 함수 (1) 테이블/eq/payload 단언 (2) {error}→rejects 페어. `.is('trip_id',null)` 체이너블 커버.

**Acceptance:** `grep -c "export * from './ledger'" index.ts`==1; api test green; typecheck 0.

---

### `workers/inbound-email/src/index.ts` + `wrangler.toml` (CF Worker)
**Analog:** RESEARCH Pattern 1 (선례 없음 — 신규 인프라)
**패턴:**
- `export default { async email(message, env, ctx) {...} }`.
- 크기 가드: `if (message.rawSize > 5_000_000) { message.setReject('too large'); return }`.
- raw 추출: `const raw = await new Response(message.raw).text()` (또는 arrayBuffer→base64 for 안전).
- `await fetch(env.INBOUND_EF_URL, { method:'POST', headers:{'content-type':'application/json','x-ingest-secret':env.INGEST_SECRET}, body: JSON.stringify({to:message.to, from:message.from, rawSize:message.rawSize, raw}) })`.
- **Worker엔 DB·claude 접근 없음** — INBOUND_EF_URL + INGEST_SECRET만(wrangler secret).
- wrangler.toml: `name`, `main`, `compatibility_date`, Email trigger는 CF 대시보드 Email Routing 룰에서 Worker 지정(catch-all 또는 서브도메인 — plan 실측). 시크릿은 `wrangler secret put`.
- **[BLOCKING] 사용자 준비물:** moajoa.app DNS → Cloudflare 이전 + Email Routing 활성화 + Worker 배포(`wrangler deploy`).

**Acceptance:** Worker 코드 존재 + wrangler.toml 유효(로컬 `wrangler dev` 스모크 또는 코드 리뷰). end-to-end는 Manual-Only.

---

### `supabase/functions/inbound-email/index.ts` (EF)
**Analog:** extract-youtube/index.ts (골격)
**패턴:**
- Deno.serve + OPTIONS/POST + corsHeaders/jsonError/jsonOk + admin(service-role).
- **auth 대신 시크릿:** `if (req.headers.get('x-ingest-secret') !== Deno.env.get('INGEST_SECRET')) return jsonError(401,'unauthorized')`. (verify_jwt=false 보완, Pitfall 7.)
- Zod: `{ to: z.string(), from: z.string(), rawSize: z.number(), raw: z.string() }`.
- To 토큰 파싱: local-part 추출(`to.split('@')[0]`, `+` 서브어드레싱 고려) → `admin.from('forwarding_addresses').select('user_id').eq('token',token).maybeSingle()`. **미매칭 → 202 반환(drop, 존재여부 미노출)**.
- `admin.from('ledger_entries').insert({ owner_user_id, status:'pending', raw_mime: raw, raw_expires_at: <now+interval>, platform: <from 힌트> }).select('id').single()`.
- **parse-email fire-and-forget 트리거:** `fetch(<parse-email url>, {method:'POST', headers:{'x-ingest-secret':...}, body: JSON.stringify({entry_id})})` **no await, .catch()** (Pitfall 5). 또는 pg_net/직접 함수 호출 — planner 판단(fetch가 단순).
- 200 jsonOk.

**Acceptance grep:** `grep -c "x-ingest-secret" index.ts` >= 1; `grep -c "auth.getUser" index.ts`==0 (시크릿 게이트지 유저 게이트 아님); deno check clean.

---

### `supabase/functions/parse-email/index.ts` + `pipeline/*` (EF)
**Analog:** generate-plan/index.ts + pipeline/{claude.ts,routes.ts}
**패턴(index.ts):**
- 시크릿 게이트(inbound과 동일) + Zod `{entry_id: uuid}`.
- **atomic claim**(extract-youtube 미러): `update ledger_entries set status='processing' where id=entry_id and status in ('pending','failed')` `.select('id')` — 0행이면 already processing 409.
- entry 로드(raw_mime, owner_user_id).
- **pipeline/mail.ts:** `PostalMime.parse(raw)` → `{subject, from, text, html, date}`. text 우선(html→text 정제). forwarded 래핑 처리(claude가 흡수).
- **pipeline/claude.ts:** generate-plan claude.ts verbatim(claude-sonnet-4-6, x-api-key, temperature 0, fence-strip, Zod). **프롬프트 교체:** system="예약/카드 결제 알림 메일에서 결제 정보 추출" + 사용자 trip 목록(id/title/city/start~end) 주입 → `LedgerParseOutput`(플랫폼/카드4/통화/금액/결제일/krw_amount?/fx_rate?/matched_trip_id?/confidence). matched_trip_id는 입력 trip 교집합만(validatePlanIds idiom — 환각 trip_id 방어).
- **pipeline/fx.ts:** `resolveFx(currency, paidDate, mailKrw, mailRate): Promise<{fx_rate, fx_source, fx_as_of, amount_krw}>` — mailKrw/mailRate 있으면 fx_source='email'; 없으면 `fetch('https://api.frankfurter.dev/v1/'+paidDate+'?base='+currency+'&symbols=KRW')` null-on-failure(routes.ts idiom: try/catch→null, !ok→null, 옵셔널체이닝). 실패 시 fx_source='unavailable', fx_rate=null. **응답 date를 fx_as_of로**(주말 직전영업일).
- 결과 UPDATE: `status = confidence==='high' && amount 있음 ? 'ready' : 'needs_review'`, trip_id=matched_trip_id, 5요소 + amount_krw, **raw_mime=null(파싱 후 폐기, D-03)** 또는 raw_expires_at 유지.
- extraction_costs 로깅(provider='anthropic' — 기존 CHECK, **provider 확장 불필요**. frankfurter 무료라 미로깅).
- 에러 → status='failed'(extract-youtube catch idiom), 파싱된 부분값 보존.

**패턴(테스트, deno):** claude.ts export 프롬프트 fragment 단언 + LedgerParseOutput 파싱; fx.ts null-on-failure(mail값 우선·API fallback·실패 unavailable) — generate-plan pipeline test 미러.

**Acceptance:** `deno check`; `grep -c "claude-sonnet-4-6" pipeline/claude.ts`>=1; `grep -c "frankfurter" pipeline/fx.ts`>=1; deno test green.

---

### `supabase/config.toml` (수정)
**패턴:** `[functions.inbound-email]\nverify_jwt = false` + `[functions.parse-email]\nverify_jwt = false` 추가(extract-youtube 블록 무수정). Pitfall 7 — 자체 시크릿이 보완.

---

### `apps/ios/app/trip/[id]/(tabs)/ledger.tsx` (재작성)
**Analog:** book.tsx (상태머신)
**패턴:**
- import: @moajoa/api(listLedger/listUnassignedLedger/listNeedsReview/assignTripToEntry/updateLedgerEntry/deleteLedgerEntry) + @moajoa/core(LedgerEntry 타입, deriveAmountKrw, 상태 라벨) + supabase.
- `load` = `Promise.all([getTrip, listLedger(trip), listUnassignedLedger, listNeedsReview])`. AppState quiet refetch(book idiom).
- **상태머신 early-return:** `!loaded`→ActivityIndicator; `error`→다시 시도; `trip && !start_date`→"일정이 정해지면…"(D-04 유사, ledger는 날짜 무관하나 trip 컨텍스트 필요 — planner 판단, 빈 상태); ledger 비어있고 미분류도 없음→온보딩 빈 상태("예약 메일을 전달하면 자동으로 정리돼요" + 전달 주소 안내 링크); else 리스트.
- 리스트: 섹션 = ①needs_review/미분류 인박스(있으면 상단 강조) ②확정 항목 목록(paid_at desc). `LedgerRow` map.
- 미분류/needs_review 1탭 → `LedgerEntrySheet`(trip 선택 or 금액/통화 수정 → assign/update).
- 낙관적 업데이트 + 롤백 + showToast(book idiom).

---

### `apps/ios/components/ledger/ledger-row.tsx` + `ledger-entry-sheet.tsx`
**Analog:** components/booking/checklist-row.tsx + book.tsx BottomSheet + me profile-sheets
**패턴(ledger-row):** ROW_SHADOW 카드, 좌 플랫폼 아이콘 칩(bg-neutral-100), 중앙 merchant + platform·card_last4 캡션, 우 금액 `{amount_foreign} {currency}` + `≈ ₩{amount_krw}` 캡션(fx_source='email'이면 실청구 배지, 'frankfurter'면 추정 표시, 'unavailable'이면 "환율 확인 안 됨"). needs_review/미분류면 우상단 배지 + 탭→시트.
**패턴(entry-sheet):** @gorhom/bottom-sheet(book 스코프 idiom) — 미분류면 trip 선택 리스트, needs_review면 금액/통화/결제일 입력 필드 + "확인" → status='ready'.

---

### `apps/ios/app/me.tsx` (수정) + `lib/forwarding-address.ts`
**Analog:** 20-07 제휴 안내 카드 삽입 + lib/share-board.ts
**패턴:**
- me.tsx: 제휴 안내 카드 위 또는 MenuSection으로 **전달 주소 카드** — `getOrCreateForwardingAddress` 호출로 `{token}@ledger.moajoa.app` 조립(도메인은 app.config.ts extra `forwardingDomain`) → 표시 + 복사 버튼.
- lib/forwarding-address.ts: `copyForwardingAddress(addr)` — share-board.ts idiom. **복사 방식:** expo-clipboard 신규(권장, `Clipboard.setStringAsync` + showToast) 또는 Share.share(선례). planner 판단(RESEARCH Open Q).
- app.config.ts: extra에 `forwardingDomain: process.env.EXPO_PUBLIC_FORWARDING_DOMAIN`(하드코딩 금지, §4.7).

**Acceptance:** me.tsx에 전달주소 문자열 렌더; forwarding-address 복사 단언(RNTL 또는 lib unit).

---

### iOS 테스트 (`__tests__/ledger.test.tsx`, Wave 0)
**Analog:** __tests__/book.test.tsx
**패턴:** @moajoa/api·@/lib/supabase·expo-router·@expo/vector-icons·@gorhom/bottom-sheet 스코프 mock. 상태별 waitFor 단언: 빈 온보딩·미분류 인박스 렌더·needs_review 1탭 시트·낙관적 assign 롤백. reanimated mock은 드래그 없으면 불필요(book 하네스만 복사).

---

## Wave 배치 (dependency-ordered)

| Wave | Plans | 병렬 | 근거 |
|------|-------|------|------|
| **W1** | 21-01 (0022_ledger.sql + apply + typegen + RLS 매트릭스) | — | 데이터 기반. 이후 전 wave의 전제 |
| **W2** | 21-02 (@moajoa/core ledger 스키마) ∥ 21-03 (@moajoa/api ledger·forwarding 쿼리, TDD) | ∥ | core는 api 의존 없음(스키마), api는 재생성 타입 위. 둘 다 W1 타입 필요하나 core는 스키마-only라 부분 병렬 — 실무는 core 먼저 얇게 |
| **W3** | 21-04 (inbound-email + parse-email EF + pipeline + Worker + config.toml) | — | W1 테이블 + W2 스키마/타입 위. EF는 배포 시 타깃 DB 대상 |
| **W4** | 21-05 (ledger.tsx + ledger-row + entry-sheet + me.tsx 전달주소 + forwarding-address + app.config) | — | W2 api + W3 파이프라인 산출 위. UI 최종 표면 |

- Worker 배포·DNS 이전·end-to-end 메일은 **checkpoint:human-action**(W3 또는 phase verify).
- 21-01은 **autonomous:false**(라이브 DB apply — 0021 선례, Docker 가용하나 원격 적용은 사용자 자격/승인).

---

## Registry / 신규 의존 요약
- **신규 설치:** postal-mime(EF deno.json + Worker), wrangler(dev, Worker 배포), expo-clipboard(선택 — 전달주소 복사).
- **신규 인프라:** workers/inbound-email/(레포 내 코드, CF 배포), CF Email Routing(사용자 DNS 이전).
- **신규 EF secret:** INGEST_SECRET(Worker↔EF 공유), (기존 ANTHROPIC_API_KEY 재사용).
- **신규 env(iOS):** EXPO_PUBLIC_FORWARDING_DOMAIN.
