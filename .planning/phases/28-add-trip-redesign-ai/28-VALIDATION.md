---
phase: 28
slug: add-trip-redesign-ai
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
updated: 2026-07-13
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (web: jsdom + @testing-library, api/core: node) |
| **Config file** | `apps/web/vitest.config.ts` (include `__tests__/**` — 테스트는 반드시 `apps/web/__tests__/`에, 25-02/25-04 선례) |
| **Quick run command** | `pnpm --filter @moajoa/web test -- --run <파일>` |
| **Full suite command** | `pnpm --filter @moajoa/web test -- --run` + `pnpm --filter @moajoa/api test` + `pnpm --filter @moajoa/core test` + `pnpm --filter @moajoa/ios test`(무회귀 확인용) |
| **Estimated runtime** | ~90 seconds (패키지 순차) |

---

## Sampling Rate

- **After every task commit:** 해당 영역 파일 단위 `pnpm --filter @moajoa/web test -- --run <파일>`
- **After every plan wave:** web+api+core 전 스위트 `--run` + `tsc --noEmit` + `next build`
- **Before `/gsd-verify-work`:** 전 스위트(core·api·web·ios) 그린 + build PASS + grep 게이트(iOS diff 0 · 기존 마이그레이션 무수정 · `.js` import 0 · 신규 hex 0)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

19개 태스크(6 플랜 × 3 + 28-06 EF 배포 체크포인트). **모든 태스크가 `<automated>` verify를 갖는다** — 체크포인트 2종도 자동 게이트를 동반한다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-T1 | 01 | 1 | SC-2, SC-6 | T-28-02, T-28-03 | Day 수 상한 단일 소스(`Limits.TripDayCountMax`=30)가 CHECK·Zod에 동일 적용 — 정상 장기 입력이 INSERT에서 거부되지 않음. 기존 마이그레이션 append-only | unit + grep gate | `pnpm --filter @moajoa/core test && pnpm --filter @moajoa/core typecheck && pnpm --filter @moajoa/web typecheck` | ✅ `packages/core/src/schemas/trip.test.ts` (확장) | ⬜ pending |
| 28-01-T2 | 01 | 1 | SC-2 | T-28-01 | `updateTrip(day_count)` 쓰기는 기존 owner-only RLS(0016) 승계 — 신규 RLS 0 | unit (mock chain) | `pnpm --filter @moajoa/api test && pnpm --filter @moajoa/api typecheck` | ✅ `packages/api/src/queries/trips.test.ts` (확장) | ⬜ pending |
| 28-01-T3 🔒 | 01 | 1 | SC-2 | T-28-04 | 원격 스키마 적용 게이트 — 미적용 시 라이브에서 day_count 저장이 조용히 실패 | checkpoint + grep | `grep -q 'day_count' packages/api/src/types/database.ts && pnpm --filter @moajoa/api typecheck && pnpm --filter @moajoa/web typecheck` | ✅ typegen 산출물 | ⬜ pending |
| 28-02-T1 | 02 | 1 | SC-1 | — | 신규 hex 0 · 토큰 클래스만 | unit (jsdom) | `pnpm --filter @moajoa/web test -- --run __tests__/select-pill.test.tsx` | ❌ **Wave 0 신규** | ⬜ pending |
| 28-02-T2 | 02 | 1 | SC-1 | — | 기간 pill 한 벌 — 위저드·게이트 시트가 공유(드리프트 0) | unit (jsdom) | `pnpm --filter @moajoa/web test -- --run __tests__/duration-pills.test.tsx` | ❌ **Wave 0 신규** | ⬜ pending |
| 28-02-T3 | 02 | 1 | SC-1, SC-6 | — | `label` 미전달 시 기존 마커 URL 바이트 동일(추가자 색 무회귀) | unit | `pnpm --filter @moajoa/web test -- --run __tests__/marker-svg.test.ts` | ✅ 기존 10케이스 확장 | ⬜ pending |
| 28-03-T1 | 03 | 2 | SC-4, SC-5 | T-28-08 | `GeneratePlanRequestSchema`에 Day 수 필드 **없음**(스푸핑 표면 차단, region-scoped grep) · iOS 동작 변화 명시 | unit + region grep | `pnpm --filter @moajoa/core test && pnpm --filter @moajoa/api test && pnpm --filter @moajoa/ios test` | ✅/❌ 혼합 (plan.test.ts 신규 가능) | ⬜ pending |
| 28-03-T2 | 03 | 2 | SC-5 | T-28-09, T-28-10 | `enforcePinnedPlacements` — 입력 place 교집합만 수용(타 trip·환각 id 무시) + day_index 클램프 | Deno test | `deno task --cwd supabase/functions/generate-plan test` | ✅ `claude.test.ts` (확장) | ⬜ pending |
| 28-03-T3 | 03 | 2 | SC-4, SC-5 | T-28-08, T-28-13 | Day 수는 서버가 `trips` 행에서 읽음(요청 바디 미수용) · `validatePlanIds` → `enforcePinnedPlacements` 호출 순서 | Deno check + test | `deno check --config supabase/functions/generate-plan/deno.json supabase/functions/generate-plan/index.ts && deno task --cwd supabase/functions/generate-plan test` | ✅ 기존 하네스 | ⬜ pending |
| 28-04-T1 | 04 | 2 | SC-2 | T-28-14 | `TripCreateDraftSchema.parse` 제출 게이트 유지 + **상한 초과 → throw로 INSERT 차단**(3차 방어) | unit (순수 매퍼) | `pnpm --filter @moajoa/web test -- --run __tests__/build-draft.test.ts` | ✅ 기존 **5**케이스 확장 | ⬜ pending |
| 28-04-T2 | 04 | 2 | SC-1, SC-2 | T-28-14 | 캘린더 range `max` 상한(1차 방어) — 31일 이상 선택 불가 + 안내 카피 | unit (jsdom) | `pnpm --filter @moajoa/web test -- --run __tests__/onboarding.test.tsx` | ✅ 기존 **4**케이스 확장 | ⬜ pending |
| 28-04-T3 | 04 | 2 | SC-1, SC-3 | T-28-14, T-28-15, T-28-17 | `canProceed` 상한 게이트(2차 방어) · AddContentTabs diff 0(URL 검증 우회 차단) · disabled 속성으로 비활성 전달 | unit (jsdom) + grep gate | `pnpm --filter @moajoa/web test -- --run __tests__/onboarding.test.tsx && pnpm --filter @moajoa/web typecheck` | ✅ 기존 **4**케이스 확장 | ⬜ pending |
| 28-05-T1 | 05 | 3 | SC-4, SC-5 | T-28-18 | 비-owner에게 기간 게이트 시트를 열지 않음(A-9, UI 게이트) — DB owner-only RLS와 심층방어 2겹 | unit (jsdom) | `pnpm --filter @moajoa/web test -- --run __tests__/duration-gate-sheet.test.tsx __tests__/day-select-sheet.test.tsx` | ❌ **Wave 0 신규** | ⬜ pending |
| 28-05-T2 | 05 | 3 | SC-5 | T-28-22 | additive optional prop — 미전달 시 기존 렌더 동일(18케이스 회귀 앵커) · React 기본 이스케이프 | unit (jsdom) | `pnpm --filter @moajoa/web test -- --run __tests__/place-list.test.tsx` | ✅ 기존 **18**케이스 확장 | ⬜ pending |
| 28-05-T3 | 05 | 3 | SC-4, SC-5 | T-28-19, T-28-20, T-28-21 | `generating` 단일 boolean 연타 가드(유료 API 이중 지출 차단) · 금지 제스처 핸들러 grep 0 + `place-sheet.tsx` diff 0(HC-5) | unit (jsdom) + grep gate | `pnpm --filter @moajoa/web test -- --run __tests__/plan-section.test.tsx` | ❌ **Wave 0 신규** | ⬜ pending |
| 28-06-T1 | 06 | 4 | SC-4 | — | RSC seed 유지(`'use client'` 0) · 지도 인스턴스 1회 생성(재init 0) | unit (jsdom) + grep gate | `pnpm --filter @moajoa/web test -- --run __tests__/moa-island.test.tsx && pnpm --filter @moajoa/web typecheck` | ✅ 기존 확장 | ⬜ pending |
| 28-06-T2 | 06 | 4 | SC-4, SC-5 | T-28-23~28 | `runGenerate` 연타 가드 · `updateTrip` 실패 fail-closed(조용한 무시 금지) · plan 진행 채널을 moa 채널과 분리 · `plan_items` realtime 미등록 | unit (jsdom) + grep gate | `pnpm --filter @moajoa/web test -- --run __tests__/moa-island.test.tsx` | ✅ 기존 확장 | ⬜ pending |
| 28-06-T3 | 06 | 4 | SC-5, SC-3 | T-28-15 | AddContentTabs diff 0 — `new URL()` 검증·`resolve-place` 계약 유지 | unit (jsdom) + grep gate | `pnpm --filter @moajoa/web test -- --run __tests__/add-sheet.test.tsx` | ✅ 기존 **5**케이스 확장 | ⬜ pending |
| 28-06-T4 🔒 | 06 | 4 | SC-4, SC-5 | — | **EF 원격 배포 게이트** — 미배포 시 라이브에서 day_count fallback·D-21 고정이 반영되지 않음(코드 머지 ≠ 프로덕션) | checkpoint + Deno test/check | `deno task --cwd supabase/functions/generate-plan test && deno check --config supabase/functions/generate-plan/deno.json supabase/functions/generate-plan/index.ts` | ✅ 기존 하네스 | ⬜ pending |

🔒 = blocking human-action 체크포인트 (자동 게이트 + 사용자 resume-signal 둘 다 필요)
*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**실측 테스트 케이스 수 (하드코딩 금지 — 이 표가 기준):**
`onboarding.test.tsx` **4** · `add-sheet.test.tsx` **5** · `place-list.test.tsx` **18** · `build-draft.test.ts` **5** · `marker-svg.test.ts` **10**
(`grep -cE "^\s*(it|test)\(" <파일>`로 재확인 가능. 플랜의 "기존 N케이스 무회귀" 문구는 이 숫자와 일치해야 한다.)

---

## Wave 0 Requirements

Wave 0 = 아직 존재하지 않는 테스트 파일. 전부 **실재하는 태스크가 소유**하므로 별도 선행 플랜이 필요 없다.

- [ ] `apps/web/__tests__/select-pill.test.tsx` — SC-1 선택 상태 → **28-02 Task 1이 생성**
- [ ] `apps/web/__tests__/duration-pills.test.tsx` — SC-1/SC-2 기간 pill 6종 → **28-02 Task 2가 생성**
- [ ] `apps/web/__tests__/duration-gate-sheet.test.tsx` + `day-select-sheet.test.tsx` — D-13 기간 미정 게이트 · D-20 보류 → **28-05 Task 1이 생성**
- [ ] `apps/web/__tests__/plan-section.test.tsx` — SC-4 Day 그룹/게이트 (plan fixture 포함) → **28-05 Task 3이 생성**
- [ ] `packages/core/src/schemas/plan.test.ts` · `packages/api/src/queries/plans.test.ts` — 없으면 신규 → **28-03 Task 1이 생성**(trips.test.ts의 makeChain 레시피 미러)
- [ ] 프레임워크 설치: **불필요** (기존 vitest + Deno test 하네스)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 실 generate-plan N-Day 생성·진행 broadcast | SC-4 | 유료 API(Claude·Routes)·realtime — jsdom 불가 | 로컬 supabase + `functions serve` 스모크 → 배포 후 UAT |
| 라이브 EF 배포 확인 (날짜 미정 + 기간 pill 3일 → Day 탭 3개) | SC-4 | 프로덕션 배포 상태는 코드에서 관측 불가 | **28-06 Task 4 체크포인트**의 `how-to-verify` 스모크 2종 |
| 라이브 D-21 고정 (수동 배치 → 재생성 → 그 Day 유지) | SC-5 | 유료 API 왕복 필요 | **28-06 Task 4 체크포인트** 스모크 2 |
| 시트 제스처 무회귀 (드래그·핀치줌·Day 탭 가로 스와이프) | SC-4 | 멀티터치 제스처 — jsdom 불가 | 실기기/시뮬 수동 확인 (커밋 3f32204 회귀 여부). 자동 게이트는 금지 핸들러 grep 0 + `place-sheet.tsx` diff 0 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — **19/19** (체크포인트 2종 포함)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — 최장 공백 0
- [x] Wave 0 covers all MISSING references — 신규 테스트 파일 6종 전부 소유 태스크 있음
- [x] No watch-mode flags — 전 커맨드가 `--run` 또는 일회성 `deno test`
- [x] Feedback latency < 90s — 파일 단위 실행은 ~10s, 전 스위트 ~90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner (2026-07-13, 플랜 체커 W5 수습)
