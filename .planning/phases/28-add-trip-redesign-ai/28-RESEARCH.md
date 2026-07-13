# Phase 28: Add-Trip Redesign (트리플 룩 위저드 + 웹 AI 일정) - Research

**Researched:** 2026-07-13
**Domain:** Next.js 15 웹 위저드 리스타일 · `trips.day_count` 스키마 seam · generate-plan EF fallback · place-sheet Day 그룹 결과 화면
**Confidence:** HIGH (전 항목 코드베이스 실측 — 신규 외부 의존성 0, 신규 백엔드는 컬럼 1개 + EF 2줄)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 위저드 스텝 리스타일 (레퍼런스 IMG_2918~2921)
- **D-01 히어로 인트로 생략:** IMG_2917 인트로 화면(`바로 추천받기`)은 만들지 않는다. `/onboarding` 진입 = 곧장 스텝 1. Phase 24 D-01/D-02(진입 분기·단일 라우트) 유지.
- **D-02 스텝 헤더:** 현 점 인디케이터를 **뒤로가기 chevron(좌) + `N/총` 카운터(우)** 로 교체. 레퍼런스는 우상단에 `1/5` 식 숫자. 총 스텝 수는 현 4단계(어디로→언제→누구랑→봐둔 곳) 기준.
- **D-03 스텝 본문:** 중앙 이모지/아이콘 → 큰 굵은 2줄 타이틀 → 회색 서브카피 → 선택지. 좌측정렬 `text-lg` 타이틀을 레퍼런스식 중앙 큰 타이틀로.
- **D-04 선택지 pill:** 도시·기간·동행 선택지를 **2열 큰 pill 그리드**로. 선택 상태 = 흰 배경 + 파란 테두리 + 파란 텍스트(레퍼런스 IMG_2920 '친구와'/'연인과'). 현 `Chip`(stadium, brand tint)을 확장하거나 새 selected 변형 — 플래너 재량.
- **D-05 하단 CTA:** 풀폭 `다음` 고정. **비활성 = 연한 파랑 bg + 흰 글씨**(레퍼런스 IMG_2918/2921), 활성 = 진한 파랑. 현 `disabled` opacity 방식과 다름 — 연한 파랑 채움 필요.

#### 날짜 스텝 → 기간 pill + day_count
- **D-06 기간 pill:** 캘린더 range를 1차 UI로 두던 것을 **기간 pill 6종(당일치기·1박2일·2박3일·3박4일·4박5일·5박6일)** 으로 교체. 레퍼런스 IMG_2919와 동일.
- **D-07 정확한 날짜:** 5박6일 초과이거나 정확한 날짜를 원하면 **별도 버튼 → 기존 캘린더**(react-day-picker) 범위 선택. Phase 24 D-06 캘린더는 폐기하지 않고 이 진입점 뒤로 이동.
- **D-08 day_count 저장:** `trips.day_count` INT nullable 신설 — **마이그레이션 append-only 새 번호 `0030`**. 기간 pill 선택 시 저장(당일치기=1, 1박2일=2, …). 캘린더로 실제 범위를 정하면 start/end_date 저장(day_count는 null 또는 파생 — 플래너가 우선순위 확정). `packages/core` 스키마와 **짝지어 변경**, `pnpm supabase:types` 재생성.
- **D-09 EF fallback:** `generate-plan` EF의 `computeDayCount`(supabase/functions/generate-plan/index.ts L289-297)에 `dayCount = trip.day_count ?? computeDayCount(start,end)` fallback 추가. 현재는 날짜 null이면 무조건 1일 → day_count 있으면 그 값 우선. **⚠ EF의 RequestSchema/select에 `day_count` 노출 필요** (현 select는 `id, owner_id, start_date, end_date`만).

#### 입력 기능 유지 (Phase 24 D-11 재사용)
- **D-10 AddContentTabs 재사용:** 링크 붙여넣기 / 장소 검색은 apps/web/components/add-content-tabs.tsx를 **그대로** 사용. 탭 자체 재구현 금지(24-04 doc 주석 명시). 링크→`addLink`+`triggerExtraction`, 장소→`resolve-place` EF + `addManualPlace`, 전부 기존 계약.

#### 위저드→보드 흐름 & AI 일정 트리거 (Phase 18 D-01 미러)
- **D-11 위저드 완료:** 지금처럼 4단계 후 `/moa/{id}` 지도 보드로 이동(Phase 24 D-03). AI 일정 자동 생성 안 함.
- **D-12 명시적 버튼 생성:** AI 일정은 place-sheet **[일정] 영역 상단의 '일정 만들기' 버튼**으로 사용자가 트리거(Phase 18 D-01·D-02와 동일). 그 시점 trip 전체 places로 `generatePlan` 호출. 재생성도 같은 자리.
- **D-13 기간 미정 게이트:** day_count·start_date 둘 다 null인 모아에서 '일정 만들기'를 누르면 **기간 pill부터 물어본다**(위저드 기간 스텝 컴포넌트 재사용, 시트/모달). 기간 선택 → day_count 저장 → 생성. 1일 기본 생성 안 함.
- **D-14 추출 대기 게이트:** 링크 추출이 도는 중(장소 미확정)이면 '일정 만들기' **비활성 + 진행 표시**('영상에서 장소를 찾고 있어요 · N개 분석 중', Phase 24 D-13 '분석 중…' 패턴 재사용). 추출 완료 시 활성. 절반짜리 장소로 비용 드는 재생성 방지.

#### 결과 화면 (place-sheet Day 그룹핑) — 레퍼런스 IMG_2922~2925
- **D-15 위치:** 별도 라우트/바텀시트 신설이 아니라 **기존 place-sheet가 Day 그룹을 갖는다**. [모으기][채팅] 2탭 구조(moa-tab-bar) 유지 — [모으기] 시트 안에서 장소가 Day별로 묶여 표시. 신규 탭 없음.
- **D-16 지도 연동:** Day 탭/그룹 선택 시 지도에 **그날 핀만 번호로** 표시 + fitBounds(레퍼런스 IMG_2923·2925). 기존 moa-map·핀 컴포넌트 재사용, 데이터만 필터.
- **D-17 미배치 풀 노출:** `plan_items` 행이 없는 place = 미배치 풀(별도 테이블 없음, `places` − 배치된 place_id, Phase 18 D-13). 결과 화면 **하단 '아직 안 넣은 곳 N' 섹션**으로 노출. 거기서 Day로 끌어다/버튼으로 배치(웹 드래그 상세는 플래너 재량, 최소 버튼 이동으로 시작 가능).
- **D-18 하단 액션 3종:** (1) **일정 다시 만들기**(재생성, 레퍼런스 '새로운 추천받기'), (2) **이동수단 토글**(전철/도보/차 — Phase 18 D-08 `setTravelMode` 존재, 기본 대중교통), (3) **일정 공유하기**(기존 share-sheet·shareMoa 재사용). 레퍼런스 '내 일정으로 담기'는 이미 내 모아라 불필요 → 제외.

#### 장소 검색 추가 시 Day 배치
- **D-19 플랜 미생성 시:** 아직 `generate-plan`을 안 돌린 모아에서 장소 검색으로 담으면 **'몇 일차?' 묻지 않고 그냥 담는다**(지도 핀만). 이후 '일정 만들기' 시 AI가 이 장소들까지 묶어 배치(Phase 18 D-05). 스키마 추가 0.
- **D-20 플랜 존재 + '모르겠다':** 플랜이 있는 모아에서 장소 추가 시 '아직 모르겠다'를 고르면 **미배치 풀에 남고**(D-17 '아직 안 넣은 곳' 섹션에 노출), 다음 재생성 때 AI가 배치하거나 사용자가 수동 이동. 즉시 재생성·자동 append 안 함.
- **D-21 수동 배치 고정:** 사용자가 특정 Day에 명시 배치한 장소는 '일정 다시 만들기'에도 **그 Day에 고정**(AI가 못 옮김). ⚠ **백엔드 확장 필요** — 현 `moveToDay`는 `is_anchor:false`로 넣고, `anchor_place_ids`는 '어딘가 배치'만 보장하고 '어느 날'은 보장 안 함(packages/api/src/queries/plans.ts `moveToDay` L118). "수동 배치 Day 고정"을 재생성까지 살려보내는 계약(예: `is_anchor` + day 고정 힌트를 EF에 전달, 또는 EF가 기존 수동 plan_item을 보존)은 플래너가 설계. Phase 18 D-10/D-11(anchor 재클러스터·덮어쓰기)과 정합 필요.

#### 가이드 카피 노출 (4곳)
- **D-22 위저드 서브카피:** '봐둔 곳' 스텝(step-seed) 안내 문구를 '유튜브·블로그 링크를 넣으면 영상 속 장소를 찾아 AI가 일정을 짜드려요' 식으로 교체(기존 문구 대체, 신규 UI 0).
- **D-23 보드 [일정] 빈 상태:** 일정 미생성 시 [일정] 영역에 '링크를 넣거나 장소를 담고 일정 만들기를 누르면 AI가 동선을 짜드려요' 안내 + CTA.
- **D-24 검색 추가 후 토스트:** 장소 검색으로 담은 직후 '지도에 담았어요 — 일정 만들기를 누르면 며칠차에 넣을지 AI가 정해줘요' 토스트(D-19 맥락 보완).
- **D-25 재생성 버튼 보조 문구:** '일정 다시 만들기' 근처에 '직접 옮긴 장소는 그대로 두고 나머지만 다시 짜요'(D-21 규칙을 사용자에게).

### Claude's Discretion
- pill selected 변형을 `Chip` 확장 vs 신규 컴포넌트로 할지 (D-04)
- day_count와 start/end_date가 둘 다 있을 때 우선순위·정합(플래너가 확정, D-08)
- 결과 화면 미배치 풀에서 Day로 옮기는 UI(드래그 vs 버튼/시트) — 최소 버튼부터 (D-17)
- Day 그룹 UI를 place-sheet 세로 스크롤 안에 어떻게 안착시킬지(가로 Day 탭 스트립의 제스처 경계, code_context 제약 참조)
- 스텝 카운터 `N/총`의 정확한 표기(`1/4` vs `1 / 4`)와 전환 애니메이션

### Deferred Ideas (OUT OF SCOPE)
- 결과 화면 Day 간 드래그 앤 드롭 재배치(placed↔placed, `reorderPlanItem`은 존재하나 웹 드래그 UI는 미래) — 최소 버튼 이동으로 이 phase는 충분.
- AI 플랜 품질 eval(동선 합리성·날짜 분배 채점) — Phase 18 Note가 지목, 별도.
- 레퍼런스 IMG_2926 'travelog(다녀온 사람들의 여행기)' 피드 — `/discover`와 겹치는 별도 기능.
- 레퍼런스 '내 일정으로 담기'(추천 일정을 내 것으로 복사) — 우리는 이미 내 모아라 불필요, 공유 링크 열람자용 복사는 게스트 플로우(Phase 25) 영역.

Reviewed todos (not folded): `eas-ios-sharesheet-verify.md`(iOS 동결 대상이라 무관) · `supabase-js-upgrade-presence.md`(이 phase 무관)
</user_constraints>

## Summary

Phase 28은 **"새 발명 최소" phase의 극단형**이다. 신규 npm 패키지 0, 신규 백엔드는 `trips.day_count` 컬럼 1개(nullable INT)와 `generate-plan` EF 안 2줄(select에 `day_count` 추가 + `trip.day_count ?? computeDayCount(...)` fallback)뿐이다. 위저드 리스타일 대상 4개 스텝 컴포넌트(`step-where/dates/who/seed`)와 오케스트레이터(`onboarding/page.tsx`), 결과 화면이 얹힐 `moa-island`/`place-sheet`/`place-list`/`moa-map` 전부가 실존하며 props-driven이라 리스타일·확장이 국소적이다. `claude.ts` 프롬프트 파이프라인은 이미 `inputs.dayCount`를 주입받아 사용하므로 **수정 불필요** — index.ts의 fallback 한 줄이 자동으로 흘러들어간다.

코드 실측에서 **locked decision을 정정해야 하는 사실 1건**이 나왔다: 마이그레이션 번호 `0030`은 이미 `0030_poll_write_hardening.sql`(Phase 25 gap closure CR-01, commit 6dd8a95)이 점유했다. day_count 마이그레이션은 **`0031`** 이어야 한다 — "append-only 새 번호"라는 결정 의도는 그대로이고 리터럴 번호만 stale이다. 그 외 실측 리스크는 (1) `trips` UPDATE RLS가 **owner 전용**이라 editor 멤버는 D-13 기간 게이트에서 day_count 저장이 실패한다는 것, (2) `add_manual_place`가 좌표 없는 장소를 `(0,0)`으로 저장하고 EF는 (0,0)을 풀 전용으로 격리(T-18-14)하므로 "AI가 검색 장소도 배치"(D-19)는 resolve-place가 location을 준 경우에만 성립한다는 것, (3) `MoaMap`의 fitBounds가 "장소 수 증가 시만" 발동하므로 Day 탭 전환(핀 수 감소)에는 재조정이 안 된다는 것 — Day 필터 뷰를 위해 fitBounds 트리거를 제어할 additive prop이 필요하다.

가장 큰 설계 잔여물은 D-21(수동 배치 Day 고정)이다. 현 EF는 draft 플랜을 **통째로 삭제 후 재삽입**(멱등 덮어쓰기)하고, `plan_items`에는 "수동 배치" 마커가 없다(`moveToDay`는 `is_anchor:false`). 스키마 추가 없이 성립하는 계약은 "`moveToDay`가 `is_anchor:true`로 기록 + 재생성 시 클라이언트가 현 플랜의 anchor 항목들로 `pinned_placements`(place_id→day_index) 힌트를 EF RequestSchema에 additive로 전달 + 프롬프트 제약 + `validatePlanIds` 사후 강제"다 — 본문 Open Questions에 옵션 3종과 권고를 정리했다.

**Primary recommendation:** 마이그레이션은 `0031_trip_day_count.sql`로 명명하고(0030 점유 — 결정 의도 승계), day_count seam(0031 → core `TripSchema`/`TripCreateDraftSchema`/`TripUpdateSchema` → `build-draft.ts` → `createMoaDraft`/`updateTrip` → typegen → EF select+fallback)을 첫 웨이브에서 한 번에 잠근 뒤, 위저드 리스타일과 결과 화면을 그 위에 병렬로 얹어라. EF 변경분은 코드 머지와 별개로 원격 배포 게이트(`supabase functions deploy generate-plan` 또는 GitHub 통합 자동 배포 확인)가 있음을 플랜에 명시하라.

## Phase Requirements

**Requirement IDs: TBD** — ROADMAP·REQUIREMENTS.md 모두 Phase 28 ID 미발급 상태(`Requirements: TBD (discuss에서 확정)`, REQUIREMENTS.md에 Phase 28 항목 없음 — grep 실측). 플래너는 PLAN 작성 시 ROADMAP Success Criteria 6종을 기준으로 삼고, REQUIREMENTS.md 갱신(신규 ID 발급)을 phase 산출물에 포함할 것.

| SC | 내용 (ROADMAP verbatim 요약) | Research Support |
|----|------|------------------|
| SC-1 | `/onboarding` 스텝이 IMG_2918~2921 레이아웃(뒤로가기+`N/총`, 중앙 아이콘, 큰 타이틀+서브카피, 2열 pill, 하단 고정 CTA)으로 렌더 | 현 page.tsx 구조 실측(§Patterns 1) + 레퍼런스 시각 분석(§레퍼런스) + 토큰 매핑 |
| SC-2 | 기간 pill → `trips.day_count` 저장, 캘린더 버튼으로 정확 날짜 선택 가능 | day_count 5-레이어 seam(§Patterns 3) + 0031 SQL(§Code Examples) + Pitfall 1/2/7 |
| SC-3 | 링크·장소 검색이 위저드에서 기존과 동일 동작(AddContentTabs 재사용) | AddContentTabs 계약 실측 — DB 미접촉 콜백형, 리스타일과 직교(§Patterns 1) |
| SC-4 | '일정 만들기' → Day 1~N 탭 + 번호 타임라인 결과 화면 (날짜 미정이어도 day_count 기준) | getPlanByTrip/PlanWithItems 실측 + EF fallback(§Patterns 4/5) + Pitfall 3/4/6 |
| SC-5 | 장소 검색 추가 시 몇 일차 질문 + '모르겠다'→AI 배치, 규칙이 가이드 카피로 노출 | moveToDay 계약(plan_id 필수) 실측 + D-19/20 분기 데이터 근거(§Patterns 6) |
| SC-6 | `apps/ios` 및 기존 마이그레이션 diff 0 | ui-tokens·core 변경 시 iOS 스위트 무회귀 검증 절차(§Validation) — day_count는 required-nullable 미러 시 iOS fixture 영향 검토 필요(Pitfall 9) |

## Project Constraints (from CLAUDE.md)

- **마이그레이션 append-only** (§4.3): 기존 파일 수정 금지, 새 번호만 추가. 컬럼 추가는 NULLABLE/DEFAULT. 변경 후 `pnpm supabase:types` 재생성 → `packages/api/src/types/database.ts`.
- **core schemas는 SQL과 짝지어 변경** (§4.2): `packages/core/schemas/*`는 web/iOS/EF 모두 영향.
- **iOS 전면 동결** (§5): `apps/ios` 수정 금지 — `plan.tsx`는 읽기 전용 analog. 단 `packages/core`/`ui-tokens` 변경은 iOS가 import하므로 iOS 테스트 스위트(128) 무회귀 확인 필요(24-02 선례).
- **워크스페이스 import `.js` 확장자 금지** (§4.5).
- **외부 입력은 Zod validate** (§4.5): `@moajoa/core/schemas` 경유.
- **RLS deny-by-default, 크로스 테이블은 SECURITY DEFINER 헬퍼** (§4.4) — 이 phase는 신규 RLS 없음(day_count는 기존 trips 정책 승계).
- **서비스 롤 키 클라이언트 노출 금지** — EF 안에서만.
- **커밋 Conventional Commits**, 마이그레이션 변경 PR에 `BREAKING DB CHANGE` 명시(additive nullable이라 non-breaking이지만 관례 확인).
- **Simplicity First / Surgical Changes** (§3): 요청 범위 외 리팩토링 금지 — 리스타일 시 인접 코드 정리 유혹 주의.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 위저드 스텝 리스타일·카운터·CTA | Browser/Client (`apps/web` 클라이언트 컴포넌트) | — | 순수 프레젠테이션, 상태는 page.tsx 소유(Phase 24 D-02 구조 유지) |
| 기간 pill → day_count 저장 | Browser/Client → API(`@moajoa/api`) | Database (0031 컬럼) | `buildDraft`→`createMoaDraft` INSERT(위저드) / `updateTrip` UPDATE(D-13 게이트) |
| day_count 스키마 계약 | `packages/core` (Zod) | Database + EF | 5개 레이어 관통: 0031→core→build-draft→api→typegen→EF |
| Day 수 결정(fallback) | Edge Function (`generate-plan`) | — | `trip.day_count ?? computeDayCount(start,end)` — 서버가 유일 결정자, 클라 임의 계산 금지 |
| AI 클러스터링·경로 그라운딩 | Edge Function (기존, 무변경) | Anthropic·Routes API | Phase 18 산출물 그대로 |
| 결과 화면 Day 그룹·타임라인 | Browser/Client (place-sheet 내) | API (`getPlanByTrip`) | plan_items를 day_index로 그룹, 미배치 풀은 클라 파생(places − placed) |
| Day 필터 지도 핀 | Browser/Client (`moa-map`) | — | places prop 필터 + 번호 마커(additive marker-svg 확장) |
| 수동 배치·풀 이동 | API (`moveToDay`/`moveToPool`) | Database RLS | plan_items INSERT/DELETE, can_edit_trip 게이트 |
| D-21 Day 고정 재생성 계약 | Edge Function (RequestSchema additive 확장) | Browser/Client (힌트 수집) | 프롬프트 제약 + validatePlanIds 사후 강제(§Open Questions) |
| 생성 진행 표시 | Browser/Client (broadcast 구독) | Edge Function (송신) | EF가 `plan:{trip_id}` 채널로 step broadcast — 웹은 생성 중에만 임시 구독(iOS 미러) |

## Standard Stack

### Core (전부 기존 — 신규 설치 0)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.x (기존) | `/onboarding`·`/moa/[id]` 라우트 | 기존 표면 [VERIFIED: codebase] |
| react-day-picker | 9.14.0 (설치됨) | D-07 정확 날짜 캘린더 | Phase 24 도입·`DAY_PICKER_CLASS_NAMES` Tailwind 매핑 기존 [VERIFIED: apps/web/package.json L29] |
| lucide-react | 기존 | chevron·X·Plus 아이콘 | 기존 사용 [VERIFIED: codebase] |
| @moajoa/core | workspace | TripSchema·PlanSchema·PLAN_STEP_KO·planChannelName | day_count 짝지어 변경 대상 [VERIFIED: codebase] |
| @moajoa/api | workspace | generatePlan·getPlanByTrip·moveToDay·moveToPool·setTravelMode·setAnchor·reorderPlanItem·updateTrip·shareMoa | 전부 실존 확인 [VERIFIED: packages/api/src/queries/plans.ts·trips.ts] |
| @moajoa/ui-tokens | workspace | brand 50~900 (500 `#2979FF`·600 `#2563EB`·200 `#B3C8FF`) | pill/CTA 색 — 신규 hex 금지 [VERIFIED: packages/ui-tokens/src/index.ts L15-27] |
| supabase-js | 2.110.0 (기존) | broadcast 구독·RPC | 24-01에서 정합화 완료 [VERIFIED: codebase] |
| vitest | 기존 | web(jsdom)·api·core 테스트 | 기존 하네스 [VERIFIED: apps/web/vitest.config.ts] |

### Supporting (EF 측 — 무변경 또는 2줄 수정)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| generate-plan EF | Deno·기존 | Claude geo-cluster + Routes | index.ts select(L106)+fallback(L158) 2줄만 수정 |
| claude-sonnet-4-6 | EF 내 고정 | 클러스터링 모델 | **수정 불필요** — `inputs.dayCount` 이미 주입됨(pipeline/claude.ts L144·L151·L159-160) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| place-sheet 내 Day 그룹(D-15 잠금) | 별도 결과 라우트/풀스크린 시트 | 잠긴 결정 — 탐색 불필요 |
| 임시 `plan:{tripId}` broadcast 구독 | `generatePlan` invoke promise만 대기(진행 단계 없음) | promise-only가 더 단순하나 30초+ 생성 동안 단계 표시 불가 — EF가 이미 step을 쏘고 core에 `PLAN_STEP_KO`가 있으므로 임시 구독이 저비용(§Patterns 5) |
| 신규 SelectPill 컴포넌트 | 기존 `Chip` 확장 | Chip은 text-xs·px-3 소형 — 레퍼런스 pill(대형 stadium·py-5±·text-base/lg·2열)과 anatomy가 달라 **신규 컴포넌트 권장**(변형 분기 비대화 방지). 플래너 재량(D-04) |

**Installation:** 없음 — `pnpm install` 신규 패키지 0.

## Package Legitimacy Audit

**이 phase가 설치하는 신규 외부 패키지: 0** — 모든 의존성은 레포에 이미 설치·검증된 것(react-day-picker 9.14.0은 Phase 24에서 도입·감사 완료). 감사 대상 없음.

## Architecture Patterns

### System Architecture Diagram

```
[위저드 /onboarding (리스타일)]
 step1 어디로 ──> step2 언제(기간 pill 6종 │ '정확한 날짜' 버튼→캘린더) ──> step3 누구랑 ──> step4 봐둔 곳(AddContentTabs 재사용)
    │                                                                                        │
    └── page.tsx 상태 소유(불변 구조) ── buildDraft(+day_count) ── TripCreateDraftSchema.parse
                                                                        │
                                                              createMoaDraft INSERT (trips + day_count)
                                                                        │  addLink×N + triggerExtraction(f&f) + addManualPlace×N
                                                                        v
                                                          router.replace(/moa/{id})
[지도탭 /moa/[id]]
  moa-island (상태 허브) ── getPlanByTrip ──> plan == null ──> [일정] 빈 상태(D-23 카피) + '일정 만들기' 버튼
      │                                        │                    │ (D-13: day_count·start_date 모두 null → 기간 pill 시트 → updateTrip(day_count))
      │                                        │                    │ (D-14: 추출 pending/processing → 비활성 + '영상에서 장소를 찾고 있어요')
      │                                        │                    v
      │                                        │              generatePlan invoke ──> [generate-plan EF]
      │                                        │                    │                   ├ select ... day_count ← (신규)
      │                                        │                    │                   ├ dayCount = trip.day_count ?? computeDayCount ← (신규)
      │                                        │                    │                   ├ Claude cluster → Routes legs
      │                                        │                    │                   └ plans 삭제→재삽입(멱등) + plan_items INSERT
      │                                        │              plan:{tripId} broadcast(loading→clustering→routing→done) ← 임시 구독으로 진행 표시
      │                                        v
      │                              plan != null ──> place-sheet [일정] Day 1~N 탭 + 번호 타임라인(day_index/sort_order)
      │                                                 ├ Day 선택 → moa-map places 필터 + 번호 핀 + fitBounds(제어 prop)
      │                                                 ├ 미배치 풀 '아직 안 넣은 곳 N' = places − plan_items.place_id
      │                                                 └ 하단 3종: 다시 만들기(D-25 카피) · 이동수단 토글(setTravelMode→재생성) · 공유(share-sheet)
      └ AddSheet 장소 검색 추가: plan 있음 → '몇 일차?' 선택(moveToDay) / '모르겠다'(풀 잔류) · plan 없음 → 질문 없이 담기 + D-24 토스트
```

### Recommended Project Structure (신규/수정 파일)

```
supabase/
├── migrations/0031_trip_day_count.sql        # 신규 — day_count INT nullable (0030 점유로 번호 정정)
└── functions/generate-plan/index.ts          # 수정 2곳 — select L106 + fallback L158 (claude.ts 무변경)
packages/
├── core/src/schemas/trip.ts                  # TripSchema·TripCreateDraftSchema·TripUpdateSchema에 day_count
└── api/src/queries/trips.ts                  # updateTrip에 day_count passthrough / types/database.ts typegen
apps/web/
├── app/onboarding/
│   ├── page.tsx                              # 헤더(chevron+N/총)·타이틀 앙상블·CTA 리스타일 + duration 상태
│   ├── _components/step-where.tsx            # 2열 pill 그리드로 리스타일
│   ├── _components/step-dates.tsx            # 기간 pill 6종 + '정확한 날짜' 버튼 → 기존 캘린더 (컴포넌트 분리 권장: duration-pills.tsx)
│   ├── _components/step-who.tsx              # 2열 pill 그리드로 리스타일
│   ├── _components/step-seed.tsx             # D-22 카피 교체 (AddContentTabs 무접촉)
│   └── _lib/build-draft.ts                   # day_count 매핑 추가
├── components/select-pill.tsx (신규 권장)     # 대형 2열 pill — 선택=흰 bg+brand 테두리+brand 텍스트 (D-04 재량)
└── app/moa/[id]/_components/
    ├── moa-island.tsx                        # plan 상태 + 생성 트리거 + 진행 구독 + Day 필터 상태 배선
    ├── place-sheet.tsx                       # (가급적 무수정 — Day UI는 children으로 주입)
    ├── plan-section.tsx (신규)                # [일정] 영역: Day 탭 스트립 + 타임라인 + 풀 + 하단 액션 3종
    ├── duration-gate-sheet.tsx (신규)         # D-13 기간 미정 게이트(기간 pill 컴포넌트 공유)
    └── moa-map.tsx                           # 수정 — 번호 라벨 마커 + fitBounds 제어(additive props)
apps/web/lib/marker-svg.ts                    # 수정 — number 라벨 옵션(additive, fill 확장 선례 미러)
```

### Pattern 1: 위저드 리스타일 — 상태 소유 구조 불변, 표면만 교체

**What:** `page.tsx`가 step·city·dateMode·range·companion·seed 상태 전부를 소유하고 스텝 컴포넌트는 props/콜백만 받는 현 구조(Phase 24 D-02)를 그대로 두고, 렌더 트리만 바꾼다.
**When to use:** 모든 스텝 리스타일 태스크.
**핵심 실측:**
- 헤더: 현 점 인디케이터(L122-133)를 chevron(좌, 이미 존재 L112-121) + `N/총` 카운터(우)로 교체. 레퍼런스 카운터는 파란 텍스트(brand-500) 우상단.
- 타이틀: 현 `text-lg font-semibold` 좌측정렬(L138-140) → 중앙 이모지/아이콘 + `text-2xl~3xl font-bold` 중앙 2줄 + `text-neutral-400~500` 서브카피. `HEADINGS` Record 패턴을 `{icon, title, subtitle}` Record로 확장하면 스텝별 분기 없이 유지.
- CTA: 현 `Button` primary가 이미 `disabled:bg-brand-300 disabled:text-white/60` — D-05 "연한 파랑 bg + 흰 글씨"와 **거의 일치**. 레퍼런스 비활성은 더 연한 톤(brand-200 `#B3C8FF` 근사) — 토큰 내 조정은 재량, `sticky bottom-0` 컨테이너는 기존 유지.
- `canProceed` 로직(L68-75)은 step2에 duration 분기 추가만.
- `AddContentTabs`·`StepSeed`는 카피(D-22) 외 무접촉 — 리스타일과 직교.
- 브라우저 뒤로가기 pushState/popstate(L48-66) 기존 유지 — 카운터는 `step` 상태에서 파생이라 추가 배선 0.

### Pattern 2: 기간 pill 컴포넌트 한 벌 — 위저드·D-13 게이트 공유

**What:** 기간 pill 6종(당일치기=1 … 5박6일=6) 선택 UI를 독립 컴포넌트(예: `duration-pills.tsx`)로 만들어 `step-dates`와 D-13 기간 미정 게이트 시트가 공유한다(CONTEXT code_context "한 벌 구현" 명시).
**Example:**
```tsx
// 매핑은 상수로 — '당일치기'=1박0일=1일.
const DURATION_OPTIONS = [
  { label: '당일치기', dayCount: 1 }, { label: '1박 2일', dayCount: 2 },
  { label: '2박 3일', dayCount: 3 }, { label: '3박 4일', dayCount: 4 },
  { label: '4박 5일', dayCount: 5 }, { label: '5박 6일', dayCount: 6 },
] as const;
```
step-dates의 새 모드 모델 권장: `dateMode: 'duration' | 'exact' | null` + `dayCount: number | null` + `range: DateRange | undefined`. 기존 `'unset'`(날짜 미정 통과) 개념은 "기간도 날짜도 안 고름" 상태로 흡수할지 별도 유지할지 플래너 확정 — 레퍼런스에는 미정 선택지가 없으나 ONBOARD-04(미정 통과)는 기존 요구사항이므로 **'나중에 정할게요' 텍스트 버튼 유지 권장**(캘린더 진입 버튼과 나란히).

### Pattern 3: day_count 5-레이어 seam — 한 웨이브에서 원자적으로

**What:** `trips.day_count` 한 컬럼이 관통하는 레이어: ① 0031 SQL → ② core `TripSchema`(+required-nullable)·`TripCreateDraftSchema`(+optional nullable)·`TripUpdateSchema`(pick에 추가) → ③ `build-draft.ts` 매핑 → ④ api `createMoaDraft` INSERT 필드 + `updateTrip` passthrough → ⑤ `pnpm supabase:types` 재생성 → ⑥ EF select+fallback. **짝지어 한 플랜에서** — 어느 하나가 빠지면 tsc/런타임 드리프트.
**주의:** `TripSchema`에 required 필드를 추가하면 기존 `fullTrip` 테스트 픽스처들이 일제히 갱신 필요(23-05에서 share_mode/companion 추가 시 동일 수순 — 선례 있음). iOS도 core를 import하므로 iOS 스위트(128) 무회귀 확인 필수(코드 수정 없이 픽스처 영향만).

### Pattern 4: 결과 화면 = place-sheet 안 Day 그룹 (신규 라우트 0)

**What:** `getPlanByTrip` → `PlanWithItems`(plans + plan_items 임베드)를 island이 fetch·소유하고, [모으기] 시트 children에 [일정] 섹션(`plan-section.tsx`)을 PlaceList 위/아래로 주입한다. Day 그룹 = `plan_items`를 `day_index`로 그룹 후 `sort_order` 정렬, 각 행은 `place_id`→places lookup. 미배치 풀 = `places`(hidden 제외) − `plan_items.place_id` 집합 — **클라이언트 파생, 별도 fetch 없음**(Phase 18 D-13 실측 일치).
**iOS analog(`apps/ios/app/trip/[id]/(tabs)/plan.tsx`, 읽기 전용):** 상태기계 A(장소 0)/B(플랜 전 — '플랜 만들기')/C(생성 중 — 진행 카드)/D(초안 렌더)/F(에러)가 웹 [일정] 영역의 상태 설계에 그대로 이식 가능. `leg_travel_seconds` null = "이동시간 —" 표기 관례도 동일.
**타임라인 번호:** 레퍼런스(IMG_2922·2925)의 번호는 **Day 내 방문 순서(1..k)** — `sort_order+1`. place-list의 `seq_no`(찜순 정렬에도 불변인 담은 순 배지)와 **다른 번호 체계**임을 플래너가 명확히 구분할 것.

### Pattern 5: 생성 진행 표시 — 임시 broadcast 구독 (iOS 미러)

**What:** EF는 `plan:{trip_id}` 채널(코어 `planChannelName`)에 `progress` broadcast(`{step: loading|clustering|routing|done|error, progress_pct, ...}`)를 쏜다(index.ts `broadcastStep`). 웹에는 구독 헬퍼가 없다 — iOS `subscribePlanProgress`는 `apps/ios/lib/realtime.ts` 소속(동결, import 불가). 웹은 **생성 중에만** 채널을 열고 done/error에서 removeChannel하는 임시 구독을 island에 인라인(또는 web lib)으로 구현한다.
**Why not moa 채널:** `moa:{tripId}` 단일 채널 규약(Phase 26 "ONE channel per screen")은 **postgres_changes 바인딩이 subscribe 시점에 negotiate**되어 사후 추가가 무음 no-op이 되는 문제(#1917)에서 온 것. broadcast 전용 임시 채널은 negotiate 문제가 없고, iOS도 plan 채널을 별도로 쓴다 — 규약 위반이 아니라 미러. 단, **바인딩(.on)은 반드시 .subscribe() 이전에 체이닝**하고 cleanup에서 `removeChannel`.
**대안(더 단순):** `generatePlan` invoke promise만 await하고 버튼을 '플랜을 짜고 있어요…'로 비활성 — 단계 표시 없음. 코어에 `PLAN_STEP_KO`가 이미 있어 임시 구독의 한계 비용이 낮으므로 구독안 권장이나, 플래너 재량.

### Pattern 6: Day 필터 지도 — places prop 필터 + fitBounds 제어

**What:** `MoaMap`은 `places` prop을 diff해 마커를 증감시키므로, Day 선택 시 그날 place 배열만 내리면 필터가 성립한다(D-16 "데이터만 필터" 그대로). 단 두 가지 additive 확장 필요:
1. **번호 라벨:** `buildMarkerIconUrl`에 `label?: number` 옵션 추가 — `fill` 확장(24-02, "미전달 시 기존 출력 바이트 동일") 선례를 미러. 숫자를 `String(n)`으로만 삽입 → 인젝션 표면 0(T-24-04 계약 유지). 기존 `?` 배지와 좌표/폰트 참조 가능.
2. **fitBounds 트리거:** 현 로직은 "장소 수 **증가** 시만" fitBounds(L77) — Day 전환은 핀 수가 줄 수 있어 재조정이 안 됨. `fitKey`(Day 인덱스 등) prop을 추가해 키 변경 시 강제 fitBounds하는 additive 경로 권장. 기존 증가-시-fit 경로는 무변경(전체 뷰 회귀 방지).

### Pattern 7: D-14 추출 대기 게이트 — 기존 판별식 재사용

**What:** place-list.tsx L96-110에 이미 있는 판별식을 그대로 재사용: 진행 중 = `link.source_kind !== 'manual' && (extraction_status === 'pending' || 'processing')`, 실패 = `failed | manual_review | (ready && 추출 장소 0)`. '일정 만들기' 버튼은 진행 중 링크 수 N>0이면 비활성 + '영상에서 장소를 찾고 있어요 · N개 분석 중'. links UPDATE는 이미 moa 채널 구독 대상이라 추출 완료 시 reconcile로 자동 활성화 — **신규 realtime 배선 0**.

### Anti-Patterns to Avoid
- **AddContentTabs 재구현/포크:** D-10 금지 명시. busy prop·콜백 계약 그대로.
- **지도 인스턴스 재생성:** MoaMap은 마운트당 1회 생성 + 마커 diff(RESEARCH 24 Pitfall 4 청산 구조) — Day 필터를 이유로 재init 금지.
- **moa 채널에 사후 바인딩 추가:** postgres_changes는 subscribe 후 추가가 무음 no-op(#1917). plan 진행은 별도 임시 broadcast 채널로.
- **place-sheet 드래그 표면에 Day 탭 얹기:** 핸들·헤더는 드래그 전용, 본문은 스크롤 전용(제스처 배타 소유 — 최근 커밋 3f32204이 정리). Day 탭 스트립은 **본문 영역 안** `overflow-x-auto` + `touch-pan-x`로.
- **클라이언트에서 day 수 임의 계산해 EF와 이원화:** Day 수의 유일 결정자는 EF 응답(`day_count`)·plan_items의 day_index. 결과 화면 탭 수는 플랜의 max(day_index)+1 또는 EF 응답 기준.
- **기존 마이그레이션 수정** (0016~0030 무접촉) · **iOS 파일 접촉** · **신규 hex 색**.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 정확 날짜 range 선택 | 커스텀 캘린더 | react-day-picker 9.14.0 + 기존 `DAY_PICKER_CLASS_NAMES` | Phase 24 검증 완료, share-sheet와 클래스 미러 유지 |
| Day 수 계산 | 클라 날짜 diff 재구현 | EF `computeDayCount` + `day_count` fallback | 결정자 이원화 방지 — iOS plan.tsx의 로컬 dayCount는 동결 대상이라 미러 금지 |
| 미배치 풀 저장 | 별도 테이블/컬럼 | `places` − `plan_items.place_id` 클라 파생 | Phase 18 D-13 확립 — 스키마 0 |
| 장소 순번 배지 | 새 채번 | `seq_no`(담은 순) vs `sort_order+1`(Day 내 순서) 구분 사용 | 이미 존재하는 두 체계 — 혼용만 경계 |
| 진행 단계 카피 | 신규 문자열 | `PLAN_STEP_KO`(@moajoa/core L220) | iOS와 동일 카피·타입(`PlanStepType`) |
| 공유 | 신규 공유 UI | 기존 `share-sheet` + `shareMoa` | D-18 잠금 — clipboard+navigator.share 처리 포함 |
| 플랜 항목 이동 | 직접 plan_items 쿼리 | `moveToDay`/`moveToPool`/`reorderPlanItem`/`setAnchor` 래퍼 | RLS 경유 계약 검증 완료(Phase 18) |
| 위저드→trips 저장 | 개별 필드 INSERT | `TripCreateDraftSchema.parse` → `createMoaDraft` | 제출 게이트(T-24-10) 유지 |

**Key insight:** 이 phase의 백엔드는 "추가"가 아니라 "노출"이다 — Phase 18이 만든 엔진의 유일한 결함(날짜 null→무조건 1일)을 컬럼 하나로 고치고, 웹 UI를 그 위에 얹는다. 손으로 만들 것이 많아 보이는 결과 화면조차 데이터 소스(PlanWithItems)·mutation(래퍼 8종)·지도(MoaMap)·시트(place-sheet)가 전부 기성품이다.

## Common Pitfalls

### Pitfall 1: 마이그레이션 번호 0030 이미 점유 — 0031로 정정
**What goes wrong:** locked decision D-08·ROADMAP이 "새 번호 0030"이라 명시하나, `supabase/migrations/0030_poll_write_hardening.sql`(Phase 25 gap closure CR-01, commit 6dd8a95)이 이미 존재·적용됨.
**Why it happens:** 결정 시점(discuss) 이후 25-리뷰 픽스가 0030을 선점.
**How to avoid:** day_count 마이그레이션은 **`0031_trip_day_count.sql`**. "append-only 새 번호"라는 결정 의도는 승계 — 리터럴 번호만 정정. 플랜 acceptance의 `! ls migrations | grep ^0030` 류 게이트도 0031 기준으로.
**Warning signs:** 0030 파일 수정/충돌 diff가 보이면 즉시 중단.

### Pitfall 2: trips UPDATE RLS는 owner 전용 — editor는 day_count 저장 불가
**What goes wrong:** D-13 기간 미정 게이트에서 `updateTrip(day_count)`이 editor 멤버에게 RLS로 조용히 실패(0016 L186-191 `"trips: owner full access"` — UPDATE 정책이 이것뿐). 반면 `generate-plan` EF 자체는 editor 허용(can_edit_trip 미러).
**Why it happens:** trips 쓰기는 처음부터 owner-only 설계, 플랜 생성만 editor까지 열려 있음.
**How to avoid:** 옵션 — (a) 기간 게이트(day_count 저장 UI)는 owner에게만 노출하고 editor에게는 '호스트가 기간을 정하면 만들 수 있어요' 안내, (b) day_count 저장 실패를 에러 토스트로 처리. **신규 RLS/RPC로 editor에 trips UPDATE를 여는 것은 이 phase 범위 밖**(보안 표면 확대) — (a) 권장. `/moa/[id]`의 주 사용자는 호스트이므로 실사용 영향 적음.
**Warning signs:** editor 계정 스모크에서 기간 선택 후 생성 버튼이 무반응/에러.

### Pitfall 3: (0,0) 장소는 AI가 영원히 배치 못 함
**What goes wrong:** `add_manual_place`는 `coalesce(p_lat, 0), coalesce(p_lng, 0)`(0027) — resolve-place가 location을 못 준 장소는 (0,0)으로 저장되고, EF는 (0,0)을 풀 전용으로 격리(T-18-14, index.ts L141-147). D-19 "이후 일정 만들기 시 AI가 이 장소들까지 배치"가 이런 장소에는 성립하지 않는다.
**How to avoid:** 웹 add 경로(add-sheet·onboarding)는 이미 `place.location?.lat/lng`을 전달 — location null인 결과만 잔여 리스크. 미배치 풀 UI에서 (0,0) 장소는 '위치 정보 없음' 등으로 구분 표기하거나 최소한 "왜 안 배치되지?" 혼란을 D-17 섹션 카피로 흡수. 지도 필터 시 (0,0)은 핀 제외(엉뚱한 대서양 핀 방지 — 현 MoaMap은 필터 없음, places 배열에서 사전 제외 권장).
**Warning signs:** fitBounds가 아프리카 근해까지 확장되면 (0,0) 핀 유입.

### Pitfall 4: Day 탭 전환 시 fitBounds 미발동
**What goes wrong:** MoaMap fitBounds는 "장소 수 증가 시만"(L77 `current.length > prevCountRef.current`). Day 1(5핀)→Day 2(3핀) 전환은 감소라 재조정 없음 — 그날 핀이 화면 밖에 남는다.
**How to avoid:** `fitKey` 류 controlled prop을 additive로 추가(Pattern 6). 기존 증가-시-fit 로직은 무변경으로 전체 뷰 회귀 차단.
**Warning signs:** Day 전환 후 지도가 이전 Day 영역에 머무름.

### Pitfall 5: place-sheet 제스처 경계 회귀
**What goes wrong:** Day 탭 가로 스트립·타임라인을 시트 본문에 넣을 때, 본문은 `touch-pan-y overflow-y-auto overscroll-contain`(스크롤 전용)·핸들/헤더는 드래그 전용으로 **배타 소유**가 최근에야 정리됨(3f32204 — 지도 핀치줌 차단 포함). 스트립에 pointer 핸들러나 `touch-none`을 얹으면 시트 드래그/페이지 줌 버그가 재발한다.
**How to avoid:** Day 스트립은 본문 스크롤 영역 안에서 `overflow-x-auto touch-pan-x`만. place-sheet 자체는 가급적 무수정(children 주입) — 수정 시 제스처 주석 계약(L26-28) 위반 여부를 acceptance로.
**Warning signs:** 시트가 가로 스와이프에 딸려 움직이거나, 지도와 시트가 동반 이동.

### Pitfall 6: D-21과 EF 멱등 덮어쓰기의 충돌 — 수동 배치 마커 부재
**What goes wrong:** '일정 다시 만들기'는 draft plans 행을 **delete 후 재insert**(index.ts L237) — 사용자가 `moveToDay`로 배치한 항목도 통째로 소멸한다. `moveToDay`는 `is_anchor:false`로 넣으므로(plans.ts L124) 현 스키마에는 "수동 배치"를 식별할 마커 자체가 없고, `anchor_place_ids`는 "어딘가 배치"만 보장한다.
**How to avoid:** §Open Questions 1의 계약 확장(권고: moveToDay `is_anchor:true` 전환 + EF `pinned_placements` additive 요청 필드 + 프롬프트 제약 + validatePlanIds 사후 강제)을 플랜에 명시적 태스크로. D-25 카피('직접 옮긴 장소는 그대로 두고…')는 이 계약이 실제로 동작해야만 진실이 된다 — 카피 먼저 배포 금지.
**Warning signs:** 재생성 후 수동 배치 장소가 다른 Day로 이동.

### Pitfall 7: day_count vs start/end_date 우선순위 드리프트
**What goes wrong:** EF fallback `trip.day_count ?? computeDayCount(...)`는 day_count가 **항상 우선**. 기간 pill(3일) 선택 후 나중에 캘린더로 5일짜리 실제 날짜를 확정하면, day_count=3이 남아 있는 한 5일 날짜는 무시된다.
**How to avoid:** 쓰기 경로에서 정합 유지 — 캘린더로 정확 날짜 저장 시 day_count를 **파생값으로 함께 갱신**(또는 null로 클리어; 파생 저장 권장 — 단일 fallback 순서 유지하면서 드리프트 0). 기간 pill 저장 시 start/end는 null 유지. D-08이 플래너 재량으로 잠근 지점 — 플랜에서 한 문장으로 확정할 것.
**Warning signs:** 날짜 확정 모아의 Day 탭 수가 날짜 span과 불일치.

### Pitfall 8: EF 코드 머지 ≠ 원격 반영
**What goes wrong:** index.ts 수정이 main에 머지돼도 원격 generate-plan EF는 재배포 전까지 구버전(0031 컬럼은 자동 적용돼도 fallback 코드는 아님) — 라이브에서 "날짜 미정인데 Day 1개" 증상이 지속.
**How to avoid:** 마이그레이션은 main push 시 Supabase↔GitHub 통합으로 자동 적용된 선례(0028·0029)가 있으나 **EF 자동 배포 여부는 이 레포에서 실증된 바 없음** [ASSUMED]. 플랜에 human-action 게이트로 `supabase functions deploy generate-plan`(또는 통합 배포 확인)을 명시. 로컬 검증은 `supabase functions serve`로 가능.
**Warning signs:** 로컬은 N일, 프로덕션은 1일.

### Pitfall 9: TripSchema required 필드 추가의 파급 — 픽스처·iOS 스위트
**What goes wrong:** `TripSchema`에 `day_count`를 required-nullable로 추가하면 core `fullTrip` 픽스처와 이를 미러한 테스트(web·api·**ios 128**)가 일제히 parse 실패할 수 있다.
**How to avoid:** 23-05 선례(share_mode/companion 추가 시 픽스처 수반 갱신) 그대로 — core 변경 커밋에서 픽스처 동시 갱신 + 전 스위트(core·api·web·ios) 그린 확인. iOS는 **테스트 실행만**(코드 diff 0) — SC-6 게이트와 양립.
**Warning signs:** iOS 스위트 red인데 iOS 파일 diff 0 — core 픽스처 누락 신호.

### Pitfall 10: 생성 중 이중 지출 (Claude+Routes 유료)
**What goes wrong:** '일정 만들기'/'다시 만들기' 연타 → EF가 병렬로 두 번 돌아 비용 2배 + 마지막 쓰기 승리 레이스(Phase 18 Pitfall 5 재림).
**How to avoid:** invoke~done/error까지 버튼 비활성('플랜을 짜고 있어요…') + generating 상태를 단일 boolean으로. iOS State C 미러.
**Warning signs:** extraction_costs에 근접 타임스탬프 중복 anthropic 행.

### Pitfall 11: 결과 화면 fetch 시점 — RSC seed에 plan 없음
**What goes wrong:** `/moa/[id]/page.tsx`(RSC)는 현재 places·links·votes·messages만 seed — plan은 아무도 안 불러온다. island에서 lazy fetch를 빼먹으면 [일정] 영역이 항상 빈 상태.
**How to avoid:** page.tsx Promise.all에 `getPlanByTrip` 추가(RSC seed, 기존 패턴 미러)하거나 island 마운트 시 fetch. RSC seed 권장(초기 렌더 일관성 + 기존 관례). `moveToDay`/`moveToPool` 후에는 로컬 상태 갱신 또는 refetch — plan_items는 realtime 구독 대상이 아님(publication 미등록, **등록 불필요** — 단일 사용자 편집 표면이므로 mutation 후 로컬 반영으로 충분. publication 추가는 범위 밖).
**Warning signs:** 다른 탭에서 이동한 항목이 새로고침 전까지 안 보임(허용 — 명시적 비목표로 기록).

## Code Examples

전부 코드베이스 실측 기반 — 외부 문서 의존 없음.

### 0031 마이그레이션 (append-only, NULLABLE)
```sql
-- 0031_trip_day_count.sql — 기간 pill 저장용 trips.day_count (Phase 28 D-08)
-- 날짜 미정 모아의 AI 일정 Day 수 소스. null = 미정(기존 fallback: 날짜 없으면 1일).
-- generate-plan EF가 trip.day_count ?? computeDayCount(start,end)로 소비 (D-09).
-- Append-only: 0016~0030 무수정.
alter table trips add column day_count int
  check (day_count is null or (day_count >= 1 and day_count <= 30));
```
(상한 30은 프롬프트/비용 방어용 제안 — 값은 플래너 재량. CHECK 없이 nullable int만도 성립.)

### core 스키마 짝 변경 (packages/core/src/schemas/trip.ts)
```ts
// TripSchema에 (required-nullable — share_mode/companion 미러, 23-05 선례):
day_count: z.number().int().min(1).nullable(),

// TripCreateDraftSchema object에:
day_count: z.number().int().min(1).nullable(),   // 기간 pill(1~6) 또는 null

// TripUpdateSchema pick에 day_count: true 추가 → updateTrip passthrough도 짝으로.
```

### generate-plan EF fallback (supabase/functions/generate-plan/index.ts — 2곳만)
```ts
// L106 select — day_count 추가 (RequestSchema는 무변경: day_count는 요청이 아니라 trips 행에서 읽음)
.select('id, owner_id, start_date, end_date, day_count')

// L158 — fallback (D-09). claude.ts는 inputs.dayCount를 이미 소비하므로 무수정.
const dayCount = trip.day_count ?? computeDayCount(trip.start_date, trip.end_date);
```
**주의:** CONTEXT D-09의 "RequestSchema/select에 노출 필요"에서 실측상 필요한 것은 **select뿐** — day_count는 클라이언트가 보내는 값이 아니라 서버가 trips에서 읽는 값이다(스푸핑 표면 차단 관점에서도 요청 필드 금지가 옳다). D-21 계약 확장(`pinned_placements`)만 RequestSchema 대상.

### 번호 라벨 마커 (apps/web/lib/marker-svg.ts — fill 확장 선례 미러)
```ts
// buildMarkerIconUrl input에 additive: label?: number
// (미전달 시 기존 출력 바이트 동일 — 24-02 fill 계약 미러. 숫자만 String()으로
//  삽입하므로 인젝션 표면 0, T-24-04 유지. label과 showQ 동시면 label 우선.)
(typeof input.label === 'number'
  ? `<text x="16" y="21" text-anchor="middle" font-size="13" font-weight="bold" font-family="sans-serif" fill="#ffffff">${String(input.label)}</text>`
  : '')
```

### 임시 plan 진행 구독 (island 내 — iOS subscribePlanProgress 계약 미러)
```ts
// 생성 트리거 시에만 열고 done/error에서 정리. moa:{tripId} 채널과 별개(broadcast 전용).
const client = getSupabaseBrowser();
const channel = client.channel(planChannelName(trip.id)); // 'plan:' + tripId (@moajoa/core)
channel
  .on('broadcast', { event: 'progress' }, ({ payload }) => {
    setPlanStep(payload.step as PlanStepType); // loading|clustering|routing|done|error
    if (payload.step === 'done' || payload.step === 'error') {
      void client.removeChannel(channel);
    }
  })
  .subscribe();
const result = await generatePlan(client, { trip_id: trip.id, travel_mode: mode });
// result: { plan_id, day_count, placed_count, unplaced_count } — 최종 상태는 promise가 보장
```

### Day 그룹 파생 (plan-section 내 — 쿼리 0)
```ts
const plan = await getPlanByTrip(client, tripId); // PlanWithItems | null
const placedIds = new Set(plan?.plan_items.map((i) => i.place_id) ?? []);
const pool = places.filter((p) => !placedIds.has(p.id)); // '아직 안 넣은 곳 N' (D-17)
const dayCount = plan ? Math.max(...plan.plan_items.map((i) => i.day_index), 0) + 1 : 0;
const byDay = (d: number) =>
  plan!.plan_items.filter((i) => i.day_index === d).sort((a, b) => a.sort_order - b.sort_order);
```

## 레퍼런스 시각 분석 (IMG 실측 — 이미지 직접 확인)

| 요소 | 레퍼런스 실측 | 매핑 (토큰만) |
|------|--------------|---------------|
| 스텝 헤더 | 좌 ← chevron(neutral-900) · 우상단 `N/총` 파란 숫자 | chevron 기존 + `text-brand-500` 카운터 |
| 중앙 아이콘 | 이모지/일러스트 1개 (지구·달력·선글라스) | 이모지 텍스트로 충분 — 신규 에셋 0 |
| 타이틀 | 큰 굵은 중앙 1~2줄 ("여행 기간은?") | `text-2xl font-bold text-center` 급 |
| 서브카피 | 회색 1줄 ("원하는 기간을 선택해 주세요.") | `text-neutral-400~500 text-center` |
| pill (비선택) | 연회색 채움 stadium, 테두리 거의 없음, 진회색 텍스트, 2열, 높이 큼(≈56-64px) | `bg-neutral-50/100 rounded-full text-neutral-700` |
| pill (선택) | **흰 배경 + 파란 테두리 + 파란 굵은 텍스트** (IMG_2920) | `bg-white border-brand-500 text-brand-500 font-semibold` |
| CTA 비활성 | 연파랑 채움 + 흰 글씨 (IMG_2918/2919) | `disabled:bg-brand-300 text-white` — 기존 Button과 근사(더 연하게는 brand-200 재량) |
| CTA 활성 | 진파랑 풀폭 (IMG_2920) | 기존 `bg-brand-600` |
| 결과 화면 | 타이틀("오사카, 3박 4일 추천일정입니다.") · 지도(그날 번호 핀) · Day pill 탭 스트립(선택=파랑 채움) · 번호 뱃지 세로 타임라인 + 장소 카드 · 하단 '새로운 추천받기' | Day 탭 = 선택 `bg-brand-500 text-white` / 비선택 outline. 번호 뱃지 = 원형 + `sort_order+1` |
| 참고 | IMG_2920 서브카피 "다중 선택이 가능해요"는 트리플 사양 — MOAJOA companion은 단일 선택(≤20자) 유지, 리스타일만 | D-04는 시각만 잠금 |

## State of the Art

| Old Approach (현재 코드) | Current Approach (이 phase) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 날짜 null → EF 무조건 1일 | `day_count` fallback | 0031 + EF 2줄 | 날짜 미정 모아도 N-Day 일정 |
| 캘린더가 날짜 스텝 1차 UI | 기간 pill 1차 + 캘린더 escape hatch | D-06/07 | 캘린더 코드 폐기 아님 — 진입점 이동 |
| 점 인디케이터 | chevron + `N/총` | D-02 | pushState 로직 무변경 |
| 웹에 플랜 UI 없음 | place-sheet Day 그룹 | D-15 | plans 래퍼 8종 첫 웹 소비자 |

**Deprecated/outdated:** 없음 — 이 phase가 버리는 라이브러리/패턴 없음. vaul(드래그 시트) 비채택은 Phase 24에서 이미 결론(unmaintained).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase↔GitHub 통합이 main push 시 **EF도** 자동 배포한다 (마이그레이션 자동 적용은 0028·0029로 실증, EF는 미실증) [ASSUMED] | Pitfall 8 | 라이브 fallback 미반영 — human-action `supabase functions deploy generate-plan`으로 무조건 커버하면 리스크 0 |
| A2 | resolve-place EF가 대부분의 검색 결과에 location(lat/lng)을 반환한다 (add-sheet가 이미 그렇게 소비 중이라는 코드 정황) [ASSUMED] | Pitfall 3 | location null 비율이 높으면 D-19 "AI가 배치"가 자주 불성립 — (0,0) 구분 표기로 완화 |
| A3 | 레퍼런스 pill/CTA의 파란 계열이 기존 brand 토큰(200/300/500/600)으로 충분히 근사된다 [ASSUMED — 시각 판단] | 레퍼런스 분석 | 미묘한 톤 차이 — 신규 hex 금지 규약상 토큰 내 선택만 허용, UAT에서 확인 |
| A4 | day_count 상한 CHECK(≤30)가 프롬프트·비용 방어로 적절하다 [ASSUMED — 제안값] | Code Examples | 상한 불요 판단 시 CHECK 제거해도 성립 |

## Open Questions (RESOLVED)

> **상태: 전부 해소됨** (2026-07-13, 플랜 작성 시 확정). Q1~Q5 각 항목 끝에 **→ 결정** 줄로 최종 채택안과 출처 플랜을 기록한다. 이 섹션은 이제 이력이며, 실행 계약은 각 PLAN.md가 소유한다.

1. **D-21 "수동 배치 Day 고정" 계약 — 옵션 3종 (플래너가 설계·확정)**
   - What we know: EF는 draft를 delete→재insert(멱등 덮어쓰기). plan_items에 수동 마커 없음(`moveToDay`→`is_anchor:false`). `anchor_place_ids`는 배치만 보장, Day는 미보장. 프롬프트는 anchor를 "[필수/ANCHOR]" 태그로만 주입.
   - Options:
     - **(a) 권장 — 요청 힌트 확장:** `moveToDay`가 `is_anchor:true`로 기록(1줄) + 재생성 시 클라이언트가 현 플랜에서 `is_anchor` 항목의 `{place_id, day_index}`를 모아 EF RequestSchema의 additive 필드 `pinned_placements`(default [])로 전달 + 프롬프트에 "place X MUST be in day Y" 제약 + `validatePlanIds` 확장으로 사후 강제(LLM 불복 시 해당 Day로 강제 이동). 스키마(DB) 추가 0, core `GeneratePlanRequestSchema` 짝 변경. is_anchor 의미가 "필수+Day 고정"으로 확장됨을 doc 주석으로.
     - (b) EF가 기존 plan_items 중 수동분을 보존(부분 덮어쓰기): 수동 마커 컬럼이 없어 **식별 불가** — plan_items에 컬럼 추가 시 마이그레이션 1개 더(범위 확대). 비권장.
     - (c) 클라이언트 사후 복원: 재생성 응답 후 클라가 moveToDay로 되돌림 — 레이스·깜빡임·Routes leg 불일치. 비권장.
   - Recommendation: (a). 단 웹 UI에 setAnchor(필수 별)를 이 phase에서 노출하지 않는다면 is_anchor의 유일한 쓰기 경로가 moveToDay가 되어 의미 충돌도 없음.
   - **→ 결정: 옵션 (a) 채택.** `28-03-PLAN.md` `<objective>` + Task 1/2/3이 계약 전문을 소유(`moveToDay`→`is_anchor:true` · `pinned_placements` additive 요청 필드 · 프롬프트 제약 · `enforcePinnedPlacements` 사후 강제 · EF의 `is_anchor` 재기록으로 루프 폐쇄). DB 마이그레이션 추가 0. ⚠ 단, "의미 충돌 없음"은 **웹에만** 해당 — iOS는 `setAnchor` 별표 UI를 노출하므로 iOS의 수동 배치가 필수 앵커로 승격된다(의도된 통일, 28-03 Task 1 doc 주석 + SUMMARY에 명시).
2. **editor 멤버의 D-13 기간 게이트 처리** — Pitfall 2의 (a)/(b) 중 확정. 권장: 게이트 UI는 owner 한정 + editor 안내 카피.
   - **→ 결정: owner 한정(A-9).** `28-05-PLAN.md` Task 1/3 — 비-owner는 '일정 만들기' disabled + `호스트가 여행 기간을 정하면 일정을 만들 수 있어요` 카피, DurationGateSheet를 열지 않는다. 근거: `trips` UPDATE RLS가 owner 전용(0016)이라 editor의 `day_count` 저장은 조용히 0행 갱신된다. 신규 RLS로 editor에 여는 것은 범위 밖(보안 표면 확대 금지, T-28-18/25).
3. **day_count·정확 날짜 동시 존재 시 정합** — Pitfall 7. 권장: 캘린더 확정 시 day_count를 파생값으로 동시 갱신(EF fallback 순서는 D-09 그대로).
   - **→ 결정: 파생 저장 채택.** `28-04-PLAN.md` Task 1이 계약 소유 — "day_count는 항상 채운다. 캘린더로 정확한 날짜를 정하면 day_count를 그 범위에서 파생시켜 함께 저장한다." EF fallback 순서(`trip.day_count ?? computeDayCount`)는 D-09 그대로 단일 유지.
     ⚠ **후속 발견(플랜 체커 BLOCKER):** 캘린더 range에는 길이 상한이 없어 파생 day_count가 0031 CHECK(1..30)를 넘길 수 있었다. 상한을 `Limits.TripDayCountMax`(=30, `packages/core/src/constants.ts`, 28-01) **단일 소스**로 정의하고 캘린더 `max` → Zod `.max()` → DB CHECK 세 곳이 같은 숫자를 쓰도록 잠갔다(28-01 Task 1 · 28-04 Task 1/2/3).
4. **ONBOARD-04 '미정' 경로의 잔존 형태** — 레퍼런스에 미정 선택지 없음. 기간 pill 아래 '나중에 정할게요' 텍스트 버튼으로 유지 권장(기존 요구사항 보존). 완전 제거 시 ONBOARD-04 회귀 — 제거하려면 REQUIREMENTS 갱신 필요.
   - **→ 결정: '나중에 정할게요' 존치(A-8).** `28-04-PLAN.md` Task 2 — 기간 pill 그리드 아래 text 버튼으로 유지, acceptance가 `grep -c '나중에 정할게요' → 1`로 강제. REQUIREMENTS 갱신 불필요(ONBOARD-04 무회귀).
5. **[일정] 영역의 시트 내 배치** — PlaceList(모으기 리스트)와 Day 그룹의 상하 관계·전환(토글 vs 연속 스크롤). CONTEXT는 "[모으기] 시트 안에서 장소가 Day별로 묶여 표시"라고만 잠금 — 플랜 미생성 시 기존 리스트 그대로 + 생성 후 Day 그룹이 리스트를 대체/상단 점유하는 안이 자연스러움. 플래너 확정.
   - **→ 결정: 연속 스크롤 + 상단 점유(A-12).** `28-06-PLAN.md` Task 2(f) — `PlanSection`을 `PlaceSheet` children **최상단**(PlaceList 위)에 삽입. 플랜 없으면 [일정] 빈 상태 카드 + 기존 PlaceList, 플랜 있으면 Day 그룹 + 미배치 풀(PlaceList 재사용). 배치+미배치 합집합 = 전체 places라 정보 손실 0. 신규 탭·라우트 0(D-15/HC-4), `place-sheet.tsx` diff 0(HC-5).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | 전체 | ✓ | v22.22.3 | — |
| pnpm | 전체 | ✓ | 9.12.0 | — |
| supabase CLI | 0031 reset·typegen·EF serve | ✓ | 2.107.0 | — |
| docker (colima) | 로컬 supabase 스택 | **✗ (colima not running)** | — | `colima start` 후 `supabase start` — 실행 전 필수 human/auto 액션 |
| react-day-picker | D-07 캘린더 | ✓ | 9.14.0 | — |
| NEXT_PUBLIC_GOOGLE_MAPS_KEY | 지도 | ✓ (기존 표면 동작 중) | — | — |
| ANTHROPIC_API_KEY·GOOGLE_PLACES_SERVER_KEY (EF secrets) | generate-plan | ✓ (Phase 18부터 라이브) | — | — |
| 원격 Supabase (xfoauhsraguyrifingct) | 0031 push·EF deploy | ✓ (링크됨) | — | main push 자동 적용(마이그레이션) / EF는 A1 참조 |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** colima/docker 다운 — `colima start` 1회로 해소(메모리 노트 선례). `supabase db reset`·`pnpm supabase:types`·스모크 전 선행.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (web: jsdom + @testing-library, api/core: node) |
| Config file | `apps/web/vitest.config.ts` (include `__tests__/**` — 테스트는 반드시 `apps/web/__tests__/`에, 25-02/25-04 선례) |
| Quick run command | `pnpm --filter @moajoa/web test -- --run <파일>` |
| Full suite command | `pnpm --filter @moajoa/web test -- --run` + `pnpm --filter @moajoa/api test` + `pnpm --filter @moajoa/core test` + `pnpm --filter @moajoa/ios test`(무회귀 확인용) |

### Phase Requirements → Test Map (Requirement ID TBD — SC 기준)
| Req | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | 스텝 헤더 `N/총`·중앙 타이틀·2열 pill·CTA 상태 | unit (jsdom) | `pnpm --filter @moajoa/web test -- --run __tests__/onboarding.test.tsx` | ✅ 기존 파일 확장 + ❌ pill 컴포넌트 신규(Wave 0) |
| SC-2 | 기간 pill→buildDraft day_count / 캘린더→start·end(+파생 day_count) | unit (순수 매퍼) | `pnpm --filter @moajoa/web test -- --run __tests__/build-draft.test.ts` | ✅ 기존 5케이스 확장 |
| SC-2 | core day_count 스키마 파스/거부 | unit | `pnpm --filter @moajoa/core test` | ✅ trip.test.ts 확장 |
| SC-2 | updateTrip day_count passthrough | unit (mock chain) | `pnpm --filter @moajoa/api test` | ✅ trips.test.ts 확장 |
| SC-3 | AddContentTabs 재사용 diff 0 | grep gate | `git diff --stat -- apps/web/components/add-content-tabs.tsx` = 빈 출력 | — (acceptance) |
| SC-4 | Day 그룹·타임라인·풀 파생·생성 게이트(D-13/14) | unit (jsdom, plan fixture) | `pnpm --filter @moajoa/web test -- --run __tests__/plan-section.test.tsx` | ❌ 신규(Wave 0) |
| SC-4 | EF fallback (day_count 우선·null이면 기존) | Deno test | `deno test supabase/functions/generate-plan/` (기존 pipeline 테스트 하네스 있으면 확장, 없으면 computeDayCount 경로는 통합 스모크) | 요확인 — 18 EF 테스트 존재 여부는 플래너가 `ls supabase/functions/generate-plan/*test*`로 |
| SC-5 | 검색 추가 Day 질문/모르겠다 분기 + 카피 4곳 | unit (jsdom) | add-sheet/plan-section 테스트 확장 | ✅/❌ 혼합 |
| SC-6 | iOS·기존 마이그레이션 diff 0 | grep gate | `git diff --stat -- apps/ios supabase/migrations/00{16..30}*` 빈 출력 + ios 스위트 그린 | — (acceptance) |
| 라이브 | 실 generate-plan N-Day 생성·진행 broadcast | manual-only | 로컬 supabase + functions serve 스모크 → 배포 후 UAT | 정당화: 유료 API·realtime — jsdom 불가 |

### Sampling Rate
- **Per task commit:** 해당 영역 파일 단위 `--run` 실행
- **Per wave merge:** web+api+core 전 스위트 `--run` + `tsc --noEmit` + `next build`
- **Phase gate:** 전 스위트(core·api·web·ios) 그린 + build PASS + grep 게이트(iOS diff 0·기존 마이그레이션 무수정·`.js` import 0·신규 hex 0) → `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/web/__tests__/plan-section.test.tsx` — SC-4 Day 그룹/게이트 (plan fixture 포함)
- [ ] `apps/web/__tests__/select-pill.test.tsx`(신규 컴포넌트 채택 시) — SC-1 선택 상태
- [ ] `apps/web/__tests__/duration-gate-sheet.test.tsx` — D-13 게이트
- [ ] 프레임워크 설치: 불필요(기존 하네스)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (기존 세션 재사용) | — |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | EF can_edit_trip 서버 재검증(기존 T-18-09, 무변경) · trips UPDATE owner-only RLS(Pitfall 2 — 완화 아닌 준수) · moveToDay 등 plan_items RLS(0017) 경유 |
| V5 Input Validation | **yes** | 클라 경계 Zod(`TripCreateDraftSchema`·`GeneratePlanRequestSchema`) + EF 내 RequestSchema 재선언 미러 — `pinned_placements` 확장 시 **양쪽 짝 변경** + uuid array 검증 |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| day_count 스푸핑(요청 바디로 Day 수 조작 → 프롬프트 비용 부풀리기) | Tampering/DoS | day_count를 **요청 필드로 받지 않음** — EF가 trips 행에서 읽음(§Code Examples 주의) + 0031 CHECK 상한 |
| pinned_placements로 임의 place_id 주입 → FK 위반/타 trip 장소 참조 | Tampering | EF에서 placeable 집합과 교집합 검증(validatePlanIds 확장 — 기존 T-18-12 idiom 그대로) |
| 유료 EF 연타(이중 지출) | DoS(비용) | 생성 중 버튼 비활성 + EF auth.getUser 게이트 기존(T-18-08) |
| 마커 SVG 인젝션 | Injection | label은 number 타입만 + `String(n)` 삽입 — 사용자 문자열 삽입 금지 계약(T-24-04) 유지 |
| 서비스 롤 노출 | Info Disclosure | 변경 없음 — EF 내부 전용 유지(§4.4) |

## Sources

### Primary (HIGH confidence — 전부 코드베이스/레포 실측)
- `supabase/functions/generate-plan/index.ts`(전문)·`pipeline/claude.ts`(전문) — select L106·computeDayCount L291-298·dayCount 주입 L158·프롬프트 소비 지점·멱등 덮어쓰기 L237
- `supabase/migrations/0030_poll_write_hardening.sql`(존재 확인·commit 6dd8a95)·`0016_trips_baseline.sql` L186-191(trips RLS)·`0025` L25(companion)·`0027`(add_manual_place coalesce 0,0)
- `packages/api/src/queries/plans.ts`(래퍼 8종 전문)·`trips.ts`(createMoaDraft·updateTrip)·`places.ts`(addManualPlace·hidePlace)
- `packages/core/src/schemas/trip.ts`·`plan.ts`·`constants.ts`(PlanStep·PLAN_STEP_KO·planChannelName)
- `apps/web/app/onboarding/page.tsx`·`step-*.tsx`·`_lib/build-draft.ts`·`components/add-content-tabs.tsx`·`chip.tsx`·`button.tsx`
- `apps/web/app/moa/[id]/_components/`(moa-island·place-sheet·place-list 판별식 L96-110·moa-map·moa-tab-bar·add-sheet·share-sheet)·`lib/marker-svg.ts`
- `apps/ios/app/trip/[id]/(tabs)/plan.tsx`(읽기 전용 analog — 상태기계 A~F·subscribePlanProgress 계약)
- `references/add_trip/IMG_2918~2920·2922·2923·2925.PNG`(이미지 직접 판독)
- `.planning/phases/28-add-trip-redesign-ai/28-CONTEXT.md`·`.planning/ROADMAP.md` Phase 28·`.planning/STATE.md`·`24-RESEARCH.md`·`18-RESEARCH.md`(pitfall 승계)
- `packages/ui-tokens/src/index.ts`(brand 스케일)·`apps/web/vitest.config.ts`·워크스페이스 package.json 3종

### Secondary (MEDIUM)
- 없음 — 외부 웹 리서치 불필요(신규 라이브러리 0)

### Tertiary (LOW)
- 없음

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 신규 도입 0, 전부 설치·버전 실측
- Architecture: HIGH — 모든 재사용 표면·계약을 파일 단위로 확인, D-21만 설계 열림(옵션 정리로 플래너 인계)
- Pitfalls: HIGH — 0030 점유·RLS owner-only·(0,0) coalesce·fitBounds 조건·제스처 주석까지 라인 단위 실측. A1(EF 자동 배포)만 ASSUMED

**Research date:** 2026-07-13
**Valid until:** 2026-08-13 (내부 코드 기준 — 단 다른 phase가 마이그레이션 번호를 추가로 점유하면 0031도 재확인)
