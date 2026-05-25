# Phase 3: iOS Save Flow — Discussion Log

**Date:** 2026-05-26
**Mode:** discuss (interactive)
**Format:** 4 gray areas presented, all 4 selected, deep-dive per area via AskUserQuestion (recommended-first options).

## Gray Areas Presented

1. Share Extension UX (SAVE-03)
2. Offline enqueue / drain (SAVE-04)
3. 수동 핀 추가/편집/삭제 UX (SAVE-05)
4. 추출 진행 상태 UX 범위 (SAVE-02)

**Excluded by orchestrator before user pick** (auto-decided from prior context):
- 인증 flow 마무리 — Phase 1 D-13 + SESSION-NOTES Day 2 covers (이메일+비번 메인 / 매직링크 토글 / Google OAuth 추후 provider 설정 / Apple v2). login.tsx 복원은 mechanical.
- 핀 탭 → 영상 타임스탬프 jump — ROADMAP에 명시 X. Phase 5 cross-cut으로 deferred (CONTEXT 03-09 노트).

**User selection:** all 4.

## Selected Areas — Q&A Summary

### Area 1: Share Extension UX (SAVE-03)
| Q | User answer |
|---|---|
| 메인 흐름 | **boardpicker 없이 즉시 저장 + 한 줄 토스트** (recommended) |
| Last board 저장 방식 | **App Group SharedDefaults** (recommended) |
| 로그인 안 됨 / last board 없음 | **메인 앱 먼저 열라 안내** (recommended) |

→ D-01, D-02, D-03

### Area 2: Offline enqueue / drain (SAVE-04)
| Q | User answer |
|---|---|
| Drain trigger | **launch + foreground 복귀 둘 다** (recommended) |
| Enqueue 자료 구조 | **배열 of {url, board_id, queued_at, retry_count}** (recommended) |
| 재시도/실패 정책 | **silent retry ≤3, 초과 시 실패 보드 + 재시도 버튼** (recommended) |

→ D-04, D-05, D-06

### Area 3: 수동 핀 (SAVE-05)
| Q | User answer |
|---|---|
| 장소 검색 | **텍스트 입력 + Places Autocomplete 드롭다운** (recommended) |
| resolve-place 구현 | **새 Edge Function `resolve-place`** (recommended) |
| 편집/삭제 interaction | **핀 탭 → bottom sheet → 액션 버튼** (recommended) |

→ D-07, D-08, D-09

### Area 4: 추출 진행 상태 UX (SAVE-02)
| Q | User answer |
|---|---|
| iOS Phase 3 progress UI 깊이 | **단순 spinner + done/error 텍스트** (recommended) |
| p90 30초 측정 | **extraction_costs.duration_ms SQL 집계** (recommended) |

→ D-10, D-11

## Scope Creep Redirected

None during this session. User stayed within phase boundary.

## Deferred to Future Phases / Backlog

- 핀 탭 → 영상 timestamp jump (Phase 5 또는 minor add)
- 지도 long-press → reverse geocode (v2)
- in-app navigate after share (v2 — D-01 lock으로 1탭 토스트 유지)
- AI vs 수동 핀 시각 구분 / 5단계 progress raw 메시지 / low_confidence 음영 (Phase 5 Trust UI)
- `/discover` 피드, COLLAB-01/02 (v2 backlog)

## Total decisions captured: 11 (D-01 ~ D-11)
