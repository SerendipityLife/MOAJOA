---
phase: 29
slug: chat-unification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/web · packages/api · packages/core) + supabase/tests smoke scripts (bash/psql/node) |
| **Config file** | apps/web/vitest.config.ts · packages/api/vitest.config.ts |
| **Quick run command** | `CI=true pnpm --filter web test` (watch 모드 회피 — CI=true 필수) |
| **Full suite command** | `CI=true pnpm -r test && pnpm -r typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `CI=true pnpm --filter web test` (api 변경 시 `pnpm --filter @moajoa/api test` 추가)
- **After every plan wave:** Run `CI=true pnpm -r test && pnpm -r typecheck`
- **Before `/gsd-verify-work`:** Full suite green + `pnpm --filter web build` PASS
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Task ID는 plan 생성 후 planner가 채움. Requirement 축은 ROADMAP Phase 29 Success Criteria(SC1~SC4).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SC1 (dates 게스트 채팅 접근) | — | voter role로 trip_messages RLS 통과 (마이그레이션 0) | unit + smoke | `CI=true pnpm --filter web test` + `supabase/tests/web_share_smoke.sh` | ✅ | ⬜ pending |
| TBD | TBD | TBD | SC2 (같은 저장소 대화) | T-29 (poll_code join 스코프) | `join_moa_by_poll_code`는 voter 고정·slug 미노출 | smoke | 신규/확장 smoke (0018 poll_view_by_code·0029 선례) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC3 (한마디 은퇴) | — | poll-chat.tsx 삭제·postComment/deleteComment orphan 제거 | grep gate | `! grep -r "poll-chat" apps/web --include="*.tsx" -l` + `! grep -rn "postComment\|deleteComment" packages/api/src` | ✅ | ⬜ pending |
| TBD | TBD | TBD | SC4 (채팅 무회귀) | — | moa-chat/moa-island 기존 테스트 그린 유지 | unit | `CI=true pnpm --filter web test` (moa-island·moa-chat 스위트 무회귀) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] 신규 0032 RPC smoke 케이스 — `join_moa_by_poll_code` (기존 `supabase/tests/web_share_smoke.sh` append-only 확장 또는 신규 스크립트, Phase 25 선례)
- [ ] guest-surface dates 분기 테스트 확장 — 기존 `apps/web/__tests__/guest-surface.test.tsx` 앵커 재사용
