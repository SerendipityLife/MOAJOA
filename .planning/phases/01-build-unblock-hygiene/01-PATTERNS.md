# Phase 1: Build Unblock & Hygiene — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 21 (8 신규 · 11 modify · 2 generated)
**Analogs found:** 17 / 21 (4개는 in-project analog 없음 — RESEARCH §해당 항목 + UI-SPEC를 1차 ref로 사용)

---

## File Classification

### Cluster 1 — iOS Build Infrastructure

| 파일 | New/Mod | Role | Data Flow | 가장 가까운 Analog | Match |
|------|---------|------|-----------|--------------------|-------|
| `apps/ios/.npmrc` | NEW | config (pnpm) | build-time | `/.npmrc` (루트) | role-match |
| `apps/ios/package.json` | MOD | config (deps) | build-time | 본인 (in-place edit) | self |
| `apps/ios/app.config.ts` | MOD | config (Expo) | build-time | 본인 (in-place edit) | self |
| `apps/ios/app/_layout.tsx` | MOD | source (root layout) | startup | 본인 (in-place edit) | self |
| `apps/ios/app/index.tsx` | MOD | source (smoke screen) | render | 본인 (현재 redirect-only) | self |
| `eas.json` (apps/ios/ 안) | NEW | config (EAS Build) | build-time (conditional) | 없음 (in-project) | none — RESEARCH §"EAS Fallback" 사용 |

### Cluster 2 — Brand Asset Pipeline (ui-tokens)

| 파일 | New/Mod | Role | Data Flow | 가장 가까운 Analog | Match |
|------|---------|------|-----------|--------------------|-------|
| `packages/ui-tokens/src/brand/wordmark.svg` | NEW | asset (source) | design-time | 없음 | none — UI-SPEC §"Wordmark Composition" |
| `packages/ui-tokens/src/brand/icon.svg` | NEW | asset (source) | design-time | 없음 | none — UI-SPEC §"Icon Mark" |
| `packages/ui-tokens/scripts/export-assets.mjs` | NEW | script (transform) | file-I/O batch | 없음 | none — RESEARCH §"export-assets.mjs" |
| `packages/ui-tokens/package.json` | MOD | config (deps + scripts) | build-time | 본인 (in-place edit) | self |
| `packages/ui-tokens/src/tailwind.ts` | EXISTS | config (shared preset) | build-time | 이미 존재, 변경 X | n/a (UI-SPEC가 잘못 "신규"로 표시 — RESEARCH 확인됨) |

### Cluster 3 — iOS / Web 폰트 + 자산 출력물

| 파일 | New/Mod | Role | Data Flow | 가장 가까운 Analog | Match |
|------|---------|------|-----------|--------------------|-------|
| `apps/ios/assets/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.otf` | NEW | asset (font, vendored) | bundle | 없음 | none — npm `pretendard@1.3.9` tarball |
| `apps/ios/assets/fonts/LICENSE-Pretendard.txt` | NEW | asset (license) | static | 없음 | none — SIL OFL 1.1 |
| `apps/ios/assets/{icon,adaptive-icon,splash}.png` | NEW (generated) | asset (image, committed) | derived | 없음 | none — export-assets 산출물 |
| `apps/web/public/fonts/Pretendard-{...}.otf` | NEW | asset (font, vendored) | bundle | 없음 | none |
| `apps/web/public/fonts/LICENSE-Pretendard.txt` | NEW | asset (license) | static | 위 iOS와 동일 사본 | exact |
| `apps/web/public/{apple-touch-icon,og-default}.png` | NEW (generated) | asset (image) | derived | 없음 | none |
| `apps/web/app/favicon.ico` | NEW (generated) | asset (image, Next.js convention) | derived | 없음 | none |
| `apps/web/assets/Pretendard-Bold.ttf` | NEW | asset (font, Phase 4 consumer) | bundle | 없음 | none — npm pretendard `alternative/` |

### Cluster 4 — Web Hygiene (dev-tool gate)

| 파일 | New/Mod | Role | Data Flow | 가장 가까운 Analog | Match |
|------|---------|------|-----------|--------------------|-------|
| `apps/web/lib/env.ts` | NEW | utility (env helper) | static | `apps/web/lib/cn.ts` | role-match (작은 helper) |
| `apps/web/app/layout.tsx` | MOD | source (root layout) | render | 본인 + iOS `_layout.tsx` pattern | self |
| `apps/web/app/boards/page.tsx` | MOD | source (Server Component) | request-response | 본인 (이미 redirect 패턴 있음) | self (exact) |
| `apps/web/app/boards/[id]/page.tsx` | MOD | source (Server Component) | request-response | 본인 (이미 redirect 패턴 있음) | self (exact) |
| `apps/web/app/boards/_components/create-board-button.tsx` | MOD | source (Client Component) | event-driven | 본인 (in-place edit) | self |
| `apps/web/app/boards/[id]/_components/add-link-form.tsx` | MOD | source (Client Component) | event-driven | 본인 (in-place edit) | self |

### 명시적 NOT-touch (D-09 / D-16 lock)

| 파일 | 이유 |
|------|------|
| `apps/web/middleware.ts` | D-09: middleware는 Supabase 세션 refresh 책임만. dev-tool 게이트는 page 레벨에서. **변경 절대 X** |
| `apps/ios/app.config.ts` plugins 배열의 share-intent 코멘트 | D-16: "Phase 1.5에 재추가" 코멘트 유지. `expo-share-intent` 패키지·plugin entry 모두 추가 금지 |
| 기존 supabase migrations `supabase/migrations/*` | Phase 1은 DB 미터치 |
| `/.npmrc` (루트) | D-02: hoist 범위는 `apps/ios/` 한정. 루트 `.npmrc`는 isolated 유지 |

---

## Pattern Assignments

### 1.1 `apps/ios/.npmrc` (config, build-time)

**Analog:** `/.npmrc` (project root) — 같은 파일 종류, 다른 의도 (루트는 hoist-안-함 설명, ios는 hoist-함)

**기존 루트 `.npmrc` (lines 1-9):**
```ini
# Disable public-hoisting of types/eslint to avoid version clashes between
# workspaces. apps/ios uses @types/react@18 (React Native 0.74), apps/web uses
# @types/react@19. Without this, the workspace root sees the first version
# resolved and TypeScript in apps/web gets confused.
public-hoist-pattern[]=
shamefully-hoist=false
auto-install-peers=true
strict-peer-dependencies=false
```

**Apply pattern (신규):** 동일 코멘트 스타일 — "왜 hoist가 필요한지" 한 문장 + 단일 설정 라인. 새 파일 본문 (RESEARCH §"iOS Build Path A"):
```ini
# RN native modules expect flat node_modules paths (podspec resolution).
# Scoped to apps/ios only; root workspace stays isolated (see /.npmrc).
node-linker=hoisted
```

---

### 1.2 `apps/ios/package.json` (config, build-time MOD)

**Analog:** 본인 — in-place 버전 bump.

**현재 형태 (lines 33-48):**
```json
    "nativewind": "^4.1.23",
    ...
    "react-native-reanimated": "~4.1.7",
    ...
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/react": "~19.1.17",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2"
  }
```

**Apply pattern (in-place edits, RESEARCH §"NativeWind 4.2 Upgrade" + §"react-native-worklets peer 설치"):**
- `dependencies.nativewind`: `^4.1.23` → `^4.2.4`
- `dependencies` 추가: `"react-native-worklets": "^0.8.3"` (RESEARCH §"위치 결정": dependencies, devDependencies 아님 — autolinking이 dependencies 우선 탐색)
- `devDependencies.tailwindcss`: `^3.4.13` → `^3.4.17`
- `devDependencies` 추가: `"pretendard": "^1.3.9"` (export-assets.mjs가 폰트 파일 source로 사용 — RESEARCH §"폰트 파일 확보")
- EAS fallback 경로 진입 시 `dependencies` 추가: `"expo-dev-client": "^56.0.15"` (RESEARCH §"사전 준비 명령")

**위치 무변경 (이미 정확):** `expo-splash-screen: ~31.0.13`, `expo-font: ~14.0.11` — SDK 54 호환 라인, 그대로 둠.

---

### 1.3 `apps/ios/app.config.ts` (config, build-time MOD)

**Analog:** 본인 (현재 상태) — UI-SPEC §"iOS App Icon" + §"Splash Composition" 적용.

**현재 plugins 배열 (lines 22-28):**
```typescript
  plugins: [
    'expo-router',
    'expo-font',
    // expo-share-intent will be re-added in Phase 1.5 with a SDK 54+ compatible
    // version. We're not invoking its JS APIs yet, and it requires a native
    // build (not Expo Go) anyway.
  ],
```

**현재 root 필드 (lines 3-10):**
```typescript
  name: 'MOAJOA',
  slug: 'moajoa',
  version: '0.1.0',
  orientation: 'portrait',
  // icon/splash assets to be added in design pass. Expo uses defaults until then.
  scheme: 'moajoa',
  userInterfaceStyle: 'light',
```

**Apply pattern (RESEARCH §"`app.config.ts` 변경"):**
1. line 8 코멘트 삭제 후 그 자리에 `icon: './assets/icon.png',` 추가
2. plugins 배열에서 string `'expo-font'`를 **tuple form**으로 확장 (fonts 배열 명시):
   ```typescript
   ['expo-font', { fonts: [
     './assets/fonts/Pretendard-Regular.otf',
     './assets/fonts/Pretendard-Medium.otf',
     './assets/fonts/Pretendard-SemiBold.otf',
     './assets/fonts/Pretendard-Bold.otf',
   ] }],
   ```
3. plugins 배열에 신규 entry 추가 (line 23 'expo-router' 직후 또는 expo-font 직전):
   ```typescript
   ['expo-splash-screen', {
     image: './assets/splash.png',
     backgroundColor: '#FFFFFF',          // UI-SPEC: splash bg = white (D-07 refinement)
     resizeMode: 'contain',
     imageWidth: 234,                     // UI-SPEC: 60% of 390pt iPhone 15 width
   }],
   ```
4. share-intent 코멘트 (lines 25-27) **그대로 유지** (D-16)
5. EAS path 진입 시 `extra` 객체에 `eas: { projectId: '<발급된 id>' }` 추가 (RESEARCH Open Question #2)

---

### 1.4 `apps/ios/app/_layout.tsx` (source, startup MOD)

**Analog:** 본인 — `useEffect` + state-gated render 패턴 이미 존재.

**현재 핵심 패턴 (lines 10-25):**
```typescript
export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
```

**Apply pattern (RESEARCH §"iOS — `expo-font` config plugin 셋업"):**

RESEARCH는 "`app/_layout.tsx`: 변경 불필요. `expo-font` config plugin은 자동으로 native register" 명시. **즉, useFonts hook 추가 불필요.**

단, planner는 다음 결정 갈림길에 부딪힐 수 있음:
- **Option A (RESEARCH 권장):** config plugin만 사용 → `_layout.tsx` 변경 X
- **Option B (Pretendard weight matching 안 될 시 fallback):** runtime `useFonts({ ... })` + `SplashScreen.preventAutoHideAsync()` 추가

Option B로 가야 할 때의 패턴 (assumption A1이 falsified될 경우):
```typescript
// 추가 import
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

// 컴포넌트 body 상단
const [fontsLoaded] = useFonts({
  'Pretendard-Regular':  require('../assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-Medium':   require('../assets/fonts/Pretendard-Medium.otf'),
  'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold':     require('../assets/fonts/Pretendard-Bold.otf'),
});

// ready 조건에 fontsLoaded 합치기
if (!ready || !fontsLoaded) return null;
```

`useEffect` 끝에 `SplashScreen.hideAsync()` 호출 (이미 import한 expo-splash-screen 활용).

---

### 1.5 `apps/ios/app/index.tsx` (source, render MOD)

**Analog:** 본인 — 현재 redirect-only Entry component.

**현재 형태 (lines 6-35):** auth state 확인 후 `<Redirect href="/(tabs)/boards" />` 또는 `<Redirect href="/login" />`.

**Apply pattern (RESEARCH §"Silent failure 차단 smoke test", D-13 통과 기준):**

D-13: "실기기 입증 도달점 = Splash + `app/index.tsx` 렌더 + NativeWind 시각 적용 확인까지. login.tsx 인증 흐름은 Phase 3로 이관." → 현재 auth-gated redirect는 Phase 3 작업이므로, **Phase 1 동안은 smoke screen으로 일시 교체** 또는 redirect 이전에 smoke 검증 한 번 거치는 변형.

권장 형태 — **smoke screen으로 일시 교체** (Phase 3에서 다시 auth redirect로 복원, 또는 smoke를 별도 `app/_smoke.tsx`로 분리해서 index는 그대로 두는 게 더 surgical):

```typescript
// apps/ios/app/index.tsx (Phase 1 smoke 버전 — RESEARCH §"smoke test" 그대로)
import { View, Text } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-500">
      <View className="px-6 py-4 bg-white rounded-2xl shadow-lg">
        <Text className="text-2xl font-bold text-brand-700">NativeWind OK</Text>
        <Text className="text-sm text-neutral-600 mt-2">
          오렌지 화면 + 흰 카드 + 진한 오렌지 텍스트가 보이면 className 적용됨
        </Text>
      </View>
    </View>
  );
}
```

**Surgical 대안 (권장):** 기존 redirect 로직 유지 + smoke를 `app/_smoke/index.tsx` 같은 별도 route로 두기. 이러면 Karpathy §3.3 "사용자가 요청 안 한 줄을 diff에 넣지 말 것" 위배 최소화. planner가 결정.

**예상 시각 결과:**
- 배경 `#F97316` (brand-500), 중앙 흰 카드 (rounded-2xl + shadow-lg), 큰 텍스트 `#C2410C` (brand-700) bold, 작은 텍스트 `#475569` (neutral-600).

---

### 1.6 `eas.json` (config, build-time NEW — conditional path B)

**Analog:** 없음 (in-project). RESEARCH §"`eas.json` development profile shape" 사용.

**Apply pattern — 전체 신규 파일 (RESEARCH §"iOS Build Path B"):**
```json
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "resourceClass": "m-medium", "simulator": false }
    },
    "preview": {
      "extends": "development",
      "ios": { "simulator": true }
    },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

**Location 결정 (Claude's Discretion):** `apps/ios/eas.json` 권장. EAS CLI는 `cd apps/ios && eas build`로 호출되므로 그 디렉토리에 두는 게 직관적. 루트에 두면 다른 워크스페이스(web 등)와 혼동 가능.

**조건부 생성:** Path A 성공 시 이 파일 commit 안 함 (Path B 진입한 wave에서만 생성). D-14 SESSION-NOTES 기록과 한 wave에서 묶음.

---

### 2.1 `packages/ui-tokens/src/brand/wordmark.svg` (asset, design-time NEW)

**Analog:** 없음. UI-SPEC §"Wordmark Composition" + RESEARCH §"`wordmark.svg` 최소 markup 패턴" 사용.

**Apply pattern (UI-SPEC contract):**
- viewBox aspect ratio ~5:1 (UI-SPEC)
- text "MOAJOA" all caps Latin
- Pretendard Bold (700)을 **path로 outline** (font 의존성 제거 — Pitfall C 회피)
- letter spacing -0.02em
- Default fill: `#F97316` (brand.500, ui-tokens `colors.brand.500`)
- 디자이너가 Figma/Illustrator에서 Pretendard Bold "MOAJOA"를 outline → SVG export (1회 작업)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 100" fill="#F97316">
  <path d="M ... Z"/>  <!-- M -->
  <!-- ... 나머지 5 letters as outlined paths ... -->
</svg>
```

**3 color variant 분리 (UI-SPEC):** 단일 파일에 multi-fill 두지 말고, color는 path inherit으로 두고 export-assets.mjs가 fill을 swap하여 3 variant 생성 — 또는 wordmark.svg / wordmark-mono-dark.svg / wordmark-mono-light.svg 3 파일. 결정은 planner (지금은 1 파일 + script swap 권장 — 더 surgical).

---

### 2.2 `packages/ui-tokens/src/brand/icon.svg` (asset, design-time NEW)

**Analog:** 없음. UI-SPEC §"Icon Mark" + RESEARCH §"`icon.svg` 최소 markup 패턴" 사용.

**Apply pattern:**
- viewBox 1024×1024 (1:1 square)
- inner 80% safe area (102..922 each axis, Apple HIG)
- 흰 background rect `#FFFFFF` (iOS app icon contract — Apple이 corner mask 적용)
- foreground: M 모양 지도 핀, 단일 fill `#F97316` (brand.500)
- 두 stroke 구성으로 16px favicon에서도 가독

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#FFFFFF"/>
  <path d="M 200 250 L 350 250 L 512 500 L 674 250 L 824 250
           L 824 700 L 700 800 L 512 950 L 324 800 L 200 700 Z"
        fill="#F97316"/>
</svg>
```

(실제 path는 디자인 검토 후. 본 markup은 sharp가 받을 valid SVG 예시.)

---

### 2.3 `packages/ui-tokens/scripts/export-assets.mjs` (script, file-I/O batch NEW)

**Analog:** 없음 (in-project sharp script 없음). RESEARCH §"`export-assets.mjs` — sharp 정확한 API 호출" 전체 사용.

**Key constraints (RESEARCH §"sharp 결정성"):**
- `density: 384` (SVG → PNG 시 안티앨리어싱 — 1024² 출력에 적정)
- `compressionLevel: 9`, `palette: false`, `progressive: false` (결정성 위해 고정)
- `withMetadata()` 호출 X (자동 strip 유지 — EXIF/timestamp 제거)
- manual invocation (CI 아님) — UI-SPEC contract
- 출력은 git에 commit (CI/EAS가 sharp 실행 안 함)

**전체 패턴은 RESEARCH lines 434-540 그대로 copy.** 핵심 함수 시그니처만 발췌:

```javascript
import sharp from 'sharp';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const BRAND = resolve(__dirname, '../src/brand');

const PNG_OPTS = { compressionLevel: 9, palette: false, progressive: false };

async function writePng(svgBuf, width, height, outPath, opts = {}) {
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(svgBuf, { density: 384 })
    .resize(width, height, {
      fit: opts.fit ?? 'contain',
      background: opts.background ?? { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png(PNG_OPTS)
    .toFile(outPath);
}
```

**Output matrix (UI-SPEC §"Asset Export Matrix" + RESEARCH §"export-assets.mjs"):**

| Output | Size | Source SVG | Background |
|--------|------|------------|------------|
| `apps/ios/assets/icon.png` | 1024×1024 | icon.svg | 흰 |
| `apps/ios/assets/adaptive-icon.png` | 1024×1024 | icon.svg (rect 제외) | alpha 0 |
| `apps/ios/assets/splash.png` | 1242×2688 | wordmark.svg | 흰 (composite center) |
| `apps/web/app/favicon.ico` | 32×32 | icon.svg | 흰 |
| `apps/web/public/apple-touch-icon.png` | 180×180 | icon.svg | 흰 |
| `apps/web/public/og-default.png` | 1200×630 | wordmark.svg | 흰 (composite center) |
| `apps/web/public/favicon-16.png` (선택) | 16×16 | icon.svg | 흰 |

**Pretendard-Bold.ttf 복사 단계 (export-assets.mjs 마지막):**
```javascript
import { copyFile } from 'node:fs/promises';
await copyFile(
  join(ROOT, 'node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf'),
  join(ROOT, 'apps/web/assets/Pretendard-Bold.ttf')
);
```

(RESEARCH는 source를 `apps/ios/assets/fonts/alternative/`로 표기했으나, 실제 source는 npm package인 `node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf`가 더 정확 — `pretendard` 패키지를 ui-tokens devDep으로 추가하거나, ios에서 가져오기. planner 결정.)

---

### 2.4 `packages/ui-tokens/package.json` (config MOD)

**Analog:** 본인. 현재 `scripts`에 typecheck/lint만 있음.

**Apply pattern (RESEARCH §"`package.json` 등록"):**
- `scripts` 추가: `"export-assets": "node scripts/export-assets.mjs"`
- `devDependencies` 추가: `"sharp": "^0.34.5"`
- `devDependencies` 추가: `"pretendard": "^1.3.9"` (alternative 옵션 — apps/ios에 두는 게 더 깔끔할 수도. planner 결정)

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "echo \"(lint TODO)\" && exit 0",
    "export-assets": "node scripts/export-assets.mjs"
  },
  "devDependencies": {
    "sharp": "^0.34.5",
    "pretendard": "^1.3.9",
    "typescript": "^5.6.2"
  }
}
```

---

### 2.5 `packages/ui-tokens/src/tailwind.ts` (config — NO CHANGE)

**Status:** **이미 존재함**. RESEARCH line 359 확인. UI-SPEC가 "shared preset" 파일을 신규로 표현했지만 사실 이미 존재 — 그대로 둠 (Karpathy §3.3).

본 파일이 정의하는 fontFamily는 이미 `typography.fonts.sans = ['Pretendard', ...]` 등록 완료 (lines 23-26). 폰트 register 후 자동으로 `font-sans` className 매핑.

---

### 3.1 Pretendard `.otf` 4 weight (iOS)

**Source:** `node_modules/pretendard/dist/public/static/Pretendard-{Regular,Medium,SemiBold,Bold}.otf` (RESEARCH §"폰트 파일 확보" verified via `npm pack`)

**Apply pattern:**
- 4 파일을 `apps/ios/assets/fonts/`로 복사 (수동 또는 export-assets.mjs에 단계 추가)
- 합계 ~6.3MB — **UI-SPEC의 "~1.6MB" 표기는 ~4배 오류** (RESEARCH §"폰트 파일 확보" 명시) — planner 인지 필요
- iOS `expo-font` config plugin이 native bundle embed (1.3절 app.config.ts 변경 참조)
- iOS PostScript name = 파일명 (`Pretendard-Regular` 등). NativeWind `font-sans` className이 ui-tokens tailwind.ts의 `fontFamily.sans[0]` (`'Pretendard'`)을 통해 매칭 — Assumption A1 (weight 자동 매칭)는 실기기 검증 필수.

### 3.2 Pretendard `.otf` 4 weight (Web)

**Apply pattern (RESEARCH §"Web — `next/font/local` 셋업"):**
- 4 파일을 **`apps/web/public/fonts/`** 또는 **`apps/web/assets/fonts/`**로 복사
- UI-SPEC: `public/fonts/`. RESEARCH: `apps/web/assets/`. **불일치 — UI-SPEC contract을 따라 `public/fonts/`로 결정 권장** (단, next/font/local은 import 시 상대경로이므로 어디 두든 동작. public/은 정적 자산 의도 부합)

### 3.3 `apps/web/assets/Pretendard-Bold.ttf` (Phase 4 OG consumer)

**Source:** `node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf` (2.6MB)

**Apply pattern:**
- export-assets.mjs 마지막 단계에서 자동 복사 (2.3 참조)
- Phase 1엔 파일 present만, code consumer는 Phase 4
- **UI-SPEC "OG .ttf 필수" 클레임은 부분 부정확** (Satori는 .otf/.ttf/.woff 모두 지원, .woff2만 불가) — 그러나 UI-SPEC contract 존중하여 .ttf 사용 권장 (Satori OpenType feature 안정성 — RESEARCH §"권장 결정")

### 3.4 `LICENSE-Pretendard.txt` (SIL OFL 1.1)

**Source:** `node_modules/pretendard/dist/LICENSE.txt` (verified via npm pack)

**복사 대상 (RESEARCH §"복사 위치"):**
- `apps/ios/assets/fonts/LICENSE-Pretendard.txt`
- `apps/web/public/fonts/LICENSE-Pretendard.txt`
- (optional) `packages/ui-tokens/src/brand/LICENSE-Pretendard.txt` (워드마크 outline source 명시)

3개 모두 byte-identical 사본.

---

### 4.1 `apps/web/lib/env.ts` (utility NEW)

**Analog:** `apps/web/lib/cn.ts` (lines 1-6) — 같은 size class의 single-purpose helper.

**기존 cn.ts pattern (file-level shape):**
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

**Apply pattern (RESEARCH §"`apps/web/lib/env.ts` 신규"):**
- 같은 위치 (`apps/web/lib/`)
- 같은 file-level shape: import 없음 + 단일 export function
- 한 줄 설명 JSDoc (RESEARCH 권장)

```typescript
/**
 * Centralized env access for the web app.
 * NEXT_PUBLIC_* vars are inlined at build time — these checks happen at
 * compile time for static optimization, not runtime.
 */
export function isDevToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === '1';
}
```

**왜 `===` strict check:** `0`, `true`, `"false"` 등 모호한 값 모두 false 처리 → fail-safe.

---

### 4.2 `apps/web/app/layout.tsx` (source, render MOD)

**Analog:** 본인 + RESEARCH §"Web — `next/font/local` 셋업".

**현재 형태 (lines 1-20):** import `'./globals.css'` + metadata + 단순 RootLayout. lang="ko"만 설정, className 없음.

**Apply pattern (3-step edit):**

1. **import 추가:**
   ```typescript
   import localFont from 'next/font/local';
   ```

2. **컴포넌트 외부에 const 추가 (4 weight 등록):**
   ```typescript
   const pretendard = localFont({
     src: [
       { path: '../public/fonts/Pretendard-Regular.otf',  weight: '400', style: 'normal' },
       { path: '../public/fonts/Pretendard-Medium.otf',   weight: '500', style: 'normal' },
       { path: '../public/fonts/Pretendard-SemiBold.otf', weight: '600', style: 'normal' },
       { path: '../public/fonts/Pretendard-Bold.otf',     weight: '700', style: 'normal' },
     ],
     variable: '--font-pretendard',
     display: 'swap',
   });
   ```
   (path는 폰트 파일 최종 위치에 맞춰 조정 — UI-SPEC contract = `public/fonts/`)

3. **`<html>` className에 variable 적용:**
   ```typescript
   <html lang="ko" className={pretendard.variable}>
   ```

4. **(연동) `apps/web/app/globals.css` line 5 minor edit (RESEARCH §"globals.css 변경"):**
   ```css
   --font-sans: var(--font-pretendard), 'IBM Plex Sans KR', 'Noto Sans JP', system-ui, sans-serif;
   ```
   (현재 `'Pretendard'` → `var(--font-pretendard)`로 바뀜 — next/font의 hash된 family name 사용)

---

### 4.3 `apps/web/app/boards/page.tsx` (source, request-response MOD)

**Analog:** 본인 (exact match) — 이미 `redirect('/login')` 패턴 존재.

**현재 핵심 패턴 (lines 1-10):**
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
```

**Apply pattern (RESEARCH §"`apps/web/app/boards/page.tsx` 1차 게이트"):**
1. import 추가 (line 5 자리): `import { isDevToolsEnabled } from '@/lib/env';`
2. 함수 본문 첫 라인에 게이트 (auth check **이전**):
   ```typescript
   export default async function BoardsPage() {
     // WEB-01/WEB-02: dev-tool 게이트 — env 미설정 시 즉시 /login으로 (auth 게이트 이전)
     if (!isDevToolsEnabled()) redirect('/login');
     // ↓ 기존 코드 그대로
     const supabase = await getSupabaseServer();
     ...
   ```

**Critical ordering (RESEARCH 명시):** env 게이트가 auth 게이트보다 **먼저** — logged-in user여도 dev 미허가면 차단.

**Why `redirect` works here (Pitfall D 회피):** `BoardsPage`는 `async function` + `'use client'` 없음 → Server Component → `redirect()` throw 안전.

---

### 4.4 `apps/web/app/boards/[id]/page.tsx` (source, request-response MOD)

**Analog:** 본인 (exact match) — 4.3과 거의 동일.

**현재 핵심 (lines 1-12):**
```typescript
import { notFound, redirect } from 'next/navigation';
...
export default async function BoardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
```

**Apply pattern (4.3과 동일):**
1. `import { isDevToolsEnabled } from '@/lib/env';` 추가
2. 함수 본문 첫 라인 (params await **이전이어도 무방** — 게이트가 가장 빠를수록 좋음):
   ```typescript
   if (!isDevToolsEnabled()) redirect('/login');
   ```

---

### 4.5 `apps/web/app/boards/_components/create-board-button.tsx` (source, event-driven MOD)

**Analog:** 본인 (Client Component).

**현재 핵심 (lines 1-9):**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBoard } from '@moajoa/api';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export function CreateBoardButton() {
  const router = useRouter();
```

**Apply pattern (RESEARCH §"`CreateBoardButton` 2차 게이트"):**
1. import 추가: `import { isDevToolsEnabled } from '@/lib/env';`
2. 컴포넌트 본문 **첫 줄** (`useState`/`useRouter` 호출 **전에**):
   ```typescript
   export function CreateBoardButton() {
     // D-09 defense in depth — page 게이트 우회 시에도 컴포넌트가 차단
     if (!isDevToolsEnabled()) return null;

     const router = useRouter();  // 기존 코드 그대로
     ...
   ```

**⚠️ React Hooks rule (RESEARCH 명시):** early return은 모든 hook 호출 **전에**. `NEXT_PUBLIC_*`는 빌드 시 상수 inline이므로 false 빌드에서는 hook이 dead-code-eliminated → tree-shaking 이득.

**Client Component에서 `redirect()` 호출 X (Pitfall D):** 여기는 `return null`만, push 아님.

---

### 4.6 `apps/web/app/boards/[id]/_components/add-link-form.tsx` (source, event-driven MOD)

**Analog:** 본인 (Client Component) + 4.5 패턴 그대로 적용.

**현재 핵심 (lines 1-11):**
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addLink, triggerExtraction } from '@moajoa/api';
import { detectSourceKind } from '@moajoa/core';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export function AddLinkForm({ boardId }: { boardId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
```

**Apply pattern (4.5와 동일):**
1. `import { isDevToolsEnabled } from '@/lib/env';` 추가
2. `if (!isDevToolsEnabled()) return null;` — `useRouter`/`useState` **이전**

---

## Shared Patterns

### Workspace import (CLAUDE.md §4.5)

**Source rule:** `import { foo } from '@moajoa/...'` 또는 `'@/lib/...'` — **`.js` extension 금지** (Turbopack 호환)

**Apply to:** 모든 신규/수정 TS 파일
- ✅ `import { isDevToolsEnabled } from '@/lib/env';`
- ❌ `import { isDevToolsEnabled } from '@/lib/env.js';`

검증 grep: `grep -rn "from '@/.*\.js'" apps/web/`

---

### Server Component vs Client Component (Pitfall D)

**Source rule:** `redirect()` from `next/navigation`는 Server Component / Server Action에서만.

| Component | 게이트 fail 시 동작 |
|-----------|---------------------|
| `boards/page.tsx`, `boards/[id]/page.tsx` (async, no `'use client'`) | `redirect('/login')` |
| `CreateBoardButton`, `AddLinkForm` (`'use client'`) | `return null` |

---

### React Hooks ordering (RESEARCH §"CreateBoardButton" 주의)

**Apply to:** 모든 Client Component에서 early-return 게이트 도입 시

- 게이트 (`if (!...) return null`)는 **모든 `useState`/`useRouter`/`useEffect` 호출 전에**
- `NEXT_PUBLIC_*` env는 빌드 시 inline → dead branch eliminated → 클라이언트 번들에서 form JSX 누락 (V7 검증)

---

### 폰트 파일 SOT (Single Source of Truth)

**Source:** npm `pretendard@1.3.9` (verified tarball — RESEARCH §"폰트 파일 확보")

| Output 위치 | 파일 | Source 경로 |
|-------------|------|-------------|
| `apps/ios/assets/fonts/` | 4× .otf | `node_modules/pretendard/dist/public/static/Pretendard-{R,M,SB,B}.otf` |
| `apps/web/public/fonts/` | 4× .otf | 위와 동일 (또는 ios 사본) |
| `apps/web/assets/` | Pretendard-Bold.ttf | `node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf` |
| `LICENSE-Pretendard.txt` (3 위치) | SIL OFL 1.1 | `node_modules/pretendard/dist/LICENSE.txt` |

**Apply to:** export-assets.mjs의 copyFile 단계 + 수동 1회 셋업 모두 위 SOT 사용. 다른 소스 (GitHub release zip 등) 사용 금지.

---

### 자산 디렉토리 신규 생성

**기존:** `apps/ios/assets/`, `apps/web/public/fonts/`, `apps/web/assets/` 모두 **부재** (verified by ls).

**Apply pattern:** export-assets.mjs의 `ensureDir`/`mkdir({ recursive: true })`가 자동 생성. 수동 단계 불요.

---

### 4시간 timebox + SESSION-NOTES (D-01, D-14)

**Apply to:** iOS 빌드 wave 전체

- Wave 시작 시각 기록
- Path A 시도 단계별 시각 기록 (pod install / prebuild / xcode build)
- 4시간 도달 시 Path B 즉시 전환
- B 전환 시 `docs/SESSION-NOTES-YYYY-MM-DD.md`에 (RESEARCH §"EAS 전환 후" 7개 항목):
  - 시작 시각, 4h 도달 시각, 시도 액션 목록 (시간 순), 마지막 차단 신호, EAS 전환 시각, EAS 첫 빌드 성공 시각, 실기기 install 성공 시각

---

### Lockfile freeze (Pitfall G)

**Apply to:** iOS 빌드 wave 성공 직후

```bash
git add pnpm-lock.yaml && git commit -m "chore: freeze lockfile after Phase 1 iOS build"
```

별도 commit (다른 변경과 묶지 말 것 — Karpathy §3.3 surgical).

---

## No Analog Found

다음 파일은 codebase에 close match 없음 → planner는 **RESEARCH 해당 section + UI-SPEC contract**를 1차 reference로 사용.

| 파일 | Role | 사용할 1차 ref |
|------|------|----------------|
| `eas.json` | config (EAS) | RESEARCH §"iOS Build Path B (EAS Fallback)" lines 168-244 |
| `packages/ui-tokens/src/brand/wordmark.svg` | asset (svg source) | UI-SPEC §"Wordmark Composition" + RESEARCH §"wordmark.svg 최소 markup 패턴" lines 384-403 |
| `packages/ui-tokens/src/brand/icon.svg` | asset (svg source) | UI-SPEC §"Icon Mark" + RESEARCH §"icon.svg 최소 markup 패턴" lines 405-430 |
| `packages/ui-tokens/scripts/export-assets.mjs` | script (sharp) | RESEARCH §"export-assets.mjs — sharp 정확한 API 호출" lines 432-540 (전체 그대로) |

이 4개는 모두 새 기능 카테고리이며, RESEARCH가 verified API 시그니처 + 코드 예시를 충분히 제공.

---

## Cross-cutting Constraints (do-not-modify list)

| 파일 / 영역 | 이유 |
|-------------|------|
| `/.npmrc` (루트) | D-02: hoist 범위 ios 한정 |
| `apps/web/middleware.ts` | D-09: middleware는 Supabase 세션 refresh만 |
| `apps/ios/app.config.ts` plugins의 share-intent 주석 (lines 25-27) | D-16: Phase 3까지 expo-share-intent 미도입 |
| `apps/ios/babel.config.js` | RESEARCH §"NativeWind 4.2": v4 라인 내 babel 변경 없음. `react-native-worklets/plugin` 추가 금지 (중복 시 빌드 에러) |
| `apps/ios/metro.config.js` | `withNativeWind` v4 API 변경 없음 |
| `apps/ios/global.css`, `apps/ios/tailwind.config.js` | NativeWind 4.x 라인 내 변경 없음 |
| `packages/ui-tokens/src/index.ts`, `src/tailwind.ts` | 이미 brand 색 + Pretendard fontFamily 등록 완료 |
| `apps/web/app/globals.css` (line 5 외) | Pretendard fontFamily 이미 1순위. line 5 `--font-sans` 값만 minor edit |
| `supabase/migrations/*` | Phase 1 DB 미터치 |
| `_archive_asis/` | CLAUDE.md §5 금지 |

---

## Metadata

**Analog search scope:**
- `apps/ios/` (config files, app/ tree, lib/)
- `apps/web/` (lib/, app/ tree, middleware, configs)
- `packages/ui-tokens/` (src/, package.json)
- `/.npmrc`, `/.gitignore`

**Files scanned (Read):** 17 — app.config.ts, ios package.json, ios/app/_layout.tsx, ios/app/index.tsx, ios/babel.config.js, ios/metro.config.js, ios/tailwind.config.js, ios/global.css는 RESEARCH 인용으로, ios/.gitignore, web/app/layout.tsx, web/app/boards/page.tsx, web/app/boards/[id]/page.tsx, web/app/boards/_components/create-board-button.tsx, web/app/boards/[id]/_components/add-link-form.tsx, web/middleware.ts, web/app/globals.css, web/package.json, web/lib/cn.ts, web/tailwind.config.ts, ui-tokens/src/index.ts, ui-tokens/src/tailwind.ts, ui-tokens/package.json, /.npmrc

**Pattern extraction date:** 2026-05-25
**Source of truth precedence:** CONTEXT (locked decisions) > UI-SPEC (visual contract) > RESEARCH (verified APIs) > existing code (analogs)
