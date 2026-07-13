---
phase: 27-hardening-wrapup
plan: 03
subtitle: 배포 + 통합 UAT 문서 + 라이브 게이트 실증
status: complete
completed: 2026-07-13
requirements: [SEC-01, NAME-01]
commits:
  - ee6db31: "docs(27-03): create integrated UAT checklist — SC-3 + Phase 25/28 residuals + presence (D-07)"
  - e18c2b4: "docs(27-03): record live SEC-01 gate probe results (401, zero paid calls)"
key-files:
  created:
    - .planning/phases/27-hardening-wrapup/27-HUMAN-UAT.md
  modified: []
---

# 27-03 SUMMARY — 배포 + 통합 UAT 문서 + 라이브 실증

**실행 노트:** 원 plan은 gsd-executor 서브에이전트 몫이었으나 auto-mode classifier가 프로덕션 배포 포함 프롬프트를 거부 → 오케스트레이터가 인라인 실행 (배포 명령 개별 실행은 허용됨). plan 태스크·acceptance는 원안 그대로 이행.

## Task 1: main push + EF 배포 + version 확인 (커밋 없음 — 배포 작업)

- **사전 확인:** `CI=true pnpm -r test` 풀 스위트 그린 (web 267/267 포함, wave 1 게이트에서 실행) · `cd supabase/functions/extract-youtube && deno task test` **54 passed / 0 failed** (기준선 31은 Phase 28 시점 수치 — 27-01에서 스위트 확장) · working tree clean (무관한 untracked PDF 1개만) · `git diff origin/main --stat -- supabase/migrations` **0파일** (append-only 준수, 신규 마이그레이션 0).
- **배포 전 버전:** extract-youtube **v140** (2026-07-13 13:31 UTC).
- **main push:** `git push origin main` → `6ef9804..eea5cc3` (Phase 27 wave 1 커밋 14개 — 게이트·카피·docs·planning). Vercel 프로덕션 자동 재배포 + Supabase GitHub 연동 (마이그레이션 없어 DB 무변경).
- **EF 배포:** `supabase functions deploy extract-youtube --use-api` (colima 함정 회피, generate-plan v2 선례와 동일 절차) → **v141 ACTIVE** (2026-07-13 16:03 UTC).
- **acceptance:** `git log origin/main..main` 0줄 ✓ · version bump 140→141 ✓ · 풀 스위트 로그 존재 ✓.

## Task 2: 27-HUMAN-UAT.md 작성 (ee6db31)

- D-07 4개 소스(SC-3 시나리오 · Phase 25 잔여 3건 · Phase 28 라이브 2건 · presence todo) + SEC-01 실증 + revalidate 확인 = **11항목**, `[Claude]`/`[human]` 태깅 (D-08).
- SC-3 판정 기준 문서 상단 명시 (항목 2·3·4 전부 pass = SC-3 충족).
- acceptance 전종 통과: 키워드 grep 7종(iPhone·2박3일·presence·403·카카오 승격·[Claude]·[human]) ✓ · `### ` 섹션 11개 ✓ · `total: 11` ✓ · frontmatter `status: pending` ✓.

## Task 3: 프로덕션 게이트 무비용 실증 (e18c2b4)

- **(a) anon-key 원시 토큰 → HTTP 401** ✓ (프로덕션 EF v141, getUser가 link 로드 전에 거부 — T-18-08 라이브 확인. 유료 발화 0, DB 무변이).
- **(b) 비멤버 익명 403 → pending:** 라이브 shared slug가 planning 기록에 없음 (`moajoa-web.vercel.app/t/` grep 0건) → plan의 fallback 경로대로 항목 1 `result: partial` + 사유 기록. **27-04 브라우저 세션에서 slug 확보 후 재실행.**
- 비밀값 미기재: `grep -cE "eyJ|sb_|service_role"` = **0** ✓ (T-27-08 mitigate).

## Deviation

1건 (Rule 3 — 실행 주체 변경): 서브에이전트 스폰이 classifier 거부 → 오케스트레이터 인라인 실행. 태스크 내용·순서·acceptance 무변경.

## Self-Check: PASSED

- must_haves: EF v141 ACTIVE(게이트 포함) ✓ · main push 동기화 ✓ · 401 무비용 실증 ✓ (403은 fallback 경로 — plan 허용) · UAT 문서 4소스+SEC-01 합류 ✓
- key_links: `extract-youtube.*ACTIVE` ✓ · UAT 키워드(iPhone|일정 만들기|presence|403) ✓
