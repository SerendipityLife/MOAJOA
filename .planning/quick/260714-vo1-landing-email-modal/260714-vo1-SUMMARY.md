---
phase: quick-260714-vo1
plan: 01
subsystem: web-auth
tags: [web, auth, a11y, landing, modal]
status: complete
requires: []
provides:
  - EmailAuthForm (shared e-mail auth surface for /login + landing modal)
  - Dialog modal a11y layer (focus trap / initial focus / focus restore / inner scroll)
affects:
  - apps/web/app/login/page.tsx
  - apps/web/app/_components/landing-carousel.tsx
tech-stack:
  added: []
  patterns:
    - "path-import (not barrel) for components consumed by barrel-mocking tests"
    - "caller owns getCallbackUrl/onAuthenticated — form stays router-free"
    - "modal as sibling of a scroll track, not a descendant"
key-files:
  created:
    - apps/web/components/email-auth-form.tsx
    - apps/web/__tests__/email-auth-form.test.tsx
    - apps/web/__tests__/dialog.test.tsx
  modified:
    - apps/web/components/dialog.tsx
    - apps/web/app/login/page.tsx
    - apps/web/app/_components/landing-carousel.tsx
    - apps/web/__tests__/landing-carousel.test.tsx
decisions:
  - "no body scroll lock in Dialog — the carousel scrolls an inner track, not the body"
  - "carousel scroll lock solved structurally (sibling render), not with a lock"
  - "magic-mode 회원가입 stays permanently disabled — pre-existing /login behavior, preserved"
metrics:
  duration: ~50m
  completed: 2026-07-14
  tests: 313 → 329 (+16, 0 regressions)
  commits: 5
---

# Quick 260714-vo1: 랜딩 이메일 로그인 모달 Summary

랜딩 3번 슬라이드의 "이메일로 로그인"이 `/login`으로 떠나는 대신 **URL이 `/` 그대로인 채 화면 가운데 모달**로 열린다. 인증 로직은 복붙 0 — `/login`의 이메일 폼을 `EmailAuthForm`으로 추출해 두 서피스가 공유한다.

## What shipped

| # | Commit | 내용 |
|---|---|---|
| 1 | `22fc941` | test(RED): EmailAuthForm 6케이스 (+ 동작 RED용 스텁) |
| 2 | `f5df948` | feat(GREEN): EmailAuthForm 추출 + `/login` 재배선 |
| 3 | `c4ca166` | test(RED): Dialog 모달 a11y 4케이스 |
| 4 | `992475c` | feat(GREEN): Dialog 포커스 트랩·초기 포커스·포커스 복귀·내부 스크롤 |
| 5 | `535c722` | feat: 랜딩 Link→button + 모달 배선 + 랜딩 테스트 재작성 |

**EmailAuthForm 계약** — `/login`과 모달이 **구조적으로 다른** 것만 prop으로 뺐다:
- `getCallbackUrl` (함수): `/login`은 `?next=`를 라운드트립에 싣고, 랜딩은 일부러 쿼리 없는 URL을 만든다(open-redirect 표면 제거). 함수라서 `window`는 제출 시점에만 읽힌다.
- `onAuthenticated`: `/login`은 `postLoginDestination()`, 랜딩은 항상 `/moa`. router가 caller에 남아 폼은 `next/navigation` 무의존.
- `socialSlot`: `/login`만 CTA·회원가입 사이에 소셜을 끼운다. 모달은 안 넘긴다 — 바로 뒤 슬라이드에 이미 있다.

## 반드시 기록하기로 한 3가지 (plan `<output>`)

**(a) Dialog에 body 스크롤 락을 넣지 않은 근거.**
캐러셀이 스크롤하는 건 body가 아니라 내부 트랙(`overflow-x-auto`)이고, 랜딩 `<main>`은 `h-[100svh] overflow-hidden`이라 body는 애초에 스크롤되지 않는다. body 락은 이 문제를 **전혀 못 막으면서** 공유 컴포넌트에 전역 부작용만 심는다. 판단 근거는 `dialog.tsx` docblock에 남겼다.

**(b) 캐러셀 스크롤 락은 구조로 풀었다.**
`<Dialog>`를 트랙의 **형제**로 렌더한다(자손 아님). 자손이면 백드롭 위의 wheel/touch가 트랙으로 버블해 캐러셀이 뒤에서 페이징된다. 형제면 스크롤 체인이 트랙에 닿지 않는다. 보조 2겹: 포커스 트랩(방향키가 트랙에 못 감) + 포커스 복귀 시 `focus({ preventScroll: true })`(복귀가 트리거를 화면에 넣으려고 트랙을 스크롤하는 것 차단).
**실측:** 모달 위에서 wheel(양축) + 합성 touch 스와이프를 쏜 뒤 트랙 `scrollLeft` 불변 — 데스크톱 `2880 → 2880`, 모바일 `780 → 780`. 닫은 뒤에도 동일(preventScroll 복귀 확인).

**(c) magic 모드 회원가입 버튼이 항상 disabled인 기존 동작 — 의도적 보존.**
`disabled={pending || !email || password.length < 6}`인데 magic 모드엔 비밀번호 필드가 없다 → 영구 disabled. 이건 현행 `/login`의 **선재 버그**이고 이번 요청 범위 밖이라 **그대로 옮겼다**(§3.3). "개선"하지 않았다. `email-auth-form.tsx` 주석에 명시. 고치려면 별도 작업.

## Verification (전부 실제 실행)

| Gate | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` | **329 passed / 37 files** (기준 313 → +16, 회귀 0) |
| `typecheck` | exit 0 |
| `next build` | PASS (`○ /login` 4.81 kB / 211 kB) |
| 배럴 게이트 1 (새 파일명 미등장) | `grep -c email-auth-form index.ts` = **0** |
| 배럴 게이트 2 (파일 무변경) | `git diff --exit-code -- components/index.ts` **clean** |
| `login.test.tsx` 무수정 | `git diff --exit-code` **clean** (한 글자도 안 건드림) |
| 허용 외 hex | 신규 hex **0개** (light surface = Button/Input 기본값이 곧 디자인) |
| `apps/ios` · `packages/ui-tokens` | **clean** (0 files) |

**신규 테스트 16개:** email-auth-form 6 · dialog 5 · landing-carousel 모달 5 (기존 랜딩 단언 12개는 무수정 보존, `/login` href 단언만 교체).

### Playwright 라이브 (데스크톱 1440×900 + 모바일 390×844) — **62/62 PASS**

1. "이메일로 로그인" 클릭 → **URL `/` 그대로** + 패널 중심이 뷰포트 중심과 정확히 일치 (desktop `(720,450)`, mobile `(195,422)`)
2. 모달 열린 동안 트랙 `scrollLeft` 불변 (위 (b))
3. 이메일/비밀번호 제출 → `/auth/v1/token` 인터셉트 1회 + 입력한 주소가 body에 실림 + 에러가 모달 안 `role=alert`로 표시
4. 매직링크 모드 → `/auth/v1/otp` 인터셉트 1회 → magicSent 화면이 해당 주소를 표시
5. ESC 닫힘 / 백드롭 클릭 닫힘 — **둘 다 닫은 뒤 `document.activeElement`가 트리거 버튼**
6. 모바일 콘텐츠 안 잘림 — 패널 `(24, 253.3, 342×337.5)`로 뷰포트 안, `overflow-y: auto`로 넘치면 패널 자체가 스크롤
7. 소셜 3종 회귀 — 랜딩 슬라이드 3 + `/login` 양쪽 / 모달이 소셜을 **중복 표시하지 않음**(카카오 count = 1)
8. `/login` 3상태(password → magic → magicSent → password 복귀) 회귀
9. **console error 0** (앱 에러 0. 유일한 콘솔 항목은 하네스가 직접 스텁한 400 응답에 대한 Chrome의 리소스 로그 — 앱 출처 아님)

**스크린샷:**
- `/private/tmp/claude-501/-Users-test-Desktop-moajoa/77e38741-0a81-4b91-85ac-efcb97b3448e/scratchpad/vo1-shots/vo1-modal-desktop.png`
- `.../vo1-shots/vo1-modal-mobile.png`
- `.../vo1-shots/vo1-login-password-{desktop,mobile}.png`
- `.../vo1-shots/vo1-login-magicsent-{desktop,mobile}.png`

## Deviations from Plan

**1. [Rule 2 - 누락된 필수 요소] surface 표에 `sent` 키 추가**
- **Found during:** Task 1
- **Issue:** plan의 surface 표는 `input/cta/link/hint/signup` 5개만 키잉했는데, magicSent 문단은 `/login`에서 `text-white`다. 그대로 light surface(흰 패널)로 옮기면 **흰 글씨가 흰 배경에** 얹혀 안 보인다.
- **Fix:** `SurfaceClasses`에 `sent` 추가 — blue `text-white`(현행 그대로), light `text-neutral-900`. 기존 토큰만, 신규 hex 0.
- **File:** `apps/web/components/email-auth-form.tsx` · **Commit:** `f5df948`

그 외 plan 원안 그대로. (Playwright 하네스 자체의 strict-mode 셀렉터 버그 2건과 console 분류 버그 1건은 스크래치패드 스크립트 수정이라 제품 코드 deviation 아님 — `시작하기`가 `카카오로 시작하기`에, `로그인`이 `메일 링크로 로그인`에 부분 매치했고, Chrome 리소스 에러의 URL은 `text()`가 아니라 `location()`에 있었다.)

## Notes for next session

- **PLAN.md·SUMMARY.md는 미커밋 상태** (orchestrator 몫). ROADMAP.md 미수정.
- `Dialog`는 이번 작업 전까지 호출부 0개였고, 이제 랜딩 모달이 **첫 실사용처**다. 다음에 Dialog를 쓰는 곳은 포커스 트랩·복귀를 공짜로 받는다.
- magic 모드 회원가입 disabled(위 (c))는 **여전히 살아있는 선재 버그**다. 고칠 거면 `/login`·모달 양쪽에 동시 반영된다(단일 컴포넌트라).

## Self-Check: PASSED

- `apps/web/components/email-auth-form.tsx` FOUND
- `apps/web/components/dialog.tsx` FOUND
- `apps/web/__tests__/email-auth-form.test.tsx` FOUND
- `apps/web/__tests__/dialog.test.tsx` FOUND
- commits `22fc941` `f5df948` `c4ca166` `992475c` `535c722` — 전부 `git log`에 존재
