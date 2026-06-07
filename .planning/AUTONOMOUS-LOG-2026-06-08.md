# Autonomous Run Log — v1.1 (추출 고도화 + 협업)

**Mandate:** 사용자가 2026-06-07 밤 위임. "내일(6/8) 아침 7시까지 마일스톤 개발을 자동으로 이어서 진행. 대답이 필요한 부분은 추천 선택지로 자동 선택하되 무엇을 골랐는지 남길 것."

**Operating rules (this run):**
- 모든 GSD 게이트 = **추천(recommended) 기본값** 자동 선택. 여기에 결정·근거 기록.
- 되돌리기 어렵거나 외부 계정/실기기/prod가 필요한 작업은 **실행하지 않고** "Morning to-dos"에 기록 (추측으로 destructive 실행 금지).
- 모든 산출물은 git에 atomic commit. 컨텍스트는 `.planning/`에 영속 → `claude remote-control` 세션이 `/gsd-resume-work`로 이어받음.
- **Stop:** 2026-06-08 07:00 또는 마일스톤 완료 또는 진짜 블로커.

**Source of truth for milestone design:** `docs/SESSION-NOTES-2026-06-07.md` (§2 = ② 설계 잠금, §3 = 웹 범위, §4 = 라우팅).

---

## Decisions (auto-selected)

| # | 시각 | 게이트/질문 | 선택 | 근거 |
|---|------|------------|------|------|
| D1 | 06-07 night | ③ 캡처마찰(Share Extension) v1.1 포함? | **제외** | 사용자가 "추천방향" 위임. §4 라우팅이 v1.1=②+①+투표로 명시. ③ config는 v1 Phase 3(03-02) 완료, 남은 실기기 스모크는 도그푸딩 UAT와 동반. ②·①과 직교라 나중 삽입 무코스트. |
| D2 | 06-07 night | 마일스톤 버전 | **v1.1** | SESSION-NOTES "다음 스텝"에 명시. v1 위에 증분. |
| D3 | 06-07 night | v1.0 미완(도그푸딩) 처리 | **archive 안 함 / complete-milestone 안 돌림 / phase 번호 8부터 이어감** | §4: 도그푸딩 의도적 병행·나중. v1 phase 1~7 작업 보존, 번호 충돌 없음(continue numbering). |
| D4 | 06-07 night | 마일스톤 레벨 도메인 리서치(new-milestone Step 8) | **SKIP** | ② 설계가 §2에 잠겨 있음. per-phase 리서치(config.workflow.research=true)는 /gsd-plan-phase에서 유지되므로 손실 없음. |
| D5 | 06-07 night | v1.1 요구사항 REQ-ID | **신규 EXTRACT-12/13/14, VIEW-08, SRC-01/02 + COLLAB-01/02 승격** | 기존 v2-defer의 COLLAB-01/02를 v1.1로 승격. 해설(②)은 신규 EXTRACT-12+. ①은 신규 SRC 카테고리(기존 EXTRACT-10 manual-queue와 구분 — v1.1은 자동 추출). |
| D6 | 06-07 night | 로드맵 granularity | **3 phases (패딩 없음)** | gsd-roadmapper 추천. 좁은 증분 마일스톤이 ②/①/투표 3개 자연 경계로 떨어짐. 8→9 의존, 10 독립. |
| D7 | 06-07 night | REQUIREMENTS.md L5 헤더(`Milestone: v1`) | **v1.1 active로 갱신 (surgical)** | roadmapper가 flag. doc이 이제 v1+v1.1 포함하므로 헤더만 최소 수정. |
| D8 | 06-07 night | Phase 8 discuss-phase | **생략 → plan 직행** | 설계가 SESSION-NOTES §2 + ROADMAP "Design lock"에 이미 잠김. 회색지대 적음 → /gsd-plan-phase 8로 직행 (per-phase research는 plan 단계에서 유지). |
| D9 | 06-08 | Phase 8 standalone 리서치(gsd-phase-researcher) | **생략** | 설계 §2 잠금 + gsd-pattern-mapper가 코드베이스 analog(claude.ts·schemas·migration·web) 정확히 매핑 → 별도 RESEARCH.md 불필요. §2를 08-CONTEXT.md로 승격해 파이프라인에 공급. |
| D10 | 06-08 | Phase 8 UI-SPEC(gsd-ui-phase) | **생략** | VIEW-08은 기존 공개보드 페이지에 조건부 해설 텍스트 블록 추가(새 화면 X, 새 생성/추가 UI X). planner가 PATTERNS 기반 인라인 명세(링크카드 토큰 재사용) → 별도 UI-SPEC ceremony 과함. |
| D11 | 06-08 | Phase 8 plan 구조 | **4 plans / 3 waves 승인** | gsd-plan-checker VERIFICATION PASSED (4-link 웹 체인 닫힘, 4 REQ-ID 커버, CLAUDE.md 준수). 08-04 = autonomous:false 모닝 게이트. |

| D12 | 06-08 | Phase 9 아키텍처 | **source-adapter 패턴** (Edge Function 일반화: youtube 게이트→source-router, 소스별 텍스트 어댑터 → 동일 claude.ts 재사용) | 정찰: `source_kind`·`detectSourceKind` 이미 존재, `extractCandidatesFromContext`는 텍스트만 받음 → 최소 변경으로 일반화. youtube 회귀 0. |
| D13 | 06-08 | Edge Function 이름 | **`extract-youtube` 유지** | rename은 클라 `functions.invoke('extract-youtube')` 계약 깸(되돌리기 어려움). 내부만 일반 추출기로 확장 = reversible. |
| D14 | 06-08 | 인스타(SRC-02) 범위 | **graceful-failure 우선** + best-effort | 무인증 IG 캡션 fetch 불안정/ToS 리스크. SRC-02 자체가 "추출 불가 소스는 명시적 실패 사유" 허용. 견고한 IG는 Graph API 토큰 → 추후. 블로그(SRC-01)는 풀 구현. |
| D15 | 06-08 | 클라이언트 트리거 | **web dev-tool만 자동 확장 · iOS는 모닝 게이트** | web add-link은 dev-tool(저위험, build 검증가능). iOS 트리거+라이브 추출은 실기기/네트워크 검증 필요 → 미검증 iOS 코드 안 보냄(autonomous:false). |
| D16 | 06-08 | Phase 9 마이그레이션 | **불필요** | `source_kind` enum 기존(0001). Phase 8 `summary_ko` 컬럼 라이브 적용(08-04)이 선행돼야 blog 추출 summary 저장 → 라이브 검증은 08-04 이후. |
| D17 | 06-08 | Phase 9 research | **실행** | 설계 미잠금(Phase 8과 다름) → research가 추천 기본값. Deno 블로그 본문 추출·네이버 iframe·IG 실현가능성 확정. |

| D18 | 06-08 | Phase 9 pattern-mapper | **생략** | analog이 `youtube.ts` 단일·명확 + 09-RESEARCH가 구조/임포트 커버. planner가 youtube.ts 직접 읽음. |
| D19 | 06-08 | Phase 9 plan 구조 | **5 plans / 4 waves 승인** | gsd-plan-checker VERIFICATION PASSED (0 blocker). SSRF 가드, youtube 회귀-0 스냅샷, 마이그레이션 없음, IG graceful. 09-05(iOS+라이브)=autonomous:false 모닝 게이트. |
| D20 | 06-08 | checker 2 warnings | **실행 시 inline 반영** | W1: claude.ts SYSTEM_PROMPT는 모든 sourceKind에 byte-identical 유지(executor가 '개선' 못 하게 가드; source_timestamp_sec optional이라 blog 타임스탬프 미포함 무해). W2: blog 분기 description='' → article excerpt 매핑(긴 글 recall, RESEARCH Pitfall 5). |

| D21 | 06-08 | Phase 10 인증 모델 (회색지대) | **로그인 멤버만 투표 (익명 X)** | RLS/트리거가 `auth.uid()` 의존, 익명은 중복표/어뷰즈. 흐름: 공유링크→로그인→자가참여→투표. 기존 web auth 재사용. |
| D22 | 06-08 | 자가참여 (COLLAB-01) | **slug = bearer 초대 → SECURITY DEFINER RPC `join_shared_board`, role='voter'** | 기존 membership insert는 owner만 → 자가참여 RPC 필요. 친구 여행 공유 모델 = slug 소지가 초대. 새 마이그레이션 0009(적용=모닝). |
| D23 | 06-08 | 투표 표면 (COLLAB-02) | **기존 `/b/[slug]`에 클라 island** | 단일 공유 URL + 공개 SSR 캐시 유지(새 라우트 X). 투표 affordance는 브라우저 세션 확인 클라 컴포넌트로 하이드레이트. |
| D24 | 06-08 | Phase 10 범위 인식 | **백엔드 대부분 기존 재사용** | votes RLS·`can_vote_board`·`castVote/retractVote/getVoteCounts`·`isPlaceConfirmed` 전부 존재 → Phase 10 = 자가참여 RPC + api 헬퍼 + 웹 island가 핵심(스코프 축소). |
| D25 | 06-08 | Phase 10 research·UI-SPEC | **생략** | 백엔드 존재 + Next 클라 island 패턴 알려짐(retry-extraction-button analog) + pattern-mapper가 grounding. 투표 UI는 기존 토큰 재사용 → 별도 ceremony 불필요. |
| D26 | 06-08 | CLAUDE.md 웹 역할 갱신 | **모닝 게이트(자동 편집 X)** | SESSION-NOTES §3 사전지정 diff(web=열람+투표, 하드룰 유지)지만 거버넌스 문서라 추측 자동편집 대신 추천 diff를 Morning to-dos에 제시→사용자 적용. |

*(이후 결정은 아래에 계속 append)*

---

## Phase order (planned)

1. **Phase 8 — ② 추출 깊이 (commentary)** · EXTRACT-12/13/14 + VIEW-08 · 최우선·저위험·설계잠금
2. **Phase 9 — ① 소스 넓이 (blog/insta)** · SRC-01/02 · ②의 출력 계약 재사용
3. **Phase 10 — 웹 투표 (협업)** · COLLAB-01/02 · 웹 무설치 참여

---

## Morning to-dos (user-side gates — 자동 실행 불가)

> 자동으로 못 하는 것들. 아침에 사용자가 처리.

### Phase 8 (08-04 — autonomous:false BLOCKING gate)
- [ ] `supabase db push` — 마이그레이션 `0008_extraction_summaries.sql` 적용 (SUPABASE_ACCESS_TOKEN/linked project 필요. 이 세션엔 미인증)
- [ ] `pnpm supabase:types` → `packages/api/src/types/database.ts` 재생성 (08-04에 wc -l 가드 + git checkout 복구 절차 명시됨)
- [ ] **라이브 스팟체크:** 자막 풍부한 여행 영상 1개 추출 → 각 장소 비어있지 않은 `summary_ko` + 링크 `summary_ko` 확인, **환각 없음** 스팟체크 (ROADMAP 성공기준 1·2)
- [ ] 자막 빈약 영상 1개 → 해설 짧/빈 채로 추출은 성공 (성공기준 3, EXTRACT-14)
- [ ] 웹 공개 보드에서 해설/요약 노출 + 레거시(summary 없는) 보드 레이아웃 안 깨짐 확인 (성공기준 4, VIEW-08)

### Phase 9 (09-05 — autonomous:false, deps 08-04)
- [ ] **iOS 트리거 확장:** `apps/ios/app/boards/[id].tsx`·`lib/pending.ts`의 youtube-only 트리거를 blog/insta까지 확장 (09-05 PLAN). 실기기 검증 필요.
- [ ] **라이브 blog 추출 스팟체크:** 실제 블로그(티스토리/velog/네이버) URL 1~2개 → 본문 추출 → 장소+`summary_ko` 생성 확인. 네이버 PostView가 hosted Edge에서 차단되면 graceful-fail로 후퇴(연구 Open Q1).
- [ ] **인스타 확인:** IG URL → 명시적 실패 사유 반환(never ready) 확인 (SRC-02).

### 기타 (선택, Phase 8과 무관)
- [ ] **pre-existing 실패:** `apps/web/__tests__/marker-svg.test.ts` 5개 실패 — Phase 5는 `#0F172A` 기대인데 이후 `feat(ui)` 팔레트 변경이 `#111827` 방출. Phase 8과 독립(검증됨). 테스트 기대값 또는 토큰 정합 필요. 상세 `.planning/phases/08-extraction-depth/deferred-items.md`.

---

## Progress timeline

- **2026-06-07 night** — 자동 모드 진입. 마일스톤 스캐폴딩 시작(PROJECT.md·REQUIREMENTS.md·decision log).
- **2026-06-07 night** — 스캐폴딩 커밋 `4764464`. gsd-roadmapper로 v1.1 로드맵 생성: Phase 8(② 추출 깊이)·9(① 소스 넓이)·10(웹 투표). STATE → Phase 8, v1.0 history archived. 다음: Phase 8 plan.
- **2026-06-08 (자정 무렵)** — Phase 8: 08-CONTEXT 승격(커밋 후) → pattern-mapper(08-PATTERNS, 4-link 웹 체인 발견) → planner(4 plans/3 waves) → plan-checker **VERIFICATION PASSED**. 다음: Wave 1·2 자동 실행 (08-01 → 08-02∥08-03), 08-04는 모닝 게이트.
- **2026-06-08** — Phase 8 Wave 1·2 실행 완료: 08-01(foundation `91fcb69`/`307f4de`/`c347837`) → 08-02(backend `4443bb6`/`0100086`, deno 11/11) → 08-03(web `7889a4a`/`db01535`/`16bd93c`, vitest 4/4). tsc·build green, 0 regression. **Phase 8 code-complete.** 08-04(db push+types+라이브)는 모닝 게이트. 다음: Phase 9.
- **2026-06-08 (새벽)** — Phase 9 자동 waves 완료: 09-01(SSRF+IG graceful+claude sourceKind `36214bb`/`8402be2`/`529549b`) → 09-02(blog.ts `33185ac`/`138ad1a`) → 09-03(router `2aa5847`, youtube 회귀0) → 09-04(web trigger `784b138`). deno 36/36·web build green. **Phase 9 code-complete.** 09-05(iOS+라이브)=모닝 게이트. 다음: Phase 10(웹 투표).
