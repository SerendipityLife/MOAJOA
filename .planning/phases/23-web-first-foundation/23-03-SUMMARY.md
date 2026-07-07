---
phase: 23-web-first-foundation
plan: 03
subsystem: auth
tags: [supabase, gotrue, kakao-oauth, anonymous-auth, config-toml, claude-md]

# Dependency graph
requires: []
provides:
  - "supabase/config.toml: enable_anonymous_sign_ins = true (로컬 GoTrue 익명 스위치)"
  - "supabase/config.toml: [auth.external.kakao] enabled=true + env(KAKAO_REST_API_KEY)/env(KAKAO_CLIENT_SECRET) 치환"
  - "supabase/.env.local.example: KAKAO_REST_API_KEY / KAKAO_CLIENT_SECRET placeholder"
  - "CLAUDE.md §5 D26 공식 반전 — 웹 생성·편집 UI 작업 허용 + iOS 전면 동결 가드레일"
  - "CLAUDE.md §4.1 web 역할 정합 — 입력·저장·편집 풀 서피스"
affects: [23-04, 23-07, 24, 25, web-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "config.toml provider 블록 = apple/google idiom 미러 (env() 치환, 실값 0)"

key-files:
  created: []
  modified:
    - supabase/config.toml
    - supabase/.env.local.example
    - CLAUDE.md

key-decisions:
  - "kakao client_id = REST API 키 (env(KAKAO_REST_API_KEY)) — Kakao console의 JS 키 아님"
  - "config.toml은 로컬 전용(파일 헤더 L2~3) — 프로덕션 대시보드·Kakao console 설정은 23-07 human-action으로 분리"
  - "D26 반전문에 dev-tool 폼 격리(NEXT_PUBLIC_ENABLE_DEV_TOOLS) 유지 조건 명시 — 정식 UI 대체 시까지"

patterns-established:
  - "CLAUDE.md 룰 반전 시 구 룰을 삭제하지 않고 반전 이력(피봇 Phase·날짜)을 괄호로 보존"

requirements-completed: [AUTH-07, AUTH-08]

# Metrics
duration: 2min
completed: 2026-07-08
---

# Phase 23 Plan 03: 인증 스위치 + CLAUDE.md D26 반전 Summary

**로컬 GoTrue 익명 sign-in ON + [auth.external.kakao] env() 블록 + KAKAO placeholder, CLAUDE.md §5 D26 웹 UI 금지 룰 공식 반전(iOS 전면 동결로 교체)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-07T17:12:23Z
- **Completed:** 2026-07-07T17:14:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `supabase/config.toml`: `enable_anonymous_sign_ins = true` + `[auth.external.kakao]`(enabled=true, apple/google idiom 미러 — env() 치환만, 실값 0). 기존 apple/google/functions 블록 무수정
- `supabase/.env.local.example`: KAKAO_REST_API_KEY / KAKAO_CLIENT_SECRET placeholder(`...`) 추가 — 기존 형식(주석+KEY=예시값) 미러, `supabase/.env.local` 실파일 무접촉
- `CLAUDE.md` §5 D26 불릿 반전: "Web 생성·링크 추가 UI 금지" → "iOS 전면 동결(v2.1)" — 이후 세션이 웹 생성·편집 UI 작업을 §5 위반으로 거부하지 않음 (ROADMAP 성공 기준 5 완결). §4.1 web 역할 한 줄 정합(입력·저장·편집 풀 서피스)

## Task Commits

Each task was committed atomically:

1. **Task 1: config.toml 익명+카카오 스위치 + env placeholder** - `88efaa1` (feat)
2. **Task 2: CLAUDE.md §5 D26 불릿 반전 + §4.1 정합** - `d1a33bb` (docs)

## Files Created/Modified

- `supabase/config.toml` - 익명 sign-in 스위치 ON + kakao provider 블록 (로컬 전용; 실효 검증은 23-04)
- `supabase/.env.local.example` - KAKAO 2키 placeholder (config.toml env() 치환 대상)
- `CLAUDE.md` - §5 D26 반전 + §4.1 web 역할 정합

## Decisions Made

None - followed plan as specified (플랜의 결정사항 frontmatter key-decisions에 기록됨).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration — 23-07 human-action 플랜 소관:**
- Kakao Developers: REST API 키·Client Secret 발급 + Redirect URI(`https://<project-ref>.supabase.co/auth/v1/callback`) + 동의항목 profile_nickname·profile_image
- Supabase Dashboard: Anonymous sign-ins 토글 ON + Kakao provider client_id/secret 입력 (config.toml은 로컬 전용)
- 로컬 실행 시: `supabase/.env.local`에 KAKAO 실값 채우기 (커밋 금지)

## Known Stubs

None — placeholder(`...`)는 `.env.local.example`의 의도된 컨벤션(§4.7)이며 UI 렌더링과 무관.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-surface | supabase/config.toml | 익명 sign-in 개방 — 미인증 사용자가 세션(auth.uid) 발급 가능. 플랜 threat_model T-23-11(GoTrue 30/hr/IP rate limit로 accept, CAPTCHA는 v2.1 범위 외 defer)·T-23-12(SEC-01 Phase 27 멤버십 게이트로 transfer)에 이미 등재 — 신규 미등재 표면 없음 |

## Next Phase Readiness

- Wave 1 (23-01·23-02·23-03) 전체 완료 — Wave 2 = 23-04 [BLOCKING] 스키마 적용 게이트 진행 가능
- 23-04 선행 조건 충족: config 스위치 없이는 23-02 smoke의 익명·kakao 단계가 실패했을 것 — 이제 재시작 후 GoTrue 실로딩 검증 가능 (colima 선행 필요)
- 23-04 주의: `supabase start`가 `KAKAO_REST_API_KEY`/`KAKAO_CLIENT_SECRET` env 부재 시 env() 치환 경고/실패 가능 — `supabase/.env.local`에 실값(또는 최소 더미) 필요

---
*Phase: 23-web-first-foundation*
*Completed: 2026-07-08*

## Self-Check: PASSED

- Files: config.toml, .env.local.example, CLAUDE.md, SUMMARY — 전부 존재
- Commits: 88efaa1, d1a33bb — git log 확인
- Task 1/2 automated verify 라인 재실행 PASS
