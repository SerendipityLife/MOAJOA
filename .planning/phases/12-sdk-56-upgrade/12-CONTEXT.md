# Phase 12: SDK 55 → 56 (RN 0.85 + Hermes v1 + expo run:ios 복귀) - Context

**Gathered:** 2026-06-13 (Phase 11 종료 직후 — 마일스톤 결정 carry-forward + Phase 11 학습)
**Status:** Ready for planning
**Source:** v1.2 discuss 잠금(Hermes/풀 범위/브랜치) + Phase 11 실행 학습 + Expo SDK 56 changelog.

<domain>
## Phase Boundary

**IN (UPGRADE-01 완료 / UPGRADE-04):** apps/ios를 Expo SDK 55(RN 0.83) → **SDK 56(RN 0.85/React 19.2, Hermes v1 기본)**으로 올린다. iOS deployment target 16.4 상향. **표준 `expo run:ios`가 Xcode 26 시뮬레이터에서 사이닝 에러 없이 동작**함을 검증(이 마일스톤의 실질 목표 — @expo/cli devicectl 버그 수정이 56에 있음).

**OUT:** pnpm sim 스크립트 제거 + 실기기 share-sheet UAT + 메모리/CLAUDE.md 갱신(Phase 13). apps/web·packages 변경.
</domain>

<evidence>
## Codebase Evidence (Phase 11 종료 시점)

1. **현재 상태:** expo 55.0.26 / RN 0.83.6 / react 19.2.0 / Hermes / expo-share-intent 6.1.1 / react-native-maps 1.27.2(자체 plugin으로 google maps 설정). New Arch on. jest 38/38 + tsc clean.
2. **expo-share-intent:** 7.0.0 = expo peer `^56` (Phase 11에서 확인). SDK 56엔 7.0.0 필요.
3. **react-native-maps google maps 설정:** app.config.ts의 `['react-native-maps', { iosGoogleMapsApiKey }]` 플러그인 그대로 유지(11-03 결정 carry-forward).
4. **deployment target:** 현재 15.1 → SDK 56 요구 16.4. prebuild가 app.config 기반으로 설정하거나 podfile.properties/Podfile에서 상향 필요.
5. **빌드 경로:** SDK 56에서 `expo run:ios`의 Xcode 26 devicectl 사이닝 버그가 수정됨 → pnpm sim 우회 없이 표준 빌드 가능해야 함. **이걸 직접 검증하는 게 Phase 12의 핵심 게이트.**
6. **Node v22.22.3** — SDK 56 요구(≥20.19.4) 충족. `@react-navigation/*` 직접 import 0건(expo-router fork breaking 무해).
</evidence>

<decisions>
## Locked Decisions (carry-forward + Phase 11 학습)

### A. 버전 bump 절차 (Phase 11 학습 — 11-02 실행 노트)
- `pnpm --filter @moajoa/ios add expo@~56.0.11` 직접 핀(메이저 통과) → `expo install --fix` **포그라운드 1회** → expo-share-intent 7.0.0 → expo install --check 0.
- 롤백: `git checkout HEAD -- package.json pnpm-lock.yaml` → `pnpm install --frozen-lockfile`.

### B. react-native-maps 설정 유지 (11-03 결정)
- `ios.config.googleMapsApiKey` 금지, `['react-native-maps', { iosGoogleMapsApiKey }]` 플러그인 유지. 1.27→(56의 maps 버전)도 동일 plugin API 가정 — 변경 시 확인.

### C. 검증 게이트
- **autonomous:** 버전 bump, prebuild --clean, deployment target 16.4 확인, pnpm sim 빌드, tsc + jest, **`expo run:ios` 시도(표준 경로 복귀 검증)**.
- **autonomous:false(육안):** 웰컴/보드 화면 렌더 + 회귀 0(스크린샷).

## Claude's Discretion (planner)
- deployment target 16.4를 app.config.ts(ios.deploymentTarget 또는 expo-build-properties plugin)로 박을지 prebuild 기본값에 맡길지.
</decisions>

<constraints>
- apps/ios 한정. New Arch 유지. `.js` import 금지. 네이티브 설정은 app.config.ts 단일 소스 → prebuild 재생성.
- 마일스톤 브랜치 `gsd/v1.2-sdk-upgrade`에서만 작업.
- Phase 11에서 통과한 Hermes/maps 설정 회귀시키지 말 것.
</constraints>

<deferred>
- pnpm sim 우회 제거 + scripts 정리 → Phase 13
- 실기기 share-sheet UAT(EAS) + 메모리/CLAUDE.md 갱신 → Phase 13
- release/EAS hermesc Hermes 정밀 검증 → Phase 13
</deferred>

---
*Phase: 12-sdk-56-upgrade*
*Context: 2026-06-13 — carry-forward + Phase 11 학습*
*Next: `/gsd-plan-phase 12` (또는 직접 실행)*
</content>
