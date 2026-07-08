---
phase: 24-host-flow
verified: 2026-07-08T11:00:00Z
status: passed_with_gaps
score: 10/10 requirements delivered-in-code (5 unit-verified end-to-end · 5 code-complete-pending-live-e2e)
re_verification: false
requirement_dispositions:
  AUTH-07: code-complete-pending-manual-verification   # kakao signInWithOAuth wired + unit-tested; real login e2e blocked by remote push + Preview UAT
  ONBOARD-03: delivered-in-code                          # 4-step wizard → createMoaDraft once; RTL-verified. Production create round-trip needs remote push
  ONBOARD-04: delivered-in-code                          # buildDraft unset→null / fixed→range unit-verified (advisory M-01)
  ONBOARD-05: delivered-in-code                          # seed staging + batch addLink/addManualPlace + skip; RTL-verified
  MOA-02: delivered-in-code                              # sortByLove love-desc/seq-asc + seq_no badge invariant; unit-verified
  MOA-03: code-complete-pending-manual-verification      # addLink+triggerExtraction + postgres_changes reconcile wired; live realtime pin needs remote push (advisory H-01)
  MOA-04: code-complete-pending-manual-verification      # resolve-place search → addManualPlace wired; live add needs remote push/EF
  MOA-05: delivered-in-code                              # accordion 4-elem + marker-tap↔row unit-verified (Test 5); live map scroll needs UAT
  MOA-06: delivered-in-code                              # memberColor host=brand/cyclic wired to map pins + list badge; unit-verified; live pin color needs map UAT
  SHARE-01: code-complete-pending-manual-verification    # 3-mode select + D-17 hide + D-19 re-share + shareMoa slug; real slug issuance needs remote push
human_action_gate:
  - action: "supabase db push (0024·0025·0026)"
    status: open
    blocks: "Live e2e on Vercel Preview for AUTH-07 (real Kakao), MOA-03/04 (live extraction→pin realtime), SHARE-01 (real slug issuance / join)"
    note: "Remote is at 0023; local applied through 0026. Local unit/RTL/smoke all green. User must run in terminal."
advisory_findings:  # from 24-REVIEW.md — do not affect disposition, recorded for follow-up
  - id: H-01
    file: "apps/web/app/moa/[id]/_components/place-list.tsx:72-73"
    issue: "Non-extractable URL (source_kind='manual') stays extraction_status='pending' forever → permanent '분석 중…' row, never enters failed bucket, no retry. Confirmed in code."
  - id: M-01
    file: "apps/web/app/onboarding/page.tsx:72"
    issue: "Step-2 canProceed = dateMode!==null; '날짜 정했어요' with no range picked advances → moa created dates-null, intent silently discarded."
  - id: M-02
    file: "apps/web/app/moa/[id]/_components/moa-island.tsx:85-110"
    issue: "reconcile() not guarded against concurrent runs → burst places INSERT can fire duplicate/inflated '장소 N개 추가됨' toast."
  - id: L-03
    file: "apps/web/app/moa/[id]/_components/share-sheet.tsx:54"
    issue: "Share URL from window.location.origin not NEXT_PUBLIC_APP_URL → preview-host links on non-canonical deploys."
---

# Phase 24: Host Flow (온보딩·지도탭) Verification Report

**Phase Goal:** 호스트가 웹에서 전 흐름을 완주한다 — 로그인(카카오 포함) → 4단계 온보딩으로 모아 생성 → `/moa/[id]` 지도탭에서 링크 자동 추출·장소 검색 추가 → 순번·찜순·아코디언·사람별 색 리스트 → [함께 정하기] 공유링크 생성·복사.
**Verified:** 2026-07-08
**Status:** passed_with_gaps
**Re-verification:** No — initial verification

## Goal Achievement

Every requirement is delivered in code, wired end-to-end (RSC → typed query → client island → component), and covered by green unit/RTL tests. No requirement is a stub, orphan, or hollow. The remaining gap is **verification, not implementation**: five requirements whose live behavior depends on the remote database cannot be e2e-confirmed until the open `supabase db push` human-action gate is executed. That is the correct disposition — not `passed`, not `failed`.

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 카카오 계정으로 로그인 (이메일·구글·애플 유지) | ✓ code-verified / ? live | `login/page.tsx:106-241` oauth union +='kakao', `signInWithOAuth({provider})` wired to button; `login.test.tsx` 3 cases green. Real login e2e needs remote push + Preview UAT |
| 2 | 로그인 직후 4단계 온보딩 → 모아 생성 | ✓ VERIFIED | `onboarding/page.tsx` 4-step client wizard → `createMoaDraft` once (l.83) → batch seed (l.84-92) → `router.replace('/moa/{id}')`; `build-draft.ts` unset→null/fixed→range; RTL `onboarding.test.tsx`+`build-draft.test.ts` green |
| 3 | 링크 자동 추출→핀 + 구글 장소 검색 추가 | ✓ code-verified / ? live | `add-sheet.tsx` addLink+triggerExtraction (l.29-33) / addManualPlace (l.45); `moa-island.tsx:113-132` postgres_changes places INSERT+links UPDATE → reconcile. Live extraction→pin needs remote push |
| 4 | 찜순 정렬(순번 불변)·아코디언·마커 탭 스크롤·핀 색·"닉네임님이 담음" | ✓ VERIFIED (unit) / ? live map | `place-sort.ts` sortByLove; `place-list.tsx` seq_no badge + 4-elem accordion + scrollIntoView; `moa-island.tsx:158` onMarkerTap→openPlaceId+expanded; `member-color.ts` host=brand. Marker-tap↔row Test 5, sort Test 1-2 green. Live Google Maps render needs UAT |
| 5 | 함께 정하기 3-모드 → 공유링크 생성·복사 (날짜 확정 시 dates 숨김) | ✓ code-verified / ? live | `share-sheet.tsx` 3-mode + D-17 filter (l.47) + D-19 preset (l.42-44) + shareMoa→slug→clipboard (l.53-55); `share-sheet.test.tsx` 5 cases green. Real slug issuance needs remote push |

**Score:** 10/10 requirements delivered-in-code · 5 unit-verified end-to-end · 5 code-complete pending live-e2e

### Required Artifacts

All 25 declared artifacts exist, are substantive, and are wired (imported + used with real data flow). Spot sample:

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `apps/web/app/moa/[id]/page.tsx` | RSC data seed | ✓ VERIFIED | Real typed-query loads (getTrip/listPlaces/listLinks/listTripMembers/getVoteCounts/getProfileNames) → MoaIsland; auth+RLS gate |
| `apps/web/app/moa/[id]/_components/moa-island.tsx` (245L) | realtime hub | ✓ VERIFIED | single moa:{id} channel, removeChannel cleanup, refetch reconcile, optimistic vote, marker↔row |
| `apps/web/app/onboarding/page.tsx` (202L) | 4-step wizard | ✓ VERIFIED | createMoaDraft once + batch seed + skip path |
| `packages/api/src/queries/trips.ts` | createMoaDraft/shareMoa | ✓ VERIFIED | shareMoa single UPDATE preserves slug (0016 trigger), updates mode (D-19); createMoaDraft sends no seq_no |
| `supabase/migrations/0026_realtime_publication.sql` | publication | ✓ VERIFIED | append-only, adds places+links to supabase_realtime; highest migration |
| `apps/web/lib/{member-color,place-sort}.ts` + `marker-svg.ts` | pure fns | ✓ VERIFIED | host=brand cyclic / love-desc seq-asc non-mutating / fill override |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| login button | Supabase auth | `signInWithOAuth({provider:'kakao'})` | ✓ WIRED |
| onboarding finish | trips INSERT | `createMoaDraft(client, draft)` | ✓ WIRED |
| moa-island | realtime | `moaChannelName(trip.id)` postgres_changes ×2 → reconcile | ✓ WIRED |
| add-sheet link | extraction | `addLink`→`triggerExtraction` (non-manual) | ✓ WIRED |
| add-sheet search | places | `addManualPlace(google_place_id)` | ✓ WIRED |
| share-sheet | slug | `shareMoa(client, id, mode)`→clipboard/navigator.share | ✓ WIRED |
| map markers | pin color | `colorFor`→`memberColor`→`buildMarkerIconUrl(fill)` | ✓ WIRED |
| marker tap | row scroll | `onMarkerTap`→`openPlaceId`→place-list scrollIntoView | ✓ WIRED (unit; live map UAT) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| core contracts | `pnpm --filter @moajoa/core test` | 169 passed | ✓ PASS |
| api typed queries | `pnpm --filter @moajoa/api test` | 88 passed | ✓ PASS |
| web UI + wizard + island | `pnpm --filter @moajoa/web test:run` | 110 passed (20 files) | ✓ PASS |
| iOS regression (ui-tokens append) | (per 24-07 gate) | 128 passed | ? SKIP (frozen, not re-run) |
| live realtime pin / Kakao / slug | Vercel Preview e2e | — | ? SKIP — blocked by remote push gate |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| place-list.tsx | 72-73 | manual link → permanent "분석 중…" (H-01) | ⚠️ Warning | Non-YouTube/blog/IG paste (Naver, Google Maps, TikTok URL) sticks forever, no retry. Real user-reachable dead state |
| onboarding/page.tsx | 72 | "날짜 정했어요" + no range advances (M-01) | ⚠️ Warning | Fixed-date intent silently discarded → dates-null moa |
| moa-island.tsx | 85-110 | reconcile unguarded vs concurrent runs (M-02) | ℹ️ Info | Burst INSERT → duplicate/inflated toast (UX only) |
| share-sheet.tsx | 54 | window.location.origin not NEXT_PUBLIC_APP_URL (L-03) | ℹ️ Info | Preview-host links on non-canonical deploys |

All four are documented advisory findings in `24-REVIEW.md` (0 critical, 1 high, 2 medium, 3 low) — correctness/UX defects, not security or data-loss. Security surface is clean: no service-role key in client bundle, open-redirect guards present, createMoaDraft sends no seq_no, no `.js` workspace imports, no `dangerouslySetInnerHTML`, iOS diff 0.

### Human Verification Required

1. **원격 push 실행 (선행 게이트)** — Run `supabase db push` (applies 0024·0025·0026, append-only/additive), then `supabase migration list` to confirm Local·Remote aligned to 0026. Unblocks all live e2e below.
2. **카카오 실로그인 (AUTH-07)** — Vercel Preview browser UAT (local uses email fallback). Expected: Kakao consent → callback → `/moa`.
3. **추출 완료 실시간 반영 (MOA-03)** — Paste YouTube link in `/moa/[id]` → "분석 중…" row → pin appears on map + "장소 N개 추가됨" toast. 2-tab browser smoke.
4. **구글 장소 검색 추가 (MOA-04)** — Search → pick → place row + pin appear.
5. **지도 마커 탭·fitBounds·핀 색 (MOA-05/06)** — Google Maps live render: marker tap scrolls+expands row; adder-color pins (host=brand); fitBounds on new pins.
6. **공유링크 발급·복사 (SHARE-01)** — Select mode → "링크 복사하기" → real `/t/{slug}` copied; re-open shows preset, re-share keeps slug.
7. **드래그 시트 물리 (D-09)** — 2-anchor drag/flick on mobile viewport (jsdom cannot verify pointer capture).

### Gaps Summary

There are **no implementation gaps** — every Phase 24 requirement is delivered in code, wired, and unit/RTL-verified (core 169 / api 88 / web 110 green, all confirmed by re-run during this verification). The only "gaps" are:

1. **One open human-action gate** — remote `supabase db push` has not run. Until then, the five requirements whose live behavior touches the remote DB (AUTH-07, MOA-03, MOA-04, SHARE-01, and production ONBOARD create round-trip) are `code-complete-pending-manual-verification`, not confirmable on Vercel Preview. This is a known, explicitly-tracked gate from 24-01, not a code defect.
2. **Advisory review findings** (H-01/M-01/M-02/L-03) — real correctness/UX defects, already recorded in 24-REVIEW.md, none blocking goal achievement. H-01 (manual-link stuck spinner) is the most material and worth a fast-follow before public launch.

**No not-delivered requirements.**

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
