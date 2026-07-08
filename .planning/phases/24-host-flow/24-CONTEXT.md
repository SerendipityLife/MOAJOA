# Phase 24: Host Flow (온보딩·지도탭) - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

호스트가 웹에서 전 흐름을 완주한다 — 로그인(카카오 포함) → `/onboarding` 4단계로 모아 생성 → `/moa/[id]` 지도탭에서 링크 자동 추출·구글 장소 검색 추가 → 순번·찜순·아코디언·사람별 색 리스트 → [함께 정하기] 공유링크 생성·복사.

**Requirements:** AUTH-07, ONBOARD-03, ONBOARD-04, ONBOARD-05, MOA-02, MOA-03, MOA-04, MOA-05, MOA-06, SHARE-01

**범위 외:** 게스트 공유화면 `/t/[slug]` 통합(Phase 25), 채팅(Phase 26), iOS 변경(전면 동결), 게스트 계정 승격.

</domain>

<decisions>
## Implementation Decisions

### 온보딩 구조·저장 시점
- **D-01 진입 분기:** iOS Phase 17 패턴 미러 — 로그인 직후 모아 0개→`/onboarding`, 1개→그 모아 `/moa/[id]`로 바로, 2개+→`/moa` 리스트.
- **D-02 라우트 구조:** `/onboarding` 단일 라우트 + 클라이언트 스텝 상태. 중간 상태 URL 유출 없음. 브라우저 뒤로가기는 직접 처리 필요.
- **D-03 생성 시점:** 4단계 입력을 모아 마지막 단계 완료 시 `TripCreateDraftSchema`로 한 번에 생성. 빈 모아 잔여 없음. 4단계의 링크·장소는 모아 생성 직후 일괄 addLink+추출 트리거.
- **D-04 중도 이탈:** 소실 허용 — 초안 보존(localStorage 등) 없음. 4단계는 1분 내외 분량.
- **D-05 도시 선택:** 단일 선택 — `CITY_KO_MAP` 칩 9개 중 하나 또는 기타 직접입력 1개. trips 스키마 city 단일 필드와 일치.
- **D-06 날짜 입력:** 확정 시 캘린더 range 픽커(한 캘린더에서 시작·종료 탭 2번). 미정 시 안내 한 줄 후 통과(dates null). 캘린더 컴포넌트는 신규 제작 또는 경량 라이브러리 — 플래너 재량.
- **D-07 누구랑:** 칩(혼자/연인/친구/가족/동료) + 기타 직접입력 — 도시 칩과 동일 패턴. 값은 0025 `trips.companion`(≤20자) 텍스트로 저장.
- **D-08 봐둔 곳:** 링크·장소 여러 개 담아두고 '완료'로 마무리 가능. 건너뛰기 허용(ONBOARD-05).

### 지도탭 레이아웃 (`/moa/[id]`)
- **D-09 모바일 배치:** 풀스크린 지도 + 드래그 바텀시트 장소 리스트(앵커 2~3단). 기존 `bottom-sheet` 컴포넌트 확장. 마커 탭→해당 행 스크롤+펼침(MOA-05)이 이 구조에서 자연스러움.
- **D-10 데스크톱:** 모바일 레이아웃 max-width 중앙 고정 — 구현 1벌. 유입 경로가 카톡 공유라 모바일 중심.
- **D-11 추가 진입점:** 하단 + 버튼 → 추가 바텀시트(링크 붙여넣기 / 장소 검색 탭 전환). 온보딩 4단계와 추가 UI 컴포넌트 재사용.
- **D-12 /moa 리스트:** 미니멀 — 모아 카드(이름·도시·날짜·장소 수) 목록 + 새 모아 CTA만. 이름 변경·삭제 등 관리 기능 없음.

### 링크 추출 진행 UX
- **D-13 진행 표시:** 추가한 링크가 리스트에 '분석 중…' 행으로 즉시 뜨고, 완료 시 장소 행들로 전환. 기존 link-list 패턴 유사.
- **D-14 완료 반영:** Supabase Realtime `postgres_changes` 구독(places/links). Phase 25(게스트 실시간 반영)·26(채팅) 인프라 선행 확보. **presence는 사용 금지**(supabase-js 알려진 이슈 — todo `supabase-js-upgrade-presence.md` 참조).
- **D-15 실패 처리:** 실패 링크 행 유지 + 재시도 버튼(기존 `retry-extraction-button` 재사용 가능). 장소 0개 추출도 동일 처리.
- **D-16 지도 반응:** 새 핀 생성 시 fitBounds 재조정 + '장소 N개 추가됨' 토스트.

### 함께 정하기 시트 + 핀 색
- **D-17 모드 선택 UI:** 바텀시트 3택 카드(날짜 정하기/장소 정하기/둘다, 각 한 줄 설명). 날짜 확정 모아는 '날짜 정하기' 숨김 → 2택 (Phase 23에서 클라이언트 몫으로 잠긴 사항의 구현).
- **D-18 공유 동작:** 클립보드 복사 기본 + 모바일이면 `navigator.share` 시스템 공유 시트 제공(카톡 도달 경로, 별도 SDK 없음).
- **D-19 재공유:** 이미 공유된 모아에서 시트를 열면 현재 mode 선택 상태로 표시, 다른 모드 선택 시 갱신+같은 링크 재복사. shareMoa 재호출 mode 갱신 계약(Phase 23 Open Q3)을 그대로 노출. slug 보존.
- **D-20 핀 색 배정:** 호스트=브랜드색 고정 + 참여자는 memberships join 순서대로 팔레트(6~8색) 순환 배정. **팔레트는 `packages/ui-tokens`에 정의**해 웹·iOS 공유 가능하게.

### Claude's Discretion
- 캘린더 range 픽커의 구체 구현(자체 제작 vs 경량 라이브러리) — D-06
- 바텀시트 앵커 단수(2단 vs 3단)와 드래그 물리 — D-09
- 스텝 인디케이터·전환 애니메이션 등 온보딩 시각 디테일
- Realtime 구독 채널 구성 세부(단, Phase 26 "한 토픽 채널 2개 금지" 교훈 — `moaChannelName` 규약 참고)
- 아코디언 상세의 정보 배치 순서(주소·구글맵 딥링크·출처 타임스탬프·답장 버튼은 MOA-05 필수 요소)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 제품·마일스톤
- `docs/PRODUCT.md` — 제품 단일 출처 (v2.1 지도탭·온보딩·함께 정하기 정의)
- `.planning/PROJECT.md` — v2.1 마일스톤 목표·범위 외·제약
- `.planning/REQUIREMENTS.md` — AUTH-07, ONBOARD-03..05, MOA-02..06, SHARE-01 원문

### Phase 23 산출물 (이 phase가 소비하는 계약)
- `.planning/phases/23-web-first-foundation/23-VERIFICATION.md` — 기반 검증 상태
- `supabase/migrations/0024_place_seq.sql` — seq_no 서버 채번(클라이언트 seq_no 전송 금지)
- `supabase/migrations/0025_web_share.sql` — share_mode·companion·trip_messages·join_moa
- `packages/core/src/constants.ts` — `CITY_KO_MAP`(도시 칩 9개), `ShareMode`, `moaChannelName`
- `packages/core/src/schemas/trip.ts` — `TripCreateDraftSchema`(dates-optional, companion ≤20)
- `packages/api/src/queries/trips.ts` — `shareMoa`(재호출 시 share_mode 갱신 허용, slug 보존)
- `packages/api/src/queries/votes.ts` — `castVote`/`retractVote`(찜 = kind 'love')

### 재사용 코드 패턴
- `apps/web/app/t/[slug]/_components/public-board-map.tsx` — 구글맵 초기화 옵션(greedy·clickableIcons false)·마커 SVG 패턴
- `apps/web/app/boards/[id]/_components/add-link-form.tsx` — 링크 추가+추출 트리거(dev-tools 게이트 — 정식 UI로 승격 대상)
- `apps/web/app/boards/[id]/_components/retry-extraction-button.tsx` — 재시도 패턴
- `supabase/functions/resolve-place/index.ts` — 장소 검색 Edge Function 계약(query→max 5, anon JWT 허용)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **UI 컴포넌트** (`apps/web/components/`): bottom-sheet, chip, dialog, toast, card, input, button, select, tabs — 온보딩 칩·추가 시트·함께 정하기 시트에 직접 활용
- **`resolve-place` Edge Function**: 서버사이드 Google Places 검색 이미 동작(키 노출 없음, FieldMask 잠김) — MOA-04는 이 함수 호출 UI만 만들면 됨
- **`castVote`/`retractVote`**: 찜 정렬(MOA-02)의 데이터 소스 — votes 집계 쿼리 필요
- **구글맵 로딩·마커 패턴**: public-board-map.tsx + `lib/marker-svg.ts`

### Established Patterns
- 외부 입력 Zod validate (`@moajoa/core/schemas`), 워크스페이스 import `.js` extension 금지
- RLS deny-by-default — 신규 쿼리도 기존 typed query 패턴(`packages/api/src/queries/`)으로
- iOS 전면 동결 — `apps/ios` 접촉 금지

### Integration Points
- 라우트 신설: `/onboarding`, `/moa`, `/moa/[id]` — 기존 `/boards/[id]`(dev-tools)와 별개, `/t/[slug]`는 Phase 25에서 통합
- 추출 파이프라인: addLink → extract-youtube Edge Function → places INSERT (기존 그대로, 웹 UI만 개방)
- **선행 조건: Vercel Preview e2e 전 `supabase db push`(0024·0025) 필수** — 원격은 0023까지만 적용됨(23-07 실측). push 전엔 프로덕션에서 share/join 미동작
- 카카오 로그인: provider 설정 완료(로컬 config.toml + 프로덕션 대시보드·Kakao console). 카카오 e2e는 Vercel Preview에서, 로컬은 이메일 대체. KOE205 학습: 비즈 앱 전환+3 동의항목 완료 상태

</code_context>

<specifics>
## Specific Ideas

- 온보딩 칩 패턴(도시·누구랑)을 동일한 시각 언어로 — 1·3단계 일관성
- 지도탭은 "앱 감성"의 풀 지도+드래그 바텀시트 — 카톡으로 열어본 모바일 웹에서 네이티브처럼 느껴지는 것이 목표
- UI hint: yes — 플래닝 전 `/gsd-ui-phase 24`로 UI-SPEC 생성 옵션 있음

</specifics>

<deferred>
## Deferred Ideas

None — 논의가 phase 범위 안에 머묾.

### Reviewed Todos (not folded)
- `eas-ios-sharesheet-verify.md` — iOS 실기기 UAT. iOS 전면 동결로 v2.1 범위 밖
- `maplink-place-enrichment.md` — 추출 품질 개선(blocked_on 키·비용 결정). 이번 phase는 추출 파이프라인 무변경
- `supabase-js-upgrade-presence.md` — presence 복구 업그레이드. D-14가 presence를 의도적으로 회피하므로 이번 phase 무관(Phase 26 전 재검토 대상)
- `transcript-fallback-no-description.md` — 추출 폴백(blocked_on 외부 서비스 결정). 범위 밖

</deferred>

---

*Phase: 24-host-flow*
*Context gathered: 2026-07-08*
