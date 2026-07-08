---
status: testing
phase: 24-host-flow
source:
  - 24-01-SUMMARY.md
  - 24-02-SUMMARY.md
  - 24-03-SUMMARY.md
  - 24-04-SUMMARY.md
  - 24-05-SUMMARY.md
  - 24-06-SUMMARY.md
  - 24-07-SUMMARY.md
started: "2026-07-08"
updated: "2026-07-08"
target: local (web → 127.0.0.1:54321, app localhost:3100)
---

## Current Test

number: 12
name: Real Kakao login (manual — Vercel Preview)
expected: |
  On a Preview deploy, "카카오로 시작하기" → kauth.kakao.com → consent → back to /auth/callback → /moa.
awaiting: user (manual-only; local has dummy Kakao creds)

## Tests

<!-- auto = orchestrator drives via preview tools; manual = user must run -->

1. [auto] Cold-start smoke — dev server boots + /login, /onboarding, /moa render, no console errors
2. [auto] Login page — "카카오로 시작하기" button present (AUTH-07 UI)
3. [auto] Onboarding wizard — 4 steps navigate (어디로→날짜→누구랑→봐둔 곳), back works
4. [auto] M-01 fix — step 2 "날짜 정했어요" with no range picked → 다음 disabled
5. [auto] Onboarding create — complete wizard (date 미정 path) → moa created → lands on /moa/[id]
6. [auto] /moa routing — after 1 moa exists, /moa redirects to that moa; create a 2nd → /moa shows list
7. [auto] /moa list — minimal cards (name·city·dates·place count) + 새 모아 CTA
8. [auto] /moa/[id] — map renders + place list area present, back chevron
9. [auto] H-01 fix — paste an unsupported URL (e.g. naver news) → "지원하지 않는 링크예요" row, NOT a permanent "분석 중…" spinner, no retry button
10. [auto] Add-sheet — FAB [+] opens add-sheet with link/search tabs
11. [auto] Share-sheet — [함께 정하기] opens mode cards; date-미정 moa shows all 3 modes; select + copy link succeeds
12. [manual] Real Kakao login — Vercel Preview deploy, complete OAuth on kauth.kakao.com (local has dummy creds)
13. [manual] Live realtime — with Edge Functions served, paste a YouTube/blog link → "분석 중…" → pins auto-appear on list+map (postgres_changes), "장소 N개 추가됨" toast
14. [manual] Sheet drag physics — place-sheet 2-anchor drag feel (collapsed↔expanded), flick bias
15. [manual] Mobile share — copied /t/{slug} link opens on phone (카톡 share)

## Results

Auto-verified 2026-07-08 via preview (web :3100 → local Supabase, email test account, 2 test moas created in local DB).

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Cold-start smoke | ✅ PASS | Next 15.5.18 Ready 1.2s; /login·/onboarding·/moa·/moa/[id] all 200, no app console errors |
| 2 | Login Kakao button | ✅ PASS | "카카오로 시작하기" button present on /login |
| 3 | Onboarding 4-step nav | ✅ PASS | 어디로→언제→누구랑→봐둔 곳; 뒤로 present; step gating works |
| 4 | M-01 fix (date gate) | ✅ PASS | fixed mode + no range → 다음 **disabled**; 미정 → enabled |
| 5 | Onboarding create (미정) | ✅ PASS | creates moa, redirects /moa/[id], title "도쿄 모아" (buildDraft derivation) |
| 6 | /moa D-01 routing | ✅ PASS | 0 moa → 307 /onboarding; 2+ moa → list |
| 7 | /moa list D-12 cards | ✅ PASS | "내 모아" + cards (name·city·날짜 미정·장소 0개) + 새 모아 CTA |
| 8 | /moa/[id] map render | ✅ PASS | real Google map (확대/축소/©2026), place area, 뒤로, FAB, 함께 정하기 |
| 9 | H-01 fix (unsupported URL) | ✅ PASS | naver news URL → "지원하지 않는 링크예요", **no "분석 중…" spinner** |
| 10 | Add-sheet FAB | ✅ PASS | [+] opens sheet with 링크 붙여넣기 / 장소 검색 tabs |
| 11 | Share-sheet D-17 + copy | ✅ PASS | 미정 moa shows all 3 modes; 장소 정하기 → 링크 복사 → slug /t/0relycunkn0c |
| 12-15 | Manual-only | ⏳ PENDING USER | Kakao real login, live realtime extraction, drag feel, mobile share |

## Gaps

Auto-verification found **no Phase-24 defects**. Observations (not blocking):

1. **[minor / out-of-scope] Email signup (가입하기) routes to legacy `/boards`**, bypassing the D-01 `/moa` branch. This is pre-existing dev-tool auth, not Phase 24's AUTH-07 (Kakao→/moa), but it's inconsistent — worth confirming /boards should still exist or redirect to /moa.
2. **[question] Onboarding step 3 (누구랑) requires a companion selection** — 다음 stays disabled until one is picked. `TripCreateDraftSchema` allows companion null, so this is stricter than the schema. Confirm whether "혼자" should be the implicit default / step skippable.
3. **[known low] Share URL uses `window.location.origin`** (L-03 from 24-REVIEW) — copied link was `localhost:3100/...`; on Preview it'd be the transient host, not the canonical domain. Deferred fast-follow.

Browser console noise `config is not valid` / `emrldco.com 403` is from a **Chrome extension in the preview browser, not MOAJOA** — ignore.

### 프로덕션 실기기 UAT (2026-07-09, moajoa-web.vercel.app)

사용자가 실 카카오 로그인 후 폰에서 발견 → 4건 진단·처리:

1. **[FIXED] 지도 안 보임 + 장소 이름 = place_id** (동일 근본원인, commit 6ce17fc) — 장소 검색 담기 경로가 resolve-place EF가 준 `displayName`·`location{lat,lng}`을 저장 단계에서 버림(`PickedPlace`→`PlaceAddManualSchema`→`addManualPlace`→RPC 전 구간). RPC `add_manual_place`의 `coalesce(p_name_local,p_google_place_id)`·`coalesce(p_lat,0)`로 name_local=place_id·좌표=(0,0) 저장 → 핀이 Null Island(대서양) → 지도가 빈 바다. 마이그레이션 불필요(RPC가 이미 optional 파라미터 수용) — name/좌표/주소를 끝까지 스레드. core 173·api 91·web 114 그린.
2. (위 1과 통합)
3. **[FIXED] FAB [+] 시트 위에 잔존** (commit b835097) — `z-[60]` 상시 렌더 → `{!addOpen && !shareOpen && …}` 조건부.
4. **[미구현·버그아님] 채팅** — "답장"은 `채팅은 곧 열려요` 스텁. trip_messages(0025) 테이블만 존재, 채팅 UI 미구현(Phase 25/26 몫). 의도한 비동기·영속(메시지 남기면 후속 참여자 열람) = 계획된 설계이며 현재는 단순 미구현(동시접속 의존 아님).

**주의:** 수정은 신규 담기부터 적용. 수정 전 저장된 manual place(name_local=place_id·0,0)는 잔존 — 재담기 필요(데이터 백필 별건). 프로덕션 재배포 dpl_BjsaGd… READY(b835097).
