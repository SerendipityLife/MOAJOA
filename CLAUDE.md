# CLAUDE.md — MOAJOA

> 이 파일은 Claude Code(또는 호환 AI 코딩 에이전트) 세션의 행동 지침이에요.
> 매 세션 시작 시 자동으로 로딩됩니다. 변경할 일 있으면 PR로.

---

## 1. 프로젝트 한 줄

**MOAJOA**: 유튜브·블로그·인스타 링크를 던지면 영상 속 장소를 자동으로 추출해 지도 보드로 만들고, 친구와 공유해 같이 투표·결정하는 도구.

- **현재 상태:** 2026-05-24 피봇 시작 (Flutter ASIS → TypeScript 모노레포)
- **본 레포:** TS + Next.js + Expo + Supabase 새 스택
- **이전 코드:** `_archive_asis/` (gitignored 로컬 백업) · 원격은 [`SerendipityLife/MOAJOA_ASIS`](https://github.com/SerendipityLife/MOAJOA_ASIS)

자세한 컨셉·아키텍처: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
현재 상태·트랙별 할 일: [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md)

---

## 2. 개발 워크플로우 — GSD를 사용한다

이 프로젝트는 [GSD (Get Shit Done) Redux](https://github.com/open-gsd/get-shit-done-redux) 스펙 주도 워크플로우를 따른다. **사소한 task가 아니면 GSD 명령을 거쳐서 진행한다.**

### 어떤 명령을 언제 쓰나

| 상황 | 명령 |
|---|---|
| 새 프로젝트 첫 셋업 (이미 완료됨) | `/gsd-new-project` |
| **이미 있는 코드에 새 기능 추가하기 전** — 먼저 코드베이스 인덱스화 | `/gsd-map-codebase` |
| 새 마일스톤 시작 (예: v0.2 협업 보드) | `/gsd-new-milestone` |
| Phase 시작 전 — 회색지대(레이아웃·API·에러처리) 결정 | `/gsd-discuss-phase <N>` |
| 결정사항 기반 plan 작성 + 검증 루프 | `/gsd-plan-phase <N>` |
| Plan 실행 (wave 병렬화 + atomic commit) | `/gsd-execute-phase <N>` |
| 자유 입력을 자동으로 적절한 GSD 명령으로 라우팅 | `/gsd-do "<문장>"` |
| 다음 논리적 단계로 자동 진행 | `/gsd-next` |
| 사소한 수정 (GSD overhead 생략) | `/gsd-quick` 또는 `/gsd-fast` |
| 진행 상황 확인 | `/gsd-progress` |
| 작업 멈출 때 컨텍스트 보존 | `/gsd-pause-work` |
| 다음 세션에서 이어할 때 | `/gsd-resume-work` |

### 트리비얼이 아닌 작업의 기본 흐름

```
/gsd-discuss-phase N   →  결정 잠그기 (회색지대 명확화)
       ↓
/gsd-plan-phase N      →  실행 가능한 plan 생성 + 검증
       ↓
/gsd-execute-phase N   →  atomic commit으로 실행
       ↓
/gsd-verify-work       →  UAT 검증
       ↓
/gsd-ship              →  PR 만들고 머지 준비
```

### Plan 승인 게이트

`/gsd-plan-phase`가 만든 plan을 사용자가 **명시적으로 승인하기 전에는 코드를 쓰지 않는다.** 사용자가 "초기 스캐폴드는 bypass" 같이 명시적으로 bypass를 허락한 경우만 예외.

---

## 3. 코딩 원칙 — Karpathy 4

> [Andrej Karpathy의 LLM 코딩 함정 관찰](https://x.com/karpathy/status/2015883857489522876)에 기반.
> 영문 원본 표현이 LLM 행동 유도에 잘 작동해서 영문 그대로 둠. 한국어 요약은 보조.

### 3.1 Think Before Coding — 가정하지 말고, 헷갈리면 멈춰라

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- **State your assumptions explicitly.** If uncertain, ask.
- **If multiple interpretations exist, present them** — don't pick silently.
- **If a simpler approach exists, say so.** Push back when warranted.
- **If something is unclear, stop.** Name what's confusing. Ask.

→ 한 줄 요약: "사용자가 명시 안 한 걸 임의로 결정해서 진행하지 말 것. 모호함을 발견하면 1초라도 멈추고 물어볼 것."

### 3.2 Simplicity First — 요청된 것만, 그 이상은 X

**Minimum code that solves the problem. Nothing speculative.**

- **No features beyond what was asked.**
- **No abstractions for single-use code.**
- **No "flexibility" or "configurability" that wasn't requested.**
- **No error handling for impossible scenarios.**
- **If you write 200 lines and it could be 50, rewrite it.**

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

→ 한 줄 요약: 요청 범위 외 기능·추상화·"미래를 위한 유연성" 절대 추가 X. 비슷한 코드 3줄은 추상화보다 낫다.

### 3.3 Surgical Changes — 손댄 것만 바꿔라

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- **Don't "improve" adjacent code**, comments, or formatting.
- **Don't refactor things that aren't broken.**
- **Match existing style**, even if you'd do it differently.
- **If you notice unrelated dead code, mention it** — don't delete it.

When your changes create orphans:
- **Remove imports/variables/functions that YOUR changes made unused.**
- **Don't remove pre-existing dead code unless asked.**

**The test:** Every changed line should trace directly to the user's request.

→ 한 줄 요약: 사용자가 요청 안 한 줄을 diff에 넣지 말 것. 옆에 있는 코드 정리하고 싶어도 참고, 별도 PR로 제안만.

### 3.4 Goal-Driven Execution — 검증 가능한 목표로 변환

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

→ 한 줄 요약: "고쳤어요"보다 "X가 통과합니다"라고 말할 수 있게. 검증 못 하면 끝난 거 아님.

### 잘 작동하고 있다는 신호

- diff에 불필요한 변경이 줄어든다
- 과복잡화로 재작성하는 일이 줄어든다
- 구현 후가 아니라 **구현 전에** 명확화 질문이 온다

---

## 4. MOAJOA 프로젝트 컨벤션

### 4.1 모노레포 구조

```
moajoa/
├── apps/
│   ├── web/           Next.js 15 (열람·공개 보드)
│   └── ios/           Expo SDK 54 (저장·공유·투표) — local build 보류 중
├── packages/
│   ├── core/          Zod 스키마 + 도메인 상수 (web/iOS/Edge 공유)
│   ├── api/           Supabase 클라이언트 + 타입드 쿼리
│   └── ui-tokens/     디자인 토큰 (색·간격·타이포)
├── supabase/
│   ├── migrations/    SQL (append-only, 새 번호만 추가)
│   ├── functions/     Edge Functions (Deno runtime)
│   └── config.toml
└── docs/              ARCHITECTURE · WORKSTREAMS · SESSION-NOTES
```

### 4.2 충돌 위험 영역 (변경 전 합의 필요)

| 경로 | 변경 시 영향 |
|---|---|
| `packages/core/schemas/*` | Web + iOS + Edge Function 모두 영향. **SQL 마이그레이션과 짝지어 변경** |
| `packages/core/constants.ts` | 도메인 한도·enum. 모든 클라이언트가 import |
| `packages/ui-tokens/*` | Web Tailwind + iOS NativeWind 둘 다 시각 영향 |
| `supabase/migrations/*` | **Append-only**. 기존 파일 수정 금지. 새 번호 파일만 추가 |

### 4.3 마이그레이션 규칙

- 새 마이그레이션은 `supabase/migrations/NNNN_short_name.sql` 형식 (NNNN은 단조 증가)
- **기존 마이그레이션 SQL 수정 금지** — 한 번 prod에 적용되면 영구
- 컬럼 추가는 NULLABLE 또는 DEFAULT 있게 (downtime 회피)
- RLS 정책 변경 시: SECURITY DEFINER 헬퍼 함수로 사이클 끊기 (이미 0002에서 한 패턴)
- 배포: `supabase db push` (link 된 프로젝트로) 또는 PR review 후 머지 → CI에서 push (CI 미설정)
- 변경 후 항상: `pnpm supabase:types` → `packages/api/src/types/database.ts` 재생성

### 4.4 인증·RLS

- 클라이언트는 익명 키만 사용 (`SUPABASE_ANON_KEY`). 서비스 롤은 Edge Function 안에서만
- RLS는 **deny-by-default** — 모든 테이블에 정책 명시
- 크로스 테이블 정책은 SECURITY DEFINER 헬퍼 함수로 (재귀 회피)
- `auth.uid()`를 직접 비교하는 것만 안전. JOIN은 항상 헬퍼 함수 통해

### 4.5 코드 스타일

- TypeScript strict
- Prettier 적용 (`.prettierrc`)
- 워크스페이스 패키지 import 시 **`.js` extension 쓰지 말 것** (Turbopack 호환)
  - ✅ `import { foo } from './bar'`
  - ❌ `import { foo } from './bar.js'`
- 외부 입력은 항상 Zod로 validate (`@moajoa/core/schemas`)
- 주석은 *why*를 적기, *what*은 코드로 표현

### 4.6 Git

- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- PR 라벨: 워크스트림 (`iOS`, `Web`, `Backend`, `Design`, `Auth`)
- 마이그레이션 변경 시 PR description에 `BREAKING DB CHANGE` 명시
- `.env.local` 절대 commit 금지 — 이미 `.gitignore`에 등록되어 있음

### 4.7 환경변수

- placeholder: `.env.local.example` (각 디렉토리 — root, apps/web, apps/ios, supabase)
- 실제 값: 1Password/노션 비밀 페이지 등 안전한 곳. 슬랙 직접 붙여넣기 X.

---

## 5. 절대 하지 말 것 (이번 프로젝트 특정)

- ❌ `_archive_asis/` 안의 파일 수정 — 아카이브만 사용
- ❌ Flutter 코드 참조 / Dart 패키지 추가
- ❌ Firebase / Firestore 새로 도입 — Supabase로 통일
- ❌ 기존 마이그레이션 SQL 수정 (한 번 prod 적용되면 영구)
- ❌ 워크스페이스 패키지 import에 `.js` extension 추가
- ❌ Web에 *새로운* "보드 생성"·"링크 추가" UI 추가 — 그건 iOS 전용
  (현재 web에 있는 폼은 임시 dev tool. Phase 1.5에 정리할 예정.)
- ❌ RLS 정책에서 다른 테이블 직접 EXISTS — SECURITY DEFINER 헬퍼 경유
- ❌ 서비스 롤 키를 클라이언트 번들에 노출
- ❌ `.env.local` 커밋
- ❌ 작업 시작 전 `/gsd-discuss-phase` 또는 `/gsd-quick` 없이 코드 작성 (trivial fix 제외)

---

## 6. 세션 시작 시 권장 패턴

1. **`/gsd-progress`** — 현재 상태·다음 할 일 확인
2. **`/gsd-resume-work`** — 이전 세션 컨텍스트 복원 (있다면)
3. 그게 아니라면 — `docs/SESSION-NOTES-*.md` 가장 최신 거 읽기
4. 작업 시작 — `/gsd-do "<할 일>"` 또는 `/gsd-discuss-phase N`

---

## 7. 메모리·컨텍스트 관리

- 세션이 길어지면 컨텍스트가 부패한다 (context rot). GSD는 phase별로 fresh 컨텍스트에서 plan 실행하는 패턴을 갖고 있음.
- 결정사항은 항상 `.planning/` 디렉토리(GSD 자동 생성) 또는 `docs/SESSION-NOTES-<date>.md`에 기록.
- 한 phase 끝나면 `/gsd-extract_learnings`로 패턴·결정·실수 추출해서 보존.

---

## 8. 빠진 게 있을 때

- 코드 안 보임 → `/gsd-map-codebase`로 인덱스
- 의도 모름 → `/gsd-discuss-phase` 또는 직접 질문
- 의존성 모름 → `/gsd-analyze-dependencies`
- 도와줘 → `/gsd-help`

---

**버전:** 2026-05-25 초안. 팀 합류 후 합의되는 컨벤션 추가될 예정.
