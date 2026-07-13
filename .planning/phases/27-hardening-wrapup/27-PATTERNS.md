# Phase 27: Hardening & 마감 - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 7 (수정 5 · 신규 2)
**Analogs found:** 7 / 7 (no-analog 0)

> RESEARCH.md가 파일:라인 실측을 이미 완비 — 이 문서는 planner가 plan action에 바로 붙일 수 있는 **실제 코드 excerpt**를 analog에서 추출·정리한 것이다. 신규 설계 0 (전 항목이 기존 하우스 패턴의 이식·계승).

## File Classification

| New/Modified File | 종류 | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `supabase/functions/extract-youtube/index.ts` | 수정 | edge-function handler | request-response (유료 파이프라인 게이트) | `supabase/functions/generate-plan/index.ts` L116-140 | **exact** — 같은 EF 패밀리, 게이트 자체가 extract-youtube에서 복사된 것의 역이식 |
| `apps/web/app/t/[slug]/_components/guest-surface.tsx` | 수정 (L319·325) | component (client island) | request-response (카피만) | `apps/web/app/moa/[id]/_components/place-list.tsx` L213-231 | **exact** — 같은 하트 버튼 UI, 이미 "찜" 어휘 사용 |
| `apps/web/app/t/[slug]/page.tsx` | 수정 (L115) | RSC page | request-response (SSR 카피만) | place-list.tsx "찜" 어휘 | role-match (어휘 소스) |
| `supabase/tests/` SEC-01 게이트 스모크 (신규, 예: `extract_gate_smoke.sh`) | 신규 | test (smoke script) | request-response (curl) | `supabase/tests/web_share_smoke.sh` | **exact** — 익명 signup·JWT 추출·psql 셋업·HTTP code 단언 전부 재사용 |
| `docs/WORKSTREAMS.md` §1·§2 | 수정 | docs | — | `CLAUDE.md` §4.1·§5 현행 서술 (Pitfall 7 기준 어휘) | role-match |
| `docs/ARCHITECTURE.md` L19-21 + data flow 2개 | 수정 | docs | — | 상동 | role-match |
| `.planning/phases/27-hardening-wrapup/27-HUMAN-UAT.md` | 신규 | UAT doc | — | `.planning/phases/25-guest-unified-share/25-HUMAN-UAT.md` | **exact** — D-08이 포맷 계승을 잠금 |

## Pattern Assignments

### 1. `supabase/functions/extract-youtube/index.ts` (edge-function, 게이트 삽입 + revalidate 조건)

**Analog:** `supabase/functions/generate-plan/index.ts` — T-18-09 멤버십 게이트 미러 원본

**미러할 게이트 verbatim** (generate-plan L116-140 — 실측 재확인 완료, RESEARCH excerpt와 일치):
```typescript
// ---- Edit-rights check (T-18-09, Security V4) -------------------------------
// Must happen BEFORE any paid Claude/Routes call. Mirror the can_edit_trip
// helper (0016 L313-336) with a service-role query, since auth.uid() is null
// under the service role: owner OR an accepted owner/editor membership.
const { data: trip, error: tripErr } = await admin
  .from('trips')
  .select('id, owner_id, start_date, end_date, day_count')
  .eq('id', trip_id)
  .maybeSingle();
if (tripErr) return jsonError(500, tripErr.message);
if (!trip) return jsonError(404, 'trip not found');

let canEdit = trip.owner_id === callerId;
if (!canEdit) {
  const { data: membership } = await admin
    .from('memberships')
    .select('role, accepted_at')
    .eq('trip_id', trip_id)
    .eq('user_id', callerId)
    .maybeSingle();
  canEdit = !!membership &&
    membership.accepted_at !== null &&
    (membership.role === 'owner' || membership.role === 'editor');
}
if (!canEdit) return jsonError(403, 'forbidden');
```

**이식 시 어휘 치환 (extract-youtube 컨텍스트):**
- `trip_id` → `link.trip_id` (★ CONTEXT D-01의 "board_id"는 구 표기 — Pitfall 6)
- `callerId` → 기존 getUser 게이트의 `caller.user.id` (extract-youtube L76-79에 이미 존재, `callerId` 상수는 신설 필요 — generate-plan L114 `const callerId = caller.user.id;` 미러)
- select 컬럼: generate-plan의 `start_date, end_date, day_count` 대신 extract-youtube 기존 trip fetch 용도인 `city_code, share_slug, visibility` + **`owner_id` 추가**

**삽입 지점** (extract-youtube 실측 — L107 KNOWN_SOURCES 체크 뒤, L108 claim 주석 앞):
```typescript
// extract-youtube/index.ts L104-107 (기존 — 이 블록 바로 뒤에 게이트)
const KNOWN_SOURCES = new Set(['youtube', 'blog', 'instagram']);
if (!KNOWN_SOURCES.has(link.source_kind)) {
  return jsonError(400, `cannot auto-extract source_kind=${link.source_kind}`);
}
// ★ 여기 신규 게이트. claim UPDATE(L119, extraction_status→processing 첫 DB 쓰기)보다
//   반드시 앞 — 비멤버의 링크 상태 오염 차단 (RESEARCH Anti-Pattern 1)
```

**이동·통합할 기존 trip fetch** (extract-youtube L143-149 — 게이트 위치로 당기고 owner_id 추가, 신규 쿼리는 memberships 1개만):
```typescript
// Trip row feeds the LLM city hint, the Places language choice, and the
// revalidate webhook at the end (single fetch, reused).
const { data: trip } = await admin
  .from('trips')
  .select('city_code, share_slug, visibility')   // → 'owner_id, city_code, share_slug, visibility'
  .eq('id', link.trip_id)
  .maybeSingle();
```
후속 사용처는 이동 후에도 같은 변수로 동작: `trip?.city_code`(L162 cityHint), revalidate 블록(L426). 단 `if (!trip) return jsonError(404, ...)` 강화로 "trip 없어도 진행" 시맨틱이 바뀌나 FK cascade상 실질 무영향 (RESEARCH §이식 스케치 주의).

**revalidate visibility 조건 확장 대상** (extract-youtube L421-437 기존 — RESEARCH Open Q1 권고: fix 포함):
```typescript
// Fire-and-forget webhook to web /api/revalidate (per CONTEXT D-04, D-05).
try {
  if (trip?.visibility === 'public' && trip.share_slug) {   // → ['public','shared'].includes(trip?.visibility ?? '')
    const webBase = Deno.env.get('WEB_BASE_URL');
    const revalidateSecret = Deno.env.get('REVALIDATE_SECRET');
    if (webBase && revalidateSecret) {
      // fire-and-forget — D-05 lock. No await. .catch prevents unhandledrejection.
      fetch(`${webBase}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: trip.share_slug, secret: revalidateSecret }),
      }).catch((err) => console.warn('[revalidate-webhook] fetch failed:', err));
    }
  }
} catch (err) {
  console.warn('[revalidate-webhook] lookup failed:', err);
}
```
근거: `shareMoa`(packages/api/src/queries/trips.ts:219)는 `visibility='shared'`, `/t/[slug]`는 'shared'도 렌더(0029) — 'shared' 모아의 추출 완료가 SSR 캐시를 안 깨움.

**에러 응답 헬퍼** (extract-youtube L538-543 기존 — 신규 shape 금지, D-02):
```typescript
function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}
```

**클라이언트 전파 경로 (무변경 확인용)** — `packages/api/src/queries/links.ts` L61-70:
```typescript
export async function triggerExtraction(
  client: MoajoaSupabaseClient,
  linkId: string,
): Promise<ExtractionResult> {
  const { data, error } = await client.functions.invoke('extract-youtube', {
    body: { link_id: linkId },
  });
  if (error) throw error;   // 403 → 기존 throw 경로 (generate-plan 403 프로덕션 선례)
  return data as ExtractionResult;
}
```

---

### 2. `apps/web/app/t/[slug]/_components/guest-surface.tsx` L319·325 (component, 카피 치환)

**Analog:** `apps/web/app/moa/[id]/_components/place-list.tsx` L213-231 — 호스트 표면의 동일 하트 버튼, 이미 "찜" 사용 중

**목표 어휘** (place-list.tsx L213-217):
```tsx
{/* 우: 찜 하트 토글 — 행 토글과 분리(stopPropagation). */}
<button
  type="button"
  aria-label="찜"
  aria-pressed={voted}
```

**치환 대상 현재 코드** (guest-surface.tsx L317-327):
```tsx
<button
  type="button"
  aria-label="가고싶어"                            {/* → "찜" (aria-label도 유저 대면 — Anti-Pattern 3) */}
  data-testid={`guest-vote-${p.id}`}               {/* testid 유지 — 테스트가 이것만 조회 (D-05: 단언 변경 0 예상) */}
  onClick={() => openGate()}
  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-600"
>
  <Heart className="size-3.5" strokeWidth={2.2} fill="none" />
  가고싶어                                          {/* → 찜 */}
  <span className="text-neutral-400">{counts[p.id] ?? 0}</span>
</button>
```
주의: 같은 파일 L306 주석("찜 탭 시 게이트")은 이미 찜 어휘 — 이 파일 내 신규 어휘 도입 아님. `vote-island.tsx`의 동종 버튼은 D-06으로 스윕 제외 (dead code).

---

### 3. `apps/web/app/t/[slug]/page.tsx` L115 (RSC page, 카피 치환)

**Analog:** place-list.tsx "찜" 어휘 (상동)

**치환 대상 현재 코드** (page.tsx L114-117):
```tsx
<p className="mt-1 text-sm leading-relaxed text-brand-700">
  가고 싶은 곳에 <span className="font-semibold">가고싶어!</span>를 눌러주세요.
  많이 모인 곳으로 같이 정해요.
</p>
```
문안은 executor 재량 (RESEARCH Open Q2 — 예: `가고 싶은 곳에 <span>찜</span>을 눌러주세요.`). 단언하는 테스트 없음 실측 (metadata.test·og-image.test 히트 0).

**Acceptance grep** (RESEARCH Validation Architecture):
```bash
grep -rn "가고싶어" apps/web --include="*.tsx" | grep -v vote-island   # → 0건 (map-section.tsx:11 주석은 D-04 유지 — grep 라인 제외 처리 필요 시 -v map-section)
```

---

### 4. SEC-01 게이트 스모크 스크립트 (신규, `supabase/tests/`)

**Analog:** `supabase/tests/web_share_smoke.sh` — 25-05 선례, 그대로 계승할 빌딩 블록 4종

**(a) 파일 헤더·환경 부트스트랩** (L1-9):
```bash
#!/usr/bin/env bash
# Phase 23 smoke — ...
# 주의: 익명 signup은 IP당 30/hr rate limit — 반복 실행 시 유의.   ← Pitfall 5 그대로 계승
set -euo pipefail
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')
```

**(b) 익명 세션 signup + JWT 추출** (L12-23 — 비멤버 게스트 세션 = SEC-01의 공격자 역):
```bash
RESP=$(curl -s -X POST "$API/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"data":{"name":"게스트닉네임"}}')
JWT=$(printf '%s' "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")
```

**(c) 호스트 + trip + 시드 psql 셋업** (L28-40·L75-80 패턴 — ready 링크 시드에 응용):
```bash
EMAIL="sharehost@local.test"
curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"password-share-1\"}" > /dev/null || true
HOST=$(psql "$DB" -tAc "select id from auth.users where email='$EMAIL' limit 1")
# -q 필수: INSERT...RETURNING은 -t만으론 커맨드 태그("INSERT 0 1")가 섞여 나옴
T_BOTH=$(psql "$DB" -qtAc "insert into trips (owner_id, title) values ('$HOST','smoke-both-$(date +%s)') returning id")
```
SEC-01용 시드: 위 패턴으로 `links` 행 INSERT — `extraction_status='ready'` + `source_kind='youtube'`(KNOWN_SOURCES 통과 필요, 게이트가 소스 체크 **뒤**라서) — 무비용 트릭(Pitfall 3) 전제.

**(d) HTTP code 단언 스타일** (L55-58):
```bash
MSG_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  "$API/rest/v1/trip_messages?trip_id=eq.$T_BOTH&select=id" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT")
[ "$MSG_CODE" = "200" ] || { echo "FAIL: trip_messages RLS probe HTTP $MSG_CODE (want 200 — 42P17 recursion?)"; exit 1; }
```

**SEC-01 단언 3종** (RESEARCH Code Examples의 무비용 트릭 — ready 링크 대상, 유료 API 발화 0):
```bash
# (1) anon key 원시 토큰 → 401 (T-18-08 기존 게이트 무회귀)
curl -s -o /dev/null -w "%{http_code}" -X POST "$API/functions/v1/extract-youtube" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"link_id\":\"$READY_LINK_ID\"}"                       # expect 401
# (2) 비멤버 익명 세션($JWT, join_moa 미호출) → 403 (신규 게이트 — SEC-01 핵심)
# (3) 멤버(owner 세션 또는 join_moa 후 editor) → 409 "already extracted" (게이트 통과 실증)
```
멤버 세션은 (b)의 이메일 signup 응답에서 access_token 추출(owner) 또는 web_share_smoke.sh L43-44 `join_moa` RPC 호출 패턴(editor 승격 게스트)으로 확보.

주의: 로컬 EF는 `supabase functions serve` 필요 — 스크립트 전제 주석에 명시 (web_share_smoke.sh L4 "전제:" 주석 스타일).

---

### 5. `docs/WORKSTREAMS.md` · `docs/ARCHITECTURE.md` (docs, 역할 기술 수정)

**Analog (기준 어휘):** `CLAUDE.md` §4.1 — "web/ Next.js 15 (입력·저장·편집 풀 서피스 — v2.1 웹 퍼스트. 공유 열람·투표 포함)" · §5 "iOS 코드 변경 — v2.1 웹 퍼스트 동안 iOS는 전면 동결". Pitfall 7: 이 서술과 충돌 금지.

**수정 대상 실측 excerpt — WORKSTREAMS.md §2 헤딩·상태** (L46-48):
```markdown
## 2️⃣ Web — 공개 보드 열람 (Owner: 프론트엔드)

**상태:** 작동. 다만 *현재는 dev tool 성격의 폼*도 포함 (보드 생성·링크 추가). 본래 web의 역할은 **열람·공유 랜딩**만.
```
→ 웹=입력·저장·편집 풀 서피스로 반전 + 할 일 목록(L55-67)의 `/b/[slug]`·`/boards`·dev-tools 격리 항목은 현행 라우트(`/t/[slug]`·`/moa`·`/onboarding`)와 완료 상태 반영. §1 iOS(L33-37, `boards` 탭·Share Extension 할 일)는 v2.1 전면 동결 명시.

**수정 대상 실측 excerpt — ARCHITECTURE.md 헤딩** (L19-22):
```markdown
### Next.js for Web (열람), Expo for iOS (저장)

- **공유 링크 비로그인 열람이 핵심 acquisition.** ...
- **iOS Share Extension은 Expo로도 가능** ...
```
→ 역할 반전. Data flow(L24-50)는 `[iOS] Share Sheet` 기점 + `board_id` + RLS 문구 "board editor" — 웹 기점(온보딩/add-sheet) + `trip_id` + `/t/[slug]` 어휘로 갱신 (전면 재작성 아님, 역할 기술 수정 수준 — 재량).

---

### 6. `.planning/phases/27-hardening-wrapup/27-HUMAN-UAT.md` (신규, UAT doc)

**Analog:** `25-HUMAN-UAT.md` — D-08이 포맷 계승 잠금

**Frontmatter 패턴** (L1-7):
```markdown
---
status: partial            # pending → partial → complete
phase: 25-guest-unified-share
source: [25-VERIFICATION.md, 25-USER-SETUP.md]
started: 2026-07-10T00:00:00Z
updated: 2026-07-10T00:00:00Z
---
```

**본문 구조** (L9-41):
```markdown
## Current Test

[awaiting human — 선행: 배포 게이트 2종(...)]

## Tests

### 1. [배포 게이트] 원격 0029 마이그레이션 적용
expected: `git push origin main`(...) → ... 라이브.
result: pass

### 3. [라이브] SSR 즉시 렌더 + 게스트 참여 완주 (SC1~4)
expected: 비로그인 시크릿 브라우저로 /t/[slug] 열기 → ...
result: issue
reported: "..."
severity: blocker
notes: "..."

## Summary

total: 4
passed: 2
issues: 1
pending: 1
skipped: 0
blocked: 0
```

**Gaps 엔트리 패턴** (L43-51 — truth/status/reason/severity/test/artifacts/missing 필드):
```markdown
## Gaps

- truth: "둘다/날짜 모드에서 게스트가 날짜투표에 참여할 수 있다 (SC3)"
  status: failed
  reason: "..."
  severity: blocker
  test: 3
  artifacts: [packages/api/src/queries/trips.ts:194 shareMoa, ...]
  missing: [웹 호스트 date_poll 생성 + 후보 날짜 세팅 플로우]
```

**round 기록 패턴** (L89-93 — 라운드별 진행을 Gaps에 info 엔트리로 누적):
```markdown
- truth: "UAT round 3 — 시트 모달 스태킹 수정 + 게스트 날짜투표 라이브 실증 (Claude, 2026-07-12)"
  status: passed
  reason: "근본원인: ... 잔여: 호스트 iPhone 재확인(공유시트 footer)·하트(사용자 기기)·카카오 승격."
  severity: info
  test: 3
```

**27 문서 구성 재료** (D-07 통합 — 상세는 RESEARCH §UAT 소스 취합):
- 축: SC-3 2인극 (호스트 A / 게스트 B 시크릿 / A 복귀)
- 합류: Phase 25 잔여(iPhone 실기기·카카오 승격·크로스브라우저) · Phase 28 라이브 2건(28-VERIFICATION uat_pending) · presence(D-09 todo 닫기 조건) · SEC-01 403 실증
- human-only 분리 기준: 카카오 실로그인·iPhone 실기기·카카오 승격 (D-08)

## Shared Patterns

### 유료 작업 전 게이트 배치 원칙
**Source:** generate-plan L116-117 주석 "Must happen BEFORE any paid Claude/Routes call"
**Apply to:** extract-youtube 게이트 삽입 — 첫 유료 호출(L219 Claude)뿐 아니라 첫 DB 쓰기(claim L119)보다도 앞.

### service-role 미러 쿼리 (RPC 직접 호출 금지)
**Source:** generate-plan L117-119 주석 — `auth.uid()`가 service-role 컨텍스트에서 null이라 `can_edit_trip` RPC는 항상 false. 미러 쿼리 필수. 시맨틱 원본: `supabase/migrations/0016_trips_baseline.sql` L313-336 (owner OR accepted owner/editor).

### jsonError 응답 shape
**Source:** extract-youtube L538-543 (generate-plan에도 동일 헬퍼 존재)
**Apply to:** 게이트 403/404/500 — `{ error: message }` shape 유지, 신규 shape 금지 (D-02).

### 카피 스윕 + 테스트 동커밋
**Source:** Phase 24 board→moa 스윕 선례 (CONTEXT Established Patterns)
**Apply to:** guest-surface·page.tsx — 단, 실측상 단언 변경 0 예상이므로 acceptance는 grep 0건 + `pnpm --filter @moajoa/web test:run` 그린 (bare `test`는 watch — Pitfall 4).

### EF 배포
**Source:** `.planning/STATE.md` L394-395 (generate-plan v2 배포 실측)
**Apply to:** extract-youtube 수정 후 — `supabase functions deploy extract-youtube --use-api` (colima에서 기본 deploy는 eszip ENOENT 실패) + `supabase functions list`로 version bump 확인. 머지 ≠ 배포 (Pitfall 1·2).

## No Analog Found

없음 — 전 파일에 하우스 analog 존재. (신규 설계가 등장하면 범위 초과 신호 — RESEARCH Key insight.)

## Metadata

**Analog search scope:** `supabase/functions/` · `supabase/tests/` · `apps/web/app/` · `packages/api/src/queries/` · `docs/` · `.planning/phases/25-*/`
**Files scanned:** 12 (targeted reads — RESEARCH 실측 라인 기반, 중복 조사 생략)
**Pattern extraction date:** 2026-07-13
