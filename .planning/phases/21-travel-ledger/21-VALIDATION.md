---
phase: 21
slug: travel-ledger
status: signed
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-05
signed_at: 2026-07-05
---

# Phase 21 — Validation Strategy

> phase별 검증 계약. 실행 중 feedback 샘플링.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (packages/core, packages/api) / jest 29.x jest-expo (apps/ios, `--watchman=false`) / deno test (supabase/functions) |
| **Config file** | per-package (core/api vitest; ios jest.config; EF deno.json) |
| **Quick run** | `pnpm --filter <pkg> test` / `deno test --allow-net --allow-env` (EF) |
| **Full suite** | `pnpm -r test && pnpm -r typecheck` (+ EF deno test 별도) |
| **Estimated runtime** | ~75초 (+ EF ~20초) |

---

## Sampling Rate

- **task commit마다:** `pnpm --filter <pkg> test` 또는 `deno test`(EF)
- **wave마다:** `pnpm -r test && pnpm -r typecheck`
- **`/gsd-verify-work` 전:** 풀스위트 green
- **Max feedback latency:** 90초

---

## Per-Task Verification Map

| Task | Plan | Wave | Req | Threat | Secure Behavior | Test Type | Command | File | Status |
|------|------|------|-----|--------|-----------------|-----------|---------|------|--------|
| 01-T1 | 21-01 | 1 | LEDGER-01/03/04/05 | T-21-04 | 헬퍼-only RLS·CASE·append-only·plan FK 0 | grep gates | `grep -c "create policy" 0022` 등 | ❌ 신설 | ⬜ pending |
| 01-T3 | 21-01 | 1 | LEDGER-05/06 | T-21-01/02/03/05 | RLS 매트릭스 A~H(미분류 본인·배정 멤버·행소유자 write·앱 INSERT 거부) | integration(pg, BEGIN…ROLLBACK) | node pg / psql | ❌ 로컬 colima or pooler | ⬜ pending |
| 02-T1 | 21-02 | 2 | LEDGER-02/03/06 | T-21-07/08 | 5요소 스키마·파싱출력·KRW 파생 분리 | unit | `pnpm --filter @moajoa/core test -- ledger` | ❌ ledger.test.ts 신설(Wave 0) | ⬜ pending |
| 03-T1 | 21-03 | 2 | LEDGER-01/05/06 | T-21-09/10 | 계약 RED·파생/파싱 api 금지 | unit(TDD RED) | `pnpm --filter @moajoa/api test -- ledger` | ❌ ledger.test.ts 신설(Wave 0) | ⬜ pending |
| 03-T2 | 21-03 | 2 | LEDGER-01/06 | T-21-10 | client-first {error} throw·RLS-only·CRUD만 | unit(GREEN) | `pnpm --filter @moajoa/api test -- ledger` | ❌ 신설 | ⬜ pending |
| 04-T1 | 21-04 | 3 | LEDGER-02/03 | T-21-11 | claude 재활용·환율 null-on-fail·trip 환각 방어 | deno unit | `deno test pipeline/` | ❌ pipeline 3 test 신설(Wave 0) | ⬜ pending |
| 04-T2 | 21-04 | 3 | LEDGER-05 | T-21-12/13 | 시크릿 게이트·To토큰 매칭·미매칭 drop·fire-forget | deno check + grep | `deno check` + `grep x-ingest-secret` | ❌ 신설 | ⬜ pending |
| 04-T3 | 21-04 | 3 | LEDGER-02/04 | T-21-15 | atomic claim·confidence 분기·raw 폐기·환각 방어 | deno check + grep | `deno check` + grep gates | ❌ 신설 | ⬜ pending |
| 04-T4 | 21-04 | 3 | LEDGER-05 | T-21-16/17 | 얇은 Worker(DB/LLM 0)·크기 가드 | 코드 리뷰 + grep | `grep -cE "ANTHROPIC\|service_role" =0` | ❌ 신설 | ⬜ pending |
| 05-T1 | 21-05 | 4 | LEDGER-03 | T-21-19 | 환율 출처 3색·onPress-only(로직 격리) | unit(RNTL) | `… test -- ledger-row --watchman=false` | ❌ 신설 | ⬜ pending |
| 05-T2 | 21-05 | 4 | LEDGER-06 | — | 상태머신 4분기·미분류/needs_review 흐름 | unit(RNTL) | `… test -- ledger --watchman=false` | ❌ ledger.test.tsx 신설(Wave 0) | ⬜ pending |
| 05-T3 | 21-05 | 4 | LEDGER-01 | T-21-18 | 전달주소 발급·복사·도메인 env | unit + typecheck | `grep forwardingDomain` + typecheck | ✅ me.tsx 확장 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/schemas/ledger.test.ts` — LEDGER-02/03 스키마·5요소·KRW 파생 (21-02 Task 1 동시)
- [ ] `packages/api/src/queries/ledger.test.ts` — LEDGER-01/06 쿼리 계약 (21-03 Task 1 RED 먼저)
- [ ] `supabase/functions/parse-email/pipeline/{mail,claude,fx}.test.ts` — LEDGER-02/03 파싱·환율 (21-04 Task 1, deno)
- [ ] `apps/ios/__tests__/ledger.test.tsx` — LEDGER-06 상태별 (21-05 Task 4)
- 프레임워크 설치 불필요 (vitest/jest/deno 기설치·기동작; postal-mime는 deno.json import)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| end-to-end 메일 수신·파싱 | LEDGER-02/04/05 | CF Email Routing 인프라 + DNS 이전 + 실메일 필요 | `{token}@{도메인}`로 예약 메일 전달 → ledger_entries 행 생성 + ready/needs_review 전이 확인 |
| SPF/DKIM 게이트 실동작 | LEDGER-05 | 위조 메일 발송 필요(CF가 거부) | 인증 실패 메일 전달 → CF 수신 거부(Worker 미도달) 확인 |
| 한국 카드사 메일 파싱 정확도 | LEDGER-02 | 실제 카드사 메일 포맷(RESEARCH A3) | 삼성·현대 등 해외결제 알림 → 플랫폼/카드4/통화/금액/결제일 정확 추출; 오파싱 시 프롬프트 튜닝 |
| 환율 출처 email vs frankfurter | LEDGER-03 | 실메일에 원화 청구액 유무에 따라 분기 | 원화 청구 메일→'실청구' 배지 / 없는 메일→'추정 환율' + 결제일 rate |
| 미분류→배정→멤버 공유 | LEDGER-06 | 실 DB round-trip + 2 멤버 | 미분류 1탭 배정 → 다른 멤버 기기서 공유 확인 |
| catch-all vs 서브도메인 라우팅 | LEDGER-01/05 | CF 대시보드 실측(DNS 이전 후, A6) | apex catch-all 또는 서브도메인 토큰 라우팅 동작 확정 → EXPO_PUBLIC_FORWARDING_DOMAIN 확정 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 / Manual-Only 분류
- [x] Sampling continuity: 3 연속 자동검증 공백 없음
- [x] Wave 0가 MISSING 참조 전부 커버
- [x] No watch-mode flags (ios `--watchman=false`)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true`

**Approval:** approved 2026-07-05
