# Phase 3: iOS Save Flow — Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

iOS 실기기에서 dogfooding의 입력 경로 #1을 완결한다 (SAVE-01~05):

1. 로그인 → 보드 목록 → 보드 상세까지 막힘 없이 진입
2. 보드 상세에서 YouTube URL 붙여 넣기 → 30초 안에 핀이 지도에 나타남 (p90)
3. 카톡/사파리 공유시트에서 MOAJOA 선택 → "마지막 사용 보드" 자동 + **1탭 저장**
4. 오프라인 share → App Group SharedDefaults enqueue → 메인 앱 launch/foreground 시 drain
5. 수동 핀 추가/편집/삭제 — 좌표는 서버 `resolve-place` 흐름으로 검증된 google_place_id만

**Scope lock:** 핀의 시각적 표현 차별화 (AI vs 수동, low_confidence 음영, 진행 단계 상세 메시지)는 **Phase 5 Trust UI**에서. Phase 3는 핀이 "저장/표시" 되는 흐름까지만.

</domain>

<decisions>
## Implementation Decisions

### Share Extension UX (SAVE-03)
- **D-01:** **boardpicker 없이 즉시 저장 + 한 줄 토스트.** Share Extension 1탭 = "마지막 보드에 저장됨" 토스트. board 변경은 메인 앱 또는 별도 '철회' tap에서. 속도 최우선.
- **D-02:** "마지막 사용 보드" id 저장 = **App Group SharedDefaults** (`group.com.serendipitylife.moajoa`). Share Extension과 메인 앱이 같은 group 공유 — 양쪽에서 r/w. SAVE-04 enqueue 큐와 같은 storage 메커니즘.
- **D-03:** **로그인 안 됨 OR last board id 없음** → Share Extension은 "MOAJOA 앱 먼저 열기" 안내 화면 + deeplink 버튼만 표시. share된 URL은 SharedDefaults에 `pending_links`로 enqueue해서 메인 앱 launch 시 board picker로 처리.

### Offline enqueue / drain (SAVE-04)
- **D-04:** **Drain trigger = cold launch + foreground 복귀 둘 다.** `AppState.addEventListener('change', ...)` + 앱 초기 mount 시 둘 모두에서 drain 호출. share 직후 사용자가 바로 메인 앱 열면 즉시 처리.
- **D-05:** **Enqueue 구조 = JSON array of `{url, board_id, queued_at, retry_count}`** in App Group SharedDefaults 키 `pending_links`. board_id가 null이면 (D-03 케이스) 메인 앱이 board picker로 raise.
- **D-06:** **재시도 정책 = silent retry while `retry_count ≤ 3`**. 초과 시 `pending_links_failed` 키로 이동 + 메인 앱 내 "저장 실패" 보드(시스템 보드) 표시 + 사용자가 명시적으로 재시도 버튼. 실패 사유(network/auth/api)는 함께 저장.

### 수동 핀 추가/편집/삭제 (SAVE-05)
- **D-07:** **장소 검색 = 텍스트 입력 + Places Autocomplete 드롭다운.** 보드 상세 우측 상단 "+ 핀" 탭 → modal sheet → text input → 서버 `resolve-place`에 query 전달 → 상위 5개 결과 드롭다운 → 탭 = google_place_id 확정 + 핀 추가. (지도 long-press는 v2.)
- **D-08:** **`resolve-place` = 새 Edge Function**, POST `{query?: string, lat?: number, lng?: number}` → `{google_place_id, displayName, formattedAddress, location: {lat,lng}, primaryType}`. extract-youtube와 동일한 명시적 FieldMask 패턴 사용 (Phase 2 D-12 lock 준수). 호출은 extraction_costs에 `provider='google-places', model='text-search'`로 기록 (Phase 2 D-09 패턴).
- **D-09:** **편집/삭제 interaction = 핀 탭 → bottom sheet → 액션 버튼.** bottom sheet 구성:
  - 공통: 장소명, 주소, source_kind badge ("AI" or "수동")
  - 액션: `[이름 수정]` (장소명 inline 편집 — google_place_id는 불변), `[삭제]`, `[영상에서 위치]` (AI 핀일 때만, source_timestamp_sec 활용해 영상 timestamp jump — 동작 자체는 deferred area #1 참고)
  - 단일 sheet UI가 AI 핀과 수동 핀 모두 처리. source_kind에 따라 버튼 visibility만 다름.

### 추출 진행 상태 UX (SAVE-02)
- **D-10:** **Phase 3 UI = 단순 spinner + done/error 텍스트.** broadcast 구독은 하되 5단계 메시지를 raw로 노출하지 않음. 흐름:
  - URL 추가 → 즉시 "분석 중..." spinner 표시
  - broadcast `done` 수신 → spinner 사라짐 + "X개 핀 추가됨" 한 줄 토스트 + 핀/지도 reload
  - broadcast `error` 수신 → spinner 사라짐 + 에러 토스트 (사유: 자막 없음/장소 없음/할당량 등)
  - 5단계 raw 메시지·progress bar·low_confidence 시각은 **Phase 5 Trust UI**에서 도입.
- **D-11:** **p90 30초 측정 = `extraction_costs.duration_ms` SQL 집계.** Phase 2가 이미 link 단위로 duration 기록 중. 측정 쿼리:
  ```sql
  SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY total_ms) AS p90_ms
  FROM (SELECT link_id, SUM(duration_ms) total_ms FROM extraction_costs GROUP BY link_id) t;
  ```
  Phase 6 dogfooding 7일 자료와 자연스럽게 연결. 클라이언트 로깅 별도 추가 안 함 (v2).

### Claude's Discretion (researcher/planner가 정함)
- iOS broadcast subscribe 패턴 helper 위치 (lib/realtime.ts 신규 vs lib/supabase.ts 확장)
- bottom sheet 라이브러리 (@gorhom/bottom-sheet vs Modal + custom vs expo-router modal)
- AppState listener registration 위치 (RootLayout vs custom hook)
- pending_links 직렬화 helper (native module bridge 패턴)
- expo-share-intent SDK 54+ 호환 확인 및 alternative (expo-share-extension, react-native-share-extension)

</decisions>

<deferred_ideas>
## Deferred Ideas (out of Phase 3 scope)

- **핀 탭 → 영상 타임스탬프 jump 동작 (in-app browser vs YouTube deeplink vs share sheet):** 사용자가 deep-dive 영역으로 안 골랐고 ROADMAP에 명시 안 됨. Phase 5 Trust UI 또는 별도 minor add. Phase 3에서는 bottom sheet의 `[영상에서 위치]` 버튼만 wire (no-op 또는 임시 `Linking.openURL("https://youtube.com/watch?v=...&t=Xs")`로 일단 충족, Phase 5/4에서 정교화).
- **지도 long-press → reverse geocode로 핀 추가:** 텍스트 검색이 1순위라 v2로.
- **공유 후 in-app 즉시 점프 (toast 대신 board 화면으로 navigate):** "1탭 = 즉시 저장 + toast"가 lock(D-01). navigate는 사용자 흐름 깨므로 v2.
- **`/discover` 피드 (탭 이미 존재):** v1 out-of-scope (PROJECT.md).
- **공유 보드 멤버 초대·투표 UI:** v2 (COLLAB-01/02).
- **Sentry/crash reporting:** Phase 1 D-15 lock 그대로 v2.

</deferred_ideas>

<specifics>
## Specific Ideas

- Share Extension 1탭 토스트는 iOS 13+ `UNUserNotificationCenter` banner 또는 in-extension custom toast — 어느 쪽이든 0.5~1초 후 자동 dismiss. "보드명 - 저장됨" 형식.
- bottom sheet은 핀 카드 위치 + 지도 가시성 보존 형태 (지도 절반 + sheet 절반 또는 sheet snap point 2단계).
- 메인 앱 내 "저장 실패" 시스템 보드는 v1에서는 boards 목록 최상단 빨간 dot 또는 별도 섹션. 일반 보드 카드처럼 보이지 않도록.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context (필수)
- `CLAUDE.md` — Karpathy 4 원칙, 모노레포 규칙, NO `.js` extension §4.5, RLS SECURITY DEFINER 패턴
- `.planning/PROJECT.md` — Core Value, Out of Scope (v1), Dogfooding Gate 정의
- `.planning/REQUIREMENTS.md` §"Save Flow (SAVE)" — SAVE-01~05 falsifiable acceptance criteria
- `.planning/ROADMAP.md` §"Phase 3: iOS Save Flow" — phase goal + success criteria + dependencies (Phase 1 + 2)
- `docs/WORKSTREAMS.md` §"1️⃣ iOS 앱" — 파일 경계 (`apps/ios/**` 배타적), 트랙별 owner
- `docs/SESSION-NOTES-2026-05-24.md`, `docs/SESSION-NOTES-2026-05-25.md` — 인증 결정 (이메일+비번 메인 / 매직링크 토글 / Google OAuth provider 설정만 남음 / Apple v2), iOS 빌드 통과 timeline

### Prior phase decisions (lock 유지)
- `.planning/phases/01-build-unblock-hygiene/01-CONTEXT.md` — D-13 (login.tsx Phase 3 복원), **D-16 (Share Extension은 Phase 3 첫 도입 — Phase 1에 추가 X)**, D-02 (pnpm hoist scope `apps/ios/`)
- `.planning/phases/01-build-unblock-hygiene/01-02-SUMMARY.md` — iOS Path A 14분, react-native-css-interop pnpm 이슈 fix 패턴, CocoaPods locale 이슈 회피
- `.planning/phases/02-extraction-pipeline-hardening/02-CONTEXT.md` — D-01~02 (broadcast 5단계 채널), D-12 (Places API FieldMask 명시), D-09 (extraction_costs API 단위 1행 기록)
- `.planning/phases/02-extraction-pipeline-hardening/02-0[1-3]-SUMMARY.md` — 실제 구현된 broadcast/cost-logging/citation filter 코드 위치

### Schema + types (구현 시 import)
- `supabase/migrations/0001_init.sql` — 기본 테이블 (`boards`, `links`, `places`, `votes`, `memberships`)
- `supabase/migrations/0002_fix_rls_recursion.sql` — `am_board_owner`, `am_board_member` SECURITY DEFINER 헬퍼 (수동 핀 RLS 정책에 재사용)
- `supabase/migrations/0004_extraction_hardening.sql` — `places.source_kind`, `places.inferred_city`, `places.video_offset_sec`(또는 기존 `source_timestamp_sec`), `extraction_costs` 테이블 + RLS
- `packages/api/src/types/database.ts` — 생성된 TypeScript 타입 (resolve-place 응답 매핑 시 places row 타입 참고)
- `packages/core/src/schemas/*.ts` — Zod 스키마 (LinkAdd, PlaceCandidate 등). 수동 핀 입력 검증 시 새 ManualPlaceAdd 추가 필요

### Edge Functions (참고 및 신규)
- `supabase/functions/extract-youtube/**` — 패턴 reference: admin client 패턴, broadcast send, error 처리, extraction_costs 기록. 신규 `resolve-place` Edge Function이 동일 패턴 따름.
- `supabase/functions/extract-youtube/pipeline/places.ts` — Google Places API 호출 + FieldMask 패턴 (D-08 resolve-place가 그대로 차용)

### iOS scaffold (수정 시작점)
- `apps/ios/app/_layout.tsx` — Root layout, AppState listener + drain 호출 위치 후보
- `apps/ios/app/index.tsx` — 현재 Phase 1 smoke screen. D-13 따라 복원 + auth gate
- `apps/ios/app/login.tsx` — 인증 화면 현재 상태
- `apps/ios/app/(tabs)/boards.tsx` — 보드 목록
- `apps/ios/app/boards/[id].tsx` — 보드 상세 (URL add + MapView + Marker 기본 골격 있음, 진행 spinner + bottom sheet + 수동 핀 흐름 추가)
- `apps/ios/app/boards/new.tsx` — 보드 생성
- `apps/ios/lib/supabase.ts` — Supabase 클라이언트
- `packages/api/src/queries/{boards,links,places}.ts` — 기본 query helpers (places 수동 추가/편집/삭제 helper 신규)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/ios/app/boards/[id].tsx` — 이미 URL TextInput + `triggerExtraction` 호출 + MapView/Marker 렌더 — D-10 spinner overlay와 done 토스트만 추가
- `packages/api/src/queries/links.ts` `addLink()` + `triggerExtraction` — Share Extension drain 시 그대로 사용
- `packages/api/src/queries/places.ts` — 수동 핀 CRUD helper 신규 추가 위치
- Phase 2가 만든 broadcast 5단계 → Phase 3가 subscribe만. broadcast 채널명 `extract:{link_id}`, payload `{step, progress_pct, detail?}` (Phase 2 D-02)
- `apps/ios/.npmrc node-linker=hoisted` + `packages/api`의 query 헬퍼 패턴 — 수동 핀 helper도 동일 위치

### Known Pitfalls (재발 방지)
- **expo-share-intent SDK 54+ 호환:** Phase 1 D-16에 "재추가 필요" 명시. SDK 54 호환 버전이 npm에 있는지 researcher가 확인. 없으면 `expo-share-extension` 또는 직접 native module 작성 필요.
- **App Group identifier 최종 lock:** `group.com.serendipitylife.moajoa` 가정. STATE.md Open Question에 "App Group identifier 최종 — Phase 3 prebuild 전" 명시. Phase 3 첫 plan에서 확정 + apps/ios/ios/MOAJOA.entitlements와 ShareExtension target 양쪽 동기화.
- **prebuild + Share Extension target 추가:** `npx expo prebuild` 산출물에 Share Extension target이 자동으로 안 들어감. config plugin 또는 prebuild 후 수동 native patch 필요. researcher가 확인.
- **react-native-css-interop pnpm hoist (Phase 1 D-?? lesson):** apps/ios/package.json에 직접 dep 선언 패턴. Share Extension 추가 시 새 native module이 또 transitive로 hoist 안 되면 동일 패턴 적용.
- **Places API FieldMask 명시:** Phase 2 D-12 lock. resolve-place에 와일드카드 호출 절대 금지.
- **RLS `places` 수동 추가:** `am_board_member` 헬퍼로 board 멤버만 INSERT 허용. `source_kind='manual'` + `created_by=auth.uid()` 강제.

</code_context>

<open_questions>
## Open Questions (다음 단계에서 결정)

- App Group identifier 최종 (확인 + 모든 곳 동기화 — first plan task)
- expo-share-intent SDK 54+ 호환 버전 존재 여부 (researcher 1순위 조사)
- bottom sheet 라이브러리 선택 (@gorhom/bottom-sheet가 표준이지만 reanimated v4 호환 확인 필요)
- 보드 picker (last board 없을 때) — modal vs full screen?
- "저장 실패" 시스템 보드 vs 인앱 알림 — 어느 쪽이 v1에 더 자연스러운지 첫 plan에서 결정

</open_questions>

---

**Next:** `/gsd-plan-phase 3` — researcher가 위 결정에 기반해 RESEARCH.md, planner가 PLAN.md 작성.
