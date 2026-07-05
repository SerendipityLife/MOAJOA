---
phase: 21
slug: travel-ledger
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-05
---

# Phase 21 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 5 PLAN files carried a `<threat_model>` block).
> Verification depth: ASVS L1 (grep/read of implementation) — block threshold: `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| iOS 클라(user JWT) → Postgres RLS | ledger SELECT/UPDATE/DELETE, forwarding SELECT/INSERT | 본인 소유 가계부 행, 전달 토큰 |
| 앱 클라 ↔ ledger INSERT | 앱은 INSERT 안 함 — INSERT 정책 부재 | (차단 대상) 가짜 결제 행 |
| 파이프라인 EF(service-role) → ledger INSERT/UPDATE | mail 파이프라인만 쓰는 유일 경로 | 메일 파생 결제 데이터 |
| 외부 메일 발신자 → CF Email Routing | SPF/DKIM 실패 거부(CF 인프라) | inbound 메일 envelope |
| CF Worker → inbound-email EF | x-ingest-secret 공유(verify_jwt=false 보완) | raw MIME + envelope meta |
| 메일 본문 → claude LLM | 프롬프트 인젝션 표면 | 신뢰 불가 메일 본문 |
| 플래너 세션 → DB | DDL 적용, 자격 유출 금지 | 마이그레이션/커넥션 문자열 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-21-01 | Info Disclosure | 0022 ledger SELECT RLS | high | mitigate | 미분류(trip_id NULL) 행은 `owner_user_id = auth.uid()` CASE 분기로 소유자만 열람 (0022 L119-125) | closed |
| T-21-02 | Tampering | 0022/0023 ledger UPDATE/DELETE RLS | high | mitigate | UPDATE/DELETE `owner_user_id = auth.uid()`; 0023이 WITH CHECK에 `can_read_trip(trip_id)` 추가로 타 trip 주입 차단 (0022 L129-136, 0023 L26-32) | closed |
| T-21-03 | Info Disclosure | 0022 forwarding_addresses SELECT RLS | medium | mitigate | 전달 주소 SELECT `user_id = auth.uid()` — 본인 토큰만 (0022 L63-65) | closed |
| T-21-04 | Elevation | 0022 SELECT CASE cross-table | medium | mitigate | 42P17 재귀 방지: 비-NULL 분기는 0016 `can_read_trip` SECURITY DEFINER 헬퍼 단일 호출; 직접 EXISTS 0건 (grep 확인) | closed |
| T-21-05 | Spoofing | 0022 ledger INSERT 정책 | high | mitigate | ledger_entries에 INSERT 정책 **부재** — RLS 활성 상태에서 authenticated INSERT 거부, service-role만 기록 (0022 L138-140) | closed |
| T-21-06 | Info Disclosure | 마이그레이션/세션 | high | mitigate | pooler/커넥션 문자열 세션 환경변수만, 커밋 금지 게이트 — 추적 파일에 커넥션 문자열 0건 (git grep 확인) | closed |
| T-21-07 | Tampering | core LedgerParseOutputSchema | medium | mitigate | LLM 파싱 출력 Zod 강제, `matched_trip_id`는 uuid 형식만; 교집합 방어는 EF(validateTripId)에 위치 (packages/core/…/ledger.ts L70-85) | closed |
| T-21-08 | Correctness | core deriveAmountKrw | low | mitigate | KRW는 파생값(`deriveAmountKrw` 순수함수), 원천은 5요소 FX 레코드 — amount_krw는 source 컬럼 아님 (ledger.ts L92-98) | closed |
| T-21-09 | Info Disclosure | api ledger 쿼리 | medium | mitigate | 클라 anon 키 + RLS만이 게이트, 래퍼에 redundant 클라 소유권 체크 0 — 0022 정책이 인가 (queries/ledger.ts) | closed |
| T-21-10 | Correctness | api ledger 쿼리 | low | mitigate | api 레이어에 환율/파생 로직 유입 없음 — 순수 CRUD (FX/KRW 파생은 EF·core 소유) | closed |
| T-21-11 | Tampering | parse-email pipeline/claude.ts | high | mitigate | 메일 프롬프트 인젝션 방어: `validateTripId`가 소유자 trip id 교집합만 유지 + Zod 강제 + `temperature: 0` (claude.ts L77, L183-186) | closed |
| T-21-12 | Info Disclosure | inbound-email EF | medium | mitigate | INGEST_SECRET 401 게이트가 토큰 조회보다 선행 — 미인증 prober 도달 불가; 미매칭은 202 `ignored` (index.ts L45-52, L169-175). **주의**: 매칭 경로는 200 반환(설계 문구는 "매칭/미매칭 모두 202") — 아래 노트 참조 | closed |
| T-21-13 | Spoofing | inbound-email EF | high | mitigate | `x-ingest-secret` 불일치 → 401 (index.ts L50-52); secret 미설정 → 500 | closed |
| T-21-14 | Spoofing | CF Email Routing / To 토큰 | high | transfer | 위조 발신 메일은 CF SPF/DKIM 수신 거부(인프라 통제) + 추측불가 To 토큰. **배포 시 CF Email Routing 규칙 확인 필요** | closed |
| T-21-15 | Info Disclosure | parse-email EF | medium | mitigate | 파싱 후 `raw_mime = null` + `raw_expires_at = null` (parse-then-drop); INSERT 시 7일 TTL (parse-email/index.ts L156-157, inbound L98) | closed |
| T-21-16 | DoS | inbound Worker | low | mitigate | `rawSize > 5MB` → `setReject` (스트림 읽기 전 차단) (worker index.ts L32, L37-40) | closed |
| T-21-17 | Info Disclosure | inbound Worker / EF secret | high | mitigate | Worker는 EF URL + INGEST secret만 보유(DB/LLM 키 없음); EF secret은 Supabase 관리, 커밋 0건 (worker index.ts L1-20, git grep 확인) | closed |
| T-21-18 | Info Disclosure | forwarding-address UI | low | mitigate | 토큰은 추측불가 base62(`gen_random_bytes(8)`, 0022 L44-49); 표시 전용. 유출 시 재발급 옵션은 후속(현재 미구현) | closed |
| T-21-19 | Correctness | ledger-row.tsx fx_source 배지 | low | mitigate | fx_source 3색 규칙 엄격: email→'실청구'(WR-01: 저장된 amount_krw 신뢰) / frankfurter→'추정 환율' / unavailable→'환율 확인 안 됨' (ledger-row.tsx L6-9, L74-77, L119-) | closed |
| T-21-20 | Elevation | 0023 RLS + ledger UI | medium | mitigate | 미분류 행 타 trip 배정은 서버 게이트(0023 UPDATE WITH CHECK `can_read_trip`)가 차단; UI는 RLS로 본인 행만 노출 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Notes / Defense-in-depth follow-ups (non-blocking)

- **T-21-12 (matched 경로 상태 코드):** 코드 주석은 "매칭/미매칭 모두 202-class"를 명시하나, 실제로 매칭 성공은 `jsonOk`(200, `entry_id` 포함), 미매칭은 `ignored`(202)를 반환한다. 이 차이는 **INGEST_SECRET 보유자(=Worker)에게만** 관측 가능하고, 실제 토큰 열거 벡터(`<token>@domain`으로 메일 발신)는 발신자에게 EF의 HTTP 상태를 노출하지 않으므로(Worker는 항상 void 반환) 위협은 401 게이트로 이미 차단된다. 다만 설계 문구와 일치시키려면 매칭 경로도 202-class로 통일하는 것이 방어심층상 바람직 — 후속 하드닝 권장.
- **T-21-14 / T-21-18 재발급:** CF SPF/DKIM 거부(T-21-14)와 전달 주소 재발급(T-21-18)은 각각 배포 시 CF Email Routing 설정 확인 / 후속 기능 구현이 필요한 항목. 현재 코어 완화(추측불가 토큰, 인프라 전가)는 존재하며 비차단.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*Accepted risks do not resurface in future audit runs.*

No accepted risks — all 20 threats mitigated or transferred.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-05 | 20 | 20 | 0 | gsd-secure-phase (L1 grep-depth, orchestrator short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-05
