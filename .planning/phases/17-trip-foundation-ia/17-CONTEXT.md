# Phase 17: Trip Foundation & IA 재편 - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

여행을 일급 컨텍스트로 만들고, 앱 진입을 `trip/[id]/(tabs)/{지도·플랜·예약·가계부}`로 재편하며, **모든 후속 phase(18~21)가 import할 트립 스코프 식별자 계약**(`trip_id`, `buildAffiliateUrl`/SubID)을 `packages/core`에 잠근다. "일정 정해짐" 경로로 날짜·도시·대표를 입력해 여행을 생성한다.

SUMMARY의 **비협상 첫 번째(Phase A)** — 의존 없음. 플랜 생성(18)·날짜 투표(19)·예약(20)·가계부(21)는 모두 이 phase가 잠그는 계약 위에 얹힌다.

**In scope:** 0016/squash 마이그레이션 + core Zod 식별자 계약(동일 PR) · `buildAffiliateUrl` + SubID 포맷 계약 · Expo Router 4탭 재편 + 0/1/N 진입분기 + 헤더(여행 전환/프로필) · "일정 정해짐" 트립 생성 UI(날짜·도시·대표) · 미정 분기 "준비 중" 스텁 · 옛 라우트 클린 브레이크.

**Out of scope (다른 phase):** AI 플랜 생성(18) · 날짜 투표 구현(19) · 예약 카드/redirect EF/click 민팅(20) · 가계부(21) · Android(22).
</domain>

<decisions>
## Implementation Decisions

### Trip ↔ Board 데이터 모델 (식별자 계약)
- **D-01:** trip = board, **1:1**. `trip_id`가 캐노니컬 트립 스코프 식별자이며 board의 id와 동일 개념. 한 여행 = 한 장소 묶음 = 한 trip.
- **D-02:** DB 테이블을 **`boards` → `trips`로 물리 rename**. 신규 코드는 trip 어휘 사용. `packages/core`는 `Trip`/`TripId`를 캐노니컬로 노출.
- **D-03:** 마이그레이션 전략 = **스키마 squash/리셋(trips-native)**. 0001~0015를 trips 중심 단일 깨끗한 스키마로 압축. **기존 도그푸딩 데이터 전소실을 사용자가 명시 승인.**
  - ⚠️ **CLAUDE.md §4.3/§5 append-only 규칙을 이번 마일스톤 리셋에 한해 의도적으로 override.** 사용자 발언: "기존 데이터, 데이터 구조 전면 재구축 상관없음." 플래너는 이를 일회성 squash로 처리하고, RLS 헬퍼(SECURITY DEFINER, 기존 0002·0005 패턴)·트리거·`join_shared_board`(0009)·뷰(0013)를 새 trips 스키마로 이전해야 한다. 이후 마이그레이션은 다시 append-only.
  - 재적용 영향: 로컬/Supabase DB를 reset해야 함(Windows 동료 포함). 외부 사용자 0명이라 감당 가능.

### SubID / 어트리뷰션 포맷 (ATTR-01, Day1 잠금 — 변경 불가)
- **D-04:** SubID 컨텍스트 = **`tripId.placeId.userId`** (placeId는 optional — eSIM·교통 등 장소 없는 예약은 생략). 추출→플랜→예약→가계부 루프를 같은 trip/place/user로 완전 매칭 (Pitfall 9).
- **D-05:** 인코딩 = **opaque click 토큰**. SubID = 짧은 토큰(예: `c_<base62>`). `booking_clicks` 행이 `{trip_id, place_id?, user_id, provider, created_at}` 보유 → 네트워크 리포트가 SubID 반환 시 정확 매칭, 길이 제약 안전, 클릭 서버 로깅 내장.
- **D-06:** **Phase 17이 잠그는 것 = 계약만**: `buildAffiliateUrl(provider, productParams, subId)` 시그니처 + 토큰 포맷 + `BookingClickContext`(`{tripId, placeId?, userId}`) Zod 타입 + 프로바이더별 SubID 주입 위치(Travelpayouts `marker=ID.subID`, Stay22 campaign/AID + claimed domain). **손조립 절대 금지** (Pitfall 1).
- **D-07:** 토큰 **민팅(booking_clicks INSERT) + redirect EF**는 Phase 20. 단 squash(D-03) 때문에 **빈 `booking_clicks` 테이블은 Phase 17 리셋 스키마에 포함**하는 것이 깔끔 — 최종 위치는 plan-phase 판단.
- 네트워크 길이/charset 정확 한도는 **plan-phase 실측**(로드맵 명시). 안전 인코딩(base62, 특수문자 X, 길이 bound) 가정.

### "일정 정해짐" 여행 생성 입력 (SETUP-01/02)
- **D-08:** 도시 입력 = **프리셋 리스트(일본 도시: 도쿄·오사카·교토 등) + "기타"**. `city_code` 깨끗하게 유지. Google Autocomplete는 Phase 2(다시장).
- **D-09:** 날짜 = **범위 필수(시작~종료)**. "정해짐" 경로의 정의가 날짜이므로 필수. 당일치기 = 종료=시작 허용. (미정과 명확히 구분.)
- **D-10:** 대표(결제자) = **생성자 자동 대표**. 생성 시 본인이 유일 멤버. `trips.representative_id` FK(→ profiles). 재지정은 나중(헤더/멤버 초대 이후).
- **D-11:** "일정 정해졌나요?" **분기는 노출**하되, 미정 탭은 **비활성 + "곧 제공" 안내**(Phase 19가 채움). IA 완성도 유지.

### 기존 링크 호환 & 라우트 (NAV-04 — 재해석)
- **D-12:** NAV-04 = **"라우트 위생"으로 재해석** (데이터 복구 아님). Area A 데이터 리셋 승인으로 되살릴 행 없음.
- **D-13:** 옛 라우트 = **클린 브레이크**. 앱 `boards/[id]` 제거 → `trip/[id]`로 전환. `share-handler`(Phase 16)를 trip 플로우로 repoint. 레거시 리다이렉트 alias 없음(외부 사용자 0명).
- **D-14:** 웹 공개 공유 라우트 = **`/b/[slug]` → `/t/[slug]`(또는 `/trip/[slug]`)로 변경**. slug는 `trips`에 위치. SSR 열람 코드 라우트 이동 필요.
- **D-15:** ⚠️ **결과: ROADMAP Phase 17 Success Criterion #5 / 요구사항 NAV-04("기존 공유 링크가 깨지지 않고 열린다")는 문자 그대로는 충족되지 않음.** 사용자가 외부 사용자 부재를 근거로 사실상 waive. **플래너·verifier는 #5를 하드 게이트로 삼지 말 것.** 권장: ROADMAP 성공기준 #5 + REQUIREMENTS NAV-04를 "라우트 위생(옛 URL 패턴 제거/이전, 신규 공유 경로 동작)"으로 갱신.

### Claude's Discretion
- 4탭 진입 시 기본 착지 탭: PRODUCT §6 = `plan`. Phase 17에선 플랜이 비어 있으므로(18이 채움) **plan 탭 + "추출하면 플랜이 생겨요" 빈 상태**로 착지. (PRODUCT가 결정 — 재논의 불요.)
- "마지막 본 여행"(N개 진입) 영속화 위치: 로컬(AsyncStorage) vs `profiles` 컬럼 — 플래너 판단. 로컬이 단순.
- 토큰 base62 구현 세부, RLS 헬퍼 재구성 방식, 프리셋 도시 목록 정확한 항목.

### Folded Todos
없음 — 매칭된 todo 3건(`eas-ios-sharesheet-verify`, `maplink-place-enrichment`, `transcript-fallback-no-description`)은 모두 추출/공유 인프라 관련으로 Phase 17 스코프(기반·IA·식별자) 밖. (cross-reference 매칭 점수 미달, deferred 처리.)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 제품·IA 결정 (단일 출처)
- `docs/PRODUCT.md` §6 — 네비게이션/IA 결정 (하단 4탭, 1개 바로 진입, 새 여행=컨텍스트 액션, 헤더 전환/프로필, 진입 로직, `trip/[id]/(tabs)/{map,plan,book,ledger}`)
- `docs/PRODUCT.md` §7 — 핵심 UX 결정 (추출 즉시 플랜, 투표 옵션)
- `docs/PRODUCT.md` §11 — 주요 결정 로그 (FAB 제거, 1개면 바로 진입)

### 요구사항·로드맵
- `.planning/REQUIREMENTS.md` NAV-01..04 / ATTR-01 / SETUP-01,02 — 본 phase 요구사항 (단, NAV-04는 D-15대로 재해석)
- `.planning/ROADMAP.md` Phase 17 — Goal / Success Criteria (단, #5는 D-15대로 waive)

### 식별자 계약·어트리뷰션 (비협상 핵심)
- `.planning/research/PITFALLS.md` Pitfall 1 — SubID 누락 → 수수료 Unknown. `buildAffiliateUrl` 단일 헬퍼, Day1 포맷, exit gate = 전환 1건 SubID 어트리뷰션
- `.planning/research/PITFALLS.md` Pitfall 8 — 보드↔trip 매핑 + 옛 링크 리다이렉트 + 0/1/N 진입 엣지
- `.planning/research/PITFALLS.md` Pitfall 9 — 추출→플랜→예약→가계부 식별자 단절. `tripId[.placeId][.userId]`, 모든 행이 trip_id(+place_id) 보유
- `.planning/research/SUMMARY.md` — Phase A 기반 정의 + 식별자 계약 전제 + Stay22 Allez(AID)/Travelpayouts(marker) 딥링크

### 코드 계약
- `packages/core/src/schemas/board.ts` — 현 Board Zod (이미 city_code·start/end_date·share_slug·cover 보유 — trips로 rename 시 기준)
- `packages/core/src/constants.ts` — BoardVisibility·Limits (trip 어휘로 이전)
- `supabase/migrations/0002_fix_rls_recursion.sql`, `0005_*`, `0009_join_shared_board.sql`, `0013_public_view_place_detail.sql` — squash 시 새 trips 스키마로 반드시 이전할 RLS 헬퍼·뷰·공유 함수 패턴
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/core/src/schemas/board.ts`: Board 스키마가 이미 trip 모양(city_code/start_date/end_date/share_slug/cover_image_url) → trips로 rename + `representative_id` 추가만 하면 됨. 데이터 모델 신규 설계 불필요.
- `apps/ios/app/index.tsx`: 현 진입 분기(세션 유무 → `(tabs)/boards` vs `welcome`). 0/1/N trip 분기로 확장하는 자리.
- `apps/ios/app/(tabs)/_layout.tsx`: 현 전역 탭(boards/discover/me/friends/new) + 가운데 ＋ FAB. → `trip/[id]/(tabs)/{map,plan,book,ledger}`로 통째 교체, **FAB 제거**(새 여행=헤더/온보딩 액션).
- `apps/ios/app/share-handler.tsx` + `+native-intent.tsx`: Phase 16 공유 인입 경로. trip 플로우로 repoint 대상.
- RLS SECURITY DEFINER 헬퍼 패턴(0002·0005): squash 후 trips 스키마에 동일 패턴으로 재구성 (직접 EXISTS 금지, 헬퍼 경유 — CLAUDE.md §4.4).

### Established Patterns
- 마이그레이션 NNNN 단조 증가 + append-only → **이번만 squash 예외**(D-03). 이후 재개.
- `packages/core` 단일 헬퍼로 외부 계약 강제(외부 입력 Zod validate) → `buildAffiliateUrl`도 동일 원칙(손조립 금지).
- 워크스페이스 import에 `.js` extension 금지 (Turbopack).

### Integration Points
- `trip_id` FK: Phase 18 plan 슬롯, Phase 20 booking_clicks, Phase 21 ledger 행이 모두 import.
- `buildAffiliateUrl`/`BookingClickContext`: Phase 20이 소비.
- `/t/[slug]` 공개 라우트: Phase 19 웹 비로그인 투표가 재사용.
- `share_slug` + `join_shared_board`: Phase 19 초대 링크가 재사용 (squash 시 보존 필수).
</code_context>

<specifics>
## Specific Ideas

- 일본(도쿄) 우선 시장 → 도시 프리셋도 일본 중심.
- "추출 즉시 플랜" 철학상 진입은 plan 탭이지만 Phase 17 단계에선 빈 상태 — 빈 상태 카피가 다음 액션(추출/공유)을 유도해야.
- SubID는 "전환 1건이 우리 SubID로 대시보드에 찍힌다"가 Phase 20 exit 기준 — Phase 17은 그 포맷이 손조립 불가능하도록 구조적으로 잠그는 게 목적.
</specifics>

<deferred>
## Deferred Ideas

- Google Places Autocomplete 도시 입력 — Phase 2(다시장 확장).
- 멀티시티 trip(여러 city_code) — 현재 단일 도시. 추후.
- 대표 재지정 UI / 멤버 초대 — Phase 19(투표·초대) 이후.
- 옛 `boards/[id]` 리다이렉트 alias — 외부 사용자 생기면 재고(현재 클린 브레이크).

### Reviewed Todos (not folded)
- `eas-ios-sharesheet-verify.md` — 공유시트 EAS 검증. 추출/공유 인프라, Phase 17 밖.
- `maplink-place-enrichment.md` — place 보강. 추출 파이프라인, Phase 17 밖.
- `transcript-fallback-no-description.md` — 추출 fallback. 추출 정확도, Phase 17 밖.
</deferred>

---

*Phase: 17-trip-foundation-ia*
*Context gathered: 2026-06-21*
