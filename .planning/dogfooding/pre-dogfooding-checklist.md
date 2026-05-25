# Pre-Dogfooding Checklist (D-01 / D-02 lock)

> **Goal:** Phase 3 / 4 / 5에서 "end-of-phase batch"로 미뤄둔 모든 deferred 작업(인프라 push, env 등록, prebuild, manual UAT)을 단일 체크리스트로 집계 — 7일 dogfooding을 깨끗한 환경에서 시작.
>
> **Lock:** D-01 (5 그룹 A~F) + D-02 (sign-off 규칙)
> **Run when:** dogfooding Day 1 시작 직전
> **Output:** 모든 ☑️ + 각 항목에 commit SHA / 스크린샷 경로 inline 기록 → Sign-off 시각 기록 → dogfooding 가능 신호

각 항목의 "상태 + 증거" 칸은 처음엔 빈칸 — 본인이 항목을 수행할 때 `git rev-parse HEAD` SHA, 스크린샷 경로(`screenshots/...`), 또는 관찰 결과를 inline 기록한다.

---

## A. Phase 5 → 인프라 (먼저 — Edge Function/타입 안정화)

| # | 항목 | 검증 명령/관찰 | 상태 + 증거 |
|---|------|--------------|-----------|
| A-1 | `supabase login` (one-time) → `supabase link --project-ref <ref>` | `supabase projects list`에서 linked ✓ 확인 | ⬜ — _증거:_ |
| A-2 | `supabase db push` → migration 0006_trust_ui_onboarding.sql apply | `psql "$SUPABASE_DB_URL" -c "\d places"` 출력에 `confidence numeric(3,2)` 컬럼 존재 | ⬜ — _증거: psql output paste + push 시각_ |
| A-3 | first_board trigger backfill 검증 (05-01-SUMMARY.md User Setup #3) | `psql "$SUPABASE_DB_URL" -c "select count(*) from profiles p where not exists (select 1 from boards where owner_id = p.id);"` → **0** | ⬜ — _증거: 결과 행 수_ |
| A-4 | `pnpm supabase:types` → `packages/api/src/types/database.ts` 재생성 후 `grep -c confidence packages/api/src/types/database.ts > 0` | **WARN:** 05-01-SUMMARY.md Rule 1 — redirect 실패 시 파일을 0바이트로 만들 수 있음. 실패하면 `git checkout HEAD -- packages/api/src/types/database.ts` 후 재시도 | ⬜ — _증거: grep -c 결과 + 변경 라인 수_ |
| A-5 | `pnpm typecheck`(루트) → 0 에러 | exit code 0 또는 "All good" | ⬜ — _증거: exit code 또는 메시지_ |
| A-6 | `deno check supabase/functions/extract-youtube/index.ts` → Phase 4 deferred-items.md의 9 errors 해소 확인 | 잔여 에러 발생 시 helper generic widening 직접 fix (시간박스 30분, 초과 시 `v2-backlog.md` 로 이동) | ⬜ — _증거: error count before/after_ |

---

## B. Phase 4 → 웹 인프라

| # | 항목 | 검증 명령/관찰 | 상태 + 증거 |
|---|------|--------------|-----------|
| B-1 | `openssl rand -hex 32` → `REVALIDATE_SECRET` 값 생성 (한 번 생성 → 양쪽 동일 값) | 첫 8글자만 paste (full secret 보안 위해 X) | ⬜ — _증거: 첫 8글자_ |
| B-2 | Vercel Production env에 `REVALIDATE_SECRET` set | Vercel Dashboard → Project → Settings → Environment Variables. 확인: `vercel env ls production \| grep REVALIDATE_SECRET` | ⬜ — _증거: vercel env ls output_ |
| B-3 | Supabase Edge Function secret에 동일 값 set | `supabase secrets set REVALIDATE_SECRET=<value> --project-ref <ref>` 후 `supabase secrets list \| grep REVALIDATE_SECRET` | ⬜ — _증거: secrets list output_ |
| B-4 | Vercel에 추가 env 확인: `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WEB_BASE_URL`(또는 `REVALIDATE_BASE_URL`) 모두 production에 set | `vercel env ls production` grep | ⬜ — _증거: vercel env ls grep_ |
| B-5 | GCP Console → APIs & Services → Library → "Maps Static API" → **Enable** | 동일 API key에 referrer restriction이 `*.vercel.app`와 production 도메인 모두 허용 확인 | ⬜ — _증거: GCP UI 스크린샷 (`screenshots/maps-static-api-enabled.png`)_ |
| B-6 | `supabase functions deploy extract-youtube` (REVALIDATE_SECRET 환경 반영) | deploy output 확인 | ⬜ — _증거: deploy output 또는 commit SHA_ |
| B-7 | Webhook 작동 sanity — 임의의 public 보드에 URL 추가 → 추출 트리거 → Vercel logs에서 `/api/revalidate` 호출 1건 확인 | Vercel Dashboard → Project → Logs → filter `/api/revalidate` | ⬜ — _증거: Vercel log entry paste_ |

---

## C. Phase 3 → iOS prebuild + 실기기 install

| # | 항목 | 검증 명령/관찰 | 상태 + 증거 |
|---|------|--------------|-----------|
| C-1 | `pnpm --filter @moajoa/ios prebuild` (Path A) — 첫 native build | expo-share-intent plugin이 entitlement wiring 수행했는지 prebuild output에 표시 | ⬜ — _증거: prebuild 시각 + exit code_ |
| C-2 | `cat apps/ios/ios/MOAJOA/MOAJOA.entitlements \| grep -A2 com.apple.security.application-groups` | `group.com.serendipitylife.moajoa` 한 줄 inline 확인 (06-CONTEXT Known Pitfall "prebuild 후 entitlement drift") | ⬜ — _증거: grep output paste_ |
| C-3 | `cd apps/ios/ios && pod install && cd -` | exit 0 | ⬜ — _증거: exit code_ |
| C-4 | Xcode 또는 EAS로 실기기 install — 첫 화면 뜨고 NativeWind 적용됨 (Phase 1 BUILD-01/02 회귀 확인 겸용) | 시각 확인 | ⬜ — _증거: `screenshots/cold-launch.png`_ |

---

## D. Phase 3 → 실기기 manual UAT (`docs/manual-uat-phase3.md` 시나리오)

각 시나리오는 `docs/manual-uat-phase3.md`에서 정의됨. 본 체크리스트는 status만 mirror — 실제 진행은 `docs/manual-uat-phase3.md`의 체크박스로 한다 (Plan 06-01 Task 2에서 Evidence 라인 추가됨).

| # | 항목 | 검증 명령/관찰 | 상태 + 증거 |
|---|------|--------------|-----------|
| D-1 | Scenario 1 — 로그인 → boards → 보드 상세 진입 (SAVE-01) | docs/manual-uat-phase3.md Scenario 1 체크박스 ✓ + 화면 전환 < 1초 | ⬜ — _증거: docs/manual-uat-phase3.md ✓ + 스크린샷 경로_ |
| D-2 | Scenario 2 — URL 추가 → 30s 내 핀 (SAVE-02, 3 timed runs max-of-3) | t0~t1 측정 3회. 최대값 ≤ 30s | ⬜ — _증거: 3개 시각 측정값 + 최대값_ |
| D-3 | Scenario 3 — Safari/카톡 share sheet → MOAJOA 저장 (SAVE-03, dismiss < 1.5s) | Share Extension dismiss < 1.5초, toast 정확히 "{보드명} - 저장됨" | ⬜ — _증거: 스크린샷 + dismiss 시각 추정_ |
| D-4 | Scenario 4 — airplane mode → 추가 → online drain (SAVE-04) | offline toast "오프라인 — 나중에 저장돼요" + cold launch + foreground 양쪽 drain | ⬜ — _증거: 핀 표시 스크린샷_ |
| D-5 | Scenario 5 — 수동 핀 + 검색 → resolve → rename → delete (SAVE-05) | 각 단계 1~9 모두 성공, RLS 차단 없음 | ⬜ — _증거: 각 단계 스크린샷_ |
| D-6 | N1 — retry > 3 → `pending_links_failed` + banner | banner 스크린샷 또는 unit test (`__tests__/pending.test.ts` from Plan 03-04) 결과 인용 | ⬜ — _증거: banner 스크린샷 또는 jest 결과_ |
| D-7 | **N2 (REQUIRED — binary gate)** — SQL RLS 회피 시도 | `psql "$SUPABASE_DB_URL" -c "select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true); insert into places (board_id, name_local, lat, lng) values ('<my-board-id>', 'rls-test', 0, 0);"` → expect `ERROR: 42501` (insufficient_privilege) | ⬜ — _증거: 정확한 에러 메시지 paste_ |

---

## E. Phase 4 → 실브라우저 UAT

| # | 항목 | 검증 명령/관찰 | 상태 + 증거 |
|---|------|--------------|-----------|
| E-1 | iPhone Safari로 `https://<prod-host>/b/<my-public-slug>` 열람 | 핀치줌, 핀 탭, gestureHandling 'greedy' 정상 | ⬜ — _증거: `screenshots/ios-safari-public-board.png`_ |
| E-2 | 핀 탭 → YouTube 앱/웹에서 정확한 `?t=Xs` timestamp로 영상 재생 | window.open + buildYouTubeWatchUrl 동작 검증 (04-CONTEXT D-14/D-15/D-16) | ⬜ — _증거: 짧은 화면 녹화 또는 스크린샷_ |
| E-3 | 카톡 "나에게 보내기"에 production URL 붙여넣기 → OG 카드 한글 정상 (Pretendard) + 미니맵 thumbnail + 핀 N개 | 카톡 OG 카드 시각 확인 | ⬜ — _증거: `screenshots/kakao-og-preview.png`_ |
| E-4 | Vercel Analytics에서 `/b/[slug]` SSR TTFB 측정 → p90 < 800ms (VIEW-01 manual gate, 표본 ≥ 10 요청) | Vercel Analytics dashboard | ⬜ — _증거: Vercel Analytics 스크린샷 + 측정값_ |

---

## F. Phase 5 → iOS UAT

| # | 항목 | 검증 명령/관찰 | 상태 + 증거 |
|---|------|--------------|-----------|
| F-1 | 5단계 step indicator 시각 확인 — 보드 상세에서 URL 추가 → overlay에 '메타데이터' → '자막' → 'AI 분석' → '장소 찾기' → '완료' 순서로 카피 표시 (D-09 EXTRACT_STEP_KO fixture) | 5단계 모두 시각 확인 | ⬜ — _증거: 5장 스크린샷 또는 화면 녹화_ |
| F-2 | Low confidence 핀 marker (opacity 0.5 + amber 'CYR' badge) — 추출 결과 중 `confidence < 0.7`인 핀이 시각적으로 약하게 표시됨 | 지도에서 약한 marker 확인 | ⬜ — _증거: 지도 스크린샷_ |
| F-3 | PinBottomSheet에서 low-conf 핀 탭 → `[확인]` / `[잘못됨]` 버튼이 이름 수정 위에 표시됨 → `[확인]` 탭 → source_kind='manual' + confidence=null로 변경되어 marker가 normal로 바뀜 | before/after 시각 비교 | ⬜ — _증거: before/after 스크린샷_ |
| F-4 | 첫 보드 자동 생성 trigger 검증 | `psql "$SUPABASE_DB_URL" -c "select * from boards where owner_id = '<my-uuid>';"` → '내 첫 여행' 보드 1개 이상 | ⬜ — _증거: SQL 결과_ |
| F-5 | OnboardCard 표시 + dismiss 영구 — 첫 보드 상세 진입 시 amber-50 카드 1회 표시, × 탭 후 재진입 시 미표시 | 진입 / dismiss / 재진입 3-step | ⬜ — _증거: 2장 스크린샷 (보임/안 보임)_ |

---

## Sign-off (D-02)

- [ ] **모든 체크박스 ☑️ + 각 항목에 commit SHA 또는 스크린샷 경로 inline 기록 완료**
- [ ] **P0 발견 시 fix → 체크박스 close** (별도 hotfix commit 허용, GSD 우회 per 06-CONTEXT scope lock)
- [ ] **P1 이하 발견 시 `.planning/dogfooding/v2-backlog.md`에 1행 등록** (close 안 해도 dogfooding 시작 가능)
- [ ] **Sign-off 시각 + 본인 이니셜 기록** → dogfooding Day 1 시작 가능 신호

**Sign-off:**
- Date / time: ____
- Initials: ____
- Outstanding items rolled to v2-backlog: ____

---

*Pre-dogfooding gate per Phase 6 D-01 / D-02. 본 체크리스트가 모두 close되어야 7일 dogfooding 시작.*
*Document created: 2026-05-26 (Plan 06-01 Task 1)*
