# Phase 23: Web-First Foundation - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 15개 신규/수정 파일
**Analogs found:** 13 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0024_place_seq.sql` | migration (트리거+backfill) | CRUD (직렬화된 INSERT) | `0016_trips_baseline.sql` DEFINER 함수 idiom + `0023` 패치 헤더 스타일 | exact |
| `supabase/migrations/0025_web_share.sql` (테이블+RPC) | migration | CRUD + request-response (RPC) | `0018_date_polls.sql` (date_comments) + `0016` (join_shared_trip) | exact |
| `supabase/config.toml` | config | — | 같은 파일 내 `[auth.external.apple/google]` 블록 | exact |
| `packages/core/src/constants.ts` | config (도메인 상수) | — | 같은 파일 내 `planChannelName`/`pollChannelName` + `LedgerStatus` enum 쌍 | exact |
| `packages/core/src/schemas/trip.ts` (TripCreateDraft) | model (Zod) | transform (validate) | 같은 파일 내 `TripCreateSchema` | exact |
| `packages/core/src/schemas/place.ts` (seq_no 추가) | model (Zod) | transform | 같은 파일 내 `confidence` 필드 주석 스타일 | exact |
| `packages/core/src/schemas/chat.ts` (신규) | model (Zod) | transform | `schemas/ledger.ts` (신규 계약 파일 house style) + 0018 `date_comments` shape | role-match |
| `packages/core/src/schemas/index.ts` | config (barrel) | — | 같은 파일 (한 줄 추가) | exact |
| `packages/core/src/schemas/chat.test.ts` (+trip draft·ShareMode 테스트) | test | — | `schemas/ledger.test.ts` | exact |
| `packages/api/src/queries/memberships.ts` (joinMoa) | service (typed query) | request-response (RPC) | 같은 파일 내 `joinSharedTrip` | exact |
| `packages/api/src/queries/trips.ts` (shareMoa) | service (typed query) | CRUD (UPDATE→트리거) | 같은 파일 내 `shareTrip` | exact |
| `packages/api/src/types/database.ts` | config (생성물) | — | — (`pnpm supabase:types` 재생성, 손편집 금지) | n/a |
| `CLAUDE.md` (§5 D26 반전) | config (문서) | — | 같은 파일 §5 불릿 형식 | exact |
| `supabase/.env.local.example` (KAKAO placeholder) | config | — | 같은 파일 기존 key 형식 | exact |
| SQL 동시성 하네스 + curl smoke 스크립트 (Wave 0) | test (bash) | batch | 없음 (RESEARCH Code Example 2~4가 대체 레퍼런스) | no-analog |

## Pattern Assignments

### `supabase/migrations/0024_place_seq.sql` (migration, 직렬화 INSERT 트리거)

**Analog 1:** `supabase/migrations/0023_ledger_update_check.sql` — **append-only 패치 마이그레이션 헤더 스타일**

패치 마이그레이션 헤더 패턴 (0023 L1~22): 파일명 주석 + Phase/REQ 참조 + **Why 단락** + 42P17/§4.4 준수 명시 + `-- Append-only: 0016..NNNN are NEVER modified.` 마무리. 0024도 동일 형식으로 시작할 것.

```sql
-- 0023_ledger_update_check.sql — Phase 21 Travel Ledger, code-review finding CR-01
-- (LEDGER-04/06). Tightens the ledger_entries UPDATE RLS WITH CHECK so an owner
-- ...
-- Append-only: 0016..0022 are NEVER modified.
```

**Analog 2:** `supabase/migrations/0016_trips_baseline.sql` — **DEFINER 트리거 함수 idiom**

DEFINER + search_path 핀 함수 shape (0016 L78~98, `handle_new_auth_user`):

```sql
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  ...
  return new;
end;
$$;
```

→ `assign_place_seq()`는 이 shape 그대로 + 본문만 advisory lock + 카운터 UPDATE (RESEARCH Code Example 1이 완성 SQL). **security definer 필수 이유:** places INSERT 정책은 editor 허용(0016 L477~480)이지만 trips UPDATE 정책은 owner 전용(0016 L187~191) — invoker면 editor insert 시 트리거 실패 (RESEARCH Pitfall 2).

BEFORE INSERT 트리거 부착 패턴 (0016 L466~468):

```sql
create trigger places_added_by_default
  before insert on places
  for each row execute function places_default_added_by();
```

**주의 — places hard DELETE 정책이 실존** (0016 L488~494): `added_by = auth.uid() or am_trip_owner(trip_id)`. 이것이 max+1 금지·카운터 방식 채택의 직접 근거 (RESEARCH Pitfall 1). backfill 순서는 Pitfall 3의 ①nullable 추가→②row_number backfill(tiebreak=id)→③set not null→④`unique (trip_id, seq_no)`→⑤last_place_seq 동기화.

기존 places unique 제약 참고 (0016 L451): `unique (trip_id, google_place_id)` — 신규 unique 인덱스 네이밍은 `places_trip_seq_key` (RESEARCH Code Example 1).

---

### `supabase/migrations/0025_web_share.sql` (migration, 테이블+컬럼+RPC)

**Analog 1:** `0016` `join_shared_trip` (L631~665) — **join_moa의 원본 (미러 후 role 분기만 추가)**

```sql
-- Bearer-invite self-join (0009 + 0012 owner self-join guard, trip-renamed).
-- DEFINER write — grants a NEW right. role hard-coded 'voter' (no escalation),
-- user_id = auth.uid() (join as self only), on conflict do nothing (idempotent).
create or replace function join_shared_trip(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_owner_id uuid;
begin
  select id, owner_id into v_trip_id, v_owner_id
  from trips
  where share_slug = p_share_slug
    and visibility in ('shared','public')
  limit 1;

  if v_trip_id is null then
    raise exception 'trip not found or not shared';
  end if;

  if v_owner_id = auth.uid() then
    return v_trip_id;
  end if;

  insert into memberships (trip_id, user_id, role, accepted_at)
  values (v_trip_id, auth.uid(), 'voter', now())
  on conflict (trip_id, user_id) do nothing;

  return v_trip_id;
end;
$$;

grant execute on function join_shared_trip(text) to authenticated;
```

→ `join_moa`: 위 본문에서 `select id, owner_id` → `select id, owner_id, share_mode`로 확장, `'voter'` 하드코딩을 `case when v_share_mode in ('places','both') then 'editor' else 'voter' end`로 교체. 나머지 안전장치(bearer slug 검증·self-join only·owner 가드·멱등·grant to authenticated만) **전부 유지**. 기존 `join_shared_trip`은 삭제하지 않음 (iOS 동결).

**Analog 2:** `0018` `date_comments` (L46~54) — **trip_messages의 테이블 shape**

```sql
create table if not exists date_comments (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references date_polls(id) on delete cascade,
  device_token text not null,
  nickname text not null,
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now()
);
create index date_comments_poll_id_idx on date_comments (poll_id, created_at);
```

→ `trip_messages`: `poll_id`→`trip_id references trips(id) on delete cascade`, `device_token`→`user_id uuid not null references profiles(id)`, nickname·body CHECK 유지, `reply_to_place_id uuid references places(id) on delete set null` 추가. 인덱스도 `(trip_id, created_at)` 미러.

**Analog 3:** `0016` links RLS (L404~412) — **trip_id 직접 보유 테이블의 헬퍼-only RLS shape**

```sql
create policy "links: read if can read trip"
  on links for select
  to authenticated
  using (can_read_trip(trip_id));

create policy "links: insert if can edit trip"
  on links for insert
  to authenticated
  with check (can_edit_trip(trip_id));
```

→ trip_messages: SELECT = `can_read_trip(trip_id)`, INSERT = `user_id = auth.uid() and can_vote_trip(trip_id)` (0016 votes INSERT L536~545의 "본인 + 헬퍼" 결합 shape, 0023 CR-01 교훈 반영), DELETE = `user_id = auth.uid() or am_trip_owner(trip_id)` (0016 places DELETE L488~494 shape). trip_id 직접 보유이므로 0018식 부모 EXISTS 래핑조차 불필요.

**share_mode 컬럼 추가 패턴** — 0016 trips visibility CHECK (L123~124) 미러:

```sql
visibility text not null default 'private'
  check (visibility in ('private','shared','public')),
```

→ `alter table trips add column share_mode text check (share_mode in ('dates','places','both'));` (nullable = 레거시, §4.3 룰). `companion text check (char_length(companion) <= 20)` 동일 idiom.

**slug 생성은 재사용, 재구현 금지:** `ensure_share_slug` 트리거(0016 L158~182)가 visibility 변경 시 자동 발동 — 0025에서 손대지 않음.

---

### `supabase/config.toml` (config)

**Analog:** 같은 파일 L48 + L55~63

익명 토글 (L48 — false→true 한 줄):

```toml
enable_anonymous_sign_ins = false
```

카카오 블록 — apple/google idiom 미러 (L55~63):

```toml
[auth.external.apple]
enabled = false
client_id = "env(APPLE_SERVICE_ID)"
secret = "env(APPLE_SECRET)"
```

→ `[auth.external.kakao]`에 `enabled = true` + `client_id = "env(KAKAO_REST_API_KEY)"` + `secret = "env(KAKAO_CLIENT_SECRET)"`. **파일 헤더 주석(L2~3)이 명시하듯 config.toml은 로컬 전용** — 대시보드 설정은 별도 human-action.

---

### `packages/core/src/constants.ts` (도메인 상수)

**Analog:** 같은 파일 L211~215 (채널 빌더) + L235~238 (poll 미러) + `ledger.ts` L14~21 (enum 쌍)

채널 빌더 패턴 (L211~215):

```typescript
/** Phase 18 — Realtime Broadcast channel for plan generation progress (trip-scoped, D-02). */
export const PLAN_CHANNEL_PREFIX = 'plan:';
export function planChannelName(tripId: string): string {
  return `plan:${tripId}`;
}
```

→ `MOA_CHANNEL_PREFIX = 'moa:'` + `moaChannelName(tripId)` 동일 형식. pollChannelName 주석(L229~234)처럼 "ONE channel carries presence+message+vote+place_added" 단일 채널 규약을 주석에 명시 (Phase 26 소비).

enum 쌍 패턴 (constants.ts L55~56):

```typescript
export const TripVisibility = ['private', 'shared', 'public'] as const;
export type TripVisibilityType = (typeof TripVisibility)[number];
```

→ `ShareMode = ['dates', 'places', 'both'] as const` + `ShareModeType`. **주석에 "0025 CHECK와 문자 단위 일치" 명시** (ledger.ts L5~6 "locked CHARACTER-FOR-CHARACTER" 문구 미러).

---

### `packages/core/src/schemas/trip.ts` (TripCreateDraftSchema 추가)

**Analog:** 같은 파일 L30~39 `TripCreateSchema`

```typescript
// "일정 정해짐" create — dates REQUIRED (D-09), end >= start, day-trip = equal.
export const TripCreateSchema = z
  .object({
    title: z.string().min(1).max(Limits.TripTitleMax),
    city_code: z.string().max(20), // preset or 'other' (D-08)
    start_date: z.string().date(), // required (D-09)
    end_date: z.string().date(), // required (day-trip = start)
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: 'end_date must be >= start_date',
  });
```

→ `TripCreateDraftSchema`: 동일 object shape에서 dates를 `.nullable()`로, `companion: z.string().max(20).nullable()` 추가, `.refine` 2개("둘 다 있거나 둘 다 null" + "end>=start")는 RESEARCH Code Example 6 스케치 그대로. 기존 `TripCreateSchema`는 **수정하지 않고 공존** (iOS 동결). `TripSchema`(L4~23)에 `share_mode: z.enum(ShareMode).nullable()`·`companion` 미러 추가 시에도 기존 필드 순서·주석 스타일 유지.

---

### `packages/core/src/schemas/place.ts` (seq_no 추가)

**Analog:** 같은 파일 L59~67 `confidence` 필드 — **migration 번호 명시 주석 스타일**

```typescript
  /**
   * LLM confidence 0..1 for AI-extracted pins (Phase 5 TRUST-04).
   * - null = manual pin OR legacy AI pin before 0006 backfill
   * ...
   * Source of truth: places.confidence column (migration 0006) + public_board_view RPC.
   */
  confidence: z.number().min(0).max(1).nullable(),
```

→ `seq_no: z.number().int().positive()` + "Source of truth: places.seq_no column (migration 0024, advisory-lock 트리거 채번 — 클라이언트 forge 불가)" 스타일 주석. **주의:** PlaceSchema의 `board_id`(L15)는 DB `trip_id`와 드리프트 상태 — Surgical Changes 원칙상 **건드리지 않고 seq_no만 추가** (RESEARCH Open Q4).

---

### `packages/core/src/schemas/chat.ts` (신규 파일)

**Analog:** `packages/core/src/schemas/ledger.ts` — 신규 계약 파일의 house style 전체

파일 헤더 + enum 잠금 주석 (ledger.ts L1~21):

```typescript
import { z } from 'zod';

// Phase 21 — travel ledger contract (LEDGER-02/03/06). This is the single seam every
// downstream consumer imports: parse-email EF (21-04), @moajoa/api (21-03), iOS (21-05).
// Enum values are locked CHARACTER-FOR-CHARACTER to the 0022 ledger_entries CHECK
// constraints — any drift breaks the pipeline at runtime.
```

Row 스키마 shape (ledger.ts L41~62 — DB 컬럼 1:1, nullable 명시, timestamptz는 `z.string()`):

```typescript
export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  trip_id: z.string().uuid().nullable(),
  ...
  created_at: z.string(),
  updated_at: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
```

→ `TripMessageSchema` = 0025 trip_messages 컬럼 1:1 (id·trip_id·user_id·nickname·body(1~140)·reply_to_place_id nullable·created_at) + `TripMessageCreateSchema` (클라이언트 입력용 subset). barrel 등록: `schemas/index.ts`에 `export * from './chat';` 한 줄 (기존 L1~10 알파벳 아닌 추가순 나열 — 맨 끝에 추가).

---

### `packages/core/src/schemas/chat.test.ts` + ShareMode·draft 테스트 (신규, TDD)

**Analog:** `packages/core/src/schemas/ledger.test.ts` L1~28

```typescript
import { describe, it, expect } from 'vitest';
import { LedgerStatus, FxSource, LedgerEntrySchema, ... } from './ledger';

// Reuse the plan.test.ts uuid v4 fixture.
const UUID = '11111111-1111-4111-8111-111111111111';

describe('Ledger enums — locked to 0022 CHECK constraints', () => {
  it('LedgerStatus matches the 0022 status CHECK (5 values, exact order)', () => {
    expect(LedgerStatus).toEqual(['pending', 'processing', 'ready', 'needs_review', 'failed']);
  });
});
```

→ 미러 대상: ① `expect(ShareMode).toEqual(['dates','places','both'])` — 0025 CHECK 회귀 가드, ② TripMessageSchema valid/invalid 픽스처(UUID 상수 재사용), ③ TripCreateDraft refine 케이스(둘 다 null OK / 한쪽만 null 거부 / end<start 거부). 실행: `pnpm --filter @moajoa/core test`.

---

### `packages/api/src/queries/memberships.ts` (joinMoa 추가)

**Analog:** 같은 파일 L1~15 `joinSharedTrip`

```typescript
import type { MoajoaSupabaseClient } from '../client';

/**
 * Self-join a shared/public trip by its slug. Idempotent (already a member = no-op).
 * Returns the trip id. Backed by the SECURITY DEFINER join_shared_trip RPC, which
 * hard-codes role='voter' and uses auth.uid() — the caller can only join as themselves.
 */
export async function joinSharedTrip(
  client: MoajoaSupabaseClient,
  shareSlug: string,
): Promise<string> {
  const { data, error } = await client.rpc('join_shared_trip', { p_share_slug: shareSlug });
  if (error) throw error;
  return data as string;
}
```

→ `joinMoa`: 시그니처·`if (error) throw error`·`data as string` 전부 동일, RPC 이름만 `join_moa`, doc 주석에 "role은 서버가 share_mode로 결정 (places/both→editor, dates→voter)" 명시. 기존 `joinSharedTrip`은 보존.

---

### `packages/api/src/queries/trips.ts` (shareMoa 추가)

**Analog:** 같은 파일 L123~153 `shareTrip`

```typescript
/**
 * Flip a trip to 'shared' (if still private) and return its `share_slug` for
 * the `/b/{slug}` link. The DB `trips_share_slug_before_update` trigger (0016)
 * generates the slug the first time visibility becomes shared/public, so no
 * extra RPC is needed — owner RLS already permits this update. Idempotent: ...
 */
export async function shareTrip(
  client: MoajoaSupabaseClient,
  tripId: string,
): Promise<string> {
  const { data: cur, error: readErr } = await client
    .from('trips')
    .select('visibility, share_slug')
    .eq('id', tripId)
    .single();
  if (readErr) throw readErr;
  const existing = (cur as { share_slug: string | null } | null)?.share_slug;
  if (existing) return existing;

  const { data, error } = await client
    .from('trips')
    .update({ visibility: 'shared' })
    .eq('id', tripId)
    .select('share_slug')
    .single();
  if (error) throw error;
  const slug = (data as { share_slug: string | null } | null)?.share_slug;
  if (!slug) throw new Error('share_slug not generated');
  return slug;
}
```

→ `shareMoa(client, tripId, shareMode: ShareModeType)`: UPDATE payload를 `{ visibility: 'shared', share_mode: shareMode }`로 확장. slug 생성은 여전히 0016 트리거 몫 — RPC 불필요 (Don't Hand-Roll 표). "이미 slug 있으면 early return" 분기는 share_mode 갱신 시맨틱(Open Q3) 결정에 따라 조정 — 모드 변경 허용이면 early return 전에 share_mode UPDATE 필요.

---

### `CLAUDE.md` (§5 D26 불릿 반전) / `supabase/.env.local.example` (KAKAO placeholder)

**CLAUDE.md:** §5의 `❌ Web에 *새로운* "보드 생성"·"링크 추가" UI 추가 — 그건 iOS 전용` 불릿(+ 괄호 dev-tool 설명)을 v2.1 웹 퍼스트 문구로 교체. §4.1 web 설명("열람·공개 보드 + 투표 참여")도 한 줄 정합. 기존 불릿 포맷(❌ 접두) 유지.

**.env.local.example:** 기존 key 형식 미러 — 주석 한 줄 + `KEY=예시값...` shape:

```
# Used by `supabase functions serve` locally.
ANTHROPIC_API_KEY=sk-ant-...
```

→ `KAKAO_REST_API_KEY=...` / `KAKAO_CLIENT_SECRET=...` + config.toml env() 치환용이라는 주석. 실값 커밋 금지 (§4.7).

## Shared Patterns

### SECURITY DEFINER + search_path 핀 (모든 신규 SQL 함수)
**Source:** `supabase/migrations/0016_trips_baseline.sql` L631~636 (및 L78~82, L220~226)
**Apply to:** 0024 `assign_place_seq`, 0025 `join_moa`

```sql
create or replace function join_shared_trip(p_share_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
```

`security definer`와 `set search_path = public`은 **항상 쌍** (0019/0020이 search_path 누락을 사후 픽스한 선례 — 처음부터 넣을 것). 마지막에 `grant execute ... to authenticated;` — 익명 유저도 authenticated role이므로 anon grant 불필요.

### 42P17 가드 — RLS 크로스 테이블은 헬퍼만
**Source:** `0016` L215~218 주석 + `0018` L85~90 주석
**Apply to:** 0025 trip_messages 정책 전부

```sql
-- Cross-table RLS checks go EXCLUSIVELY through SECURITY DEFINER helpers with
-- `set search_path = public` — never a direct EXISTS against another table —
-- to avoid the 42P17 recursion that 0002 fixed (Pitfall 3, CLAUDE.md §4.4).
```

사용 가능한 기존 헬퍼 (재정의 금지): `am_trip_owner`(L220) · `am_trip_member`(L235) · `can_read_trip`(L291) · `can_edit_trip`(L313) · `can_vote_trip`(L338). 검증 게이트: `pnpm supabase:reset` 클린 (42P17 = 0).

### 마이그레이션 헤더 주석 규약
**Source:** `0018` L1~5, `0023` L1~22
**Apply to:** 0024, 0025

파일명 — Phase·REQ 참조 — 재사용하는 기존 idiom 출처(마이그레이션 번호+라인) — `Append-only: 0016..0023 NEVER modified` 문구. 리뷰어와 미래 세션이 의존하는 포맷.

### api 쿼리 시그니처 + 에러 처리
**Source:** `packages/api/src/queries/memberships.ts` L8~15
**Apply to:** joinMoa, shareMoa

`(client: MoajoaSupabaseClient, ...인자)` 첫 인자 고정 · `const { data, error } = await ...; if (error) throw error;` · 반환은 `data as T` 캐스팅 · doc 주석에 백엔드 RPC/트리거·보안 근거 명시.

### enum ↔ DB CHECK 문자 단위 잠금 + 회귀 테스트
**Source:** `packages/core/src/schemas/ledger.ts` L14~21 + `ledger.test.ts` L14~28
**Apply to:** ShareMode (constants.ts), TripMessage 관련 CHECK 값

`as const 배열 + (typeof X)[number]` 쌍 + vitest `.toEqual` 정확 배열 단언. 주석에 대응 마이그레이션 번호 명시.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| SQL 동시성 하네스 (예: `supabase/tests/place_seq_concurrency.sh`) | test | batch | `supabase/tests/` 디렉토리 자체가 없음 — 레포 내 bash SQL 하네스 선례 없음. RESEARCH Code Example 2 (`xargs -P 8` psql + count=distinct=max 단언)가 사실상의 레퍼런스. 접속 문자열 `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| 익명 세션 + join_moa curl smoke 스크립트 | test | request-response | 동일 — RESEARCH Code Example 3~4가 레퍼런스 (signup → JWT decode → rpc/join_moa → psql role 단언) |

`packages/api/src/types/database.ts`는 아날로그 불필요 — `pnpm supabase:types` 생성물, 손편집 금지.

## Metadata

**Analog search scope:** `supabase/migrations/`, `supabase/config.toml`, `packages/core/src/{constants.ts,schemas/}`, `packages/api/src/queries/`, `supabase/.env.local.example`, `CLAUDE.md`
**Files scanned:** 11개 정독 (0016 810L 전체 포함)
**Pattern extraction date:** 2026-07-08
**참고:** 라인 번호는 2026-07-08 HEAD 기준. 0016은 append-only라 불변 — 라인 참조 안정적.
