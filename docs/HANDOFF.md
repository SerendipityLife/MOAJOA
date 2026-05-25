# MOAJOA 동료 핸드오프 — 2026-05-25

> 이 문서는 **동료가 오늘 합류했을 때** 어디서부터 어떻게 시작할지 한 페이지로 보여주려고 만든 거예요.
> 더 자세한 컨텍스트는 `CLAUDE.md`(프로젝트 룰) · `.planning/PROJECT.md`(컨셉) · `.planning/ROADMAP.md`(전체 phase 계획) · `docs/WORKSTREAMS.md`(원본 워크스트림 정의)를 보면 돼요.

## 1. 30초 컨텍스트

- **MOAJOA**: 유튜브·블로그·인스타 링크 → 영상 속 장소 자동 추출 → 지도 보드. 친구와 공유·투표.
- **상태:** 2026-05-24 Flutter ASIS → TS 모노레포로 피봇 시작. 스캐폴드 + 인증·DB·Edge Function 배포는 완료.
- **현재 마일스톤:** v1 (자기 dogfooding 가능선). 6 phase로 분해됨.
- **워크플로우:** [GSD (Get Shit Done) Redux](https://github.com/open-gsd/get-shit-done-redux). `/gsd-*` 슬래시 커맨드로 phase별 진행. CLAUDE.md §2 참고.

## 2. 진행 상황 한눈에

| Phase | 이름 | 상태 | 누가 |
|---|---|---|---|
| **1** | Build Unblock & Hygiene | 진행 중 (3/4 부분 완료) | iOS는 wcb · Web/Design은 완료 |
| **2** | Extraction Pipeline Hardening | **미시작 (← 동료 시작 가능)** | Backend |
| **3** | iOS Save Flow | 미시작 (Phase 1·2 끝나야 시작) | iOS = wcb |
| **4** | Public Board (Web) | 미시작 (Phase 2 끝나야 의미 있음) | Web |
| **5** | Trust UI & Onboarding | 미시작 (3+4 끝나야) | 양쪽 cross-cut |
| **6** | Dogfooding Gate | 미시작 (전부 끝나야) | wcb (사용자 본인) |

### Phase 1 세부 상태
- ✅ **01-01 Brand assets** — completed (commits `fbab9e2` `f672279` `5cd4446` `a174919`). Pretendard 4-weight 폰트, icon/splash PNG 산출, sharp export 파이프라인, pnpm hoist scope `apps/ios/`로 한정.
- ⏳ **01-02 iOS prebuild + smoke screen** — **미시작, wcb가 본인 iPhone+Mac+Xcode 세션으로 진행 예정**. 동료가 손댈 수 없음 (하드웨어 의존).
- 🟡 **01-03 Web dev-tool gate** — Tasks 1+2 commit됨 (`31e5bfb` `72864be`), **Task 3 build+curl verify 보류**. `.planning/phases/01-build-unblock-hygiene/01-03-SUMMARY.md` 참고. 동료가 close-out 해도 됨 (web만 만져서 3분).
- ❓ **01-04 EAS Build fallback** — 조건부 (01-02 4시간 timebox 도달 시에만 실행). 현재 미정.

## 3. 영역 분할

### 🙋 **내가 (wcb) 하는 영역 — 손대지 말아주세요**

| 경로 | 이유 |
|---|---|
| `apps/ios/**` | iOS Native build. 본인 아이폰+Mac+Apple Developer cert로만 검증 가능. Phase 1.2 → 3 → 5(iOS 부분) → 6 line. |
| `docs/SESSION-NOTES-*.md` | 본인 빌드 timeline 기록용 (D-14 timebox). 새 entry 추가는 ok, 기존 timeline 수정은 X. |
| `.planning/STATE.md` 의 "Performance Metrics" 섹션 | 본인 dogfooding 측정값 (Phase 6) 채워나갈 거임. |

### 🤝 **동료가 시작할 수 있는 영역 — 추천 순서**

**(추천) 1순위: Phase 2 — Extraction Pipeline Hardening (Backend)**

> Phase 1 iOS와 **완전히 file-disjoint**, Phase 1 끝나길 안 기다려도 됨. ROADMAP §"Phase 2"에 "Backend 독립 — Phase 1과 병렬 가능"으로 명시되어 있음.

- **파일 영역:** `supabase/migrations/**` (새 마이그레이션만 추가), `supabase/functions/extract-youtube/**`, 새 테이블 `extraction_costs`
- **요구사항:** EXTRACT-01 ~ EXTRACT-06 (`.planning/REQUIREMENTS.md` §Extraction Pipeline)
- **첫 step:** `/gsd-discuss-phase 2` → `/gsd-plan-phase 2` → `/gsd-execute-phase 2`. GSD 워크플로우는 CLAUDE.md §2.
- **핵심 deliverable:**
  1. `extract:{link_id}` Realtime broadcast 5단계 (metadata/transcript/llm/places/done)
  2. Claude 응답에서 `transcript_quote` 없는 후보 폐기 (Pitfall 1 citation 강제)
  3. `extraction_costs` 테이블 + 모든 추출 호출 logging
  4. Google Places API FieldMask 강제 (Pitfall 2)
  5. Google Cloud billing alert ($5/$20/$50)
  6. `places` 테이블에 `source_kind` · `video_offset_sec` · `quote` · `inferred_city` 컬럼 추가
- **주의:**
  - 마이그레이션은 **새 번호 파일만** (`0004_*.sql` 부터). 기존 `0001~0003` 절대 수정 X.
  - RLS 변경 시 SECURITY DEFINER 헬퍼 (이미 `am_board_owner`, `am_board_member` 패턴 있음 — `0002_fix_rls_recursion.sql` 참고).
  - 스키마 변경 후 `pnpm supabase:types` 돌려서 `packages/api/src/types/database.ts` 재생성.
  - Edge Function 로컬 테스트: `supabase functions serve --env-file ./supabase/.env.local`

**2순위: 01-03 Task 3 verify (3분짜리 마무리)**

`.planning/phases/01-build-unblock-hygiene/01-03-SUMMARY.md` §Pending에 정확한 bash command 있음. 통과하면 ROADMAP에서 `[~] 01-03-PLAN.md` 를 `[x]`로 바꾸고 SUMMARY frontmatter `status: partial` → `status: complete` 만 수정.

**3순위 이후 (Phase 2 진행 중 같이 가능):**

| 영역 | 파일 | 비고 |
|---|---|---|
| 디자이너 워드마크 정교화 | `packages/ui-tokens/src/brand/wordmark.svg` | 현재 6개 사각형 placeholder. Pretendard Bold outline path로 교체 후 `pnpm --filter @moajoa/ui-tokens run export-assets` 재실행하면 모든 PNG 자동 갱신. |
| Phase 4 사전 리서치 | (코드 아님) | Phase 4 = Web 공개 보드. Phase 2 완료 의존. `/gsd-research-phase 4` 또는 `/gsd-discuss-phase 4` 미리 돌려놓으면 본격 시작 빠름. |

## 4. 공유 영역 (둘 다 손댈 수 있음, 합의 필요)

| 경로 | 변경 시 영향 | 협의 방법 |
|---|---|---|
| `packages/core/src/schemas/**` | Web · iOS · Edge Function 모두 import (Zod 스키마) | PR 분리 + 이 한 commit에 schema + SQL 마이그레이션 짝지어 commit |
| `packages/core/src/constants.ts` | 도메인 한도·enum. 전부 import | 추가는 OK. 기존 값 변경은 PR description에 BREAKING 표시 |
| `packages/ui-tokens/src/**` (brand/ 제외) | Web Tailwind + iOS NativeWind 둘 다 영향 | 변경 시 양쪽 시각 확인 후 commit |
| `supabase/migrations/**` | append-only, 한 번 prod 적용되면 영구 | 새 번호 파일만. 동시 PR이 같은 번호 쓰면 충돌 — 머지 순서대로 rename |
| `packages/api/src/queries/**` | 누구든 새 helper 추가는 OK | 기존 함수 시그니처 변경 시 caller (apps/web · apps/ios · supabase/functions) 전부 확인 |
| `apps/web/lib/env.ts` | 향후 `NEXT_PUBLIC_*` 게이트 추가 위치 | 같은 helper 패턴 (`isDevToolsEnabled` 형식)으로 늘려나가기 |
| `.planning/ROADMAP.md` | phase 진행도 표시 | plan 완료 시 `[ ]` → `[x]` + Progress Table 갱신 |
| `.planning/STATE.md` | 현재 어디 있는지 | `Current Position` 섹션만 갱신, 다른 곳은 GSD 워크플로우가 만진다 |

## 5. 동료가 첫날 해야 할 일 체크리스트

1. [ ] **레포 클론 + 초기 setup**
   ```bash
   git clone https://github.com/SerendipityLife/MOAJOA.git
   cd MOAJOA
   pnpm install
   ```
2. [ ] **읽을 것 (순서대로):**
   - `CLAUDE.md` — 프로젝트 룰 + GSD 워크플로우 + Karpathy 4
   - `.planning/PROJECT.md` — 컨셉
   - `.planning/REQUIREMENTS.md` — 29개 요구사항
   - `.planning/ROADMAP.md` — 6 phase
   - `docs/WORKSTREAMS.md` — 워크스트림 정의 (피봇 직후 작성, 일부는 outdated — 본 HANDOFF가 더 최신)
   - `docs/SESSION-NOTES-2026-05-24.md` + `docs/SESSION-NOTES-2026-05-25.md` — 그동안의 결정 + 막힌 지점
3. [ ] **환경변수 셋업**
   - `cp .env.local.example .env.local` (root, apps/web, apps/ios, supabase 각각)
   - 실제 키는 wcb한테 따로 받기 (1Password / 노션 비밀 페이지)
4. [ ] **Supabase 로컬 연결**
   ```bash
   pnpm supabase login        # 본인 Supabase 계정으로
   pnpm supabase link --project-ref <ref>   # wcb한테 ref 받기
   pnpm supabase:types        # DB 타입 생성됐는지 확인
   ```
5. [ ] **첫 빌드 확인 (Backend만 만질 거면 step 5 web/iOS는 skip 가능)**
   ```bash
   pnpm --filter @moajoa/web build     # web 빌드
   pnpm -r typecheck                   # 모든 워크스페이스 typecheck
   ```
6. [ ] **GSD 워크플로우 익히기**
   - `/gsd-progress` — 현재 상태 보기
   - `/gsd-discuss-phase 2` — Phase 2 회색지대 결정 시작 (← 첫 작업)
7. [ ] **첫 PR 룰**
   - Conventional Commits (`feat(02-XX):`, `chore:`, etc.)
   - 마이그레이션 변경 시 PR description에 `BREAKING DB CHANGE` 명시
   - `.env.local` 절대 commit 금지

## 6. 막혔을 때 어디 물어보나

| 영역 | wcb한테 물어볼 것 |
|---|---|
| iOS 빌드 | (이건 wcb 영역. 동료가 손댈 일 없음.) |
| Supabase 키 / 프로젝트 ref | 비밀 채널 또는 직접 |
| 디자인 토큰 변경하고 싶은데 영향 범위 모르겠음 | PR draft + 노션 / 디스코드 |
| GSD 워크플로우 자체 | https://github.com/open-gsd/get-shit-done-redux 또는 `/gsd-help` |
| Karpathy 4 원칙 적용 헷갈림 | CLAUDE.md §3 + 실제 PR review |

## 7. 동시 작업 충돌 회피 룰

- **항상 본인 phase만 만지기.** wcb가 Phase 1.2 / 3 / 5(iOS) 작업할 때 동료는 Phase 2 / 4. 5는 둘 다 들어가지만 그때는 plan 단위로 file ownership 명시.
- **공유 영역(§4) 건드릴 거면 먼저 알리기.** 슬랙/디스코드 한 줄이면 충분 — "지금 packages/core/schemas/board.ts에 city_code 컬럼 zod 추가합니다" 식.
- **마이그레이션 번호 충돌:** 둘이 동시에 `0004_*.sql` 만들면 머지 순서대로 rename + 늦은 쪽이 본인 마이그레이션 안의 참조도 갱신.
- **pnpm-lock.yaml 변경은 별도 commit으로.** 다른 작업과 섞이면 리뷰 어려움.

---

**문서 작성:** 2026-05-25, wcb
**다음 갱신 트리거:** Phase 2 시작 시점, Phase 1.2(iOS) 완료 시점 또는 워크플로우 합의 변경 시
