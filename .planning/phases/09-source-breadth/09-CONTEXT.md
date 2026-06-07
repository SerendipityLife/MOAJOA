# Phase 9: 소스 넓이 (블로그·인스타) - Context

**Gathered:** 2026-06-08 (autonomous mode — discuss 생략, 코드 정찰 기반)
**Status:** Ready for research → planning
**Source:** SESSION-NOTES §1 (모으기 = ②③①, ① 소스 넓이 = "서버/Edge, 소스별 파서") + 코드베이스 정찰(아래 Evidence). 설계 미잠금 → research가 기술 접근 확정.

<domain>
## Phase Boundary

**IN:** 유튜브 추출 파이프라인을 **소스 일반화**하여 블로그/인스타 URL도 본문/캡션 텍스트를 추출해 **동일 Claude 추출(claude.ts)** 로 장소 + 한국어 해설(②의 `summary_ko` 계약)을 생성. 백엔드/Edge 중심.

**OUT (이 phase 아님):**
- 웹 투표 → Phase 10
- ② 해설 자체(이미 Phase 8) — 여기선 **재사용만**
- 새 UI 화면 (CLAUDE.md: 웹 새 생성/추가 UI 금지)
</domain>

<evidence>
## Codebase Evidence (정찰 결과 — 설계 근거)

1. **`links.source_kind`** 이미 `check in ('youtube','blog','instagram','manual')` (migration `0001_init.sql:227`). **새 마이그레이션 불필요** (스키마는 준비됨; Phase 8의 `summary_ko` 컬럼만 라이브 적용 필요 = 08-04 모닝 게이트에 의존).
2. **`detectSourceKind(url)`** 헬퍼가 `@moajoa/core`에 이미 존재 — hostname → `youtube`(youtube.com/youtu.be) | `instagram`(instagram.com) | `blog`(tistory/blog.naver/medium/brunch/velog) | `null`. **소스 감지 로직 재사용**.
3. **`addLink`** (@moajoa/api): insert 시 `source_kind = detectSourceKind(url) ?? 'manual'` 이미 스탬프. 링크 행은 올바른 source_kind로 저장됨.
4. **트리거 게이팅:** web `add-link-form`·iOS `boards/[id].tsx`·`pending.ts`는 `source_kind === 'youtube'`일 때만 `triggerExtraction` 호출. blog/insta는 현재 저장만 되고 "큐레이션 대기열" 안내만 뜸(자동 추출 안 함).
5. **Edge Function** `extract-youtube/index.ts`는 `{ link_id }`로 호출 → 링크 로드 → **`if (link.source_kind !== 'youtube') jsonError`** 로 거부. 파이프라인: normalize URL → fetch meta(oEmbed) → transcript → `extractCandidatesFromContext(claude.ts)` → Google Places resolve → places upsert.
6. **`extractCandidatesFromContext({ videoTitle, description, transcript, cityHint })`** 는 텍스트 컨텍스트만 받음 — 블로그 본문을 `transcript` 자리에 넣으면 그대로 재사용 가능(프롬프트 문구만 소스에 맞게 보정 여지).
</evidence>

<decisions>
## Implementation Decisions (autonomous — 추천 선택, AUTONOMOUS-LOG에 기록)

### A. 소스 어댑터 패턴 (Edge Function 일반화)
- `extract-youtube/index.ts`의 youtube 전용 게이트를 **source-router**로 교체: `link.source_kind`로 분기 → 소스별 "텍스트 어댑터"가 `{ title, bodyText, thumbnail?, author? }` 정규화 → **동일** `extractCandidatesFromContext` + Google Places resolve + places upsert (변경 최소).
- youtube 경로는 **기존 그대로**(회귀 0). blog/insta는 새 어댑터.

### B. 함수 이름 유지 (`extract-youtube`)
- 배포된 함수명을 바꾸면 클라이언트 `functions.invoke('extract-youtube')` 계약이 깨짐(되돌리기 어려움). **이름 유지**, 내부만 일반 추출기로 확장. (향후 alias rename은 별도.) → reversible.

### C. 블로그 어댑터 (SRC-01) — 자동, 테스트 가능
- 서버사이드 `fetch(url)` → HTML → 본문 텍스트 추출(readability류) + `og:title`/`og:image`/author 메타. Tistory/velog/brunch/medium은 비교적 정적. **네이버 블로그는 iframe(`PostView`) 이슈** → research가 fetch 전략 확정.
- 추출 텍스트를 claude.ts에 공급 → 장소+`summary_ko` 생성.

### D. 인스타 어댑터 (SRC-02) — graceful 우선
- 무인증 IG 캡션 fetch는 불안정/ToS 리스크. **추천: graceful-failure 경로 우선 구현**(SRC-02의 "추출 불가 소스는 명시적 실패 사유 반환" 충족) + 가능하면 best-effort oEmbed/메타. 견고한 IG는 Graph API 토큰 필요 → 모닝/추후 결정 플래그.

### E. 클라이언트 트리거
- **web dev-tool**(add-link-form, `isDevToolsEnabled` 게이트): blog/insta도 `triggerExtraction` 하도록 게이트 확장 + 안내문구 수정. (새 UI 아님, reversible, build 검증 가능) — autonomous.
- **iOS 트리거 확장 + 실제 blog/insta 라이브 추출 = 모닝 게이트(autonomous:false)**: iOS는 실기기 검증 필요, 라이브 fetch는 네트워크+스팟체크 필요. 오버나잇 미검증 iOS 코드는 안 보냄.

## Claude's Discretion (research/planner 확정)
- Deno에서 블로그 본문 추출 구체 방법(라이브러리 vs 수동 파싱), 네이버 iframe 처리.
- claude.ts 프롬프트에 source-kind별 문구 보정 여부(자막↔본문↔캡션).
- IG 실현 가능 범위.
</decisions>

<canonical_refs>
- `supabase/functions/extract-youtube/index.ts` — source-router 도입 지점(L88~ youtube 게이트)
- `supabase/functions/extract-youtube/pipeline/youtube.ts` — youtube 어댑터(분리/패턴 참고). 신규 `pipeline/blog.ts`, `pipeline/instagram.ts` 어댑터 추가 예상
- `supabase/functions/extract-youtube/pipeline/claude.ts` — **재사용**(Phase 8에서 summary_ko 확장됨), 프롬프트 소스 보정 여지
- `packages/core` `detectSourceKind` — 소스 감지 재사용
- `apps/web/app/boards/[id]/_components/add-link-form.tsx` — dev-tool 트리거 게이트 확장(youtube→blog/insta)
- `apps/ios/app/boards/[id].tsx`, `apps/ios/lib/pending.ts` — iOS 트리거(모닝 게이트)
- `docs/SESSION-NOTES-2026-06-07.md` §1
</canonical_refs>

<constraints>
- **새 마이그레이션 불필요**(source_kind 기존). Phase 8 `summary_ko` 컬럼 라이브 적용(08-04)이 선행돼야 blog 추출 summary 저장됨 → 라이브 검증은 08-04 이후.
- youtube 경로 회귀 0 (기존 deno test 통과 유지).
- 외부 fetch는 timeout·실패 graceful(추출 status=failed + 명시적 사유). `.js` import 금지.
- Zod로 어댑터 출력 검증.
</constraints>

<deferred>
- iOS 트리거 확장 + 실기기 검증 (모닝 게이트)
- 라이브 blog/insta 추출 스팟체크 (08-04 이후, 모닝)
- 견고한 Instagram(Graph API 토큰) — graceful 경로로 우선 충족, 풀 지원은 추후
</deferred>

---
*Phase: 09-source-breadth*
*Context: 2026-06-08 autonomous, 코드 정찰 기반*
