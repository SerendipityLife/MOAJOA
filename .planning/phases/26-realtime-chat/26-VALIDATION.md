---
phase: 26
slug: realtime-chat
status: signed
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-10
signed_at: 2026-07-10
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `26-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^1.6.0 (jsdom, globals, RTL) — apps/web · vitest — packages/core·api |
| **Config file** | `apps/web/vitest.config.mts` (include: `__tests__/**/*.test.{ts,tsx}`, alias `@`) |
| **Quick run (web)** | `pnpm --filter web test:run` |
| **Quick run (api)** | `pnpm --filter @moajoa/api test` |
| **Full suite** | `pnpm --filter @moajoa/core test:run && pnpm --filter @moajoa/api test && pnpm --filter web test:run` — **`pnpm -r test`는 watch 모드로 hang (금지)** |
| **Estimated runtime** | ~60 seconds (3패키지 순차) |

주의: 웹 테스트 파일은 `apps/web/__tests__/`에 배치 — co-located `_components/*.test.tsx`는 include 글롭이 못 잡음(19-04·24 실측). 실시간은 유닛에서 test-seam(`initialMessages`/seeded presenceState)으로 우회 — postgres_changes 라이브는 manual/Preview 몫(배포 게이트).

---

## Sampling Rate

- **After every task commit:** 해당 패키지만 `pnpm --filter <pkg> test:run`(web) / `test`(core·api) + `pnpm --filter <pkg> typecheck`
- **After every plan wave:** core→api→web 순차 test:run + `pnpm --filter web build`
- **Before `/gsd-verify-work`:** 3패키지 그린 + build PASS + 원격 0028 반영(publication+user_id 트리거) 후 2-브라우저 라이브 스모크(메시지 수신·presence 수렴)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 0028 migration | 26-01 | 1 | CHAT-01/02 (기반) | publication add + `user_id` `auth.uid()` 트리거 (V4 RLS 무우회) | psql 단언 (pg_publication_tables=trip_messages, pg_trigger 존재) + `db reset` 42P17=0 | `bash` 하네스 / `supabase db reset` | ❌ 26-01이 생성 | ⬜ pending |
| chat.ts 쿼리 | 26-01 | 1 | CHAT-01 | `sendTripMessage` insert에 `user_id` 키 부재(트리거 채움)·nickname 스냅샷·`listTripMessages` asc·RLS 직접테이블 | unit (mock client) | `pnpm --filter @moajoa/api test` | ❌ 26-01이 생성 (`chat.test.ts`) | ⬜ pending |
| moa-chat 표시 | 26-02 | 1 | CHAT-01/02/03 | 표시 전용(channel/broadcast/api 미접촉)·`initialMessages` seam·mine=user_id·`#N` 칩 resolvable 시만·presence strip | component (RTL, controlled props) | `pnpm --filter web test:run` | ❌ 26-02가 생성 (`moa-chat.test.tsx`) | ⬜ pending |
| moa-tab-bar | 26-02 | 1 | CHAT-01 (IA) | 클라이언트 상태 탭(next/link·usePathname 미사용)·TABS 확장가능 | component (RTL) | `pnpm --filter web test:run` | ❌ 26-02가 생성 | ⬜ pending |
| island 배선 | 26-03 | 2 | CHAT-01/02 | 3번째 postgres_changes 바인딩(trip_messages INSERT) `.subscribe()` 전 체이닝·append+dedup(reconcile 미접촉)·presence track/sync 동일 채널·2번째 channel() 금지 | unit (channel fake, SUBSCRIBED cb) | `pnpm --filter web test:run` | ❌ 26-03이 `moa-island.test.tsx` 확장 | ⬜ pending |
| page seed | 26-03 | 2 | CHAT-01 | `listTripMessages` Promise.all 시드 + `nameIds`에 `user.id` 추가(Pitfall 8)·Zod parse 경계 | (build+typecheck) | `pnpm --filter web build` | ❌ 26-03이 편집 | ⬜ pending |
| 멘션 루프 | 26-04 | 3 | CHAT-03 | 답장→채팅탭+reply prefill·`#N` 칩 탭→모으기탭+`openPlaceId`+expanded+**하이라이트 큐**·deleted place 칩 소멸(set null) | unit (RTL) | `pnpm --filter web test:run` | ❌ 26-04가 `moa-island.test.tsx` 확장 | ⬜ pending |

---

## Wave 0 Gaps (테스트 신규/확장)

- [ ] `packages/api/src/queries/chat.test.ts` — CHAT-01 쿼리 계약(asc 정렬·user_id 부재·reply_to_place_id 매핑·error throw)
- [ ] `apps/web/__tests__/moa-chat.test.tsx` — 표시 채팅(말풍선/전송/`#N` 칩/presence strip), controlled-prop
- [ ] `apps/web/__tests__/moa-island.test.tsx` 확장 — 탭 전환·메시지 append/dedup seam·presence 카운트·답장/칩 배선·**3번째 바인딩 존재 단언**
- [ ] 컴포넌트에 `initialMessages`(+seeded presence) test seam 추가

---

## Manual / Deploy Gate (유닛 밖)

- **0028 원격 반영**: repo의 Supabase↔GitHub 연동이 main push 시 자동 적용(이번 세션 확인). 반영 전엔 postgres_changes 무음 no-op + send not-null 위반 가능 → 라이브 검증 차단.
- **2-브라우저 라이브**: 메시지 실시간 수신·presence "N명 보는 중" 수렴·`#N` 칩 왕복 — `/gsd-verify-work 26` 몫.
- **게스트 채팅 참여**: Phase 25(게스트 통합 공유화면) 연동 후 완결 — 이번 phase는 호스트·멤버 기준(D-09).

---

**Sign-off:** nyquist_compliant — 모든 requirement가 유닛 test-seam으로 샘플링되고(라이브는 배포 게이트 명시), 각 task에 automated `<verify>` 존재, watch 모드·E2E·MISSING 참조 없음.
