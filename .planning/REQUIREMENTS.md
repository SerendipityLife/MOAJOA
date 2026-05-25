# Requirements: MOAJOA

**Defined:** 2026-05-25
**Core Value:** 링크 → 30초 안에 지도 위의 핀
**Milestone:** v1 (MVP, self-dogfooding 가능선)

리서치 산출물(`.planning/research/SUMMARY.md`)에서 도출. v1은 **단독 저장 + 공개 열람** 범위. 협업·투표는 Phase 1.5.

## v1 Requirements

각 요구사항은 **observable user behavior**로 기술. roadmap phase 매핑은 하단 Traceability에서.

### Build & Tooling (BUILD)

iOS 빌드 블로커 해소 + 셸 동작. dogfooding의 prerequisite.

- [ ] **BUILD-01**: iOS 앱이 실기기(아이폰)에서 로컬·EAS 둘 중 하나로 빌드되어 실행됨
- [ ] **BUILD-02**: iOS 빌드 시 NativeWind className이 적용되어 보임 (silent failure 없음)
- [ ] **BUILD-03**: App icon · launch splash · 워드마크가 실기기 홈/스플래시에 정상 표시됨

### Save Flow (SAVE) — iOS 핵심 입력

링크 → 핀의 흐름이 카톡·사파리에서 완결되어야 dogfooding 성립.

- [ ] **SAVE-01**: iOS 로그인 → 보드 목록 → 보드 상세까지 실기기에서 막힘 없이 진입됨
- [ ] **SAVE-02**: 보드 상세에서 YouTube URL을 붙여 넣으면 30초 안에 핀이 지도에 나타남 (p90)
- [ ] **SAVE-03**: 카톡/사파리 공유 시트에서 MOAJOA를 선택하면 보드 선택 화면이 뜨고, "마지막 사용 보드"가 default로 들어와 1탭에 저장됨
- [ ] **SAVE-04**: Share Extension 저장이 오프라인일 때 enqueue되고, 메인 앱 launch 시 자동 drain됨
- [ ] **SAVE-05**: 사용자가 핀을 수동으로 추가·편집·삭제할 수 있음 (장소 검색은 google_place_id resolve로 처리) — backend pieces complete (03-03: resolve-place Edge Function + ResolvePlace schemas + renamePlace/deletePlace helpers); UI wiring lands in 03-05

### Extraction Pipeline (EXTRACT) — Backend

추출 정확도·신뢰도·비용을 측정 가능한 수준으로.

- [x] **EXTRACT-01**: Edge Function이 추출 단계별 진행 상태를 Supabase Realtime Broadcast 채널 `extract:{link_id}`로 송신 (metadata/transcript/llm/places/done)
- [x] **EXTRACT-02**: Claude 응답의 모든 place 후보는 `transcript_quote` 필드 포함이 필수이며, 없으면 폐기됨
- [x] **EXTRACT-03**: 각 place 행에 `source_kind` (ai/manual), `video_offset_sec`, `quote`, `inferred_city` 컬럼이 저장됨
- [x] **EXTRACT-04**: 모든 추출 호출이 `extraction_costs` 테이블에 (provider, model, tokens, cost_usd, duration_ms)로 로깅됨
- [x] **EXTRACT-05**: Google Places API 호출이 명시적 FieldMask(`places.id,places.displayName,places.formattedAddress,places.location`)만 사용 (와일드카드 금지)
- [x] **EXTRACT-06**: Google Cloud billing alert가 $5/$20/$50 threshold로 셋업되어 있음
- [ ] **EXTRACT-07**: sample 영상 10~20개에 대한 expected/actual 비교 baseline 측정 결과가 문서화됨 (개선은 v2)

### Public Board Viewing (VIEW) — Web

카톡 공유 → 비로그인 SSR 열람 = 핵심 acquisition.

- [ ] **VIEW-01**: 공개 보드 URL(`/b/[slug]`)이 비로그인 상태에서 SSR로 즉시 렌더링됨 (p90 TTFB < 800ms)
- [ ] **VIEW-02**: 공개 보드 페이지가 모바일(iPhone Safari) viewport에서 정상 사용 가능 (지도 핀치줌, 핀 탭 동작)
- [ ] **VIEW-03**: `/b/[slug]/opengraph-image`가 보드 제목 + 미니맵(Static Maps) + Pretendard 한글 폰트로 동적 생성됨
- [ ] **VIEW-04**: 보드 페이지의 `<head>`에 보드 제목·도시·핀 수 기반 SEO meta(title, description, og:*, twitter:*) 포함
- [ ] **VIEW-05**: 핀을 탭하면 해당 영상이 정확한 타임스탬프(`?t=Xs`)로 열림
- [ ] **VIEW-06**: 추출이 완료되면 보드 페이지가 자동으로 갱신됨 (Edge Function → `/api/revalidate?slug=...` webhook → `revalidateTag`)

### Trust UI (TRUST) — Cross-platform

AI 추출 결과를 사용자가 믿을 수 있어야 dogfooding 성립.

- [ ] **TRUST-01**: AI가 추출한 핀과 사용자가 수동으로 추가한 핀이 시각적으로 구분됨 (점선·실선, 아이콘 색)
- [ ] **TRUST-02**: 추출 진행 중인 링크에 진행 단계가 UI에 표시됨 (`extract:{link_id}` 구독)
- [ ] **TRUST-03**: 추출 실패 시 사유가 노출되고 1탭 retry 가능
- [ ] **TRUST-04**: `confidence < 0.7`인 핀은 시각적으로 약하게(low_confidence) 표시되고 사용자가 명시적으로 confirm 또는 reject 가능

### Onboarding (ONBOARD)

첫 인상 lock. 첫 보드 없이 빈 상태 피하기.

- [ ] **ONBOARD-01**: 신규 가입자에게 첫 로그인 시 "내 첫 여행" 보드가 자동 생성됨
- [ ] **ONBOARD-02**: 첫 진입 시 "유튜브 링크를 붙여넣어 보세요" 안내 카드가 보드 상세에 1회 표시됨

### Web Hygiene (WEB)

웹의 역할을 "열람 + 공유 랜딩"으로 고정. dev tool은 격리.

- [ ] **WEB-01**: 현재 Web에 있는 "보드 생성·링크 추가" 폼이 `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`일 때만 노출됨
- [ ] **WEB-02**: 공개 환경(`NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정)에서 web의 1차 진입은 `/b/[slug]` 또는 로그인 페이지에 한정됨

## v2 Requirements (defer)

- **COLLAB-01**: 공유 보드 멤버 초대 (link slug + 멤버십 수락)
- **COLLAB-02**: 핀 ❤️ 투표 + "확정" 필터 (love/총멤버 ≥ 0.5)
- **EXTRACT-08**: 추출 정확도 evaluation 데이터셋 정형화 + 회귀 측정
- **EXTRACT-09**: LLM 프롬프트 자동 튜닝 (eval 기반)
- **EXTRACT-10**: 블로그·인스타 manual extraction queue (운영진 어드민)
- **EXTRACT-11**: `resolve-place` Edge Function 도입 (`add_manual_place` placeholder deprecate)
- **VIEW-07**: `/discover` 공개 보드 탐색 피드
- **AUTH-05**: Google OAuth 완료
- **AUTH-06**: Apple Sign In
- **I18N-01**: UI 다국어 (next-intl + expo-localization)
- **THEME-01**: 다크 모드 토큰 매핑
- **OBS-01**: Sentry/PostHog 에러 트래킹
- **CI-01**: GitHub Actions (typecheck + lint)
- **SMTP-01**: Resend custom SMTP (매직 링크 deliverability)

## Out of Scope (v1·v2 모두 X)

scope creep 방지용 명시 차단 목록.

| Feature | Reason |
|---------|--------|
| Day-by-day itinerary builder | 모든 여행 plan 앱이 빠지는 함정. Core Value(자동 추출)을 희석 |
| 항공·숙박·결제 통합 | 단일 도구 시장 (Skyscanner/Booking) 강자 존재. 차별 불가 |
| AI 챗봇 인터페이스 | "링크 한 번에 핀" 패러다임과 직접 충돌. confident-wrong risk 가중 |
| 자동 일정 최적화 (TSP) | 사용자가 핀 자체를 이미 신뢰 못 하는 단계. premature optimization |
| 소셜 피드·팔로우·좋아요 | 협업 보드(v2)와 별개의 큰 surface. 본 도구 정체성 흐림 |
| 댓글 스레드 | 협업은 ❤️ 투표(v2)로만. 댓글은 분쟁 surface 추가 |
| Push notification | dogfooding 단계에선 무가치. Apple Push 인프라 + permission 피로 |
| Flutter 코드 참조·재사용 | `_archive_asis/`는 영구 archive. 새 스택으로 통일 |
| Firebase·Firestore 재도입 | 피봇 결정 (RLS+PostGIS+Realtime+비용 모두 우위) |

## Traceability

Roadmap (2026-05-25)에서 매핑됨. 자세한 phase 정의는 `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 1 | Pending |
| BUILD-02 | Phase 1 | Pending |
| BUILD-03 | Phase 1 | Pending |
| WEB-01 | Phase 1 | Pending |
| WEB-02 | Phase 1 | Pending |
| EXTRACT-01 | Phase 2 | Complete |
| EXTRACT-02 | Phase 2 | Complete |
| EXTRACT-03 | Phase 2 | Complete |
| EXTRACT-04 | Phase 2 | Complete |
| EXTRACT-05 | Phase 2 | Complete |
| EXTRACT-06 | Phase 2 | Complete |
| SAVE-01 | Phase 3 | Pending |
| SAVE-02 | Phase 3 | Pending |
| SAVE-03 | Phase 3 | Pending |
| SAVE-04 | Phase 3 | Pending |
| SAVE-05 | Phase 3 | Backend complete (03-03); UI pending (03-05) |
| VIEW-01 | Phase 4 | Pending |
| VIEW-02 | Phase 4 | Pending |
| VIEW-03 | Phase 4 | Pending |
| VIEW-04 | Phase 4 | Pending |
| VIEW-05 | Phase 4 | Pending |
| VIEW-06 | Phase 4 | Pending |
| TRUST-01 | Phase 5 | Pending |
| TRUST-02 | Phase 5 | Pending |
| TRUST-03 | Phase 5 | Pending |
| TRUST-04 | Phase 5 | Pending |
| ONBOARD-01 | Phase 5 | Pending |
| ONBOARD-02 | Phase 5 | Pending |
| EXTRACT-07 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29 ✓
- Unmapped: 0
- Duplicate mappings: 0

## Dogfooding Gate

Phase 6 완료 조건 (Karpathy goal-driven execution):

> **본인이 일본 또는 서울 여행 계획에 MOAJOA를 7일 연속 사용했고, 보드에 10개 이상의 핀이 추출·확정되었으며, 친구에게 그 보드 URL을 카톡으로 공유했을 때 모바일 브라우저에서 정상 열림.**

이 게이트 전엔 Phase 1.5 (협업·투표) 코드 X.

---
*Requirements defined: 2026-05-25*
*Last updated: 2026-05-25 — traceability filled after roadmap creation*
