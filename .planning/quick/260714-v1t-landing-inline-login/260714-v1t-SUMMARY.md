---
phase: quick-260714-v1t
plan: 01
subsystem: web
tags: [landing, auth, oauth, a11y, carousel]
status: complete

requires:
  - apps/web/lib/supabase/browser (getSupabaseBrowser)
  - apps/web/components/toast (useToast, via ToastProvider in layout.tsx)
  - apps/web/app/auth/callback/route.ts (next 없으면 /moa 기본값)
provides:
  - apps/web/components/social-auth-buttons.tsx (SocialAuthButtons, SocialProvider)
affects:
  - apps/web/app/login/page.tsx (소셜 버튼 JSX → 컴포넌트 호출)
  - apps/web/app/_components/landing-carousel.tsx (3번 슬라이드 인라인 로그인)

tech-stack:
  added: []          # 신규 의존성 0
  patterns:
    - "배럴 우회 경로 직접 import (bottom-nav.tsx 선례) — vi.mock('@/components') 와 공존"
    - "핸들러 주입(onProvider)으로 redirectTo 정책을 호출자가 소유"

key-files:
  created:
    - apps/web/components/social-auth-buttons.tsx
    - apps/web/__tests__/social-auth-buttons.test.tsx
  modified:
    - apps/web/app/login/page.tsx
    - apps/web/app/_components/landing-carousel.tsx
    - apps/web/__tests__/landing-carousel.test.tsx

decisions:
  - "SocialAuthButtons 는 배럴(components/index.ts)에 export 하지 않는다 — login.test.tsx:17 의 vi.mock('@/components') 가 배럴을 통째로 대체하므로 배럴 경유 import 는 테스트에서 undefined 가 된다"
  - "onProvider 주입 — /login 은 ?next= 를 싣는 callbackUrl(), 랜딩은 쿼리를 붙이는 코드 경로가 아예 없는 landingCallbackUrl(). 두 redirectTo 가 구조적으로 다르므로 supabase 클라이언트를 컴포넌트 밖에 둔다"
  - "랜딩 소셜 버튼에만 흰 링(ring-2 ring-white/80) — 사진 위 검정 애플 원은 어두운 픽셀 위에서 1.2:1 로 WCAG 1.4.11(3:1) 실패"
  - "CTA 를 고정 높이(min-h-[52px]) 래퍼 안에서 조건부 렌더 — 그냥 언마운트하면 하단 앵커 chrome 에서 도트가 ~52px 내려앉는다"
  - "3번 슬라이드 pb-20 은 Playwright 실측으로 확정(pb-28 은 모바일에서 0.266 → 스크림 램프 구간)"

metrics:
  duration: ~35m
  completed: 2026-07-14
  tasks: 3
  commits: 5
  tests: 303 → 313 (+10)
---

# Quick 260714-v1t: 랜딩 인라인 로그인 Summary

랜딩 캐러셀 3번 슬라이드에 소셜 3종을 인라인으로 넣고, `시작하기` 를 /login 네비게이션에서 3번 슬라이드로의 스크롤로 바꿨다. 소셜 버튼은 /login 과 공유 컴포넌트 1개로 통합 — SVG/클래스 복붙 0.

## What Changed

| Task | 내용 | Commits |
|---|---|---|
| 1 | 소셜 3종 → `SocialAuthButtons` 추출, /login 이 소비 | `542bb1a` (RED) · `4d388bd` (GREEN) |
| 2 | 3번 슬라이드 인라인 로그인 + `시작하기` → `goTo(2)` | `7408fbf` (RED) · `b51fb3b` (GREEN) |
| 3 | Playwright 실측 → 패딩 확정 | `0c9cc2e` |

### 함정 3개 — 전부 지켜짐

1. **배럴 오염 금지.** `components/index.ts` 에 `social-auth-buttons` 항목 **없음** (grep 0). `login/page.tsx` 와 `landing-carousel.tsx` 둘 다 `@/components/social-auth-buttons` 경로로 직접 import. `bottom-nav.tsx` 와 같은 관례.
2. **`login.test.tsx` 무수정.** `git diff 542bb1a~1 -- apps/web/__tests__/login.test.tsx` → exit 0. 3개 테스트가 **진짜 SocialAuthButtons 를 렌더하면서** 통과 (카카오 접근성 이름 `카카오로 시작하기` 보존).
3. **CTA 숨김 시 도트 불변.** `min-h-[52px]` 고정 래퍼 안에서 조건부 렌더 → Playwright 실측 도트 y: 데스크톱 776 → 776, 모바일 720 → 720 (변화 0px).

## Verify Gates — 전부 실행됨

| Gate | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` | **313 passed / 35 files** (기준 303 → +10, 회귀 0) |
| `pnpm --filter @moajoa/web typecheck` | exit 0 |
| `pnpm --filter @moajoa/web build` | `✓ Compiled successfully` · 12/12 정적 페이지 |
| 배럴 미오염 grep | PASS — index.ts 에 항목 0 |
| 허용 외 hex | PASS — `#FEE500`(카카오) + 구글 4색만. 애플은 `bg-black` 토큰, 스크림은 `rgba()` |
| `git status apps/ios packages/ui-tokens` | PASS — CLEAN (동결 준수) |

**테스트 +10 내역:** social-auth-buttons 5 신규 + landing-carousel 7 → 12 (+5: 기존 2개 재작성 흡수, 신규 5개).
기존 랜딩 테스트 2개(`getAllByRole('button')` 3개 기대 · `시작하기` href=/login)는 잠금 결정과 정면 충돌하므로 재작성 — **의도된 변경, 회귀 아님.** 나머지 이미지/카피/priority/alt 6개는 무수정 통과.

## Playwright 라이브 검증 — 1440×900 + 390×844 전부 PASS

스크린샷:
- `/private/tmp/claude-501/-Users-test-Desktop-moajoa/77e38741-0a81-4b91-85ac-efcb97b3448e/scratchpad/v1t-slide3-desktop.png`
- `/private/tmp/claude-501/-Users-test-Desktop-moajoa/77e38741-0a81-4b91-85ac-efcb97b3448e/scratchpad/v1t-slide3-mobile.png`

| 항목 | desktop 1440×900 | mobile 390×844 |
|---|---|---|
| `시작하기` → `scrollLeft === 2 × clientWidth` | 2880 = 2880 ✅ | 780 = 780 ✅ |
| URL 이 `/` 유지 (네비게이션 없음) | ✅ | ✅ |
| 3번 슬라이드에서 CTA 소멸 | ✅ | ✅ |
| 도트 3개 유지 + **y 좌표 불변** | 776 → 776 ✅ | 720 → 720 ✅ |
| 콘텐츠 전부 뷰포트 안 (워드마크·h1·소셜 3·링크) | ✅ 잘림 0 | ✅ 잘림 0 |
| 이메일 링크가 도트와 이격 | 547.5 < 776 ✅ | 519.5 < 720 ✅ |
| **워드마크 y/vh ≥ 0.28** | **0.298** ✅ | **0.285** ✅ |
| 랜딩 OAuth provider 3종 (kakao/google/apple) | ✅ | ✅ |
| `redirect_to` 에 `/auth/callback` 포함 | ✅ | ✅ |
| **`next` 파라미터 부재** | ✅ | ✅ |
| **/login 소셜 3종 회귀** (추출 후) | ✅ 3/3 | ✅ 3/3 |
| console error | **0** | **0** |

인터셉트된 실제 URL 예:
```
https://xfoauhsraguyrifingct.supabase.co/auth/v1/authorize
  ?provider=kakao
  &redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback   ← 쿼리 없음
  &code_challenge=...&code_challenge_method=s256
```
→ 콜백 route.ts:35 가 `next` 없으면 `/moa` 로 보낸다 = 의도한 착지점.

## Deviations from Plan

### 1. [Rule 1 - Bug] 3번 슬라이드 패딩 `pb-28` → `pb-20`

- **Found during:** Task 3 (Playwright 실측)
- **Issue:** 플랜 T2(3)의 추정치 `pb-28` 은 390×844 에서 워드마크를 **y/vh = 0.266** 에 놓았다. 플랜이 스스로 정한 게이트(`≥ 0.28`) 미달 — 스크림 그라디언트가 0.55 평탄부에 도달하기 전 램프 구간(α≈0.54, ~5.2:1). AA 는 통과하지만 "기존 5.42:1 근거 승계" 조건을 못 채운다. 플랜 F5 가 `pb-28` 을 "추정이므로 T3 에서 실측으로 확정한다" 고 명시했으므로 예정된 조정.
- **Fix:** `pb-20`(80px). `justify-center` 라서 하단 패딩을 줄이면 콘텐츠가 **내려간다** → 워드마크가 어두운 구간으로 이동. 실측 재확인: 데스크톱 0.298 / 모바일 0.285 — 둘 다 0.28 통과.
- **Files:** `apps/web/app/_components/landing-carousel.tsx`
- **Commit:** `0c9cc2e`
- **주의:** `SCRIM` 상수와 슬라이드 1·2 는 무접촉 (플랜 지시대로 밝게 하는 방향 금지 준수). 실측치를 주석에 기록.

### 2. [Rule 3 - Blocking] /login 의 `socialBlock` 주석 1문장 수정

- **Found during:** Task 1
- **Issue:** 기존 주석이 `"not split into its own file"` 이라고 단언 — 내 변경이 이 문장을 거짓으로 만들었다.
- **Fix:** 버튼은 공유 컴포넌트로 이동했고 `socialBlock` 래퍼는 `회원가입` 이 `signUp/pending/email/password` 를 클로저로 잡기 때문에 남는다는 사실로 재서술. **내 변경이 만든 오류만 정리** (인접 코드 무접촉).
- **Files:** `apps/web/app/login/page.tsx`
- **Commit:** `4d388bd`

## Threat Model 대응

| Threat ID | 처리 |
|---|---|
| T-v1t-01 (redirectTo 변조) | `landingCallbackUrl()` 은 `${base}/auth/callback` 상수 조립만. **쿼리를 붙이는 코드 경로가 존재하지 않음.** Playwright 로 실제 요청의 `redirect_to` 에 쿼리 부재 확인 |
| T-v1t-02 (오픈 리다이렉트 ?next=) | 랜딩은 `next` 를 읽지도 쓰지도 않음. callback route.ts 의 기존 `//` 차단 검증 무변경 |
| T-v1t-03 (에러 메시지 노출) | accept — /login 과 동일한 토스트 표면 |
| T-v1t-SC (패키지 설치) | 신규 의존성 **0** |

## Known Stubs

없음.

## Notes

- **/login 은 삭제되지 않았고 `?next=` 흐름 그대로.** 랜딩은 로그인 경로를 **추가**한 것이지 대체가 아니다 — 이메일 로그인 필요자는 3번 슬라이드의 `이메일로 로그인` 텍스트 링크로 이동.
- **실 카카오/구글/애플 로그인 e2e**(실제 IdP 왕복 → /moa 착지)는 이번 범위 밖 — authorize 요청까지만 인터셉트로 검증했다. 라이브 왕복은 배포 후 `/gsd-verify-work` 몫.
- 검증 스크립트·스크린샷은 scratchpad 에만 있고 레포에 커밋하지 않음 (플랜 지시).

## Self-Check: PASSED

- `apps/web/components/social-auth-buttons.tsx` — FOUND
- `apps/web/__tests__/social-auth-buttons.test.tsx` — FOUND
- `apps/web/app/_components/landing-carousel.tsx` — FOUND
- `apps/web/app/login/page.tsx` — FOUND
- commits `542bb1a` `4d388bd` `7408fbf` `b51fb3b` `0c9cc2e` — 전부 FOUND
