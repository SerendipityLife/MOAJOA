# Architecture Research — MOAJOA v2.0 (전면 개편)

**Domain:** AI 여행 플랫폼 (발견 → 결정 → 플랜 → 예약 → 정산 풀 루프) on Supabase + TS 모노레포
**Researched:** 2026-06-21
**Confidence:** HIGH (기존 코드 직접 검증) · MEDIUM (외부 통합 = Stay22/Travelpayouts 딥링크, inbound email webhook)
**Scope:** v2.0 신규 기능이 기존 아키텍처에 어떻게 통합되는가. 새 테이블/컬럼, RLS 패턴, Edge 함수, Expo Router 재편, 빌드 순서.

> 이 문서는 v2.0 기준으로 새로 작성됨. 이전 마일스톤의 본 파일(v1 MVP 통합 아키텍처)은 superseded. 디자인 토큰·개편 전 베이스라인은 `docs/ARCHITECTURE.md`가 단일 출처로 유지.

---

## 0. 핵심 통합 원칙 (먼저 읽을 것)

v2.0는 **새 백엔드가 아니라 기존 백엔드의 확장**이다. 다음 5개 규칙이 모든 신규 작업을 지배한다:

1. **`boards`가 곧 `trip`이다.** 신규 테이블은 새 루트 엔티티를 만들지 않고 **`board_id`로 기존 boards에 매단다.** "여행(trip)"은 UI 용어, DB는 `boards` 그대로. 마이그레이션 비용 0, RLS 헬퍼 재사용.
2. **모든 RLS 크로스테이블 체크는 기존 SECURITY DEFINER 헬퍼(`can_read_board`/`can_edit_board`/`can_vote_board`/`am_board_owner`) 경유.** 신규 테이블도 `board_id`만 있으면 이 헬퍼를 그대로 호출 → 무한재귀(42P17) 회피, 신규 헬퍼 최소화.
3. **마이그레이션은 append-only.** 0001–0015 절대 수정 금지. v2.0는 `0016`부터 새 번호로만. 컬럼 추가는 NULLABLE 또는 DEFAULT (non-locking).
4. **`packages/core` Zod 스키마 변경은 반드시 같은 PR의 SQL 마이그레이션과 짝지음.** 스키마 = web+iOS+Edge 3곳 동시 import이므로 DB enum/한도와 drift 나면 3곳 동시 깨짐. `0001_init.sql:15` 컨벤션(TEXT+CHECK ↔ core constants) 유지.
5. **클라이언트는 service role·외부 API 키를 절대 안 본다.** 인바운드 메일 파싱·플랜 생성·가격비교 프록시는 전부 Edge Function(Deno, service role) 안에서. 클라이언트는 anon 키로 RLS-gated 읽기만.

---

## 1. Standard Architecture

### System Overview (v2.0)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENTS (anon key + RLS)                       │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │ iOS (Expo)     │  │ Android (Expo) │  │ Web (Next.js 15 SSR)    │  │
│  │ 저장·플랜·예약 │  │ 대표/결제자    │  │ 비로그인 공유열람       │  │
│  │ ·가계부 (주력) │  │ 예약·가계부 1급│  │ + 예약/가계부 백업경로  │  │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬─────────────┘  │
└──────────┼───────────────────┼───────────────────────┼────────────────┘
           │  supabase-js (anon)│ + functions.invoke()   │ RPC(anon)
           ▼                    ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Postgres + RLS deny-by-default)            │
│  기존: boards memberships links places votes profiles extraction_costs │
│  신규(board_id 매달기):                                                │
│   date_polls · date_options · date_votes      ← ① 날짜 투표           │
│   itineraries · itinerary_days · itinerary_items  ← ③ 플랜             │
│   bookings (status·platform·deeplink·commission)  ← ④ 예약            │
│   ledger_entries (card·platform·currency·fx·paid_at·status) ← ⑤ 가계부 │
│   inbound_emails (raw·parsed·status)          ← ⑤ 받은메일 원본       │
│   boards.payer_id (대표/결제자)               ← 컬럼 추가             │
│   profiles.inbound_email_token (전용 전달주소) ← 컬럼 추가            │
│  RLS: 전부 can_read_board/can_edit_board 헬퍼 경유 (신규 헬퍼 최소)    │
│  Realtime: date_votes·itinerary_items·bookings 구독 (기존 votes 패턴) │
└───────┬──────────────────────────────────────────────────────────────┘
        │ service role (RLS bypass, 호출자 JWT 검증 후)
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 EDGE FUNCTIONS (Deno) — service role only               │
│  기존: extract-youtube · resolve-place                                  │
│  신규:                                                                  │
│   inbound-email      ← 메일 웹훅 수신 → inbound_emails 저장 → 파싱큐  │
│   parse-email        ← Claude로 예약메일 파싱 → ledger_entries upsert │
│   generate-plan      ← 추출완료 트리거 → itinerary 자동 설계          │
│   booking-redirect   ← 가격비교/딥링크 빌드 + 클릭 어트리뷰션 기록    │
└───────┬───────────────────────────────┬──────────────────────────────┘
        │ Anthropic (claude-sonnet)      │ 외부 통합
        ▼                                ▼
   추출AI 재활용(파싱·플랜)    Stay22 / Travelpayouts (딥링크) · 메일 webhook provider
```

### Component Responsibilities

| Component | 책임 (v2.0 추가분) | 구현 |
|-----------|---------------------|------|
| `boards` (= trip) | 여행 컨테이너. 날짜·도시·**대표(payer_id)**·visibility. 모든 신규 엔티티의 루트 | 기존 테이블 + 컬럼 추가 (0016) |
| `date_polls/options/votes` | "미정→일행과 날짜 투표". 초대링크는 기존 share_slug + join_shared_board 재사용 | 신규 테이블, votes RLS 패턴 복제 |
| `itineraries/days/items` | 확정 장소 + 필수장소 → 동선·일정. AI 생성 + 수동 편집 | 신규 테이블, places 참조 |
| `bookings` | 예약 의도·상태·플랫폼·딥링크·수수료 어트리뷰션. plan 인라인 + 통합 체크리스트 둘 다 읽음 | 신규 테이블 |
| `ledger_entries` | 가계부 한 줄. 카드·플랫폼·통화·환율·결제일·상태. 우리 경유 안 한 예약도 포착 | 신규 테이블 |
| `inbound_emails` | 받은 메일 원본 + 파싱 상태. 1:N → ledger_entries (한 메일이 여러 항목) | 신규 테이블 (links 추출 패턴 미러) |
| `inbound-email` EF | 메일 provider 웹훅 수신 → 토큰으로 user 매칭 → inbound_emails insert → parse-email 큐잉 | 신규 EF (verify_jwt=false, 서명검증) |
| `parse-email` EF | inbound_emails 1건 → Claude 파싱 → ledger_entries upsert. **extract AI 파이프라인 재활용** | 신규 EF (extract-youtube claude.ts 패턴) |
| `generate-plan` EF | 추출 ready 직후 트리거 → 확정/필수 장소 → itinerary 설계 | 신규 EF |
| `booking-redirect` EF | 장소/날짜 → Stay22·Travelpayouts 딥링크 빌드 + marker. 클릭 기록 → bookings | 신규 EF (가벼움, LLM 없음) |
| Expo Router | 전역탭 → `trip/[id]/(tabs)/{map,plan,book,ledger}`로 재편. 1개면 바로 진입 | 라우팅 트리 재구성 |

---

## 2. 새 테이블 / 컬럼 스케치

> 모두 `0016+` append-only. `board_id` 매달기 → 기존 헬퍼 RLS 재사용. enum류는 TEXT+CHECK ↔ `packages/core/constants.ts` 짝지음 (마이그레이션과 동일 PR).

### 2.0 기존 테이블 컬럼 추가 (0016)

```sql
-- boards: 대표(결제자) 식별 + trip dates는 이미 존재(0007 start_date/end_date)
alter table boards add column payer_id uuid references profiles(id) on delete set null;
--   NULLABLE. null = 미지정/단독여행 owner가 곧 대표. 멤버 중 1인 지정.
--   RLS: 기존 boards owner 정책으로 set. 읽기는 can_read_board 경유 신규 테이블이 참조만.

alter table boards add column last_active_at timestamptz;  -- "마지막 여행" 진입용(또는 updated_at 재사용)

-- profiles: 가계부 전용 전달주소 토큰 (TripIt/Expensify 패턴) + 마지막 활성 여행
alter table profiles add column inbound_email_token text unique;
--   NULLABLE → 최초 가계부 진입 시 발급. 전달주소 = {token}@inbound.moajoa.app.
--   token 자체가 비밀(추측불가) → 토큰만으로 user 식별 (메일엔 인증 없음).
alter table profiles add column last_active_board_id uuid references boards(id) on delete set null;
--   "여러 개 → 마지막 여행" 진입 리다이렉트용. 크로스기기 일관(iOS↔Android 대표 시나리오).
```

### 2.1 ① 날짜 투표 (date_polls / date_options / date_votes)

기존 `votes` 테이블을 그대로 쓰지 않는 이유: votes는 `place_id`에 매달려 있음(love kind). 날짜 투표는 별도 대상(날짜 후보)이라 새 테이블이 맞다. **단, RLS·집계 패턴은 votes를 그대로 복제** (drift 방지).

```sql
create table date_polls (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed')),
  closed_option_id uuid,                 -- 확정된 날짜 (FK는 순환이라 앱레벨 보장)
  created_at timestamptz not null default now()
);
create table date_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references date_polls(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,  -- RLS 단축용 비정규화
  start_date date not null,
  end_date date,                         -- null = 당일치기
  created_at timestamptz not null default now()
);
create table date_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references date_options(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,  -- RLS 단축용 비정규화
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)            -- 1인 1옵션당 1표 (멀티옵션 가능)
);
```

**비정규화 결정:** `date_options`/`date_votes`에 `board_id`를 중복 저장 → RLS에서 `poll_id` 조인 없이 바로 `can_read_board(board_id)` 호출. votes 테이블이 `place_id→places.board_id`로 한 단계 조인하는 것보다 단순. (조인 한 단계는 SECURITY DEFINER 안이라 안전하지만, board_id 직접 보유가 정책 가독성↑.)

**RLS (votes 패턴 복제):**
```sql
-- date_votes
create policy "date_votes: read if can read board"  on date_votes for select
  to authenticated using (can_read_board(board_id));
create policy "date_votes: insert if can vote"      on date_votes for insert
  to authenticated with check (user_id = auth.uid() and can_vote_board(board_id));
create policy "date_votes: delete own"              on date_votes for delete
  to authenticated using (user_id = auth.uid());
-- date_polls/options: read=can_read_board, write=can_edit_board (places 패턴)
```
**집계 RPC:** `date_vote_counts(p_poll_id uuid)` — SECURITY DEFINER, anon+authenticated grant (vote_counts_for_places 패턴). 확정 임계는 `packages/core`에 `isDateConfirmed()` (isPlaceConfirmed 미러).
**초대 링크:** 새로 만들지 않음 — 기존 `share_slug` + `join_shared_board(slug)`(0009)가 voter로 self-join시킴. 날짜 투표 = shared 보드의 한 화면.

### 2.2 ③ 여행 플랜 (itineraries / itinerary_days / itinerary_items)

```sql
create table itineraries (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  source text not null default 'ai' check (source in ('ai','manual')),  -- 추출직후 AI / 수동
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table itinerary_days (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,  -- RLS 단축
  day_index int not null check (day_index >= 0),  -- 0=Day1
  date date,                                       -- 확정 날짜 매핑 (date_polls 확정 후)
  unique (itinerary_id, day_index)
);
create table itinerary_items (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references itinerary_days(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,  -- RLS 단축
  place_id uuid references places(id) on delete set null,  -- 확정장소 참조 (null=커스텀 메모)
  order_index int not null,
  kind text not null default 'place' check (kind in ('place','meal','transport','lodging','note')),
  title text,                                       -- place_id 없을 때 자유 텍스트
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
```
**RLS:** read=`can_read_board(board_id)`, write=`can_edit_board(board_id)` (places 패턴 그대로).
**Realtime:** `itinerary_items`를 구독 → 협업 편집 라이브 반영 (votes Realtime 패턴).
**핵심 흐름:** 추출 `ready` → `generate-plan` EF가 places(confidence·vibe·confirmed) → itinerary draft 생성. 투표는 **같은 itinerary 위에 얹는 옵션**(PRODUCT §7): date_polls·votes가 확정한 장소/날짜를 itinerary가 참조.

### 2.3 ④ 예약 (bookings)

```sql
create table bookings (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  item_id uuid references itinerary_items(id) on delete set null,  -- 플랜 인라인 매핑(옵션)
  created_by uuid not null references profiles(id) on delete restrict,
  category text not null check (category in ('lodging','activity','transport','esim')),
  platform text not null,                  -- 'stay22','travelpayouts','booking','klook','direct',...
  status text not null default 'intent'
    check (status in ('intent','clicked','reserved','cancelled')),
  deeplink_url text,                       -- booking-redirect EF가 빌드한 제휴 딥링크
  click_marker text,                       -- 어트리뷰션 마커 (우리 클릭 id)
  external_ref text,                       -- 예약번호 (가계부 매칭 후 채워짐)
  amount numeric(12,2),                    -- 예상/확정 금액
  currency text check (char_length(currency) = 3),
  commission_est numeric(12,2),            -- 수수료 추정 (BM 추적)
  ledger_entry_id uuid,                    -- 정산 후 가계부 항목과 연결 (FK는 앱레벨)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
**핵심:** `platform`은 enum 아닌 free TEXT — 제휴처가 늘어남(append-only 마이그레이션 매번은 과함). `packages/core`에 `BookingPlatform` 상수 배열로 관리(클라 검증), DB는 NOT NULL만.
**어트리뷰션:** Stay22/Travelpayouts는 **딥링크 + marker 쿼리파라미터** 방식이 MVP(인벤토리 API 불필요, 선투자 0 — PRODUCT §8). `booking-redirect` EF가 marker 붙은 URL 빌드 + `status='clicked'` 기록. 실제 예약 확정은 ⑤ 가계부 메일 파싱이 `reserved`로 승격.
**RLS:** read=`can_read_board`, insert/update=`can_edit_board`. 대표(payer)만 "통합 예약 체크리스트"에서 일괄 처리(앱 레벨에서 payer_id 비교, RLS는 editor 허용).

### 2.4 ⑤ 가계부 (inbound_emails → ledger_entries)

`links → extraction_status → places`의 추출 파이프라인과 **구조적으로 동일**: 원본 행 + 상태 + 파싱 결과 1:N. 코드·패턴 최대 재활용.

```sql
create table inbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,  -- 토큰으로 매칭된 소유자
  board_id uuid references boards(id) on delete set null,           -- 추론된 여행(있으면)
  from_addr text,
  subject text,
  raw_storage_path text,                   -- 원본 eml = Storage 버킷(테이블엔 경로만)
  parse_status text not null default 'pending'
    check (parse_status in ('pending','processing','parsed','failed','ignored')),
  parse_error text,
  received_at timestamptz not null default now()
);
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards(id) on delete set null,  -- 여행 미배정 가능(나중 분류)
  user_id uuid not null references profiles(id) on delete cascade,
  inbound_email_id uuid references inbound_emails(id) on delete set null,  -- 출처(수동입력=null)
  booking_id uuid references bookings(id) on delete set null,              -- 우리경유 예약과 연결
  source text not null default 'email' check (source in ('email','manual')),
  category text check (category in ('lodging','activity','transport','esim','food','shopping','other')),
  merchant text,
  platform text,                           -- 결제 플랫폼
  card_label text,                         -- 카드 별칭 (마지막4자리 등, 민감정보 최소)
  amount numeric(12,2) not null,
  currency text not null check (char_length(currency) = 3),  -- ₩/$ 등
  amount_krw numeric(12,2),                -- 환산액 (fx_rate 적용)
  fx_rate numeric(12,6),                   -- 결제시점 환율
  paid_at timestamptz,                     -- 결제 시점
  status text not null default 'confirmed'
    check (status in ('pending','confirmed','refunded')),
  created_at timestamptz not null default now()
);
```
**비밀주소 보안:** `inbound_email_token`만으로 user 식별 → 토큰은 추측불가(gen 시 high-entropy, ensure_share_slug 패턴 재사용). 메일은 인증이 없으므로 토큰이 곧 capability. 노출 시 재발급 가능하게.
**RLS:** inbound_emails·ledger_entries는 **board가 아니라 user 소유** (개인 가계부 — PRODUCT §7 "가계부는 개인"). `using (user_id = auth.uid())` 직접 비교 (헬퍼 불필요 — 크로스테이블 아님). board_id가 채워져도 보드 멤버 공유 열람은 v2.0 범위 밖(개인 우선).
**원본 저장:** raw eml은 Supabase Storage 버킷(private, RLS), 테이블엔 경로만 → row 비대화 방지.

---

## 3. Edge Functions (신규)

기존 2개(`extract-youtube`, `resolve-place`)의 확립된 패턴을 그대로 따른다:
- service role 클라이언트 + **호출자 JWT 검증**(`admin.auth.getUser(token)` — anon/service 키 거부, extract-youtube:71–79).
- Zod로 request 검증, CORS 헬퍼, `extraction_costs` 패턴으로 비용 로깅.
- 긴 작업은 상태컬럼(`*_status`) + Realtime broadcast로 진행률 (broadcastStep 패턴).

| EF | verify_jwt | 트리거 | 패턴 출처 | 비고 |
|----|-----------|--------|-----------|------|
| `inbound-email` | **false** (외부 webhook) | 메일 provider POST | 신규 | 서명 검증(provider HMAC)으로 인증 대체. 토큰→user 매칭. inbound_emails insert 후 parse-email 큐잉(또는 직접 호출). SSRF 없음(수신만) |
| `parse-email` | true (내부 호출) | inbound-email이 invoke / 또는 큐 | `extract-youtube/pipeline/claude.ts` 재활용 | eml 본문 → Claude → {merchant,amount,currency,fx,card,paid_at} JSON → ledger_entries upsert. 비용 로깅 동일 |
| `generate-plan` | true | 추출 `ready` 직후(클라 invoke) 또는 DB 트리거→pg_net | 신규 (extract 흐름 미러) | confirmed/필수 places → itinerary draft. 멱등(이미 draft 있으면 no-op) |
| `booking-redirect` | true | 클라 "예약하기" 탭 | 신규 (가벼움, LLM 없음) | place+date → Stay22/Travelpayouts marker URL 빌드 + bookings status='clicked'. 키는 EF env |

**메일 webhook provider 결정 (MEDIUM):** SendGrid Inbound Parse / Mailgun Routes / Postmark Inbound 모두 "MX → provider → JSON webhook POST" 패턴 동일. MOAJOA 권장: **하나의 catch-all 서브도메인(`inbound.moajoa.app`) MX를 provider로** → 모든 `{token}@inbound.moajoa.app`가 한 webhook으로. 토큰은 local-part로 받아 user 매칭. provider 선택은 STACK.md 영역(파싱 정확도·가격). webhook은 fire-and-fast: 즉시 inbound_emails 저장 후 200 반환, 파싱은 비동기(extract-youtube의 claim→process 패턴).

**플랜 자동생성 트리거 위치 (결정 필요 / 회색지대):**
- 옵션 A — extract-youtube 끝에서 `ready` 마크 직후 generate-plan을 fire-and-forget invoke (revalidate webhook 패턴, index.ts:427).
- 옵션 B — 클라이언트가 Realtime로 `ready` 감지 후 invoke.
- 권장 **A**: PRODUCT §7 "추출 직후 = 즉시 AI 플랜, 이탈 차단". 서버에서 트리거하면 클라 왕복·이탈 없음. → `discuss-phase`에서 잠글 것.

---

## 4. Expo Router 재편 (전역탭 → trip 컨텍스트탭)

### 현재 (v1)
```
app/
  index.tsx              세션有→/(tabs)/boards, 無→/welcome
  (tabs)/_layout.tsx     전역탭: boards·discover·[FAB new]·friends·me
  boards/[id].tsx        보드 상세 (단일 화면, 탭 아님)
```
### 목표 (v2.0) — PRODUCT §6
```
app/
  index.tsx              ← 진입 로직 재작성 (아래)
  welcome.tsx            (유지)
  trip/
    [id]/
      _layout.tsx        ← Stack (헤더: 좌상단 "현재 여행 ▾" 전환 / 우상단 프로필)
      (tabs)/
        _layout.tsx      ← Tabs: 지도·플랜·예약·가계부 (탭바 항상 유지, FAB 없음)
        map.tsx          (기존 boards/[id] 지도 → 이동)
        plan.tsx         ← 신규 (itinerary)
        book.tsx         ← 신규 (bookings: 인라인+체크리스트)
        ledger.tsx       ← 신규 (ledger_entries)
  trips/                 ← "여러 개" 목록 (헤더 전환 시트 또는 별도 화면)
  new-trip.tsx           ← 새 여행 = 컨텍스트 액션 (온보딩·종료후·헤더＋·공유시트)
```

**진입 리다이렉트 로직 (index.tsx 재작성):** PRODUCT §6
```
세션 없음            → /welcome
여행 0개(첫 로그인)  → 온보딩 → new-trip (기존 0006 자동보드 트리거가 이미 1개 생성하므로
                       실질적으로 "여행 1개" 경로로 합류 가능)
여행 1개             → /trip/<id>/(tabs)/plan         (목록 스킵, 바로 진입)
여행 여러 개         → /trip/<lastActiveId>/(tabs)/plan (마지막 여행)
```
- **"1개면 바로 진입"** = index에서 boards count 쿼리 → 1이면 그 id로 즉시 Redirect, 2+면 `profiles.last_active_board_id`(또는 updated_at desc 첫행)로 Redirect. 목록 화면은 헤더 "현재 여행 ▾" 시트로만 노출.
- **default tab = plan** (지도 아님): PRODUCT §7 "추출직후=즉시 플랜"이 핵심 아하 순간.
- **마지막 여행 추적:** `profiles.last_active_board_id`(0016) — 크로스기기 일관(iOS↔Android 대표 시나리오). 클라 AsyncStorage 대안보다 우위.
- **FAB 제거:** 현재 `(tabs)/new.tsx`의 가운데 ＋ FAB(`(tabs)/_layout.tsx:8 NewBoardFab`) 삭제. 새 여행은 헤더 ＋ + 공유시트 진입.
- **공유시트(share-handler) 영향:** URL 받기 → 보드 선택 흐름이 "여행 선택 or 새 여행"으로. 기존 `app/share-handler.tsx`·`+native-intent.tsx`·`drainPendingLinks`(`_layout.tsx:12`)는 그대로 — 도착지만 trip 라우트로.

**Android:** Expo라 재작성 아님(PRODUCT §12). 같은 `app/` 트리. EAS Android 빌드 프로파일 추가 + Maps/딥링크 키 Android 분리(기존 iOS bundle restriction 패턴 미러, docs/ARCHITECTURE.md security model). 플랫폼 분기 최소 — 예약·가계부가 Android 1급.

---

## 5. 데이터 흐름 변화

### 5.1 추출 → 즉시 플랜 (신규 핵심 루프)
```
[iOS] 공유시트 → trip 선택 → links insert (기존)
   ↓
[extract-youtube EF] ... places upsert → links status='ready' (기존)
   ↓  ★신규: ready 직후 fire-and-forget
[generate-plan EF] places(confirmed/필수) → itineraries+days+items draft
   ↓
[client] Realtime(itinerary_items) → 플랜 탭에 즉시 렌더 ("아하")
   ↓ (옵션)
[date_polls/votes] 친구와 날짜·장소 투표 → 같은 itinerary 위에 확정 반영
```
### 5.2 예약 (딥링크 어트리뷰션)
```
[client] 플랜 인라인 카드 or 예약 체크리스트 "예약" 탭
   ↓
[booking-redirect EF] Stay22/Travelpayouts marker URL 빌드 + bookings(status='clicked')
   ↓
[client] in-app browser로 제휴처 오픈 → 사용자가 외부서 예약 완료
   ↓ (수수료는 provider가 marker로 추적; 우리 DB는 intent/clicked까지)
```
### 5.3 정산 (마찰 0 메일 파싱)
```
사용자 예약 메일을 {token}@inbound.moajoa.app로 전달 (한 번)
   ↓
[메일 provider] MX → webhook POST
   ↓
[inbound-email EF] 토큰→user 매칭 → inbound_emails insert(pending) → 200
   ↓
[parse-email EF] Claude 파싱 → ledger_entries(카드·통화·환율·결제시점) upsert
   ↓  ★ external_ref 매칭되면 연결된 bookings.status='reserved' 승격
[client] Realtime(ledger_entries) → 가계부 탭 갱신. 우리 경유 안 한 예약도 포착
```

---

## 6. 제안 빌드 순서 (의존성 반영)

> 원칙: **공유 기반(스키마+라우팅) 먼저 → 독립 기능 병렬 → 수익·정산은 라우팅 셸 위에.** 각 단계의 core Zod 변경은 같은 마이그레이션과 짝지음.

```
Phase A — 기반: 스키마 + 라우팅 셸 (모든 후속의 전제)
  • 0016 마이그레이션: boards.payer_id/last_active_at, profiles.inbound_email_token/
    last_active_board_id + 신규 테이블 전체 골격 + RLS(헬퍼 재사용)
  • packages/core 스키마 신규(date/itinerary/booking/ledger/inbound_email) + constants (DB와 동일 PR)
  • packages/api 타입 재생성(supabase:types) + 신규 queries
  • Expo Router 재편: trip/[id]/(tabs) 셸 + index 진입 리다이렉트 + 헤더 전환
  → verify: 빈 4탭이 1개여행 바로진입으로 뜬다, RLS deny-by-default 통과
  의존: 없음 (반드시 첫 번째)

Phase B — 플랜 (③) : 추출 루프와 직접 연결, 즉시 아하
  • generate-plan EF + plan.tsx + itinerary 편집(Realtime)
  • 추출 ready → 자동 플랜 트리거 (extract-youtube 끝 fire-and-forget)
  → verify: 링크 추가 → 30초 내 플랜 탭에 일정이 뜬다
  의존: Phase A. (extract-youtube 기존 동작 전제)

Phase C — 날짜 투표 (①) : 협업, 플랜과 독립이라 B와 병렬 가능
  • date_polls/options/votes RPC + 투표 UI + share_slug 초대(재사용)
  → verify: 미정→옵션 생성→멤버 투표→확정→itinerary 날짜 반영
  의존: Phase A. (B와 무관 — 병렬)

Phase D — 예약 딥링크 (④) : 수익 Day1, 플랜 셸 위에
  • booking-redirect EF + book.tsx (인라인 + 체크리스트) + bookings
  • Stay22/Travelpayouts marker 통합
  → verify: 장소→예약탭→marker 딥링크 오픈→bookings 'clicked' 기록
  의존: Phase A(셸) + Phase B(플랜 인라인 카드 위치). C와 병렬 가능

Phase E — 가계부 (⑤) : 외부 메일 인프라 필요, 가장 독립적이라 마지막/병렬
  • inbound-email EF(webhook) + parse-email EF(Claude 재활용) + ledger.tsx
  • 메일 provider MX 셋업 + 토큰 발급 + Storage 버킷(원본 eml)
  • bookings.external_ref 매칭 → reserved 승격
  → verify: 전달주소로 예약메일 → 가계부에 환율·결제시점까지 자동 정리
  의존: Phase A. provider 셋업이 외부라 리드타임 김 → A 직후 인프라 착수 권장

Phase F — Android : 위 전부 후. EAS Android 프로파일 + 키 분리 + 플랫폼 QA
  의존: A–E (특히 D 예약·E 가계부가 Android 1급)
```

**병렬화:** A 완료 후 B·C·D·E 워크스트림 분리 가능(파일 경계 거의 안 겹침 — WORKSTREAMS 철학). E의 외부 provider 셋업만 리드타임 길어 A 직후 착수.

---

## 7. Architectural Patterns (재사용 + 신규)

### Pattern 1: board_id 매달기 (Anchor-to-board)
**What:** 신규 엔티티는 새 루트 대신 `board_id` FK + (필요시 비정규화). RLS는 `can_read/edit_board(board_id)` 헬퍼 1콜.
**When:** 여행에 속한 모든 것(플랜·예약·날짜투표). 단, **개인 가계부는 예외**(user 소유 — `user_id = auth.uid()` 직접).
**Trade-off:** board 삭제 시 cascade 일괄(장점) / 보드 무관 개인데이터엔 부적합(→ user 매달기).

### Pattern 2: 추출-파이프라인 재활용 (status-column + claim + async)
**What:** `inbound_emails.parse_status`(pending→processing→parsed) = `links.extraction_status` 복제. 원자적 claim(extract-youtube:119) + Claude 호출(claude.ts) + 비용로깅(extraction_costs).
**When:** parse-email. LLM 파싱은 추출과 같은 형태(컨텍스트→JSON 후보→upsert).
**Trade-off:** 코드 재활용 최대 / inbound_emails 폴링 대신 webhook→invoke 직접 호출이라 큐는 경량.

### Pattern 3: 외부 webhook = verify_jwt false + 서명 검증
**What:** inbound-email만 `verify_jwt=false`(외부 메일 provider). JWT 대신 provider HMAC 서명 검증 + 토큰→user.
**When:** 외부에서 들어오는 EF. (다른 EF는 전부 getUser() JWT 검증 유지.)
**Trade-off:** 외부 수신 가능 / 서명 검증 누락 시 위조 메일 주입 → 반드시 검증 + 토큰 capability.

### Pattern 4: Realtime 구독 확장
**What:** 기존 votes/places Realtime를 itinerary_items·date_votes·bookings·ledger_entries로 확장 (협업 라이브).
**When:** 멀티유저 공동편집(플랜·투표), 비동기 결과 도착(가계부).
**Trade-off:** 즉시성 / 구독 채널 수 관리(board별 채널 권장).

---

## 8. Anti-Patterns (이 프로젝트 특정)

### AP1: 신규 RLS에서 다른 테이블 직접 EXISTS
**하는 실수:** date_votes 정책에서 `exists(select 1 from date_polls ... join boards ...)`.
**왜 나쁨:** 42P17 무한재귀 위험 + 정책 가독성↓ (0002에서 이미 학습).
**대신:** board_id 비정규화 + `can_read_board(board_id)` 헬퍼. 신규 헬퍼는 정말 새 권한일 때만(join_shared_board 0009처럼).

### AP2: 새 "trip" 테이블 신설
**하는 실수:** boards와 별개로 trips 테이블 만들고 마이그레이션.
**왜 나쁨:** boards RLS·헬퍼·share_slug·onboarding 트리거 전부 재구현. drift.
**대신:** boards = trip. 컬럼만 추가.

### AP3: 가격비교 인벤토리 API를 MVP에 빌드
**하는 실수:** Stay22/Travelpayouts 실시간 재고·가격 API 통합부터.
**왜 나쁨:** 선투자·승인·트래픽 요건. PRODUCT §11 = "딥링크로 MVP 시작, API는 트래픽 후".
**대신:** booking-redirect로 marker 딥링크만. 가격비교는 정적/딥링크 노출 수준.

### AP4: 클라이언트가 환율·파싱을 직접
**하는 실수:** 앱에서 메일 파싱하거나 fx_rate 계산.
**왜 나쁨:** 키 노출·일관성·신뢰경계 위반.
**대신:** parse-email EF(service role)에서 Claude 파싱 + 환율. 클라는 RLS 읽기만.

### AP5: core 스키마만 바꾸고 마이그레이션 미동반
**하는 실수:** packages/core에 필드 추가, SQL은 나중에.
**왜 나쁨:** web/iOS/Edge가 DB에 없는 컬럼 기대 → 런타임 깨짐. CLAUDE.md 4.2 위반.
**대신:** 스키마+마이그레이션 동일 PR. 변경 후 `pnpm supabase:types`.

---

## 9. Integration Points

### External Services
| Service | Integration Pattern | Notes / 신뢰도 |
|---------|---------------------|-------|
| Stay22 | 딥링크 + 스크립트/marker 자동변환. 숙소·맵 중심 | MEDIUM. 인벤토리 API 불필요(MVP). marker로 어트리뷰션 |
| Travelpayouts | partner-links API로 직접URL→제휴URL 변환. 항공·eSIM·보험 | MEDIUM. 두 곳 병행이 업계 표준(eSIM/보험=TP, 숙소=Stay22) |
| 메일 provider (SendGrid/Mailgun/Postmark) | MX→inbound parse→webhook JSON POST | MEDIUM. catch-all 서브도메인 1개. provider 선택은 STACK |
| Anthropic (claude-sonnet) | parse-email·generate-plan에서 재활용 (기존 extract 키) | HIGH. extract-youtube 패턴 그대로 |
| Google Places | 기존 resolve-place 재활용 (플랜 동선에 좌표 필요시) | HIGH. 기존 |

### Internal Boundaries
| Boundary | Communication | Notes |
|----------|---------------|-------|
| extract-youtube ↔ generate-plan | fire-and-forget invoke (ready 직후) | revalidate webhook 패턴 미러. 실패해도 추출은 성공 |
| inbound-email ↔ parse-email | invoke 또는 경량 큐 | webhook은 즉시 200, 파싱 비동기(claim 패턴) |
| bookings ↔ ledger_entries | external_ref/booking_id 매칭 (앱/EF레벨) | DB FK 순환 회피 위해 앱레벨 보장 |
| date_polls 확정 ↔ itinerary_days.date | 확정 옵션 → 날짜 매핑 (RPC 또는 클라) | 투표는 플랜 위에 얹힘 |
| packages/core ↔ DB(migrations) | 동일 PR 짝지음 | enum=TEXT+CHECK ↔ constants |

---

## 10. Scaling Considerations

| Scale | 조정 |
|-------|------|
| 0–1k (도그푸딩~초기) | 현 구조 충분. EF 동기 처리 OK. 메일 파싱 webhook→invoke 직접 |
| 1k–100k | parse-email/generate-plan을 pgmq/큐로 분리(LLM 비용 burst 흡수). inbound_emails 인덱스(user_id, parse_status). ledger 월별 파티션 검토 |
| 100k+ | Realtime 채널 board별 샤딩. EF 비용 모니터링(extraction_costs 확장). 딥링크 인벤토리 API 승격 |

**첫 병목:** LLM 파싱 비용·지연(parse-email + generate-plan). 추출과 합산되므로 extraction_costs에 provider 추가해 추적. 예산은 기존 추출당 <$0.005 기준 확장.

---

## Sources

- 코드베이스 직접 검증 (HIGH): `supabase/migrations/0001–0015`, `extract-youtube/index.ts`, `packages/core/src/schemas/*` · `constants.ts`, `apps/ios/app/(tabs)/_layout.tsx` · `index.tsx` · `_layout.tsx`
- 제품 단일출처 (HIGH): `docs/PRODUCT.md`, `.planning/PROJECT.md`, `docs/ARCHITECTURE.md`
- [Travelpayouts — API for partner links](https://support.travelpayouts.com/hc/en-us/articles/25289759198226-API-for-Travelpayouts-partner-links) (MEDIUM)
- [Stay22 vs Travelpayouts](https://blog.stay22.com/are-you-using-the-right-travel-affiliate-program) — 두 곳 병행이 표준 (MEDIUM)
- [SendGrid Inbound Parse Webhook](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/setting-up-the-inbound-parse-webhook) (MEDIUM)
- [Inbound Email Webhooks 비교 2026](https://www.pingram.io/blog/inbound-email-notification-webhooks-how-to-process-incoming-emails-api-2026) (LOW — 종합 비교)

---
*Architecture research for: MOAJOA v2.0 풀 라이프사이클 (발견→예약→정산)*
*Researched: 2026-06-21*
