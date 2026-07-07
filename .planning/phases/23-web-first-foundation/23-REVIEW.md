---
phase: 23-web-first-foundation
reviewed: 2026-07-07T23:34:35Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - CLAUDE.md
  - packages/api/src/queries/memberships.test.ts
  - packages/api/src/queries/memberships.ts
  - packages/api/src/queries/trips.test.ts
  - packages/api/src/queries/trips.ts
  - packages/api/src/types/database.ts
  - packages/core/src/constants.ts
  - packages/core/src/schemas/chat.test.ts
  - packages/core/src/schemas/chat.ts
  - packages/core/src/schemas/index.ts
  - packages/core/src/schemas/place.test.ts
  - packages/core/src/schemas/place.ts
  - packages/core/src/schemas/trip.test.ts
  - packages/core/src/schemas/trip.ts
  - supabase/.env.local.example
  - supabase/config.toml
  - supabase/migrations/0024_place_seq.sql
  - supabase/migrations/0025_web_share.sql
  - supabase/tests/place_seq_concurrency.sh
  - supabase/tests/web_share_smoke.sh
findings:
  critical: 0
  warning: 2
  info: 3
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-07-07T23:34:35Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 23 (웹 퍼스트 기반) 변경 20개 파일을 standard 깊이로 리뷰했다. 마이그레이션 2건(0024 순번 채번, 0025 share_mode·trip_messages·join_moa), core/api 계약 seam, 로컬 검증 하네스 2건, config.toml 스위치가 대상이다.

전반적으로 견고하다. 특히:

- **0024 순번 채번**: max+1 대신 `trips.last_place_seq` 단조증가 카운터를 쓴 설계가 hard-delete 재사용 문제를 정확히 막는다. advisory lock + SECURITY DEFINER + `search_path` 핀 + null 가드 모두 올바르고, backfill → not null 승격 → unique 인덱스 순서도 정합적이다. 동시성 하네스(40건 8-way, forge 차단, hard-delete 무재사용)가 핵심 불변식을 전부 실증한다.
- **0025 RLS**: 크로스 테이블 정책이 전부 SECURITY DEFINER 헬퍼(`can_read_trip`/`can_vote_trip`/`am_trip_owner`) 경유 — 직접 EXISTS 0건으로 CLAUDE.md §4.4(42P17 가드)를 준수한다. `join_moa`는 0016 `join_shared_trip`의 안전장치(self-join only, owner 가드, on conflict do nothing 멱등)를 전부 유지하면서 role 결정만 서버 사이드 share_mode 분기로 바꿨다 — 클라이언트 role 인자 없음이 확인된다(T-23-04 escalation 가드 충족).
- **계약 seam**: `ShareMode`·`TripMessageSchema`가 0025 CHECK와 문자 단위로 일치하고, 테스트가 경계값(140/141자, seq_no 0/음수/소수)을 커버한다. `database.ts`(생성 파일)의 `seq_no`(Row 필수/Insert 옵셔널), `join_moa` Functions 시그니처 모두 생성 이상 없음.

Critical 이슈는 없다. Warning 2건: (1) `shareMoa`가 이미 `public`인 trip을 조용히 `shared`로 강등, (2) `trip_messages.nickname`에 DB 레벨 길이 제약 부재(직접 INSERT 경로에서 빈/무제한 닉네임 허용).

## Warnings

### WR-01: shareMoa가 public trip의 visibility를 조용히 'shared'로 강등

**File:** `packages/api/src/queries/trips.ts:168-173`
**Issue:** `shareMoa`는 무조건 `{ visibility: 'shared', share_mode }` UPDATE를 실행한다. 이미 `visibility='public'`인 trip에 대해 호출하면 public → shared로 강등되어, 기존 공개 링크로 열람하던 비멤버의 접근이 끊긴다. 같은 파일의 `shareTrip`(L130-153)은 기존 slug가 있으면 visibility를 건드리지 않고 반환하도록 명시적으로 설계돼 있어("already shared/public trip keeps its visibility"), 두 함수의 동작이 비대칭이다. `shareMoa` docstring은 "re-calling UPDATES share_mode"만 언급하고 public 강등은 다루지 않는다 — 의도라면 문서화, 아니라면 버그.
**Fix:** share_mode는 항상 갱신하되 visibility는 private일 때만 승격:
```typescript
// public 유지: 이미 shared/public이면 visibility는 그대로 두고 share_mode만 갱신
const { data: cur, error: readErr } = await client
  .from('trips').select('visibility').eq('id', tripId).single();
if (readErr) throw readErr;
const patch: Record<string, string> = { share_mode: shareMode };
if ((cur as { visibility: string }).visibility === 'private') patch.visibility = 'shared';
const { data, error } = await client
  .from('trips').update(patch).eq('id', tripId).select('share_slug').single();
```
(현재 웹 플로우에서 public trip이 실질적으로 없다면, 최소한 docstring에 "public이었더라도 shared로 내려간다"를 명시할 것.)

### WR-02: trip_messages.nickname — DB CHECK 부재 + Zod max 부재 (직접 INSERT 경로 무방비)

**File:** `supabase/migrations/0025_web_share.sql:34` / `packages/core/src/schemas/chat.ts:20`
**Issue:** `body`는 `check (char_length(body) between 1 and 140)`으로 DB가 직접 방어하지만 `nickname`은 `not null`뿐이다. trip_messages는 0018 date_comments와 달리 **RPC 경유가 아니라 PostgREST 직접 INSERT**(RLS `with check`)로 쓰이므로, 0018이 `cast_date_vote` RPC 안에서 하던 nickname 검증(`char_length(btrim(p_nickname)) = 0` 거부)이 이 테이블에는 존재하지 않는다. 멤버 권한의 클라이언트가 Zod를 우회해 `nickname: ''` 또는 수 MB 문자열을 직접 넣을 수 있고, 이는 Phase 26 공유 채팅 UI에 그대로 렌더된다. Zod 쪽도 `z.string().min(1)`만 있고 max가 없어 seam 계약이 상한을 잠그지 못한다.
**Fix:** ① 새 마이그레이션(0026, append-only 준수)으로 DB 제약 추가:
```sql
alter table trip_messages add constraint trip_messages_nickname_len
  check (char_length(nickname) between 1 and 20);
```
② `chat.ts`의 nickname을 `z.string().min(1).max(20)`으로 상한 동기화 (20은 `companion` CHECK·프로필 닉네임 관례와 정합 — 실제 상한은 팀 결정 후 constants에 상수화 권장).

## Info

### IN-01: 0025 — `create table if not exists` 뒤 `create index`는 조건 없음 (멱등성 불일치)

**File:** `supabase/migrations/0025_web_share.sql:30,39`
**Issue:** 테이블은 `if not exists`인데 인덱스·정책은 조건 없이 생성한다. 테이블이 이미 존재하는 경로에서는 어차피 인덱스 생성이 실패하므로 `if not exists`가 실효 없는 장식이 된다. 마이그레이션은 정확히 1회 적용되는 전제이므로 오히려 `if not exists`를 빼서 중복 적용을 조기에 fail-loud 시키는 편이 일관적이다.
**Fix:** 이미 적용된 0025는 수정 금지(append-only). 다음 마이그레이션부터 `create table`(조건 없음)으로 통일하거나, 전체를 `if not exists`로 맞추는 컨벤션을 정할 것.

### IN-02: 0024 채번 트리거가 place INSERT마다 trips.updated_at을 갱신 (부수효과)

**File:** `supabase/migrations/0024_place_seq.sql:41-43`
**Issue:** `assign_place_seq`의 `update trips set last_place_seq = ...`가 0016의 `trips_updated_at` BEFORE UPDATE 트리거를 함께 발화시켜, 장소 1건 추가마다 trip의 `updated_at`이 갱신된다. `listMyTrips`/`listMyTripsWithPreview`가 `updated_at desc` 정렬이므로 "장소 추가 = 목록 최상단"이 된다 — 최근 활동 정렬로 보면 오히려 바람직할 수 있으나, 명시적 결정이 아닌 우연한 부수효과다. (같은 UPDATE가 `ensure_share_slug` 트리거도 통과하지만 visibility 무변경이라 무해함은 확인.)
**Fix:** 의도된 동작이면 0024 주석 또는 23-PATTERNS.md에 한 줄 기록. 원치 않으면 별도 마이그레이션에서 `trips_updated_at` 트리거에 `when (old.last_place_seq is distinct from new.last_place_seq)` 제외 조건 대신 — 트리거 함수에서 seq-only 변경을 스킵하는 방식을 검토.

### IN-03: join_moa — MembersPerBoard(20) 상한 미적용 (0016 미러의 기존 갭)

**File:** `supabase/migrations/0025_web_share.sql:89-93` / `packages/core/src/constants.ts:14`
**Issue:** `Limits.MembersPerBoard: 20`("Max members per shared board")이 constants에 선언돼 있으나 `join_moa`(및 원본 `join_shared_trip`)는 멤버 수 상한 없이 INSERT한다. bearer 링크 하나로 익명 세션 포함 무제한 참여가 가능하다. 0016 미러라는 결정에 부합하는 pre-existing 갭이므로 이번 phase 결함은 아니지만, 웹 퍼스트 공유로 유입이 커지는 시점이라 기록해 둔다.
**Fix:** 후속 phase에서 join_moa에 `accepted_member_count(v_trip_id) >= 20 → raise exception` 가드 추가 여부를 제품 결정으로 다룰 것 (rate limit 30/hr per IP가 임시 완충).

---

**리뷰 노트 (플래그 아님):**

- `chat.ts`의 `created_at: z.string()`(`.datetime()` 없음)은 ledger.ts idiom으로 주석에 문서화된 의도적 선택 — timestamptz의 `+00:00` 오프셋 표기가 Zod `.datetime()` 기본값과 충돌하는 문제를 회피한다.
- `web_share_smoke.sh`의 JWT 디코딩(`p+'=='` 패딩)은 Python b64decode의 초과 패딩 허용으로 안전. 테스트 데이터 미정리(cleanup 없음)는 로컬 하네스 특성상 허용.
- `config.toml`의 `enable_confirmations = false`는 "local dev only — production: true" 주석으로 처리됨. Kakao 키는 `env()` 치환 — 하드코딩 시크릿 없음. `.env.local.example`은 placeholder만 포함.
- CLAUDE.md 변경은 의도된 D26 룰 반전(문서 변경)으로 확인.
- `database.ts`는 생성 파일 — 생성 이상 없음 (share_mode가 union이 아닌 `string | null`인 것은 CHECK 제약이 enum 타입이 아니어서 생기는 generator 정상 동작).

---

_Reviewed: 2026-07-07T23:34:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
