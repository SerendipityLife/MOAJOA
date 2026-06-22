# MOAJOA 동료 핸드오프 — 2026-06-22 (v2.0)

> **동료가 v2.0 개발에 합류했을 때** 어디까지 됐고 / 뭘 / 어디서 시작하면 되는지 한 페이지로 보여주는 문서.
> 더 자세한 건 `CLAUDE.md`(룰) · `.planning/PROJECT.md`(컨셉) · `docs/PRODUCT.md`(제품 단일 출처) · `.planning/ROADMAP.md`(phase 계획) · `docs/WORKSTREAMS.md`(파일 경계).

---

## 1. 30초 컨텍스트

- **MOAJOA**: 유튜브 링크 → 영상 속 장소 자동 추출 → 지도. 친구와 공유·결정.
- **v2.0 비전:** 추출+투표에 머물던 걸 **발견 → 결정 → 플랜 → 예약 → 정산** 풀 루프로 확장. 네비게이션을 **여행 4단계(지도·플랜·예약·가계부)**로 재편. 제휴 수수료(Travelpayouts·Stay22)를 MVP에 내장.
- **팀:** 2인 사이드 프로젝트. 느슨한 페이싱.
- **워크플로우:** [GSD Redux](https://github.com/open-gsd/get-shit-done-redux). `/gsd-*` 슬래시 커맨드로 phase별 진행 (`/gsd-discuss-phase N` → `/gsd-plan-phase N` → `/gsd-execute-phase N`). CLAUDE.md §2.

---

## 2. 진행 상황 한눈에

**v1 baseline(추출·인증·DB·웹열람) 동작 + v2.0 Phase 17 완료.** 다음은 18~22.

| Phase | 이름 | 상태 | 의존 |
|---|---|---|---|
| **17** | Trip Foundation & IA 재편 | ✅ **완료 2026-06-21** (5/5 plan, verify 6/6, code review 해소) | — (비협상 기반) |
| **18** | Auto Plan (추출 즉시 AI 플랜) | ⬜ 미시작 | 17 |
| **19** | Date Voting (일정 미정 분기) | ⬜ 미시작 | 17 |
| **20** | Affiliate Booking (딥링크 제휴 예약) | ⬜ 미시작 | 17 + 18 |
| **21** | Travel Ledger (메일 전달 가계부) | ⬜ 미시작 | 17 (메일 인프라 리드타임 ↑ → 일찍 시작 권장) |
| **22** | Android Parity | ⬜ 미시작 | 17~21 전부 (마지막) |

### ⚠️ Phase 17이 바꾼 것 — pull 받으면 **반드시** 알아야 함

Phase 17은 "비협상 기반"이라 레포 전반을 갈아엎었어요. 모르고 시작하면 깨집니다.

1. **`boards` → `trips` 전면 rename.** DB 테이블·`packages/core` Zod·`packages/api` 쿼리·라우트 전부 trip 어휘.
   - `packages/core/src/schemas/board.ts` → **`trip.ts`** (`Trip`/`TripId`/`TripCreate`), `packages/api/.../queries/boards.ts` → **`trips.ts`**.
2. **0016 trips-native squash.** 기존 `0001~0014`는 `supabase/migrations/_archive/`로 이동, **`0016_trips_baseline.sql` 하나만 active.** (0015는 0016에 흡수)
   - → **로컬 DB는 반드시 `supabase db reset`** 해야 trips 스키마가 적용됨 (아래 §4 체크리스트).
   - 원격 Supabase는 이미 0016 베이스라인으로 reset 완료(`.backups/`에 이전 덤프 백업).
3. **식별자 계약 (모든 후속 phase가 import).** `packages/core/src/booking.ts`의 **`buildAffiliateUrl`가 예약 딥링크 만드는 유일한 헬퍼** — 손조립 절대 금지. SubID = `c_<base62>` opaque 토큰(`tripId.placeId.userId` 컨텍스트). 예약 관련 작업(Phase 20)은 전부 이 헬퍼 경유.
4. **IA 재편.** 진입 = `apps/ios/app/index.tsx`의 `decideEntryRoute`(0개→온보딩 / 1개→그 여행 / N개→마지막 본 여행). 여행 안 = `app/trip/[id]/(tabs)/{map,plan,book,ledger}`, 탭바 상시. 헤더 = 여행 전환 ▾ + 프로필. **가운데 ＋ FAB 제거.** 옛 `app/boards/`·글로벌 `(tabs)/` **삭제**(레거시 redirect 없음).
5. **웹 공개 공유 라우트 `/b/[slug]` → `/t/[slug]`** (`apps/web/app/t/[slug]/`).

전체 결정 근거: `.planning/phases/17-trip-foundation-ia/17-CONTEXT.md`(결정 15개) · `17-RESEARCH.md` · `17-VERIFICATION.md`.

---

## 3. 어디서 개발하나 — 다음 작업 분할 (2인 병렬)

**의존성 그래프:** `17 ✅` → **18·19·21 지금 바로 착수 가능**(전부 17만 의존) → `20`은 18 후 → `22` 마지막.

```
        ┌── 18 Auto Plan ──────────── 20 Affiliate Booking ──┐
17 ✅ ──┼── 19 Date Voting ───────────────────────────────────┼── 22 Android
        └── 21 Travel Ledger (메일 인프라 일찍) ───────────────┘
```

### 추천 분할 (파일 경계가 거의 안 겹치게)

| 누가 | 추천 Phase | 주 파일 영역 | 왜 |
|---|---|---|---|
| **wcb (iOS 주력)** | **Phase 18 — Auto Plan** | `apps/ios/app/trip/[id]/(tabs)/plan.tsx`(드래그 재배치 UI) + `supabase/functions/generate-plan/`(EF) + `packages/core`(플랜 모델) | iOS 디바이스 검증이 필요한 plan.tsx 중심. extract 완료가 곧 플랜 트리거. |
| **동료** | **Phase 19 — Date Voting** *또는* **Phase 21 — Travel Ledger** | 19: `apps/web/`(비로그인 투표 island) + `supabase/migrations`(date_polls) / 21: `supabase/functions/{inbound,parse}-email/` + 메일 인프라 | 19는 웹 중심이라 iOS-heavy 18과 file-disjoint. 21은 **메일 프로바이더 셋업 리드타임이 길어** 빨리 시작하면 좋음. |

> **둘 다 같은 phase를 하고 싶다면** plan 단위로 file ownership을 나누세요 (`/gsd-plan-phase`가 wave/파일 경계를 만들어 줌).

### 각 phase 시작하는 법
```
/gsd-discuss-phase 18      # 회색지대 결정 (레이아웃·API·에러처리)
/gsd-plan-phase 18         # plan 생성 + 검증
/gsd-execute-phase 18      # 실행 (atomic commit)
```
사소한 수정은 `/gsd-quick`. 진행 확인은 `/gsd-progress`, 이어서 할 땐 `/gsd-resume-work`.

각 phase의 요구사항 ID·성공기준은 `.planning/ROADMAP.md`의 해당 Phase Details 참고 (18=PLAN-01~05, 19=POLL-01~03, 20=BOOK-01~03+ATTR-02, 21=LEDGER-01~06, 22=AND-01~02).

---

## 4. 첫날 셋업 체크리스트

1. [ ] **레포 + 의존성** (pnpm 9.12, Node 20+)
   ```bash
   git clone https://github.com/SerendipityLife/MOAJOA.git
   cd MOAJOA && pnpm install
   ```
2. [ ] **읽기 (순서대로):** `CLAUDE.md` → `docs/PRODUCT.md` → `.planning/ROADMAP.md`(Phase 18~22) → 이 HANDOFF → `docs/WORKSTREAMS.md`(파일 경계)
3. [ ] **환경변수:** 각 디렉터리의 `.env.local.example` 복사 (`./`, `apps/web/`, `apps/ios/`, `supabase/`). **실제 키는 wcb한테 받기** (1Password/노션 — 슬랙 붙여넣기 X). CLAUDE.md §4.7.
4. [ ] **Supabase — ⚠️ 0016 적용이 핵심**
   ```bash
   pnpm supabase login
   pnpm supabase link --project-ref <wcb한테 받기>
   pnpm supabase:start          # 로컬 스택
   pnpm supabase:reset          # ⚠️ 0016 trips-native 베이스라인 적용 (필수)
   pnpm supabase:types          # packages/api/src/types/database.ts 재생성
   ```
5. [ ] **그린 확인**
   ```bash
   pnpm --filter @moajoa/core test    # vitest — Trip/booking/entry-route 계약 (50+ 통과)
   pnpm -r typecheck                  # 전 워크스페이스
   ```
6. [ ] **실행 (만질 영역만)**
   ```bash
   pnpm web:dev      # Next.js (web 작업 시)
   pnpm ios:sim      # iOS 로컬 시뮬 (expo run:ios는 Xcode26서 깨짐 → sim 스크립트 사용). 실기기는 EAS (wcb)
   ```
7. [ ] **첫 PR 룰:** Conventional Commits(`feat(19-01): ...`), 마이그레이션 변경 시 PR에 `BREAKING DB CHANGE`, `.env.local` 절대 commit 금지.

---

## 5. 공유·충돌 위험 영역 (변경 전 한 줄 알리기)

| 경로 | 영향 | 룰 |
|---|---|---|
| `packages/core/src/schemas/**`, `booking.ts`, `entry-route.ts`, `constants.ts` | Web·iOS·EF 전부 import | 변경은 **SQL 마이그레이션과 짝지어** PR. 추가는 OK, 기존 시그니처 변경은 caller 전부 확인 |
| `supabase/migrations/**` | **append-only 재개** — 새 번호는 **`0017_*`부터** | **`0016_trips_baseline.sql` 수정 절대 금지** (squash는 일회성이었음). 동시 PR이 같은 번호면 머지 순서대로 rename |
| `packages/api/src/queries/**` | trip 어휘 쿼리 레이어 | 새 helper 추가 OK, 시그니처 변경 시 caller 확인 |
| `packages/ui-tokens/**`, `.design-sync/**` | Web Tailwind + iOS NativeWind 시각 / claude.ai/design 동기화 입력(동료가 PR #1로 추가) | 양쪽 시각 확인 후 |
| `apps/ios/**` | iOS Native — 디바이스 검증은 wcb | iOS 작업은 wcb와 조율 |
| `.planning/ROADMAP.md`, `STATE.md` | 진행도 | GSD 워크플로우가 대부분 자동 갱신 |

---

## 6. 알려진 빚 / deferred (다음 phase에서 정리)

`.planning/phases/17-trip-foundation-ia/deferred-items.md`:
- **실패/대기 링크 화면(Phase 7)이 라우트·진입점 상실.** 클린 브레이크로 `app/boards/failed.tsx` 삭제됨. `lib/pending.ts` 상태 로직은 살아있으나 trip IA 아래 재배치할 UI가 없음 → 미래 plan에서 `/trip/[id]/...` 하위에 재배치.
- **`components/onboarding/coachmark.tsx` orphaned.** 글로벌 `(tabs)` 삭제로 importer 없음. 선재 컴포넌트라 보존(CLAUDE.md §3.3).
- **MR-01: `add_manual_place`가 lat/lng 없으면 `(0,0)` 기록** — 0001부터 내려온 선재 이슈. 별도 후속 태스크로 분리됨.

---

## 7. 막혔을 때

| 영역 | 어디로 |
|---|---|
| Supabase 키 / project-ref / 환경변수 | wcb (비밀 채널) |
| iOS 빌드·디바이스 | wcb 영역 |
| GSD 워크플로우 | `/gsd-help` 또는 https://github.com/open-gsd/get-shit-done-redux |
| 제품 의도·범위 | `docs/PRODUCT.md` (단일 출처) |
| 코딩 원칙 헷갈림 | `CLAUDE.md` §3 (Karpathy 4) |

---

**작성:** 2026-06-22, wcb (Phase 17 완료 직후)
**다음 갱신 트리거:** Phase 18/19/21 중 첫 완료 시점, 또는 작업 분할 합의 변경 시
