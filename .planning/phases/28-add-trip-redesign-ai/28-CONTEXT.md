# Phase 28: Add-Trip Redesign (트리플 룩 위저드 + 웹 AI 일정) - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

웹 `apps/web`의 `/onboarding` 추가하기 위저드를 `references/add_trip/`(트리플 앱 스크린샷) 레퍼런스와 동일한 UI/UX로 개편하고, **Phase 18에서 이미 구축한** AI 일정 엔진(`generate-plan` Edge Function + `plans`/`plan_items` + `@moajoa/api` 래퍼)을 웹 지도탭의 결과 화면(Day 그룹핑·번호 타임라인)으로 연결한다. 링크 붙여넣기·장소 검색 입력 기능은 기존 `AddContentTabs`를 그대로 재사용해 유지한다.

**In scope:**
- `/onboarding` 스텝 화면 리스타일(뒤로가기 + `N/총` 카운터, 중앙 아이콘, 큰 타이틀+서브카피, 2열 pill, 하단 고정 CTA)
- 날짜 스텝 → 기간 pill(당일치기~5박6일) + 그 이상/정확 날짜는 별도 버튼 → 기존 캘린더
- `trips.day_count` 컬럼 신설(0030) + core 스키마 + typegen + `generate-plan` EF fallback
- `/moa/[id]` place-sheet에 Day 그룹핑 결과 화면 + '일정 만들기'/재생성/이동수단 토글/공유 버튼
- 링크 유무 분기 + 장소 검색 추가 흐름 + 4곳 가이드 카피

**Out of scope (별도 phase):**
- 결과 화면에서 Day 간 드래그 재배치 UI(placed↔placed) — Phase 18 D-13은 iOS 몫, 웹 드래그는 미래
- AI 플랜 품질 eval(동선 합리성 채점)
- iOS 코드 일체 (v2.1 동결)

</domain>

<decisions>
## Implementation Decisions

### 위저드 스텝 리스타일 (레퍼런스 IMG_2918~2921)
- **D-01 히어로 인트로 생략:** IMG_2917 인트로 화면(`바로 추천받기`)은 만들지 않는다. `/onboarding` 진입 = 곧장 스텝 1. Phase 24 D-01/D-02(진입 분기·단일 라우트) 유지.
- **D-02 스텝 헤더:** 현 점 인디케이터를 **뒤로가기 chevron(좌) + `N/총` 카운터(우)** 로 교체. 레퍼런스는 우상단에 `1/5` 식 숫자. 총 스텝 수는 현 4단계(어디로→언제→누구랑→봐둔 곳) 기준.
- **D-03 스텝 본문:** 중앙 이모지/아이콘 → 큰 굵은 2줄 타이틀 → 회색 서브카피 → 선택지. 좌측정렬 `text-lg` 타이틀을 레퍼런스식 중앙 큰 타이틀로.
- **D-04 선택지 pill:** 도시·기간·동행 선택지를 **2열 큰 pill 그리드**로. 선택 상태 = 흰 배경 + 파란 테두리 + 파란 텍스트(레퍼런스 IMG_2920 '친구와'/'연인과'). 현 `Chip`(stadium, brand tint)을 확장하거나 새 selected 변형 — 플래너 재량.
- **D-05 하단 CTA:** 풀폭 `다음` 고정. **비활성 = 연한 파랑 bg + 흰 글씨**(레퍼런스 IMG_2918/2921), 활성 = 진한 파랑. 현 `disabled` opacity 방식과 다름 — 연한 파랑 채움 필요.

### 날짜 스텝 → 기간 pill + day_count
- **D-06 기간 pill:** 캘린더 range를 1차 UI로 두던 것을 **기간 pill 6종(당일치기·1박2일·2박3일·3박4일·4박5일·5박6일)** 으로 교체. 레퍼런스 IMG_2919와 동일.
- **D-07 정확한 날짜:** 5박6일 초과이거나 정확한 날짜를 원하면 **별도 버튼 → 기존 캘린더**(react-day-picker) 범위 선택. Phase 24 D-06 캘린더는 폐기하지 않고 이 진입점 뒤로 이동.
- **D-08 day_count 저장:** `trips.day_count` INT nullable 신설 — **마이그레이션 append-only 새 번호 `0030`**. 기간 pill 선택 시 저장(당일치기=1, 1박2일=2, …). 캘린더로 실제 범위를 정하면 start/end_date 저장(day_count는 null 또는 파생 — 플래너가 우선순위 확정). `packages/core` 스키마와 **짝지어 변경**, `pnpm supabase:types` 재생성.
- **D-09 EF fallback:** `generate-plan` EF의 `computeDayCount`([supabase/functions/generate-plan/index.ts](../../../supabase/functions/generate-plan/index.ts) L289-297)에 `dayCount = trip.day_count ?? computeDayCount(start,end)` fallback 추가. 현재는 날짜 null이면 무조건 1일 → day_count 있으면 그 값 우선. **⚠ EF의 RequestSchema/select에 `day_count` 노출 필요** (현 select는 `id, owner_id, start_date, end_date`만).

### 입력 기능 유지 (Phase 24 D-11 재사용)
- **D-10 AddContentTabs 재사용:** 링크 붙여넣기 / 장소 검색은 [apps/web/components/add-content-tabs.tsx](../../../apps/web/components/add-content-tabs.tsx)를 **그대로** 사용. 탭 자체 재구현 금지(24-04 doc 주석 명시). 링크→`addLink`+`triggerExtraction`, 장소→`resolve-place` EF + `addManualPlace`, 전부 기존 계약.

### 위저드→보드 흐름 & AI 일정 트리거 (Phase 18 D-01 미러)
- **D-11 위저드 완료:** 지금처럼 4단계 후 `/moa/{id}` 지도 보드로 이동(Phase 24 D-03). AI 일정 자동 생성 안 함.
- **D-12 명시적 버튼 생성:** AI 일정은 place-sheet **[일정] 영역 상단의 '일정 만들기' 버튼**으로 사용자가 트리거(Phase 18 D-01·D-02와 동일). 그 시점 trip 전체 places로 `generatePlan` 호출. 재생성도 같은 자리.
- **D-13 기간 미정 게이트:** day_count·start_date 둘 다 null인 모아에서 '일정 만들기'를 누르면 **기간 pill부터 물어본다**(위저드 기간 스텝 컴포넌트 재사용, 시트/모달). 기간 선택 → day_count 저장 → 생성. 1일 기본 생성 안 함.
- **D-14 추출 대기 게이트:** 링크 추출이 도는 중(장소 미확정)이면 '일정 만들기' **비활성 + 진행 표시**('영상에서 장소를 찾고 있어요 · N개 분석 중', Phase 24 D-13 '분석 중…' 패턴 재사용). 추출 완료 시 활성. 절반짜리 장소로 비용 드는 재생성 방지.

### 결과 화면 (place-sheet Day 그룹핑) — 레퍼런스 IMG_2922~2925
- **D-15 위치:** 별도 라우트/바텀시트 신설이 아니라 **기존 place-sheet가 Day 그룹을 갖는다**. [모으기][채팅] 2탭 구조([moa-tab-bar](../../../apps/web/app/moa/[id]/_components/moa-tab-bar.tsx)) 유지 — [모으기] 시트 안에서 장소가 Day별로 묶여 표시. 신규 탭 없음.
- **D-16 지도 연동:** Day 탭/그룹 선택 시 지도에 **그날 핀만 번호로** 표시 + fitBounds(레퍼런스 IMG_2923·2925). 기존 [moa-map](../../../apps/web/app/moa/[id]/_components/moa-map.tsx)·핀 컴포넌트 재사용, 데이터만 필터.
- **D-17 미배치 풀 노출:** `plan_items` 행이 없는 place = 미배치 풀(별도 테이블 없음, `places` − 배치된 place_id, Phase 18 D-13). 결과 화면 **하단 '아직 안 넣은 곳 N' 섹션**으로 노출. 거기서 Day로 끌어다/버튼으로 배치(웹 드래그 상세는 플래너 재량, 최소 버튼 이동으로 시작 가능).
- **D-18 하단 액션 3종:** (1) **일정 다시 만들기**(재생성, 레퍼런스 '새로운 추천받기'), (2) **이동수단 토글**(전철/도보/차 — Phase 18 D-08 `setTravelMode` 존재, 기본 대중교통), (3) **일정 공유하기**(기존 [share-sheet](../../../apps/web/app/moa/[id]/_components/share-sheet.tsx)·shareMoa 재사용). 레퍼런스 '내 일정으로 담기'는 이미 내 모아라 불필요 → 제외.

### 장소 검색 추가 시 Day 배치
- **D-19 플랜 미생성 시:** 아직 `generate-plan`을 안 돌린 모아에서 장소 검색으로 담으면 **'몇 일차?' 묻지 않고 그냥 담는다**(지도 핀만). 이후 '일정 만들기' 시 AI가 이 장소들까지 묶어 배치(Phase 18 D-05). 스키마 추가 0.
- **D-20 플랜 존재 + '모르겠다':** 플랜이 있는 모아에서 장소 추가 시 '아직 모르겠다'를 고르면 **미배치 풀에 남고**(D-17 '아직 안 넣은 곳' 섹션에 노출), 다음 재생성 때 AI가 배치하거나 사용자가 수동 이동. 즉시 재생성·자동 append 안 함.
- **D-21 수동 배치 고정:** 사용자가 특정 Day에 명시 배치한 장소는 '일정 다시 만들기'에도 **그 Day에 고정**(AI가 못 옮김). ⚠ **백엔드 확장 필요** — 현 `moveToDay`는 `is_anchor:false`로 넣고, `anchor_place_ids`는 '어딘가 배치'만 보장하고 '어느 날'은 보장 안 함([packages/api/src/queries/plans.ts](../../../packages/api/src/queries/plans.ts) `moveToDay` L118). "수동 배치 Day 고정"을 재생성까지 살려보내는 계약(예: `is_anchor` + day 고정 힌트를 EF에 전달, 또는 EF가 기존 수동 plan_item을 보존)은 플래너가 설계. Phase 18 D-10/D-11(anchor 재클러스터·덮어쓰기)과 정합 필요.

### 가이드 카피 노출 (4곳)
- **D-22 위저드 서브카피:** '봐둔 곳' 스텝([step-seed](../../../apps/web/app/onboarding/_components/step-seed.tsx)) 안내 문구를 '유튜브·블로그 링크를 넣으면 영상 속 장소를 찾아 AI가 일정을 짜드려요' 식으로 교체(기존 문구 대체, 신규 UI 0).
- **D-23 보드 [일정] 빈 상태:** 일정 미생성 시 [일정] 영역에 '링크를 넣거나 장소를 담고 일정 만들기를 누르면 AI가 동선을 짜드려요' 안내 + CTA.
- **D-24 검색 추가 후 토스트:** 장소 검색으로 담은 직후 '지도에 담았어요 — 일정 만들기를 누르면 며칠차에 넣을지 AI가 정해줘요' 토스트(D-19 맥락 보완).
- **D-25 재생성 버튼 보조 문구:** '일정 다시 만들기' 근처에 '직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요'(D-21 규칙을 사용자에게).

### Claude's Discretion
- pill selected 변형을 `Chip` 확장 vs 신규 컴포넌트로 할지 (D-04)
- day_count와 start/end_date가 둘 다 있을 때 우선순위·정합(플래너가 확정, D-08)
- 결과 화면 미배치 풀에서 Day로 옮기는 UI(드래그 vs 버튼/시트) — 최소 버튼부터 (D-17)
- Day 그룹 UI를 place-sheet 세로 스크롤 안에 어떻게 안착시킬지(가로 Day 탭 스트립의 제스처 경계, 아래 code_context 제약 참조)
- 스텝 카운터 `N/총`의 정확한 표기(`1/4` vs `1 / 4`)와 전환 애니메이션

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 이 phase가 재사용/연결하는 기존 산출물 (백엔드 신규 최소)
- `.planning/phases/18-auto-plan-ai/18-CONTEXT.md` — AI 플랜 트리거·클러스터링·미배치 풀·재생성 결정(D-01 명시 버튼, D-05 AI선별+풀, D-08 이동수단, D-10 anchor, D-11 덮어쓰기, D-13 "Places 검색 추가는 V2" ← 이 phase가 그 V2)
- `.planning/phases/24-host-flow/24-CONTEXT.md` — 온보딩 위저드·지도탭·추가 UI 결정(D-02 단일 라우트, D-03 일괄 생성, D-06 캘린더, D-11 AddContentTabs 재사용, D-13 '분석 중' 진행 표시)
- `supabase/functions/generate-plan/index.ts` — `computeDayCount`(L289-297) fallback 대상 · select에 `day_count` 추가 필요 · Claude geo-cluster + Routes 파이프라인
- `supabase/functions/generate-plan/pipeline/claude.ts` — `dayCount` 프롬프트 주입 지점(L48·L144·L159)
- `packages/api/src/queries/plans.ts` — `generatePlan`/`getPlanByTrip`/`moveToDay`/`reorderPlanItem`/`setAnchor`/`moveToPool`/`setTravelMode`/`setCollaborative` 래퍼(전부 기존, D-21 확장 검토 대상)
- `apps/ios/app/trip/[id]/(tabs)/plan.tsx` — **읽기 전용 analog** (iOS 결과 화면 구현 참고, 복사 아님, 수정 절대 금지)

### 이 phase가 개편/확장하는 웹 표면
- `apps/web/app/onboarding/page.tsx` — 위저드 오케스트레이터(스텝 상태·헤더·CTA)
- `apps/web/app/onboarding/_components/step-where.tsx`·`step-dates.tsx`·`step-who.tsx`·`step-seed.tsx` — 스텝 컴포넌트(리스타일 대상)
- `apps/web/components/add-content-tabs.tsx` — 링크/장소 2탭(재사용, 재구현 금지)
- `apps/web/app/moa/[id]/_components/place-sheet.tsx`·`place-list.tsx`·`moa-map.tsx`·`moa-tab-bar.tsx`·`moa-island.tsx` — 결과 화면이 얹힐 지도탭 표면
- `apps/web/app/onboarding/_lib/build-draft.ts` — 위저드 상태 → `TripCreateDraft` 매퍼(day_count 추가 반영)

### 프로젝트 규약 (변경 전 필독)
- `CLAUDE.md` §4.2/4.3 — 충돌 위험 영역(core schemas는 SQL과 짝지어, 마이그레이션 append-only) · §4.5 워크스페이스 import `.js` 금지 · §5 iOS 동결
- `packages/ui-tokens/src/index.ts` — 색 토큰(brand 50-900, brand-500 `#2979FF`) — pill/CTA 색은 토큰 사용, 신규 hex 금지

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AddContentTabs` — 링크/장소 입력 전부 담당, DB 미접촉(부모가 스테이징 소유). 위저드·지도탭 공유. 그대로 재사용(D-10).
- `generate-plan` EF + `plans`/`plan_items` + api 래퍼 8종 — 결과 화면 백엔드 **신규 0**. UI만 웹에 신규.
- 기간 스텝(pill 선택) 컴포넌트 — 위저드와 D-13 기간 미정 게이트가 공유(한 벌 구현).
- `moa-map` + 번호 핀 — Day별 필터만 하면 결과 화면 지도(D-16).
- `share-sheet`/shareMoa — 결과 화면 공유 버튼(D-18) 재사용.
- Phase 24 D-13 '분석 중…' 진행 행 패턴 — D-14 추출 대기 게이트 재사용.

### Established Patterns
- 위저드 상태는 `page.tsx`가 전부 소유하고 스텝 컴포넌트에 props로 내림(Phase 24 D-02). 리스타일은 이 소유 구조를 깨지 말 것.
- 미배치 풀 = `places` − 배치된 place_id (별도 테이블/컬럼 없음). `moveToPool`=plan_item 삭제, `moveToDay`=plan_item insert. **`moveToDay`는 plan_id 필수** → 플랜 미생성 시 Day 배치 불가(D-19의 물리적 근거).
- `generate-plan`은 단일 draft 플랜을 **멱등 덮어쓰기**. D-21(수동 배치 고정)은 이 덮어쓰기와 충돌 — 계약 확장 필요.
- 마이그레이션 append-only, 컬럼 추가는 NULLABLE(day_count는 nullable INT).

### Integration Points
- `trips.day_count` (0030) → core `TripCreateDraftSchema`/`Trip` 타입 → `build-draft.ts` → `createMoaDraft` → generate-plan EF select/RequestSchema. **한 컬럼이 5개 레이어 관통** — 짝지어 변경.
- 결과 화면 Day 그룹 UI가 place-sheet 세로 스크롤 안에 들어감. ⚠ **최근 커밋(3f32204·f006549 등)이 place-sheet 제스처 소유권을 정리**(본문 스크롤 전용, 지도 핀치줌 차단)했으므로, 가로 Day 탭 스트립을 넣을 때 그 제스처 경계를 재검토할 것 — 회귀 위험 지점.

</code_context>

<specifics>
## Specific Ideas

- 레퍼런스: `references/add_trip/IMG_2917~2926.PNG`. IMG_2918(도시)·2919(기간)·2920(동행)·2921(일정 스타일)이 스텝 룩, IMG_2922~2925가 결과 화면(Day 탭·타임라인·지도), IMG_2926(travelog)은 이번 범위 아님.
- 사용자 표현: "Place-sheet에 일정별로 장소가 추가되면 되는거니까" — 결과 화면은 새 화면이 아니라 기존 시트의 Day 그룹핑이라는 명확한 방향.
- 사용자 표현: "5박 6일이 넘어가는거면 별도 버튼으로 캘린더에서 기간 선택" — 기간 pill이 1차, 캘린더는 escape hatch.
- 사용자 표현(분기): "유튜브 링크가 있어서 장소 추출이 가능하면 AI 일정 추천, 링크 없으면 여행 추가만 하고 이후 링크 추가하면 추출해서 추천. 장소 검색 추가는 몇일차 물어보고, 모르겠으면 AI 배치. 이런 내용이 사용자한테도 가이드가 돼야 해."

</specifics>

<deferred>
## Deferred Ideas

- 결과 화면 Day 간 드래그 앤 드롭 재배치(placed↔placed, `reorderPlanItem`은 존재하나 웹 드래그 UI는 미래) — 최소 버튼 이동으로 이 phase는 충분.
- AI 플랜 품질 eval(동선 합리성·날짜 분배 채점) — Phase 18 Note가 지목, 별도.
- 레퍼런스 IMG_2926 'travelog(다녀온 사람들의 여행기)' 피드 — `/discover`와 겹치는 별도 기능.
- 레퍼런스 '내 일정으로 담기'(추천 일정을 내 것으로 복사) — 우리는 이미 내 모아라 불필요, 공유 링크 열람자용 복사는 게스트 플로우(Phase 25) 영역.

### Reviewed Todos (not folded)
- `eas-ios-sharesheet-verify.md` — iOS 시트 검증(키워드 오탐, iOS 동결 대상이라 무관)
- `supabase-js-upgrade-presence.md` — supabase-js presence 업그레이드(이 phase 무관, Phase 24 D-14 presence 금지 맥락)

</deferred>

---

*Phase: 28-add-trip-redesign-ai*
*Context gathered: 2026-07-13*
