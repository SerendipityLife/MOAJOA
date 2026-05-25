# Phase 1: Build Unblock & Hygiene - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

iOS 실기기에서 앱 셸이 빌드·실행되고 NativeWind className이 실기기에 시각적으로 적용된다. 동시에 첫 인상 자산(app icon · launch splash · 워드마크 · Pretendard 폰트)을 SVG single source 기반으로 도입하고, web의 임시 "보드 생성/링크 추가" 폼은 환경변수 뒤로 격리한다.

**Scope anchor:** 빌드 + 폰트/아이콘/스플래시 + web dev-tool 격리. 인증 흐름·Share Extension·보드 e2e는 Phase 3.

</domain>

<decisions>
## Implementation Decisions

### iOS 빌드 경로

- **D-01:** **Local prebuild A 우선 시도 → 4시간 안에 막히면 즉시 EAS Build B로 전환.** (Pitfall 6 timebox lock)
- **D-02:** Hoisting 범위는 **`apps/ios/.npmrc`에 `node-linker=hoisted` 한정**. 루트나 다른 워크스페이스에는 적용하지 않는다 (Callstack 권장 패턴).
- **D-03:** EAS Build를 쓰게 되면 profile은 **`development` (expo-dev-client 포함)**. JS hot reload 유지로 dogfooding 단계 디버깅 최적. ad-hoc 등록 필요.
- **D-04:** 실기기 install 마지막 마일은 **EAS 경로일 때 QR + Expo Orbit, local 경로일 때 Xcode device install**. TestFlight는 v1 dogfooding에서 오버킬.

### App icon · splash · 워드마크 자산 파이프라인

- **D-05:** **원본 디자인 자산은 아직 없다 — Phase 1 안에서 디자인까지 같이 만든다.** 단순한 형태(워드마크 + icon mark + brand color splash)로 1차 도입, 고도화는 v2.
- **D-06:** **`packages/ui-tokens/src/brand/`에 SVG single source** 두고 export 스크립트(sharp 기반)로 iOS @2x/@3x PNG · web favicon · OG 이미지 자산을 자동 생성. 1회 셋업 + Phase 4 OG에서 재사용.
- **D-07:** Splash screen은 **워드마크 중앙 정렬 + brand color 배경**의 단일 이미지. expo-splash-screen 기본 설정 사용.

### Pretendard 폰트

- **D-08:** **Phase 1에 포함, 4 weight (Regular · Medium · SemiBold · Bold).** iOS는 expo-font, Web은 `next/font/local` 양쪽 셋업. SIL OFL 1.1 라이선스 첨부. Phase 4 OG 이미지에서 필수이므로 미루지 않음.

### Web dev-tool 격리

- **D-09:** **이중 게이트** — `/boards` 페이지 자체에서 `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정 시 redirect, `CreateBoardButton`/`AddLinkForm` 컴포넌트에서도 다중 방어로 env 체크 → null 리턴.
- **D-10:** Prod에서 env 없을 때 default 행선은 **`/login` redirect** (WEB-02 success criterion과 일치).
- **D-11:** **escape hatch 없음** — env 단일 게이트로 충분. user_id allowlist 같은 v1.5 구조는 도입하지 않음.
- **D-12:** **`/boards` 경로 그대로 유지** — `/(dev)/boards`로 이동하거나 `/admin` 하위로 옮기지 않음. WEB-01/WEB-02 트짛으로 쓰는 PR 범위 최소화.

### Phase 1 통과 기준 (실기기 검증 범위)

- **D-13:** **실기기 입증 도달점 = Splash + `app/index.tsx` 렌더 + NativeWind 시각 적용 확인까지.** login.tsx 인증 흐름은 Phase 3로 이관 (SAVE-01과 중복 회피).
- **D-14:** EAS로 fallback한 경우 **`docs/SESSION-NOTES-YYYY-MM-DD.md`에 timeline + 결정 + 대체 경로 사유**를 기록 (success criterion #3 만족 형식).

### 스코프 외 (Phase 1에 포함하지 않음)

- **D-15:** **Sentry/Crash reporting은 Phase 1에 포함하지 않음** — v2 (PROJECT.md Out of Scope 정렬).
- **D-16:** **expo-share-intent / Share Extension은 Phase 3에서 처음 도입** — Phase 1에는 패키지·config 모두 추가하지 않음 (현재 app.config.ts의 "Phase 1.5에 재추가" 주석 유지).

### Claude's Discretion

- pnpm lockfile freeze 시점·방식 (plan-phase에서 결정)
- `react-native-worklets` peer 명시 위치 (apps/ios/package.json devDependencies vs dependencies)
- patch-package 적용 대상 (expo-share-intent는 Phase 3 도입 시 같이)
- NativeWind 4.2 breaking change scan 범위 (현 코드에서 className 사용 위치 자체가 적어 risk 낮음)
- SVG export script의 정확한 size matrix (iOS @1x/@2x/@3x + adaptive icon 등)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 정의·요구사항

- `.planning/ROADMAP.md` §"Phase 1: Build Unblock & Hygiene" — Goal, success criteria 5개, 의존성 (없음)
- `.planning/REQUIREMENTS.md` §"Build & Tooling (BUILD)" — BUILD-01/02/03 본문
- `.planning/REQUIREMENTS.md` §"Web Hygiene (WEB)" — WEB-01/02 본문
- `.planning/STATE.md` §"Accumulated Context" — Phase 결정 근거, 4시간 timebox 출처

### Research (실행 시 참고)

- `.planning/research/SUMMARY.md` §"Phase A: Unblock" — 1주 timebox + tasks 목록
- `.planning/research/SUMMARY.md` §"Critical Pitfalls" #1 (iOS 빌드 블랙홀) + #11
- `.planning/research/STACK.md` — Expo SDK 54, NativeWind 4.2, patch-package, Pretendard 라이선스
- `.planning/research/PITFALLS.md` — pnpm hoisting, Reanimated v4 + NativeWind silent failure 디테일
- `.planning/research/ARCHITECTURE.md` §"Image asset pipeline" — `packages/ui-tokens/src/brand/` SVG single source 패턴

### 프로젝트 가드레일

- `CLAUDE.md` §4.5 코드 스타일 — workspace import `.js` extension 금지 (Turbopack)
- `CLAUDE.md` §5 절대 금지 목록 — Flutter 참조 X, Firebase X, 새 "보드 생성" UI X
- `docs/WORKSTREAMS.md` (있다면) — 파일 경계 (iOS vs Web vs Design)
- `docs/ARCHITECTURE.md` (있다면) — 모노레포 구조

### 외부 참조 (Phase 1 작업 시 lookup)

- Expo SDK 54 official docs (config plugins, splash, font) — researcher가 verify
- NativeWind 4.2 changelog (4.1.23 → 4.2.x breaking changes) — researcher 책임
- Pretendard repo (SIL OFL 1.1, weight 번들 파일명) — pretendard/pretendard
- Callstack monorepo guide (pnpm hoisting 패턴) — researcher가 lookup

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/ios/app.config.ts` — Expo config 작성됨. plugins 배열에 `expo-router`, `expo-font` 등록됨. icon/splash 자리 비어 있음 (코멘트만). 이번 phase에서 채움.
- `apps/ios/app/_layout.tsx`, `app/index.tsx`, `app/login.tsx`, `app/(tabs)/`, `app/boards/` — expo-router 구조 셋업됨. index.tsx까지 도달이 D-13 검증 대상.
- `apps/ios/global.css`, `tailwind.config.js`, `nativewind-env.d.ts` — NativeWind 셋업됨 (현재 4.1.23). 4.2로 업그레이드만.
- `apps/web/app/boards/page.tsx`, `apps/web/app/boards/_components/create-board-button.tsx` — 격리 대상 dev-tool UI 위치 확인.
- `apps/web/app/boards/[id]/_components/add-link-form.tsx` — 격리 대상 dev-tool UI #2.
- `apps/web/middleware.ts` — middleware 파일 존재. (이중 게이트 채택했으므로 middleware 변경은 안 함.)
- `packages/ui-tokens/` — brand 디렉토리 추가 위치. SVG single source의 home.

### Established Patterns

- Workspace import: `@moajoa/api`, `@moajoa/core`, `@moajoa/ui-tokens` (`.js` extension 금지)
- expo-router file-based routing — 이미 사용 중
- Supabase 클라이언트 분리: `lib/supabase/server.ts` 등 — 이번 phase는 안 건드림

### Integration Points

- iOS `app.config.ts` plugins 배열 → `expo-splash-screen`/`expo-font` 추가 자리
- `packages/ui-tokens/src/brand/` 신규 → 모노레포 build pipeline에 export script 등록 위치 (turbo.json `outputs` 갱신)
- `apps/web/app/boards/**` → 페이지 + 컴포넌트 양쪽에 `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 게이트 삽입 지점
- `apps/web/lib/env.ts` (있다면 — 없으면 신규) → env 체크 헬퍼 단일 위치
- `pnpm-workspace.yaml`, `apps/ios/.npmrc` (신규) — hoisting 범위 제한

</code_context>

<specifics>
## Specific Ideas

- "4시간 timebox" — 실시간 시계로 측정. 막힌 시점 SESSION-NOTES에 hh:mm 단위로 기록.
- 워드마크 + brand color splash는 "심플한 위주" — Phase 5 trust UI 디자인 전까지 임시 디자인이라는 인식 공유.
- SVG single source의 첫 적용은 Phase 1, 두 번째 적용은 Phase 4 OG 이미지 — 같은 export script가 두 phase에서 동작해야 한다.
- Pretendard 4 weight는 Phase 4 OG에서 `Bold`가 가장 자주 쓰일 가능성 — 4 weight 다 번들하지만 priority loading은 Bold/Regular 먼저.

</specifics>

<deferred>
## Deferred Ideas

- **expo-share-intent / Share Extension 셋업** — Phase 3로 이관 (D-16 명시)
- **Sentry / 에러 트래킹** — v2 (D-15, PROJECT.md Out of Scope)
- **EAS Update (OTA)** — v1.5 이후 (현재 dogfooding 단계에선 무가치)
- **Splash 클레버 애니메이션 (Lottie 등)** — Phase 5 candidate
- **TestFlight + Apple App Store submit** — Phase 6 이후 (외부 사용자 확장 시)
- **user_id allowlist / 관리자 panel** — v1.5 협업 보드 시작 시 같이 설계
- **NativeWind 4.2 이상 buffer** — 4.x 라인 안정화 후 결정
- **/admin route 구조** — v1.5

</deferred>

---

*Phase: 01-build-unblock-hygiene*
*Context gathered: 2026-05-25*
