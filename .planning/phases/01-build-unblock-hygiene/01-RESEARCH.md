# Phase 1 Research: Build Unblock & Hygiene

**Researched:** 2026-05-25
**Domain:** Expo SDK 54 + NativeWind 4.2 + Pretendard 폰트 + sharp 자산 익스포트 + Next.js dev-tool 환경 가드
**Confidence:** HIGH (모든 버전·파일 경로·API 시그니처는 npm registry / 공식 docs / 실제 패키지 tarball로 검증)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 ~ D-16)

**iOS 빌드 경로**
- **D-01:** Local prebuild A 우선 시도 → **4시간 안에 막히면 즉시 EAS Build B로 전환** (Pitfall 6 timebox lock)
- **D-02:** Hoisting 범위는 **`apps/ios/.npmrc`에 `node-linker=hoisted` 한정**. 루트나 다른 워크스페이스에는 적용하지 않는다 (Callstack 권장 패턴).
- **D-03:** EAS Build를 쓰게 되면 profile은 **`development` (expo-dev-client 포함)**. JS hot reload 유지로 dogfooding 단계 디버깅 최적. ad-hoc 등록 필요.
- **D-04:** 실기기 install 마지막 마일은 **EAS 경로일 때 QR + Expo Orbit, local 경로일 때 Xcode device install**. TestFlight는 v1 dogfooding에서 오버킬.

**App icon · splash · 워드마크 자산 파이프라인**
- **D-05:** 원본 디자인 자산은 아직 없다 — Phase 1 안에서 디자인까지 같이 만든다. 단순 워드마크 + icon mark + brand color splash로 1차 도입, 고도화는 v2.
- **D-06:** `packages/ui-tokens/src/brand/`에 SVG single source. sharp 기반 export 스크립트로 iOS @2x/@3x PNG · web favicon · OG 이미지 자동 생성. Phase 4 OG에서 재사용.
- **D-07:** Splash screen은 워드마크 중앙 정렬 + brand color 배경의 단일 이미지. expo-splash-screen 기본 설정 사용. (UI-SPEC에서 "흰 배경 + 브랜드색 워드마크"로 refinement됨 — 본 RESEARCH는 UI-SPEC을 따른다.)

**Pretendard 폰트**
- **D-08:** Phase 1에 포함, 4 weight (Regular · Medium · SemiBold · Bold). iOS는 expo-font, Web은 `next/font/local` 양쪽 셋업. SIL OFL 1.1 라이선스 첨부. Phase 4 OG 이미지 필수이므로 미루지 않음.

**Web dev-tool 격리**
- **D-09:** **이중 게이트** — `/boards` 페이지 자체에서 `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정 시 redirect, `CreateBoardButton`/`AddLinkForm` 컴포넌트에서도 다중 방어로 env 체크 → null 리턴.
- **D-10:** Prod에서 env 없을 때 default 행선은 **`/login` redirect** (WEB-02 success criterion).
- **D-11:** **escape hatch 없음** — env 단일 게이트로 충분.
- **D-12:** **`/boards` 경로 그대로 유지** — `/(dev)/boards`나 `/admin` 하위로 옮기지 않음.

**Phase 1 통과 기준**
- **D-13:** 실기기 입증 도달점 = Splash + `app/index.tsx` 렌더 + NativeWind 시각 적용까지. login.tsx 인증 흐름은 Phase 3로 이관.
- **D-14:** EAS로 fallback한 경우 `docs/SESSION-NOTES-YYYY-MM-DD.md`에 timeline + 결정 + 대체 경로 사유 기록.

**스코프 외**
- **D-15:** Sentry/Crash reporting 포함하지 않음 — v2.
- **D-16:** expo-share-intent / Share Extension은 Phase 3에서 처음 도입. Phase 1에는 패키지·config 모두 추가하지 않음.

### Claude's Discretion

- pnpm lockfile freeze 시점·방식
- `react-native-worklets` peer 명시 위치 (apps/ios/package.json devDependencies vs dependencies)
- patch-package 적용 대상 (Phase 1에 적용할 게 있는지)
- NativeWind 4.2 breaking change scan 범위
- SVG export script의 정확한 size matrix

### Deferred Ideas (OUT OF SCOPE)

- expo-share-intent / Share Extension 셋업 → Phase 3
- Sentry / 에러 트래킹 → v2
- EAS Update (OTA) → v1.5 이후
- Splash 클레버 애니메이션 (Lottie) → Phase 5
- TestFlight + App Store submit → Phase 6 이후
- user_id allowlist / 관리자 panel → v1.5
- NativeWind 4.2 이상 buffer → 4.x 라인 안정화 후
- `/admin` route 구조 → v1.5
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **BUILD-01** | iOS 앱이 실기기(아이폰)에서 로컬·EAS 둘 중 하나로 빌드되어 실행됨 | §"iOS Build Path A (Local Prebuild)" + §"iOS Build Path B (EAS Fallback)" + §"4-Hour Timebox Heuristic" |
| **BUILD-02** | iOS 빌드 시 NativeWind className이 적용되어 보임 (silent failure 없음) | §"NativeWind 4.2 Upgrade" — 4.1.23 → 4.2.4 업그레이드, Reanimated v4 호환 + smoke test JSX |
| **BUILD-03** | App icon · launch splash · 워드마크가 실기기 홈/스플래시에 정상 표시됨 | §"Brand Asset Pipeline" + §"Pretendard Font Pipeline" |
| **WEB-01** | 현재 Web에 있는 "보드 생성·링크 추가" 폼이 `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`일 때만 노출됨 | §"Web Dev-Tool Gate" — 이중 게이트 (page redirect + component null-return) |
| **WEB-02** | 공개 환경(`NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정)에서 web의 1차 진입은 `/b/[slug]` 또는 로그인 페이지에 한정됨 | §"Web Dev-Tool Gate" — Server-side redirect to `/login` |
</phase_requirements>

---

## Summary

Phase 1은 코드 작성 자체보다 **버전 매트릭스 잠금 + 빌드 환경 결정 트리 + 자산 파이프라인 1회 셋업**이 중심이다. iOS 빌드는 `pnpm install` → `npx expo prebuild --platform ios --clean` → `cd ios && pod install` 흐름으로 1차 시도하고, `apps/ios/.npmrc`에 `node-linker=hoisted` 한 줄로 pnpm isolated 의존성 문제를 회피한다. 4시간 timebox 안에 풀리지 않으면 `eas.json` `development` profile + `expo-dev-client`로 EAS Build로 전환한다. NativeWind는 **4.1.23 → 4.2.4** (`npm view nativewind@latest` 확인됨)로 업그레이드해야 Reanimated v4와의 silent failure를 막을 수 있고, 이 외 babel/metro/global.css 변경은 필요 없다 (현재 config가 4.2와 호환).

Brand 자산은 `packages/ui-tokens/src/brand/` 안에 `wordmark.svg` / `icon.svg` 두 SVG를 single source로 두고, `packages/ui-tokens/scripts/export-assets.mjs`라는 단일 sharp 스크립트가 iOS PNG (icon 1024² + splash 1242×2688 + adaptive-icon) · Web favicon.ico (32+16 multi-res) · apple-touch-icon (180²) · og-default (1200×630) 전부를 생성한다. sharp는 기본적으로 metadata를 strip하므로 비교적 결정적인 PNG를 만들지만 PNG의 IDAT 압축이 libpng 버전에 따라 다를 수 있어 "byte-identical" 보다는 "픽셀-identical"을 목표로 한다.

Pretendard는 npm `pretendard@1.3.9`로 받으면 `dist/public/static/Pretendard-{Regular,Medium,SemiBold,Bold}.otf` (각 1.5MB, 4개 합쳐 ~6.3MB) + `dist/public/static/alternative/Pretendard-{...}.ttf` (대안 .ttf, Bold만 2.6MB)이 모두 들어있다. **UI-SPEC의 "~1.6MB 합계" 추정은 4 weight가 ~6.3MB라는 점에서 ~4배 오차가 있다.** iOS bundle 크기는 여전히 수용 가능 범위이지만 planner는 이 수치를 인지하고 plan에 반영해야 한다. **Satori는 `.otf`/`.ttf`/`.woff`를 모두 지원**하므로 UI-SPEC이 명시한 "OG는 .ttf 필수"는 부정확하다 — iOS와 OG가 같은 `.otf`를 공유해도 동작한다. 단, UI-SPEC contract을 존중해 `Pretendard-Bold.ttf` 1개만 별도로 `apps/web/assets/` 또는 동등 위치에 두는 게 가장 안전 (Satori가 OTF에서 ligature 같은 OpenType feature를 제한적으로 처리하기 때문에 .ttf가 더 안전한 default).

Web dev-tool 격리는 D-09 이중 게이트로 `apps/web/app/boards/page.tsx`와 `apps/web/app/boards/[id]/page.tsx` 둘 다의 Server Component 머리에서 env 미설정 시 `redirect('/login')` 호출하고, `CreateBoardButton`·`AddLinkForm` Client Component에서도 추가로 env 체크 후 `return null`. `apps/web/lib/env.ts`는 현재 존재하지 않으므로 신규 생성한다.

**Primary recommendation:** Plan은 4개 wave로 구성한다 — Wave 1: NativeWind 4.2 업그레이드 + apps/ios/.npmrc + worklets peer 설치 (모두 패키지 변경, 1 PR), Wave 2: iOS prebuild + 실기기 검증 (4시간 timebox), Wave 3: ui-tokens/brand/ + sharp 스크립트 + Pretendard 폰트 파일 + expo-splash-screen plugin config + app.config.ts icon/splash 등록, Wave 4: web dev-tool 게이트 + env 헬퍼.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| iOS 빌드 환경 (.npmrc, prebuild) | iOS App (apps/ios) | Build infrastructure | Hoisting 범위 제한은 디렉토리 단위 .npmrc로 가장 명확 |
| NativeWind className 처리 | iOS App / Metro bundler | — | NativeWind babel preset + Metro transformer가 빌드 타임에 처리 |
| Brand 자산 source (SVG) | Shared design (packages/ui-tokens) | — | iOS + Web + OG가 모두 import — 단일 진실 |
| Brand 자산 export 스크립트 | Shared (packages/ui-tokens/scripts) | — | sharp 변환은 빌드 외부, 결과만 각 앱 dir에 committed |
| iOS app icon · splash 자산 | iOS App (apps/ios/assets) | — | Expo prebuild 시점에 native project로 복사 |
| Web favicon · OG 자산 | Web (apps/web/public, apps/web/app) | — | Next.js static asset 규칙 |
| Pretendard 폰트 (iOS) | iOS App (assets + expo-font plugin) | — | Bundle에 직접 포함, expo-font config plugin이 native register |
| Pretendard 폰트 (Web) | Web (next/font/local) | — | Next.js가 빌드 시 CSS 변수 + subset 처리 |
| Web dev-tool 환경 게이트 | Web Server Component (page level) | Web Client Component (defense in depth) | Server redirect = no flash; Client null = SSR/RSC 페이지 외 안전망 |

---

## iOS Build Path A (Local Prebuild) — BUILD-01 1차 시도

### 명령 흐름

```bash
# 1. (One-time) apps/ios 한정 hoisting 활성화
cat > apps/ios/.npmrc <<'EOF'
node-linker=hoisted
EOF

# 2. Reanimated v4 peer 명시 설치 (peer auto-install가 못 잡는 경우 대비)
pnpm --filter @moajoa/ios add react-native-worklets@^0.8.3

# 3. NativeWind 업그레이드 (BUILD-02와 합쳐서 같은 wave에 실행)
pnpm --filter @moajoa/ios add nativewind@^4.2.4
pnpm --filter @moajoa/ios add -D tailwindcss@^3.4.17

# 4. Workspace 의존성 다시 풀기
pnpm install

# 5. Expo prebuild — ios/ 디렉토리 생성 (clean으로 기존 ios/ 삭제 후 재생성)
cd apps/ios
npx expo prebuild --platform ios --clean

# 6. CocoaPods 설치 — `cd ios && pod install` 또는 prebuild가 자동으로 호출
#    (pod install이 실패하면 path A 실패 → 4-hour timebox 체크포인트 trigger)
cd ios && pod install && cd ..

# 7. 실기기 빌드 — Xcode에서 device 선택 후 Play 또는 CLI:
npx expo run:ios --device
# (대화형으로 device 목록이 뜸. 케이블 연결 + 신뢰 + Developer Mode 활성화 필요)
```

### 검증된 파일 변경

| 파일 | 변경 |
|------|------|
| `apps/ios/.npmrc` | **신규** — `node-linker=hoisted` (D-02) — 현재 존재 X (확인됨) |
| `apps/ios/package.json` | nativewind: `^4.1.23` → `^4.2.4`, tailwindcss: `^3.4.13` → `^3.4.17`, react-native-worklets (신규) 추가 |
| 루트 `pnpm-lock.yaml` | install 후 자동 갱신 → 빌드 통과 시점에 git commit (lockfile freeze) |
| `apps/ios/ios/` | **`expo prebuild --clean`이 생성/재생성** — 현재 존재 X (Expo는 prebuild 결과를 `.gitignore`로 둘지 commit할지 정책 결정 필요. 현재 `apps/ios/.gitignore`에 `ios/`가 있다면 untracked) |

### `node-linker=hoisted` 동작 원리

pnpm의 `node-linker` 설정은 `node_modules` 생성 전략. 기본 `isolated`는 각 패키지가 자기 `node_modules`에 symlink만 가지고 실제 패키지는 글로벌 store에서 hard-link로 가져옴. RN 네이티브 라이브러리는 podspec resolution 시 절대 경로를 기대하기 때문에 pnpm symlink chain을 못 푸는 경우가 잦다.

`node-linker=hoisted`는 npm/yarn 같은 flat `node_modules` 구조를 만든다 — apps/ios 디렉토리 *안에서만* 적용되므로 web의 isolated tree에는 영향이 없다. Callstack 가이드 + 본 프로젝트의 `.planning/research/ARCHITECTURE.md` §1 권장 패턴.

### 실기기 install (D-04 local 경로)

`npx expo run:ios --device` 또는 Xcode `apps/ios/ios/MOAJOA.xcworkspace` 열기 → 상단 device dropdown에서 USB 연결된 iPhone 선택 → Play. 첫 install 시 iPhone 잠금 해제 + "이 컴퓨터 신뢰" + Apple ID Developer Certificate 자동 sign 필요.

### 종료 신호 (성공)

- `pod install` 완료 시 `Pod installation complete!`
- `expo run:ios --device` 종료 시 iPhone 홈화면에 MOAJOA 앱 아이콘 표시
- 앱 launch 시 `app/index.tsx` 렌더링 (D-13 검증점)

**Source:** [Expo Monorepos guide](https://docs.expo.dev/guides/monorepos/) (HIGH), [Callstack RN Monorepo with pnpm](https://www.callstack.com/blog/react-native-monorepo-with-pnpm-workspaces) (MEDIUM), `.planning/research/ARCHITECTURE.md` §1 (HIGH, internal)

---

## iOS Build Path B (EAS Fallback) — BUILD-01 4시간 timebox 후

### `eas.json` development profile shape

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium",
        "simulator": false
      }
    },
    "preview": {
      "extends": "development",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

핵심: `"developmentClient": true` + `"distribution": "internal"` + `"simulator": false`. 이게 ad-hoc 빌드 + `expo-dev-client` 번들을 생성한다. JS는 Metro dev server에서 hot-reload, native shell만 EAS에서 빌드.

### 사전 준비 명령

```bash
# 1. EAS CLI 설치 (글로벌 또는 npx)
npm install -g eas-cli  # 또는 npx eas-cli

# 2. Expo 계정 로그인
eas login

# 3. 프로젝트 초기화 — eas.json + EAS projectId 등록
eas init  # 또는 eas build:configure

# 4. expo-dev-client 설치 (development profile 필수 의존)
pnpm --filter @moajoa/ios add expo-dev-client@^56.0.15  # SDK 54 호환 라인

# 5. ad-hoc device 등록 (iPhone 실기기에 install하려면 UDID 등록 필요)
eas device:create
# → 안내대로 진행:
#    Apple Developer 로그인 → 등록 페이지 URL 발급 →
#    iPhone에서 그 URL 열기 → "Allow" → device가 Apple Dev account에 등록됨
```

### 빌드 + 설치

```bash
# 6. 빌드 트리거 (apps/ios 디렉토리 안에서 실행)
cd apps/ios
eas build --profile development --platform ios

# 7. 빌드 완료 후 (~10~20분):
#    EAS 대시보드에 빌드 결과 URL이 나오고 QR 코드 표시됨
#    iPhone에서 Expo Orbit 앱 또는 카메라로 QR 스캔 → 설치
#    또는 직접 .ipa 다운로드 → Apple Configurator 2 또는 Xcode Devices에서 install
```

### `expo-dev-client` 역할

기본 Expo Go 앱은 native module 변경 못 받음 — Share Intent · Reanimated v4 worklets 등 native 의존성이 있는 패키지는 Expo Go에서 안 돔. `expo-dev-client`는 *프로젝트 전용* Expo Go를 빌드한다. JS는 여전히 hot-reload되지만 native shell이 우리 프로젝트의 모든 native deps를 포함.

**Source:** [Configure EAS Build with eas.json](https://docs.expo.dev/build/eas-json/) (HIGH), [Create a development build on EAS](https://docs.expo.dev/develop/development-builds/create-a-build/) (HIGH), [EAS CLI reference](https://docs.expo.dev/eas/cli/) (HIGH)

---

## 4-Hour Timebox Heuristic — Path A에서 B로 전환할 신호

다음 중 **하나라도** 4시간 누적 소비 시 즉시 EAS로 전환 (D-01):

| 신호 | 의미 |
|------|------|
| `pod install`이 2회 연속 같은 podspec 에러 (`Unable to find a specification for X`) | pnpm symlink가 풀리지 않는 근본 문제 — hoist 적용해도 안 되면 EAS |
| `npx expo prebuild` 후 `apps/ios/ios/` 디렉토리에 예상치 못한 파일 변경 (Plugins 미적용, autolinking 누락) | Expo SDK 54의 autolinking이 isolated tree에서 부분 실패 |
| Xcode "Signing requires a development team" + Personal Team 설정해도 실기기 install 거부 | Apple Developer certificate trust 문제 — EAS의 사전 등록된 ad-hoc provisioning이 우회 |
| `react-native-worklets` 런타임 에러 (`'_WORKLET_INIT_DATA'` undefined) | Reanimated v4 ↔ worklets peer 누락이 빌드는 통과하지만 런타임에서 터짐 — peer install 후에도 발생 시 EAS로 |
| Metro bundler가 `@moajoa/api`나 `@moajoa/ui-tokens` workspace 패키지를 못 찾음 | metro.config.js의 watchFolders가 작동하지만 hoist 후 path mapping이 어긋남 |

**EAS 전환 후 docs/SESSION-NOTES-YYYY-MM-DD.md 기록 항목 (D-14 success criterion #3):**

- 시작 시각 (hh:mm)
- 4시간 timebox 도달 시각
- 시도된 path A 액션 목록 (시간 순)
- 마지막 차단 신호
- EAS 전환 시각
- EAS 첫 빌드 성공 시각
- 실기기 install 성공 시각

---

## NativeWind 4.2 Upgrade — BUILD-02

### 4.1.23 → 4.2.4 변경 매트릭스 (verified via npm view)

```bash
# 현재
nativewind: ^4.1.23
tailwindcss: ^3.4.13

# 목표
nativewind: ^4.2.4  # latest stable in 4.x line (확인됨: npm view nativewind dist-tags.latest)
tailwindcss: ^3.4.17  # minor bump, 안정
```

`5.0.0-preview.4` (preview tag)는 사용 X — D-deferred. 4.x 라인 안정화 유지.

### breaking change 분석

4.1.x → 4.2.x는 **major breaking change 없음**. 주요 patch:

1. **Reanimated v4 호환** — `react-native-worklets`가 별도 패키지로 분리된 것에 대응. NativeWind 4.2.0+가 worklets API 시그니처 변경에 맞춰 패치됨. 이게 silent failure 차단의 핵심.
2. 4.2.4 자체는 README 배너 추가 + 저장소 URL 변경 같은 housekeeping (`nativewind/nativewind`로 ownership 이동).
3. `withNativewind` Metro 래퍼 API는 **변경 없음** (4.x 라인 내내). 현재 `apps/ios/metro.config.js`의 `withNativeWind(config, { input: './global.css' })` 그대로 유지.
   - 주의: 두 번째 인자가 옵션이 되는 변경은 NativeWind **v5**의 변경 (v5는 Deferred).
4. babel preset 변경 없음 — 현재 `apps/ios/babel.config.js`의 `['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'` 유지.
5. `global.css` directives 변경 없음 — 현재 `@tailwind base; @tailwind components; @tailwind utilities;` 유지.

### `react-native-worklets` peer 설치 (Claude's Discretion: 위치 결정)

```bash
pnpm --filter @moajoa/ios add react-native-worklets@^0.8.3
```

**위치 결정 (D-15에 권장):** `dependencies`에 넣는다. 이유:
- 런타임에 native 모듈 활성화 필요 → `devDependencies`는 prod 번들에서 빠질 수 있음
- Expo prebuild가 autolinking할 때 `dependencies`를 우선 탐색
- Reanimated 4.x peer 표기와 동일 contract

⚠️ **babel.config.js에 `react-native-worklets/plugin`을 추가하지 말 것.** Reanimated v4의 `react-native-reanimated/plugin`이 이미 worklets 처리를 내장. 둘 다 등록 시 `Duplicate plugin/preset detected` 에러 (검증된 known issue).

### Silent failure 차단 smoke test

빌드 후 실기기에서 NativeWind className이 실제로 적용되었는지 시각적으로 확인할 수 있는 최소 JSX:

```tsx
// apps/ios/app/index.tsx (또는 신규 임시 화면)
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-500">
      <View className="px-6 py-4 bg-white rounded-2xl shadow-lg">
        <Text className="text-2xl font-bold text-brand-700">
          NativeWind OK
        </Text>
        <Text className="text-sm text-neutral-600 mt-2">
          오렌지 화면 + 흰 카드 + 진한 오렌지 텍스트가 보이면 className 적용됨
        </Text>
      </View>
    </View>
  );
}
```

**예상 시각 결과 (실기기):**
- 전체 화면 배경: `#F97316` (brand-500, 따뜻한 오렌지)
- 중앙 카드: 흰색, 라운드 코너 + 그림자
- 카드 안 큰 텍스트: 진한 오렌지 (`brand-700` = `#C2410C`), bold
- 카드 안 작은 텍스트: 회색 (`neutral-600` = `#475569`)

**Silent failure 진단:**
- 화면이 흰색이거나 기본 배경색이면 → className이 무시됨 → NativeWind 미작동
- 텍스트만 보이고 배경/카드 스타일 X → babel preset 누락
- HMR이 변경을 안 받음 → `npx expo start -c` (Metro cache 초기화)

### tailwind.config.js 검증

현재 `apps/ios/tailwind.config.js`는 이미 ui-tokens preset을 import:

```js
const { tailwindPreset } = require('@moajoa/ui-tokens/tailwind');
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset'), tailwindPreset],
};
```

검증됨 — `packages/ui-tokens/src/tailwind.ts`도 존재 (CommonJS require path는 ESM `.ts`로 정상 resolve됨, ts-node가 처리). **추가 변경 불필요.** UI-SPEC에서 언급한 "shared preset" 파일이 이미 존재한다 (Open Questions 0개).

**Source:** [NativeWind GitHub releases](https://github.com/nativewind/nativewind/releases) (HIGH, verified), [Reanimated 4 migration guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/) (HIGH), `.planning/research/STACK.md` §4 (HIGH, internal), `.planning/research/PITFALLS.md` Pitfall 6 (HIGH, internal)

---

## Brand Asset Pipeline — BUILD-03

### 디렉토리 구조 (신규)

```
packages/ui-tokens/
├── package.json              # 기존 — scripts에 "export-assets" 추가
├── src/
│   ├── index.ts              # 기존
│   ├── tailwind.ts           # 기존
│   └── brand/                # 신규
│       ├── wordmark.svg      # 신규 — Pretendard Bold "MOAJOA" outlined
│       ├── icon.svg          # 신규 — M 모양 지도 핀
│       └── LICENSE-Pretendard.txt  # 신규 — SIL OFL 1.1 (워드마크 폰트 출처 명시)
└── scripts/                  # 신규
    └── export-assets.mjs     # 신규 — sharp 기반 export
```

### `wordmark.svg` 최소 markup 패턴

```svg
<!-- packages/ui-tokens/src/brand/wordmark.svg -->
<!-- 디자인 작업: Figma/Illustrator에서 Pretendard Bold "MOAJOA"를 outline으로 변환 후 export. -->
<!-- letter-spacing: -0.02em, 모든 letter는 path로 변환 (font 의존성 제거) -->
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 500 100"
     fill="#F97316">
  <!-- 6 letters × 평균 80px width = ~480px + spacing.
       각 letter는 <path d="..."/>로 outline. 첫 출시는 디자이너가 1회 작업. -->
  <path d="M ... Z"/>  <!-- M -->
  <path d="M ... Z"/>  <!-- O -->
  <path d="M ... Z"/>  <!-- A -->
  <path d="M ... Z"/>  <!-- J -->
  <path d="M ... Z"/>  <!-- O -->
  <path d="M ... Z"/>  <!-- A -->
</svg>
```

viewBox는 ~5:1 비율 (UI-SPEC). 디자이너가 작업할 actual path는 Phase 1 Wave 3에서 결정. 본 RESEARCH는 sharp 스크립트가 viewBox만 알면 PNG 변환은 정확히 작동한다는 점을 보증.

### `icon.svg` 최소 markup 패턴

```svg
<!-- packages/ui-tokens/src/brand/icon.svg -->
<!-- 1:1 square, content는 inner 80% (102px ~ 922px in 1024² 캔버스에 대응).
     M 모양 + 아래쪽 핀 끝점. 단일 fill color로 SVG 단순화. -->
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 1024 1024">
  <!-- 흰 배경 (iOS app icon contract) -->
  <rect width="1024" height="1024" fill="#FFFFFF"/>
  <!-- M-shaped pin in brand color, content in inner 80% (102..922 each axis) -->
  <path d="M 200 250
           L 350 250
           L 512 500
           L 674 250
           L 824 250
           L 824 700
           L 700 800   /* pin point */
           L 512 950
           L 324 800
           L 200 700 Z"
        fill="#F97316"/>
</svg>
```

(actual path는 디자인 검토 후 결정. 본 패턴은 sharp가 받아들이는 valid SVG 예시.)

### `export-assets.mjs` — sharp 정확한 API 호출

```javascript
// packages/ui-tokens/scripts/export-assets.mjs
// 실행: pnpm --filter @moajoa/ui-tokens run export-assets
// 사전 조건: pnpm --filter @moajoa/ui-tokens add -D sharp

import sharp from 'sharp';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const BRAND = resolve(__dirname, '../src/brand');

const iconSvg = await readFile(join(BRAND, 'icon.svg'));
const wordmarkSvg = await readFile(join(BRAND, 'wordmark.svg'));

// sharp 옵션: PNG 결정성 위해 metadata strip (기본 동작), 압축 레벨 고정
const PNG_OPTS = { compressionLevel: 9, palette: false, progressive: false };

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true });
}

async function writePng(svgBuf, width, height, outPath, opts = {}) {
  await ensureDir(outPath);
  const pipeline = sharp(svgBuf, { density: 384 })  // SVG의 internal DPI (1024px 출력 시 384가 안전)
    .resize(width, height, {
      fit: opts.fit ?? 'contain',
      background: opts.background ?? { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png(PNG_OPTS);
  await pipeline.toFile(outPath);
}

// 1. iOS app icon (1024×1024 PNG, 흰 배경)
await writePng(iconSvg, 1024, 1024,
  join(ROOT, 'apps/ios/assets/icon.png'),
  { background: { r: 255, g: 255, b: 255, alpha: 1 } });

// 2. iOS adaptive-icon (1024×1024 PNG, 투명 배경 — foreground only)
//    icon.svg에서 흰 rect를 제거한 별도 SVG가 필요. 또는 동일 icon에서 background를 alpha 0으로.
//    가장 간단: 같은 SVG, 다른 background 옵션
await writePng(iconSvg, 1024, 1024,
  join(ROOT, 'apps/ios/assets/adaptive-icon.png'),
  { background: { r: 0, g: 0, b: 0, alpha: 0 } });

// 3. iOS splash (1242×2688 PNG, 흰 배경, 워드마크 중앙)
//    sharp의 composite로 흰 캔버스 + 워드마크를 합성
const wordmarkResized = await sharp(wordmarkSvg, { density: 384 })
  .resize({ width: Math.round(1242 * 0.6) })  // device width의 60% (UI-SPEC)
  .png()
  .toBuffer();

const splashOut = join(ROOT, 'apps/ios/assets/splash.png');
await ensureDir(splashOut);
await sharp({
  create: { width: 1242, height: 2688, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([{ input: wordmarkResized, gravity: 'center' }])
  .png(PNG_OPTS)
  .toFile(splashOut);

// 4. Web favicon.ico (32+16 multi-resolution)
//    ⚠️ sharp는 .ico 직접 출력 불가. PNG 2개로 만들고 favicon용으로는 별도 변환 필요.
//    가장 단순한 접근: 32×32 PNG를 favicon.ico 위치로 출력 (Next.js는 favicon.ico를 PNG로 받아도 동작)
//    multi-res 필요하면 png-to-ico 패키지 도입.
await writePng(iconSvg, 32, 32,
  join(ROOT, 'apps/web/app/favicon.ico'));  // Next.js 15 metadata convention

// (선택) 별도 16×16 PNG도 생성
await writePng(iconSvg, 16, 16,
  join(ROOT, 'apps/web/public/favicon-16.png'));

// 5. apple-touch-icon (180×180 PNG, 흰 배경)
await writePng(iconSvg, 180, 180,
  join(ROOT, 'apps/web/public/apple-touch-icon.png'),
  { background: { r: 255, g: 255, b: 255, alpha: 1 } });

// 6. OG default (1200×630 PNG, 흰 배경, 워드마크 중앙)
const ogWordmark = await sharp(wordmarkSvg, { density: 384 })
  .resize({ width: 600 })  // OG 캔버스 중앙에 ~50% width
  .png()
  .toBuffer();

const ogOut = join(ROOT, 'apps/web/public/og-default.png');
await ensureDir(ogOut);
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
})
  .composite([{ input: ogWordmark, gravity: 'center' }])
  .png(PNG_OPTS)
  .toFile(ogOut);

// 7. Pretendard-Bold.ttf 복사 (Phase 4 OG에서 Satori가 소비. ttf가 OTF보다 안전 — Satori OpenType feature 제약 회피)
const PRETENDARD_SRC = join(ROOT, 'apps/ios/assets/fonts/Pretendard-Bold.ttf');
// 주의: iOS는 .otf를 쓸 예정이지만 OG용 .ttf 1개는 별도 다운로드 또는 alternative/ 경로에서 가져옴.
// 정확한 source는 Pretendard 폰트 파이프라인 §에서 다룸.
const PRETENDARD_TTF_TARGET = join(ROOT, 'apps/web/assets/Pretendard-Bold.ttf');
await ensureDir(PRETENDARD_TTF_TARGET);
await copyFile(
  join(ROOT, 'apps/ios/assets/fonts/alternative/Pretendard-Bold.ttf'),  // Pretendard npm의 alternative/
  PRETENDARD_TTF_TARGET
);

console.log('✓ All brand assets exported');
```

### sharp 결정성 (Idempotency) 검증

sharp의 PNG 출력은 **기본적으로** 결정적이다:
- `withMetadata()`를 호출하지 않는 한 EXIF/timestamp는 자동 strip됨
- libpng 압축 레벨을 고정 (`compressionLevel: 9`) → 같은 입력 + 같은 sharp 버전 = 같은 출력
- ICC profile은 default로 strip되어 sRGB로 변환

**완벽 byte-identical은 보장되지 않는다** — libpng 버전이 다르면 압축 결과가 미세하게 다를 수 있다. 대안:
1. CI가 아니라 manually invoked (UI-SPEC contract) → 같은 개발 머신에서 같은 node/sharp 버전이면 결정적
2. `strip-nondeterminism` 도구 후처리 (overkill, Phase 1에 불필요)

**V8 검증 (Validation §):** 같은 머신에서 스크립트 2회 실행 → `sha256sum apps/ios/assets/*.png apps/web/public/*.png`이 일치하는지 확인. 다르면 OS-level cause (e.g. fontconfig cache) 추적.

### `package.json` 등록 (manual invocation, not CI)

```json
{
  "name": "@moajoa/ui-tokens",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "echo \"(lint TODO)\" && exit 0",
    "export-assets": "node scripts/export-assets.mjs"
  },
  "devDependencies": {
    "sharp": "^0.34.5",
    "typescript": "^5.6.2"
  }
}
```

UI-SPEC: 출력물은 git에 commit (CI/EAS가 sharp 실행 안 함). turbo.json은 본 프로젝트에 없음 (확인됨) — pnpm script로 충분.

**Source:** [sharp Output options](https://sharp.pixelplumbing.com/api-output/) (HIGH), [sharp Input metadata](https://sharp.pixelplumbing.com/api-input/) (HIGH), [Expo splash-screen-and-app-icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) (HIGH), UI-SPEC §"Asset Export Matrix" (HIGH, internal)

### `app.config.ts` 변경 — icon · splash · 폰트 등록

현재 `apps/ios/app.config.ts`에 icon/splash는 없음 (확인됨, 주석만). 추가:

```typescript
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'MOAJOA',
  slug: 'moajoa',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',                   // 신규
  scheme: 'moajoa',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.serendipitylife.moajoa',
    supportsTablet: false,
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription: '내 주변 장소를 보여주려면 위치 권한이 필요해요.',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',                    // 신규 plugin entry
      {
        image: './assets/splash.png',
        backgroundColor: '#FFFFFF',
        resizeMode: 'contain',                 // UI-SPEC: 워드마크 60% width, 중앙
        imageWidth: 234,                       // UI-SPEC: 60% of iPhone 15 390pt = 234pt
      },
    ],
    [
      'expo-font',                             // 기존, config 추가
      {
        fonts: [
          './assets/fonts/Pretendard-Regular.otf',
          './assets/fonts/Pretendard-Medium.otf',
          './assets/fonts/Pretendard-SemiBold.otf',
          './assets/fonts/Pretendard-Bold.otf',
        ],
      },
    ],
    // D-16: expo-share-intent는 Phase 3로 이관 (현재 코멘트 유지)
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://moajoa.app',
  },
};

export default config;
```

**검증 포인트:**
- `expo-splash-screen` plugin은 별도 install 불필요 — Expo SDK 54에 포함 (`expo-splash-screen@~31.0.13` 이미 dependency에 있음, 확인됨)
- `expo-font` plugin은 4 weight 파일을 빌드 시 native bundle에 embed (config plugin > useFonts hook — PITFALLS Pitfall 11 권장)
- prebuild 후 `apps/ios/ios/MOAJOA/Images.xcassets/AppIcon.appiconset/` 자동 생성됨

**Source:** [Expo Splash Screen docs](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) (HIGH), [expo-splash-screen npm](https://www.npmjs.com/package/expo-splash-screen) (HIGH), [Expo Fonts docs](https://docs.expo.dev/develop/user-interface/fonts/) (HIGH)

---

## Pretendard Font Pipeline — BUILD-03 / D-08

### 폰트 파일 확보 — npm `pretendard@1.3.9`로 다운로드 (verified)

`npm pack pretendard@1.3.9`로 tarball 검사하여 검증됨 (2026-05-25 검증):

```
package/dist/public/static/Pretendard-Regular.otf       1,574,352 bytes
package/dist/public/static/Pretendard-Medium.otf        1,584,068 bytes
package/dist/public/static/Pretendard-SemiBold.otf      1,583,704 bytes
package/dist/public/static/Pretendard-Bold.otf          1,576,660 bytes
                                                        ─────────
                                       4 weights 합계:  ~6.3 MB

package/dist/public/static/alternative/Pretendard-Bold.ttf  2,661,752 bytes  (~2.6 MB)
package/dist/LICENSE.txt   (SIL OFL 1.1 라이선스 텍스트)
```

**⚠️ UI-SPEC §Typography 보정 필요:**
- UI-SPEC: "총 ~1.6MB 수용 가능"
- 실제: ~6.3MB (~4배 차이)
- iOS 앱 번들 크기 영향: 여전히 acceptable (앱 전체 크기 30MB 미만 예상)이지만 planner는 이 사실 인지 필요

### 확보 방법 — pnpm dev 의존성 또는 직접 다운로드

권장 (단순성 + 재현성):

```bash
# 1. ui-tokens 또는 iOS 디렉토리에 pretendard를 dev 의존성으로 설치
pnpm --filter @moajoa/ios add -D pretendard@^1.3.9

# 2. node_modules/pretendard/dist/public/static/에서 4개 OTF + LICENSE.txt 복사
#    (export-assets.mjs에 fs.copyFile로 포함시키는 게 가장 idempotent)
```

또는 GitHub release zip 직접 다운로드 (사람 손 작업, idempotency 약함). 권장은 npm 경로.

### iOS — `expo-font` config plugin 셋업

**파일 위치:** `apps/ios/assets/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.otf`

**app.config.ts (위 §Brand Asset Pipeline에 이미 포함):**

```typescript
plugins: [
  // ...
  [
    'expo-font',
    {
      fonts: [
        './assets/fonts/Pretendard-Regular.otf',
        './assets/fonts/Pretendard-Medium.otf',
        './assets/fonts/Pretendard-SemiBold.otf',
        './assets/fonts/Pretendard-Bold.otf',
      ],
    },
  ],
]
```

이 방식은 빌드 시점에 native bundle로 embed (`useFonts` runtime 로딩 X). 4 weight 모두 startup부터 사용 가능 (UI-SPEC contract).

**`app/_layout.tsx`:** 변경 불필요. `expo-font` config plugin은 자동으로 native register. (runtime `useFonts({...})` 호출이 필요 없음 — 이게 plugin 방식의 장점.)

**font name reference:**

iOS의 PostScript name은 `.otf` 파일의 내부 name. Pretendard의 PostScript name은 `Pretendard-Regular`, `Pretendard-Medium`, `Pretendard-SemiBold`, `Pretendard-Bold` (파일명과 동일). NativeWind `font-sans` 적용 시 `tailwind.ts` 토큰의 `fontFamily: { sans: ['Pretendard', ...] }`가 OS에 register된 fontFamily를 찾는다.

iOS는 weight를 family 안에서 자동 매칭하지 못하는 경우가 있다. NativeWind에서 `font-bold className`을 쓰면 iOS는 system bold variant를 찾는데, Pretendard family 안에 등록된 Bold variant가 자동 매칭되어야 정상. 만약 안 되면 fallback으로 명시적 fontFamily 사용 (`font-[Pretendard-Bold]`).

### Web — `next/font/local` 셋업

**파일 위치:** `apps/web/assets/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.otf` (또는 `apps/web/public/fonts/`)

Next.js의 `next/font/local`은 `public/` 외부 위치 권장 (build 시 hash 처리하므로). `apps/web/assets/`를 사용한다.

```typescript
// apps/web/app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const pretendard = localFont({
  src: [
    {
      path: '../assets/fonts/Pretendard-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../assets/fonts/Pretendard-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../assets/fonts/Pretendard-SemiBold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../assets/fonts/Pretendard-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-pretendard',  // CSS variable로 노출
  display: 'swap',  // FOUT 회피 (시스템 fallback 먼저, 그 다음 swap)
});

export const metadata: Metadata = {
  title: 'MOAJOA — 여행 정보를 모아두는 지도',
  description: '유튜브·블로그·인스타 링크를 던지면 영상 속 장소를 지도에 모아주는 여행 큐레이션 도구.',
  openGraph: {
    title: 'MOAJOA',
    description: '여행 정보를 모아두는 지도',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
```

### `apps/web/app/globals.css` 변경

현재 `globals.css`:
```css
@import 'tailwindcss';
@config "../tailwind.config.ts";

@theme {
  --font-sans: 'Pretendard', 'IBM Plex Sans KR', 'Noto Sans JP', system-ui, sans-serif;
}
```

이미 `--font-sans` CSS variable이 정의되어 있고 Pretendard를 fontFamily 1순위로 지정. **변경 불필요** — `next/font/local`의 `--font-pretendard` variable이 추가되면 globals.css가 그걸 참조하도록 minor edit:

```css
@theme {
  --font-sans: var(--font-pretendard), 'IBM Plex Sans KR', 'Noto Sans JP', system-ui, sans-serif;
}
```

### OG 이미지 폰트 (Phase 4 consumer, file present in Phase 1)

**UI-SPEC claim vs verified reality:**

| 항목 | UI-SPEC 주장 | 검증 결과 |
|------|-------------|----------|
| Satori는 .ttf만 지원 | "OG에 .ttf 필수, .woff2 불가" | **부분적으로 부정확** — Satori는 .ttf/.otf/.woff 모두 지원. .woff2만 불가 |
| Pretendard .ttf 존재 여부 | "별도 변환 필요할 수도" | **존재함** — npm 패키지의 `dist/public/static/alternative/Pretendard-Bold.ttf` (2.6MB) |

**권장 결정:** UI-SPEC contract을 존중하여 `Pretendard-Bold.ttf` 1개를 `apps/web/assets/Pretendard-Bold.ttf`에 별도로 두자 (이미 export-assets.mjs §에 포함됨). 이유:
- Satori가 OpenType feature (kerning, ligature)를 .otf에서 부분적으로만 지원 → 한글 가게 이름이 ligature 영향을 받을 가능성 (낮지만 0은 아님)
- .ttf는 더 단순한 포맷이라 Satori 호환성이 더 보수적으로 안전
- 파일 1개 추가 비용 (2.6MB) 무시할 수 있음
- Phase 4에서 fonts 옵션을 `data: pretendardBoldTtf`로 단순하게 작성 가능

**Phase 4 consumer 예시 (Phase 1엔 코드 작성 X, 파일만 present):**

```typescript
// apps/web/app/b/[slug]/opengraph-image.tsx (Phase 4)
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function Image({ params }) {
  const pretendardBold = await readFile(
    join(process.cwd(), 'assets/Pretendard-Bold.ttf')
  );
  return new ImageResponse(
    /* ... */,
    {
      fonts: [{ name: 'Pretendard', data: pretendardBold, weight: 700, style: 'normal' }],
    }
  );
}
```

### LICENSE 파일 위치 (SIL OFL 1.1)

`pretendard@1.3.9` tarball에 `package/dist/LICENSE.txt` 존재 (검증됨). 내용 시작:
```
Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard),
with Reserved Font Name Pretendard.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
...
```

**복사 위치 (export-assets.mjs에 포함):**
- `apps/ios/assets/fonts/LICENSE-Pretendard.txt`
- `apps/web/assets/fonts/LICENSE-Pretendard.txt` (또는 `apps/web/public/fonts/LICENSE-Pretendard.txt`)
- `packages/ui-tokens/src/brand/LICENSE-Pretendard.txt` (워드마크 outline이 Pretendard에서 파생되었으므로 source 위치에도)

### Bundle 크기 영향 (검증된 수치)

| Target | 추가되는 폰트 크기 |
|--------|------------------|
| iOS bundle | 4 weight OTF = ~6.3 MB (`expo-font` 빌드 시 embed) |
| Web (next/font/local) | next.js가 자동 subset 처리 → 실제 전송 크기는 페이지당 5~50KB 수준. unicode-range가 한국어로 제한되면 더 작음. 빌드 산출물에는 4개 OTF 원본도 포함되지만 client는 subset만 받음 |
| OG 이미지 (Phase 4 consumer) | Bold .ttf 1개 = 2.6 MB. Edge runtime이 readFile로 로드 → ImageResponse 처리. 매 요청 마다 메모리 로드 (cache는 Edge 캐시가 처리) |

**Source:** [Pretendard GitHub](https://github.com/orioncactus/pretendard) (HIGH, verified via npm pack), [next/font/local docs](https://nextjs.org/docs/app/api-reference/components/font) (HIGH), [Satori README on font formats](https://github.com/vercel/satori) (HIGH), [Vercel Custom Font Guide](https://vercel.com/kb/guide/using-custom-font) (HIGH)

---

## Web Dev-Tool Gate — WEB-01, WEB-02

### 환경 변수 contract

| Trigger | 의미 |
|---------|------|
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1` | dev tool UI 노출 (보드 생성·링크 추가 폼 보임) |
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정 또는 다른 값 | dev tool 차단 + `/login`으로 redirect |

`NEXT_PUBLIC_*` prefix는 Next.js가 **빌드 타임에 inline**한다 → 런타임 환경 변경으로 toggle 불가. dev/prod 빌드 분리.

### `apps/web/lib/env.ts` 신규 (현재 존재 X, 확인됨)

```typescript
// apps/web/lib/env.ts
/**
 * Centralized env access for the web app.
 * NEXT_PUBLIC_* vars are inlined at build time — these checks happen at compile time
 * for static optimization, not runtime.
 */
export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1';
}
```

이유:
- 단일 위치 → 향후 추가 게이트 (예: `NEXT_PUBLIC_ENABLE_DEBUG_MAP`) 한 곳에 모임
- `===` strict check → 빌드 시 `0`, `true`, `"false"` 등 모호한 값도 false 처리
- 함수로 wrap → planner가 grep `isDevToolsEnabled` 한 번에 모든 사용처 찾기

### `apps/web/app/boards/page.tsx` 1차 게이트 (Server Component)

현재 코드 첫 줄들:

```typescript
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listMyBoards } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { CreateBoardButton } from './_components/create-board-button';

export default async function BoardsPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  // ...
}
```

`redirect` from `next/navigation`은 이미 import됨 (확인됨). 추가:

```typescript
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listMyBoards } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isDevToolsEnabled } from '@/lib/env';  // 신규
import { CreateBoardButton } from './_components/create-board-button';

export default async function BoardsPage() {
  // WEB-01/WEB-02: dev-tool 게이트 — env 미설정 시 즉시 /login으로
  if (!isDevToolsEnabled()) redirect('/login');

  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const boards = await listMyBoards(supabase);
  // ... 이하 동일
}
```

**중요 검증 포인트:**
- `redirect()`는 **Server Component 또는 Server Action 에서만** 동작. Client Component (`'use client'`)에서 호출 시 throw됨. `BoardsPage`는 `async function`이고 `'use client'` 없음 → Server Component → 안전.
- env 게이트가 user 인증 게이트보다 **먼저** 와야 한다. 그래야 user가 logged-in이어도 dev tool 차단 시 로그인 페이지로 보내짐 (logged-out 페이지로 보내는 게 의도와 일치 — UI-SPEC).
- Status code: Next.js `redirect()`는 기본 307 (Temporary Redirect). V6에서 이걸 확인.

### `apps/web/app/boards/[id]/page.tsx` 동일 게이트

```typescript
import { notFound, redirect } from 'next/navigation';
import { getBoard, listLinksByBoard, listPlacesByBoard } from '@moajoa/api';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isDevToolsEnabled } from '@/lib/env';  // 신규
import { AddLinkForm } from './_components/add-link-form';
import { LinkList } from './_components/link-list';
import { PlaceMap } from './_components/place-map';

export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isDevToolsEnabled()) redirect('/login');  // 신규

  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  // ... 이하 동일
}
```

### `CreateBoardButton` 2차 게이트 (Client Component)

```typescript
// apps/web/app/boards/_components/create-board-button.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBoard } from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { isDevToolsEnabled } from '@/lib/env';  // 신규

export function CreateBoardButton() {
  // D-09 defense in depth: page 게이트가 어떤 이유로 통과돼도 컴포넌트가 차단
  if (!isDevToolsEnabled()) return null;

  const router = useRouter();
  // ... 기존 코드
}
```

⚠️ **React Hooks 순서 주의:** `if (!isDevToolsEnabled()) return null;`는 **모든 useState/useRouter 호출 전에** 와야 한다. NEXT_PUBLIC_* 값은 빌드 시 상수로 inline되므로, false인 빌드에서는 `return null`만 남고 hook들은 dead-code-elimination됨. 빌드 출력 크기 감소 (트리쉐이킹 효과).

### `AddLinkForm` 동일 패턴

```typescript
// apps/web/app/boards/[id]/_components/add-link-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addLink, triggerExtraction } from '@moajoa/api';
import { detectSourceKind } from '@moajoa/core';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { isDevToolsEnabled } from '@/lib/env';  // 신규

export function AddLinkForm({ boardId }: { boardId: string }) {
  if (!isDevToolsEnabled()) return null;  // D-09 defense in depth

  const router = useRouter();
  // ... 기존 코드
}
```

### `apps/web/middleware.ts` 변경 X (D-09)

D-09: middleware는 건드리지 않음. 현재 middleware는 Supabase 세션 refresh 책임만. dev-tool 게이트를 middleware에 추가하면 모든 요청에 대해 evaluation이 일어나고 정적 자산까지 영향받아 over-engineering. Page 게이트가 더 정확. **현재 middleware 그대로 유지.**

### Build-time stripping 확인

`NEXT_PUBLIC_ENABLE_DEV_TOOLS`가 빌드 시 `"1"`이 아니면:
- `if (!isDevToolsEnabled())` → `if (!false)` → `if (true)` (또는 dead branch elimination으로 page 자체가 redirect만 남음)
- Client Component의 form JSX는 빌드 산출물에 안 들어감 → 클라이언트 번들에서 보드 생성 form 코드가 누락되어 외부인이 devtools로 form HTML 못 찾음

**검증 (V7):** prod 빌드 (`NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정) 후 `apps/web/.next/static/chunks/` 안에 "createBoard"·"새 보드" 문자열이 grep으로 안 나와야 함.

**Source:** [Next.js redirect function](https://nextjs.org/docs/app/api-reference/functions/redirect) (HIGH), [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables) (HIGH), UI-SPEC §"Web Dev-Tool Gate" (HIGH, internal)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None** — 현재 프로젝트에 jest/vitest 등 설치 X (확인됨: `apps/web/package.json`, `apps/ios/package.json` scripts 안에 test runner 없음) |
| Config file | none — Wave 0에 결정 필요 (또는 manual verification로 Phase 1 통과) |
| Quick run command | `pnpm --filter @moajoa/web typecheck && pnpm --filter @moajoa/ios typecheck` |
| Full suite command | `pnpm --filter @moajoa/web typecheck && pnpm --filter @moajoa/ios typecheck && pnpm --filter @moajoa/web build` |
| Phase 1 결정 | **자동 unit test 도입 X** — Phase 1의 5개 success criteria는 모두 "manual verification of real-device behavior". 자동 test로 검증 가능한 건 typecheck/build 통과뿐. PROJECT.md Out of Scope에 CI 명시. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-01 | iOS 앱이 실기기에서 빌드·실행 | manual-only | `npx expo run:ios --device` 후 실기기 launch 확인 | n/a |
| BUILD-02 | NativeWind className 시각 적용 | manual-only (smoke screen) | 실기기에서 §"Silent failure 차단 smoke test" JSX의 색·레이아웃 확인 | n/a |
| BUILD-03 | App icon · splash · 워드마크 표시 | manual-only | 실기기 홈/스플래시 + Pretendard 텍스트 시각 확인 | n/a |
| WEB-01 | dev tool 폼 env 게이트 작동 | smoke (curl) | `NEXT_PUBLIC_ENABLE_DEV_TOOLS= pnpm --filter @moajoa/web build && pnpm --filter @moajoa/web start` 후 `curl -I http://localhost:3000/boards` → 307 + `Location: /login` | n/a |
| WEB-02 | env 미설정 web 진입 = `/login` 또는 `/b/[slug]`만 | manual + smoke | `/boards`, `/boards/anyId` 둘 다 redirect 확인 | n/a |

### Sampling Rate

- **Per task commit:** `pnpm --filter @moajoa/web typecheck && pnpm --filter @moajoa/ios typecheck`
- **Per wave merge:** `pnpm --filter @moajoa/web build` (web 변경 wave에서) + iOS 변경 wave에서는 `npx expo prebuild --platform ios --no-install` (dry validation)
- **Phase gate:** §"V1..V8 falsifiable validation slices" 전체 통과 (대부분 manual)

### V1..V8 Falsifiable Validation Slices

| ID | Slice | Command / Manual Step | Pass Signal |
|----|-------|-----------------------|-------------|
| **V1** | 전체 typecheck 통과 | `pnpm --filter @moajoa/web typecheck && pnpm --filter @moajoa/ios typecheck && pnpm --filter @moajoa/ui-tokens typecheck && pnpm --filter @moajoa/api typecheck && pnpm --filter @moajoa/core typecheck` | exit 0 |
| **V2** | Web prod build 통과 | `NEXT_PUBLIC_ENABLE_DEV_TOOLS= pnpm --filter @moajoa/web build` | exit 0, no errors |
| **V3** | iOS 빌드 성공 (path A 또는 B) | `npx expo prebuild --platform ios --clean` (A) **OR** `eas build --profile development --platform ios` (B) | A: pod install 완료 / B: EAS dashboard에 "finished" + .ipa 산출 |
| **V4** | 실기기 install + NativeWind smoke screen 시각 확인 | (manual) 실기기에서 앱 launch → smoke screen JSX (오렌지 배경 + 흰 카드)가 보임 | 스크린샷 1장 (docs/SESSION-NOTES-YYYY-MM-DD.md에 첨부) |
| **V5** | SVG export 스크립트 산출물 존재 | `pnpm --filter @moajoa/ui-tokens run export-assets && ls -la apps/ios/assets/{icon,adaptive-icon,splash}.png apps/web/app/favicon.ico apps/web/public/{apple-touch-icon,og-default}.png apps/web/assets/Pretendard-Bold.ttf` | 모든 파일 size > 0 bytes |
| **V6** | env 미설정 시 `/boards` → `/login` redirect | `NEXT_PUBLIC_ENABLE_DEV_TOOLS= pnpm --filter @moajoa/web build && pnpm --filter @moajoa/web start &` 후 `curl -sI http://localhost:3000/boards` | `HTTP/1.1 307 Temporary Redirect` + `Location: /login` |
| **V7** | env 설정 시 `/boards` → 200 + 폼 보임 | `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1 pnpm --filter @moajoa/web build && pnpm --filter @moajoa/web start &` 후 (manual) 브라우저 `/boards` 진입 → 로그인 후 "새 보드" 버튼 보임 | manual screenshot |
| **V8** | export 스크립트 idempotency | `pnpm run export-assets && shasum -a 256 apps/ios/assets/*.png > /tmp/run1.sha && pnpm run export-assets && shasum -a 256 apps/ios/assets/*.png > /tmp/run2.sha && diff /tmp/run1.sha /tmp/run2.sha` | 같은 머신·같은 sharp 버전에서 exit 0 (no diff). 다른 머신에서는 byte-identical 보장 안 됨 → pixel-identical (visual diff)이 폴백 |

### Wave 0 Gaps

- [ ] Test framework decision: Phase 1엔 자동 test 추가 X로 결정 권장 (manual verification로 충분). 만약 도입 필요하면 vitest @ web, jest @ ios.
- [ ] `apps/ios/.npmrc` 신규 — 현재 존재 X (확인됨), Wave 1 첫 task에 생성
- [ ] `apps/web/lib/env.ts` 신규 — 현재 존재 X (확인됨), Wave 4 첫 task에 생성
- [ ] `packages/ui-tokens/src/brand/` 디렉토리 신규
- [ ] `packages/ui-tokens/scripts/export-assets.mjs` 신규
- [ ] `apps/ios/assets/fonts/` 디렉토리 신규 (현재 apps/ios/assets/ 자체가 부재 — 확인됨)
- [ ] `apps/web/assets/` 디렉토리 신규 (현재 apps/web/assets/ 부재 — 확인됨)

*(자동 test fixture는 도입 안 함 — Phase 1 success criteria 5개가 모두 manual verification 기반.)*

---

## Pitfalls (Phase 1 specific)

### Pitfall A: Reanimated v4 + NativeWind silent failure (`.planning/research/PITFALLS.md` #6, #11)

**증상:** 빌드는 통과하지만 실기기에서 className이 시각적으로 적용되지 않음. 화면이 default RN 스타일로 렌더링됨.
**원인:** NativeWind 4.1.23의 peer dependency가 Reanimated 3.x로 fixed → SDK 54의 Reanimated 4.x와 worklets API 시그니처 불일치 → CSS interop가 silently disabled.
**막기:**
- `nativewind@^4.2.4` (verified latest in 4.x line)로 upgrade
- `react-native-worklets@^0.8.3` peer 명시 install
- `babel.config.js`에 `react-native-worklets/plugin` **추가 금지** (중복 시 빌드 에러)
- §"Silent failure 차단 smoke test" JSX 항상 실행

### Pitfall B: pnpm hoist scope 오적용 (D-02 위반)

**증상:** 루트나 `apps/web/`에 hoist 적용 시 web의 React 19 / iOS의 React 18 충돌 (히스토리상 한 번 발생, 현재는 둘 다 React 19로 통일됨이지만 다른 패키지 충돌 가능).
**원인:** `.npmrc`의 적용 범위는 그 파일이 있는 디렉토리 + 하위. 루트 `.npmrc`에 `node-linker=hoisted` 추가하면 전 워크스페이스에 적용.
**막기:**
- `apps/ios/.npmrc` 한 위치에만 추가
- 루트 `.npmrc` 변경 금지 (현재 isolated 유지 — 확인됨)
- PR review 시 `.npmrc` 변경 사항 grep로 강제 확인

### Pitfall C: sharp PNG byte-equivalence 환상

**증상:** 같은 SVG 입력에 대해 export 스크립트를 두 머신에서 돌렸을 때 PNG bytes가 다름 → V8 검증 실패.
**원인:** libpng 버전 차이, OS fontconfig (SVG 안에 text가 있을 경우), node 버전 차이.
**막기:**
- SVG에 text 요소를 두지 말 것 — wordmark는 *outlined paths* (font 제거)
- 같은 머신에서의 idempotency만 보장 목표
- V8 검증을 "byte-identical"에서 "visually-identical (pixel diff < threshold)"로 완화

### Pitfall D: `redirect()` from Client Component

**증상:** `redirect('/login')`가 throw 에러 발생 — React render 깨짐.
**원인:** `redirect`는 Server Component / Server Action에서만 동작. Client Component (`'use client'`)에서는 `useRouter().push()` 사용해야 함.
**막기:**
- `redirect()` 호출은 `apps/web/app/boards/page.tsx`와 `apps/web/app/boards/[id]/page.tsx` (둘 다 `async function`, no `'use client'` → Server Component) 안에서만
- Client Component 2차 게이트 (`CreateBoardButton`, `AddLinkForm`)는 `return null`만, redirect 호출 X

### Pitfall E: Pretendard `.ttf`/`.otf` 혼동

**증상:** UI-SPEC이 ".ttf 필수"라고 명시 → planner가 iOS도 .ttf로 잘못 설정 가능.
**원인:** UI-SPEC의 부분적 부정확함 (실제로는 .otf가 iOS/Web에서 default, .ttf는 Satori OG용 권장).
**막기:**
- iOS bundle: `.otf` 4 weight (~6.3MB)
- Web bundle: `.otf` 4 weight (next/font/local이 subset 처리)
- OG (Phase 4): `.ttf` Bold 1개만 (`apps/web/assets/Pretendard-Bold.ttf`)
- 본 RESEARCH §"Pretendard Font Pipeline"이 단일 진실

### Pitfall F: `expo-share-intent` 우발적 추가 (D-16 위반)

**증상:** Phase 1 PR에 누군가 "곧 필요할 것"이라며 expo-share-intent 추가 → Apple Developer App Group 셋업이 강제됨 → Phase 1 timeline 늘어짐.
**원인:** Phase 3 작업의 spec creep.
**막기:**
- `apps/ios/app.config.ts` plugins 배열의 현재 주석 ("Phase 1.5에 재추가" — 정확히는 "Phase 3에서 도입")을 유지
- `apps/ios/package.json` dependencies에 `expo-share-intent`·`patch-package` 추가 금지
- D-16 검증: Phase 1 종료 시 위 패키지가 dependency tree에 없는지 grep

### Pitfall G: lockfile drift (D Discretion)

**증상:** iOS 빌드 통과 후 lockfile commit 안 됨 → 다른 머신에서 다시 setup 시 부분 hoist · 다른 sub-version → 빌드 실패 재발.
**원인:** pnpm install 후 lockfile commit 누락.
**막기:**
- 빌드 통과 시점에 즉시 `git add pnpm-lock.yaml && git commit`
- 향후 install은 `pnpm install --frozen-lockfile` (수동 컨벤션, CI 없음)
- 본 lockfile freeze는 Wave 2 (iOS prebuild 성공) 직후 별도 commit

---

## External References

### iOS / Expo

- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) — isolated install 지원, Reanimated 4
- [Expo Monorepos Guide](https://docs.expo.dev/guides/monorepos/) — pnpm `node-linker` 옵션
- [Expo Splash Screen + App Icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) — config plugin 옵션
- [expo-splash-screen npm](https://www.npmjs.com/package/expo-splash-screen) — SDK 54 = ~31.0.13
- [Expo Fonts docs](https://docs.expo.dev/develop/user-interface/fonts/) — config plugin vs runtime
- [Configure EAS Build with eas.json](https://docs.expo.dev/build/eas-json/) — development profile shape
- [Create a development build on EAS](https://docs.expo.dev/develop/development-builds/create-a-build/) — `developmentClient: true` + ad-hoc
- [EAS CLI reference](https://docs.expo.dev/eas/cli/) — `eas device:create`, `eas build --profile`
- [Callstack: RN Monorepo with pnpm](https://www.callstack.com/blog/react-native-monorepo-with-pnpm-workspaces) — apps/ios 한정 hoist

### NativeWind + Reanimated

- [NativeWind GitHub Releases](https://github.com/nativewind/nativewind/releases) — 4.2.x patch 노트
- [NativeWind v4 Announcement](https://www.nativewind.dev/blog/announcement-nativewind-v4) — v4 background
- [Reanimated 4 Stable Release](https://blog.swmansion.com/reanimated-4-stable-release-the-future-of-react-native-animations-ba68210c3713) — worklets 분리
- [Reanimated 3→4 Migration](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/) — babel plugin 변경
- [NativeWind Issue #1574](https://github.com/nativewind/nativewind/issues/1574) — 4.2.0 + Expo 53 호환 이슈

### Pretendard

- [Pretendard GitHub](https://github.com/orioncactus/pretendard) — 원본 저장소
- [Pretendard Release v1.3.9](https://github.com/orioncactus/pretendard/releases/tag/v1.3.9) — 최신 stable
- [npm pretendard@1.3.9](https://www.npmjs.com/package/pretendard) — npm 패키지 (verified via npm pack)
- [SIL Open Font License 1.1](https://openfontlicense.org/) — 라이선스 텍스트

### Sharp + Asset Pipeline

- [sharp Output options](https://sharp.pixelplumbing.com/api-output/) — `.png()`, `withMetadata()` 옵션
- [sharp Input metadata](https://sharp.pixelplumbing.com/api-input/) — `density` 옵션 (SVG DPI)

### Next.js / Web

- [Next.js redirect function](https://nextjs.org/docs/app/api-reference/functions/redirect) — Server Component 제약
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables) — NEXT_PUBLIC_* inline
- [next/font/local docs](https://nextjs.org/docs/app/api-reference/components/font) — 로컬 폰트 + CSS variable
- [Next.js opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) — Phase 4 consumer

### Satori (Phase 4 consumer)

- [Vercel Custom Font Guide](https://vercel.com/kb/guide/using-custom-font) — .ttf/.otf/.woff 모두 지원
- [Satori README](https://github.com/vercel/satori) — 폰트 포맷 지원 매트릭스
- [Satori Discussion #157 (woff2 unsupported)](https://github.com/vercel/satori/discussions/157)

### Internal (이미 검증된 1차 자료)

- `.planning/research/SUMMARY.md` §"Phase A: Unblock"
- `.planning/research/STACK.md` §4 (NativeWind), §6 (Pretendard 라이선스)
- `.planning/research/PITFALLS.md` #6 (iOS 빌드 블랙홀), #11 (Pretendard 로딩)
- `.planning/research/ARCHITECTURE.md` §1 (pnpm hoisting), §6 (자산 파이프라인)
- `apps/ios/app.config.ts` (현재 plugins 배열 상태)
- `apps/ios/package.json` (현재 nativewind@4.1.23, tailwindcss@3.4.13)
- `apps/web/app/boards/page.tsx`, `apps/web/app/boards/[id]/page.tsx` (게이트 삽입 위치)
- `apps/web/app/boards/_components/create-board-button.tsx`, `apps/web/app/boards/[id]/_components/add-link-form.tsx` (이중 게이트 위치)
- `apps/web/middleware.ts` (D-09: 변경 X, 참고만)

---

## Project Constraints (from CLAUDE.md)

| 제약 | Phase 1 영향 |
|------|------------|
| Workspace import는 `.js` extension 금지 (Turbopack 호환) | `import { isDevToolsEnabled } from '@/lib/env'` — `.js` 안 붙임 |
| `_archive_asis/` 수정 금지, Flutter 참조 X | 본 phase는 _archive_asis 안 건드림 |
| Firebase / Firestore 도입 금지 | 본 phase는 Supabase·Next.js만 |
| 새로운 "보드 생성" UI 추가 금지 (web) | 본 phase는 *기존* 폼을 *숨김*만, 새로 만들지 X |
| 기존 마이그레이션 SQL 수정 금지 | 본 phase는 DB 마이그레이션 X |
| RLS 정책 직접 EXISTS 금지 | 본 phase는 DB 안 건드림 |
| Service role key 클라이언트 노출 금지 | 본 phase는 service role 안 건드림 |
| `.env.local` 커밋 금지 | `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 값 자체는 `.env.local.example`에 placeholder로만 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pretendard `.otf`의 PostScript name이 iOS에서 NativeWind `font-bold` 등과 자동 매칭됨 | Pretendard Font Pipeline (iOS) | iOS에서 weight matching 실패 시 `font-[Pretendard-Bold]` 같은 explicit syntax 필요. UI-SPEC 첫 Wave 검증에서 발견 가능 |
| A2 | `expo-splash-screen` plugin의 `imageWidth` 옵션이 SDK 54에서 정상 동작 | Brand Asset Pipeline (app.config.ts) | 일부 SDK에서 `imageWidth` 옵션 무시 보고 있음 (Expo Issue #33138 — 본 문서 verified search 결과). 실기기에서 splash 워드마크 크기 다를 가능성 — Phase 1 실기기 verify 필수 |
| A3 | `NEXT_PUBLIC_ENABLE_DEV_TOOLS`가 빌드 시 strip된 dead code는 클라이언트 번들 grep으로 안 보임 | Web Dev-Tool Gate | tree-shaking이 완전히 안 되면 보일 수도. V7 검증 단계에서 `grep -r "createBoard" apps/web/.next/static/chunks/` 추가 권장 |
| A4 | sharp 0.34.5의 SVG → PNG density 384 옵션이 1024² 출력에 충분 | Brand Asset Pipeline (export-assets.mjs) | density가 낮으면 aliasing. 디자이너 visual review 필요. 만약 부족하면 density 512로 상향 |
| A5 | EAS Build의 `m-medium` resourceClass가 SDK 54 iOS 빌드에 충분 | iOS Build Path B | `m-medium` 메모리/CPU 부족 시 `m-large` 필요 (가격 차이). 첫 EAS 빌드 통과 후 시간 관측 |

이 5개 모두 Wave 2/3 실기기 검증 시 빠르게 falsifiable. Plan task에 각 assumption 검증 단계 포함 권장.

---

## Open Questions

(CONTEXT.md가 잠겼고 UI-SPEC도 approved 상태라 0개를 목표로 했음. 실제 발견:)

1. **`apps/ios/ios/` 디렉토리 git tracking 정책** — 현재 디렉토리 자체가 존재 X (`apps/ios/.gitignore` 확인 필요 — 위 디렉토리 ls에서는 부재). Expo prebuild 결과를 commit할지 ignore할지 결정 필요.
   - 권장: `.gitignore`에 `ios/` 유지 (prebuild는 매 머신에서 재실행) — Expo의 "managed workflow" 패턴
   - 영향: Phase 3 Share Extension 도입 시 native code patch가 필요해지면 `ios/` commit 필요해질 수 있음 → 그때 정책 전환
2. **EAS projectId** — `eas init` 실행 전엔 알 수 없음. EAS path가 발동되면 Wave 2 첫 task에서 생성 후 `app.config.ts`의 `extra.eas.projectId`에 등록.

본 2개 모두 plan-phase 또는 execute-phase 진행 중에 자연스럽게 해소됨 — 별도 user 결정 불필요.

---

## Sources

### Primary (HIGH confidence)

- npm registry `pretendard@1.3.9` tarball 직접 inspection (2026-05-25 verified — `npm pack` + `tar -tzf`)
- npm registry `nativewind@latest` = `4.2.4` (2026-05-25 verified — `npm view nativewind dist-tags`)
- npm registry `sharp@latest` = `0.34.5` (verified)
- npm registry `expo-splash-screen@latest` = `56.0.10` (SDK 54 호환 라인은 `~31.0.13`, 이미 dependency에 있음)
- npm registry `expo-font@latest` = `56.0.5` (SDK 54 호환은 `~14.0.11`, 이미 dependency에 있음)
- npm registry `react-native-worklets@latest` = `0.8.3` (verified)
- npm registry `expo-dev-client@latest` = `56.0.15` (verified)
- Expo official docs (splash-screen, monorepos, eas-json) — fetched 2026-05-25
- NativeWind GitHub releases — fetched 2026-05-25
- Vercel/Satori font format docs — fetched 2026-05-25
- `.planning/research/{SUMMARY,STACK,PITFALLS,ARCHITECTURE}.md` — internal 1차 자료, HIGH confidence
- `apps/ios/{app.config.ts,package.json,babel.config.js,metro.config.js,global.css,tailwind.config.js}` — 직접 read
- `apps/web/{app/layout.tsx,app/boards/page.tsx,app/boards/[id]/page.tsx,app/boards/_components/create-board-button.tsx,app/boards/[id]/_components/add-link-form.tsx,middleware.ts,app/globals.css,tailwind.config.ts,postcss.config.mjs,package.json}` — 직접 read
- `packages/ui-tokens/{src/index.ts,src/tailwind.ts,package.json}` — 직접 read

### Secondary (MEDIUM confidence)

- [NativeWind Styling Not Working with Expo SDK 54 (Medium)](https://medium.com/@matthitachi/nativewind-styling-not-working-with-expo-sdk-54-54488c07c20d) — 실 사용자 트러블슈팅
- [Taming the Beast: A Foolproof NativeWind + RN Setup (DEV)](https://dev.to/aramoh3ni/taming-the-beast-a-foolproof-nativewind-react-native-setup-v52-2025-4dd8)
- [Building OG images with Satori (DEV)](https://dev.to/mitsuashi/how-i-built-19-per-topic-og-images-with-japanese-fonts-at-build-time-nextjs-satori-1ako) — Japanese font 패턴 (한국어와 유사)

### Tertiary (LOW confidence — verified before use)

- 없음 — 본 RESEARCH의 모든 claim은 HIGH 또는 MEDIUM source로 cross-verify

---

## Metadata

**Confidence breakdown:**
- Standard stack (versions, packages): **HIGH** — npm registry 직접 검증
- Architecture (file locations, API signatures): **HIGH** — 현재 코드 직접 read
- Pitfalls: **HIGH** — internal PITFALLS.md + 공식 docs cross-reference
- Pretendard `.ttf`/`.otf` 클레임: **HIGH** — 패키지 tarball 직접 inspection
- Validation slices: **MEDIUM-HIGH** — manual verification 의존 (자동 test 부재)

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (30 days — Expo SDK 54 / NativeWind 4.2 / Pretendard 1.3.9 모두 stable 라인)

**Trigger to re-research:**
- Expo SDK 55 release
- NativeWind 5.0 stable release (현재 preview)
- Pretendard 2.x release
- Reanimated 5.x release

---

*Phase: 01-build-unblock-hygiene*
*RESEARCH compiled: 2026-05-25 by gsd-researcher*
*Next: `/gsd-plan-phase 1`로 plan 생성*
