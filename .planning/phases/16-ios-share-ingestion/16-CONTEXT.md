# Phase 16: iOS Share Ingestion - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

공유 시트(유튜브 앱/사파리/블로그/카톡)에서 받은 URL이 **MOAJOA 안으로 들어와** 보드에 추가 + 추출 트리거까지 동작하게 만든다. 끊긴 **네이티브 캡처 ↔ JS 드레인 다리를 잇는 것**이 핵심 — 새 캡처 메커니즘을 만드는 게 아니다.

현재(2026-06-17 디버깅 확인) 상태: `expo-share-intent` 표준 익스텐션은 App Group `group.com.serendipitylife.moajoa`의 키 `moajoaShareKey`에 페이로드를 쓰고 `moajoa://dataUrl=moajoaShareKey?nonce=…` 딥링크로 앱을 열지만, JS 수신이 전무하다:
- `app/+native-intent.tsx` 부재 → 딥링크가 expo-router 직행 → "Unmatched Route"
- 커스텀 드레인 `lib/pending.ts`의 `drainPendingLinks()`는 다른 키 `SharedDefaultsKeys.PendingLinks`(=`'pending_links'`)를 읽음 → 익스텐션이 쓰는 `moajoaShareKey`와 불일치 → 네이티브 캡처↔JS 드레인 단절.

**방향 명확화 (discuss 중 합의):** Phase 16은 **수신(밖 → MOAJOA)** 이다. Phase 14의 **보드 공유(MOAJOA → 밖, 친구 투표 초대)** 와는 반대 방향. 공유가 MOAJOA 밖(유튜브 앱)에서 시작되므로 들어온 링크에는 board_id가 없다 — 어느 보드에 담을지는 MOAJOA가 정해야 한다.

**범위 밖:** 보드 공유/투표(Phase 14 완료) · 추출 파이프라인 자체 · 안드로이드 공유.

</domain>

<decisions>
## Implementation Decisions

### 보드 타겟팅 (들어온 링크 → 어느 보드)
- **D-01:** 스마트 라우팅 — **보드가 정확히 1개면 그 보드로 자동 추가**, **2개 이상이면 인앱 바텀시트 피커**로 사용자가 선택.
- **D-02:** **보드 0개거나 로그아웃 상태**면 추가할 데가 없으므로 링크는 큐에 **머묾**(기존 `drainPendingLinks` 동작 그대로 — board_id 없는 항목은 `stillPending`으로 보존, `lib/pending.ts:67-68`). 로그인/보드 생성 후 다음 드레인에서 처리. (온보딩이 첫 로그인 시 "내 첫 여행" 보드 생성 → 그 후엔 자연히 1개 케이스로 수렴.)

### 공유 후 앱 진입 경험
- **D-03:** **자동 추가 케이스(보드 1개)** → 앱이 **대상 보드로 이동(navigate)** 하고 **방금 들어온 링크의 추출 진행이 보이게**(핀이 뜨는 과정). "던졌다"는 만족감을 즉시 준다.
- **D-04:** **피커 케이스(보드 여러개)** → 앱 열릴 때 **인앱 바텀시트 피커**("어느 보드에 담을까?"). 선택 시 추가 + 추출. 기존 `PinBottomSheet`/시트 패턴 재사용 가능.

### Claude's Discretion (사용자가 제 판단에 위임 — 잠금)
- **D-05 (수신 아키텍처):** **A안 채택** — `app/+native-intent.tsx`로 `moajoa://dataUrl=…` 딥링크를 가로채 expo-share-intent의 App Group 페이로드(`moajoaShareKey`)를 읽어 기존 `enqueuePendingLink()` 큐로 연결. B안(`useShareIntent`/`ShareIntentProvider` 통합 채택)은 **불채택**. 이유: A는 변경 표면이 최소이고 Phase 3/7에서 구축한 큐·드레인·실패 화면·재시도 인프라(`lib/pending.ts`, `_layout.tsx` 드레인 마운트, Phase 7 실패/재시도 화면)를 **전부 그대로 보존**한다. 단일 수신 경로 유지.
- **D-06 (익스텐션 범위):** **표준 캡처 익스텐션 유지** — expo-share-intent 7 기본(URL 캡처 + 앱 열기). 시트 안 보드 선택 UI(네이티브 SwiftUI)는 **만들지 않음**. 보드 선택은 D-04대로 인앱에서. 범위 보호.

### 기존 잠금 결정 (Phase 3/7에서 — 재논의 X, 그대로 적용)
- **D-04(Phase 3):** drain은 콜드런치 + AppState 'active' 양쪽에서 (`_layout.tsx`).
- **D-06(Phase 3):** silent retry ≤3, 4번째 실패 시 `pending_links_failed`로 이동 → boards 배너/Phase 7 화면 노출.
- **D-03(Phase 3):** board_id 없는 항목 board picker 필요 — 이번 Phase 16이 그 picker를 실제 구현(D-01/D-04).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 끊긴 다리 — 현재 코드 (수정 대상)
- `apps/ios/lib/pending.ts` — 큐 enqueue/drain/failed/retry 전체. `drainPendingLinks()`가 읽는 키는 `SharedDefaultsKeys.PendingLinks`(='pending_links'); board_id 없는 항목 skip 로직 `:67-68`. **A안은 이 큐로 페이로드를 흘려보내야 함.**
- `apps/ios/lib/shared-defaults.ts` — App Group UserDefaults 타입 래퍼(`SharedDefaults.get/set`). `APP_GROUP_ID` 일치 필수(드리프트=silent nil).
- `apps/ios/app/_layout.tsx` — drain 마운트 지점(콜드런치 + 포그라운드). `+native-intent.tsx`가 enqueue하면 여기 drain이 처리.
- `apps/ios/app.config.ts` — expo-share-intent 플러그인 설정(`iosAppGroupIdentifier`, `iosShareExtensionName='저장 by MOAJOA'`, activation rules), App Group entitlement, EAS appExtensions. **충돌위험영역 — 변경 시 신중.**
- `packages/core/src/constants.ts:121` — `SharedDefaultsKeys`(PendingLinks/PendingLinksFailed) + `APP_GROUP_ID`. **충돌위험영역 (web/iOS/Edge 공유).** 익스텐션 키 `moajoaShareKey`는 expo-share-intent 고정값 — core에 추가할지(브리지에서 참조용) 플래너가 판단.

### 큐·드레인·실패 인프라 출처 (재사용 — 깨지 말 것)
- `.planning/phases/03-ios-save-flow/03-RESEARCH.md` — App Group UserDefaults pitfalls(특히 Pitfall 2 = APP_GROUP 드리프트 → silent nil), drain 동시성 패턴.
- `.planning/phases/03-ios-save-flow/03-CONTEXT.md` — D-03(board picker)/D-04(drain)/D-06(retry) 결정 원본.
- `.planning/phases/07-pending-failed-links-screen/07-CONTEXT.md` — 실패/재시도 화면(이미 동작 중, 그대로 연결).

### 방향 반대편 (혼동 금지 — 참고)
- `.planning/phases/14-extract-share-vote-flow/14-CONTEXT.md` — 보드 **공유(outbound)** 흐름. Phase 16(inbound)과 반대 방향. `PinBottomSheet`/바텀시트 패턴은 D-04 피커에 재사용 가능.
- `docs/superpowers/specs/2026-06-14-extract-to-vote-flow-design.md` — Phase 14 설계 스펙(추출→공유→투표). 추출 진행 표시 UX 참고(D-03).

### 외부 (라이브러리 — 리서치 필요)
- expo-share-intent 7 공식 문서 — `+native-intent.tsx` 연동 방식, App Group 페이로드 읽기, `moajoaShareKey`/`dataUrl` 딥링크 규약. (Context7 또는 GitHub README로 확인.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/pending.ts` — enqueuePendingLink / drainPendingLinks / listFailedPending / retryFailedPending 전부 이미 구현·테스트됨. A안은 새 진입점(`+native-intent.tsx`)만 추가하고 이 큐로 흘려보내면 됨.
- `lib/shared-defaults.ts` — App Group 읽기/쓰기 래퍼. 익스텐션 키(`moajoaShareKey`)를 읽을 때도 재사용.
- `_layout.tsx` 드레인 사이클 — enqueue만 하면 추가 배선 없이 자동 드레인.
- `PinBottomSheet`(Phase 14) — D-04 보드 피커 바텀시트 골격.
- Phase 7 실패/재시도 화면 — board_id 없는/실패 항목 표면화.

### Established Patterns
- App Group UserDefaults 단일 진실원: `APP_GROUP_ID`는 `app.config.ts` 리터럴 ↔ `packages/core` 양쪽 일치 필수(드리프트=silent nil, Phase 3 Pitfall 2).
- 워크스페이스 import `.js` extension 금지, Zod validate, strict TS(CLAUDE.md §4.5).
- 마이그레이션 불필요할 가능성 높음 — 이번 작업은 클라이언트 수신 배선 위주(boards/links/places 스키마 그대로). 필요 시 append-only.

### Integration Points
- 신규 `app/+native-intent.tsx` — expo-router가 딥링크를 라우트로 보내기 전 가로채는 expo-router 표준 훅. moajoa:// 딥링크 → 페이로드 추출 → enqueue → (라우팅 결정: 대상 보드 or 피커).
- 스마트 라우팅(D-01)은 보드 개수 조회 필요 — `packages/api`의 보드 리스트 헬퍼(예: listBoards/memberships) 재사용.
- 빌드: expo-share-intent는 prebuild 필요. 변경 후 `expo prebuild --clean -p ios` → `pod install` → `pnpm sim` (CLAUDE.md §4.1, Phase 14 컨벤션). 실기기 share-sheet UAT는 EAS dev build(Phase 13 게이트).

</code_context>

<specifics>
## Specific Ideas

- 비유로 합의된 멘탈 모델: "유튜브에서 'MOAJOA 저장' = 사진을 카톡에서 MOAJOA로 보내는 것. 받긴 받는데 어느 앨범(보드)에 넣을지는 보낸 쪽이 안 알려주니 MOAJOA가 정함."
- D-03 만족감 강조: 자동 추가 시 그냥 토스트로 끝내지 말고 **대상 보드로 데려가서 핀이 뜨는 과정을 보여주는 것**을 사용자가 명시적으로 선택함("던졌다"는 즉각 피드백).

</specifics>

<deferred>
## Deferred Ideas

- 시트 안 네이티브 보드 선택 UI(SwiftUI) — D-06에서 불채택, 향후 마찰 줄이기 단계에서 재검토.
- 안드로이드 공유 수신 — 별도 Phase.
- 다중 링크 일괄 공유 / 텍스트 본문 파싱 — 현재는 단일 URL 캡처(activation rules MaxCount 1) 범위.

### Reviewed Todos (not folded)
None — 매칭된 todo 없음.

</deferred>

---

*Phase: 16-ios-share-ingestion*
*Context gathered: 2026-06-17*
