---
phase: 25
slug: guest-unified-share
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-10
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for the coverage map: `25-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (web `apps/web/__tests__`, api `packages/api/src/queries/*.test.ts`, core) + bash SQL 하네스/스모크(`supabase/tests/*.sh`, `*.mjs`) |
| **Config file** | vitest workspace(각 패키지) · `apps/web/__tests__/setup.ts` |
| **Quick run command** | `pnpm --filter @moajoa/web exec vitest run <file>` (⚠️ web `test`는 bare `vitest`=watch — 반드시 `vitest run` 또는 `CI=true`) |
| **Full suite command** | `CI=true pnpm -r --parallel run test` + `bash supabase/tests/<smoke>.sh` / `node supabase/tests/realtime_events_smoke.mjs` |
| **Estimated runtime** | ~15s (vitest 전체) + 스모크 별도 |

---

## Sampling Rate

- **After every task commit:** 대상 vitest 파일 — `pnpm --filter <pkg> exec vitest run <file>`
- **After every plan wave:** `CI=true pnpm -r --parallel run test` + 관련 bash/mjs 스모크
- **Before `/gsd-verify-work`:** 전 스위트 그린 + `web_share_smoke.sh` / `realtime_events_smoke.mjs` / `place_seq_concurrency.sh` exit 0
- **Max feedback latency:** ~15s (unit) / 스모크는 wave gate

---

## Per-Task Verification Map

> Planner가 PLAN.md 작성 시 task별로 채운다. 아래는 RESEARCH §Validation Architecture의 Req→Test 매핑 시드.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| AUTH-08 | 익명 signup→is_anonymous·role·profiles.display_name | integration(SQL smoke) | `bash supabase/tests/web_share_smoke.sh` | ✅ 확장 |
| AUTH-08 | 재접속 동일 신원(getUser→member면 게이트 스킵) | unit(web) | `vitest run guest-surface` | ❌ Wave 0 |
| SHARE-02 | share_mode별 렌더 분기(places/dates/both) | unit(web) | `vitest run guest-surface` | ❌ Wave 0 |
| SHARE-03 | lazy 게이트: 첫 액션→닉네임→signInAnonymously→join_moa→재개 | unit(web, mocked) | `vitest run guest-surface` | ❌ Wave 0 |
| SHARE-03 | 익명 멤버 RLS 통과(places INSERT·votes·trip_messages) | integration(SQL smoke) | `bash supabase/tests/web_share_smoke.sh` | ✅ 확장 |
| SHARE-03 | 날짜투표 device_token=auth.uid 저장·dedup | unit(api)+smoke | `vitest run date-polls` | ✅ 확장 |
| SHARE-04 | 게스트 INSERT가 moa 채널 fan-out(비멤버 0건) | integration(mjs) | `node supabase/tests/realtime_events_smoke.mjs` | ✅ 확장 |
| SHARE-04 | 순번 #N+1 이어짐(게스트 추가) | integration(SQL) | `bash supabase/tests/place_seq_concurrency.sh` | ✅ 확장 |
| D-03 | linkIdentity 진입점 렌더 + provider:'kakao' 1회 | unit(web) | `vitest run guest-promote` | ❌ Wave 0 |
| 0029 | public_trip_poll(slug) anon read 반환 | integration(SQL smoke) | 0029 스모크(신규) | ❌ Wave 0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/app/t/[slug]/_components/guest-surface.test.tsx` — 세션 lifecycle·share_mode 분기·lazy 게이트(SHARE-02/03·AUTH-08 재접속)
- [ ] `apps/web/app/t/[slug]/_components/guest-promote.test.tsx`(또는 login 확장) — linkIdentity 진입점(D-03)
- [ ] `supabase/tests/*` 확장: 익명(비 device_token) 세션의 RLS/realtime/seq_no 케이스 append (기존 하네스 3종)
- [ ] 0029 스모크: `public_trip_poll(slug)` anon 200 + poll_code 반환
- [ ] Supabase 익명 세션 vitest 목킹 공유 픽스처(`auth.getUser`/`signInAnonymously`/`linkIdentity`) — 기존 `login.test.tsx` mock 패턴 재사용

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 2-브라우저 라이브 게스트 참여(호스트+게스트 링크) | SHARE-04 | 실시간 크로스-클라이언트 수렴은 2 세션 동시 필요 | 호스트 /moa + 게스트 시크릿 /t/[slug] → 찜·추가→호스트 실시간 반영·#N+1 |
| Manual linking 활성화 후 카카오 승격 | D-03 | Supabase 대시보드/config 설정 + 실 카카오 OAuth | linkIdentity 후 익명 이력 유지 확인 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (⚠️ web `test`=watch — commands use `vitest run`/`CI=true`)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
