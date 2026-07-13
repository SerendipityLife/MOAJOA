---
phase: 28-add-trip-redesign-ai
plan: 06
subsystem: web-plan-hub
tags: [moa-island, plan-wiring, d-21, d-16, d-19, d-20, tdd, checkpoint-pending]
status: complete

requires:
  - "28-01 — trips.day_count (0031, 로컬·원격 적용 완료)"
  - "28-03 — pinned_placements 계약 · GeneratePlanRequestInput · moveToDay(is_anchor:true) · EF day_count fallback"
  - "28-05 — PlanSection · DurationGateSheet · DaySelectSheet · PlaceList.onAddToPlan · renderPool seam"
provides:
  - "MoaIslandProps.initialPlan — RSC seed (getPlanByTrip)"
  - "MoaMapProps.labels? / MoaMapProps.fitKey? — additive 번호 핀 + 강제 fitBounds"
  - "AddSheetProps.planExists? / dayCount? / onPlacePickedForDay? — D-19/D-20 분기"
  - "moa-island plan 상태 허브 — 생성·진행 구독·mutation·Day↔지도"
  - "**D-21 루프 클로저** — is_anchor 항목 → pinned_placements 수집 배선 (클라이언트 절반)"
affects:
  - "Phase 28 최종 게이트 — SC-4/SC-5 코드 완결. **라이브 검증은 EF 재배포(Task 4) 이후**"

tech-stack:
  added: []   # 신규 npm 패키지 0
  patterns:
    - "임시 broadcast 채널 — 진행 표시는 plan:{tripId}를 생성 시에만 열고 done/error에서 닫는다(기존 moa 채널에 사후 바인딩 금지, #1917)"
    - "in-flight 가드는 ref — setState는 배치라 같은 tick 연타를 못 막는다(유료 API 이중 지출 방어)"
    - "additive optional prop — 미전달 시 기존 동작 바이트 동일(기존 케이스가 무회귀 앵커)"
    - "삭제 후 재insert > in-place update — 계약 마커(is_anchor)를 세우는 경로를 택한다"
    - "children 주입 — 시트 셸을 수정하지 않고 섹션을 얹는다(제스처 소유권 보존)"

key-files:
  created:
    - apps/web/__tests__/moa-map.test.tsx
  modified:
    - apps/web/app/moa/[id]/page.tsx
    - apps/web/app/moa/[id]/_components/moa-map.tsx
    - apps/web/app/moa/[id]/_components/moa-island.tsx
    - apps/web/app/moa/[id]/_components/add-sheet.tsx
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/__tests__/moa-island.test.tsx
    - apps/web/__tests__/add-sheet.test.tsx

decisions:
  - "Day 이동(onMoveItemToDay)은 reorderPlanItem이 아니라 moveToPool → moveToDay(삭제 후 재insert)로 구현 — reorderPlanItem은 is_anchor를 세우지 않아 AI가 놓은 항목을 손으로 옮겨도 고정 마커가 안 생기고, 그러면 다음 재생성에서 그 이동이 조용히 사라진다(D-21 루프 절단)"
  - "moa-map에 마커 아이콘 diff(setIcon) 추가 — 재생성 후 같은 Day에 같은 place가 남되 sort_order만 바뀌면 마커가 이미 존재해 번호가 stale해진다. 마커 재생성 없이 아이콘만 교체(깜빡임 0)"
  - "생성 실패 메시지를 토스트로도 띄운다 — PlanSection 상태 E는 고정 카피('일정을 만들지 못했어요')만 렌더하므로 '자동 배치할 장소가 없어요' 분기를 노출할 자리가 거기밖에 없다(plan-section 무수정 유지)"
  - "게스트(/t/[slug]) 표면에는 PlanSection을 마운트하지 않는다 — hideHostControls 게이트 + initialPlan:null seed(T-28-28)"
  - "moa-map.test.tsx 신설 — labels/fitKey 계약은 MoaMap이 mock된 island 테스트로 검증 불가"

metrics:
  duration: ~35m
  completed: 2026-07-13
  tasks: 3 (+ Task 4 = blocking 체크포인트, 사용자 대기)
  commits: 6
  files: 8
  tests: "web 241 → 267 그린 (+26: moa-map 6 · moa-island 15 · add-sheet 5)"
---

# Phase 28 Plan 06: plan 허브 배선 + Day↔지도 연동 Summary

28-05가 만든 `PlanSection`을 `/moa/[id]`에 **살아 있게 배선**했다. 그리고 **이 플랜의 존재 이유였던 D-21 루프를 닫았다** — 28-03이 EF 측 강제를, 28-05가 D-25 카피를 각각 완성했지만 **클라이언트가 `is_anchor` 항목에서 `{place_id, day_index}`를 수집해 보내는 절반이 비어 있었다.** 그 배선이 없는 채로 재생성하면 `pinned_placements: []`가 나가서 "직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요"가 **거짓말**이 된다. 이제 참이다 — **단, EF가 재배포된 라이브에서만** (Task 4 체크포인트).

## What Was Built

| 심볼 | 위치 | 소비자 |
|---|---|---|
| `MoaIslandProps.initialPlan` | `page.tsx` RSC seed → island | [일정] 영역 |
| `MoaMapProps.labels?` · `fitKey?` | `_components/moa-map.tsx` (additive) | island Day 뷰 |
| plan 상태 허브(생성·진행·mutation) | `_components/moa-island.tsx` | PlanSection · AddSheet |
| `AddSheetProps.planExists?` · `dayCount?` · `onPlacePickedForDay?` | `_components/add-sheet.tsx` (additive) | island D-19/D-20 |

### Task 1 — RSC plan seed + 번호 핀·fitKey — RED `6cc9968` → GREEN `2e46831`

- **`page.tsx`:** `Promise.all`에 `getPlanByTrip` 추가 → `initialPlan`. **이게 없으면 [일정] 영역이 영원히 빈 상태다**(Pitfall 11) — island은 plan을 스스로 조회하지 않고 이 seed로 시작한다. auth 게이트·`notFound`·anon 키 경로는 **무수정**, `'use client'` **0**(RSC 유지).
- **`moa-map` additive 2종:**
  - `labels?: Record<string, number>` — 번호 라벨 + **brand 고정색**(A-14: 추가자 색 위에 번호를 얹으면 대비가 무너져 번호가 안 읽힌다).
  - `fitKey?` — **기존 "장소 수 증가 시 fitBounds" 경로는 한 줄도 건드리지 않았다.** Day 1(5핀) → Day 2(3핀)처럼 핀이 **줄면** 기존 조건이 발동하지 않아 그날 핀이 화면 밖에 남는 실측 결함(Pitfall 4)만 이 키로 메운다.
  - **미전달 시 기존과 바이트 동일** — 기존 무회귀 케이스(Map 1·4·5)가 앵커다. `new g.Map` **1회**(재init 0).

### Task 2 — moa-island plan 허브 — RED `f7a6801` → GREEN `1fa716f`

**D-21 루프 클로저 (이 플랜의 핵심):**
```
moveToDay(is_anchor:true)  →  island이 is_anchor 항목에서 {place_id, day_index} 수집
   →  generatePlan(pinned_placements + anchor_place_ids)  →  EF 프롬프트 제약 + enforcePinnedPlacements 사후 강제
   →  EF가 is_anchor:true로 재기록  →  2회차·3회차 재생성에도 고정이 산다
```
`pinned_placements`("어느 Day에")와 `anchor_place_ids`("반드시 배치")를 **둘 다** 보낸다 — 전자만 보내면 배치 자체가 누락될 수 있고, 후자만 보내면 Day가 흩어진다. `day_count`는 **보내지 않는다**(T-28-08 — 서버가 `trips`에서 읽는다).

**연타 가드는 `useRef`다.** `setState`는 비동기 배치라 같은 tick의 연타를 막지 못한다 — `generatingRef`가 단일 진실이어야 유료 API(Claude + Routes) 이중 지출이 실제로 차단된다(T-28-23). 이동수단 토글도 **저장만 하고 자동 재생성하지 않는다**(A-10).

**진행 표시는 `plan:{tripId}` 별도 임시 채널이다.** 기존 moa 채널에 바인딩을 추가하면 안 된다 — postgres_changes는 `subscribe()` 시점에 negotiate되므로 사후 추가가 **무음 no-op**이 된다(#1917, Phase 26이 겪은 함정). 생성 트리거에서 열고 `done`/`error` + `finally` + 언마운트에서 닫는다.

**D-13 게이트는 fail-closed.** `updateTrip(day_count)` 성공 시에만 생성으로 넘어간다. `trips` UPDATE RLS는 owner 전용(0016)이라 editor의 저장은 실패하는데, 이를 조용히 넘기면 "기간을 골랐는데 아무 일도 안 일어남"이 된다 → 에러 토스트 후 **생성하지 않는다**(T-28-25).

**Day ↔ 지도(D-16):** 플랜이 있으면 선택 Day의 핀만 + `labels`(sort_order+1) + `fitKey`(selectedDay). **(0,0) 좌표는 지도에서 제외**(대서양 핀 방지, Pitfall 3 — 사유는 28-05가 풀 행에 넣은 `위치 정보 없음` 캡션이 설명한다). 플랜이 없으면 셋 다 미전달 = 기존 전체 뷰·추가자 색 핀 그대로.

**PlanSection은 `PlaceSheet`의 children으로 주입** — `place-sheet.tsx` **diff 0**(HC-5). 금지 제스처 핸들러 **0건**. 신규 탭·라우트 **0**.

### Task 3 — add-sheet Day 배치 분기 — RED `b86653b` → GREEN `afe32ce`

- **D-19(플랜 없음):** Day를 **묻지 않는다.** 이건 UX 취향이 아니라 물리적 제약이다 — 플랜이 없으면 `moveToDay`가 요구하는 `plan_id`가 존재하지 않는다. 대신 **D-24 토스트**가 그 자리에서 규칙을 알려준다: `지도에 담았어요 — 일정 만들기를 누르면 며칠차에 넣을지 AI가 정해줘요`.
- **D-20(플랜 있음):** `DaySelectSheet` → `onPlacePickedForDay(placeId, dayIndex)` → island이 `moveToDay` 실행 + `Day {N}에 넣었어요`. **'아직 모르겠다' → 배치 안 하고 풀 잔류**(즉시 재생성·자동 append 없음).
- **링크 경로 무수정** — 추출이 비동기라 담는 시점에 장소가 아직 없다. **`AddContentTabs` diff 0**(HC-3/SC-3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `moa-map` 계약을 검증할 테스트 자리가 없었다 → `moa-map.test.tsx` 신설**

- **Found during:** Task 1
- **Issue:** 플랜의 Task 1 `<files>`는 테스트 파일로 `moa-island.test.tsx`만 지정했는데, 그 파일은 **`MoaMap`을 mock한다.** `<behavior>`가 요구한 4개 단언(labels 미전달 시 아이콘 URL 동일 · labels 전달 시 번호 라벨 · fitKey 변경 시 fitBounds · 지도 인스턴스 1회 생성)은 실물 `MoaMap`을 렌더해야 검증 가능하다 — mock된 컴포넌트로는 **구조적으로 불가능**하다.
- **Fix:** `apps/web/__tests__/moa-map.test.tsx` 신설(google.maps 스텁 6케이스). island 테스트는 원래 관심사(**배선** — places/labels/fitKey props 주입)만 단언한다.
- **Commit:** `6cc9968` / `2e46831`

**2. [Rule 1 - Bug] 재생성 후 같은 Day에 남은 장소의 번호가 stale해진다 → 마커 아이콘 diff 추가**

- **Found during:** Task 1
- **Issue:** `syncMarkers`는 **새로 등장한 place만** 마커를 만든다(깜빡임 0 계약). 재생성 시 `selectedDay`가 0으로 리셋되는데, Day 1에 같은 장소가 남되 **`sort_order`만 바뀌면** 마커가 이미 존재하므로 아이콘이 갱신되지 않아 **지도 번호와 타임라인 번호가 어긋난다**(UI-SPEC "지도 번호 핀 = 타임라인 배지와 같은 값" 위반).
- **Fix:** 마커별 아이콘 URL을 ref에 기록하고 달라졌을 때만 `setIcon` — 마커 재생성 없이 아이콘만 교체. `labels` 미전달 시 URL이 기존과 동일해 `setIcon` 호출 **0**(무회귀).
- **Commit:** `2e46831`

**3. [Rule 2 - Missing critical] `guest-surface`가 `initialPlan`을 seed하지 않아 타입이 깨졌다 → `null` + PlanSection 게이트**

- **Found during:** Task 1 typecheck
- **Issue:** `/t/[slug]` 게스트 표면이 `MoaIslandProps`를 클라이언트에서 조립하는데 신규 required prop이 빠졌다. 단순히 채우기만 하면 **게스트에게 [일정] 편집 표면이 노출된다**(T-28-28).
- **Fix:** `initialPlan: null` + island이 `hideHostControls`일 때 `PlanSection`을 **마운트하지 않는다**. UI 게이트 + DB `can_edit_trip` RLS(0017) **심층방어 2겹**. 전용 테스트(Test 34).
- **Commit:** `2e46831` / `1fa716f`

**4. [Rule 1 - Bug] `reorderPlanItem`으로 Day를 옮기면 D-21 루프가 끊긴다 → 삭제 후 재insert 경로 선택**

- **Found during:** Task 2
- **Issue:** 플랜은 Day 이동 구현을 "`reorderPlanItem` — 실행자 재량이되 `is_anchor:true`가 유지되는 경로"로 열어뒀다. 그런데 `reorderPlanItem`은 `day_index`/`sort_order`만 UPDATE하고 **`is_anchor`를 세우지 않는다.** AI가 놓은 항목(`is_anchor:false`)을 사용자가 손으로 옮기면 고정 마커가 안 생기고, **다음 재생성에서 그 이동이 조용히 사라진다.**
- **Fix:** `moveToPool(itemId)` → `moveToDay(...)`(삭제 후 재insert). `moveToDay`가 `is_anchor:true`를 보장한다(28-03). 전용 테스트(Test 29).
- **Commit:** `1fa716f`

### 플랜 본문 판단 (deviation 아님)

**5. 생성 실패 분기 카피를 토스트로 노출.** 플랜은 "서버가 배치 가능한 장소가 없다고 답하면 `자동 배치할 장소가 없어요`"를 요구하지만, 28-05의 `PlanSection` 상태 E는 **고정 카피(`일정을 만들지 못했어요`)만 렌더**하고 `error` 문자열을 표시하지 않는다. `plan-section.tsx`는 이 플랜의 `<files>`에 없다(무수정 유지) → 분기 메시지를 **토스트로 병행 노출**하고 `planError`는 상태 E 진입 플래그로 쓴다.

### Acceptance grep 오탐 조정 (28-05 선례와 동일)

- `getPlanByTrip` in `page.tsx` = **2**(acceptance 1) — import 라인 + 호출 라인. 상수/함수를 import해서 쓰는 한 **1은 구조적으로 불가능**하다.
- `PLAN_STEP_KO` in `moa-island.tsx` = **0**(acceptance ≥1) — 진행 카피의 한국어 매핑은 **`PlanSection`이 소유한다**(28-05). island은 raw `PlanStepType`만 넘긴다. island에 `PLAN_STEP_KO`를 넣으면 **매핑이 두 곳에 중복**된다. 이 criterion의 의도("진행 카피는 core 상수 — 신규 문자열 금지")는 충족: island의 하드코딩 진행 문자열 **0건**.

## Verification

| 게이트 | 결과 |
|---|---|
| `pnpm --filter @moajoa/web test:run` 전 스위트 | **267 그린** (31 파일) — 241 → 267, 기존 케이스 무회귀 |
| ├ `moa-map` (신규 파일) | **6 그린** |
| ├ `moa-island` | **34 그린** (기존 19 + 신규 15), 테스트 케이스 삭제 **0** |
| └ `add-sheet` | **10 그린** (기존 **5** + 신규 5), 삭제 라인 **0** |
| `pnpm --filter @moajoa/core test` | **192 그린** |
| `pnpm --filter @moajoa/api test` | **112 그린** |
| `pnpm --filter @moajoa/ios test` | **128 그린** (코드 diff 0인 채로) |
| `deno task --cwd supabase/functions/generate-plan test` | **31 그린** |
| `deno check` EF index.ts | **exit 0** |
| `pnpm typecheck` (전 워크스페이스) | **exit 0** |
| `pnpm --filter @moajoa/web build` | **PASS** |
| **SC-6** `git diff --stat -- apps/ios` | **빈 출력** |
| **SC-6** 기존 마이그레이션 0016~0030 diff | **빈 출력** (신규 0건) |
| **SC-3/HC-3** `add-content-tabs.tsx` diff | **빈 출력** |
| **HC-5** `place-sheet.tsx` diff | **빈 출력** · 금지 제스처 핸들러 **0건** |
| **HC-2** 수정 파일 hex 색 리터럴 | **0** (`#1917`은 이슈 참조 주석) |
| **§4.5** `.js` 워크스페이스 import | **0** |
| Task별 acceptance grep | `initialPlan`=1 · `'use client'`(page)=0 · `fitKey`≥2 · `labels`≥2 · `new g.Map`=**1** · `planChannelName`=1(+import) · `pinned_placements`=1(+주석) · `removeChannel`=2 · `table: 'plan_items'`=**0** · `<PlanSection`=1 · D-24 카피=1 · `DaySelectSheet`≥1 |

TDD 게이트: 3사이클 전부 RED(`test(...)`) → GREEN(`feat(...)`) 커밋 쌍 존재. 세 RED 모두 **behavior로 실패**(import 에러 아님).

## Success Criteria

- [x] SC-4(코드): '일정 만들기' → 생성·진행 표시·Day 탭·번호 타임라인·번호 핀 지도가 전부 배선됐다 — **라이브 검증은 Task 4 배포 이후**
- [x] SC-5(코드): 검색 추가 시 플랜이 있으면 며칠차를 묻고, '모르겠다'면 풀에 남기며, 플랜이 없으면 D-24 카피로 규칙을 안내한다
- [x] **D-21 루프 클로저** — `is_anchor` → `pinned_placements` 수집 배선 완료. STATE.md 블로커 해소
- [x] SC-6: `apps/ios` diff 0 · 기존 마이그레이션 diff 0

## Threat Mitigations

| Threat ID | 상태 |
|---|---|
| T-28-23 (DoS 비용 — 재생성 연타) | **mitigated** — `generatingRef`(ref, not state)가 진입 즉시 return. 이동수단 토글은 저장만·자동 재생성 없음(A-10). 전용 테스트(Test 20·30) |
| T-28-24 (Tampering — pinned 클라 수집값) | accepted — EF가 placeable 집합 교집합 + day_index 클램프(28-03). 최대 피해 = 사용자가 자기 플랜을 재배치하는 것(`moveToDay`로 이미 가능) — 신규 권한 표면 0 |
| T-28-25 (EoP — editor의 day_count 저장) | **mitigated** — `updateTrip` 실패 시 에러 토스트 + **생성 미실행**(fail-closed, 전용 테스트 Test 27). UI 게이트(A-9, 28-05) + `trips` UPDATE RLS owner-only(0016) 심층방어 |
| T-28-26 (EoP — plan_items 쓰기) | accepted (무변경) — `can_edit_trip` RLS(0017)가 서버 게이트. 클라 추가 검사 없음(T-18-17 idiom) |
| T-28-27 (Info disclosure — 진행 broadcast) | accepted — `plan:{trip_id}`는 step·progress_pct만 싣는다. 생성 중에만 열고 done/error·finally·언마운트에서 정리 |
| T-28-28 (Spoofing — 게스트의 플랜 접근) | **mitigated** — RSC `notFound()` 게이트(무변경) + 게스트 표면(`/t/[slug]`)에 **PlanSection 미마운트** + `initialPlan: null` seed(전용 테스트 Test 34) |

## Known Stubs

**없음** — 코드는 완결. 다만 **라이브 반영에는 배포 1건이 남아 있다**(아래).

## ⚠ Pending — Task 4: generate-plan EF 재배포 (blocking human-action)

**코드 머지만으로는 프로덕션 EF가 갱신되지 않는다.** 유닛 테스트·타입체크·빌드는 **배포 없이도 전부 그린**이므로, 이 게이트가 유일한 검출 지점이다.

자동 구간(Claude 실행 완료):
- `deno task --cwd supabase/functions/generate-plan test` → **31 그린**
- `deno check` → **exit 0**
- 28-03의 EF 변경분 실재 확인 → `index.ts` +43 · `claude.ts` +94 · `claude.test.ts` +105

human-action 구간(**사용자**): `supabase functions deploy generate-plan`

**미배포 시 라이브 증상:**
- 날짜 미정 모아 → '일정 만들기' → **Day가 1개만** (고른 기간 pill이 무시된 것처럼 보인다) → **SC-4 라이브 실패**
- '일정 다시 만들기' → 손으로 옮긴 장소가 날아간다 → **D-25 카피가 거짓** (구 EF는 `pinned_placements`를 모른다)

**배포 결과 기록:** _(사용자 resume-signal 수신 후 갱신)_ — 현재 **미배포 / 스모크 미실행**.

## Self-Check: PASSED

- 생성 1종 · 수정 7종 = 8개 파일 전부 디스크에 존재
- 커밋 6종(`6cc9968` `2e46831` `f7a6801` `1fa716f` `b86653b` `afe32ce`) 전부 git log에 존재
- 의도치 않은 파일 삭제 **0** · `apps/ios`·`place-sheet.tsx`·`add-content-tabs.tsx`·기존 마이그레이션 diff **0**
