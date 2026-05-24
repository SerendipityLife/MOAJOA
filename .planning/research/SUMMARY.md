# Project Research Summary — MOAJOA

**Domain:** Link-to-Map 여행 큐레이션 (영상 링크 → 자동 장소 추출 → 지도 보드 → 공유)
**Researched:** 2026-05-25
**Confidence:** HIGH

## Executive Summary

MOAJOA는 **"링크 → 30초 안에 지도 위의 핀"**을 핵심 가치로 하는 link-to-map 여행 도구다. 직접 경쟁(Plotline 2026, Mapstr, 네이버 저장 탭) 대비 차별점은:

1. **한국어/일본어 transcript 우선 추출** (영문권 도구의 사각지대)
2. **Next.js SSR 기반 비로그인 공개 보드 열람** (Plotline은 iOS only)
3. **핀 → 영상 타임스탬프 jump-back** (Plotline은 영상 전체 링크만)

코어 스택은 피봇 결정에서 lock (Next.js 15 / Expo SDK 54 / Supabase + PostGIS + Edge / Anthropic claude-sonnet-4-6 / Google Places New). 본 리서치는 그 위에 v1 MVP 완성을 위한 add-on과 통합 결정만 다뤘다.

**권장 접근:** (1) iOS 빌드 블로커를 결정 트리(`apps/ios` 한정 hoist → 안 되면 EAS Build)로 이번 주 안에 잠근다 (4시간 박힘 = 즉시 EAS 전환). (2) NativeWind 4.2 / patch-package / Pretendard / expo-share-intent v5 같은 즉시 액션 add-on을 한 PR에 정리한다. (3) 백엔드는 progress broadcast(Realtime)와 cost logging(`extraction_costs` 테이블) 두 가지를 *같이* 넣어 모든 디버깅·UX 기반을 확보한다. (4) 웹은 SSR 캐시 + `revalidateTag` webhook + 동적 OG 이미지를 한 PR로 묶는다.

**Top 5 리스크가 모든 phase를 관통한다:** ① iOS 빌드 시간 블랙홀(이미 블로커) ② Google Places API 비용 폭주(FieldMask 와일드카드 시 10배) ③ LLM hallucinated places ④ 협업 도입 시 RLS 무한 재귀 다음 라운드 ⑤ 2인팀 scope creep(ASIS 1년 반복). 이 5개를 phase별 게이트로 막는 게 로드맵의 절반. 나머지 절반은 **"self-dogfooding 가능선"**이라는 단일 게이트로 정렬.

## Key Findings

### Recommended Stack (즉시 액션)

코어 변경 없음. 추가/업그레이드 6개:

**이번 주:**
- **NativeWind `^4.2.0`** — 4.1.23은 Reanimated v4와 silent incompatible (className 적용 안 됨)
- **`patch-package` 신규 추가** — expo-share-intent의 xcode sync 필수 의존

**iOS 빌드 통과 직후:**
- **`expo-share-intent@^5.x`** — SDK 54 호환 라인. v6는 SDK 55 전용
- **`react-native-maps@1.20.1` 유지** — `expo-maps`는 alpha (공식 "frequently breaking") + iOS Apple Maps 강제

**백엔드/웹:**
- **`next/og` (Next 15 빌트인)** — `@vercel/og` 별도 X. 한글 폰트는 Pretendard `.ttf` `readFile`로 직접 주입 필수
- **Supabase Edge Function 패턴** — `npm:@supabase/supabase-js@2` + `Deno.serve` + Authorization header 전파
- **Anthropic prompt caching** — `cache_control: ephemeral`, 1024 토큰 이상, cache_read 0.1x

### Expected Features

**Table stakes (v1):** iOS Share Sheet URL 수신, 추출 진행 상태(+retry+실패 사유), 핀→영상 타임스탬프 jump (`?t=Xs`), 핀 수동 편집/삭제 + 수동 핀 추가, 공개 보드 SSR + 모바일 반응형 + OG 카드, 첫 보드 자동 생성, `name_ko` 우선 렌더링.

**Differentiators:** 한국어 transcript 우선(ko→ja→en), 핀당 transcript 발췌 + 정확한 타임스탬프, Web SSR 비로그인 열람, OG 카드 미니맵 썸네일, AI vs 수동 핀 시각 구분(`source_kind`).

**Anti-features (v1·v2 모두 X):** day-by-day itinerary builder, 항공·숙박·결제 통합, AI 챗봇, 자동 일정 최적화, 소셜 피드/팔로우, 댓글 스레드, push notification, 다크 모드, i18n UI, 블로그/IG 자동 추출, Web에 정식 "보드 생성" UI (dev tool로만 격리).

**Defer to v1.5:** 협업 보드(멤버+❤️ 투표+확정), 블로그·IG manual queue, 추출 evaluation 데이터셋, "X개 영상에서 언급됨" 뱃지, Google/Apple OAuth.

### Architecture Approach (v1 통합 결정 6개)

1. **pnpm hoisting** — 1차 isolated, 실패 시 `apps/ios/.npmrc node-linker=hoisted` (apps/ios 한정만, 루트 전체 X)
2. **Share Extension** — "Defer Network, Persist Locally". 옵션 A(즉시 Supabase insert + Edge fire-and-forget), 오프라인 시 옵션 B(App Group SharedDefaults enqueue). UX: 마지막 사용 보드 default + 1탭 변경.
3. **공개 보드 SSR 캐싱** — Vercel Edge Cache + `next: { tags: ['board:slug'], revalidate: 3600 }` + Edge Function 종료 시 `/api/revalidate?slug=...` webhook
4. **추출 observability** — Supabase Realtime **Broadcast** 채널 `extract:{link_id}` (metadata 10% → transcript 30% → llm 50% → places 70% → done)
5. **Cost monitoring** — 별도 `extraction_costs` 테이블 (`link_id, provider, model, tokens, cost_usd, duration_ms`). UI는 Phase 2.
6. **Image asset pipeline** — `packages/ui-tokens/src/brand/` SVG single source → iOS PNG export script → 런타임 OG는 `next/og` Edge

### Critical Pitfalls (Top 5)

1. **iOS 빌드 시간 블랙홀** — 결정 트리 이번 주 잠그기 (A: `apps/ios` 한정 hoist → B: EAS Build). **4시간 박힘 = 즉시 EAS 전환.** `react-native-worklets` peer 명시.
2. **Google Places API 비용 폭주** — FieldMask 와일드카드(`places.*`) 절대 금지 (Enterprise SKU 10배). 명시 셋만 (`places.id,places.displayName,places.formattedAddress,places.location`). Google Cloud billing alert ($5/$20/$50) 1주 안 셋업.
3. **LLM hallucinated places** — Claude 응답 스키마에 `transcript_quote: string` 필수, 없으면 후보 폐기. `confidence < 0.7`은 `low_confidence` 음영. Phase 1: citation. Phase 2: eval baseline.
4. **Supabase RLS 무한 재귀 다음 라운드** — 협업 보드 도입 시 cyclic 재발. 새 테이블은 무조건 SECURITY DEFINER 헬퍼만, 직접 `EXISTS (SELECT FROM other_table)` 금지. 새 마이그레이션 PR마다 `supabase/tests/rls/<feature>.sql` 첨부.
5. **2인팀 scope creep (ASIS 재현)** — 매주 demo 게이트 + 모든 PR에 GSD plan task ID 참조. **Dogfooding 게이트:** Phase 1 완료 = "본인이 일본 여행 7일간 실사용 증명". 게이트 전엔 Phase 1.5 코드 X.

## Implications for Roadmap

### Phase A: Unblock (직렬, 1주 타임박스)

**Rationale:** 다른 모든 iOS 작업의 prerequisite. 4시간 박힘 시 EAS fallback.
**Tasks:** iOS hoisting 결정 트리 실행, NativeWind 4.2 업그레이드(silent failure 사전 차단), `react-native-worklets` peer + `patch-package`, App icon/splash/워드마크 1차 export, lockfile freeze.
**Avoids:** Pitfall 1, 11
**Gate:** iOS 실기기 로그인 → 보드 목록 진입

### Phase B: 핵심 동작 검증 (3 트랙 병렬)

**Rationale:** 셸 빌드 통과 후 파일 경계 안 겹쳐 병렬 가능.

- **B1 — iOS 핵심 흐름:** login → boards → detail → 링크 추가 → 핀 e2e (실기기 검증)
- **B2 — Backend (한 PR로):** `extract-youtube` Realtime Broadcast refactor, `0007_extraction_costs.sql`, `0008_places_metadata.sql` (`source_kind`, `video_offset_sec`, `quote`, `inferred_city`), LLM 스키마에 `transcript_quote`/`inferred_city`/`video_start_sec`/`video_end_sec` 추가, Places FieldMask lock + billing alert. **Addresses Pitfall 2, 3, 5**
- **B3 — Web SSR 기반:** `getPublicBoardBySlug` fetch + `next:{tags,revalidate}`, `/api/revalidate` Route Handler + secret, dev tool form을 `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`로 격리, middleware updateSession 검증

### Phase C: Acquisition 폴리시 (2 트랙 병렬)

- **C1 — Web `/b/[slug]`:** `opengraph-image.tsx` 동적 OG (Pretendard + Noto Sans JP 한자 fallback), 미니맵 썸네일(Static Maps), 모바일 반응형, SEO meta, 핀→타임스탬프 jump
- **C2 — iOS Share Extension:** `expo-share-intent@^5` config plugin, App Group + Apple Dev entitlement, "마지막 보드 default + 1탭 변경" UX, 옵션 A 우선/B fallback, 실기기 카톡 공유 테스트(한국어 IME)

### Phase D: 정리 + Dogfooding 게이트

**Rationale:** Phase 1.5 협업 시작 전 신뢰 UX + 첫 인상 lock.
**Tasks:** AI vs 수동 핀 시각 구분(점선/실선), 추출 진행 상태 UI(progress 구독), 핀 수동 편집/삭제/추가 + `resolve-place` Edge Function 신규(`add_manual_place` deprecate), 첫 로그인 "내 첫 여행" 자동 trigger + 안내 카드, 추출 정확도 baseline 측정(sample 10~20개).
**Gate:** 본인 일본 여행 7일 실사용 → 스크린샷·핀 목록·결정 결과. 통과 후 Phase 1.5 자격.

### Phase Ordering Rationale

- **A 직렬:** iOS unblock prerequisite. NativeWind 함께 묶는 이유 — silent failure를 build debugging 중 발견 시 시간 blackhole 배가.
- **B 3트랙 병렬:** Backend/`supabase`, Web/`apps/web`, iOS/`apps/ios` 파일 경계 안 겹침. Backend 마이그레이션 한 번으로 C/D unblock.
- **C 다음:** OG(C1)·Share Ext(C2) 둘 다 셸(B1) + observability(B2) e2e 검증 필요. C1·C2 독립 → 병렬.
- **D = 1.5 게이트:** 협업 짓기 전 AI 신뢰 UX lock. confident-wrong이 협업에서 발생하면 멤버 신뢰까지 동시 손실.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 모든 항목 공식 docs 교차 검증. 코어는 피봇으로 lock. |
| Features | MEDIUM-HIGH | 경쟁사 official + Korean UX. AI 신뢰 UX 디테일은 dogfooding 검증. |
| Architecture | HIGH | high-level 결정됨. 통합 6개만 — 모두 공식 패턴. |
| Pitfalls | HIGH | ASIS 1년+ 경험 + 2026 공식 docs. 15개 중 5개 이미 데인 것. |

**Overall: HIGH**

## Gaps (공개 질문 — 사용자 답변 필요)

- **Apple Developer 계정 상태** — Share Ext + EAS Build 둘 다 $99/yr 필요. 가입·명의·App Group 권한. **Phase A 전 필수.**
- **Pretendard 라이선스 + 번들 weight** — SIL OFL 1.1, 4 weight (Regular/Medium/SemiBold/Bold) 권장. Phase A 디자인 확정.
- **App Group identifier 명명** — 현재 예시 `group.com.serendipitylife.moajoa`. iOS prebuild 전 final.
- **iOS Google Maps 키 도입 시점** — Apple Maps 한국 POI 품질 Phase D 평가. 부족 시 Phase 1.5 초입 전환.
- **Resend/Postmark SMTP 전환 시점** — Phase 1.5 외부 사용자 전 필수. Phase D에서 계정 셋업 미리.
- **Eval sample 영상 선정** — 누가 어떤 기준으로 10~20개. Phase B 중 선정 시작.

## Sources

- `/Users/wcb/Documents/MOAJOA/.planning/research/STACK.md` — Expo SDK 54, expo-share-intent, Next.js OG, NativeWind 1604, Supabase Edge, Anthropic caching
- `/Users/wcb/Documents/MOAJOA/.planning/research/FEATURES.md` — Plotline/Mapstr/Wanderlog official, 네이버 지도, NN/G AI UX
- `/Users/wcb/Documents/MOAJOA/.planning/research/ARCHITECTURE.md` — Expo Monorepos, Callstack pnpm, Supabase Realtime Broadcast, Next.js 15 cache helpers
- `/Users/wcb/Documents/MOAJOA/.planning/research/PITFALLS.md` — Supabase RLS, Google Places billing, Expo 54, K-HALU
- 프로젝트 내부: `PROJECT.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/WORKSTREAMS.md`, `docs/SESSION-NOTES-*.md`
