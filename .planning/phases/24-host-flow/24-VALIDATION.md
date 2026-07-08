---
phase: 24
slug: host-flow
status: signed
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-08
signed_at: 2026-07-08
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
- **Before `/gsd-verify-work`:** 3패키지 그린 + build PASS + 로컬 realtime 스모크 (24-07 Task 3 phase gate)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-03/T3 | 24-03 | 1 | AUTH-07 | T-24-08 | 카카오 버튼 → signInWithOAuth('kakao') 호출 | unit (mock client) | `pnpm --filter web test:run -- login` | ❌ 24-03이 생성 | ⬜ pending |
| 24-04/T3 | 24-04 | 2 | ONBOARD-03 | T-24-10 | 4단계 완료 → TripCreateDraft parse 성공 + createMoaDraft 호출 | component (RTL) | `pnpm --filter web test:run -- onboarding` | ❌ 24-04가 생성 | ⬜ pending |
| 24-04/T3 | 24-04 | 2 | ONBOARD-04 | T-24-10 | 미정→dates null / 확정→range (buildDraft 순수 매퍼) | unit + component | `pnpm --filter web test:run -- build-draft` | ❌ 24-04가 생성 | ⬜ pending |
| 24-04/T3 | 24-04 | 2 | ONBOARD-05 | T-24-11 | 링크·장소 담기·건너뛰기 → 시드 일괄 처리 | component | `pnpm --filter web test:run -- onboarding` | ❌ 24-04가 생성 | ⬜ pending |
| 24-02/T2 | 24-02 | 1 | MOA-02 | — | sortByLove comparator (love desc, seq asc, 표기 불변) | unit (순수함수) | `pnpm --filter web test:run -- place-sort` | ❌ 24-02가 생성 | ⬜ pending |
| 24-05/T3 | 24-05 | 2 | MOA-03 | T-24-14 | 분석중 행·실패 행+재시도 렌더 | component (mock) | `pnpm --filter web test:run -- place-list` | ❌ 24-05가 생성 | ⬜ pending |
| 24-07/T1 | 24-07 | 4 | MOA-03/04 | T-24-24 | 링크→addLink+triggerExtraction / 검색→resolve-place→add_manual_place | component (mock) | `pnpm --filter web test:run -- add-sheet` | ❌ 24-07이 생성 | ⬜ pending |
| 24-05/T3 | 24-05 | 2 | MOA-05 | T-24-15 | 행 탭 아코디언 4요소·openPlaceId 스크롤 | component + manual(지도) | `pnpm --filter web test:run -- place-list` | ❌ 24-05가 생성 | ⬜ pending |
| 24-06/T3 | 24-06 | 3 | MOA-05 | T-24-18 | 마커 탭 → openPlaceId + expanded (island 배선) | component (mock map) | `pnpm --filter web test:run -- moa-island` | ❌ 24-06이 생성 | ⬜ pending |
| 24-02/T1 | 24-02 | 1 | MOA-06 | T-24-04 | memberColor 순수함수(호스트 브랜드·join순 순환) | unit | `pnpm --filter web test:run -- member-color` | ❌ 24-02가 생성 | ⬜ pending |
| 24-07/T2 | 24-07 | 4 | SHARE-01 | T-24-21/22/23 | 모드 선택→shareMoa→URL 복사·날짜확정 시 2택·재공유 프리셋 | component (mock clipboard) | `pnpm --filter web test:run -- share-sheet` | ❌ 24-07이 생성 | ⬜ pending |
| 24-01/T3 | 24-01 | 1 | 0026 publication | T-24-01 | publication 등록 + owner 이벤트 수신 + 비멤버 0건 | script smoke | `bash supabase/tests/realtime_publication_smoke.sh` | ❌ 24-01이 생성 | ⬜ pending |
| 24-06/T3 | 24-06 | 3 | D-14 구독 계약 | T-24-19 | moa:{id} 단일 채널·2바인딩·removeChannel·reconcile 토스트 | component (fake channel) | `pnpm --filter web test:run -- moa-island` | ❌ 24-06이 생성 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0는 별도 plan이 아니라 **24-01 Task 1(환경 게이트) + 각 plan의 tdd 태스크가 테스트를 구현과 같은 커밋 사이클에서 생성**하는 방식으로 충족:

- [ ] `pnpm install` — stale supabase-js 실체화 → **24-01 Task 1**
- [ ] `apps/web/__tests__/login.test.tsx` → 24-03 Task 3
- [ ] `apps/web/__tests__/onboarding.test.tsx` + `build-draft.test.ts` → 24-04 Task 3
- [ ] `apps/web/__tests__/place-sort.test.ts` → 24-02 Task 2
- [ ] `apps/web/__tests__/member-color.test.ts` → 24-02 Task 1
- [ ] `apps/web/__tests__/place-list.test.tsx` → 24-05 Task 3
- [ ] `apps/web/__tests__/moa-island.test.tsx` → 24-06 Task 3
- [ ] `apps/web/__tests__/add-sheet.test.tsx` / `share-sheet.test.tsx` → 24-07 Task 1·2
- [ ] `supabase/tests/realtime_publication_smoke.sh` + `realtime_events_smoke.mjs` → 24-01 Task 2
- 프레임워크 설치 불필요 — vitest·RTL·jsdom 전부 기존

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 카카오 실로그인 e2e | AUTH-07 | provider redirect URI가 프로덕션 기준 — 로컬 불가 (23-07 잠금) | Vercel Preview에서 브라우저 UAT, 로컬은 이메일 대체. **선행: 24-01 Task 3 원격 push 완료** |
| 추출 완료 실시간 반영·핀 등장 | MOA-03, D-14 | Realtime 이벤트 + 지도 렌더는 브라우저 통합 동작 | 로컬 2탭 브라우저 스모크 (verify-work) |
| 지도 fitBounds·마커 탭 스크롤+펼침 | MOA-05, D-16 | Google Maps 실렌더 필요 | 로컬 브라우저 UAT |
| 드래그 시트 물리 (2단 앵커·플릭·스크롤 충돌) | D-09 | pointer capture는 jsdom 검증 불가 | 로컬 모바일 뷰포트 브라우저 UAT |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (24-01 Task 1 + per-plan tdd 태스크)
- [x] No watch-mode flags (`test:run`만 — `pnpm -r test` 금지 명시)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** signed 2026-07-08 (planner — 플랜 24-01~24-07 매핑 완료)
