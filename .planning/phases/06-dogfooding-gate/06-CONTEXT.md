# Phase 6: Dogfooding Gate — Context

**Gathered:** 2026-05-26
**Mode:** smart-discuss (auto)
**Status:** Ready for planning

<domain>
## Phase Boundary

v1 MVP 전체(Phase 1~5)가 **본인 실생활에서 의미 있게 작동하는가**를 단일 게이트로 증명한다. 코드 변경은 최소화하고, **실사용 + 측정 + 기록**이 본 phase의 산출물.

Phase 6는 4개 작업 trunk로 구성:

1. **T1. Pre-dogfooding deferred 액션 일괄 처리** — Phase 3/4/5에서 "end-of-phase batch"로 미뤘던 모든 UAT/인프라/타입 회생 작업을 7일 dogfooding 시작 직전에 한 번에 처리한다. Dogfooding을 깨끗한 환경에서 시작하기 위한 prerequisite.
2. **T2. 추출 정확도 baseline 측정 (EXTRACT-07)** — sample 영상 12개에 대해 expected vs actual을 비교해 precision/recall과 실패 유형을 `.planning/dogfooding/extraction-baseline-2026-05-XX.md`로 기록한다.
3. **T3. 7일 본인 dogfooding** — 일본 또는 서울 여행 계획에 7일 연속 사용하면서 보드 1개+에 10개+ 핀을 확정하고, 매일 사용 로그를 `.planning/dogfooding/daily-log-2026-05-XX.md`에 남긴다.
4. **T4. 친구 공유 e2e 검증** — 친구 2명에게 카톡으로 보드 URL을 공유하고, 카톡 미리보기·모바일 브라우저 열람·핀→영상 jump가 모두 작동함을 스크린샷으로 증명한다.

**Scope lock:**
- **신규 기능 추가 X.** UI/스키마/Edge Function 신규 코드는 dogfooding 중 발견된 P0 버그 fix에만 허용 (별도 hotfix 커밋, GSD 우회).
- **개선은 v2.** baseline 측정 결과의 hallucination/wrong city 패턴은 v2 EXTRACT-08 evaluation dataset의 첫 시드로만 사용.
- **Phase 1.5 (협업·투표) 작업은 본 phase 통과 전까지 코드 X.** PROJECT.md §"Dogfooding Gate" + REQUIREMENTS.md §"Dogfooding Gate" 모두 명시.
- 파일 경계: 신규 산출물은 **`.planning/dogfooding/`** 하위에만 (코드 디렉토리 X). Phase 3 deferred UAT는 `docs/manual-uat-phase3.md` 체크박스 update만.

</domain>

<decisions>
## Implementation Decisions

### T1. Pre-dogfooding 통합 (Phase 3/4/5 deferred 일괄 처리)

- **D-01: Pre-dogfooding checklist 단일 plan으로 묶는다.** 5개 phase에 흩어진 deferred 작업을 `06-01-PLAN.md` 한 곳에 집계하고, 순서 의존성에 따라 인프라 → 빌드 → UAT 순으로 직렬 처리. Dogfooding 시작 전 마지막 게이트.

  **Phase 5 → 인프라 (먼저, Edge Function/타입이 안정돼야 나머지 검증 가능)**
  - [ ] **`supabase db push`** — migration `0006_per_place_confidence.sql` prod에 적용. Plan 05-01에서 Docker daemon 미가동 + token 부재로 보류된 작업. Phase 6 본인 손으로.
  - [ ] **`pnpm supabase:types`** — `packages/api/src/types/database.ts` 재생성. Plan 05-01 T2 deferred. confidence 컬럼 + extraction_costs `link_id` nullable 두 변경이 타입에 반영되어야 Phase 4의 `deno check` 9 errors도 자동 해소.
  - [ ] **`deno check` 잔여 에러 0 확인** — `supabase/functions/extract-youtube/index.ts`. Phase 4 deferred-items에 기록된 9 errors 중 type regen으로 해소되지 않는 잔여분은 helper generic widening으로 직접 fix.

  **Phase 4 → 웹 인프라**
  - [ ] **`REVALIDATE_SECRET`** 환경변수를 Vercel(web) + Supabase Edge Function 양쪽에 동일 값으로 set. `openssl rand -hex 32`로 생성. Edge Function의 fire-and-forget webhook이 작동해야 SSR 캐시가 dogfooding 중 갱신됨.
  - [ ] **GCP "Maps Static API" 활성화** — Plan 04-04 OG 이미지의 좌측 미니맵에 사용. Console > APIs & Services > Library > "Maps Static API" enable. 동일 API key에 quota·referrer restriction 확인.
  - [ ] **Vercel 환경변수** — `REVALIDATE_SECRET`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WEB_BASE_URL` 등 production env에 모두 set 확인.

  **Phase 3 → iOS prebuild + real-device UAT**
  - [ ] **`pnpm --filter @moajoa/ios prebuild`** + 실기기 빌드 (Path A 또는 EAS). Phase 1 D-16의 Share Extension 첫 native build. expo-share-intent plugin이 entitlement 정상 wiring 했는지 검증.
  - [ ] **`docs/manual-uat-phase3.md` 시나리오 1~5 + N1 + N2 모두 통과.** Phase 3 VALIDATION.md가 정의한 모든 manual gate를 dogfooding 시작 전에 close.
  - [ ] **N2 SQL substitute test** — `set_config('request.jwt.claim.sub', '<other-uuid>', true); insert into places ...` → expect `42501`. SUPER required (Phase 3 VALIDATION에서 binary gate로 승격).

  **Phase 4 → 실브라우저 UAT (Phase 3 끝나고 web UAT만)**
  - [ ] **iPhone Safari로 `/b/[slug]` 실제 열람** — 핀치줌, 핀 탭 → YouTube 영상 정확 timestamp, gestureHandling 정상.
  - [ ] **카톡 채팅창에 URL 붙여넣어 OG 카드 확인** — Pretendard 한글 정상, 미니맵 정상. (Kakao OG scraper 캐시 우회 위해 fresh slug 권장.)
  - [ ] **Vercel Analytics에서 SSR TTFB 측정** — Phase 4 VIEW-01 manual gate.

  **Phase 5 → iOS UAT**
  - [ ] **5단계 step indicator 실기기 시각 확인** — broadcast 5단계가 한국어 카피로 순서대로 표시.
  - [ ] **Low confidence 핀 marker + bottom sheet [확인]/[잘못됨] 동작** — Plan 05-04 deferred live UAT.
  - [ ] **첫 보드 자동 생성 trigger 검증** — 신규 가입(또는 기존 profile 강제 trigger 재실행) 후 "내 첫 여행" 보드가 보드 목록에 1개 있음.
  - [ ] **OnboardCard 1회 표시 후 dismiss 영구** — AsyncStorage `OnboardKeys.LinkCardDismissed` true 후 재방문 시 미표시.

- **D-02: Pre-dogfooding 통과 = "모든 체크박스 ☑️" + 각 항목에 commit SHA 또는 스크린샷 경로 inline 기록.** 산출물은 `.planning/dogfooding/pre-dogfooding-checklist.md`. P0 버그 발견 시 fix 후 체크박스 close. P1 이하는 dogfooding 중 발견된 신규 pitfall과 같이 v2 백로그로.

### T2. Sample 영상 선정 (EXTRACT-07)

- **D-03: 12개 영상.** ROADMAP "10~20개" 범위의 중간값. 12 = 3가지 카테고리(여행 vlog / 맛집 / 동네 산책) × 2개 도시(서울 / 도쿄) × 2개 길이(short ≤ 5분 / long 10~30분). 통계적 유의성보다 **카테고리 커버리지** 우선 — eval로서가 아닌 *baseline*이 목적.
- **D-04: 선정 기준 (각 sample은 명시적 라벨링)**:
  | 차원 | 값 |
  |---|---|
  | **카테고리** | `vlog` (여행 vlog) / `food` (맛집 리뷰) / `walk` (동네 산책 ASMR/4K) — 각 4개 |
  | **도시** | 서울 6개 / 도쿄 6개 — MOAJOA의 1차 사용 도시 |
  | **길이** | short (≤ 5분) 6개 / long (10~30분) 6개 — transcript fetch 부하 + LLM context window 부담 모두 측정 |
  | **언어** | 한국어 자막 8개 / 일본어 자막 4개 — 1·2차 시장 모두 |
  | **자막 출처** | YouTube auto-caption 6개 / creator-uploaded 6개 — Phase 2 transcript 단계 신뢰성 |
- **D-05: Sample 영상 메타데이터 = `.planning/dogfooding/samples.json` 한 파일.** schema:
  ```json
  [
    {
      "id": "sample-01",
      "url": "https://youtu.be/XXXX",
      "category": "vlog",
      "city": "seoul",
      "length_bucket": "short",
      "transcript_lang": "ko",
      "transcript_source": "creator",
      "ground_truth_places": [
        { "name_ko": "스타벅스 광화문점", "google_place_id": "ChIJ..." },
        ...
      ],
      "notes": "오프닝에서 호텔 언급(저신뢰 ground truth)"
    }
  ]
  ```
  ground truth는 **수동 시청 + 화면 캡션/설명란 + Google Maps 검색**으로 작성. 1 video당 평균 5~15분 작업 → 12개 × 10분 = 약 2시간 일회성.

### T3. Accuracy baseline metric (EXTRACT-07)

- **D-06: 측정 지표 = Precision + Recall + 카테고리별 실패 유형.** F1은 보너스. v1은 *baseline*이므로 정밀한 weighting 도입 X.
  - **Recall** = (추출된 핀 중 ground truth와 매칭 N개) / (ground truth 전체 N개). "영상이 실제로 언급한 장소를 얼마나 놓치지 않았나."
  - **Precision** = (추출된 핀 중 ground truth와 매칭 N개) / (추출된 핀 전체 N개). "추출된 핀 중 진짜 영상에 있는 장소 비율 = hallucination 역수."
  - **매칭 기준** = (a) `google_place_id` 동일 OR (b) 동일 place_id 없이 normalized name + city 매칭 (`replace(/\s/g,'').toLowerCase()`). 보수적으로 ground truth는 google_place_id를 가능한 모두 채움 → (a)로 매칭.
- **D-07: 실패 유형 라벨링 (각 mismatch에 1개 부여)**:
  | 유형 | 정의 | 대응 (v2 EXTRACT-08 시드) |
  |---|---|---|
  | `hallucination` | 추출은 됐지만 ground truth에 없음 (영상에 언급 X) | LLM citation 강화 (현 Phase 2 D-04로 부분 차단) |
  | `wrong_place` | 영상에는 있지만 다른 place_id로 resolve (예: 동명이인 카페) | Places API context bias 도입 (위치+카테고리) |
  | `wrong_city` | 도시 추론 오류 (서울인데 도쿄로 매칭) | `inferred_city` 활용한 region bias |
  | `missing_lowconf` | LLM이 confidence < 0.7로 후보 냈으나 정답이었음 (현재 UI에서 약하게 표시되지만 보존됨 — 카운트는 hit) | — |
  | `missing_dropped` | LLM이 후보 안 냈거나 citation 없어 drop | transcript 품질 / prompt 개선 |
  | `transcript_fail` | 자막 자체 없거나 fetch 실패 → 영상 전체 skip | YouTube auto-caption fallback |
- **D-08: 측정 자동화 X — 수동 비교.** 12개 영상 × 평균 8 placement = 약 100 pair 비교. 자동 매칭 스크립트는 v2 EXTRACT-08의 일부. v1은 markdown 표 한 장으로 충분.
- **D-09: 결과 산출물 = `.planning/dogfooding/extraction-baseline-YYYY-MM-DD.md`.** 구성:
  1. 메타 (12개 영상 + sampling decisions)
  2. 영상별 표 (sample_id, url, ground_truth_count, extracted_count, matched_count, recall, precision, failure_label_counts)
  3. 집계 (overall recall, overall precision, 카테고리별·도시별 분포)
  4. Top 5 failure modes + 예시 추출 결과
  5. v2 EXTRACT-08로 넘기는 작업 항목

### T4. 7일 사용 tracking (Success Criterion 1~2)

- **D-10: Tracking = `.planning/dogfooding/daily-log-YYYY-MM-DD.md` 한 파일 + git commit으로 매일 1건.** Notion/GitHub Issue 없음 (외부 의존 최소).
  ```
  ## Day 1 — 2026-05-XX
  - 보드: "오사카 6월 출장"
  - 추가한 링크: 3
  - 추출 성공: 2 (핀 5개) / 실패: 1 (자막 없음, retry 후 성공)
  - 수동 핀: 1 (호텔)
  - 발견 이슈: 카톡 OG 캐시가 보드 제목 변경 후 안 갱신됨 (15분 후 정상)
  - 핀 누적: 6
  ```
  매일 git commit `docs(06): dogfooding day N log`. 7일 = 7 commit 흔적이 SQL 없이도 시계열 증명.
- **D-11: 객관적 metric은 SQL 보조집계로 보강.** 7일 종료 시점에 dogfooding 보드의 `links.created_at` + `places.created_at` 분포를 SQL로 추출해 daily-log 마지막에 첨부:
  ```sql
  select date_trunc('day', created_at) day, count(*) links
  from links where board_id = '<my-board-id>' group by 1 order by 1;
  ```
  Phase 3 D-11의 p90 추출 시간도 같은 SQL 한 번에:
  ```sql
  select percentile_cont(0.9) within group (order by total_ms) p90_ms
  from (select link_id, sum(duration_ms) total_ms
        from extraction_costs where link_id is not null group by 1) t
  where total_ms is not null;
  ```
- **D-12: "7일 연속"의 정의 = 달력일 7일 + 각 일에 ≥ 1건의 보드 행위 (링크 추가 OR 핀 확정/거부/이름 수정 OR 공유 URL 열람).** 단순 앱 launch는 카운트 X — 실제 사용을 강제.
- **D-13: "10개+ 핀"의 정의 = `places where board_id = my-board AND hidden_at IS NULL`.** 추출 핀 + 수동 핀 + low-conf 확인된 핀 모두 카운트. dogfooding 보드 1개에 집중 (분산 X).

### T5. 친구 공유 e2e (Success Criterion 3)

- **D-14: 친구 2명.** 1명만 하면 디바이스 다양성 X, 3명 이상은 사이드 프로젝트 부담 ↑. 2명 = 최소 통계 다양성 + iOS/Android 1대씩 권장.
- **D-15: 검증 항목 (각 친구별로)**:
  - [ ] 카톡 채팅창에 URL 붙여넣었을 때 OG 카드(보드명 + 미니맵 + 핀 수) 정상 표시 — 스크린샷
  - [ ] 친구가 카드 탭 → 모바일 브라우저에서 보드 페이지 정상 로드 (지도 + 핀 N개) — 스크린샷
  - [ ] 친구가 핀 1개를 탭 → YouTube 앱·웹에서 정확한 timestamp로 영상 재생 — 스크린샷 또는 짧은 화면 녹화
  - [ ] 친구가 비로그인 상태로 모든 위 동작 — login 강제 안 됨 확인
  - [ ] 친구의 한 줄 피드백 (자유 형식) — 향후 v2 UX 개선 시드
- **D-16: 검증 산출물 = `.planning/dogfooding/friend-share-test.md`.** 스크린샷은 `.planning/dogfooding/screenshots/` 하위에 친구별 폴더로. 친구 실명·연락처 기록 X (이니셜 또는 익명 라벨).

### T6. Production 실패 분류 + 운영 documentation

- **D-17: dogfooding 중 발견되는 모든 production 실패는 즉시 다음 4종 중 1개로 라벨링하여 `.planning/dogfooding/incidents.md`에 1행 추가.**
  | 라벨 | 정의 | 액션 |
  |---|---|---|
  | `P0` | core value 차단 (링크→핀이 안 됨, 공유 URL 안 열림, 앱 크래시) | dogfooding 중단 → hotfix → fix 후 재개 (해당 일 day count 유지) |
  | `P1` | UX 마찰 (잘못된 핀, 느린 추출, 카카오 OG 안 갱신) | dogfooding 계속. v2 백로그 등록 (`v2-backlog.md` 또는 GitHub issue) |
  | `expected-v1-limit` | 알려진 v1 제약 (예: confidence < 0.7 핀이 옅게 표시되지만 reject UI는 1탭만, 블로그·인스타 미지원) | 정상 동작. incidents에 기록 X — daily-log notes에만 |
  | `noise` | 사용자 입력 오류 (잘못된 URL 형식, 로그인 만료) | 기록 X |
- **D-18: P0 발생 시 dogfooding 게이트 fail 처리는 X — fix 후 게이트는 "P0가 7일 중 ≤ 1건이고 해당 일에 fix되어 다음 일 정상 사용 재개" 조건으로 pass.** 2건 이상 P0 = fail = 추가 보강 phase 후 재시도.
- **D-19: 신규 pitfall (v2 백로그)은 별도 `.planning/research/PITFALLS.md`에 append (이미 존재) — Success Criterion 5.**

### T7. Exit criteria (Pass / Fail)

- **D-20: Pass 조건 (모두 충족)**:
  1. T1 pre-dogfooding 체크리스트 100% 통과
  2. T2 baseline 측정에서 **overall recall ≥ 0.70 AND overall precision ≥ 0.75** (도전적이지만 dogfooding 가능선)
  3. T3 7일 사용 — daily-log 7개 git commit + SQL 집계로 10개+ 핀 증명
  4. T4 친구 2명 e2e — 양쪽 모두 모든 체크박스 ☑️
  5. T6 P0 ≤ 1 (해당 일 fix 완료) AND P1 모두 v2 백로그 등록
  6. Success Criterion 5 — 신규 pitfall이 1건 이상 PITFALLS.md에 append (없으면 관찰 부족 의심 → 추가 dogfooding 권고)
- **D-21: Fail 조건 (단 1개라도)**:
  - recall < 0.70 또는 precision < 0.75 → v1.1 추출 보강 phase (Phase 6.1) 필요. 게이트 X.
  - 7일 중 P0 ≥ 2 → 안정성 보강 phase 필요.
  - 친구 1명이라도 카톡 OG 또는 모바일 브라우저에서 실패 → Phase 4 잔여작업 재진입.
  - 7일 미달성(중도 포기) → 동기 부족 또는 core value 미작동 — STATE 재점검.
- **D-22: Pass 시 `.planning/dogfooding/PASS.md`에 sign-off**: 날짜, baseline 결과 수치, 7일 핀 수, 친구 피드백 1줄씩, P0 incidents 수. 이걸로 Phase 1.5 (협업·투표) 마일스톤 진입 가능.

### Claude's Discretion (researcher/planner가 정함)

- sample 영상 실제 URL 선정 (D-03~05 기준에 맞으면 어느 영상이든)
- daily-log 양식의 미세 조정 (체크박스·이모지 사용 여부)
- baseline markdown 표의 컬럼 정확 순서
- pre-dogfooding 체크리스트 내 단일 plan(06-01) vs 분할(06-01 인프라 + 06-02 UAT) 결정 — researcher가 작업 부피 보고 판단

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 정의·요구사항
- `.planning/ROADMAP.md` §"Phase 6: Dogfooding Gate" — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` §"Extraction Pipeline (EXTRACT)" EXTRACT-07 + §"Dogfooding Gate"
- `.planning/PROJECT.md` §"Dogfooding Gate" 한 줄 정의

### Prior phase deferred (T1에서 close)
- `.planning/phases/03-ios-save-flow/03-VALIDATION.md` — manual UAT scenarios 1~5 + N1 + N2
- `.planning/phases/03-ios-save-flow/03-CONTEXT.md` D-11 — p90 SQL aggregate
- `.planning/phases/04-public-board-web/deferred-items.md` — Edge Function `deno check` 9 errors
- `.planning/phases/04-public-board-web/04-CONTEXT.md` — REVALIDATE_SECRET, Maps Static API, 모바일/카카오 OG UAT
- `.planning/phases/05-trust-ui-onboarding/05-01-SUMMARY.md` — `supabase db push` + `pnpm supabase:types` deferred
- `.planning/phases/05-trust-ui-onboarding/05-CONTEXT.md` — step indicator, low-conf sheet, onboard card 동작

### Prior phase decisions (lock 유지)
- Phase 2 `02-CONTEXT.md` D-02 (5단계 broadcast), D-04 (citation required), D-09 (extraction_costs 1행/호출)
- Phase 3 `03-CONTEXT.md` D-01 (1탭 토스트), D-04/05/06 (offline drain + retry > 3)
- Phase 4 `04-CONTEXT.md` D-14 (YouTube window.open), D-17 (web에 trust 인터랙션 X)
- Phase 5 `05-CONTEXT.md` D-04 (confirm = source_kind 전환), D-09 (step name 한국어 fixture)

### 운영 인프라
- Vercel project env (web)
- Supabase project: linked. `supabase db push` + `supabase functions deploy` 권한 확인
- GCP Console: Maps Static API + Places API + billing alert ($5/$20/$50 Phase 2 EXTRACT-06)
- 본인 iPhone (실기기), 친구 2명 device (iOS 1, Android 1 권장)

### 프로젝트 가드레일
- `CLAUDE.md` §3.4 Goal-Driven Execution — 본 phase가 가장 핵심. 검증 가능한 목표(Pass criteria)로 변환되어 있어야 함
- `CLAUDE.md` §4.3 마이그레이션 append-only — pre-dogfooding 중 신규 마이그레이션 0007+ 만들 일 있을 수 있음 (P0 fix)
- `CLAUDE.md` §5 절대 하지 말 것 — 신규 기능 X, web에 보드 생성 UI X

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extraction_costs.duration_ms` (Phase 2 D-09) — 7일 사용 p90 SQL aggregate 즉시 가능
- `links.extraction_status` + `places.source_kind`/`confidence` (Phase 2/5) — daily-log SQL 보조집계의 모든 컬럼 이미 존재
- `docs/manual-uat-phase3.md` (Plan 03-01 산출물) — Phase 3 UAT 스크립트가 이미 작성됨. T1에서 그대로 실행
- `apps/web/__tests__/og-image.test.ts` (Plan 04-04) — Pretendard + Static Maps 로컬 검증. 친구 공유 전 sanity check로 1회 더 run

### Known Pitfalls (재발 방지)
- **카카오 OG 캐시:** Kakao scraper는 처음 본 URL을 24시간 캐싱. dogfooding 중 보드 제목 변경 시 OG 카드는 안 갱신됨 — 동작이지 버그 아님 (`expected-v1-limit`)
- **Realtime broadcast race:** 추출이 빠르게 끝나면 클라이언트 구독 전에 `done` 메시지가 발사될 가능성. Phase 3 D-10의 `done` 토스트가 안 떠도 핀은 정상 표시됨 — daily-log에 "done 토스트 안 뜸" 발생 시 P1로
- **Edge Function `deno check` 9 errors (Phase 4 deferred):** T1 type regen으로 자동 해소되지 않으면 helper generic widening 직접 fix 필요. 시간박스 30분, 초과 시 v2 EXTRACT-08과 묶음
- **prebuild 후 entitlement drift:** Plan 03-02 expo-share-intent가 entitlement 자동 wire하지만 react-native-css-interop hoist 패턴(Phase 1 D-?? lesson)처럼 native dep가 누락될 수 있음. T1 첫 prebuild 후 `apps/ios/ios/MOAJOA/MOAJOA.entitlements` 직접 검증
- **친구 device language:** 카톡 OG가 한국어 폰트 정상 표시되더라도 친구 device가 영어 locale이면 모바일 브라우저의 시스템 폰트 fallback이 다를 수 있음 — D-15 screenshot에서 locale 명시

</code_context>

<specifics>
## Specific Ideas

### Sample 영상 12개 매트릭스 (D-04 instantiation)

| # | category | city | length | lang | source |
|---|---|---|---|---|---|
| 1 | vlog | seoul | short | ko | creator |
| 2 | vlog | seoul | long | ko | auto |
| 3 | vlog | tokyo | short | ja | creator |
| 4 | vlog | tokyo | long | ja | auto |
| 5 | food | seoul | short | ko | creator |
| 6 | food | seoul | long | ko | auto |
| 7 | food | tokyo | short | ja | creator |
| 8 | food | tokyo | long | ko | creator |
| 9 | walk | seoul | short | ko | auto |
| 10 | walk | seoul | long | ko | creator |
| 11 | walk | tokyo | short | ja | auto |
| 12 | walk | tokyo | long | ko | auto |

(researcher가 실제 URL을 채워서 `samples.json`로.)

### 7일 dogfooding 핀 분포 가이드 (목표 ≥ 10)

- Day 1~2: 보드 생성 + 후보 영상 vlog 1~2개 추출 (예상 핀 4~8)
- Day 3~4: 친구가 추천해준 식당·카페 영상 추출 (예상 +3~5)
- Day 5: 호텔·공항·환승역 수동 핀 (예상 +2~3)
- Day 6: 카카오로 친구에게 공유 + 친구 피드백 반영 (이름 수정 등)
- Day 7: 보드 전체 review, low_confidence 핀 confirm/reject 정리

### 실패 라벨링 예시 (D-17)

- "iOS 앱이 share extension에서 보드 picker로 안 빠짐" → P0
- "추출이 60초 걸림 (p90 30초 초과)" → P1
- "low confidence 핀이 약하게만 보이고 자동 dismiss 안 됨" → expected-v1-limit (확정/거부는 사용자 액션 필요가 contract)

### Pre-dogfooding 통합 plan 단위 (D-01)
- Plan 06-01 — 인프라 + 빌드 (1시간, 직렬)
- Plan 06-02 — Phase 3/4/5 UAT 일괄 실행 (2~3시간, 디바이스 작업)
- Plan 06-03 — Sample 영상 선정 + ground truth 작성 (2시간, 일회성)
- Plan 06-04 — Baseline 측정 실행 + 문서화 (3~4시간)
- Plan 06-05 — 7일 dogfooding 시작 (7 daily-log + git commit + SQL 집계)
- Plan 06-06 — 친구 공유 e2e (1~2시간 합산)
- Plan 06-07 — PASS.md sign-off + STATE.md update

(researcher가 plan 분할 부피 보고 합칠 수 있음.)

</specifics>

<open_questions>
## Open Questions (RESOLVED)

이 phase의 모든 grey area는 위 D-01~D-22로 lock. 추가 결정이 필요한 영역은:

- ~~Sample 영상 개수~~ → D-03 (12개)
- ~~Sample 다양성 기준~~ → D-04 (category × city × length × lang × source 매트릭스)
- ~~Accuracy metric 정의~~ → D-06 (precision + recall + 6종 failure label)
- ~~Ground truth 작성법~~ → D-05 (수동 시청 + Google Maps id 매칭)
- ~~7일 사용 tracking method~~ → D-10/11 (`.planning/dogfooding/daily-log-*.md` + 매일 commit + SQL 집계)
- ~~"7일 연속"의 정의~~ → D-12 (≥ 1건 보드 행위/일)
- ~~"10개+ 핀"의 정의~~ → D-13 (hidden_at IS NULL, 1개 보드 집중)
- ~~친구 공유 인원·검증 항목~~ → D-14/15/16
- ~~Phase 3/4/5 deferred 통합 방법~~ → D-01 (단일 pre-dogfooding checklist + plan 06-01에 응축)
- ~~Production 실패 분류~~ → D-17/18 (P0/P1/expected-v1-limit/noise)
- ~~Exit criteria (Pass/Fail 임계값)~~ → D-20/21 (recall ≥ 0.70, precision ≥ 0.75, P0 ≤ 1)
- ~~신규 pitfall 처리~~ → D-19 (`.planning/research/PITFALLS.md` append)

남은 사람 의사결정 영역 (researcher가 후속 plan에서 결정):
- Plan 단위 분할 (06-01 단일 vs 분할) — researcher 판단
- Sample 영상 실제 URL 12개 — researcher 또는 사용자가 직접
- 친구 2명 실제 섭외 시점 — Day 5~6 권장

</open_questions>

<deferred_ideas>
## Deferred Ideas (out of Phase 6 scope)

- **Automated extraction evaluation framework** (v2 EXTRACT-08) — 자동 precision/recall 측정, regression detection, prompt diff A/B. Phase 6 baseline의 sample + failure mode가 그 시드.
- **LLM prompt 자동 튜닝** (v2 EXTRACT-09) — eval 기반.
- **Multi-user closed beta** — 친구 2명을 넘어 외부 사용자 5~10명. App Store 또는 TestFlight 배포 전제 필요.
- **App Store submission** — Apple 심사 + 개인정보 처리방침 + 마케팅 자산. v2 마일스톤 (`v2-app-store.md` 같은 별도 phase).
- **Sentry/PostHog 도입** (v2 OBS-01) — incidents.md를 자동화하면서 실제 운영 도입.
- **추출 비용 대시보드** — Phase 2 deferred. extraction_costs SQL 집계만으로 충분 (Looker Studio 또는 단순 markdown report).
- **블로그·인스타 추출 지원** (v2 EXTRACT-10) — 운영진 manual queue.
- **공식 sample 보드 (sample 영상 사전 보드 시드)** — Phase 5 deferred. 첫 인상 자동 가이드.
- **Onboarding telemetry** (v2 OBS-01과 짝) — 카드 dismiss 비율, 첫 보드 핀 추가까지 시간.
- **`/discover` 공개 보드 탐색 피드** (v2 VIEW-07).
- **공유 보드 멤버 초대 + ❤️ 투표** (Phase 1.5 COLLAB-01/02) — Phase 6 통과 후.
- **Google/Apple OAuth** (v2 AUTH-05/06) — 외부 사용자 확장 시.
- **다국어 UI** (v2 I18N-01).
- **다크 모드** (v2 THEME-01).
- **CI typecheck/lint** (v2 CI-01).

</deferred_ideas>

---

*Phase: 06-dogfooding-gate*
*Context gathered: 2026-05-26 (auto mode)*
*Next: `/gsd-plan-phase 6` — researcher가 위 결정 기반으로 RESEARCH.md, planner가 06-01~06-07 PLAN.md 작성.*
