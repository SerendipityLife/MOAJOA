---
phase: 21-travel-ledger
plan: 04
subsystem: "inbound-email-pipeline"
status: complete
tags: [ledger, email, edge-function, cloudflare-worker, claude, frankfurter, fx]
requires:
  - "21-01: 0022 applied — ledger_entries + forwarding_addresses live"
  - "21-02: @moajoa/core ledger contract (LedgerParseOutputSchema mirrored locally in Deno)"
provides:
  - "workers/inbound-email/ (thin CF Email Worker)"
  - "supabase/functions/inbound-email/ (secret + To-token gate + store + fire-forget trigger)"
  - "supabase/functions/parse-email/ (claim + postal-mime + claude + FX + trip match)"
  - "supabase/functions/parse-email/pipeline/{mail,claude,fx}.ts + deno tests"
  - "config.toml: inbound-email/parse-email verify_jwt=false"
affects:
  - "21-05 (iOS): consumes ledger_entries rows this pipeline writes"
  - "Task 5 (human-action): CF infra deploy + DNS transfer unblocks end-to-end mail UAT"
tech-stack:
  added:
    - "npm:postal-mime@2 (MIME parse in parse-email EF)"
    - "Frankfurter API (https://api.frankfurter.dev — keyless historical FX, KRW)"
    - "Cloudflare Email Worker (workers/inbound-email — repo code, CF-deployed)"
  patterns:
    - "generate-plan/pipeline/claude.ts verbatim mirror — claude-sonnet-4-6, temperature 0, fence-strip, Zod, stop_reason max_tokens throw, usage ?? 0"
    - "routes.ts null-on-failure idiom → fx.ts (try/catch→null, !ok→null, optional chaining)"
    - "validatePlanIds idiom → validateTripId (owner-trip intersection, T-21-11 injection defense)"
    - "extract-youtube atomic claim (.in('status',[...])→processing) + service-role admin + catch→failed"
    - "shared x-ingest-secret gate (verify_jwt=false compensation, Pitfall 7) — NOT auth.getUser"
    - "fire-and-forget parse trigger (no await, .catch) — Pitfall 5"
key-files:
  created:
    - "supabase/functions/parse-email/pipeline/mail.ts"
    - "supabase/functions/parse-email/pipeline/claude.ts"
    - "supabase/functions/parse-email/pipeline/fx.ts"
    - "supabase/functions/parse-email/pipeline/mail.test.ts"
    - "supabase/functions/parse-email/pipeline/claude.test.ts"
    - "supabase/functions/parse-email/pipeline/fx.test.ts"
    - "supabase/functions/parse-email/index.ts"
    - "supabase/functions/parse-email/deno.json"
    - "supabase/functions/inbound-email/index.ts"
    - "supabase/functions/inbound-email/deno.json"
    - "workers/inbound-email/src/index.ts"
    - "workers/inbound-email/wrangler.toml"
    - "workers/inbound-email/package.json"
  modified:
    - "supabase/config.toml"
decisions:
  - "resolveFx signature takes amountForeign (5 args: currency, paidDate, amountForeign, mailKrw, mailRate). The plan listed a 4-arg call in Task 3 but the Task 1 body needs amountForeign to derive amount_krw (frankfurter path) and to back-compute fx_rate from mailKrw. Minor signature clarification — documented as deviation."
  - "parse-email loads owner trips + accepted-member trips (loadOwnerTrips) for match candidates — mirrors can_read_trip semantics under service-role; plan allowed owner-only as a floor."
  - "KRW currency short-circuits to fx_rate=1, fx_source='email' with no fetch (amount already in KRW)."
  - "raw_expires_at is also nulled alongside raw_mime after parse (raw dropped, TTL no longer needed) — D-03."
metrics:
  duration: "~15m"
  completed: "2026-07-05"
  tasks: 4
  files: 14
---

# Phase 21 Plan 04: Inbound Email Pipeline Summary

전달 메일 → 가계부 자동 입력 파이프라인 전 구간 구현. 얇은 CF Email Worker(raw+봉투 → EF POST)가 `inbound-email` EF(x-ingest-secret 게이트 + To 토큰 매칭 + `ledger_entries` status='pending' 저장 + parse-email fire-and-forget 트리거)로 넘기고, `parse-email` EF(atomic claim + postal-mime + claude-sonnet-4-6 결제정보 추출 + Frankfurter 환율 fallback + trip 매칭 → ready/needs_review)가 마무리. generate-plan의 claude.ts/routes.ts idiom을 재활용해 신규 LLM 도입 0. **코드·테스트 완료(deno test 21 green, 양 EF deno check clean); CF 인프라 배포(Task 5)는 사용자 대기.**

## What Was Built

### Task 1 — parse-email pipeline (mail/claude/fx) + deno 테스트 [a07f118]
- **mail.ts:** `parseMime(raw)` — `PostalMime.parse` → subject/from/text/html/date. text 우선, HTML-only면 `stripHtml` fallback. forwarded 래핑은 정제 없이 claude로.
- **claude.ts:** generate-plan claude.ts **verbatim 미러** — `LEDGER_MODEL='claude-sonnet-4-6'`, anthropic fetch(x-api-key, anthropic-version 2023-06-01, temperature 0, max_tokens 2048), `stop_reason==='max_tokens'` throw, usage `?? 0`, fence-strip. **교체:** SYSTEM_PROMPT(예약/카드 결제 추출), `buildLedgerPrompt(mail, trips)` export, `LedgerParseOutput` zod(@moajoa/core `LedgerParseOutputSchema` 로컬 미러), `parseLedgerOutput`, `validateTripId`(교집합만 — T-21-11 프롬프트 인젝션 방어).
- **fx.ts:** `resolveFx` — 메일값 우선(fx_source='email') → Frankfurter(결제일, **fx_as_of=응답 date**, fx_source='frankfurter') → 실패 unavailable. routes.ts null-on-failure idiom. KRW 통화는 fetch 없이 rate=1.
- **테스트:** 21 케이스 green (mail 3 / claude 11 / fx 7). Frankfurter fetch는 globalThis.fetch stub.

### Task 2 — inbound-email EF [ef91f2b]
- x-ingest-secret 검증(미일치 401 / 미설정 500), **auth.getUser 아님**(시크릿 게이트, T-21-13).
- Zod `{to, from, rawSize, raw}`. To local-part(+서브어드레싱 strip) → `forwarding_addresses` 조회. **미매칭/에러 → 202 ignored**(존재여부 미노출, T-21-12).
- 매칭 → `ledger_entries` INSERT status='pending' + raw_mime + 7d raw_expires_at(D-03).
- parse-email **fire-and-forget** 트리거(no await, `.catch`) — PARSE_EMAIL_URL 미설정 시 조용히 skip(로컬).
- **config.toml:** `[functions.inbound-email]` + `[functions.parse-email]` verify_jwt=false(extract-youtube 블록 무수정).

### Task 3 — parse-email EF index [17e8054]
- 시크릿 게이트 + Zod `{entry_id uuid}`.
- **atomic claim:** `update status='processing' where id=? and status in ('pending','failed')` → 0행이면 409.
- `parseMime` → `loadOwnerTrips`(owner + accepted-member) → `callClaudeLedger` → `validateTripId` → `resolveFx`.
- status = `confidence==='high' && amount_foreign && currency ? 'ready' : 'needs_review'`.
- UPDATE: 5요소 FX + amount_krw + platform/merchant/card_last4/paid_at + trip_id + **raw_mime=null**(파싱 후 폐기, D-03). Anthropic cost 로깅(link_id null, frankfurter 무료 미로깅). 에러 → status='failed'.

### Task 4 — CF Email Worker [519b1b1]
- `export default { async email(message, env) }` — rawSize>5MB `setReject`(T-21-16), `new Response(message.raw).text()` → `fetch(env.INBOUND_EF_URL, x-ingest-secret)`.
- **DB/LLM 시크릿 0** — INBOUND_EF_URL + INGEST_SECRET만(T-21-17). wrangler.toml(Email 트리거는 CF 대시보드) + 최소 package.json.

## Verification

- `deno test --allow-net --allow-env pipeline/` → **21 passed / 0 failed**
- `deno check` parse-email/index.ts → clean
- `deno check` inbound-email/index.ts → clean
- Acceptance grep 전부 통과:
  - claude.ts `claude-sonnet-4-6`≥1, `temperature: 0`≥1 · fx.ts `frankfurter`≥1, `.date`≥1
  - inbound `x-ingest-secret`=6(≥2), `auth.getUser`=0, `forwarding_addresses`=2, `await fetch(...parse)`=0
  - config `verify_jwt = false`=2
  - parse-email `.in('status'`=1, `needs_review`=2, `raw_mime: null`=1, `validateTripId`=3
  - Worker `async email`=1, `x-ingest-secret`=1, LLM/DB 시크릿=0

## Deviations from Plan

**1. [Rule 3 - Blocking] resolveFx 시그니처에 amountForeign 추가**
- **발견:** Task 1. 플랜 Task 3은 `resolveFx(out.currency, out.paid_at, out.krw_amount, out.fx_rate)` 4인자로 호출하나, Task 1 본문은 amount_krw 파생(frankfurter: `round(amount*rate)`)과 fx_rate 역산(`mailKrw/amountForeign`)에 amountForeign이 필요.
- **수정:** 시그니처를 `resolveFx(currency, paidDate, amountForeign, mailKrw, mailRate)` 5인자로 확정, index.ts 호출을 `out.amount_foreign` 포함해 배선.
- **파일:** parse-email/pipeline/fx.ts, parse-email/index.ts — **커밋:** a07f118 / 17e8054

그 외 플랜대로 실행.

## Task 5 — PENDING (checkpoint:human-action, gate=blocking)

**코드는 배포 준비 완료. 남은 것은 사용자 계정에서의 CF 인프라 배포뿐.** Claude는 배포/시크릿 생성 미수행(secret 값 어떤 파일에도 미기록, deploy 명령 미실행). 사용자 수행 절차(플랜 원문 재현):

1. **DNS 이전:** `moajoa.app` DNS를 Cloudflare 네임서버로 이전(기존 Vercel 웹 레코드를 CF에 복제 → 무중단).
2. **Email Routing:** CF 대시보드 Email Routing 활성화 → catch-all(apex `@moajoa.app`) 또는 서브도메인(`ledger.moajoa.app`) 룰을 `moajoa-inbound-email` Worker에 지정. **catch-all은 zone(apex)만 지원 — 서브도메인은 Worker가 처리**(RESEARCH A6). 실측 후 `EXPO_PUBLIC_FORWARDING_DOMAIN` 확정.
3. **INGEST_SECRET 생성 + 양쪽 동일값 배선:**
   - 랜덤값 생성(예: `openssl rand -hex 32`)
   - `wrangler secret put INGEST_SECRET` (Worker)
   - `supabase secrets set INGEST_SECRET=<same value>` (EF)
   - Worker `[vars] INBOUND_EF_URL = "https://<ref>.supabase.co/functions/v1/inbound-email"`
   - EF `supabase secrets set PARSE_EMAIL_URL=https://<ref>.supabase.co/functions/v1/parse-email` (ANTHROPIC_API_KEY는 기존값 재사용)
4. **배포:** `supabase functions deploy inbound-email parse-email` (verify_jwt=false는 config.toml 반영) → `wrangler deploy`(Worker, `workers/inbound-email/`).
5. **스모크:** 본인 예약/카드 메일 1건을 `{token}@{forwardingDomain}`로 전달 → `ledger_entries` 행 생성 확인 + parse-email이 ready/needs_review로 전이 확인.

**결정 필요:** "CF 배포·스모크 완료"(전체 실행) 또는 "코드만 커밋(인프라 후속)"(end-to-end UAT를 phase verify로 이관).

## Known Stubs

None — 파이프라인 코드는 모두 실배선(env var 참조, 하드코딩 시크릿/URL 0). 미완은 인프라 배포(Task 5)뿐.

## Self-Check: PASSED

- 13개 생성 파일 전부 디스크 존재 확인
- 커밋 a07f118 / ef91f2b / 17e8054 / 519b1b1 git log 존재 확인
