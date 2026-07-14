---
phase: quick-260714-kk6
plan: 01
subsystem: web
tags: [web, navigation, ux, radix, moa-switcher]
status: complete
requires:
  - "@moajoa/api listMyTrips (updated_at desc)"
  - "@/components dropdown-menu (Radix, 기설치)"
provides:
  - "MoaSwitcher — 지도 좌상단 인플레이스 모아 전환 pill"
  - "/moa = 최근 모아 리다이렉트 허브"
affects:
  - "apps/web/app/moa/[id] (지도 화면 좌상단)"
  - "apps/web/app/moa (리스트 화면 소멸)"
tech-stack:
  added: []
  patterns:
    - "Radix DropdownMenu 앱 코드 최초 사용처 (지금까진 barrel export만)"
    - "무거운 자식은 vi.mock 모듈 스텁으로 격리 (moa-island.test 확립 패턴)"
key-files:
  created:
    - apps/web/app/moa/[id]/_components/moa-switcher.tsx
    - apps/web/__tests__/moa-switcher.test.tsx
  modified:
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/app/moa/[id]/page.tsx
    - apps/web/app/moa/page.tsx
    - apps/web/__tests__/moa-island.test.tsx
decisions:
  - "moas prop을 옵셔널로 — 게스트(guest-surface.tsx)가 미전달이라 그 파일 diff 0, 정적 pill로 자연 폴백"
  - "/moa 리스트 UI 전면 삭제 후 라우트는 유지 — 루트·/login·/auth/callback·bottom-nav가 전부 이 URL로 보냄"
  - "listMyTripsWithPreview는 삭제하지 않음 (내 변경의 고아가 아님, CLAUDE.md §3.3)"
metrics:
  duration: ~25m
  completed: 2026-07-14
  tasks: 3
  commits: 3
  files_changed: 6
---

# Quick 260714-kk6: 모아 스위처 드롭다운 Summary

지도 좌상단의 "뒤로 → /moa 리스트" 진입을 **인플레이스 모아 스위처 드롭다운**으로 교체하고,
모아 리스트 페이지를 리다이렉트 허브로 축소했다. 이제 모아 전환에 지도 언마운트가 없다.

## What Was Built

| Task | 산출 | Commit |
|------|------|--------|
| 1 | `moa-switcher.tsx` — `{제목} ▾` pill + Radix 드롭다운(2분기) | `2336288` |
| 2 | moa-island 좌상단 교체 + `/moa/[id]` moas seed + `/moa` 리다이렉트 허브 | `dbcb8cc` |
| 3 | moa-switcher 5케이스 신규 + moa-island 스텁·회귀 가드 1케이스 | `2eb7eeb` |

**동작:**
- `/moa/[id]` 좌상단 = `{현재 모아 이름} ▾` pill (뒤로 chevron 소멸). 누르면 내 모아 목록이
  pill 바로 아래(`align="start"`, `sideOffset=8`)로 열린다.
- 다른 모아 선택 → `router.push('/moa/{id}')`. 현재 모아 행은 `Check` + `aria-current="true"`,
  클릭해도 라우팅 없이 닫힌다.
- 드롭다운 하단: `새 모아 만들기`(/onboarding) · `둘러보기`(/discover) — 리스트 페이지 소멸로
  끊길 뻔한 `/discover` 진입 보전 (`/discover` 라우트 실재 확인).
- 게스트 `/t/[slug]`: `guest-surface.tsx`가 `moas`를 넘기지 않으므로 **정적 제목 pill**만
  (드롭다운 미렌더, 남의 모아 제목 노출 0 — T-KK6-01). 그 파일 **diff 0**.
- `/moa`: 리스트 마크업 전면 삭제 → 최근 모아(`listMyTrips` updated_at desc `[0]`) 지도로
  리다이렉트, 모아 0개면 `/onboarding`.

## Verification (실측 — 정직 기록)

| 게이트 | 명령 | 결과 |
|--------|------|------|
| 테스트 | `pnpm --filter ./apps/web test:run` | ✅ **exit 0 — 32 파일 / 273 테스트 전부 통과** (신규 6: switcher 5 + island 1, 기존 267 무회귀) |
| 타입 | `pnpm --filter ./apps/web typecheck` | ✅ **exit 0** |
| 린트 | `pnpm --filter ./apps/web lint` | ❌ **exit 1 — 통과 못 함. 단, 이 변경과 무관한 사전 존재 실패** (아래 참조) |
| 금지 경로 | `git diff --name-only eea5cc3..HEAD -- apps/ios apps/web/app/t place-sheet.tsx bottom-nav.tsx supabase` | ✅ **빈 출력** — iOS·게스트·PlaceSheet(HC-5)·bottom-nav·마이그레이션 전부 diff 0 |
| `.js` import | 워크스페이스 import 확장자 grep | ✅ **0건** |

### ⚠️ lint 실패 정직 보고 (통과라고 쓰지 않음)

`pnpm --filter ./apps/web lint` 는 **exit 1**이다. 통과시키지 못했다.

원인은 내 diff가 아니다: `next lint`가 소스를 한 줄도 읽기 전에 **설정 탐색 단계에서** 죽는다 —
`apps/web`은 `eslint@^9` + `eslint-config-next@^15`를 devDependency로 선언해놓고 **ESLint 설정
파일이 레포 어디에도 없다**. `git log --all -- '.eslintrc*' 'eslint.config.*'` → **0 커밋**
(한 번도 존재한 적 없음). 그래서 비대화형 셸에서 `? How would you like to configure ESLint?`
프롬프트에 걸려 abort한다. 이번 태스크가 만진 6개 파일 중 lint 설정 파일은 0개다.

**고치지 않았다** — SCOPE BOUNDARY(현재 태스크가 유발하지 않은 사전 실패는 손대지 않음) +
CLAUDE.md §3.2/§3.3(요청 범위 밖 설정 추가 금지). ESLint 설정을 새로 만드는 건 별도 결정이
필요한 일이라 `deferred-items.md`에 옵션 2개(CLI 마이그레이션 / lint 스크립트 제거)와 함께 기록했다.

참고: 레포는 Prettier 기준으로도 baseline이 clean하지 않다(`moa-island.tsx`·`place-list.tsx`·
`moa-chat.test.tsx`가 이미 warn) — 즉 Prettier도 현재 강제 게이트가 아니다. 같은 결정에 묶는 걸 권한다.

## Deviations from Plan

**None** — plan 원안 그대로 실행. 자동 수정(Rule 1~3) 발동 0건.

플랜이 `<action>`에 적어둔 폴백("만약 typecheck가 반환형으로 불평하면 마지막 줄만
`return redirect(...)`로")은 **불필요했다** — `redirect()`가 `never`를 반환해 함수가
`Promise<never>`로 추론되고 Next의 페이지 반환 계약을 그대로 만족했다(typecheck exit 0).

## Threat Flags

없음. 신규 의존성 0(`@radix-ui/react-dropdown-menu`·`lucide-react` 기설치), 신규 네트워크
엔드포인트·인증 경로·스키마 변경 0.

- **T-KK6-01 (정보 노출)** mitigate 이행 확인: `listMyTrips`는 trips SELECT RLS를 통과한 내
  trip만 반환하고, 게스트 경로는 `moas` 자체를 안 넘겨 목록이 렌더되지 않는다.
- **T-KK6-02 (권한 상승)** accept 유지: `/moa/[id]` RSC가 `getTrip`(RLS) null → `notFound()`로
  이미 fail-closed. 클라이언트 내비게이션은 권한이 아니다.

## Known Stubs

없음.

## Self-Check: PASSED

- `apps/web/app/moa/[id]/_components/moa-switcher.tsx` — FOUND
- `apps/web/__tests__/moa-switcher.test.tsx` — FOUND
- commit `2336288` / `dbcb8cc` / `2eb7eeb` — 전부 FOUND (`git log`)
- 검증 결과는 실제 실행 출력 그대로 기록 (lint 실패를 통과로 쓰지 않음)
