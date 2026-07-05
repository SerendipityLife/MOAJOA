# Phase 21 (Travel Ledger) — 배포 핸드오프 런북

> **목적:** Phase 21의 코드는 전부 완성·커밋·테스트 green 상태다. 남은 건 **CF 인프라 배포(선행) + 디바이스 UAT** 뿐이며, 둘 다 라이브 인프라가 필요해 human verification으로 defer됨. 이 문서만 따라 하면 마무리된다.
>
> **관련 아티팩트:** [`21-UAT.md`](21-UAT.md) (blocked 2건) · [`21-VERIFICATION.md`](21-VERIFICATION.md) (status: human_needed) · [`21-05-SUMMARY.md`](21-05-SUMMARY.md)
>
> **담당:** moajoa.app 도메인 + Cloudflare 계정 소유자가 **§1 ~ §5 전 과정을 end-to-end로** 진행한다. (기존 개발자에겐 도메인/CF 계정 접근권이 없음 — 넘겨받는 지점 없이 처음부터 담당.)

---

## 0. 지금 상태 (TL;DR)

| 구분 | 상태 |
|---|---|
| 코드 (0022 마이그레이션, core/api 스키마·쿼리, inbound-email/parse-email EF + 파이프라인, CF Worker, iOS 가계부 UI) | ✅ 완료·커밋 |
| 자동 테스트 | ✅ green — core 143 · api 74 · iOS 127 · deno 21 |
| 정적 검증 (RLS/시크릿 게이트/토큰 매칭/요구사항 추적) | ✅ VERIFICATION 통과 |
| **CF 인프라 배포 (DNS 이전 + Email Routing + 시크릿 배선 + deploy)** | ⛔ **미완 (선행/BLOCKING)** ← 이 작업 |
| **디바이스 가계부 흐름 UAT (실메일 파싱)** | ⛔ 미완 (CF 배포에 종속) ← 이 작업 |

**남은 두 항목은 코드 결함(gap)이 아니라 "라이브 인프라 게이트"다.** 배포만 끝나면 스모크 1건으로 파이프라인이 살아나고, 디바이스에서 흐름을 확인하면 phase가 닫힌다.

---

## 1. 선행 — 계정/도메인 소유자가 직접 (리드타임 있음, 제일 먼저)

CLI로 자동화 불가한 계정 작업. **순서 중요.**

1. **moajoa.app DNS를 Cloudflare로 이전** — 도메인 등록기관에서 네임서버를 CF가 준 값으로 변경. 전파에 수십 분~수 시간. *(현재 `dig NS moajoa.app`이 빈 응답 = 아직 활성 위임 없음.)*
   - ⚠️ 도메인/CF 계정 소유자가 누구인지 먼저 확정할 것. 소유권이 없으면 이 단계에서 막힌다.
2. **CF Email Routing 활성화** — CF 대시보드 → 해당 zone → Email Routing 켜기.
3. **(2단계 순서 주의)** Email Routing의 catch-all 규칙이 Worker `moajoa-inbound-email`을 가리키게 하려면 **Worker가 먼저 배포돼 있어야** 선택지에 뜬다. → 그래서 아래 §2에서 `wrangler deploy`를 먼저 하고, **그 다음** 대시보드에서 규칙→Worker를 지정한다.
   - 전달 주소가 `<token>@ledger.moajoa.app` 형식이므로, **Email Routing은 `ledger.moajoa.app` 서브도메인에 catch-all**로 건다 (또는 apex catch-all).

---

## 2. 배포 런북 (CLI — 동료가 실행)

전제: repo 클론 + `pnpm i` 완료. Supabase는 이미 링크됨 (`project-ref = xfoauhsraguyrifingct`).

### 2.1 도구 준비
```bash
# wrangler (Cloudflare) — 이 머신엔 미설치 상태였음
npm i -g wrangler            # 또는 npx wrangler ... 로 대체
wrangler login               # 또는 export CLOUDFLARE_API_TOKEN=<토큰>

# supabase CLI 로그인 (미로그인 시)
supabase login
```

### 2.2 공유 시크릿 생성 (한 번만)
```bash
# INGEST_SECRET — Worker와 두 EF가 전부 같은 값을 써야 함
openssl rand -hex 32
# → 출력값을 아래 모든 곳에 동일하게 붙여넣는다. 안전한 곳(1Password)에 보관, 커밋 금지.
```

### 2.3 Supabase EF 시크릿 배선
```bash
supabase secrets list                                  # 기존값 확인 (ANTHROPIC_API_KEY 재사용 판단)
supabase secrets set INGEST_SECRET=<위 openssl 값>
supabase secrets set PARSE_EMAIL_URL=https://xfoauhsraguyrifingct.supabase.co/functions/v1/parse-email
# ANTHROPIC_API_KEY: generate-plan에서 쓰던 값이 이미 secrets에 있으면 그대로 재사용(EF 시크릿은 프로젝트 전역). 없으면:
# supabase secrets set ANTHROPIC_API_KEY=<키>
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 플랫폼이 자동 주입 — 수동 set 불필요.
```

### 2.4 EF 배포
```bash
supabase functions deploy inbound-email parse-email
# 주의: 두 함수 모두 config.toml에 verify_jwt=false (L72/L75) — 정상. CF/inbound-email이 JWT 없이 호출.
```

### 2.5 CF Worker 배포 + 시크릿
```bash
cd workers/inbound-email

# INBOUND_EF_URL 은 wrangler.toml [vars]에 넣거나 대시보드 var로. 값:
#   https://xfoauhsraguyrifingct.supabase.co/functions/v1/inbound-email
wrangler deploy
wrangler secret put INGEST_SECRET        # ← 2.2의 동일 값 입력
```
→ 배포 완료 후 **§1-3으로 돌아가** CF 대시보드 Email Routing 규칙에서 `moajoa-inbound-email` Worker를 지정.

### 2.6 iOS 전달 도메인 env
```
apps/ios/.env.local →  EXPO_PUBLIC_FORWARDING_DOMAIN=ledger.moajoa.app
```
(`.env.local.example`에 이미 예시 있음. app.config.ts가 `extra.forwardingDomain`으로 노출.)

---

## 3. 스모크 테스트 (Test 1 종료 조건)

1. 본인 메일 계정에서 **아무 메일 1건**을 발급받은 전달 주소(`<token>@ledger.moajoa.app`)로 전달.
   - 전달 주소는 iOS `me` 탭에서 발급/복사되거나, DB `forwarding_addresses`에서 확인 가능.
2. **기대:** CF Email Routing → Worker → inbound-email EF(INSERT pending) → parse-email EF(claude 파싱) → `ledger_entries`에 행 생성 (`status`가 `ready` 또는 `needs_review`).
3. **확인:** Supabase 대시보드 `ledger_entries` 테이블 또는 EF 로그(`supabase functions logs inbound-email` / `parse-email`)에서 행 1건 + 파싱 필드 확인.

✅ 행이 생기면 **Test 1 pass**.

---

## 4. 디바이스 UAT (Test 2 — CF 배포 완료 후)

`pnpm sim` 또는 실기기(EAS)로 앱 실행 후 확인:

1. **me 탭** → 전달 주소 복사(LEDGER-01 copy UX 동작).
2. **예약/카드 결제 메일 전달** → `ledger` 탭에 항목 자동 생성 + **환율 출처 배지**(실청구/추정/확인안됨) 정확성 (LEDGER-03).
3. **미분류 → 1탭 배정** → 멤버 공유 반영 / **needs_review → 1탭 수정 → ready** 전이 (LEDGER-06).
4. **외화 메일**로 5요소(원통화·통화·환율·fx_source·fx_as_of) 보존 + KRW 파생 표시 (LEDGER-03).
5. **한국 카드사 실포맷**(신한/삼성/현대 등) 메일로 claude 프롬프트 파싱 정확도 (RESEARCH A3).

✅ 위 5개 흐름 확인되면 **Test 2 pass** → LEDGER-01/02/03/06 런타임 sign-off.

---

## 5. 마무리 (phase 21 닫기)

**GSD 사용 가능하면:**
```
/gsd-verify-work 21
```
→ Test 1/2가 pending으로 되살아남 → 위 결과대로 pass 입력 → 둘 다 pass면 자동 transition(ROADMAP/STATE 완료 처리).

**수동으로 닫을 경우:**
- `21-UAT.md`: Test 1/2 `result: blocked` → `result: pass`로 바꾸고 Summary `blocked: 0, passed: 2`, `status: complete`.
- `21-VERIFICATION.md`: `status: human_needed` → `passed`.
- ROADMAP.md / STATE.md에서 phase 21 완료 표기.

---

## 6. 레퍼런스

### 시크릿/URL 매트릭스
| 이름 | 어디에 | 값 |
|---|---|---|
| `INGEST_SECRET` | Supabase EF secrets **+** Worker secret | `openssl rand -hex 32` (셋 다 동일) |
| `PARSE_EMAIL_URL` | Supabase EF secret (inbound-email이 사용) | `https://xfoauhsraguyrifingct.supabase.co/functions/v1/parse-email` |
| `ANTHROPIC_API_KEY` | Supabase EF secret (parse-email) | generate-plan 기존값 재사용 |
| `INBOUND_EF_URL` | Worker var (`wrangler.toml [vars]` 또는 대시보드) | `https://xfoauhsraguyrifingct.supabase.co/functions/v1/inbound-email` |
| `EXPO_PUBLIC_FORWARDING_DOMAIN` | `apps/ios/.env.local` | `ledger.moajoa.app` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | (자동 주입) | 수동 set 불필요 |

### 핵심 파일
- CF Worker: [`workers/inbound-email/src/index.ts`](../../../workers/inbound-email/src/index.ts) · [`wrangler.toml`](../../../workers/inbound-email/wrangler.toml)
- EF: [`supabase/functions/inbound-email/index.ts`](../../../supabase/functions/inbound-email/index.ts) · [`parse-email/index.ts`](../../../supabase/functions/parse-email/index.ts) · `parse-email/pipeline/{mail,claude,fx}.ts`
- iOS: `apps/ios/app/trip/[id]/(tabs)/ledger.tsx` · `apps/ios/lib/forwarding-address.ts` · `apps/ios/app.config.ts`
- DB: `supabase/migrations/0022_ledger.sql`

### 게이트/주의점
- inbound-email은 `x-ingest-secret` 헤더 401 게이트 + To-토큰 매칭(미매칭 시 **202 ignored** — 존재 미노출). 스모크에서 202가 오면 토큰 불일치 의심.
- SPF/DKIM 검증은 CF Email Routing 인프라에 위임 — EF 코드엔 없음. Email Routing이 켜져 있어야 동작.
- Worker는 DB/LLM 키를 갖지 않는 얇은 포워더. rawSize > 5MB는 reject.
- 마이그레이션은 append-only. 0022는 이미 존재 — 재적용 불필요(prod에 미적용이면 `supabase db push`).
