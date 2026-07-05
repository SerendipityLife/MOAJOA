# Phase 21: Travel Ledger (메일 전달 가계부) - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

각 사용자에게 **개인 전용 전달 주소(opaque To 토큰)**가 발급되고, 예약 메일을 그 주소로 전달하면 **AI가 파싱해 가계부에 자동 정리**한다. 외화 결제의 **통화·환율·결제 시점이 원자적으로 보존**되고, 앱을 거치지 않은 예약(직접 예약 항공권 등)도 메일만 오면 포착되며, **파싱이 애매하면 1탭으로 확인·수정**한다. (LEDGER-01~06)

**In scope:** 전용 전달주소 발급(토큰 생성·노출 UI) · Cloudflare Email Routing + Email Worker 수신 경로(raw MIME → Supabase EF) · To 토큰 매칭 + SPF/DKIM 검증 게이트 · `parse-email` AI 파싱(플랫폼·카드·통화·금액·결제일, claude 재활용) · ledger 마이그레이션 + RLS(멤버 공유 열람) · 환율 5요소 원자 저장(메일 명시값 우선 + API fallback) · trip 자동 매칭 + 미분류 인박스 · ledger.tsx 탭(목록 + 1탭 확인·수정 fallback UI).

**Out of scope:** 수동 지출 직접 추가(메일 없이 — 요구사항 밖, deferred) · 정산 분할 계산(누가 얼마 — 후속) · 영수증 사진 업로드(안티피처, 리서치) · From 헤더 사용자 식별(안티피처) · 예산 트래킹·카테고리 자동분류 · 웹(apps/web) 가계부 표면(iOS 전용 시작).

**⚠️ 외부 준비물 (사용자 측, 리드타임 있음 — 조기 착수):** moajoa.app DNS를 Cloudflare 네임서버로 이전(기존 웹 배포 레코드 그대로 옮기면 무중단) + Email Routing 활성화. Cloudflare 계정 필요. 이 인프라가 열려야 end-to-end UAT 가능 — plan 단계에서 [BLOCKING] 체크포인트로 배치.

</domain>

<decisions>
## Implementation Decisions

### 메일 수신 인프라 (Area 1)
- **D-01:** 프로바이더 = **Cloudflare Email Routing + Email Worker.** 무료·수신량 제한 사실상 없음. Email Worker가 raw MIME을 Supabase `inbound-email` EF로 POST(공유 시크릿 헤더로 EF 보호). 리서치 STACK안 채택 — SendGrid Inbound Parse(무료 티어 정책 리스크)·Mailgun/Postmark(유료) 기각. catch-all 서브도메인 → To 토큰 매칭 패턴은 프로바이더 무관 동일.
- **D-02:** 사용자 식별 = **opaque To 토큰**(리서치 선잠금 — From 헤더 식별은 안티피처). SPF/DKIM은 Cloudflare가 검증한 결과(Authentication-Results)를 게이트로 사용, 실패 메일은 처리 거부(LEDGER-05). ⚠️ planner 주의: **Cloudflare Email Routing의 catch-all 적용 범위 실측 필요** — apex(@moajoa.app) catch-all이 기본; 전용 서브도메인(@ledger.moajoa.app) 라우팅 지원 여부는 plan 단계 리서치로 확정(미지원이면 apex catch-all + 토큰 주소로 진행).
- **D-03:** 메일 원문은 **최소 저장 + TTL**(Pitfall 3 선잠금). 파싱에 필요한 기간만 보존, 세부 정책(즉시 폐기 vs 단기 보존)은 planner 재량.

### 가계부 데이터·공유 (Area 2)
- **D-04:** 공유 범위 = **trip 멤버 전원 열람.** 항목 수정·삭제·확정은 전달한 본인(행 소유자)만. v2.0 컨셉(발견→예약→정산 풀 루프)의 '정산' 전제 — 멤버가 같이 봐야 성립. RLS는 기존 `can_read_trip` 헬퍼 경유(deny-by-default, DEFINER 헬퍼 idiom 유지).
- **D-05:** trip 매칭 = **AI 추정 + 미분류 인박스.** 파서가 메일의 날짜·도시·상품명으로 사용자의 trip에 **확신 있을 때만** 자동 배정, 애매하면 미분류(trip_id NULL)로 남기고 가계부 탭에서 **1탭 배정.** LEDGER-06(1탭 수정)과 같은 UX 흐름 하나로 처리. ⚠️ 미분류 행은 본인만 열람(멤버 공유는 trip 배정 후) — RLS 설계에 반영.
- **D-06:** 환율 소스 = **메일 명시값 우선 + API fallback.** 카드사·플랫폼 메일에 청구 환율/원화 환산액이 있으면 그 값이 진실(fx_source='email' — 실제 청구액과 일치). 없을 때만 **결제일 기준** 무료 환율 API로 보충(구체 API는 plan 단계 실측). 5요소(원통화 금액 + 통화코드 + fx_rate + fx_source + fx_as_of) **원자 저장**, KRW는 표시용 파생값(Pitfall 5 선잠금).
- **D-07:** 파싱 결과 상태 = 확신 항목은 바로 정리, 애매 항목은 **needs_review 상태로 1탭 확인·수정**(LEDGER-06). 애매 판정 기준(confidence 경계)은 planner 재량.

### 파싱 파이프라인 (Area 3 — 리서치 선잠금 재확인)
- **D-08:** LLM = **claude-sonnet-4-6 재활용**(extract-youtube·generate-plan 패턴 그대로, 별도 LLM 도입 X). 파이프라인 구조 = 추출 파이프라인 미러(status column + claim + async + `extraction_costs` 로깅).
- **D-09:** EF 분리 = `inbound-email`(수신·To 토큰 매칭·SPF/DKIM 게이트·저장) + `parse-email`(LLM 파싱 + 환율 + trip 매칭) — ROADMAP 추정 구조. 합치거나 나누는 세부는 planner 재량(D-01의 Worker→EF 경계는 유지).

### Claude's Discretion
- ledger.tsx 화면 구성(목록·합계·통화별 표시·미분류 인박스 UI·needs_review 1탭 수정 UX 구체안) — UI-SPEC 단계에서.
- 전달 주소 노출 위치(me 탭 vs ledger 탭 온보딩 카드)와 복사 UX, 토큰 재발급 흐름 필요 여부.
- ledger 스키마 세부(테이블명·컬럼·미분류 nullable trip_id 처리) — 마이그레이션은 **0022부터** append-only.
- Cloudflare Worker 코드의 레포 내 위치(예: `workers/`)와 배포 방식(wrangler).
- Worker↔EF 공유 시크릿 인증 세부 + `verify_jwt = false` 처리(외부 호출 EF).
- 환율 API 선택(frankfurter/ECB 등 무료 소스 실측)과 주말·공휴일 결제일 처리.
- extraction_costs.provider CHECK 가산 확장 필요 여부(0017 선례).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항·로드맵
- `.planning/ROADMAP.md` §"Phase 21: Travel Ledger" — goal, 성공기준 6개, plans 추정(~4)
- `.planning/REQUIREMENTS.md` — LEDGER-01(전용 주소), LEDGER-02(AI 파싱), LEDGER-03(환율 보존), LEDGER-04(미경유 예약 포착), LEDGER-05(식별·보안), LEDGER-06(1탭 fallback)

### 사전 리서치 (프로바이더 충돌은 D-01로 해소됨)
- `.planning/research/SUMMARY.md` §5 — 인바운드 프로바이더 충돌 원문(STACK=Cloudflare vs ARCHITECTURE·PITFALLS=SendGrid) + Research Flags(Phase E deeper research: 전달 포맷 + 환율)
- `.planning/research/PITFALLS.md` — Pitfall 3(To 토큰·SPF/DKIM·본문 최소저장/TTL), Pitfall 5(환율 3중 불일치 → 5요소 원자 저장)
- `.planning/research/STACK.md` — Cloudflare Email Routing + Worker + postal-mime 패턴

### 식별자 계약 (Phase 17에서 락 — 재논의 금지)
- `.planning/phases/17-trip-foundation-ia/17-CONTEXT.md` — ledger 행이 trip_id 보유(SubID/식별자 계약). D-05의 미분류(NULL)는 "배정 전 상태"이지 계약 위반 아님 — 배정 시 trip_id 연결.

### 재활용 코드 (파이프라인 미러 대상)
- `supabase/functions/extract-youtube/` — status column + claim + async 파이프라인 + `extraction_costs` 로깅 원형
- `supabase/functions/generate-plan/claude.ts` — claude-sonnet-4-6 호출 + Zod 검증 + temperature 0 패턴 (18-03)
- `supabase/migrations/0016_trips_baseline.sql` — `ensure_share_slug`(gen_random_bytes opaque 토큰 idiom — 전달주소 토큰 생성 참고), RLS DEFINER 헬퍼(can_read_trip 등), `extraction_costs`
- `supabase/migrations/0021_booking.sql` — 최신 번호(이번 phase는 **0022부터**)

### 클라이언트 통합 지점
- `apps/ios/app/trip/[id]/(tabs)/ledger.tsx` — 17-04 neutral 스텁("곧 제공돼요") → 가계부 홈으로 교체. book.tsx 교체(20-07)가 직전 선례.
- `apps/ios/app/me.tsx` 계열 — 전달 주소 노출 후보 위치(재량)

### 이전 phase 결정
- `.planning/phases/20-affiliate-booking/20-CONTEXT.md` — book 탭 체크리스트(예약 흐름과 가계부의 접점), extraction_costs provider 확장 선례
- `.planning/phases/18-auto-plan-ai/18-CONTEXT.md` — EF에서 서비스롤 권한 동치 복제 패턴(T-18-09), broadcast 진행 채널 선례

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **추출 파이프라인 골격**(extract-youtube) — status/claim/async/비용로깅. 가계부 파싱 구조가 이걸 미러(리서치 선잠금).
- **claude.ts 호출 헬퍼**(generate-plan, 18-03) — claude-sonnet-4-6 + Zod 출력 검증 + temperature 0. parse-email이 프롬프트만 교체해 재활용.
- **opaque 토큰 생성 idiom** — `ensure_share_slug`/`ensure_poll_code`(gen_random_bytes, 충돌 재시도) → 전달주소 To 토큰 생성에 동일 패턴.
- **RLS 헬퍼**(can_read_trip/can_edit_trip, SECURITY DEFINER) — D-04 멤버 공유 열람에 그대로.
- **탭 스텁 교체 선례** — 17-04 스텁 → 20-07 book 탭 홈 교체와 동일한 surgical 경로를 ledger.tsx에 반복.

### Established Patterns
- 마이그레이션 append-only — 새 번호만(0021까지 사용됨 → **이번 phase는 0022부터**).
- RLS deny-by-default + cross-table은 DEFINER 헬퍼 경유(42P17 가드).
- 외부 입력 Zod validate(@moajoa/core), 워크스페이스 import `.js` 금지.
- 서비스롤은 EF 안에서만. EF 코스트게이트(auth 검증 후 유료 호출 — T-18-08).
- 외부 실값(도메인·시크릿)은 env 배선, 하드코딩 금지(CLAUDE.md §4.7).

### Integration Points
- Cloudflare Email Worker → `inbound-email` EF(HTTP POST, 공유 시크릿) — **레포 밖 신규 표면**(wrangler 배포).
- `inbound-email` → ledger 테이블 저장 → `parse-email`(LLM + 환율 + trip 매칭) → 상태 갱신.
- ledger.tsx ← @moajoa/api 신규 쿼리 계층(하우스 계약: client-first `{error}` throw).
- @moajoa/core ← ledger Zod 스키마 + 상수(통화·상태 enum) — SQL 마이그레이션과 짝지어 변경(CLAUDE.md §4.2).

### ⚠️ 주의
- **`inbound-email` EF는 외부(Worker) 호출** — supabase JWT가 없으므로 `verify_jwt = false` + 자체 공유 시크릿 검증 필수. 시크릿 없는 요청 즉시 거부.
- **Cloudflare Email Routing catch-all 범위** — 서브도메인 라우팅 지원 여부가 plan 리서치 대상(D-02). apex catch-all이어도 토큰 주소 패턴은 성립.
- **미분류(trip_id NULL) 행의 RLS** — 멤버 공유 정책(can_read_trip)이 NULL trip_id에서 본인-only로 degrade 되는지 정책 설계 시 명시적으로 다룰 것.
- **메일 크기·인코딩** — 전달 메일은 HTML 멀티파트 + 첨부 가능. postal-mime 파싱 위치(Worker vs EF)와 EF payload 한도를 plan에서 확인.

</code_context>

<specifics>
## Specific Ideas

- 전달 주소는 "내 전용 주소"로 느껴지게 — 발급·복사가 가계부 시작 경험의 전부이므로 마찰 최소(1탭 복사).
- 미분류 인박스와 needs_review 수정을 **하나의 확인 흐름**으로 — "애매한 것들만 모아서 1탭씩 처리"가 LEDGER-06의 체감.
- 환율차 가시화(리서치 differentiator) — 원통화 금액과 KRW 환산을 나란히, fx_source가 'email'(실청구)인지 API 추정인지 구분 표시.

</specifics>

<deferred>
## Deferred Ideas

- **수동 지출 직접 추가**(메일 없이 앱에서 입력) — LEDGER 요구사항 밖. 가계부가 자리 잡으면 후속 phase 후보.
- **정산 분할 계산**(누가 얼마 부담, Splitwise류) — v2.0 '정산'의 다음 단계. 이번 phase는 공유 가계부(같이 보기)까지.
- **영수증 사진 업로드·OCR** — 안티피처(리서치). 메일 전달이 유일한 자동 입력 경로.
- **웹 가계부 표면** — iOS 전용 시작. 웹은 열람 니즈 확인 후.
- **SendGrid/Mailgun 전환** — Cloudflare 경로가 운영에서 한계(전달 실패율·디버깅)를 보이면 재검토. catch-all → To 토큰 패턴이 동일해 스왑 비용 낮음.

</deferred>

---

*Phase: 21-travel-ledger*
*Context gathered: 2026-07-05*
