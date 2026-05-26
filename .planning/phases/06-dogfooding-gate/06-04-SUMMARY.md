---
phase: 06-dogfooding-gate
plan: 04
subsystem: dogfooding-friend-share
tags: [dogfooding, friend-share, screenshots, success-criterion-3]
requires: []
provides: [friend-share-checklist, screenshots-naming-convention]
affects: [".planning/dogfooding/", ".planning/dogfooding/screenshots/"]
tech_stack:
  added: []
  patterns: ["익명 라벨 Friend A/B (실명 X)", "NN-step.png prefix (정렬 보장)", "meta.txt 키:값 1줄당 1", "locale tagging (Known Pitfall)"]
key_files:
  created:
    - .planning/dogfooding/friend-share-checklist.md
    - .planning/dogfooding/screenshots/README.md
  modified: []
decisions:
  - "D-14 친구 2명 lock (iOS ≥ 1 + Android ≥ 1 device coverage 권장)"
  - "D-15 5체크 lock (OG / 보드 로드 / 영상 jump / 비로그인 / 한 줄 피드백)"
  - "D-16 친구별 폴더 친구-A/B + 실명 X"
  - "친구 부탁 시점 Day 5~6 권장 (보드에 ≥ 5 핀 있을 때)"
metrics:
  duration_min: 2
  completed: "2026-05-26"
  tasks: 2
  files_changed: 2
  commits: 1
---

# Phase 6 Plan 04: Friend Share Checklist Summary

Phase 6 Success Criterion 3 (친구 공유 e2e)을 위한 표준화된 친구 2명 share-test 체크리스트와 스크린샷 명명 규약 준비. 친구한테 부탁하기 전 본인이 양식이 준비되어 있어야 친구 시간 낭비 없이 5분 안에 test 완료.

## Tasks Completed

### Task 1: friend-share-checklist.md

- `.planning/dogfooding/friend-share-checklist.md` 신규 (97 lines)
- Goal + Lock + Estimated time + When to ask (Day 5~6 — 보드에 ≥ 5 핀 채워졌을 때)
- Friend A 양식 (device meta 5 필드 + Board URL slot + Share method) + D-15 5 체크박스 (1 OG / 2 보드 페이지 / 3 YouTube jump / 4 비로그인 / 5 한 줄 피드백) + 각 항목 inline Evidence 스크린샷 경로 + Pitfall reminders inline (24h 카톡 OG 캐시 / locale fallback / VPN)
- Friend B 양식 (Friend A와 동일 구조)
- Aggregation 섹션 (Friend A 5/5 + Friend B 5/5 + device coverage + Plan 06-05 PASS criterion 4 link)
- Pitfall reminders 종합 (카톡 OG 24h / Friend device language / VPN·방화벽)

### Task 2: screenshots/README.md

- `.planning/dogfooding/screenshots/README.md` 신규 (69 lines)
- Directory layout (pre-dogfooding T1 evidence + friend-A + friend-B + meta.txt 위치)
- Naming convention (본인 evidence kebab-case / 친구 evidence NN-step.png prefix → checkbox 1~3 매핑 / checkbox 4 비로그인은 별도 스크린샷 X / checkbox 5 피드백은 텍스트만)
- `meta.txt` format (1줄당 1 키:값 — platform/os/browser/locale/kakao)
- Locale labeling rules (Known Pitfall — Pretendard SSR embed라 device locale 무관, 그래도 라벨링)
- What NOT to include (실명/카톡 ID/전화/이메일/다른 대화)
- Git policy (LFS X — 친구 4개 × ~100KB)

## Verification

- Task 1: `grep` (Friend A / Friend B / 비로그인 / kakao-og / Locale) + `wc -l = 97 >= 50` → PASS
- Task 2: `grep` (friend-A / 01-kakao-og / locale / D-16) + `wc -l = 69 >= 15` → PASS

## Commits

- `b654978` — docs(06-04): friend share checklist + screenshots naming convention (2 files, +166)

## User-side Actions (Deferred to Dogfooding Day 5~6)

- **Day 5~6 시점에 본인이:** 
  1. 보드 share-slug URL을 카톡 1:1로 친구 2명 (Friend A iOS + Friend B Android 권장)에게 전송
  2. 친구 2명이 각 D-15 5 체크 진행 (양식 보고 ~5분/명)
  3. 친구가 보내준 스크린샷을 `screenshots/friend-A/`, `friend-B/` 폴더에 `01-kakao-og.png` 등 명명 규약으로 저장 + `meta.txt` 채움
  4. friend-share-checklist.md의 Friend A/B 블록 체크박스 close + 한 줄 피드백 paste
  5. Aggregation 섹션 close → Plan 06-05 PASS criterion 4 (Friend A/B 5/5 ☑️) 입력

- **Note:** 친구 2명 섭외가 안 되면 Plan 06-05의 Fail Condition "친구 1명이라도 OG/모바일 실패"로 분류 → Phase 4 잔여작업 재진입 추천 (pass-evaluator.md 참고).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `.planning/dogfooding/friend-share-checklist.md` exists (97 lines, Friend A/B + 5 체크 × 2)
- `.planning/dogfooding/screenshots/README.md` exists (69 lines, layout + naming + locale)
- Commit `b654978` exists in `git log`
