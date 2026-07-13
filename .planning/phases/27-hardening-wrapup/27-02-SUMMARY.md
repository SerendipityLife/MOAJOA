---
phase: 27-hardening-wrapup
plan: 02
subsystem: web-copy-docs
tags: [NAME-01, copy-sweep, docs, v2.1-pivot]
requires:
  - phase: 25-guest-surface
    provides: "/t/[slug] guest-surface·page.tsx (찜 스윕 대상 표면)"
provides:
  - "라이브 유저 대면 표면 '가고싶어'→'찜' 잔여 0 (vote-island dead code·개발자 주석 제외)"
  - "docs/WORKSTREAMS.md·ARCHITECTURE.md v2.1 현행 역할 기술 (웹=입력·저장·편집 풀 서피스, iOS=전면 동결)"
affects: [27-uat, verify-work]
tech-stack:
  added: []
  patterns:
    - "카피 치환 시 코드 식별자(data-testid·onClick) 무접촉 — aria-label·텍스트 노드만 (T-27-06)"
    - "docs 구 할 일은 ~~취소선~~+사유 한 줄로 역사 보존 (통째 삭제 회피)"
key-files:
  created: []
  modified:
    - apps/web/app/t/[slug]/_components/guest-surface.tsx
    - apps/web/app/t/[slug]/page.tsx
    - docs/WORKSTREAMS.md
    - docs/ARCHITECTURE.md
decisions:
  - "page.tsx 안내 문구 조사 정합: '가고싶어!를'→'찜을' (RESEARCH Open Q2 확정, 뒷문장 무변경)"
  - "WORKSTREAMS §2 구 할 일 4항목 취소선+대체 사유 표기 — /t/[slug]·onboarding 위저드·add-sheet 현행 라우트 기준"
  - "ARCHITECTURE data flow 기점 iOS Share Sheet→웹(/onboarding·/moa add-sheet), board_id→trip_id, /b/<slug>→/t/[slug], trip editor(can_edit_trip) 어휘 갱신 — 흐름 구조 유지"
metrics:
  duration: "~4분"
  completed: "2026-07-14"
  tasks: 2
  tests: "web 267/267 그린 (기준선 일치, 단언 변경 0)"
---

# Phase 27 Plan 02: NAME-01 카피 스윕 완성 + 문서 마감 Summary

**One-liner:** 라이브 게스트 표면 "가고싶어"→"찜" 3곳 치환(테스트 동커밋 267 그린) + WORKSTREAMS·ARCHITECTURE를 v2.1 웹 퍼스트 현행(웹=풀 서피스, iOS=동결)으로 갱신.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 가고싶어→찜 라이브 표면 치환 (2파일 3곳) + 전수 grep + 테스트 동커밋 | fcccf41 | guest-surface.tsx, page.tsx |
| 2 | WORKSTREAMS·ARCHITECTURE 역할 기술 v2.1 갱신 | b92647a | docs/WORKSTREAMS.md, docs/ARCHITECTURE.md |

## What Was Done

### Task 1 — 카피 스윕 (NAME-01)
- **guest-surface.tsx L319:** `aria-label="가고싶어"` → `aria-label="찜"` (스크린리더 유저 대면). `data-testid="guest-vote-..."`·`onClick={openGate}` 무변경 (T-27-06 mitigate 확인 — diff 3줄만).
- **guest-surface.tsx L325:** 하트 버튼 텍스트 노드 `가고싶어` → `찜` (Heart 아이콘·count span·className 무변경).
- **page.tsx L115:** SSR 초대 카드 `가고싶어!를 눌러주세요` → `찜을 눌러주세요` (조사 를→을 받침 정합).
- **D-05 실측 일치:** `apps/web/__tests__` 내 "가고싶어" 히트 0 (vote-island 제외) → 테스트 단언 변경 0. 같은 커밋에서 web 267/267 그린.
- **전수 grep:** 라이브 tsx "가고싶어" 잔여 0 (vote-island dead code·map-section 주석 제외, D-04/D-06). "보드" 라이브 잔여 0 재확인 (클립보드·대시보드·vote-island 제외).

### Task 2 — docs v2.1 갱신 (재량 항목)
- **WORKSTREAMS §2:** 헤딩 `공개 보드 열람` → `입력·저장·편집 풀 서피스`. 상태 문장에 Phase 23 피봇 + 현행 라우트 4종(`/onboarding`·`/moa/[id]`·`/t/[slug]`·`/poll/[code]`) 명시. 구 할 일 4항목(`/b/[slug]` 폴리시·`/boards` 목록·dev-tools 격리·협업 UI)은 취소선+대체 사유 한 줄로 역사 보존. `/discover`만 현행 유지.
- **WORKSTREAMS §1 iOS:** 상태 아래 blockquote 콜아웃 — "v2.1 웹 퍼스트 동안 iOS 전면 동결 (Phase 23 피봇), 트립 4탭은 v2.0 산출물".
- **ARCHITECTURE:** 헤딩 `Web (열람), iOS (저장)` → `Web (입력·저장·편집 풀 서피스), iOS (v2.1 동결)` + 피봇 불릿 추가, Share Extension 불릿에 동결 부기. Data flow 2개 어휘 갱신 — 기점 `[iOS] Share Sheet` → `[Web] /onboarding 위저드·/moa add-sheet`, `board_id`→`trip_id`, `/b/<slug>`→`/t/[slug]`, `boards.share_slug`→`trips.share_slug`, RLS 문구 `board editor`→`trip editor (can_edit_trip)`. 흐름 구조 자체는 유지.
- **무접촉 확인:** CLAUDE.md·`.planning/`·코드 파일·Security model RLS 표(범위 외) 미수정. CLAUDE.md §4.1·§5 기준 어휘와 정합 (Pitfall 7).

## Verification Results

- `grep -rn "가고싶어" apps/web --include="*.tsx" | grep -v vote-island | grep -v map-section` → 0줄 PASS
- `aria-label="찜"` count 1 · `guest-vote-` testid 유지 1 · page.tsx "찜" 존재 PASS
- "보드" 라이브 잔여 0 PASS
- `pnpm --filter @moajoa/web test:run` → **267/267 그린** (기준선 267 일치)
- docs automated verify (입력·저장·편집 ×2 · 전면 동결 · board_id/`/b/<slug>` 0건 · 열람·공유 랜딩 0건 · Web (열람) 0건 · trip_id 2건) → 전종 PASS
- `git diff --stat apps/ios packages supabase` → 0파일 (surgical 확인)

## Deviations from Plan

None - plan executed exactly as written. (D-05 예측대로 테스트 단언 변경 0 — 동기화 불필요.)

## Known Stubs

None — 카피·문서 텍스트 변경만, 신규 컴포넌트·데이터 경로 0.

## Success Criteria Status

- **SC-2 충족:** 유저 대면 카피 보드→모아(잔여 0 재확인)·가고싶어→찜 완료, 테스트 동커밋 그린, 코드 식별자(love·vote·guest-vote testid) 유지
- **문서 정합:** WORKSTREAMS·ARCHITECTURE가 CLAUDE.md §4.1·§5 현행 서술과 일치 (Pitfall 7)
- **D-06 유지:** vote-island.tsx·vote-island.test.tsx 무접촉 (dead code deferred 항목 유지)

## Self-Check: PASSED

- 파일 4종 + SUMMARY 존재 확인
- 커밋 fcccf41·b92647a git log 존재 확인
