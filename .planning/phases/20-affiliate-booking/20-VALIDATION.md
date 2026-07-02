---
phase: 20
slug: affiliate-booking
status: signed
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-02
signed_at: 2026-07-02
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (packages/core, packages/api, apps/web) / jest 29.x (apps/ios, `--watchman=false`) |
| **Config file** | per-package (packages/core, packages/api vitest; apps/ios jest.config) |
| **Quick run command** | `pnpm --filter <changed-package> test` |
| **Full suite command** | `pnpm -r test && pnpm -r typecheck` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <changed-package> test`
- **After every plan wave:** Run `pnpm -r test && pnpm -r typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T2 | 20-01 | 1 | GAP-19D | T-20-SC | override 갱신·단일 해석 (조용한 no-op 방지) | resolution check | `pnpm why @supabase/supabase-js` | n/a | ⬜ pending |
| 01-T3 | 20-01 | 1 | GAP-19D | T-20-SC | 전체 베이스라인 무회귀 (core 77/api 35/web 65/ios 87) | unit (4 suites) | `pnpm --filter <pkg> test` ×4 + web build | ✅ 기존 | ⬜ pending |
| 02-T1 | 20-02 | 2 | BOOK-02, ATTR-02 | T-20-07 | 헬퍼-only 정책·EXISTS 0·append-only | grep gates | `grep -c "create policy" 0021` 등 | ❌ 신설 | ⬜ pending |
| 02-T3 | 20-02 | 2 | BOOK-02, ATTR-02 | T-20-02/03/05 | RLS 매트릭스 A~F (위조 INSERT 거부·비멤버 0행) | integration (pg, BEGIN…ROLLBACK) | node pg 스크립트 (pooler) | ❌ Docker 부재 — pooler 경유 | ⬜ pending |
| 03-T1 | 20-03 | 2 | BOOK-01, BOOK-03 | T-20-01 | 1회 인코딩·URLSearchParams-only·marker 하드코딩 0 | unit | `pnpm --filter @moajoa/core test -- booking` | ✅ booking.test.ts 확장 | ⬜ pending |
| 03-T2 | 20-03 | 2 | BOOK-01 | — | D-08 판정 경계 + D-09 9키 정합 | unit | `… test -- category` + `… test -- booking-map` | ❌ booking-map.test.ts 신설 | ⬜ pending |
| 03-T3 | 20-03 | 2 | BOOK-02 | — | D-10 파생 + D-13 보존 불가침 | unit | `… test -- checklist` | ❌ checklist.test.ts 신설 (Wave 0) | ⬜ pending |
| 04-T1/T2 | 20-04 | 3 | BOOK-02, ATTR-02 | T-20-02/05/11 | RLS-only·파생 로직 api 금지·'확인함' 전이 단일 경로 | unit (TDD RED→GREEN) | `pnpm --filter @moajoa/api test -- bookings` | ❌ bookings.test.ts 신설 (Wave 0) | ⬜ pending |
| 05-T1 | 20-05 | 4 | ATTR-02 | T-20-04/13 | 오픈-선행(로깅 논블로킹)·CSPRNG·env-only | unit (jest) | `pnpm --filter @moajoa/ios test -- booking-open --watchman=false` | ❌ 신설 (Wave 0) | ⬜ pending |
| 05-T2 | 20-05 | 4 | BOOK-03 | — | URL 지식 격리(onView 콜백만)·가격 자리 구조 | unit (RNTL) | `… test -- compare-frame-card --watchman=false` | ❌ 신설 | ⬜ pending |
| 06-T1~T3 | 20-06 | 5 | BOOK-01, BOOK-03 | T-20-01 | D-04 게이트·D-08 strip·19 분기 무손상 | unit (RNTL) | `… test -- plan --watchman=false` | ✅ plan.test.tsx 확장 | ⬜ pending |
| 07-T1~T3 | 20-07 | 5 | BOOK-02 | T-20-05/15 | 3단 상태·D-13 보존·Zod title 경계 | unit (RNTL) | `… test -- checklist-row` + `… test -- book` | ❌ 신설 2건 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/checklist.test.ts` — BOOK-02 파생/보존 규칙 (20-03 Task 3이 구현과 동시 신설)
- [ ] `packages/api/src/queries/bookings.test.ts` — BOOK-02 쿼리 계약 (20-04 Task 1 RED가 구현보다 먼저 커밋)
- [ ] `apps/ios/__tests__/booking-open.test.ts` — ATTR-02 오픈-선행 계약 (20-05 Task 1)
- 프레임워크 설치 불필요 (vitest/jest 기설치·기동작)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 시스템 브라우저 쿠키 보존 + 검색 딥링크 실착지 | ATTR-02 / BOOK-03 | Klook/KKday 봇차단(403) — 실기기만 렌더 확인 가능 (RESEARCH confidence LOW 항목 A1/A2) | 실기기에서 카드 탭 → Safari 착지 페이지 확인 (검색결과에 장소명) |
| TP 대시보드 클릭·SubID 집계 (A4/A3) | ATTR-02 | 첫 실클릭 후에만 대시보드 확인 가능 | [보기] 실클릭 → Travelpayouts 통계에 marker-dot SubID 집계 확인 |
| 복귀 '확인함' 전이 + D-13 보존 | BOOK-02 | AppState 전이 + 실 DB round-trip 필요 | [보기] → Safari → 복귀 → 행 '확인함' + 힌트; 플랜 재생성 후 체크 항목 보존 + '플랜에 없음' 배지 |
| presence 2-브라우저 수렴 (GAP-19D) | GAP-19D | 원격 realtime + 2 클라이언트 필요 | /poll/[code] 2 브라우저 → 양쪽 "지금 2명 보는 중" 수렴 + iOS realtime 스모크 + 매직링크 회귀 0 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
