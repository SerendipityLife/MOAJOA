---
phase: quick-260714-ta1
plan: 01
subsystem: web-auth-ui
tags: [web, design, login, a11y, oauth]
status: complete
requires:
  - apps/web/app/globals.css (@theme brand-*/banana-* 토큰, animate-fade-up)
  - apps/web/components (Button/Input + cn()=tailwind-merge)
provides:
  - /login 시안 1d 비주얼 (파란 캔버스 + CSS 지도 + 원형 소셜 3종)
affects:
  - apps/web/app/login/page.tsx
  - apps/web/__tests__/login.test.tsx
tech-stack:
  added: []
  patterns:
    - className 오버라이드 + tailwind-merge로 컴포넌트 기본색 덮기 (컴포넌트 파일 무수정)
    - 브랜드 로고는 인라인 SVG path (아이콘 패키지·외부 이미지 0)
    - 장식 일러스트는 순수 CSS div + aria-hidden
key-files:
  created: []
  modified:
    - apps/web/app/login/page.tsx
    - apps/web/__tests__/login.test.tsx
decisions:
  - 시안의 #3d81f6 배경을 직역하지 않고 brand-700 + brand-600 글로우 상한으로 낮춤 — 직역 시 파란 배경 위 작은 텍스트가 전부 WCAG AA 미달
  - 시안의 반투명 흰 배지 칩(3.48:1)을 어두운 brand-900/25 잉크 칩(5.62:1)으로 반전
  - 시안의 rgba(255,255,255,.85) 디바이더 라벨(4.25:1)을 불투명 white로
  - 에러는 불투명 흰 pill 위 danger 텍스트 — 반투명 붉은 pill은 합성이 배경 의존이라 대비 검증 불가
  - 소셜 버튼은 시안의 K/G 글자 대신 카카오·구글·애플 공식 인라인 SVG 로고
  - (사용자 결정) 시안에 없는 MOAJOA 워드마크를 작게 복원 — white 12px, 5.22:1 실측. 헤드라인이 시각적 주인공 유지
  - (사용자 결정) 소셜 로그인을 magic 모드에도 노출 (마찰 최소 경로), magicSent는 제외 (메일함으로 갈 사용자에겐 노이즈)
  - socialBlock을 JSX 변수로 1회 정의해 2모드가 공유 — 복붙·별도 파일 추출 모두 회피
metrics:
  duration: ~35min
  completed: 2026-07-14
  tasks: 3
  files_changed: 2
  tests: 296 passed (login 3/3)
---

# Quick Task 260714-ta1: /login 시안 1d 적용 Summary

`apps/web/app/login/page.tsx`의 프레젠테이션 레이어를 `references/landing/landing.html`의 "1d — 함께 투표" 시안으로 교체했다. 인증 로직(signIn·signUp·sendMagicLink·oauth·callbackUrl·postLoginDestination)은 **diff 0**.

## Tasks

| Task | 내용 | Commit |
|---|---|---|
| 1 | 카카오 버튼 테스트 쿼리 3곳을 `getByRole(name:)` 접근성 이름 기반으로 이관 | `ec04b1f` |
| 2 | /login 프레젠테이션 전면 교체 (로직 diff 0) | `c450669` |
| 3 | 3상태 수동 검수 (checkpoint) → **사용자 approved** + 후속 수정 2건 반영 | `ebb1aff` |

## 무엇이 바뀌었나

- **MOAJOA 워드마크**를 작게 유지 (MapPin + 12px white, tracking) — 배지 위. 헤드라인이 시각적 주인공 자리 유지
- 흰 폼 카드 제거 → 풀블리드 `bg-brand-700` 캔버스 + 상단 radial 글로우(`brand-600` 상한)
- 배지 "친구와 함께 결정" · 헤드라인 "어디 갈지, 같이 정해요." · CSS 지도 일러스트(핀 3 · 라벨 2 · 헤더칩 · 범례)
- 흰 인풋 · 바나나 CTA · "간편 로그인" 디바이더 · 원형 52px 소셜 3개 · 하단 회원가입 줄
- 회원가입은 outline 버튼 → 하단 텍스트 링크로, 매직링크는 그 아래 작은 링크로 이동 (**기능·핸들러·disabled 조건 전부 승계**)
- 진입 애니메이션은 기존 `animate-fade-up` 재사용 + `[animation-delay:60/120/180ms]` stagger (신규 keyframes 0)

## 검증 (전부 실제 실행 — 최종 `ebb1aff` 기준 재실행)

| Gate | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` | **296/296 passed** (33 files), login.test.tsx **3/3** |
| `pnpm --filter @moajoa/web typecheck` | exit 0 |
| `pnpm --filter @moajoa/web build` | **PASS** — `/login` 4.53 kB / 210 kB |
| Prettier `--check` | PASS (`page.tsx` clean) |
| `pnpm --filter @moajoa/web lint` | ⚠️ **실행 불가 (기존 레포 상태)** — 아래 deviation #1 |
| 허용 외 hex == 0 | PASS (검출 hex = `#FEE500 #4285F4 #34A853 #FBBC05 #EA4335` 5개뿐, 전부 브랜드 강제색) |
| `<svg` == 3 | PASS (socialBlock 공유 → 복붙 시 6이 됐을 것) |
| `aria-hidden="true"` >= 1 | PASS (6개) |
| `aria-label="카카오로 시작하기"` 유지 | PASS (테스트 계약 접점) |
| 인증 호출부 diff == 0 | **PASS** — 누적 diff(`ec04b1f~1`..HEAD)에 auth 호출 라인 **0줄** |
| iOS·ui-tokens·globals.css·components 무접촉 | PASS (`git status --porcelain` 빈 출력) |
| 변경 파일 == 2 | PASS |

### 브라우저 실검증 (Playwright + 실제 dev 서버 :3001)

- **3상태 전부 재캡처** — password / magic / magicSent, 레이아웃 깨짐 0, **console error 0**
- **워드마크** — 3상태 **전부**에서 렌더 확인. computed `color: rgb(255,255,255)`, `font-size: 12px` → brand-600 대비 **5.22:1 실측** (AA 4.5 통과)
- **magic 모드 소셜 복원** — `main button[aria-label]` = `["카카오로 시작하기","Google로 계속하기","Apple로 계속하기"]` (3개), 회원가입 줄 visible
- **magicSent 소셜 미노출 유지** — `main button[aria-label]` = **0개** (사용자 요구대로 무변경)
- **OAuth 배선 무회귀 (T-ta1-02)** — `/auth/v1/authorize` 인터셉트로 provider 확인, **공유 리팩터 후 6경로 전부 PASS**:
  - [password] 카카오→`kakao` · 구글→`google` · 애플→`apple`
  - [magic] 카카오→`kakao` · 구글→`google` · 애플→`apple`
- **에러 pill** — 실제 오배 로그인 → `Invalid login credentials`, computed `background: rgb(255,255,255)`(불투명 흰색) / `color: rgb(221,49,49)`(=danger). ledger의 4.61:1 근거 실측 확인
- **키보드 접근성** — 실제 Tab 순서 `이메일 → 비밀번호 → 로그인 → 카카오`, 카카오에서 `:focus-visible = true` (바나나 링 육안 확인)
- **매직링크 기능 생존** — 실제 OTP 발송 성공 → magicSent 정상 렌더
- **지도 aria-hidden** — 스크린리더 트리에서 제외됨 확인

## Deviations from Plan

### 1. [Rule 3 - Blocking] `lint` 게이트 실행 불가 — 기존 레포 상태

- **Found during:** Task 2 verify
- **Issue:** `pnpm --filter @moajoa/web lint`(`next lint`)이 "How would you like to configure ESLint?" 대화형 프롬프트로 빠지며 exit 1. 원인은 내 변경이 아니라 **레포에 ESLint 설정 파일이 처음부터 존재한 적이 없음**(`.eslintrc*` / `eslint.config.*` 전무, git 이력에도 없음). `eslint@9`(flat config) + `eslint-config-next@15.5.18`(eslintrc 전용) 조합이라 설정하려면 `@eslint/eslintrc` **신규 패키지 설치 + 레포 전역 설정 파일 + 전역 lint 에러 정리**가 필요.
- **Action:** 고치지 않음. (a) 패키지 설치는 deviation 규칙상 auto-fix 제외 (b) 레포 전역 툴링 도입은 프레젠테이션 quick task 범위 밖 (CLAUDE.md §3.3 surgical).
- **대체 근거:** 더 강한 신호로 보강 — **production `next build` PASS** + **Prettier `--check` PASS**(레포 `.prettierrc` 기준). 내 변경 파일에 한해 lint 등가 검증 확보.
- **후속 제안:** ESLint 셋업은 별도 chore 태스크로 분리 권장.

### 2. [Rule 1 - 내 변경이 만든 포맷 위반] Prettier 정리

- **Found during:** Task 2 verify
- **Issue:** 내가 작성한 `<svg ...>` 2줄이 101자로 `printWidth: 100` 초과.
- **Fix:** `prettier --write apps/web/app/login/page.tsx` — **내 svg 2줄만** 래핑됨(인증 로직 무접촉, auth-diff 게이트 재확인 0).
- **손대지 않은 것:** `login.test.tsx`도 Prettier 위반이 있으나 그 위치는 **내가 건드리지 않은 기존 `vi.mock` 블록**(HEAD 시점부터 이미 위반). 기존 dead formatting은 정리하지 않음(CLAUDE.md §3.3) — 고쳤다면 Task 1의 `3-3` 라인 게이트도 깨짐.

### 3. [checkpoint에서 surface → **사용자 결정으로 해소**] MOAJOA 워드마크 복원

- **원래 상황:** 시안 1d에 워드마크가 없어 기존 상단 로고 블록(MapPin 카드 + 큰 MOAJOA + 태그라인)이 통째로 사라졌음. checkpoint에서 사용자에게 명시적으로 flag.
- **사용자 결정:** "작게 되살리기" — 로그인 화면에 서비스 이름이 아예 없는 건 원치 않음. 단 기존 3단 로고 블록 복원은 아니고, 헤드라인이 주인공 자리를 유지해야 함.
- **반영 (`ebb1aff`):** 배지 위에 `MapPin(size-3.5) + "MOAJOA"(text-xs, font-bold, tracking-[0.14em])` **한 줄**. 색은 banana가 아닌 **white** — 헤드라인(banana-100, 30px)과 색·크기를 분리해 "라벨"로 읽히게 함.
- **대비 실측 (contrast_ledger 추가 항목):**

  | 요소 | 전경 | 배경(최악) | 실측 | 기준 | 판정 |
  |---|---|---|---|---|---|
  | 워드마크 12px/700 | white `rgb(255,255,255)` | brand-600 | **5.22:1** | 4.5 | ✓ |

  (Playwright로 computed style을 읽어 WCAG 공식으로 계산 — 주장이 아닌 실측)
- **stagger 재배치:** 워드마크(0) → 배지(60ms) → 헤드라인(120ms) → 지도(180ms) → 폼(240ms)

### 4. [checkpoint에서 surface → **사용자 결정으로 해소**] magic 모드에도 소셜 로그인 복원

- **원래 상황:** plan 폼 명세상 디바이더·소셜·회원가입 줄이 password 모드 전용이라, magic 화면에서 소셜 버튼이 사라졌음.
- **사용자 결정:** 소셜은 마찰이 가장 적은 경로 → magic 화면에서 숨기면 이탈이 늘어난다. **magic 모드에도 복원.** 단 **magicSent는 그대로 유지** — 메일함으로 가야 할 사용자에게 소셜 버튼은 노이즈.
- **반영 (`ebb1aff`):** 디바이더 + 원형 소셜 3개 + 회원가입 줄을 `socialBlock` JSX 변수로 **1회만 정의**하고 password·magic 두 모드가 재사용. `oauth`/`signUp`/`pending`/`email`/`password` 클로저를 그대로 쓰므로 prop drilling 0.
  - **JSX 복붙 없음 증명:** `const socialBlock` 정의 **1회**, `{socialBlock}` 사용 **2회**, 파일 내 `<svg` 개수는 여전히 **3** (복붙했다면 6이 됐을 것).
  - 별도 파일로 추출하지 않음 (CLAUDE.md §3.2 — single-use 추상화 금지).

## Threat Model 결과

| Threat | 상태 |
|---|---|
| T-ta1-01 (callbackUrl open-redirect 가드 훼손) | **무회귀** — helper 무수정, auth-diff 게이트 0줄 |
| T-ta1-02 (소셜 버튼 provider 오배선) | **무회귀** — 유닛테스트 + 라이브 authorize 인터셉트로 **password·magic 2모드 × 3종 = 6경로 전부** 확인 (socialBlock 공유 리팩터 후 재검증) |
| T-ta1-03 (지도가 실데이터로 오인) | accept — 하드코딩 더미(오사카), fetch 0, aria-hidden |
| T-ta1-SC (패키지 설치) | **해당 없음** — 신규 런타임 의존성 0 |

## Known Stubs

없음. 지도 일러스트는 의도된 정적 장식(더미 데이터, aria-hidden)이며 데이터 배선 대상이 아니다.

## Checkpoint (Task 3)

사용자가 3상태 렌더를 확인하고 **approved**. 동시에 executor가 surface한 deviation 2건에 대해 수정을 결정 → deviation #3·#4로 반영 완료 (`ebb1aff`). Task 3 종료.

## Self-Check: PASSED

- `apps/web/app/login/page.tsx` — FOUND (수정됨)
- `apps/web/__tests__/login.test.tsx` — FOUND (수정됨)
- commit `ec04b1f` — FOUND
- commit `c450669` — FOUND
- commit `ebb1aff` — FOUND
