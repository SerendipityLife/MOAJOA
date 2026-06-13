# Phase 11: SDK 54 → 55 (New Arch 확정 + Hermes 복귀 + RN 0.83) - Context

**Gathered:** 2026-06-12 (discuss — 사용자 3개 회색지대 잠금 + 코드 정찰 + Expo SDK 55/56 릴리즈 노트)
**Status:** Ready for planning
**Source:** 사용자 결정(Hermes 복귀 / 풀 범위 / 마일스톤 브랜치) + apps/ios 정찰 + Expo 공식 changelog(SDK 55/56) + RN 0.82 "New Era" 블로그.

<domain>
## Phase Boundary

**IN (UPGRADE-01 부분 / UPGRADE-02 / UPGRADE-03):** apps/ios를 Expo SDK 54(RN 0.81/React 19.1) → **SDK 55(RN 0.83/React 19.2)**로 올린다. JS 엔진을 **JSC → Hermes**로 되돌리고 supabase 런타임(OTEL 동적 import) 회귀 0을 검증한다. New Architecture는 이미 사용 중이므로 "확정"만 한다(이미 Reanimated 4 + opt-out 플래그 없음). 핵심 네이티브 기능(구글맵·애플로그인·share extension·bottom-sheet·gesture) 회귀 0.

**OUT:** SDK 56으로의 추가 점프(Phase 12), pnpm sim 우회 스크립트 제거·실기기 share-sheet UAT(Phase 13), apps/web·packages 변경(이 마일스톤은 apps/ios 한정 — packages/core·api는 TS라 RN 버전 비종속).
</domain>

<evidence>
## Codebase Evidence (정찰)

1. **이미 New Architecture 사용 중** — `react-native-reanimated@~4.1.7`(Reanimated 4 = New Arch 전용) + app.config.ts에 `newArchEnabled` 없음 + `ios/Podfile.properties.json`에 opt-out 없음. → SDK 55의 "Legacy Arch 폐지"가 무해. 가장 큰 마이그레이션 리스크 이미 흡수.
2. **JS 엔진 = JSC** (`ios/Podfile.properties.json: "expo.jsEngine": "jsc"` + app.config.ts `ios.jsEngine: 'jsc'`). 이유는 app.config.ts 주석에 기록: supabase-js 동적 OTEL_PKG import의 webpackIgnore/turbopackIgnore/@vite-ignore magic comment가 Hermes 바이트코드 컴파일러에서 깨짐. **RN 0.81부터 first-party JSC 제거** → SDK 55(RN 0.83)에선 커뮤니티 패키지 없이 JSC 불가. 사용자 결정: **Hermes 복귀.**
3. **설치된 supabase-js = 2.45.4** (주석은 2.106.1 기준 — 버전 드리프트). Hermes 회귀 여부는 **실제 빌드+런타임으로만 확정 가능** → 11-01에서 격리 검증.
4. **share extension** = `expo-share-intent@^5.1.1` (SDK 54 호환 라인). SDK 55+는 **6.x 필요**(Phase 3 03-02 결정 로그에 이관 예고됨). plugin API shape(iosAppGroupIdentifier/iosShareExtensionName/iosActivationRules) 동일 추정 — 확인 필요.
5. **app.config.ts 네이티브 설정**: GMSApiKey(`ios.config.googleMapsApiKey`), App Group entitlement(`group.com.serendipitylife.moajoa`), expo-font 4 weight, expo-splash-screen, eas appExtensions(ShareExtension). re-prebuild 시 전부 보존 확인 필요.
6. **`@react-navigation/*` 직접 import 0건** — SDK 56 expo-router fork breaking change 영향 없음(Phase 12에서도 무해).
7. **Node v22.22.3** — SDK 56 요구(≥20.19.4) 충족.
8. **빌드 경로**: 표준 `expo run:ios`는 Xcode 26에서 깨짐(@expo/cli 사이닝 버그, 56에서만 수정). SDK 55 단계에선 **여전히 pnpm sim(scripts/ios-sim.sh, xcodebuild 직접)** 사용. `DEVELOPER_DIR`은 ~/.zshrc:7에 영구 등록됨.
</evidence>

<decisions>
## Locked Decisions (사용자 discuss — 2026-06-12)

### A. JS 엔진 = Hermes 복귀 (사용자 확정)
- jsEngine을 Hermes(SDK 기본값)로 되돌린다. **엔진 전환을 SDK bump와 분리** — 먼저 SDK 54 위에서 Hermes로 전환해 supabase 런타임(로그인+쿼리)을 검증한 뒤 SDK 55로 점프. OTEL 변수를 한 번에 하나씩.
- **Fallback (OTEL 회귀 시):** babel transform으로 webpackIgnore/turbopackIgnore/@vite-ignore magic comment를 Hermes 전에 제거(app.config.ts 주석이 지목한 우회). 또는 supabase-js를 OTEL magic comment가 없는 라인으로 상향.

### B. 범위 = 풀 (사용자 확정 — 마일스톤 전체, Phase 11은 그중 55까지)
- 이 마일스톤은 54→55→56 + 우회 제거 + 실기기 UAT + 문서 갱신. Phase 11은 **55 도달 + Hermes 검증 + 네이티브 회귀 0**까지.

### C. 브랜치 = `gsd/v1.2-sdk-upgrade` (사용자 확정)
- 마일스톤 브랜치에서 작업, 검증 후 main 머지. main을 항상 빌드 가능 상태로 유지(config.json branching:none이지만 RN 2메이저 점프라 예외).

### D. 검증 게이트
- **autonomous:** package.json 버전 상향(lockstep), `npx expo install --check`, expo-share-intent 6.x 이관, prebuild --clean + 네이티브 설정 grep 보존 확인, jest + tsc, pnpm sim 시뮬레이터 빌드.
- **autonomous:false (수동 게이트):** 시뮬레이터에서 supabase 로그인+쿼리 런타임 동작 육안 확인(OTEL 회귀 0), 구글맵·bottom-sheet·gesture 시각 회귀 확인.

## Claude's Discretion (planner)
- Hermes 격리 검증(11-01)을 별도 plan으로 둘지 SDK bump와 묶을지, expo install --check 후 잔여 패키지 수동 핀 목록, prebuild --clean vs incremental.
</decisions>

<canonical_refs>
- `apps/ios/package.json` — expo/react-native/react + expo-* + share-intent/maps/reanimated/gesture/bottom-sheet 버전 lockstep 상향 지점
- `apps/ios/app.config.ts` — jsEngine 제거(Hermes 복귀) + share-intent plugin + GMSApiKey/App Group/font 보존
- `apps/ios/ios/Podfile.properties.json` — `expo.jsEngine` 제거(Hermes 기본)
- `apps/ios/scripts/ios-sim.sh` — SDK 55 빌드 검증 경로(Phase 13에서 제거 예정, 여기선 사용)
- Expo SDK 55 changelog: https://expo.dev/changelog/sdk-55 · RN 0.82 "New Era": https://reactnative.dev/blog/2025/10/08/react-native-0.82
- ios-local-build-on-this-mac 메모리 — DEVELOPER_DIR / pnpm sim / Xcode 26 우회
</canonical_refs>

<constraints>
- apps/ios 한정. packages/core·api·ui-tokens·apps/web 변경 금지(범위 밖).
- 기존 supabase 마이그레이션·Edge Function 무관(이 phase는 클라 SDK만).
- `.js` extension import 금지(CLAUDE.md 4.5). 네이티브 설정 변경은 app.config.ts 단일 소스 → prebuild로 재생성(ios/ 수동 편집 최소화).
- New Arch는 켠 채로 유지(끄기 불가 — SDK 55가 Legacy 폐지).
- 마일스톤 브랜치에서만 작업.
</constraints>

<deferred>
- SDK 56 점프(RN 0.85 / Hermes v1 / deployment target 16.4 / expo run:ios 복귀) → Phase 12
- pnpm sim 우회 제거 + scripts 정리 + 메모리/CLAUDE.md 갱신 → Phase 13
- 실기기 share-sheet 추출 트리거 UAT(EAS dev build) → Phase 13 (v1.1 잔여 흡수)
- apps/web의 Next.js/의존성 상향 — 이 마일스톤 범위 밖
</deferred>

---
*Phase: 11-sdk-55-upgrade*
*Context: 2026-06-12 discuss (사용자 3개 결정 잠금) + 코드 정찰 + Expo 공식 changelog*
*Next: `/gsd-plan-phase 11`*
</content>
</invoke>
