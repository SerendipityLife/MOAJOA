# Phase 2: Extraction Pipeline Hardening - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Edge Function(`extract-youtube`)의 추출 파이프라인을 hardening한다: 진행 상태 실시간 broadcast, 비용 로깅, citation 없는 가짜 장소 폐기, Places API 비용 방어선. Phase 3(iOS save flow)과 Phase 5(trust UI)의 토대.

**Scope anchor:** `supabase/functions/extract-youtube/**` + 새 마이그레이션(`0004_*`) + `extraction_costs` 테이블. iOS/Web 코드 변경 없음.

</domain>

<decisions>
## Implementation Decisions

### Realtime Broadcast (EXTRACT-01)

- **D-01:** **Supabase Realtime Broadcast `channel.send()`를 Edge Function 안에서 직접 호출.** admin client(`createClient(url, serviceRole)`)로 `extract:{link_id}` 채널에 5단계 메시지 전송. DB 상태 컬럼 polling 방식이 아닌 push 방식.
- **D-02:** **5단계: `metadata` → `transcript` → `llm` → `places` → `done` (또는 `error`).** 각 단계 payload에 `{ step, progress_pct, detail? }` 구조. `done` 단계에는 `places_extracted` 수 포함.
- **D-03:** 기존 `links.extraction_status` 컬럼(pending/processing/ready/failed/manual_review)은 **그대로 유지.** Broadcast는 실시간 알림용이고, DB 상태는 최종 결과 기록용 — 역할 분리.

### Citation 강제 + 컬럼 매핑 (EXTRACT-02, EXTRACT-03)

- **D-04:** `claude.ts`의 `PlaceCandidate` Zod 스키마에서 **`source_quote`를 required로 변경** (`.optional()` 제거). LLM 응답에서 `source_quote` 없는 후보는 parse 후 **필터링으로 폐기** (Zod parse 자체가 아닌 후처리에서 제거 — LLM이 일부만 빠뜨릴 수 있으므로 전체 parse 실패를 피함).
- **D-05:** LLM 프롬프트의 Constraints에 **"Every place MUST include source_quote. Omitting it will cause the entry to be discarded."** 명시 추가.
- **D-06:** `places` 테이블 컬럼 매핑:
  - `source_timestamp_sec` — **기존 컬럼 유지** (EXTRACT-03의 `video_offset_sec`와 동일 역할)
  - `source_quote` — **기존 컬럼 유지** (EXTRACT-03의 `quote`와 동일 역할)
  - `source_kind` — **새 컬럼 추가** (`text NOT NULL DEFAULT 'ai'`, CHECK `('ai','manual')`)
  - `inferred_city` — **새 컬럼 추가** (`text`, nullable, LLM이 추론한 도시명 저장)
- **D-07:** 기존 `source_timestamp_sec`/`source_quote` 컬럼명은 **rename하지 않음** — 이미 Edge Function과 `public_board_view` RPC에서 사용 중. EXTRACT-03 요구사항의 `video_offset_sec`/`quote`는 기존 컬럼이 커버.

### 비용 로깅 (EXTRACT-04)

- **D-08:** `extraction_costs` 테이블 스키마:
  ```sql
  id uuid PK
  link_id uuid FK → links(id) ON DELETE CASCADE
  provider text NOT NULL CHECK ('anthropic','google_places')
  model text          -- 'claude-sonnet-4-6' 등
  input_tokens int
  output_tokens int
  cost_usd numeric(10,6)
  duration_ms int
  created_at timestamptz DEFAULT now()
  ```
- **D-09:** **API 호출 단위로 1행씩 기록.** 하나의 추출에서 Anthropic 1행 + Places API N행 생성. 영상당 총 비용 = `SELECT link_id, SUM(cost_usd) FROM extraction_costs GROUP BY link_id`.
- **D-10:** 비용 계산은 **Edge Function 코드에서 token 수 × 단가로 산출.** Anthropic 응답의 `usage.input_tokens`/`usage.output_tokens` 사용. Places API는 호출당 고정 비용 추정 ($0.003/call Text Search Basic).
- **D-11:** `extraction_costs` 테이블에 **RLS 불필요** — Edge Function이 service role로만 쓰고, 클라이언트 직접 접근 없음. `ALTER TABLE extraction_costs ENABLE ROW LEVEL SECURITY;`는 적용하되 정책은 admin-only.

### Places FieldMask 검증 (EXTRACT-05)

- **D-12:** **이미 `places.ts`에 명시적 FieldMask 설정됨.** `places.id,places.displayName,places.formattedAddress,places.location,places.primaryType`. 와일드카드 없음 확인 완료. grep 검증으로 success criteria 만족.

### GCP Billing Alert (EXTRACT-06)

- **D-13:** **GCP Console에서 수동 설정 + 설정 과정을 문서화.** 코드가 아닌 인프라 설정. $5/$20/$50 threshold. 검증은 알림 이메일 수신 확인.
- **D-14:** IaC(Terraform 등)는 도입하지 않음 — 2인 팀 사이드 프로젝트에 과도. 수동 설정 + 스크린샷/문서로 충분.

### Claude's Discretion

- Anthropic API 응답에서 usage 파싱 방식의 세부 구현
- `inferred_city` 추출을 위한 LLM 프롬프트 미세 조정
- Realtime Broadcast 에러 핸들링 (broadcast 실패 시 추출 자체는 계속 진행)
- 마이그레이션 파일 하나로 합칠지 분리할지 (기능 단위)
- `extraction_costs`에 index 설계

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 정의·요구사항

- `.planning/ROADMAP.md` §"Phase 2: Extraction Pipeline Hardening" — Goal, success criteria 6개
- `.planning/REQUIREMENTS.md` §"Extraction Pipeline (EXTRACT)" — EXTRACT-01~06 본문
- `.planning/STATE.md` §"Accumulated Context" — Phase 결정 근거

### 기존 코드 (반드시 읽고 수정)

- `supabase/functions/extract-youtube/index.ts` — 메인 핸들러. Broadcast + cost logging 삽입 지점
- `supabase/functions/extract-youtube/pipeline/claude.ts` — LLM 추출. source_quote 필수화 + inferred_city 추출 + usage 파싱
- `supabase/functions/extract-youtube/pipeline/places.ts` — Google Places 해석. FieldMask 이미 적용됨. cost 기록 추가 지점

### DB 스키마 (마이그레이션 작성 시 참고)

- `supabase/migrations/0001_init.sql` — places 테이블 원본 정의 (source_timestamp_sec, source_quote 이미 존재)
- `supabase/migrations/0002_fix_rls_recursion.sql` — SECURITY DEFINER 헬퍼 패턴 참고
- `supabase/migrations/0003_boards_owner_default.sql` — 최신 마이그레이션 번호 확인 (다음은 0004)

### 프로젝트 가드레일

- `CLAUDE.md` §4.3 마이그레이션 규칙 — append-only, 기존 파일 수정 금지
- `CLAUDE.md` §4.4 인증·RLS — service role은 Edge Function만, 클라이언트는 anon key만
- `CLAUDE.md` §4.5 코드 스타일 — TypeScript strict, Zod validate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `supabase/functions/extract-youtube/index.ts` — admin client(`createClient(url, serviceRole)`) 이미 생성됨. 이 client로 Realtime Broadcast도 가능
- `pipeline/places.ts`의 `FIELD_MASK` 상수 — 이미 명시적 FieldMask 적용. EXTRACT-05 거의 충족
- `pipeline/claude.ts`의 `PlaceCandidate` Zod 스키마 — source_quote optional → required 변경 지점
- `0001_init.sql`의 `can_read_board()`, `can_edit_board()` — SECURITY DEFINER 헬퍼 패턴. 새 RLS 정책에서 재사용

### Established Patterns

- Edge Function은 service role로 DB 접근 (RLS bypass)
- Zod 스키마로 외부 입력 검증 (LLM 응답 포함)
- 마이그레이션 append-only (0001 → 0002 → 0003 → 다음은 0004)
- `public_board_view()` RPC가 places의 `source_timestamp_sec`을 이미 반환 — 컬럼명 변경 불가

### Integration Points

- `index.ts` 각 단계 사이에 `channel.send()` 삽입 (metadata 후, transcript 후, llm 후, places 후, 완료/에러)
- `claude.ts`의 `extractCandidatesFromContext()` 반환 시 Anthropic usage 정보도 같이 반환하도록 확장
- `places.ts`의 `resolveGooglePlace()` 호출 전후로 duration 측정 + cost 기록
- `index.ts`의 places INSERT에 `source_kind: 'ai'` 기본값 추가
- `pnpm supabase:types` 실행하여 `packages/api/src/types/database.ts` 재생성

</code_context>

<specifics>
## Specific Ideas

- citation 강제(D-04)에서 Zod parse 실패가 아닌 **후처리 필터링** 채택 — LLM이 30개 중 2개만 source_quote를 빠뜨렸을 때 나머지 28개를 살려야 하므로
- 비용 로깅은 영상당 집계가 핵심 — `SELECT link_id, SUM(cost_usd)` 한 줄로 가능해야 함
- Places API는 Deno Edge Function에서 `performance.now()`로 duration 측정
- `inferred_city`는 LLM 프롬프트에 "what city/region is this place in?" 필드 추가로 추출

</specifics>

<deferred>
## Deferred Ideas

- **추출 정확도 baseline 측정 (EXTRACT-07)** — Phase 6에서 dogfooding과 짝지어 진행
- **블로그·인스타 manual extraction queue** — v2 (EXTRACT-10)
- **resolve-place Edge Function** — v2 (EXTRACT-11)
- **LLM 프롬프트 자동 튜닝** — v2 (EXTRACT-09)
- **비용 대시보드 UI** — Phase 2에서는 SQL 집계만. UI는 필요 시 별도 phase

</deferred>

---

*Phase: 02-extraction-pipeline-hardening*
*Context gathered: 2026-05-25*
