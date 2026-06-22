# Phase 18: Auto Plan (추출 즉시 AI 플랜) - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

trip의 추출된 장소로 **AI 플랜 초안**(동선·날짜별 일정)을 생성하고, 사용자가 장소를 추가/제거/드래그 재배치하며, 일정 항목 사이에 **이동시간이 Routes로 그라운딩**된다. "필수 장소"로 동선을 재구성하고, "친구와 같이 정하기"로 협업 투표 전환(옵션). Phase 17 식별자 계약(`trip_id`) + 플랜 탭 위에 얹힘. Phase 19와 병렬.

**In scope:** generate-plan EF(Claude 클러스터링/순서 + Routes 인접 후처리) · plans/plan_items 데이터 모델(0017) + 초안 상태 · plan.tsx 드래그 재배치 UI + "플랜 만들기" 버튼 + 미배치 풀 · 필수 장소 재구성 · 협업 전환 토글(플래그/공유만).

**Out of scope:** 실제 장소 투표 UI(기존 votes/Phase 19 재사용) · 신규 Google 검색 장소 추가 · 시간대 슬롯 · 영업시간 고려 · 예약 슬롯 연결(Phase 20).
</domain>

<decisions>
## Implementation Decisions

### 플랜 생성 트리거 & 타이밍
- **D-01:** ⚠️ **플랜 생성은 추출 직후 자동이 아님.** 한 trip에 블로그·영상 여러 개를 모을 수 있으므로, **plan 탭의 명시적 "플랜 만들기" 버튼**으로 사용자가 트리거한다. 그 시점 trip의 **전체 places**로 생성. 재생성도 같은 버튼.
  - ⚠️ **이는 PLAN-01 / ROADMAP Phase 18 성공기준 1("추출 완료 직후 사용자 조작 없이 플랜 탭에 나타난다")을 변경한다.** PRODUCT §7의 "추출 직후 = 즉시 AI 플랜"도 "추출은 장소를 모으고, 플랜은 사용자가 명시적으로 생성"으로 재해석. **플래너·verifier는 성공기준 1을 '자동'으로 게이트하지 말 것.** 권장: ROADMAP 성공기준 1 + REQUIREMENTS PLAN-01 + PRODUCT §7을 "사용자가 plan 탭에서 플랜 생성을 트리거"로 갱신.
- **D-02:** `generate-plan` EF는 **클라이언트가 명시적으로 호출**(버튼). 진행은 extract-youtube의 `broadcastStep` 패턴을 확장해 진행률을 emit하고, plan 탭에 **스켈레톤 + 실시간 진행률**을 표시한다. (broadcast 채널 키는 trip 스코프 — link_id가 아니라 trip_id 기준으로 결정 필요.)

### AI 플랜 구성 로직 ("좋은 플랜")
- **D-03:** 날짜 분배 = **지리 클러스터 우선**(같은 동네=같은 날) → 이동 동선 최소화. trip 날짜 범위(start/end_date, Phase 17 D-09)로 N일 결정.
- **D-04:** 하루 장소 수 = **소프트 상한(권장 4~5, 넘으면 다음 날로 분배)**. trip 날짜 범위 내에서. 초안이니 사용자 조정 가능.
- **D-05:** 포함 범위 = **AI 선별 + 미배치 풀**. Claude가 핵심 장소를 일정에 배치, 나머지는 "추가 가능" 풀로 둔다. 중복(같은 `google_place_id`)은 병합.
- **D-06:** 구성 요소 = **동선 우선 + 가벼운 카테고리 믹스**(하루가 맛집만/관광만 쏠리지 않게). 시간대 슬롯(조식·야경)은 V2.

### 이동시간 그라운딩 & 이동수단
- **D-07:** Routes 범위 = **인접 항목 간만**(같은 날 순서상 연속, N-1 호출). 드래그 재배치 시 해당 구간만 재계산. 비용 예산 <$0.005/플랜 (정확 비용은 plan-phase 실측).
- **D-08:** 이동수단 = **플랜별 사용자 토글**(전철/도보/차). **기본값 = 대중교통(transit)**(일본 도시 자유여행). 토글 시 해당 플랜 이동시간 재계산. 짧은 구간 도보 fallback은 Claude's Discretion.
- **D-09:** 좌표 없는(`(0,0)`) 장소 = **자동배치 제외 → 미배치 풀**(ROADMAP 성공기준 4 + Phase 17 MR-01).

### 편집·재생성·영속화·협업
- **D-10:** '필수 장소' 재구성 = **AI 재호출**(필수 장소를 고정 앵커로 두고 나머지를 그 주변으로 재클러스터·재순서). "그 주변으로 동선 구성"(PLAN-03) 의미에 정확.
- **D-11:** 수동 편집 후 "플랜 다시 만들기" = **덮어쓰기 + 확인 모달**("초안을 다시 만들면 편집이 사라져요"). 단 필수 표시/제거한 장소는 재생성 입력으로 반영.
- **D-12:** 영속화 = **서버 테이블 `plans` / `plan_items`(0017 마이그레이션, append-only)**. `trip_id` FK, draft 상태, day/order. RLS는 trips DEFINER 헬퍼(0016) 재사용. 협업·멀티기기·Phase 20 예약 슬롯 연결에 필요.
- **D-13:** 장소 추가 소스 = **미배치 풀에서 끌어오기**(D-05와 일관). 신규 Google Places 검색 추가는 V2.
- **D-14:** 협업 전환(PLAN-05, 옵션) = **18은 "친구와 같이 정하기" 토글 + `plans.collaborative` 플래그 + 공유 자리만**. 실제 플랜 위 장소 투표는 **기존 votes 인프라 / Phase 19 재사용**. 옵션이라 최소 범위.

### Claude's Discretion
- generate-plan EF 내 Claude 프롬프트·클러스터링 구현 세부.
- 대중교통 기본값에서 짧은 구간 도보 fallback 임계.
- 스켈레톤/진행률 UI 세부, plans/plan_items 정확한 컬럼.
- broadcast 채널 키 네이밍(trip 스코프).

### Note — AI-system phase
이 phase는 Claude 클러스터링 + Routes 그라운딩의 AI 시스템이다. plan-phase가 `/gsd-ai-integration-phase`(프레임워크·eval 설계)로 라우팅을 제안할 수 있다. 프레임워크는 **Anthropic claude(제약상 확정)**. 관건은 **플랜 품질 eval**(동선 합리성·날짜 분배·미배치 풀 선별).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 제품·요구사항
- `docs/PRODUCT.md` §3(자동화 레이어), §7(핵심 UX — 단 "즉시 자동" 부분은 D-01로 재해석) — 플랜=발견 직후 핵심, 투표는 옵션
- `.planning/ROADMAP.md` Phase 18 — Goal + 성공기준 (단 성공기준 1은 D-01로 변경)
- `.planning/REQUIREMENTS.md` PLAN-01..05 (PLAN-01은 D-01로 재해석)

### 상위 계약 (Phase 17)
- `.planning/phases/17-trip-foundation-ia/17-CONTEXT.md` — trip_id 식별자 계약, trip 날짜 범위, plan 탭 기본 착지
- `packages/core/src/schemas/trip.ts` — start_date/end_date (N일 분배 입력)
- `packages/core/src/schemas/place.ts` — place 필드(lat/lng/category/name_*/source_timestamp/google_place_id) = 클러스터링 입력

### 추출·인프라 (generate-plan이 참고/재사용)
- `supabase/functions/extract-youtube/index.ts` — `broadcastStep`(realtime 진행률) 패턴, `status='ready'`, places upsert 시점. plan 트리거는 이 완료 후 사용자 버튼.
- `supabase/migrations/0016_trips_baseline.sql` — trips RLS SECURITY DEFINER 헬퍼 패턴(0017 plans 테이블이 재사용), votes 인프라(협업 재사용)

### 외부 API (plan-phase 실측)
- Google Routes API — 인접 이동시간 그라운딩. transit 모드 기본. 비용 vs <$0.005 검증.
- Anthropic claude (claude-sonnet-4-6) — 장소 클러스터링/순서. 프롬프트·eval은 AI-SPEC 단계.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extract-youtube`의 `broadcastStep(admin, key, step, pct)` — realtime 진행률. generate-plan EF가 동일 패턴으로 plan 생성 진행률 emit (단 채널 키는 trip 스코프).
- trips RLS DEFINER 헬퍼(`am_trip_*`/`can_*_trip`, 0016) — 0017 plans/plan_items RLS가 재사용 (직접 EXISTS 금지, CLAUDE.md §4.4).
- 기존 votes 인프라 — PLAN-05 협업 전환이 실제 투표를 위해 재사용.
- place 스키마 — 클러스터링 입력(좌표·카테고리·이름). `(0,0)`/`hidden_at`은 배치 제외.

### Established Patterns
- Edge Function = Deno runtime, service-role는 EF 내부에서만.
- 마이그레이션 append-only — 새 번호 `0017_*`. 0016 수정 금지.
- 외부 입력 Zod validate(@moajoa/core), 워크스페이스 import에 `.js` 금지.

### Integration Points
- `apps/ios/app/trip/[id]/(tabs)/plan.tsx`(Phase 17 빈 상태 스텁) → 18이 플랜 콘텐츠 + "플랜 만들기" 버튼 + 드래그 재배치 + 미배치 풀로 채움.
- 새 `supabase/functions/generate-plan/` EF (클라이언트 호출).
- `plans`/`plan_items` 0017 (trip_id FK, draft, day/order, collaborative 플래그).
- Google Routes API 키 — EAS env(EXPO_PUBLIC_* 아님, EF 서버 측).
</code_context>

<specifics>
## Specific Ideas

- 타깃 = 2030 한국인 일본 도시 자유여행객 → 동선 효율(같은 동네 같은 날) + 대중교통 기본이 현실.
- "초안" 명시가 핵심 — 사용자가 마음껏 고치는 출발점. AI는 완벽보다 합리적 시작점.
- 추출은 재료 모으기, 플랜은 사용자가 "이제 짜줘" 누르는 순간 — 여러 링크 모은 뒤 한 번에.
</specifics>

<deferred>
## Deferred Ideas

- 시간대 슬롯(조식/점심 맛집/야경) — V2 (영업시간 데이터 필요).
- 신규 Google Places 검색으로 장소 추가 — V2 (현재는 미배치 풀에서 추가).
- 전체 행렬(NxN) Routes 동선 최적화 — V2 (현재 인접만).
- 영업시간 고려한 배치 — V2.
- PLAN-05 실제 플랜 위 장소 투표 UI — 기존 votes/Phase 19 재사용 (18은 토글/플래그만).

### Reviewed Todos (not folded)
- 없음 — pending todo(공유시트·place 보강·추출 fallback)는 추출 인프라로 Phase 18 스코프 밖.
</deferred>

---

*Phase: 18-auto-plan-ai*
*Context gathered: 2026-06-22*
