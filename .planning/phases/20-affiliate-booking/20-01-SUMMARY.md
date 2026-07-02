---
phase: 20-affiliate-booking
plan: 01
subsystem: infra
tags: [supabase-js, supabase-ssr, pnpm-override, dependency-upgrade, presence, realtime]
requires: []
provides:
  - "supabase-js 2.110.0 단일 해석 (모노레포 전체, root pnpm override)"
  - "@supabase/ssr 0.12.0 (apps/web, peer ^2.108.0 정합)"
  - "realtime-js presence_state 프로토콜 fix 포함 버전 (GAP-19D 해소 전제)"
affects:
  - "packages/api (supabase client)"
  - "apps/web (SSR auth + realtime)"
  - "apps/ios (realtime + auth)"
tech-stack:
  added: []
  patterns:
    - "root pnpm.overrides 정확 핀으로 모노레포 단일 버전 강제 (override 미갱신 = 조용한 no-op 함정)"
    - "이 Windows 머신의 node_modules layout은 apps/ios에서 install 실행해야 유지됨 (node-linker=hoisted, apps/ios/.npmrc)"
key-files:
  created: []
  modified:
    - package.json
    - packages/api/package.json
    - apps/web/package.json
    - apps/ios/package.json
    - pnpm-lock.yaml
decisions:
  - "2.110.0 채택 (fallback 2.109.0 불필요 — 전 suite 무회귀로 보수 핀 미사용)"
  - "supabase/functions deno.lock 무접촉 (jsr 핀은 별도 세계 — RESEARCH Pitfall 6)"
metrics:
  duration: "~35m (패키지 정당성 게이트 사용자 승인 대기 포함)"
  completed: "2026-07-02"
status: complete
---

# Phase 20 Plan 01: supabase-js 모노레포 업그레이드 Summary

**One-liner:** root pnpm override + 4개 manifest로 supabase-js 2.45.4→2.110.0, @supabase/ssr 0.5.1→0.12.0 단일 해석 업그레이드 — 전체 베이스라인 green (core 77 / api 42 / web 65 / ios 89), 코드 무수정.

## What Was Done

### Task 1: 패키지 정당성 게이트 (T-20-SC, blocking-human)
[SUS: too-new] 플래그 2건에 대해 npm registry 증거 수집 후 사용자 승인 획득:

| 항목 | @supabase/supabase-js 2.110.0 | @supabase/ssr 0.12.0 |
|---|---|---|
| repository | github.com/supabase/supabase-js (공식 org) | github.com/supabase/ssr (공식 org) |
| publisher | GitHub Actions OIDC (trusted publishing) | GitHub Actions OIDC |
| dist-tag latest | 2.110.0 (대상과 일치) | 0.12.0 (대상과 일치) |
| install/postinstall 훅 | 없음 | 없음 |
| 주간 다운로드 | 20,607,724 | 4,488,431 |
| 생성일 | 2020-01-17 (슬롭스쿼트 아님) | — |

이상 징후 0건. 사용자 "approved" 수신 후 설치 진행. (T-20-SC mitigate 이행)

### Task 2: 버전 bump + install + 해석 검증 — commit `f3ca8f9`
- root `pnpm.overrides["@supabase/supabase-js"]`: "2.45.4" → "2.110.0" (Pitfall 5 — override 미갱신 시 조용한 no-op 방지)
- packages/api: `^2.110.0`
- apps/web: `^2.110.0` + `@supabase/ssr ^0.12.0` (peer ^2.108.0 짝)
- apps/ios: `^2.110.0`
- lockfile 재생성. diff는 정확히 package.json 4개 + pnpm-lock.yaml (그 외 0)
- `pnpm why @supabase/supabase-js -r`: 2.110.0만 존재, 2.45.4는 0회
- supabase/functions (deno.lock jsr 핀) 무접촉 — `git status --porcelain supabase/functions` 빈 출력

### Task 3: 전체 회귀 게이트 — 최종 layout에서 전부 green
| Gate | 결과 | 베이스라인 대비 |
|---|---|---|
| core test | 77 passed, exit 0 | 77 유지 |
| api test | 42 passed, exit 0 | 35 이상 |
| web test | 65 passed, exit 0 | 65 유지 |
| ios test (`--watchman=false`) | 89 passed (13 suites), exit 0 | 87 이상 |
| typecheck (core/api/web/ios) | 전부 exit 0 | — |
| `pnpm --filter @moajoa/web build` | Compiled successfully, exit 0, @supabase peer warning 0 | — |

Fallback(2.109.0 보수 핀)은 무회귀로 미사용 — 2.110.0 확정.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] apps/ios jest 전 suite 실패 (`Cannot find module 'babel-preset-expo'`) — node_modules layout 복원**
- **Found during:** Task 3 (ios 게이트)
- **Issue:** Task 2의 root `pnpm install`이 node_modules를 pnpm isolated layout으로 재작성. 이 repo는 `apps/ios/.npmrc`의 `node-linker=hoisted`(RN podspec/Metro flat 해석 요구 — 커밋 fbab9e2, 4d6469c)로 flat layout이 전제인데, root에서 실행한 install은 이를 적용하지 않아 babel-preset-expo 등 전이 의존성이 미해석 → jest 13 suites 전멸.
- **Fix:** `apps/ios` 디렉토리 안에서 `pnpm install` 재실행 → hoisted linker 적용, flat root node_modules(815 entries) 복원. **파일·lockfile 변경 0** (환경 layout만 복원). 이후 4개 suite + build 전부 최종 layout에서 재실행하여 green 확인.
- **Files modified:** 없음 (node_modules only)
- **Commit:** 해당 없음 (커밋 대상 변경 없음)
- **운영 노트:** 이 머신에서 향후 `pnpm install`은 apps/ios 안에서 실행해야 ios jest가 유지됨. root에서 실행하면 isolated로 뒤집혀 재발.

그 외 deviation 없음 — 플랜 그대로 실행.

## Authentication Gates

없음 (Task 1은 auth 게이트가 아닌 supply-chain 정당성 게이트 — 위 Task 1 참조).

## Verification

- `git log --oneline -2`: `f3ca8f9 chore(20-01)...` — 예약 도메인 파일(packages/core/src/booking* 등) 미포함, 격리 확인
- 전 suite green + web build PASS (위 표)

## Known Stubs

없음 — 이 플랜은 버전 bump 전용, 앱 코드 무수정.

## Deferred to Phase UAT

- **presence 2-브라우저 실측** (GAP-19D 최종 확인): /poll/[code] 2개 브라우저 → 양쪽 "지금 2명 보는 중" 수렴 + iOS sim `subscribePollChannel` 스모크 + 매직링크 로그인 회귀 0 — 원격 realtime + 사람 눈 필요, phase verify UAT 항목.

## Self-Check: PASSED

- 파일 6건 존재 확인 (manifest 4 + lockfile + SUMMARY)
- 커밋 f3ca8f9 존재 확인
