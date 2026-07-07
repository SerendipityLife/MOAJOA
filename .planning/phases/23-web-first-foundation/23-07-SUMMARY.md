---
phase: 23-web-first-foundation
plan: 07
subsystem: auth
tags: [supabase, gotrue, kakao-oauth, anonymous-auth, migrations]

# Dependency graph
requires:
  - phase: 23-web-first-foundation (23-03)
    provides: config.toml 익명 sign-in ON + [auth.external.kakao] 스위치 (로컬 절반)
  - phase: 23-web-first-foundation (23-04)
    provides: 로컬 smoke — 익명 세션·join_moa 분기·kakao authorize redirect 검증
provides:
  - 프로덕션 Supabase 익명 sign-in 토글 ON (원격 /auth/v1/signup 실증)
  - 프로덕션 Kakao provider 활성화 (원격 authorize → kauth.kakao.com 302 실증)
  - Kakao Developers 앱 설정 완료 (비즈 앱 전환 + 동의항목 3종)
  - 원격 마이그레이션 상태 실측 기록 (0016~0023 정합, 0024/0025 미적용)
affects: [phase-24-host-flow, phase-25-guest-unified-share, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: ["human-action 체크포인트로 사용자 계정 작업 분리 (21-04 Task 5 선례)"]

key-files:
  created: []
  modified: []

key-decisions:
  - "원격 db push는 phase 23 범위 외 확정 (Open Q1) — Phase 24 Preview e2e 전 0024·0025 push 필수 후속 잠금"
  - "KOE205 해결: 개인 개발자 비즈 앱 전환 + 동의항목 3종 전부 선택 동의 — GoTrue kakao scope 3종 하드코딩이 원인"

patterns-established:
  - "GoTrue kakao provider는 account_email profile_image profile_nickname 3 scope 고정 요청 — Kakao 앱은 비즈 앱 + 3 동의항목 필수"

requirements-completed: [] # AUTH-07·AUTH-08은 프로덕션 설정 절반만 — e2e 완료 마킹은 traceability대로 Phase 24/25 몫 (23-02·23-06 선례)

# Metrics
duration: ~12min active (checkpoint 대기 ~5.5h 제외)
completed: 2026-07-08
---

# Phase 23 Plan 07: 프로덕션 인증 설정 + 원격 상태 실측 Summary

**프로덕션 Supabase 익명 sign-in·Kakao provider 설정 완료(원격 실증: 익명 signup + kauth 302) + 원격 마이그레이션 0016~0023 정합·0024/0025 미적용 실측 — 코드 변경 0**

## Performance

- **Duration:** ~12min active (Task 1 실측 ~3min + 마무리; checkpoint:human-action 대기 ~5.5h 제외)
- **Started:** 2026-07-07T17:46:07Z
- **Completed:** 2026-07-07T23:30:00Z (UTC) / 2026-07-08 (KST)
- **Tasks:** 2/2 (Task 1 auto + Task 2 human-action approved)
- **Files modified:** 0 (코드·DB 변경 0 — 플랜 명세대로)

## Accomplishments

- **성공 기준 4 완결(프로덕션 절반):** Supabase 대시보드 익명 sign-in 토글 ON + Kakao provider 활성화, Kakao Developers 앱 설정(REST API key·Client Secret·Redirect URI·동의항목) — 사용자 수행, 원격 실증 완료
- **원격 마이그레이션 상태 실측(Open Q1):** push 없이 상태만 확인·기록, Phase 24 전 push 후속 잠김

## Task Commits

1. **Task 1: 원격 마이그레이션 상태 확인** - `6cfc0ce` (docs) — 실측 기록 (본 SUMMARY로 이관 후 기록 파일 정리)
2. **Task 2: Supabase 대시보드 + Kakao console 설정** - 커밋 없음 (사용자 계정 작업 — 레포 변경 0)

## Task 1 — 원격 마이그레이션 실측 (Open Q1)

`supabase migration list` (linked project `xfoauhsraguyrifingct`, CLI 2.101.0). **`supabase db push` 미실행.**

| Migration | Local | Remote | 비고 |
|-----------|-------|--------|------|
| 0016~0023 | ✓ | ✓ | 정합 — 17-03 "remote reset deferred" 이후 0022(ledger)·0023까지 원격 적용 확인 |
| 0024_place_seq | ✓ | ✗ | 로컬 전용 (23-01 작성, 23-04 로컬 적용) |
| 0025_web_share | ✓ | ✗ | 로컬 전용 (23-02 작성, 23-04 로컬 적용) |

**후속 (잠금): Phase 24가 Vercel Preview에서 카카오 e2e를 하려면 그 전에 `supabase db push`(0024·0025)가 필요하다.** 원격에는 `join_moa` RPC·`trip_messages`·`share_mode`·`seq_no`가 아직 없어, push 전에는 프로덕션/Preview에서 웹 공유·join·채팅 경로가 동작하지 않는다.

## Task 2 — 프로덕션 인증 설정 (human-action, approved)

사용자가 Kakao Developers console + Supabase Dashboard 설정 완료. 시크릿은 레포 밖(콘솔 직접 입력 + 1Password/노션) — Claude는 어떤 시크릿도 기록·요청하지 않음 (T-23-10).

**원격 검증 증거:**

1. **Kakao provider:** `curl "https://xfoauhsraguyrifingct.supabase.co/auth/v1/authorize?provider=kakao"` → **302 → kauth.kakao.com**/oauth/authorize (redirect_uri=`.../auth/v1/callback`, executor 재실측). 로그인 페이지 HTTP 200, KOE 에러 마커 0건 (오케스트레이터 검증).
2. **Anonymous sign-ins:** 원격 `/auth/v1/signup` 빈 body POST → `is_anonymous: true, role: authenticated`, access_token 발급 (오케스트레이터 검증). 로컬 스택도 동일 응답 재확인 (executor).

## Decisions Made

- **원격 push는 phase 23 범위 외 (Open Q1 확정):** 성공 기준이 전부 로컬 검증 가능 — 원격 반영은 배포 시점(Phase 24 Preview e2e 전) 작업으로 후속 잠금
- **KOE205 해결 = 비즈 앱 전환:** 아래 Issues 참조

## Deviations from Plan

None - plan executed exactly as written (코드 변경 0, push 미실행, 체크포인트 정지 후 approved 재개).

## Issues Encountered

**KOE205 (Kakao 동의항목 scope 불일치) — Phase 24 e2e 참고 필수:**

- **증상:** 최초 시도에서 KOE205 발생. Supabase GoTrue kakao provider는 **`account_email profile_image profile_nickname` 3 scope를 하드코딩 요청**(제거 불가 — `scopes` 옵션은 append만). authorize redirect URL의 `scope=account_email+profile_image+profile_nickname`으로 실측 확인됨.
- **해결:** 사용자가 **개인 개발자 비즈 앱 전환**(사업자등록증 불필요) 후 **3개 동의항목 전부 "선택 동의"로 설정**.
- **영향:** GoTrue는 email 미제공 시에도 graceful하게 유저 생성(소스 확인) — MOAJOA는 닉네임 기반(D-A2)이라 email 의존 없음.
- **학습:** 플랜 원안의 "profile_nickname·profile_image만 설정"은 불충분 (account_email이 GoTrue 기본 scope라 KOE205 지속). Kakao + Supabase 조합은 비즈 앱 + 동의항목 3종이 최소 요건.

## User Setup Required

플랜 frontmatter `user_setup` 항목 전부 완료 (사용자 수행, "approved" 수신):

- Kakao Developers: REST API 키·Client Secret 발급, 카카오 로그인 활성화, Redirect URI `https://xfoauhsraguyrifingct.supabase.co/auth/v1/callback` 등록, 동의항목 3종 (비즈 앱)
- Supabase Dashboard: Anonymous sign-ins ON + Kakao provider (Client ID/Secret)
- 로컬 실값 배선(선택 C)은 필요 시 `supabase/.env.local`(gitignored)에 — 로컬 smoke는 더미값으로 이미 통과(23-04)

## Next Phase Readiness

- **Phase 23 전 플랜(7/7) 실행 완료** — 성공 기준 1~5 전부 충족 (1·2·3 로컬 실증=23-04, 4 프로덕션 절반=본 플랜, 5 CLAUDE.md D26 반전=23-03). `/gsd-verify-work 23` 가능
- **Phase 24 착수 가능:** 카카오 버튼 UI + OAuth e2e는 프로덕션 provider가 준비된 상태에서 진행. 단 **Vercel Preview e2e 전 `supabase db push`(0024·0025) 필수**
- AUTH-07(Phase 24)·AUTH-08(Phase 25) e2e 완료 마킹은 해당 phase에서

## Self-Check: PASSED

- Task 1 커밋 `6cfc0ce` 존재 확인 (git log)
- 원격 검증: authorize 302 → kauth.kakao.com 재실측 통과 (executor curl)
- 코드·DB 변경 0 확인 (플랜 명세 일치)

---
*Phase: 23-web-first-foundation*
*Completed: 2026-07-08*
