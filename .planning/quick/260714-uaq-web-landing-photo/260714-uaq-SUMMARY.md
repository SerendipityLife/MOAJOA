---
phase: quick-260714-uaq
plan: 01
subsystem: web
tags: [landing, onboarding, next-image, carousel, a11y, wcag]
status: complete
requires: []
provides:
  - apps/web/app/_components/landing-carousel.tsx
  - apps/web/public/onboarding/{travel,lake,fuji}-photo.jpg
affects:
  - apps/web/app/page.tsx
tech-stack:
  added: []
  patterns:
    - CSS scroll-snap 캐러셀 (transform 트랙 아님 — 스와이프/트랙패드/키보드 네이티브)
    - next/image 레포 최초 도입 (fill + sizes="100vw" + object-position)
    - 장식 사진 alt="" (WCAG 1.1.1)
key-files:
  created:
    - apps/web/app/_components/landing-carousel.tsx
    - apps/web/__tests__/landing-carousel.test.tsx
    - apps/web/public/onboarding/travel-photo.jpg
    - apps/web/public/onboarding/lake-photo.jpg
    - apps/web/public/onboarding/fuji-photo.jpg
    - apps/web/public/onboarding/CREDITS.md
  modified:
    - apps/web/app/page.tsx
decisions:
  - 스크림 alpha 0.55 채택 — iOS 원본(텍스트 지점 0.12)은 웹 크롭에서 AA 실패(1.4~1.6:1). 의도된 divergence.
  - object-position X=50% 고정 — 데스크톱은 Y만, 모바일은 X만 지배하므로 한 값으로 두 뷰포트 커버.
  - 자동재생 없음 — iOS 원본에 없고 요청도 없었음(Karpathy §3.2).
metrics:
  duration: ~25min
  completed: 2026-07-14
  tasks: 3
  files: 7
  tests: 296 → 303 (+7, 회귀 0)
---

# Quick 260714-uaq: 웹 랜딩 사진 캐러셀 Summary

웹 랜딩(`/`)의 단색 바나나 배너를 iOS 웰컴과 동일한 **풀스크린 사진 3장 scroll-snap 캐러셀**로 교체 — 사진·스크림·흰 워드마크·슬라이드별 카피를 이식하고, CTA 는 웹 것(`시작하기` → `/login`)을 유지했다.

## Commits

| 커밋 | 내용 |
|---|---|
| `4291f40` | feat: 사진 3장 web public 복사 + CREDITS.md |
| `399c455` | test: 랜딩 캐러셀 실패 테스트 7케이스 (RED) |
| `5e69771` | feat: landing-carousel.tsx + page.tsx 배선 (GREEN) |

Task 3(빌드·Playwright 검증)은 검증 전용이라 레포 파일 변경 0 → 커밋 없음.

## 검증 결과 (전부 실제 실행)

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` | **303 passed** (기존 296 + 신규 7, 회귀 0) |
| `typecheck` (`tsc --noEmit`) | exit 0 |
| `next build` | PASS — `ƒ /` 6.83 kB / **112 kB** First Load JS |
| Playwright 라이브 (2 뷰포트 × 3 슬라이드) | **38/38 PASS, exit 0** |
| `git status --porcelain apps/ios` | 빈 출력 (사진은 복사, 이동 아님) |
| scope gate | `login/` · `globals.css` · `next.config.ts` · `packages/ui-tokens` · `apps/ios` 전부 **diff 0** |
| Playwright 격리 | `pnpm-lock.yaml` · `apps/web/package.json` **diff 0** (스크래치패드에만 설치) |

### 번들 (실측 before/after)

| | `/` Size | First Load JS | 렌더 |
|---|---|---|---|
| before (`399c455`) | 161 B | 105 kB | ƒ (dynamic) |
| after (`5e69771`) | 6.83 kB | 112 kB | ƒ (dynamic) |
| **delta** | **+6.67 kB** | **+7 kB** | 변화 없음 |

`next/image` 레포 최초 도입 + 클라이언트 아일랜드(캐러셀 상태) 비용. `/` 는 여전히 dynamic — `auth.getUser()` 를 부르므로 정적화되지 않는다(기존과 동일).

### Playwright 라이브 검증 (dev @ :3100, 클린 컨텍스트 = 비로그인)

- **사진 네트워크 200** — 데스크톱 `/_next/image?...&w=3840&q=75` ×3 전부 **200**, 모바일 `w=828` ×3 전부 **200**. 404 **0건**. 추가로 `naturalWidth > 0` 로 **실제 디코드까지 확인**(데스크톱 450×564 / 421×750 / 480×720).
- **console error 0 · pageerror 0** (두 뷰포트 모두)
- **비로그인 랜딩 렌더** — `/` 200, `/moa` 리디렉트 없음, `MOAJOA` + `유튜브 링크 하나로` 표시, 구 배지 `여행 큐레이션 도구` **소멸 확인**
- **캐러셀 전환** — 도트 1/2/3 클릭 → `scrollLeft` = 0 / 1×W / 2×W 정확 일치, 각 슬라이드 카피가 뷰포트 안
- **CTA** — `시작하기` 클릭 → `/login` 도착 (두 뷰포트)

**스크린샷 6장** (`/private/tmp/claude-501/-Users-test-Desktop-moajoa/77e38741-0a81-4b91-85ac-efcb97b3448e/scratchpad/shots/`):
`desktop-slide1.png` · `desktop-slide2.png` · `desktop-slide3.png` · `mobile-slide1.png` · `mobile-slide2.png` · `mobile-slide3.png`
(6장 전부 **직접 열어 육안 확인**. 스크린샷 좌하단의 검은 `N` 배지는 Next.js dev 오버레이 — 프로덕션에는 없음.)

## 정직한 한계 · plan 예측 정정

plan 이 예측한 한계 3건을 스크린샷으로 대조했다. **1건은 확인, 1건은 정정, 1건은 유지.**

### 1. lake 카약, 데스크톱 크롭에서 소실 — **확인됨 (예측대로)**

데스크톱 1440×900 에서 보이는 세로 밴드가 35%뿐이라 "상단 벚꽃 캐노피"와 "카약(68–72%)"을 동시에 담을 수 없다. `desktop-slide2.png` 에서 **카약은 실제로 보이지 않는다** — 벚꽃 캐노피 + 안개 수평선 + 섬 + 물만 남는다. 벚꽃 프레이밍(사진의 정체성)을 택한 결과이며, 슬라이드 2 의 메시지("친구와 공유하세요")는 카약에 의존하지 않는다.

> **신규 발견:** `mobile-slide2.png` 에서는 **카약이 선명하게 보인다.** 모바일(390×844)은 세로가 전부 보이고 가로가 잘리므로 카약이 살아남는다. 즉 카약 소실은 **데스크톱 전용 한계**이지 자산의 손실이 아니다. plan 은 이 점을 명시하지 않았다.

### 2. travel 이 "지도 클로즈업"으로 읽힌다 — ❌ **정정: 예측이 틀렸다**

plan 은 "데스크톱에서 플랫레이 전경(全景)이 아니라 지도 클로즈업으로 읽힌다"고 기록했으나, `desktop-slide1.png` 실물은 **플랫레이 전경이 거의 그대로 유지된다** — 좌상단 안경, 좌측 펜슬케이스 + 색연필 + 노트, 우측 2/3 로마 지도, 우하단 펜을 든 손까지 **피사체 5종이 전부 프레임 안**에 있다. Y=45% 크롭이 잘라낸 건 정보 없는 빈 책상 상단뿐이다. "지도 클로즈업"이라는 서술은 실물과 맞지 않으므로 **한계 항목에서 철회한다.**

### 3. AVIF 미적용 (WebP 만) — **유지**

`next.config.ts` 를 변경하지 않았으므로(제약) `images.formats` 는 Next 15 기본값 = **WebP 만**이다. AVIF 는 opt-in 이라 켜지 않았다. (이는 설정에서 도출한 사실이며, 런타임 `content-type` 을 별도 측정하진 않았다. 응답 200 · 디코드 성공은 실측했다.) AVIF 를 원하면 `next.config.ts` `images.formats` 추가가 필요한 별도 작업이다.

### 4. iOS 스크림 값 divergence — **의도된 설계**

iOS 는 View 30장 스택으로 스크림을 만들고, 텍스트가 놓이는 세로 중앙 지점의 alpha 가 **0.12** 다. 이 값을 웹 크롭에 그대로 쓰면 흰 텍스트 명암비가 **1.44–1.6:1 로 AA 실패**한다(최악은 travel 의 흰 책상 상판 L=0.83 — 후지 설상 0.68 보다 밝다). 그래서 웹은 CSS 그라데이션 4-stop 으로 **텍스트 밴드 구간 alpha 0.55** 를 깔았다 → travel 5.42:1 · lake 5.63:1 · fuji 5.11:1 (전부 AA 4.5:1 초과). **iOS 보다 눈에 띄게 어둡다. 이건 이식 실수가 아니라 의도된 divergence다** — 컴포넌트 주석에도 근거를 남겼다. textShadow 두 상수는 이식하지 않았다(WCAG 는 그림자를 명암비 근거로 인정하지 않으므로 스크림이 유일한 근거).

### 5. 신규 관찰 — 모바일 슬라이드 3 의 텍스트/정상 겹침

`mobile-slide3.png` 에서 카피 `어디 갈지 정해요` 가 후지산 정상과 **부분적으로 겹친다**. 텍스트 가독성에는 문제가 없고(스크림 위 흰 텍스트) 정상도 좌우로 식별 가능하지만, 데스크톱만큼 깔끔한 배치는 아니다. plan 의 must_have 는 데스크톱 프레이밍만 요구했으므로 게이트 위반은 아니다. 개선하려면 모바일 전용 카피 위치 조정이 필요하다(현 스코프 밖).

## Deviations from Plan

### Rule 3 (blocking) — 검증 스크립트 API 정정

**1. [Rule 3 - Blocking] `locator.isInViewport()` 는 `playwright-core` API 가 아니다**
- **Found during:** Task 3 (Playwright 실행 중 `TypeError`)
- **Issue:** `isInViewport()` 는 `@playwright/test` 의 assertion(`expect(locator).toBeInViewport()`)이지 `playwright-core` Locator 메서드가 아니다. 스크립트가 데스크톱 슬라이드 1 에서 크래시.
- **Fix:** `boundingBox()` 로 요소 사각형을 얻어 뷰포트 경계와 직접 비교하도록 교체. 단언 강도는 동일(오히려 좌표를 출력하므로 더 검증 가능).
- **Files modified:** 스크래치패드 `landing-verify.mjs` 만 — **레포 파일 변경 0**
- **Commit:** 없음 (레포 밖)

그 외 **deviation 0** — 사진 경로·카피·object-position·스크림 값·컴포넌트 구조·테스트 7케이스 전부 plan 원안 그대로.

## 판단 기록 (plan 이 명시하지 않아 실행자가 정한 것)

- **슬라이드 2·3 의 `loading="eager"`** — plan 이 지시한 대로 적용했고, `priority` 와 동시 지정 금지도 지켰다(`i === 0 ? {priority:true} : {loading:'eager'}` 분기). 두 사진이 가로로 밀려 있어 lazy 로 두면 스와이프 첫 순간 빈 프레임이 된다.
- **카피 그룹 하단 패딩 `pb-44`** — 하단 크롬(도트 + CTA)과 겹치지 않게 확보. plan 은 "하단 패딩 확보"라고만 했고 수치는 미지정.
- **CTA 클래스 verbatim 유지** — 기존 page.tsx 의 `시작하기` Link 클래스를 한 글자도 바꾸지 않았다(`shadow-fab` 포함). 허용된 `shadow-lg` 추가도 하지 않았다 — 이미 `shadow-fab` 이 있어 불필요.

## Known Stubs

없음.

## Self-Check: PASSED

- `apps/web/public/onboarding/{travel,lake,fuji}-photo.jpg` — FOUND (iOS 원본과 바이트 동일, `diff -q` 통과)
- `apps/web/public/onboarding/CREDITS.md` — FOUND (3건 기재, lake·fuji 는 "(추정)" 표기 + 상업 배포 전 재확인 경고)
- `apps/web/app/_components/landing-carousel.tsx` — FOUND
- `apps/web/__tests__/landing-carousel.test.tsx` — FOUND
- `apps/web/app/page.tsx` — 서버 컴포넌트 유지 · `redirect('/moa')` 유지
- 커밋 `4291f40` · `399c455` · `5e69771` — 전부 `git log` 에 존재
