# Session Notes — 2026-05-25 (Day 2)

피봇 스캐폴드 + 인증·DB·Edge Function 배포 + 1차 검증까지 끝낸 상태.

## 추가로 잠긴 결정 (Day 1 SESSION-NOTES와 함께 봐주세요)

| 결정 | 선택 |
|---|---|
| Web 역할 (재확인) | **공개 보드 열람 전용** — 보드 생성/링크 추가 UI는 dev tool, MVP에선 제거 또는 admin-only |
| 인증 (1차) | **이메일 + 비밀번호** 메인 / 매직 링크 토글 / Google OAuth (provider 설정만 남음) / Apple은 Phase 2 |
| Confirm Email | **OFF** — 매직 링크 자체가 이메일 인증 역할 |
| 추출 정교화 | **나중에 깊게** — 현재 baseline (Claude + Places API)만 |
| iOS 빌드 경로 | **로컬 native build는 모노레포 + RN 이슈로 보류** — EAS Build 또는 npmrc 조정 후 재시도 |

## 이번 세션에서 작동 확인된 것

- ✅ Web SSR 렌더링 (홈, 로그인, 보드)
- ✅ Supabase Auth (이메일 가입/로그인)
- ✅ Supabase 마이그레이션 3개 배포 (`0001_init` · `0002_fix_rls_recursion` · `0003_boards_owner_default`)
- ✅ Edge Function `extract-youtube` 배포 + 시크릿 설정 (ANTHROPIC + Google Places)
- ✅ DB 타입 자동 생성 (`pnpm supabase:types` 동작)
- ✅ RLS 정책 (boards/memberships 사이클 깨진 거 수정함)

## 발견·해결된 버그 6개

| # | 버그 | 해결 |
|---|---|---|
| 1 | placeholder Database 타입이 너무 빡빡해서 SupabaseClient 제네릭 컴파일 실패 | MoajoaSupabaseClient → SupabaseClient<any,any,any> |
| 2 | pnpm @types/react 18(iOS) ↔ 19(Web) 충돌 | 루트 `.npmrc` 에 `public-hoist-pattern[]=` 추가해 isolation |
| 3 | Turbopack이 `from './foo.js'` 형식 import 못 풀음 | 워크스페이스 패키지의 `.js` extension 일괄 제거 |
| 4 | Tailwind v4가 `tailwind.config.ts` 자동 로드 안 함 → 브랜드 컬러 무시 | `@config "../tailwind.config.ts"` 디렉티브 추가 |
| 5 | 마이그레이션 ordering: boards 정책이 미생성 memberships 참조 | 정책 선언을 memberships 생성 뒤로 이동 |
| 6 | RLS 사이클 (boards↔memberships) → 42P17 | SECURITY DEFINER 헬퍼 함수 (`am_board_owner`, `am_board_member`)로 끊음 |

## 미완 / 알려진 이슈

### 🔴 iOS local build 막힘
- 증상: `pod install` 단계에서 react-native-reanimated podspec이 pnpm 가상 store 경로 못 풀음
- 우회 시도해본 것: 없음 (시간 절약 위해 보류)
- 다음 시도 후보:
  1. `apps/ios/.npmrc`에 `node-linker=hoisted` 또는 `shamefully-hoist=true`
  2. EAS Build (클라우드)
  3. Yarn으로 iOS만 분리
- 영향: Share Extension 실험, 실기기 테스트 불가. **Web으로 검증은 가능**

### 🟡 OAuth provider 미설정
- Google/Apple 버튼은 UI에 있지만 Supabase Dashboard에서 provider 활성화 안 됨
- 가이드: `docs/CREDENTIALS-CHECKLIST.md` § Google OAuth 절차

### 🟡 추출 비용·정확도 측정 부재
- Edge Function 동작하지만 영상별 비용·정확도 데이터 없음
- 다음 단계: eval sample 10~20개로 baseline 측정

### 🟢 (참고) Supabase 무료 SMTP 한계
- 시간당 4개 이메일 제한, 스팸 분류 잦음
- 운영 시 Resend 같은 커스텀 SMTP로 교체 권장

## 팀 분배 가이드

상세는 `docs/WORKSTREAMS.md` — 5개 트랙 (iOS · Web · 백엔드 · 디자인 · Auth) 으로 분리. 파일 경계 거의 안 겹침.

## 다음 세션 후보 시작점

(누가 무엇을 가져가느냐에 따라)

- **iOS 담당자:** `apps/ios/.npmrc`에 `shamefully-hoist=true` 또는 EAS Build 셋업
- **Web 담당자:** `/b/[slug]` 폴리시 + OG 이미지 생성 (`@vercel/og`)
- **백엔드 담당자:** eval sample 10개 영상으로 추출 정확도 baseline 측정
- **디자인 담당자:** `apps/ios/assets/icon.png` 1024×1024 + splash
- **풀스택:** Google OAuth provider 설정 마무리 (Cloud Console + Supabase Dashboard)

---

## Phase 1 — iOS Build Path A 시도 (BUILD-01, plan 01-02 Task 2)

- 시작 시각: 16:38
- Path A 시도: local prebuild + pod install + (Task 3에서 expo run:ios --device by user)
- 4시간 timebox 종료 예상: 20:38
- Wave 1 (plan 01-01) 산출물 lock 확인: .npmrc node-linker=hoisted, icon/splash/font 자산 모두 present

### 시도 timeline
- 16:38: `npx expo prebuild --platform ios --clean` 시작 (cwd=apps/ios)
- 16:39: prebuild Native directory 생성 OK (`ios/MOAJOA.xcodeproj`, `ios/Podfile` 생성됨)
- 16:39: 자동 `pod install` 1차 시도 → **블록**. CocoaPods 1.16.2 + Ruby 4.0.2 호환성 버그
  - 에러: `Encoding::CompatibilityError` in `UnicodeNormalize.normalize` (Pod::Config#installation_root)
  - 원인: CocoaPods가 본인이 출력한 경고("CocoaPods requires your terminal to be using UTF-8 encoding")를 본인이 위반. ASCII-8BIT locale에서 unicode_normalize 호출.
  - **이건 D-13 (reanimated/pnpm symlink) 막힘이 아님** — locale 문제. .npmrc node-linker=hoisted (Wave 1)는 prebuild 단계 통과시킴.
- 16:39: 2차 시도 — `cd apps/ios/ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`
- 16:53: ✅ `Pod installation complete! There are 90 dependencies from the Podfile and 91 total pods installed.` (pod install 자체 시간: ~828s = 13.8분)
- 16:53: `apps/ios/ios/MOAJOA.xcworkspace` 생성 확인됨

### 결과
- **Path A 성공** — 총 경과 ~14분 (4h timebox의 6%). Path B (EAS) 불필요.
- 생성물: `apps/ios/ios/` (gitignored — apps/ios/.gitignore에 `ios/` 존재). git tree clean.
- 다음: Task 3 (human-verify) — 사용자가 Xcode에서 `apps/ios/ios/MOAJOA.xcworkspace` 열고 실기기 install + smoke screen 시각 검증.

### 학습 (PITFALLS 후보)
- **새 pitfall: CocoaPods 1.16.2 + Ruby 4.0.2 (homebrew) + non-UTF-8 locale → pod install 즉시 크래시 with Encoding::CompatibilityError.** `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` env로 회피. `npx expo prebuild`의 자동 pod install은 이 env를 set하지 않음 — workaround: 첫 prebuild 후 수동으로 pod install 재실행, 또는 `~/.zshrc`에 `export LANG=en_US.UTF-8` 영구 추가.

### Task 3 — 실기기 install + smoke screen 시각 검증 (BUILD-01/02/03)

- 17:13~17:29 (총 16분, 사용자 세션):
  - 17:13: 첫 `expo run:ios --device` 시도 → 빌드 OK + install OK. JS bundle load "No script URL provided" (Metro 미시작 단계).
  - 17:24: Metro 시작 + iPhone Reload JS → **두 번째 빨간 에러**:
    ```
    Unable to resolve "react-native-css-interop/jsx-runtime" from
    node_modules/.pnpm/expo-router@.../expo-router/build/qualified-entry.js
    ```
  - 17:27: **새 pitfall 진단·수정 (commit `500ad75` `fix(01-02): add react-native-css-interop as direct dep for pnpm hoist resolution`).**
    - 원인: nativewind@4.2.4 → react-native-css-interop@0.2.4 (direct dep) — pnpm `.pnpm/` store에만 존재. `apps/ios/.npmrc node-linker=hoisted`는 *apps/ios에서 pnpm install 실행할 때만* 적용되는데 Wave 1은 root에서 install. 결과: root/apps-ios 양쪽 `node_modules/`에 css-interop 부재. `apps/ios/metro.config.js`의 `disableHierarchicalLookup=true`가 pnpm store walk를 막아 module resolution 실패.
    - Fix: `apps/ios/package.json` dependencies에 `"react-native-css-interop": "0.2.4"` 명시 → `pnpm install` → root `node_modules/react-native-css-interop/` 등장 → Metro lookup의 두 번째 path가 잡음.
  - 17:28: `pnpm exec expo start --clear` (Metro cache clear) + iPhone Reload JS
  - 17:29: ✅ **smoke screen 정상 표시** — orange `bg-brand-500` + 흰 카드 `rounded-2xl shadow-lg` + "NativeWind OK" `text-brand-700` bold + 한글 `text-neutral-600` 잘림 없이 렌더.

### 결과: BUILD-01 ✓ / BUILD-02 ✓ / BUILD-03 ✓ — Phase 1 iOS 빌드 게이트 통과

- 스크린샷: (사용자 보유, 본 세션 turn에 첨부됨 — `docs/screenshots/2026-05-25-phase1-smoke.png`로 저장 권장)
- 카드 위치가 화면 중앙보다 살짝 아래 — SafeAreaProvider inset 영향. Plan success criteria 무관 (className 적용 여부만).
- Pretendard weight matching (Assumption A1): bold가 시각적으로 굵게 나옴 → PostScript name 매칭 OK 추정. useFonts hook 추가 불필요.

### 학습 추가 (PITFALLS 후보 2번째)
- **pnpm + nativewind 4.2 + apps/ios subpackage hoist: transitive dep `react-native-css-interop`가 root/apps-ios 어디에도 hoist 안 됨.** Metro `disableHierarchicalLookup=true`와 결합되어 module resolution 실패. **회피:** nativewind의 direct dep를 apps/ios의 package.json에도 명시적으로 선언 (declarative duplication — pnpm hoist 보장). 또는 root `.npmrc`에 `public-hoist-pattern[]=react-native-css-interop` (하지만 root는 isolation 위해 안 만지는 게 원칙 — apps/ios direct dep 방식 권장).
