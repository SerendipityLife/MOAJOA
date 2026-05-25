# Phase 1: Build Unblock & Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 01-build-unblock-hygiene
**Areas discussed:** iOS 빌드 경로, App icon/splash/wordmark 자산 파이프라인 (+ Pretendard), Web dev-tool 격리, Phase 1 통과 기준

---

## iOS 빌드 경로

### Q1: 1차 시도 전략 (4h timebox lock된 상태에서)

| Option | Description | Selected |
|--------|-------------|----------|
| Local prebuild A 우선, 막히면 EAS B | apps/ios/.npmrc node-linker=hoisted → expo run:ios. 안되면 EAS로. 머신 환경 학습 자산 남음. | ✓ |
| EAS Build B 단독 | 머신 환경 결합도 이슈 완전 우회. cloud round-trip 느림. | |
| 둘 동시 평행 | 한 날에 동시 다발. cognitive overhead. | |

### Q2: Hoisting 범위

| Option | Description | Selected |
|--------|-------------|----------|
| apps/ios/.npmrc 한정 node-linker=hoisted | Callstack 가이드 패턴. apps/web·packages/*에 영향 없음. | ✓ |
| 루트 .npmrc에 public-hoist-pattern 추가 | 세분화 가능. 관리 대상 패턴 리스트 유지 필요. | |
| 이 결정은 plan-phase에서 | researcher가 검증 후 선택. | |

### Q3: EAS Build profile (B 경로 도달 시)

| Option | Description | Selected |
|--------|-------------|----------|
| development (dev client) | expo-dev-client 포함, hot reload 유지. dogfooding 최적. ad-hoc 등록 필요. | ✓ |
| preview (ad-hoc internal) | production-like, dev client 없음. 머신 면자 설치 테스트용. | |
| TestFlight (production) | Apple 심사 30분+. 오버킬. | |

### Q4: 실기기 install 마지막 마일

| Option | Description | Selected |
|--------|-------------|----------|
| EAS 시 QR + Expo Orbit, local 시 Xcode | build profile에 따라 분기. 일상 설치 경로. | ✓ |
| Apple Configurator · USB만 | 케이블 전용. 무선 환경 의존 없음. | |
| TestFlight | 외부 설치 경로. 공유 서서 불필요. | |

---

## App icon/splash/wordmark 자산 파이프라인 (+ Pretendard)

### Q1: 원본 디자인 자산 현 상태

| Option | Description | Selected |
|--------|-------------|----------|
| 아직 없다 — 이번 phase에서 디자인도 만든다 | 자산 완전 제로. 단순 형태로 1차 적용. Phase 5 trust UI에서 고도화. | ✓ |
| Figma·Sketch에 이미 있음 — export만 | export 디테일 결정으로 넘어감. | |
| ASIS Flutter 자산 재사용 | _archive_asis/에서 PNG 추출. CLAUDE.md 금지와 충돌 여부 검토 필요. | |

### Q2: 파일 관리 절차

| Option | Description | Selected |
|--------|-------------|----------|
| packages/ui-tokens/src/brand/ SVG single source + export script | Research 권장. iOS PNG, web favicon, OG 다 sharp 기반 한 스크립트로 export. 재생산 쉬움. Phase 4 OG에서 재사용. | ✓ |
| iOS PNG 직접 import (apps/ios/assets/) | 빠르다. web/iOS 공유 감소. | |
| Expo 공식 asset tool (expo-image-utils) | iOS만 처리. ui-tokens 공유 없음. | |

### Q3: Pretendard 폰트 Phase 1에 포함?

| Option | Description | Selected |
|--------|-------------|----------|
| 예, 4 weight (Regular/Medium/SemiBold/Bold) | Research 권장. iOS expo-font + web next/font/local 셋업. Phase 4 OG에서 필수. | ✓ |
| 예, 최소 2 weight (Regular/Bold) | 번들 크기 애 이. 하이라키 표현 제한. | |
| Phase 3/4로 미룸 | 시스템 폰트로 시작. Phase 4 OG 디자인할 때 같이. | |

### Q4: Splash screen 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 워드마크 중앙 정렬, brand 컴러 배경 | iOS launch screen 표준. expo-splash-screen 기본 설정. 단일 이미지. | ✓ |
| 아이콘만, 흙 업계 스타일 | 더 미니멀. 워드마크 필요 없음. | |
| Phase 5에 대한 클레버 애니메이션 | Lottie 등. 설정 복잡 + 원본 자산 필요. | |

---

## Web dev-tool 격리

### Q1: 격리 메커니즘 주축

| Option | Description | Selected |
|--------|-------------|----------|
| 페이지 + 컴포넌트 이중 게이트 | /boards 페이지 자체 + CreateBoardButton/AddLinkForm 컴포넌트 둘 다 env 체크. Deep-link prod 이탈 없으면서 bypass 위험 최소. | ✓ |
| 컴포넌트 단일 게이트만 | 페이지 redirect 없이 컴포넌트에서만. 빈 페이지 헤더만 낚음. | |
| Middleware 레벨 라우트 차단 | middleware에서 env 없으면 redirect. SSR 렌더링도 안 돌아감. | |

### Q2: Prod에서 env 없을 때 default 행선

| Option | Description | Selected |
|--------|-------------|----------|
| /login 으로 redirect | WEB-02 success criterion과 일치. 로그인한 사용자에게도 dev-tool 경로는 경험되지 않음. | ✓ |
| 404 (notFound) | 페이지 자체를 숨김. URL probing 방어. | |
| / (홈 랜딩) | 가장 조용. 공유 URL 세션 만료 후 명확한 방향 세션. | |

### Q3: 관리자/접근 권한 입장

| Option | Description | Selected |
|--------|-------------|----------|
| env 하나로 충분 (escape hatch 별도 없음) | 로컬 개발·녹의 시 설정해서 켜고, prod에선 느음. v1 dogfooding은 iOS에서만 입력. | ✓ |
| user_id allowlist | v1.5를 위한 관리자 panel 구조 설정. over-engineering 위험. | |
| 온라인 trick (구뚝이 + URL fragment 9999) | 고전 trick. 보안 취약. | |

### Q4: Dev-tool route 파일 구조

| Option | Description | Selected |
|--------|-------------|----------|
| /boards 경로 그대로 유지 + 게이트 | 현재 구조 수정 최소. WEB-01·WEB-02 트짛으로 쓰는 PR 범위 소. | ✓ |
| /(dev)/boards 속으로 이동 | Next.js route group 활용. 의도 명확. 이동 cost + import path 수정. | |
| /admin 아래로 이동 | v1.5 관리자 panel 구조 선제. minimal change 철학에서 벗어남. | |

---

## Phase 1 "통과" 의 실기기 검증 범위

### Q1: 실기기 입증 시 어디까지 도달해야 Phase 1 "통과"?

| Option | Description | Selected |
|--------|-------------|----------|
| Splash + index.tsx 렌더 + NativeWind 적용 검증 | BUILD-01 + BUILD-02 최소 달성. login.tsx까지는 안 가도 됨. | ✓ |
| Splash + login.tsx UI 그려짐 (인증 흐름은 X) | Magic link 수신은 Phase 3로 이관. NativeWind 1단계 더 검증. | |
| Login → boards 탭 진입 (Supabase 세션 e2e) | SAVE-01과 중복. "빌드이 실제 동작"의 증명으로는 가장 강력. | |

### Q2: EAS이 결국 필요했다면 success criterion #3 (4h 기록) 형식

| Option | Description | Selected |
|--------|-------------|----------|
| docs/SESSION-NOTES-YYYY-MM-DD.md에 timeline + 결정 | GSD 관례 일치. 행원·결과·다음세션으로 넘긴 context. 대체 경로 기록 → 다른 phase에서 재활용. | ✓ |
| .planning/phases/01-.../EAS-DECISION.md 독립 노트 | Phase artifact로 분리. 머신제로의 재활용성 높이지만 세션 노트와 이중 관리. | |
| git 커밋 메시지 + commit log만 | 가장 일관. 세부 을 담기 어려움. | |

### Q3: Sentry/Crash reporting 설치 (Phase 1에 포함이지?)

| Option | Description | Selected |
|--------|-------------|----------|
| 아니오, Phase 1.5이상에 계속 미루 | PROJECT.md에 에러 트래킹 = v2 명시. v1 dogfooding은 자워·콘솔 로그로 충분. | ✓ |
| Sentry SDK만 추가 (클라이언트 초기화 X) | 구해 세팅은 v2. SDK 설치만 입장으로. 패키지 둥어 입장. | |
| Sentry 완전 셋업 포함 | scope creep 위험 끔. v1 제외 계속. | |

### Q4: expo-share-intent / Share Extension Phase 1에 얼마 담김?

| Option | Description | Selected |
|--------|-------------|----------|
| 안 담김, Phase 3에서 처음 도입 | ROADMAP과 일치. Phase 1은 최소 안정. app.config.ts의 차후 처리 comment 유지. | ✓ |
| 패키지·config 추가만 넘어두기 (코드 사용 X) | Phase 3 쓰고 속도 감소. 단점: 빌드 이슈 외부 변수 증가. | |
| 완전 설정 + 테스트 | Phase 3의 핵심 작업을 현 phase로 이동 — scope creep. | |

---

## Claude's Discretion

다음은 사용자가 명시적으로 "Claude 결정"으로 둔 영역 (CONTEXT.md D-section 끝에 명시):

- pnpm lockfile freeze 시점·방식 (plan-phase에서 결정)
- `react-native-worklets` peer 명시 위치
- patch-package 적용 대상 (Phase 3 시 추가)
- NativeWind 4.2 breaking change scan 범위
- SVG export script의 정확한 size matrix

## Deferred Ideas

논의 중 거론되었으나 다른 phase로 이관된 항목:

- expo-share-intent / Share Extension 셋업 → Phase 3
- Sentry / 에러 트래킹 → v2
- EAS Update (OTA) → v1.5 이후
- Splash 클레버 애니메이션 → Phase 5 candidate
- TestFlight 외부 배포 → Phase 6 이후
- user_id allowlist / 관리자 panel → v1.5
- /admin route 구조 → v1.5
