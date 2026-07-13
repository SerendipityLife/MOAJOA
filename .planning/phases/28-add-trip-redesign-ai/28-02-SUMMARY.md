---
phase: 28-add-trip-redesign-ai
plan: 02
subsystem: web-presentation
tags: [ui-contract, select-pill, duration-pills, marker-svg, tdd]
status: complete

requires: []
provides:
  - SelectPill (apps/web/components/select-pill.tsx, 배럴 export)
  - SelectPillProps
  - DurationPills + DURATION_OPTIONS (apps/web/app/onboarding/_components/duration-pills.tsx)
  - "buildMarkerIconUrl({ label?: number }) — additive"
affects:
  - 28-04 (step-where·step-who·step-dates가 SelectPill·DurationPills import)
  - 28-05 (DurationGateSheet가 DurationPills 한 벌 공유 · DaySelectSheet가 SelectPill)
  - 28-06 (moa-map 번호 핀이 buildMarkerIconUrl label 소비)

tech-stack:
  added: []   # 신규 npm 패키지 0
  patterns:
    - "독립 컴포넌트 신설(Chip 확장 아님) — 기존 사용처 회귀 0 (A-2)"
    - "additive optional 옵션 확장 — 미전달 시 출력 바이트 동일 (24-02 fill 선례 미러)"
    - "타입이 곧 인젝션 계약 — label: number라 사용자 문자열이 SVG에 도달 불가 (HC-6)"

key-files:
  created:
    - apps/web/components/select-pill.tsx
    - apps/web/app/onboarding/_components/duration-pills.tsx
    - apps/web/__tests__/select-pill.test.tsx
    - apps/web/__tests__/duration-pills.test.tsx
  modified:
    - apps/web/components/index.ts
    - apps/web/lib/marker-svg.ts
    - apps/web/__tests__/marker-svg.test.ts

decisions:
  - "SelectPill 텍스트는 brand-600, 테두리는 brand-500 — brand-500 텍스트는 흰 배경 대비 3.72:1로 WCAG AA 미달(A-3)"
  - "aria-pressed 사용(Chip의 aria-selected 아님) — 토글 버튼 롤"
  - "label은 물음표 배지와 같은 슬롯을 공유하며 label이 우선 — 저신뢰 투명도(0.45)는 유지, 배지만 대체"
  - "DurationPills가 상태를 소유하지 않음 — 위저드·게이트 시트 양쪽이 동일 컴포넌트를 재사용하는 전제"

metrics:
  duration: ~20m
  completed: 2026-07-13
  tasks: 3
  commits: 6
  files: 7
  tests: "web 183 → 191 그린 (+8: SelectPill 4 · DurationPills 4 ... marker-svg 3 신규는 기존 파일 내)"
---

# Phase 28 Plan 02: 프레젠테이션 계약 3종 Summary

28-04(위저드)·28-05(기간 게이트)·28-06(번호 핀)이 탐색 없이 import할 **순수 프레젠테이션 계약 3종**을 TDD로 잠갔다 — 상태·mutation·DB 접촉 0.

## What Was Built

| 심볼 | 위치 | 소비자 |
|---|---|---|
| `SelectPill` (+`SelectPillProps`) | `apps/web/components/select-pill.tsx` (배럴 export) | step-where·step-who·DurationPills(28-04) · DaySelectSheet(28-05) |
| `DurationPills` (+`DURATION_OPTIONS`) | `apps/web/app/onboarding/_components/duration-pills.tsx` | step-dates(28-04) · DurationGateSheet(28-05) |
| `buildMarkerIconUrl({ label })` | `apps/web/lib/marker-svg.ts` (additive) | moa-map 번호 핀(28-06) |

### Task 1 — SelectPill (D-04 · UI-SPEC A-2) — RED `ef674db` → GREEN `4c9bace`

대형 stadium pill(높이 56px `min-h-14`, 터치 타깃 44px 상회) · `rounded-full` · `w-full`(2열 그리드 셀 채움) · 16px/600 중앙 정렬.

- **`Chip` 확장이 아닌 독립 컴포넌트** — Chip은 12px/500·px-3 py-1.5 소형이라 anatomy가 다르고, 변형을 얹으면 기존 Chip 사용처(채팅 칩·기타 칩)가 회귀한다. `chip.tsx` diff **0** (acceptance가 `git diff --stat` 빈 출력으로 강제 — T-28-06).
- **접근성 롤도 다르다:** `aria-pressed`(토글 버튼). Chip의 `aria-selected`가 아니다.
- 상태 클래스(UI-SPEC 상태표 verbatim): unselected `bg-neutral-100 border-transparent text-neutral-600` / selected `bg-white border-brand-500 text-brand-600`.
- **두 상태 모두 `border-2`**(unselected는 transparent) — 선택 시 레이아웃 시프트 0.
- 포커스 링은 `button.tsx` L43 idiom 그대로 복사. 누름 피드백 `active:scale-[0.98]`(모션 예산 내 신규 허용분).
- 색은 Tailwind 토큰 클래스만 — **신규 hex 리터럴 0**(HC-2).

### Task 2 — DurationPills (D-06) — RED `cea507f` → GREEN `c04fb17`

기간 pill 6종 **한 벌 구현**. `DURATION_OPTIONS`를 `as const`로 export — 기간 옵션의 단일 출처.

- 라벨은 레퍼런스 표기 그대로(박/일 사이 **공백 포함**): 당일치기(1) · 1박 2일(2) · 2박 3일(3) · 3박 4일(4) · 4박 5일(5) · 5박 6일(6).
- **상태를 소유하지 않는다** — `value: number | null` / `onChange(dayCount)`만. 부모(page.tsx 또는 게이트 시트)가 소유(Phase 24 D-02 구조 유지).
- `grid grid-cols-2 gap-2` 레이아웃, 각 셀은 `SelectPill`.
- `@moajoa/api`·`getSupabaseBrowser`·`useState` grep **0** — 순수 프레젠테이션, 공격면 없음(T-28-07).
- **28-05는 시트 쪽에 pill을 다시 만들지 말 것** — 이 컴포넌트를 그대로 재사용한다.

### Task 3 — marker-svg `label` 옵션 (D-16 전제 · HC-6) — RED `b08fd4c` → GREEN `f18ea0f`

`buildMarkerIconUrl` input에 **additive optional** `label?: number` 추가. 24-02 `fill` 확장 선례를 그대로 미러.

- **미전달 시 출력 바이트 동일** — 조건부 문자열 결합이 빈 문자열을 만든다(기존 `showQ` 분기와 동일 형태). 기존 10케이스 **무회귀**, 테스트 파일 삭제 라인 **0**.
- **label 우선:** `showQ = isLowConf && !hasLabel` — label과 물음표 배지가 같은 슬롯을 공유하므로 번호가 이긴다. 단 저신뢰 투명도(`fill-opacity="0.45"`)는 **유지** — label은 배지만 대체하고 신뢰도 시각은 건드리지 않는다.
- **인젝션 계약(T-28-05 / HC-6, T-24-04 승계):** 삽입값은 `String(input.label)`만. `label`의 타입이 `number`인 것 자체가 강제 수단 — 장소명·사용자 문자열이 SVG에 도달할 경로가 타입 레벨에서 없다.

## Deviations from Plan

**None — plan 원안 그대로.**

1건의 표현 조정(deviation 아님): `select-pill.tsx` doc 주석의 `min-h-14` 리터럴이 acceptance grep(`grep -c 'min-h-14'` → 1)을 2로 오탐시켜 주석을 "높이 56px"로 재서술(의미 보존). 24-05/26-02 선례와 동일 패턴.

## Verification

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test -- --run` 전 스위트 | **191 그린** (27 파일, 기존 케이스 무회귀) |
| `pnpm --filter @moajoa/web typecheck` | exit 0 |
| `git diff --stat -- apps/ios apps/web/components/chip.tsx apps/web/components/add-content-tabs.tsx` | **빈 출력** (SC-6 iOS diff 0 · HC-3 · A-2) |
| 신규 파일 hex 색 리터럴 | **0** (HC-2) |
| `.js` 워크스페이스 import | 0 |
| Task별 acceptance grep | 전종 통과 (aria-pressed·min-h-14=1·border-brand-500·text-brand-600·DURATION_OPTIONS·grid-cols-2·`label?: number`=1·`String(input.label)`=1·테스트 삭제 라인 0) |

TDD 게이트: 3사이클 전부 RED(behavior 실패, 임포트 에러 아님) → GREEN. DurationPills는 렌더 스텁을 먼저 두어 RED가 behavior로 실패하도록 함(25-04 선례).

## Success Criteria

- [x] SC-1(부분): 레퍼런스 pill 시각(선택/비선택)이 재사용 가능한 컴포넌트로 존재한다
- [x] SC-6: iOS diff 0
- [x] 28-04·28-05·28-06이 import할 3개 계약이 잠겼다

## Known Stubs

없음 — 3개 계약 모두 완전 구현. 소비자 배선(위저드 리스타일·게이트 시트·번호 핀 지도)은 설계대로 28-04/05/06 몫이다.

## Self-Check: PASSED

- 생성/수정 파일 7종 전부 디스크에 존재
- 커밋 6종(`ef674db` `4c9bace` `cea507f` `c04fb17` `b08fd4c` `f18ea0f`) 전부 git log에 존재
- 의도치 않은 파일 삭제 0
