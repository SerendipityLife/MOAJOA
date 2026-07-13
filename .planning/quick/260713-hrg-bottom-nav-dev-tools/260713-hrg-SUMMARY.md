---
phase: 260713-hrg-bottom-nav-dev-tools
plan: 01
subsystem: web
status: complete
tags: [web, auth, navigation, bottom-sheet]

requires:
  - BottomSheet (@/components) — portal 시트 + footer 슬롯 (7c15db7·47c375c)
  - getSupabaseBrowser().auth — getUser / signOut
  - login/page.tsx — `next=` 검증 계약 (`/` 시작 && `//` 아님)
provides:
  - AccountSheet — /moa·/t 서피스 공용 계정 시트 (세션 자체 조회)
  - MoaTabBar [마이] 액션 탭 — 시트 진입점
  - 프로덕션 앱셸 bottom-nav (dev-tools 게이트 해제)
affects:
  - /moa/[id] (호스트) · /t/[slug] (게스트) — 같은 탭바 공유
  - /moa · /discover · /me — 앱셸 탭바 렌더 조건

tech-stack:
  added: []
  patterns:
    - "시트가 세션을 자체 조회 (prop 드릴링 회피) — ShareSheet의 open-시-poll-조회 선례 계승"
    - "탭바 배열의 액션 엔트리 — activeTab을 바꾸지 않는 3번째 항목"

key-files:
  created:
    - apps/web/app/moa/[id]/_components/account-sheet.tsx
    - apps/web/__tests__/account-sheet.test.tsx
  modified:
    - apps/web/app/moa/[id]/_components/moa-tab-bar.tsx
    - apps/web/components/bottom-nav.tsx

decisions:
  - "D-A: 계정 시트 상태는 MoaTabBar 소유 — moa-island.tsx diff 0, 기존 테스트 파일 0건 수정"
  - "D-B: AccountSheet가 auth.getUser()를 자체 조회 — 호스트·게스트 두 진입점 무수정"
  - "D-C: 게스트 = !user || user.is_anonymous — /t join의 익명 세션을 로그인으로 오인하지 않음"
  - "D-D: 시트 내용은 프로필 + 로그아웃/로그인 CTA만 — /me 메뉴 행 미이식"

metrics:
  duration: ~12min
  tasks: 3
  commits: 4
  files_changed: 4
  tests_added: 6
  completed: 2026-07-13
---

# Quick 260713-hrg: 계정 진입점 복구 (moa [마이] 탭 + bottom-nav 게이트 해제) Summary

웹 프로덕션에서 **로그아웃 경로가 0개**였던 문제를 두 갈래로 막음 — moa 상세에 계정 시트를 여는 [마이] 액션 탭을 추가하고, 앱셸 탭바를 프로덕션에서 통째로 숨기던 dev-tools 게이트를 제거.

## 무엇을 만들었나

**QUICK-01 — `/moa/[id]` 계정 진입점 (Task 1·2)**
`AccountSheet`(신규)가 `open`일 때만 `auth.getUser()`로 **자기 세션을 스스로 조회**한다. 같은 탭바가 호스트(`/moa/[id]`, RSC seed)와 게스트(`/t/[slug]`, 익명 세션) 양쪽에서 뜨는데, prop 드릴링을 택했다면 두 진입점을 다 손대야 했고 게스트 경로엔 email·avatar가 애초에 없다. ShareSheet가 `open`에서 poll을 자체 조회하는 선례를 그대로 따랐다.

- 로그인 사용자 → 프로필(이름·이메일·아바타) + `window.confirm` 로그아웃 → `signOut()` → `router.replace('/login')`
- 게스트(비로그인 **또는 익명**) → `/login?next=<현재경로>` CTA
- 세션 조회 실패 → 게스트 폴백 (시트가 빈 화면으로 죽지 않게)

[마이]는 **탭이 아니라 액션**이다 — `activeTab`을 건드리지 않으므로 시트를 닫으면 사용자는 열기 전 탭(모으기/채팅)에 그대로 남는다. `aria-current` 대신 `aria-haspopup="dialog"`를 주고, active 하이라이트에서 영구 제외했다.

**QUICK-02 — 앱셸 탭바 (Task 3)**
`bottom-nav`의 렌더 가드에서 dev-tools 조건을 떼고 `if (!onTab) return null;` 단독으로. 이 게이트는 "웹 앱셸 = dev 도구, 공개 뷰어는 chrome-free"라는 옛 전제의 산물인데, v2.1 웹 퍼스트 피봇이 그 전제를 뒤집었다(웹이 실 제품 서피스). 게이트가 살아있는 한 프로덕션 사용자는 `/me`에 도달할 방법이 없었고 — 그래서 로그아웃도 못 했다.

## 핵심 설계 선택

**시트 상태를 island가 아니라 탭바가 소유(D-A).** 시트는 island 상태에 아무것도 의존하지 않으므로(세션을 스스로 조회) 끌어올리면 순수 prop 배선만 늘어난다. 더 중요하게는 `moa-island.test.tsx`의 `@/components` 목이 BottomSheet를 노출하지 않아서, 시트를 island의 sibling으로 렌더하는 순간 **기존 테스트가 깨진다**. 탭바 소유 = `moa-island.tsx` diff 0 + 기존 테스트 파일 수정 0건.

**익명 세션을 게스트로 판정(D-C).** `/t/[slug]` join은 `signInAnonymously`를 태우므로 게스트도 세션은 있다. `!!user`로만 갈랐다면 익명 유저가 "로그인 상태"로 분류돼 이름·이메일이 빈 프로필이 렌더됐을 것이다. 판정식은 `!user || user.is_anonymous`.

## 검증

| 게이트 | 결과 |
|---|---|
| `pnpm typecheck` (모노레포 6개 프로젝트) | **PASS** — ios·web·api·core·ui-tokens 전부 Done |
| `pnpm --filter @moajoa/web test:run` | **PASS — 24 파일 / 176 테스트** (170 → 176, 신규 6) |
| 회귀: `moa-island.test.tsx`·`guest-surface.test.tsx` **무수정** | **PASS** — 31/31 (채널 재생성 없음 포함) |
| 스코프: `git diff --name-only` | **정확히 4개 파일** |
| `apps/ios/**`·`packages/**`·`supabase/**`·`lib/env.ts`·`moa-island.tsx` | **전부 부재** ✅ |
| bottom-nav `isDevToolsEnabled` grep | **0회** · 가드 = `if (!onTab) return null;` 1회 |

TDD 게이트(Task 1): RED `8817bc9`(모듈 부재로 실패) → GREEN `b17b1ce`(6/6 통과).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules`가 락파일과 불일치 — `pnpm typecheck` 차단**
- **Found during:** Task 2 검증
- **Issue:** `react-day-picker@9.14.0`이 `apps/web/package.json`에 선언되고 `pnpm-lock.yaml`에 이미 resolve돼 있는데(커밋 `e9858cf`, Phase 24-01) `node_modules`에 미설치 → `share-sheet.tsx`·`step-dates.tsx`·`build-draft.ts`·`onboarding/page.tsx` 4개 파일에서 TS2307 6건. **내가 손댄 파일과 무관한 사전 존재 환경 문제**(내 4개 파일의 에러는 0건).
- **Fix:** `pnpm install --frozen-lockfile` — 락파일에 없는 것은 설치될 수 없으므로 신규/미확인 패키지 유입 경로가 없다. 패키지 **이름을 지정한 설치가 아니므로** package-legitimacy 체크포인트 대상이 아니다(선언된 락 상태 복원일 뿐).
- **Result:** typecheck 그린. `package.json`·`pnpm-lock.yaml` 추적 파일 drift 0 (스코프 게이트 통과).

### 계획 대비 조정

**2. `Button`을 import하지 않음** — 플랜 `<action>`은 "BottomSheet·Button을 `@/components`에서 import"라고 했으나, 실제로 Button이 쓰일 자리가 없었다. 로그인 CTA는 테스트 계약상 **anchor**(`role="link"`)여야 하는데 `Button`은 `<button>` 전용(asChild 미지원)이고, 로그아웃은 플랜이 지정한 대로 `me-content.tsx` L110–117의 `text-danger` **텍스트 버튼**을 미러했다. `tsconfig.base.json`의 `noUnusedLocals: true` 때문에 미사용 import는 typecheck를 깨뜨린다 → import하지 않는 것이 유일한 정합 선택.

## Deferred / 미실행 게이트

**`pnpm --filter @moajoa/web lint` (Task 3 acceptance) — 이 레포에서 실행 불가.**
`apps/web`에 **ESLint 설정 파일이 아예 없다**(`.eslintrc*`·`eslint.config.*` 부재. `eslint`·`eslint-config-next` devDependency만 선언). 그래서 `next lint`가 대화형 초기 설정 프롬프트("How would you like to configure ESLint?")로 진입해 exit 1로 죽는다 — **내 diff와 무관한 사전 존재 상태**다. ESLint를 초기화하면 하드 스코프 게이트(4파일)를 위반하는 설정 파일이 추가되므로 실행하지 않았다.

해당 게이트의 실제 목적("고아 import 없음")은 더 강한 검사로 충족됨:
- `tsconfig.base.json`에 `noUnusedLocals: true` → **tsc가 미사용 import를 에러로 잡는다**. typecheck 그린 = 고아 import 0.
- `grep isDevToolsEnabled` 0회 · `grep @/lib/env` 0회.

→ 후속 제안(별도 작업): `apps/web` ESLint 설정 부트스트랩. 이번 스코프 밖이라 코드에 손대지 않음.

## Self-Check: PASSED

- 파일 4/4 존재 확인
- 커밋 4/4 존재 확인 (`8817bc9` · `b17b1ce` · `e068963` · `aa15cb6`)
- TDD 게이트 순서 확인: `test(` → `feat(`

## 사람 확인 필요 (human-check, `pnpm web:dev`)

자동 검증은 컴포넌트 계약까지만 — 아래 실사용 흐름은 브라우저 확인 몫이다:
- `/moa/<id>` → 탭바 [모으기][채팅][마이] 3개 · [마이] 탭 → 시트가 지도 위로
- 시트 닫으면 **원래 탭 유지** (채팅에서 열었으면 채팅 그대로)
- 로그인 상태 → 이름·이메일·로그아웃 → confirm → `/login` 이동
- `/t/<slug>` 게스트 참여 후 [마이] → 로그인 CTA(프로필 없음) · `/login?next=/t/<slug>`
- `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정 상태에서 `/moa` → 앱셸 탭바(모아/둘러보기/내 정보) 렌더
