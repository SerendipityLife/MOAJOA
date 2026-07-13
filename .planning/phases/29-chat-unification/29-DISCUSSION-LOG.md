# Phase 29: Chat Unification (채팅 단일화) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 29-chat-unification
**Areas discussed:** dates 공유 채팅 진입 형태, 한마디 은퇴 범위(데이터·코드), 독립 /poll/[code] 페이지 운명

---

## 사전 방향 (직전 세션에서 잠금)

"채팅/한마디가 같은 기능인데 따로 분류돼 혼란 + 게스트는 채팅탭 접근 불가"라는 사용자 관찰에서 출발. 코드 실측으로 두 기능이 별개 백엔드(date_comments/poll-chat vs trip_messages/moa-chat)임을 확인. 사용자가 "채팅으로 완전 통일" 방향 선택(경량 라벨정리·역방향 통일 반려).

---

## dates 공유 채팅 진입 형태

| Option | Description | Selected |
|--------|-------------|----------|
| both과 동일하게 MoaIsland 마운트 | poll을 pollSlot에, 장소 빈 상태. 채팅탭·presence·멘션 무료 재사용, 신규 컴포넌트 0 | ✓ |
| dates 전용 경량 채팅 섹션 | poll 아래 moa-chat 직접. 채널·상태 소유 새 배선 필요 | |

**User's choice:** both과 동일하게 MoaIsland 마운트 (추천). → D-01.

---

## 한마디 은퇴 범위 (데이터·코드)

| Option | Description | Selected |
|--------|-------------|----------|
| 코드까지 완전 제거 | poll-chat.tsx 삭제 + PollVoteIsland 마운트 제거 + api postComment/deleteComment 제거. date_comments 테이블 미사용 방치(DROP 안 함) | ✓ |
| UI 마운트만 제거(코드 유지) | 렌더만 제거, dead code 잔존 | |

**User's choice:** 코드까지 완전 제거 (추천). → D-02·D-02a.

---

## 독립 /poll/[code] 페이지 운명

| Option | Description | Selected |
|--------|-------------|----------|
| 유지하되 한마디만 제거 | 라우트 존속(투표 유지), 채팅 표면 소멸 | |
| /poll 라우트 은퇴 | /t로 일원화·리다이렉트 | |
| 둘 다 이번 phase에 | 한마디 제거 + 라우트 은퇴 | |
| (free-text) 유지하되 투표화면에 채팅을 넣고 싶어 | /poll 유지 + 한마디 자리에 통일 채팅(trip_messages) 탑재 | ✓ |

**User's choice:** "유지하되 투표화면에 채팅을 넣고 싶어" — 제시 옵션(한마디 제거)보다 강함. /poll을 통일 채팅으로 업그레이드. → D-03·D-03a.
**Notes (Claude 함의 반영):** /poll은 익명 device_token 페이지 → trip_messages 채팅은 멤버 전제라 익명 승격(signInAnonymously+joinMoa) + poll_code→slug 해석 필요. research/plan에서 설계·확인(D-03a).

---

## Claude's Discretion (CONTEXT에 기록)

- presence 통일 (poll:{tripId} → moa:{tripId})
- 익명 승격 게이트 시점 (채팅 진입에도 닉네임 게이트)
- PollVoteIsland embed prop 정리

## Deferred Ideas

- date_comments 테이블 DROP 마이그레이션 (append-only 규칙상 제외)
- /poll 라우트 은퇴 (반려 — 유지+채팅 탑재 채택)
- /poll·/t 단일 라우트 통합 (범위 밖)
