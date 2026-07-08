---
phase: 24
slug: host-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^1.6.0 (jsdom, globals, RTL) — apps/web · vitest — packages/core·api |
| **Config file** | `apps/web/vitest.config.mts` (include: `__tests__/**/*.test.{ts,tsx}`, alias `@`) |
| **Quick run command** | `pnpm --filter web test:run` |
| **Full suite command** | `pnpm --filter @moajoa/core test:run && pnpm --filter @moajoa/api test:run && pnpm --filter web test:run` — **`pnpm -r test`는 watch 모드로 hang (금지)** |
| **Estimated runtime** | ~60 seconds (3패키지 순차) |

주의: 테스트 파일은 `apps/web/__tests__/`에 배치 — co-located `_components/*.test.tsx`는 include 글롭이 못 잡음 (19-04 실측 deviation).

---

## Sampling Rate

- **After every task commit:** 해당 패키지만 `pnpm --filter <pkg> test:run` + `pnpm --filter <pkg> typecheck`
- **After every plan wave:** core→api→web 순차 3종 test:run + `pnpm --filter web build`
- **Before `/gsd-verify-work`:** 3패키지 그린 + build PASS + 로컬 realtime 스모크
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Task ID 매핑은 플래닝 시 채움. Requirement → 검증 명령 계약은 아래가 소스.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | AUTH-07 | — | 카카오 버튼 → signInWithOAuth('kakao') 호출 | unit (mock client) | `pnpm --filter web test:run -- login` | ❌ W0 | ⬜ pending |
| TBD | — | — | ONBOARD-03 | — | 4단계 완료 → TripCreateDraft parse 성공 + 생성 호출 | component (RTL) | `pnpm --filter web test:run -- onboarding` | ❌ W0 | ⬜ pending |
| TBD | — | — | ONBOARD-04 | — | 미정→dates null 통과 / 확정→range 두 탭 | component | `pnpm --filter web test:run -- onboarding` | ❌ W0 | ⬜ pending |
| TBD | — | — | ONBOARD-05 | — | 링크·장소 담기·건너뛰기 → 시드 일괄 처리 | component + unit | `pnpm --filter web test:run -- onboarding` | ❌ W0 | ⬜ pending |
| TBD | — | — | MOA-02 | — | sortByLove comparator (love desc, seq asc, 표기 불변) | unit (순수함수) | `pnpm --filter web test:run -- sort` | ❌ W0 | ⬜ pending |
| TBD | — | — | MOA-03 | — | 링크 추가→addLink+triggerExtraction 호출·분석중 행 | component (mock) | `pnpm --filter web test:run -- place-list` | ❌ W0 | ⬜ pending |
| TBD | — | — | MOA-04 | — | 검색→resolve-place invoke→add_manual_place | component (mock) | `pnpm --filter web test:run -- add-sheet` | ❌ W0 | ⬜ pending |
| TBD | — | — | MOA-05 | — | 행 탭 아코디언 4요소·마커탭 스크롤+펼침 | component + manual(지도) | `pnpm --filter web test:run -- place-list` | ❌ W0 | ⬜ pending |
| TBD | — | — | MOA-06 | — | memberColor 순수함수(호스트 브랜드·join순 순환) | unit | `pnpm --filter web test:run -- member-color` | ❌ W0 | ⬜ pending |
| TBD | — | — | SHARE-01 | — | 모드 선택→shareMoa→URL 복사·날짜확정 시 2택 | component (mock clipboard) | `pnpm --filter web test:run -- share-sheet` | ❌ W0 | ⬜ pending |
| TBD | — | — | 0026 publication | — | publication 등록 후 postgres_changes 실수신 | script/manual smoke | `supabase/tests/realtime_publication_smoke.sh` (23-01 bash 하네스 선례) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm install` — stale supabase-js 실체화 (테스트 이전의 환경 게이트)
- [ ] `apps/web/__tests__/onboarding.test.tsx` — ONBOARD-03/04/05 stubs
- [ ] `apps/web/__tests__/place-sort.test.ts` — MOA-02 comparator
- [ ] `apps/web/__tests__/member-color.test.ts` — MOA-06 배정 함수
- [ ] `apps/web/__tests__/place-list.test.tsx` — MOA-03/05 (분석중 행·아코디언)
- [ ] `apps/web/__tests__/add-sheet.test.tsx` — MOA-04
- [ ] `apps/web/__tests__/share-sheet.test.tsx` — SHARE-01
- [ ] `supabase/tests/realtime_publication_smoke.sh` — 0026 publication + 이벤트 수신
- 프레임워크 설치 불필요 — vitest·RTL·jsdom 전부 기존

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 카카오 실로그인 e2e | AUTH-07 | provider redirect URI가 프로덕션 기준 — 로컬 불가 (23-07 잠금) | Vercel Preview에서 브라우저 UAT, 로컬은 이메일 대체 |
| 추출 완료 실시간 반영·핀 등장 | MOA-03, D-14 | Realtime 이벤트 + 지도 렌더는 브라우저 통합 동작 | 로컬 2탭 브라우저 스모크 (verify-work) |
| 지도 fitBounds·마커 탭 스크롤+펼침 | MOA-05, D-16 | Google Maps 실렌더 필요 | 로컬 브라우저 UAT |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
