# Phase 8: 추출 깊이 (장소·영상 해설) - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Source:** SESSION-NOTES-2026-06-07.md §2 (브레인스토밍에서 잠긴 설계 — discuss-phase 결정 역할). 자동 모드(AUTONOMOUS-LOG D8): discuss 생략, §2를 CONTEXT로 승격.

<domain>
## Phase Boundary

**IN:** 유튜브 추출 파이프라인의 출력 계약을 "장소 + 사람이 읽는 한국어 해설"로 확장. 장소별 1~2문장 해설(`places.summary_ko`)과 영상별 2~3문장 TL;DR(`links.summary_ko`)을 단일 Claude 호출로 함께 생성하고, 공개 보드(web)에 노출.

**OUT (이 phase 아님):**
- ① 소스 넓이(블로그·인스타) → Phase 9
- 웹 투표 → Phase 10
- 멀티-영상 장소 출처 별도 테이블 (아래 알려진 한계 참조 — 나중 마이그레이션)
- 접근 B (`highlights[]`·태그) — 확장 경로일 뿐 이번 범위 아님
</domain>

<decisions>
## Implementation Decisions (LOCKED — SESSION-NOTES §2)

### 방향
- **장소 중심(place-centric), 접근 A (한 줄 해설).**

### Claude 호출
- **단일 Claude 호출 확장.** 자막이 이미 컨텍스트에 있으니 **출력 스키마만 넓힌다.** 새 호출/추가 레이턴시 없음, 출력 토큰만 소폭 증가. (모델 `claude-sonnet-4-6` 유지)

### 새 필드 2개 (둘 다 nullable, 추가형)
- `places.summary_ko` — 장소당 1~2문장 한국어 해설. 기존 `source_quote` 옆, 동일 단일출처 패턴.
- `links.summary_ko` — 영상 2~3문장 한국어 TL;DR (보조).

### 반환각(환각 방지) 규칙 — 유지
- 해설은 **자막·설명 근거 범위 내에서만.** 근거 없으면 짧거나 비움 (지어내기 금지).
- 기존 `confidence < 0.4` 필터 + `source_quote` 필수 규칙 **그대로 유지.**

### 언어
- 해설·요약은 **한국어 출력** (영상이 JP/EN이어도).

### 노출
- **서버사이드라 웹·앱 양쪽에 자동 노출.** 이번 phase의 UI 작업은 **웹 공개 보드**에 한정 (VIEW-08).
- 웹엔 **새 생성/추가 UI 만들지 않음** (CLAUDE.md 하드룰 준수) — 기존 핀/리스트/링크 카드에 해설/요약 **표시만** 추가.

### 에러 처리
- 해설은 **부가 기능. 절대 추출을 실패시키지 않음.** 생성 누락·파싱 실패 시 NULL 저장 + UI에서 해설 블록만 숨김(조건부 렌더).

## Claude's Discretion (구현 디테일)
- 정확한 프롬프트 문구·출력 JSON 키 이름(예: `summary_ko`)과 파싱 위치.
- Zod 스키마에서 필드 배치 (place/link/extraction 중 어디).
- 마이그레이션 파일명/순서: **다음 번호 = `0008`** (`supabase/migrations/0008_extraction_summaries.sql`).
- 웹 노출 위치 디테일 (핀 상세/리스트 카드 내 해설 블록 마크업) — 기존 PublicBoardMap·보드 페이지 스타일 재사용.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 추출 파이프라인 (Backend / Edge — Deno)
- `supabase/functions/extract-youtube/pipeline/claude.ts` — 제목+설명+자막(≤12000자) → Claude → 장소(timestamp, source_quote, confidence) 추출. **프롬프트 + 출력 파싱 확장 지점.**
- `supabase/functions/extract-youtube/index.ts` — places upsert (unique board_id+google_place_id) / link 업데이트. **summary_ko 저장 배선 지점.**

### 스키마 (web/iOS/Edge 공유 — 변경 시 SQL과 짝)
- `packages/core/src/schemas/place.ts` — `summary_ko` optional 추가
- `packages/core/src/schemas/link.ts` — `summary_ko` optional 추가
- `packages/core/src/schemas/extraction.ts` — Claude 출력 계약(추출 결과 shape)에 summary 필드
- `packages/api/src/types/database.ts` — `pnpm supabase:types`로 **재생성** (수기 편집 금지; user-side)

### 마이그레이션 (append-only)
- `supabase/migrations/0008_extraction_summaries.sql` — **신규.** `places.summary_ko text`, `links.summary_ko text` 둘 다 nullable. 기존 파일 수정 금지.

### 웹 노출 (VIEW-08)
- 기존 공개 보드 페이지(`apps/web/app/b/[slug]/page.tsx`)와 `PublicBoardMap` — 장소 해설/영상 요약 조건부 렌더. (Phase 4 §1 UI 패턴·토큰 재사용)

### 설계 근거
- `docs/SESSION-NOTES-2026-06-07.md` §2 — 전체 설계 잠금
</canonical_refs>

<specifics>
## Specific Ideas / Constraints

- **Budget 유지:** 영상당 < $0.005 (출력 토큰만 소폭↑, 새 API 호출 없음).
- **컬럼 추가는 NULLABLE** (downtime 회피 — CLAUDE.md 4.3).
- **워크스페이스 import에 `.js` extension 금지** (Turbopack).
- **외부 입력은 Zod validate** — Claude 출력도 기존 파싱 패턴 따라 검증.
- **레거시 데이터:** summary_ko 없는 기존 places/links에서도 web 레이아웃 안 깨짐 (조건부 렌더 필수).

## Known Limitation (이번엔 수용)
한 장소가 여러 영상에 나오면 `places` upsert(unique board_id+google_place_id)로 해설이 덮어써짐. 멀티-영상 출처는 별도 테이블 필요하나 기존 단일 `source_quote` 패턴 따라가고 **나중 마이그레이션으로 미룸**. **새 테이블 임의 생성 금지** (surgical).
</specifics>

<deferred>
## Deferred Ideas
- 멀티-영상 장소 출처 별도 테이블 (덮어쓰기 해소) — 나중 마이그레이션
- 접근 B: `highlights[]`·태그 (nullable 추가형이라 계약 안 깨고 나중에 얹기 가능)
</deferred>

---

*Phase: 08-extraction-depth*
*Context gathered: 2026-06-07 — SESSION-NOTES §2 승격 (autonomous mode, discuss 생략)*
