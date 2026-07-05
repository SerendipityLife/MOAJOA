# Phase 21: Travel Ledger (메일 전달 가계부) - Research

**Researched:** 2026-07-05
**Domain:** Cloudflare Email Routing 인바운드 + Email Worker → Supabase EF + claude 메일 파싱 + 환율 원자 저장 + trip 매칭
**Confidence:** MEDIUM-HIGH (파이프라인·RLS·claude 호출은 codebase 실측 HIGH; CF Email Routing 인바운드 헤더·SPF/DKIM 노출·메일 실포맷은 문서/커뮤니티 경유 MEDIUM — DNS 이전 후 UAT가 유일한 최종 게이트)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 메일 수신 = **Cloudflare Email Routing + Email Worker.** Worker가 raw MIME을 `inbound-email` EF로 POST(공유 시크릿). SendGrid/Mailgun 기각.
- **D-02:** 사용자 식별 = **opaque To 토큰**(From 헤더 식별은 안티피처). SPF/DKIM은 CF 검증 결과를 게이트로. CF Email Routing catch-all/서브도메인 범위는 plan 리서치 대상.
- **D-03:** 메일 원문 = **최소 저장 + TTL.**
- **D-04:** 공유 = **trip 멤버 전원 열람**, 수정·삭제·확정은 행 소유자만. `can_read_trip` 헬퍼 경유. 미분류(trip_id NULL) 행은 본인-only.
- **D-05:** trip 매칭 = **AI 추정 + 미분류 인박스**(확신 시만 자동 배정, 애매하면 NULL → 1탭 배정).
- **D-06:** 환율 = **메일 명시값 우선(fx_source='email') + 결제일 기준 무료 API fallback.** 5요소 원자 저장, KRW 표시용 파생.
- **D-07:** 애매 항목 = **needs_review 상태로 1탭 확인·수정**(LEDGER-06).
- **D-08:** LLM = **claude-sonnet-4-6 재활용**, 파이프라인 = extract-youtube 미러(status/claim/async/extraction_costs).
- **D-09:** EF 분리 = `inbound-email`(수신·게이트·저장) + `parse-email`(LLM + 환율 + trip 매칭).

### Claude's Discretion
- ledger.tsx 화면 구성, 전달 주소 노출 위치·복사 UX·재발급, ledger 스키마 세부, Worker 레포 위치·배포, Worker↔EF 시크릿, 환율 API 선택·주말 처리, extraction_costs.provider 확장.

### Deferred Ideas (OUT OF SCOPE)
- 수동 지출 직접 추가, 정산 분할 계산, 영수증 사진 OCR, 웹 가계부 표면, SendGrid/Mailgun 전환.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEDGER-01 | 각 사용자에게 개인 전용 전달 주소가 발급된다 | `ensure_share_slug`/`ensure_poll_code` gen_random_bytes opaque 토큰 idiom 그대로 → `ingest_token`(profiles 또는 신규 forwarding_addresses). CF catch-all이 `{token}@ledger.moajoa.app` 전부를 단일 Worker로 라우팅 |
| LEDGER-02 | 예약 메일 전달 → AI가 플랫폼·카드·통화·금액·결제일 파싱 → 가계부 자동 정리 | claude-sonnet-4-6 + generate-plan claude.ts 호출 헬퍼(temperature 0, x-api-key, Zod .parse, fence-strip) verbatim 재활용. status/claim/async 파이프라인은 extract-youtube 미러 |
| LEDGER-03 | 외화 결제 통화·환율·결제 시점 원자 보존 | 5컬럼 원자 저장(amount_foreign, currency, fx_rate, fx_source, fx_as_of) + amount_krw generated/파생. Frankfurter API(무료·키 없음·KRW/JPY·historical /2026-07-01?from=JPY&to=KRW) fallback |
| LEDGER-04 | 앱 미경유 예약(직접 항공권 등)도 메일만 오면 포착 | 파이프라인이 trip/plan 참조 없이 메일만으로 ledger 행 생성 — trip_id는 D-05 AI 매칭(없으면 NULL) |
| LEDGER-05 | 등록 주소(To 토큰 매칭 + SPF/DKIM)에서 온 메일만 수신·처리 | CF Email Routing이 SPF/DKIM 실패 메일을 **수신 단계에서 거부**(2025-07-03부터 강제) → Worker 도달분은 이미 인증 통과. Worker가 To 토큰을 forwarding_addresses에서 조회, 미매칭 시 drop |
| LEDGER-06 | 파싱 애매 시 1탭 확인·수정 | needs_review 상태 + 미분류 인박스를 단일 확인 흐름으로. ledger.tsx 1탭 배정/수정 UX |
</phase_requirements>

## Summary

이 phase의 기술적 핵심 4가지를 조사했다. **(1) 인바운드 경로:** Cloudflare Email Routing은 **Email Worker**(`email(message, env, ctx)` 핸들러)로 수신 메일을 프로그램적으로 처리한다. `ForwardableEmailMessage`가 `from`/`to`/`headers`/`raw`(ReadableStream)/`rawSize`/`setReject()`/`forward()`를 노출하고, Worker 안에서 **`fetch()`로 외부(우리 Supabase EF)에 raw MIME을 POST**할 수 있다(외부 fetch 허용 확인). MIME 파싱은 **postal-mime**(`PostalMime.parse(message.raw)` — 브라우저/서버리스/Workers 공식 지원)으로 Worker 또는 EF에서 수행. **핵심 결정: 파싱을 EF에서 하되 Worker는 raw MIME + 봉투 메타(to/from/rawSize)만 전달** — Worker를 얇게 유지(레포 밖 인프라, CF 배포)하고 우리 로직·시크릿은 Supabase에 집중.

**(2) SPF/DKIM 게이트(LEDGER-05):** Cloudflare는 **2025-07-03부터 SPF 또는 DKIM 중 하나라도 통과하지 못한 인바운드 메일을 수신 단계에서 거부**한다(둘 다 실패 시 reject, DMARC 정책 실패 시도 reject). 즉 **Worker에 도달한 메일은 이미 SPF/DKIM 인증을 통과한 것** — 우리는 별도 검증 로직 없이 "CF가 통과시킨 메일만 처리"로 LEDGER-05의 인증 축을 충족한다. 식별 축(등록 주소만)은 **To 토큰 매칭**: 봉투 `to`의 local-part 토큰을 `forwarding_addresses`에서 조회, 없으면 Worker가 `setReject()` 또는 EF가 drop. (From 헤더는 스푸핑 가능하므로 식별에 미사용 — 안티피처.)

**(3) 파싱·환율:** `parse-email` EF는 generate-plan의 claude.ts 호출 헬퍼를 그대로 재활용(claude-sonnet-4-6, temperature 0, Zod 검증, fence-strip). 프롬프트만 "예약/결제 메일에서 플랫폼·카드 끝 4자리·통화·금액·결제일·(있으면)청구환율·원화환산액 추출"로 교체. **환율은 메일 명시값 우선** — 카드사 메일에 원화 청구액이 있으면 `fx_source='email'`로 저장(실청구액 = 진실). 없으면 **Frankfurter API**(무료·API키 없음·201통화 KRW 포함·`https://api.frankfurter.dev/v1/{결제일}?base=JPY&symbols=KRW` historical 지원)로 결제일 기준 보충, `fx_source='frankfurter'`. 5요소(amount_foreign·currency·fx_rate·fx_source·fx_as_of) **원자 저장**, KRW는 파생.

**(4) trip 매칭·RLS:** claude가 메일의 날짜·도시·상품명을 사용자의 trip 목록과 대조해 **확신 있을 때만** trip_id 배정, 애매하면 NULL(미분류). RLS는 `can_read_trip` 헬퍼 재사용하되 **trip_id NULL 케이스를 명시 처리** — NULL이면 `owner_user_id = auth.uid()`만(본인-only), 배정되면 멤버 공유. 이게 이 phase RLS 설계의 유일한 신규 난점.

**Primary recommendation:** 얇은 CF Email Worker(raw MIME + 봉투 메타를 시크릿 헤더로 EF POST) → `inbound-email` EF(`verify_jwt=false` + 공유 시크릿 검증 + To 토큰 매칭 + ledger_entries 행 저장 status='pending' + `parse-email` 트리거) → `parse-email` EF(postal-mime 파싱 + claude 추출 + Frankfurter fallback + AI trip 매칭 → status='ready'|'needs_review'). ledger.tsx는 book.tsx 상태머신 미러 + 미분류/needs_review 1탭 처리.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 인바운드 메일 수신 + SPF/DKIM 게이트 | Cloudflare Email Routing (인프라) | — | CF가 2025-07-03부터 인증 실패 메일 수신 거부 — 별도 로직 0 |
| raw MIME → EF 전달 | Cloudflare Email Worker (얇게) | — | 봉투 메타(to/from/rawSize) + raw body를 시크릿 헤더로 fetch POST. 우리 로직·시크릿 없음 |
| To 토큰 매칭 + 시크릿 검증 + 저장 | `inbound-email` EF | Postgres RLS(service role) | 등록 주소 조회 = 우리 DB. 미매칭 drop. verify_jwt=false + 자체 시크릿 |
| MIME 파싱 (본문 추출) | `parse-email` EF (postal-mime) | — | claude에 넘길 텍스트/HTML 정제. 첨부는 무시(영수증 OCR 안티피처) |
| 결제 정보 추출 (LLM) | `parse-email` EF (claude-sonnet-4-6) | — | generate-plan claude.ts 재활용. 프롬프트만 교체 |
| 환율 결정 | `parse-email` EF | Frankfurter API(fallback) | 메일 명시값 우선 판정은 LLM 출력, 없으면 결제일 historical fetch |
| trip 매칭 | `parse-email` EF (LLM) | — | 사용자 trip 목록 + 메일 날짜·도시 대조. 확신 없으면 NULL |
| 전달 주소 발급·토큰 | Database (forwarding token) + packages/api | — | ensure_share_slug idiom. profiles 확장 또는 신규 테이블 |
| ledger 데이터 | Database (ledger_entries) | packages/api 쿼리 래퍼 | trip-scoped(nullable) 영속. RLS = can_read_trip + NULL 본인-only 분기 |
| ledger UI + 미분류/수정 | iOS (ledger.tsx) | — | book.tsx 상태머신 미러. 웹 표면 deferred |
| 전달 주소 노출·복사 | iOS (me.tsx 또는 ledger 온보딩 카드) | — | Share.share idiom 또는 expo-clipboard 신규 |

## Standard Stack

**이 phase는 신규 런타임 의존이 최소다.** 파싱·환율·LLM 전부 fetch 또는 기설치 패키지.

### 신규 (설치·배포 필요)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| postal-mime | ^2.x (Worker/EF import) | raw MIME → 구조화(headers/text/html) | [VERIFIED: npm postal-mime, Cloudflare Workers 공식 가이드 존재] 서버리스/Deno 지원, `PostalMime.parse(raw)` |
| wrangler | latest (dev dep, Worker 배포용) | CF Email Worker 배포 | [CF 공식 CLI] 레포 밖 `workers/inbound-email/` 신설 |
| Frankfurter API | (외부 HTTP, 의존 0) | 환율 fallback | [VERIFIED: frankfurter.dev — 무료·키없음·KRW/JPY·historical] fetch만 |

### 재활용 (기설치 — 작업 없음)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | 2.110.0 (20-01서 bump 완료) | EF service role client | 기존 EF idiom |
| zod | npm:zod@3 (EF) / ^3.x (core) | 메일 파싱 출력 + ledger 스키마 | claude 출력 검증 + @moajoa/core |
| claude-sonnet-4-6 | (Anthropic API) | 메일 결제정보 추출 | generate-plan claude.ts verbatim |
| expo-clipboard | ~7.x (**신규 설치 검토**) | 전달 주소 복사 | codebase 선례 0 — Share.share 대안 존재. planner 판단 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CF Email Worker (raw → EF) | CF Email Routing 순수 forward → 별도 IMAP 폴링 | forward는 사람 받은편지함용, 프로그램 파싱 아님. Worker가 정석(공식 파싱 가이드) |
| 파싱을 EF에서 | 파싱을 Worker에서(postal-mime in Worker) | Worker서 파싱하면 claude 키·DB 접근이 CF에 노출. 얇은 Worker 원칙 위반 → EF 집중 |
| Frankfurter | exchangerate.host / open.er-api.com | Frankfurter는 ECB/중앙은행 소스·키없음·historical 명확. 대안은 키 필요 또는 신뢰도 낮음. **주말/공휴일 = 직전 영업일 rate 반환(ECB 특성)** — 결제일이 주말이면 가장 가까운 영업일값, 오차 수용 |
| ledger 신규 테이블 | plan_items류 확장 | 가계부는 plan과 무관(앱 미경유 예약 LEDGER-04) — 독립 테이블 필수 |
| To 토큰 서브도메인(@ledger.moajoa.app) | apex catch-all(@moajoa.app) | CF 서브도메인 라우팅은 지원되나 **catch-all은 zone(apex)만** — 서브도메인은 Worker로 처리. planner가 apex catch-all + Worker 분기 또는 서브도메인+Worker 중 실측 결정 |

**Installation:**
```bash
# 1. Worker (레포 밖 신설 workers/inbound-email/, wrangler로 배포 — 사용자 CF 계정)
#    npm i postal-mime (Worker 로컬 의존)
# 2. EF는 deno.json imports에 postal-mime 추가: "postal-mime": "npm:postal-mime@2"
# 3. iOS 전달주소 복사가 클립보드면: pnpm --filter @moajoa/ios add expo-clipboard (planner 판단)
```

## Package Legitimacy Audit

| Package | Signal | Verdict |
|---------|--------|---------|
| postal-mime | postalsys 유지(EmailEngine 벤더), CF 공식 Workers 가이드가 예시로 채택, 주간 다운로드 상당, TS 타입 내장 | 신뢰 — 인바운드 파싱 사실상 표준 |
| Frankfurter | 오픈소스·자가호스팅 가능·ECB 소스, 키 없음 | 신뢰 — 단 외부 무료 서비스 가용성 리스크 → self-host fallback 문서화 |
| wrangler | Cloudflare 공식 | 신뢰 |
| expo-clipboard | Expo 1st-party | 신뢰 (설치 시) |

## Architecture Patterns

### System Architecture Diagram

```
[사용자] 예약/카드 메일 전달
   │  To: {ingest_token}@ledger.moajoa.app (또는 apex)
   ▼
[Cloudflare Email Routing]  ── SPF/DKIM 실패 → 수신 거부 (LEDGER-05 인증축)
   │  통과분만
   ▼
[CF Email Worker]  email(message, env, ctx)
   │  fetch POST → Supabase, 헤더 X-Ingest-Secret: <shared>
   │  body: { to, from, rawSize, raw(base64 or text) }
   ▼
[inbound-email EF]  verify_jwt=false
   │  1. X-Ingest-Secret 검증 (미일치 → 401)
   │  2. To 토큰 파싱 → forwarding_addresses 조회 (미매칭 → 202 drop, LEDGER-05 식별축)
   │  3. ledger_entries INSERT status='pending', owner_user_id, raw 최소저장(TTL)
   │  4. parse-email 트리거 (fire-and-forget fetch, no await)
   ▼
[parse-email EF]  verify_jwt=false (자체 시크릿 or service-role only)
   │  atomic claim (status pending→processing)
   │  1. postal-mime parse → text/html/subject/date
   │  2. claude-sonnet-4-6 추출 (플랫폼/카드4자리/통화/금액/결제일/청구환율?/원화?)
   │  3. 환율: 메일 명시값 있으면 fx_source='email' / 없으면 Frankfurter(결제일)
   │  4. trip 매칭: 사용자 trip 목록 + 메일 날짜·도시 → 확신시 trip_id, else NULL
   │  5. status='ready'(확신) | 'needs_review'(애매) + extraction_costs 로깅
   ▼
[ledger_entries]  RLS: trip_id 있으면 can_read_trip / NULL이면 owner_user_id=auth.uid()
   ▼
[ledger.tsx]  목록 + 미분류 인박스 + needs_review 1탭 확인·수정
```

### 검증된 인바운드 사실 (2026-07-05 조사)
- **Email Worker API:** `export default { async email(message, env, ctx) {} }`. `message.raw`=ReadableStream, `message.to`/`message.from`=봉투 주소, `message.headers`=Headers, `message.rawSize`, `message.setReject(reason)`, `message.forward(addr)`. Worker 내 `fetch()` 외부 호출 가능.
- **SPF/DKIM(2025-07-03~):** SPF·DKIM 둘 다 실패 → CF 수신 거부. DMARC 정책 실패도 거부. → Worker 도달 = 인증 통과.
- **catch-all:** zone(apex) 레벨만 catch-all 룰 가능. 서브도메인은 Email Routing 활성화(CF가 DNS 자동 추가) 후 **Worker로 처리**(서브도메인 개별 catch-all 룰은 미지원, 2024-09 확인). → 토큰 주소 패턴은 Worker가 소유.
- **크기:** 인바운드 25 MiB 예시 한도. 대용량 메일 방어 필요.
- **postal-mime:** `PostalMime.parse(message.raw)` → `{ subject, from, to, date, text, html, attachments[] }`. 첨부는 ArrayBuffer(우리는 무시).

### 환율 API (Frankfurter, 2026-07-05)
- 무료·API키 없음·쿼터 없음(rate-limit만). 201통화(KRW·JPY 포함). ECB/84 중앙은행 소스.
- historical: `GET https://api.frankfurter.dev/v1/2026-07-01?base=JPY&symbols=KRW` → `{ "date": "...", "rates": { "KRW": 9.12 } }`.
- **주말/공휴일 = 직전 영업일 rate 반환**(ECB는 영업일만 고시). 응답 `date`가 실제 사용된 날짜 → `fx_as_of`에 응답 date 저장(요청일 아님).
- 가용성 리스크: 외부 무료 서비스 → 실패 시 fx_rate NULL + `fx_source='unavailable'` 저장(원통화만 표시), 앱은 "환율 확인 안 됨"으로 degrade. self-host(Docker) 옵션 문서화.

### Recommended Project Structure
```
workers/inbound-email/            ← 신규, 레포 밖 인프라(gitignore 아님 — 코드는 커밋, 시크릿은 CF)
  src/index.ts                    ← 얇은 Worker: raw + 봉투 → EF POST
  wrangler.toml                   ← route: *.ledger.moajoa.app 또는 apex catch-all
  package.json                    ← postal-mime는 여기 미사용(EF서 파싱)
supabase/functions/
  inbound-email/
    index.ts                      ← 시크릿 검증 + To 토큰 매칭 + 저장 + trigger
    deno.json                     ← extract-youtube 복사
  parse-email/
    index.ts                      ← claim + postal-mime + claude + 환율 + trip매칭
    pipeline/
      mail.ts                     ← postal-mime 파싱 + 정제
      claude.ts                   ← generate-plan claude.ts 미러(프롬프트 교체)
      fx.ts                       ← Frankfurter fetch (null-on-failure)
    deno.json
supabase/migrations/
  0022_ledger.sql                 ← forwarding_addresses + ledger_entries + RLS
packages/core/src/
  schemas/ledger.ts               ← LedgerEntrySchema + 상태/통화 enum + 파싱출력 스키마
  constants.ts                    ← (append) LedgerStatus, Currency, ledger Keys
packages/api/src/queries/
  ledger.ts                       ← listLedger/assignTrip/updateEntry/... house 계약
  forwarding.ts                   ← getOrCreateForwardingAddress
apps/ios/app/trip/[id]/(tabs)/
  ledger.tsx                      ← 스텁 교체
apps/ios/components/ledger/
  ledger-row.tsx                  ← ChecklistRow 미러
  ledger-entry-sheet.tsx          ← needs_review/미분류 1탭 수정 시트
config.toml                       ← [functions.inbound-email] verify_jwt=false / [functions.parse-email] verify_jwt=false
```

### Pattern 1: 얇은 Worker → EF (raw 전달, 시크릿 헤더)
```ts
// workers/inbound-email/src/index.ts
export default {
  async email(message, env, ctx) {
    if (message.rawSize > 5_000_000) { message.setReject('too large'); return; }
    const raw = await new Response(message.raw).text(); // 또는 arrayBuffer→base64
    await fetch(env.INBOUND_EF_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ingest-secret': env.INGEST_SECRET },
      body: JSON.stringify({ to: message.to, from: message.from, rawSize: message.rawSize, raw }),
    });
  },
};
```

### Pattern 2: inbound-email EF (시크릿 + To 토큰 게이트)
- extract-youtube 골격(Deno.serve + OPTIONS/POST + jsonError/jsonOk + service-role admin) 재활용.
- **차이:** auth.getUser 대신 `x-ingest-secret === Deno.env.get('INGEST_SECRET')` 검증(미일치 401). verify_jwt=false.
- To local-part에서 토큰 추출(`{token}@...` 정규식) → `admin.from('forwarding_addresses').select('user_id').eq('token', token).maybeSingle()` → 미매칭 202 drop(공격자에 존재여부 노출 최소, 항상 202).
- `ledger_entries` INSERT status='pending' + owner_user_id + raw_mime(최소저장, expires_at=now()+interval) → parse-email fire-and-forget 트리거.

### Pattern 3: parse-email 파이프라인 (claim + claude + fx + 매칭)
- extract-youtube atomic claim(단일 조건부 UPDATE, stale 재claim) 그대로: status pending→processing.
- postal-mime로 text/html 추출 → claude(temperature 0, Zod PlanLLMOutput 자리에 LedgerParseOutput).
- 환율: LLM이 `krw_amount`/`fx_rate`를 메일에서 뽑았으면 fx_source='email', 아니면 fx.ts Frankfurter.
- trip 매칭: LLM에 사용자 trip 목록(id/title/city/dates) 주입 → `matched_trip_id` 또는 null + confidence.
- extraction_costs 로깅(provider='anthropic' 재사용 — 새 provider 불필요, 단 frankfurter는 무료라 로깅 대상 아님).

### Pattern 4: RLS — trip_id NULL 분기 (이 phase 유일 신규 난점)
```sql
-- ledger_entries SELECT
create policy "ledger: read" on ledger_entries for select to authenticated using (
  case
    when trip_id is null then owner_user_id = auth.uid()        -- 미분류 = 본인만
    else can_read_trip(trip_id)                                 -- 배정됨 = 멤버 공유
  end
);
-- UPDATE/DELETE = 행 소유자만 (D-04)
create policy "ledger: owner writes" on ledger_entries for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
```
- can_read_trip은 DEFINER 헬퍼(42P17 가드 유지). CASE는 직접 cross-table EXISTS가 아니라 헬퍼 호출이라 안전.

### Anti-Patterns to Avoid
- **From 헤더로 사용자 식별** — 스푸핑 가능(안티피처). 오직 To 토큰.
- **Worker에 claude 키·DB 접근** — 얇은 Worker 원칙. 시크릿은 Supabase만.
- **메일 원문 영구 저장** — TTL/최소저장(D-03, Pitfall 3). 파싱 후 raw 폐기 또는 단기.
- **첨부(영수증) OCR** — 안티피처. text/html만.
- **KRW를 원천 저장** — amount_krw는 파생(fx_rate × amount_foreign). 원천은 원통화 5요소(Pitfall 5).
- **parse-email을 inbound에서 await** — 트리거는 fire-and-forget(응답 지연·타임아웃 방지).

## Don't Hand-Roll
| Need | Use | Not |
|------|-----|-----|
| MIME 파싱 | postal-mime | 정규식 수동 파싱 |
| SPF/DKIM 검증 | CF Email Routing(수신 거부) | Worker/EF서 직접 DKIM 서명 검증 |
| 환율 historical | Frankfurter API | 하드코딩·수동 테이블 |
| 토큰 생성 | gen_random_bytes(ensure_share_slug idiom) | Math.random |
| claude 호출 | generate-plan claude.ts | 새 LLM 클라이언트 |
| EF 골격 | extract-youtube(Deno.serve/cors/jsonError) | 처음부터 |

## Common Pitfalls

### Pitfall 1: To 토큰을 From/헤더로 식별
스푸핑 가능. **오직 봉투 To local-part 토큰** → forwarding_addresses 조회. From은 표시용(어느 카드사/플랫폼인지 힌트)일 뿐 인증 아님.

### Pitfall 2: SPF/DKIM을 Worker/EF서 재검증하려 함
CF가 이미 2025-07-03부터 인증 실패 메일을 수신 거부. Worker 도달 = 통과. **재구현은 불필요·오류원**. 단 "CF 통과 = 인증됨"을 SUMMARY에 명시(감사 추적).

### Pitfall 3: 메일 원문 영구 저장
개인정보(카드번호 일부·이름·예약내역). raw_mime은 파싱까지만 필요 → `expires_at` + 파싱 완료 후 NULL 처리 또는 짧은 TTL. 파싱 결과(금액·통화 등 구조화값)만 영속.

### Pitfall 4: 환율 3중 불일치 (리서치 Pitfall 5)
카드사 환율≠API 환율≠은행 고시. **메일 명시값(실청구액) 우선**, 5요소 원자 저장, fx_source로 출처 구분 표시. KRW 파생. 결제일 주말이면 Frankfurter가 직전 영업일값 → fx_as_of=응답date(요청일 아님).

### Pitfall 5: parse-email 동기 대기
inbound-email이 parse를 await하면 CF Worker→EF 응답이 LLM 시간만큼 지연(타임아웃·재시도 폭주). fire-and-forget 트리거 + status 폴링/realtime.

### Pitfall 6: trip 자동배정 오류
확신 없이 배정하면 A여행 메일이 B여행에 → 멤버에게 잘못 공유. **확신 임계값 높게**, 애매하면 NULL(미분류=본인만). 사용자 1탭 배정이 안전판.

### Pitfall 7: config.toml verify_jwt 누락
inbound-email/parse-email에 `[functions.X] verify_jwt=false` 안 넣으면 CF Worker의 무JWT POST가 401. 단 verify_jwt=false = 아무나 호출 가능 → **반드시 x-ingest-secret 자체 검증**으로 보완(Stripe webhook 패턴).

### Pitfall 8: CF Email Routing 미들이어 (DNS 미이전)
moajoa.app이 Vercel DNS면 CF Email Routing 불가 → **DNS를 CF 네임서버로 이전**(기존 Vercel 웹 레코드 CF에 복제하면 무중단). 사용자 측 [BLOCKING] 준비물. 미완료 시 end-to-end UAT 불가(코드는 완성 가능).

## Runtime State Inventory
| State | Where | Lifecycle |
|-------|-------|-----------|
| ingest_token | forwarding_addresses.token (또는 profiles) | 사용자당 1회 발급, 재발급 옵션 |
| raw_mime | ledger_entries.raw_mime | 최소저장 + TTL(파싱 후 폐기) |
| ledger status | ledger_entries.status (pending/processing/ready/needs_review/failed) | 파이프라인 상태머신 |
| fx 5요소 | ledger_entries (amount_foreign/currency/fx_rate/fx_source/fx_as_of) | 원자 저장, 불변 |
| trip_id | ledger_entries.trip_id (nullable) | AI 배정 or 1탭 배정 |

## State of the Art
- 인바운드 파싱 자동화 = Email Worker + postal-mime가 CF 생태계 정석(공식 가이드).
- SPF/DKIM 게이트를 인프라(CF)에 위임하는 것이 2025 표준(직접 검증 안티패턴).
- 환율 원자 저장(원통화+rate+source+asof)은 다통화 회계 정석(KRW 파생).

## Project Constraints (from CLAUDE.md)
- 마이그레이션 append-only, 0022부터. RLS DEFINER 헬퍼 경유(42P17). 외부 입력 Zod. 서비스롤 EF만. 워크스페이스 import `.js` 금지. 실값 env 배선(도메인·시크릿 하드코딩 금지). Web에 새 가계부 UI 추가 금지(iOS 전용).

## Assumptions Log
| # | Assumption | Confidence | Validation |
|---|-----------|-----------|------------|
| A1 | CF Email Worker가 fetch로 외부 EF POST 가능 | HIGH | CF 문서 + 커뮤니티 다수 선례. UAT서 실전송 |
| A2 | Worker 도달분 = SPF/DKIM 통과 (2025-07-03~) | HIGH | CF changelog. 단 "인증됨" 헤더를 EF가 직접 읽을지는 미확정 — CF 통과 자체를 게이트로 |
| A3 | 한국 카드사(예: 삼성·현대) 해외결제 알림 메일에 원화 청구액 명시 | MEDIUM | 사용자 실메일 UAT 필요 — 없으면 Frankfurter fallback이 커버 |
| A4 | Frankfurter가 결제일 JPY→KRW historical 제공 | HIGH | frankfurter.dev 문서. 주말=직전영업일 |
| A5 | 전달 시 원본 헤더(카드사 From) 보존됨 | MEDIUM | Gmail 전달은 원본 래핑 — postal-mime가 forwarded 본문 파싱. claude가 forwarded 구조 처리 |
| A6 | apex catch-all 또는 서브도메인+Worker로 토큰 라우팅 | MEDIUM | plan 단계 CF 대시보드 실측(사용자 DNS 이전 후) |

## Open Questions (RESOLVED / DEFERRED to plan)
- **[RESOLVED] 프로바이더** = Cloudflare Email Routing (D-01).
- **[RESOLVED] 공유 범위** = 멤버 열람 (D-04).
- **[RESOLVED] trip 매칭** = AI + 미분류 (D-05).
- **[RESOLVED] 환율 소스** = 메일 우선 + Frankfurter (D-06).
- **[PLAN 실측] catch-all vs 서브도메인** — CF 대시보드에서 토큰 라우팅 방식 확정(사용자 DNS 이전 후). apex catch-all이 기본, Worker가 토큰 소유.
- **[PLAN 실측] 전달 주소 저장 위치** — profiles 컬럼 vs 신규 forwarding_addresses 테이블(재발급·다중주소 대비 후자 권장).
- **[PLAN 실측] 전달 주소 복사** — expo-clipboard 신규 vs Share.share(선례).
- **[PLAN 실측] 한국 카드사 메일 실포맷** — 사용자 샘플 메일로 claude 프롬프트 튜닝(UAT).

## Environment Availability
- **Docker(로컬 supabase):** 이 Mac은 colima로 가용(메모리 `docker-runtime-on-this-mac.md`). 로컬 EF serve·마이그레이션 apply 가능.
- **Cloudflare 계정 + moajoa.app DNS 이전:** ✗ 아직 — 사용자 측 [BLOCKING] 준비물. Worker 배포·Email Routing 활성화 전제.
- **원격 Supabase(ref xfoauhsraguyrifingct):** 마이그레이션 적용 대상(0021까지 적용됨).

## Validation Architecture

### Test Framework
| Package | Framework | Command |
|---------|-----------|---------|
| packages/core | vitest | `pnpm --filter @moajoa/core test` |
| packages/api | vitest | `pnpm --filter @moajoa/api test` |
| apps/ios | jest(jest-expo) | `pnpm --filter @moajoa/ios test -- <file> --watchman=false` |
| EF(Deno) | deno test | `deno test --allow-net --allow-env` (functions/*/pipeline/*.test.ts) |
| Worker | (수동/wrangler dev) | UAT — CF 인프라 |

### Phase Requirements → Test Map
| Req | Test Type | Location |
|-----|-----------|----------|
| LEDGER-01 | unit(토큰 생성) + RLS 매트릭스 | 0022 psql + forwarding.test.ts |
| LEDGER-02 | deno unit(claude 파싱 스키마) + fixture 메일 | parse-email/pipeline/*.test.ts |
| LEDGER-03 | unit(환율 5요소 + KRW 파생) + fx.ts null-on-fail | core ledger.test.ts + fx.test.ts |
| LEDGER-04 | unit(trip 참조 없이 행 생성) | inbound-email 로직 + RLS |
| LEDGER-05 | RLS 매트릭스(토큰 매칭·미매칭 drop) + 시크릿 게이트 | 0022 psql + EF 시크릿 단언 |
| LEDGER-06 | RNTL(needs_review/미분류 1탭) | ledger.test.tsx |

### Sampling Rate
- task commit마다 `pnpm --filter <pkg> test`. wave마다 `pnpm -r test && pnpm -r typecheck`. EF는 deno test. Worker·end-to-end 메일은 Manual-Only.

### Wave 0 Gaps
- `packages/core/src/schemas/ledger.test.ts` — 파싱 출력·5요소 스키마(구현과 동시).
- `packages/api/src/queries/ledger.test.ts` — 쿼리 계약(RED 먼저).
- `supabase/functions/parse-email/pipeline/*.test.ts` — claude 스키마·fx null-on-fail(deno).

## Security Domain

### Applicable ASVS Categories
- V4 Access Control (RLS trip_id NULL 분기·행 소유자 write), V5 Validation (Zod 파싱출력·To 토큰 형식), V9 Communications (시크릿 헤더·TLS), V8 Data Protection (raw_mime TTL·최소저장), V13 API (verify_jwt=false + 자체 시크릿).

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 위조 메일로 타인 ledger 오염 | Spoofing | To 토큰(추측불가 base62) + SPF/DKIM(CF 거부). 토큰 미매칭 drop |
| inbound EF 무단 호출(가짜 결제 주입) | Spoofing | x-ingest-secret 검증(verify_jwt=false 보완). 미일치 401 |
| 메일 원문 유출 | Info Disclosure | raw_mime TTL·최소저장, RLS 본인/멤버 게이트, 서비스롤 EF만 파싱 |
| 미분류 행 타인 열람 | Info Disclosure | trip_id NULL → owner_user_id=auth.uid()만(멤버 공유는 배정 후) |
| 타인 명의 행 수정 | Tampering | UPDATE/DELETE = owner_user_id=auth.uid() with check |
| 프롬프트 인젝션(메일 본문이 LLM 조작) | Tampering | claude 출력 Zod 강제(스키마 밖 무시), temperature 0, trip_id는 사용자 trip 교집합만 배정(validatePlanIds idiom) |
| 42P17 재귀 | — | RLS는 DEFINER 헬퍼(can_read_trip) 경유, CASE 내 직접 EXISTS 0 |
| 서비스롤 노출 | Elevation | 서비스롤은 EF만. Worker엔 ingest_secret만(DB 접근 없음) |

## Sources

### Primary (HIGH — codebase 실측)
- **codebase:** supabase/functions/extract-youtube/index.ts(파이프라인·claim·cost·broadcast), generate-plan/pipeline/{claude.ts,routes.ts}, generate-plan/index.ts(can_edit_trip 동치·멱등 overwrite), supabase/migrations/0016(ensure_share_slug L158-182·extraction_costs L561-579·RLS 헬퍼)·0018(ensure_poll_code)·0021(booking 구조), config.toml(functions.verify_jwt·analytics), apps/ios/app/trip/[id]/(tabs)/{book.tsx,ledger.tsx}·me.tsx, components/booking/checklist-row.tsx, packages/api/queries/bookings.ts(+test), packages/core/src/{checklist.ts,constants.ts,schemas/date-poll.ts}, apps/ios/{app.config.ts,lib/supabase.ts,lib/share-board.ts,jest.config.js,__tests__/book.test.tsx}, ui-tokens/src/index.ts

### Secondary (MEDIUM — 공식 문서, WebSearch 요약 경유)
- developers.cloudflare.com/email-routing/email-workers — ForwardableEmailMessage(from/to/headers/raw/rawSize/setReject/forward/reply), 25MiB
- developers.cloudflare.com/email-routing/setup/subdomains — 서브도메인 활성화·룰(catch-all은 zone만)
- developers.cloudflare.com/changelog/2025-06-30-mail-authentication + /email-routing/postmaster — SPF/DKIM 강제(2025-07-03), 인증 실패 거부
- community.cloudflare.com(627105/664066/634156) — 서브도메인 catch-all 제약·Worker 우회
- postal-mime.postalsys.com/docs/guides/cloudflare-workers + npmjs postal-mime — PostalMime.parse(message.raw)
- frankfurter.dev — 무료·키없음·201통화(KRW/JPY)·historical·ECB 소스
- supabase.com/docs/guides/functions/function-configuration — per-function verify_jwt(config.toml), Stripe webhook 패턴

### Tertiary (LOW — UAT 게이트)
- 한국 카드사 해외결제 알림 메일 실포맷(원화 청구액 유무) — A3, 사용자 샘플
- Gmail 전달 시 원본 헤더 보존·forwarded 본문 구조 — A5
- apex catch-all vs 서브도메인 토큰 라우팅 실동작 — A6, CF 대시보드(DNS 이전 후)

## Metadata

**Confidence breakdown:**
- 파이프라인·RLS·claude 재활용: HIGH — codebase 직접 확인
- CF Email Worker API·fetch·SPF/DKIM 게이트: HIGH — 공식 문서 + 다수 선례
- 환율 Frankfurter: HIGH — 문서 확인, 주말 직전영업일 특성 포함
- 한국 카드사 메일 실포맷·전달 헤더: LOW — 사용자 UAT가 유일 게이트(claude 프롬프트 튜닝)
- catch-all/서브도메인 토큰 라우팅: MEDIUM — DNS 이전 후 CF 실측

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (CF Email Routing·postal-mime·Frankfurter API 30일 내 안정 예상; 한국 카드사 메일 포맷은 사용자 샘플이 항상 우선)
