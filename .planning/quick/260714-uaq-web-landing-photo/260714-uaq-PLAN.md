---
phase: quick-260714-uaq
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260714-uaq]
files_modified:
  - apps/web/public/onboarding/travel-photo.jpg
  - apps/web/public/onboarding/lake-photo.jpg
  - apps/web/public/onboarding/fuji-photo.jpg
  - apps/web/public/onboarding/CREDITS.md
  - apps/web/app/_components/landing-carousel.tsx
  - apps/web/app/page.tsx
  - apps/web/__tests__/landing-carousel.test.tsx

must_haves:
  truths:
    - 비로그인 방문자가 / 에서 사진 3장 캐러셀을 보고 스와이프/도트로 3장 전부 넘길 수 있다
    - 3슬라이드 전부 흰 워드마크 MOAJOA + iOS 카피가 사진 위에서 WCAG AA(4.5:1 이상)로 읽힌다
    - "시작하기" 버튼이 /login 으로 이동한다
    - 로그인 세션이 있으면 /moa 로 리디렉트된다 (기존 동작 무회귀)
    - 데스크톱 1440px 에서 세 사진의 피사체(지도/벚꽃+섬/후지산 정상)가 프레임 안에 남는다
    - apps/ios 는 변경 0 (사진은 복사)
  artifacts:
    - apps/web/public/onboarding/{travel,lake,fuji}-photo.jpg
    - apps/web/public/onboarding/CREDITS.md
    - apps/web/app/_components/landing-carousel.tsx
    - apps/web/__tests__/landing-carousel.test.tsx
  key_links:
    - page.tsx(서버·redirect 유지) → <LandingCarousel /> (클라이언트 아일랜드)
    - next/image src="/onboarding/*.jpg" → apps/web/public/onboarding/*.jpg (404 시 전체 실패)
    - 스크림 alpha 0.55 (텍스트 밴드) → 흰 텍스트 AA 통과의 유일한 근거
---

<objective>
웹 랜딩(`apps/web/app/page.tsx`)을 iOS 웰컴(`apps/ios/app/welcome.tsx`)과 동일한 **풀스크린 사진 3장 캐러셀 + 스크림 + 흰 워드마크 + 슬라이드별 카피**로 교체한다. CTA 는 현재 웹 것(`시작하기` → `/login`)을 유지한다.

Purpose: 웹 랜딩이 단색 배너나(bg-banana-100)라 iOS 온보딩과 브랜드 인상이 갈린다. 사진·카피를 통일한다.
Output: 로컬 사진 3장(`public/onboarding/`) + 라이선스 출처 기록 + 클라이언트 캐러셀 컴포넌트 + 서버 컴포넌트 page.tsx 배선.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@apps/ios/app/welcome.tsx        # 이식 원본 — 읽기 전용. 절대 수정 금지 (v2.1 iOS 동결)
@apps/web/app/page.tsx           # 교체 대상
@apps/web/app/globals.css        # @theme 토큰 — 이번 plan 은 변경하지 않는다 (아래 근거)
@apps/web/next.config.ts         # 변경하지 않는다 (아래 근거)
@apps/web/app/onboarding/_components/step-where.tsx   # _components 배치 관례 참고
@apps/web/__tests__/login.test.tsx                    # 테스트 배치·mock 관례 참고
</context>

---

## 사전 조사 결과 (실측 — 실행자는 재조사하지 말 것)

### A. 레포 관례 (확인 완료)

| 항목 | 값 |
|---|---|
| 클라이언트 컴포넌트 배치 | `app/<route>/_components/*.tsx` (기존: `onboarding/_components/`, `moa/[id]/_components/`, `me/_components/`) → 루트 랜딩은 **`app/_components/landing-carousel.tsx`** |
| 테스트 배치 | `apps/web/__tests__/*.test.tsx` (vitest `include: ['__tests__/**']` — **`_components/__tests__/` 는 수집 안 됨**) |
| 게이트 스크립트 | `pnpm --filter @moajoa/web test:run` (`test` 는 bare vitest = watch, 게이트 불가) · `typecheck` · `build` |
| `next/image` 선례 | **0건** — 이 페이지가 첫 도입 (`<img>` 는 account-sheet/opengraph-image 에만) |
| `sharp` | 루트 node_modules 에 존재 → `next build` 이미지 최적화 동작 |
| 작업트리 | clean (`?? pencil/` 만) → `git status` 로 iOS clean 검증 가능 |

### B. 사진 실측 (3장 모두 Read 로 직접 열어봄)

| 파일 | 픽셀 | 종횡비(W/H) | 용량 |
|---|---|---|---|
| travel-photo.jpg | 1201×1504 | 0.799 (≈4:5) | 548 KB |
| lake-photo.jpg | 1125×2000 | 0.5625 (9:16) | 775 KB |
| fuji-photo.jpg | 1280×1920 | 0.667 (2:3) | 467 KB |

**피사체 위치 (사진 세로 %, 위→아래):**

- **travel** — 좌상단 빈 흰 책상 `0–20%` · 안경 `14–31%` · 로마 지도(우측 2/3) `0–78%`(조밀한 중심부 `30–75%`) · 펜슬케이스+색연필(좌) `38–78%` · 글 쓰는 손+노트 `62–100%`
- **lake** — 상단 벚꽃 캐노피 `0–45%` · 좌측 벚꽃 가지 `44–70%` · 안개 수평선+섬 `44–47%` · **카약 `68–72%`**(x 60–70%) · 어두운 물 `70–100%`
- **fuji** — 파란 하늘 `0–43%` · **설상 정상 `43–46%`** · 산체 `46–52%` · 마을/호안 `52–55%` · 호수 `55–78%` · 전경 바위 `78–100%`

### C. object-position 도출 (데스크톱 1440×900 크롭 수학)

세로 사진 + 가로 컨테이너 → **가로는 꽉 차고 세로가 잘린다.** 보이는 세로 비율
`f = (900/1440) ÷ (H/W)`, 보이는 밴드 `= [p·(1−f), p·(1−f)+f]` (p = object-position Y).

| 사진 | f (보이는 세로) | **채택 p** | 보이는 밴드 | 근거 |
|---|---|---|---|---|
| travel | **49.9%** | **45%** | `22.5% – 72.5%` | 안경(14–31%) 하단·지도 조밀부(30–75%)·색연필(38–78%) 전부 유지. 잘리는 건 상단 빈 책상(무정보)과 하단 손/노트(어차피 하단 스크림에 묻힘) |
| lake | **35.2%** | **40%** | `25.9% – 61.1%` | 벚꽃 캐노피(25.9–45% → 프레임 상단 55%를 채움) + 수평선·섬(45% → 프레임 53% 지점) + 물. 벚꽃 프레이밍이라는 사진의 정체성 보존 |
| fuji | **41.7%** | **50%**(center) | `29.2% – 70.8%` | 정상(43%)이 프레임 **33% 지점** = 교과서적 배치. 잘리는 건 단색 상단 하늘과 어두운 전경 바위 → **데스크톱 크롭이 오히려 개선됨** |

> **모바일(390px)에서는 Y 가 무의미하다.** 390×844(비 0.462) < 사진 비 → **가로가 잘리고 세로는 전부 보인다**(travel 가로 58%, fuji 69%, lake 82% 노출). 그래서 X 는 3장 모두 `50%`(중앙) 고정 — 세 사진 다 피사체가 가로 중앙 근처라 안전. **한 축(Y)은 데스크톱만, 다른 축(X)은 모바일만 지배한다** → `object-position: 50% N%` 한 값으로 두 뷰포트를 동시에 만족시킬 수 있다.

**정직한 한계 (SUMMARY 에 반드시 기록):**
1. **lake 의 카약(68–72%)은 데스크톱에서 사라진다.** 보이는 밴드가 35%뿐이라 "상단 벚꽃 캐노피"와 "카약"을 동시에 담을 수 없다. 카약(전체 픽셀의 ~2%, 하단 스크림 0.7 아래)보다 벚꽃 프레이밍을 택했다. 슬라이드 2 의 메시지("친구와 공유하세요")는 카약에 의존하지 않는다.
2. **travel 은 데스크톱에서 플랫레이 전경(全景)이 아니라 "지도 클로즈업"으로 읽힌다.** 세로 50%만 보이므로 책상 배치 전체를 볼 방법이 없다.
3. 고해상도 원본은 `references/`(gitignored)라 **재크롭 불가**. 위 값이 현 자산으로 가능한 최선.

### D. 스크림 — WCAG AA 실측 (⚠ iOS 값을 그대로 쓰면 **AA 실패**)

iOS 는 View 30장 스택으로 `base 0.12 + 상단 램프(0.35) + 하단 램프(0.45)`, 상한 0.7 을 만든다. 텍스트 그룹은 **세로 중앙**에 놓이는데, 그 지점의 iOS alpha 는 **0.12** 다.

흰 텍스트(L=1.0) vs `검정 α` 합성 배경의 실측 명암비 (sRGB 합성 후 상대휘도):

| 사진 | 텍스트 밴드 내 **가장 밝은 픽셀** | 원본 L | **α=0.12 (iOS 값)** | **α=0.55 (채택)** |
|---|---|---|---|---|
| travel | 흰 책상 상판 `≈#EEEBE4` | 0.83 | **1.56:1 ❌** | **5.42:1 ✅** |
| lake | 옅은 새벽 하늘/수면 `≈#F0E6BE` | 0.79 | ~1.6:1 ❌ | **5.63:1 ✅** |
| fuji | 설상 정상 `≈#F0F5FA` | 0.68 | **1.44:1 ❌** | **5.11:1 ✅** |

> **사용자 가정 정정:** "후지산 하늘이 특히 밝음"이라 하셨지만 실측상 **가장 밝은 건 travel 의 흰 책상 상판(L=0.83)** 입니다. 후지 설상(0.68)보다 밝습니다. 그래서 최악 기준은 travel 이고, α=0.55 는 그 최악에서 5.42:1 을 냅니다.
>
> **α 하한 도출:** 4.5:1 을 만족하려면 합성 휘도 `L' ≤ 1.05/4.5 − 0.05 = 0.1833`. travel 책상(c≈0.92 그레이 등가)에 대해 `α=0.50 → 4.57:1`(간당간당), **`α=0.55 → 5.42:1`**(여유). 우리 타입은 36px/30px extrabold 라 WCAG 상 "large text"(3:1) 이지만, JPEG 노이즈 + 색 추정 오차를 흡수하려고 **normal text 기준 4.5:1 을 넘기도록** 0.55 를 택한다.

**채택 CSS (View 30장 스택은 이식하지 않는다 — CSS 그라데이션 1줄로 대체):**

```
background-image: linear-gradient(
  to bottom,
  rgba(0,0,0,0.35) 0%,
  rgba(0,0,0,0.55) 28%,
  rgba(0,0,0,0.55) 72%,
  rgba(0,0,0,0.78) 100%
);
```
- `28%–72%` 평탄부 = **0.55** → 위 표의 ≥5.1:1 근거. (텍스트 그룹 실제 점유 구간은 세로 34–49% 로 평탄부 한가운데.)
- 상단 `0.35` — 사진이 숨 쉬는 구간.
- 하단 `0.78` — 흰 도트 대비 확보(최악 12.4:1). CTA 는 불투명 `bg-brand-600 + text-white`(5.22:1)라 배경 무관하게 통과.
- **iOS 대비 훨씬 어둡다. 이건 의도된 divergence** — iOS 원본 값은 웹 크롭에서 AA 를 못 넘긴다(위 표).

### E. 확정 결정 (근거 포함)

| 항목 | 결정 | 근거 |
|---|---|---|
| **next.config.ts** | **변경 없음** | `images.remotePatterns` 는 원격 전용. `/public` 로컬 이미지는 설정 없이 최적화된다. ⚠ Next 15 기본 `images.formats` 는 **WebP 만** — AVIF 는 opt-in 이라 안 켠다(설정 변경 금지 제약). WebP 자동 변환 + 리사이즈만으로 충분. |
| **globals.css** | **변경 없음** | 필요한 토큰(brand-600/white)·유틸(animate-fade-up·prefers-reduced-motion 가드)이 이미 다 있다. 스크림은 검정 알파(제약상 예외) + Tailwind arbitrary value 로 처리 → @theme 추가 불필요. |
| **자동재생** | **넣지 않는다** | iOS 원본에 없다(스와이프 캐러셀). Karpathy §3.2 — 요청 없는 기능 추가 금지. 따라서 `prefers-reduced-motion` autoplay 이슈 자체가 소멸. (도트 클릭 smooth-scroll 만 reduced-motion 가드) |
| **캐러셀 구현** | CSS **scroll-snap** 가로 스크롤 | 모바일 스와이프·트랙패드·키보드 스크롤이 전부 네이티브로 붙는다. transform 방식보다 JS 가 적다(§3.2). 인덱스는 `onScroll` 로만 추적. |
| **alt 전략** | **`alt=""`(장식)** 3장 모두 | 사진이 전달하는 정보가 없다 — 슬라이드의 의미는 시각 텍스트(`유튜브 링크 하나로…`)에 100% 담겨 있고, 사진은 무드/브랜딩이다. WCAG 1.1.1 상 순수 장식 = 빈 alt. (`next/image` 는 alt prop 필수 — `alt=""` 가 정식 장식 표기.) |
| **텍스트 정렬** | iOS 그대로 **좌측 정렬 + 세로 중앙** | 원본 `flex-1 justify-center px-8` 은 좌측 정렬이다. 데스크톱에선 `mx-auto max-w-lg` 컬럼 안에서 좌측 정렬(레포의 max-w-lg 관례). |
| **배지** | 제거 (`여행 큐레이션 도구`) | 잠금 결정 2 — iOS 에 배지가 없다. |

---

<tasks>

<task type="auto">
  <name>Task 1: 사진 3장 복사 + 라이선스 출처 기록</name>
  <files>
    apps/web/public/onboarding/travel-photo.jpg
    apps/web/public/onboarding/lake-photo.jpg
    apps/web/public/onboarding/fuji-photo.jpg
    apps/web/public/onboarding/CREDITS.md
  </files>
  <action>
`apps/ios/assets/onboarding/` 의 사진 3장을 `apps/web/public/onboarding/` 로 **복사**한다 (`cp`, **절대 `mv` 아님** — iOS 원본은 그대로 남아야 한다). 대상 디렉토리는 신규 생성.

그 다음 `apps/web/public/onboarding/CREDITS.md` 를 신규 작성한다. 공개 마케팅 페이지에 쓰는 사진인데 레포에 라이선스 기록이 전무하다. 아래 내용을 담되 **확실한 것과 추정인 것을 명확히 구분**해서 적을 것 — 추정을 사실처럼 쓰지 말 것:

- travel-photo.jpg — Unsplash, 사진작가 `oxana-v`, photo id `qoAIlAmLJBU`. Unsplash License(상업적 사용 무료·출처 표기 불요, 그래도 기록). 출처 URL 형식은 `https://unsplash.com/photos/qoAIlAmLJBU`.
- lake-photo.jpg — **추정: Pixabay, 업로더 `kanenori`, image id `9802950`.** 원 다운로드 기록이 없어 확정 불가 → `(추정)` 명시.
- fuji-photo.jpg — **추정: Pixabay, 원 파일명 `fuji-2720999_1920`(= image id 2720999).** 마찬가지로 `(추정)` 명시.

각 항목에 라이선스명·추정 여부·재확인 방법(해당 id 페이지 방문)을 적고, 파일 상단에 "이 사진들은 apps/ios/assets/onboarding/ 과 동일한 원본이며 iOS·Web 이 공유한다"는 사실과 "추정 2건은 원 다운로드 이력 부재로 확정 불가 — 상업적 배포 전 재확인 필요"라는 경고를 남긴다.

`docs/DESIGN-RESOURCES.md` 는 링크 모음 성격이라 건드리지 않는다(§3.3 surgical) — 자산 옆에 두는 CREDITS.md 가 더 발견되기 쉽다.
  </action>
  <verify>
    <automated>
test -f apps/web/public/onboarding/travel-photo.jpg &&
test -f apps/web/public/onboarding/lake-photo.jpg &&
test -f apps/web/public/onboarding/fuji-photo.jpg &&
test -f apps/web/public/onboarding/CREDITS.md &&
test -f apps/ios/assets/onboarding/travel-photo.jpg &&
test -f apps/ios/assets/onboarding/lake-photo.jpg &&
test -f apps/ios/assets/onboarding/fuji-photo.jpg &&
diff -q apps/ios/assets/onboarding/travel-photo.jpg apps/web/public/onboarding/travel-photo.jpg &&
diff -q apps/ios/assets/onboarding/lake-photo.jpg  apps/web/public/onboarding/lake-photo.jpg &&
diff -q apps/ios/assets/onboarding/fuji-photo.jpg  apps/web/public/onboarding/fuji-photo.jpg &&
git status --porcelain apps/ios | grep -q . && echo "FAIL: apps/ios dirty" && exit 1 || echo "OK: bytes identical, iOS clean"
    </automated>
  </verify>
  <done>
웹 public 에 3장 존재 + iOS 원본 3장 그대로 존재 + 바이트 동일(`diff -q` 통과) + `git status apps/ios` 가 빈 출력. CREDITS.md 에 3건 모두 기재되고 추정 2건은 "(추정)" 표기.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: LandingCarousel 클라이언트 컴포넌트 + page.tsx 배선</name>
  <files>
    apps/web/app/_components/landing-carousel.tsx
    apps/web/app/page.tsx
    apps/web/__tests__/landing-carousel.test.tsx
  </files>
  <behavior>
`apps/web/__tests__/landing-carousel.test.tsx` — 구현 전에 먼저 쓰고 RED 확인.
`next/image` 를 passthrough `<img>` 로 mock 한다(props 를 data-* 로 노출: `data-priority`, `src`, `alt`, `className`). `Element.prototype.scrollTo` 는 `vi.fn()` 스텁, 슬라이드 폭 단언용으로 컨테이너 `clientWidth` 를 `Object.defineProperty` 로 고정.

- Test 1 (사진 3장): `data-testid="slide-img"` 3개. src 가 각각 `/onboarding/travel-photo.jpg` · `/onboarding/lake-photo.jpg` · `/onboarding/fuji-photo.jpg` (순서 고정).
- Test 2 (LCP): 첫 이미지만 `data-priority="true"`, 나머지 둘은 `"false"`.
- Test 3 (alt 장식): 3개 모두 `alt` 가 빈 문자열.
- Test 4 (카피 = iOS 문구): `MOAJOA` 3회 · `유튜브 링크 하나로` · `여행 지도 완성` · `완성된 여행 지도를` · `친구와 공유하세요` · `친구랑 투표로` · `어디 갈지 정해요` 전부 렌더.
- Test 5 (구 카피 소멸): `여행 큐레이션 도구` · `여행 정보를 모아두는` · `유튜브 링크를 던지면` 이 **문서에 없다**.
- Test 6 (도트 = 접근 가능 버튼): `<button>` 3개, 각각 aria-label 보유, 초기엔 첫 번째가 `aria-current="true"`. 두 번째 도트 클릭 → 스크롤 컨테이너의 `scrollTo` 가 `left = 1 × clientWidth` 로 1회 호출.
- Test 7 (CTA): `시작하기` 링크의 `href === '/login'`.
  </behavior>
  <action>
**(a) `apps/web/app/_components/landing-carousel.tsx` 신규 — `'use client'`**

`SLIDES` 상수 3개: `{ key, src, title, objectPosition }`.
- `link` / `/onboarding/travel-photo.jpg` / `'유튜브 링크 하나로\n여행 지도 완성'` / Y=45%
- `share` / `/onboarding/lake-photo.jpg` / `'완성된 여행 지도를\n친구와 공유하세요'` / Y=40%
- `vote` / `/onboarding/fuji-photo.jpg` / `'친구랑 투표로\n어디 갈지 정해요'` / Y=50%

각 Y 값 옆에 **왜 그 값인지**를 한 줄 주석으로 남긴다(위 §C 표의 근거를 요약 — 무엇이 사진의 몇 % 지점에 있어서 데스크톱 밴드에 들어오는지). 주석은 *why* 만, *what* 은 코드로(§4.5).

구조:
- 루트: `relative h-[100svh] overflow-hidden`.
- 스크롤 컨테이너: `flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden` + 스크롤바 숨김(`[scrollbar-width:none]` + `[&::-webkit-scrollbar]:hidden`). `ref` 보유. `onScroll` 에서 `Math.round(scrollLeft / clientWidth)` 로 index 갱신(값이 바뀔 때만 `setIndex`).
- 각 슬라이드: `relative h-full w-full shrink-0 snap-center`.
  - `next/image` — `fill` · `sizes="100vw"` · `alt=""` · `className="object-cover"` + Tailwind arbitrary object-position(`object-[50%_45%]` 등, 하드코딩 hex 아님). 첫 슬라이드만 `priority`, 2·3번은 `loading="eager"`(가로로 밀려 있어 IntersectionObserver 가 안 잡으면 스와이프 순간 빈 화면이 되므로 — priority 와 loading 을 같은 이미지에 동시 지정하지는 말 것).
  - 스크림: `aria-hidden` 인 `absolute inset-0` div. §D 의 4-stop `linear-gradient` 를 Tailwind arbitrary background-image 로. **View 30장 스택 이식 금지.**
  - 카피 그룹: `relative flex h-full flex-col justify-center` 안에 `mx-auto w-full max-w-lg px-8` — 워드마크 `MOAJOA`(`text-4xl font-extrabold tracking-wider text-white`) + 타이틀(`mt-5 text-3xl font-extrabold leading-tight text-white whitespace-pre-line`, 문자열의 `\n` 이 줄바꿈으로). 하단 크롬에 가리지 않게 아래쪽 패딩 확보.
  - iOS 의 textShadow 두 상수는 이식하지 않아도 된다(스크림 0.55 로 이미 5:1 이상). 넣고 싶으면 `drop-shadow` 유틸 한 줄까지만 — WCAG 는 그림자를 인정하지 않으므로 **스크림이 유일한 근거**임을 주석에 남길 것.
- 하단 크롬: `absolute inset-x-0 bottom-0` + `mx-auto max-w-lg px-8` + `pb-[calc(2rem+env(safe-area-inset-bottom))]`.
  - 도트: `SLIDES.map` → `<button type="button">`, `aria-label={`슬라이드 ${i+1}`}`, `aria-current={i===index}`. 활성 `h-2 w-5 rounded-full bg-white` / 비활성 `h-2 w-2 rounded-full bg-white/40`. `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white` (키보드 접근 필수 제약).
    onClick → 컨테이너 `scrollTo({ left: i * clientWidth, behavior })`. `behavior` 는 `window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`.
  - CTA: 현재 page.tsx 의 `시작하기` Link 를 **클래스까지 그대로** 옮긴다(잠금 결정 3 — 현재 웹 것 유지). 불투명 `bg-brand-600` + `text-white` 라 사진 위에서도 5.22:1 로 배경 무관하게 통과 → 스타일 변경 불필요. 사진 위 부양감만 필요하면 `shadow-lg` 한 클래스까지 허용. `/login` OAuth 버튼은 **절대 랜딩에 달지 않는다**.

**(b) `apps/web/app/page.tsx` — 서버 컴포넌트 유지**

`getSupabaseServer()` → `auth.getUser()` → `data.user` 면 `redirect('/moa')` 블록은 **한 줄도 바꾸지 않는다**. return 부분만 `<LandingCarousel />` 로 교체하고, 죽은 import(`Link`)와 배지·h1·p·라디얼 그라데이션 div 를 제거한다(§3.3 — 내 변경이 만든 고아만 정리).

**금지 사항 재확인:** hex 하드코딩 금지(스크림 검정 알파만 예외) · 워크스페이스 import 에 `.js` 금지 · `apps/web/app/login/**` 과 `packages/ui-tokens/**` 와 `apps/web/globals.css` 와 `next.config.ts` 는 **diff 0** · `apps/ios/**` 는 diff 0.
  </action>
  <verify>
    <automated>
pnpm --filter @moajoa/web test:run &&
pnpm --filter @moajoa/web typecheck &&
head -1 apps/web/app/_components/landing-carousel.tsx | grep -q "use client" &&
grep -q "redirect('/moa')" apps/web/app/page.tsx &&
grep -q "getSupabaseServer()" apps/web/app/page.tsx &&
! head -1 apps/web/app/page.tsx | grep -q "use client" &&
! grep -vE "^\s*(//|\*|/\*)" apps/web/app/_components/landing-carousel.tsx | grep -qE "#[0-9a-fA-F]{6}" &&
! grep -rqE "from '\.\./.*\.js'|@moajoa/[a-z]+/.*\.js" apps/web/app/_components/landing-carousel.tsx &&
git diff --quiet -- apps/web/app/login apps/web/app/globals.css apps/web/next.config.ts packages/ui-tokens apps/ios &&
echo "OK"
    </automated>
  </verify>
  <done>
web 테스트 스위트 전부 그린(신규 7케이스 포함, 기존 회귀 0) · typecheck exit 0 · page.tsx 는 여전히 서버 컴포넌트이고 `/moa` redirect 유지 · landing-carousel.tsx 코드 라인에 hex 리터럴 없음 · login/globals.css/next.config.ts/ui-tokens/ios diff 0.
  </done>
</task>

<task type="auto">
  <name>Task 3: 프로덕션 빌드 + Playwright 라이브 검증 (2 뷰포트 × 3 슬라이드)</name>
  <files>
    (검증 전용 — 레포 파일 변경 없음. 스크립트·스크린샷은 스크래치패드에만)
  </files>
  <action>
**(a) 프로덕션 빌드** — `pnpm --filter @moajoa/web build`. `/` 라우트가 여전히 정적/동적 중 무엇으로 잡히는지, 번들 회귀가 없는지 출력에서 확인해 SUMMARY 에 기록한다(랜딩이 `next/image` 첫 도입이라 First Load JS 소폭 증가는 정상 — 수치를 남길 것).

**(b) Playwright 라이브 검증** — 레포에 Playwright 셋업이 없다. **레포에 의존성을 추가하지 말 것**(§3.2). 대신 스크래치패드에 격리 설치해 돌린다:
- `playwright-core` 를 스크래치패드 디렉토리에 설치하고, 시스템의 Chrome/Chrome for Testing 을 `executablePath` 로 지정한다.
- `pnpm --filter @moajoa/web dev` 를 **비어 있는 포트**로 띄운다(3000 이 점유돼 있을 수 있음 → `-p 3100` 등). 검증 후 반드시 종료.

검증 스크립트가 단언할 것:
1. **네트워크 200** — 페이지 로드 중 `response` 이벤트를 수집해, `/_next/image` (또는 `/onboarding/`) 요청이 **3건 이상**이고 **전부 status 200**. 404 가 하나라도 있으면 FAIL. (사진 경로 오타가 이 plan 의 가장 큰 실패 모드다.)
2. **console error 0** — `page.on('console')` 에서 `type==='error'` 수집 → 배열 길이 0 단언. `page.on('pageerror')` 도 0.
3. **비로그인 랜딩 렌더** — 클린 컨텍스트(세션 없음)에서 `/` 가 200 이고 `MOAJOA` + `유튜브 링크 하나로` 가 보인다(= `/moa` 로 튕기지 않는다).
4. **CTA 라우팅** — `시작하기` 클릭 → URL 이 `/login` 으로 끝난다.
5. **캐러셀 전환** — 도트 2 클릭 → 슬라이드 2 카피(`완성된 여행 지도를`) 가 뷰포트 안. 도트 3 클릭 → `친구랑 투표로` 가 뷰포트 안. (`scrollLeft` 값 변화도 함께 단언)
6. **스크린샷** — `1440×900` 과 `390×844` 두 뷰포트 × 슬라이드 3장 = **총 6장** 캡처. 데스크톱 3장은 §C 의 크롭 판단을 **눈으로 재확인**하는 용도다 — 저장 후 Read 로 직접 열어보고, travel 의 지도·lake 의 벚꽃+섬·fuji 의 정상이 실제로 프레임 안에 있는지 확인한다. 예측과 다르면 object-position 을 조정하고 Task 2 의 테스트를 다시 돌린다.

**(c) iOS 무변경 최종 확인** — `git status --porcelain apps/ios` 가 빈 출력.
  </action>
  <verify>
    <automated>
pnpm --filter @moajoa/web build &&
node <scratchpad>/landing-verify.mjs &&
test -z "$(git status --porcelain apps/ios)" &&
echo "OK: build PASS, live PASS, iOS clean"
    </automated>
  </verify>
  <done>
`next build` exit 0 · Playwright 스크립트 exit 0 (이미지 응답 전부 200 · console error 0 · pageerror 0 · 비로그인 랜딩 렌더 · 시작하기→/login · 도트로 슬라이드 3장 전환 확인) · 스크린샷 6장(1440×900 ×3, 390×844 ×3) 캡처 후 **실제로 열어보고** 세 사진의 피사체가 프레임 안에 있음을 확인 · `git status --porcelain apps/ios` 빈 출력 · 스크래치패드 외부에 파일 잔여물 0(playwright 가 package.json/lockfile 에 안 들어갔는지 `git diff --quiet -- pnpm-lock.yaml apps/web/package.json` 로 확인).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 익명 방문자 → `/` | 랜딩은 비인증 공개 표면. 다만 **사용자 입력이 0** 이고 DB 접근도 `auth.getUser()`(기존) 뿐 — 신규 입력 표면 없음 |
| 개발 머신 → npm 레지스트리 | Task 3 의 검증용 `playwright-core` 설치 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-UAQ-01 | Information Disclosure | `page.tsx` redirect | high | mitigate | `data.user` → `redirect('/moa')` 블록을 **한 줄도 수정하지 않는다**. 캐러셀은 클라이언트 아일랜드로만 마운트되고 쿠키/세션에 접근하지 않는다. Task 2 verify 의 `grep -q "redirect('/moa')"` 가 게이트 |
| T-UAQ-02 | Tampering | 정적 자산 경로 | medium | mitigate | 사진은 레포에 커밋된 로컬 파일만 사용. 원격 URL·CDN·`dangerouslySetInnerHTML` 0. `next.config.ts` `remotePatterns` 미변경 → 신규 원격 이미지 호스트 허용 0 |
| T-UAQ-03 | Repudiation | 사진 라이선스 | medium | mitigate | Task 1 CREDITS.md — 출처·라이선스 기록. **추정 2건(lake·fuji)은 "(추정)" 명시 + 상업 배포 전 재확인 경고**. 사실로 위장하지 않는다 |
| T-UAQ-SC | Tampering | npm 설치 (`playwright-core`) | high | mitigate | `playwright-core` 는 Microsoft 공식 패키지 [KNOWN]. **스크래치패드에만 설치** — `apps/web/package.json` · `pnpm-lock.yaml` 에 들어가지 않음을 Task 3 done 에서 `git diff --quiet` 로 검증. 레포 런타임 의존성 신규 추가 **0건** |
</threat_model>

<verification>
1. `pnpm --filter @moajoa/web test:run` — 전부 통과 (신규 7케이스 + 기존 무회귀)
2. `pnpm --filter @moajoa/web typecheck` — exit 0
3. `pnpm --filter @moajoa/web build` — exit 0, 사진이 빌드에 포함
4. Playwright: 이미지 응답 200 · console error 0 · 랜딩 렌더 · 시작하기→/login · 슬라이드 3장 전환 · 스크린샷 6장(2 뷰포트 × 3 슬라이드)
5. `git status --porcelain apps/ios` — 빈 출력 (사진은 복사, 이동 아님)
6. Surgical: `git diff --quiet -- apps/web/app/login apps/web/app/globals.css apps/web/next.config.ts packages/ui-tokens`
</verification>

<success_criteria>
- [ ] 비로그인 `/` 가 사진 3장 캐러셀로 렌더되고, 도트/스와이프로 3장 전부 도달 가능
- [ ] 3슬라이드 모두 `MOAJOA` 워드마크 + iOS 카피 (배지 `여행 큐레이션 도구` 소멸)
- [ ] 흰 텍스트가 사진 3장 각각에서 AA 통과 — 스크림 0.55 근거 (travel 5.42:1 · lake 5.63:1 · fuji 5.11:1)
- [ ] `시작하기` → `/login` (랜딩에 OAuth 버튼 없음)
- [ ] 세션 있으면 `/moa` redirect 유지 (서버 컴포넌트)
- [ ] 데스크톱 1440px 스크린샷에서 지도·벚꽃+섬·후지산 정상이 프레임 안 (object-position 근거 기록)
- [ ] `apps/ios` diff 0 · `next.config.ts` diff 0 · `globals.css` diff 0 · `login/` diff 0 · `ui-tokens` diff 0
- [ ] CREDITS.md 에 3건 출처 (추정 2건은 "(추정)" 표기)
- [ ] SUMMARY 에 **정직한 한계** 기록: lake 카약 데스크톱 크롭 소실 · travel 플랫레이 전경 불가 · AVIF 미적용(WebP 만) · iOS 스크림 값 divergence 사유
</success_criteria>

<output>
Create `.planning/quick/260714-uaq-web-landing-photo/260714-uaq-SUMMARY.md` when done
</output>
</content>
</invoke>
