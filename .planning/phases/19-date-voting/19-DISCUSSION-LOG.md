# Phase 19: Date Voting (일정 미정 분기) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 19-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 19-date-voting
**Areas discussed:** 투표자 신원·초대, Trip↔Poll 생애주기·데이터모델, 투표 대상 구조, 집계·확정 전환 (+ 댓글)

---

## 투표자 신원·초대

| Option | Description | Selected |
|--------|-------------|----------|
| 완전 익명 (닉네임 필수, 기기토큰) | 비로그인, 이름만 입력, anon-insert RLS 신규 | ✓ |
| 매직링크 로그인 | Phase 10 일관, join_shared_trip 재사용 | |
| 익명+선택 로그인 하이브리드 | 기본 익명, 원하면 로그인 연결 | |

**User's choice:** 완전 익명 — 단, "누가 투표했는지 모르지 않냐"는 우려로 **닉네임 필수** 추가. 추가로 "익명 투표자를 고객으로 끌어올 가입/로그인 지점"을 물음.
**Follow-up (가입 전환 지점):**

| Option | Description | Selected |
|--------|-------------|----------|
| 확정 화면 중심 | 투표=로그인 0, 확정 결과 화면에서 가입 CTA(payoff 뒤) | ✓ |
| 투표 직후 유도 | 투표 후 "가입하고 결과 보기" 게이트 | |
| 이번 phase는 유도 없음 | 가입 전환 Phase 20+로 미룸 | |

**Notes:** 비로그인 + 닉네임 필수 + 기기토큰 dedup. 가입은 확정 결과 화면(payoff 뒤) 중심, 투표 직후 optional soft nudge.

---

## Trip ↔ Poll 생애주기·데이터모델

| Option | Description | Selected |
|--------|-------------|----------|
| 날짜 없는 trip 즉시 생성 | trips DB nullable 활용 + date_polls.trip_id FK, 확정 시 날짜 UPDATE | ✓ |
| Poll 먼저 standalone | trip 없이 poll만, 확정 시 trip 생성 | |
| 기존 trip에만 부착 | 이미 있는 trip에만 — 미정 진입점 못 커버 | |

**Follow-up (호스트 관리 표면):**

| Option | Description | Selected |
|--------|-------------|----------|
| plan 탭 상단 카드 | plan.tsx surgical 확장, 기본 랜딩 발견성↑ | ✓ |
| 전용 화면/라우트 | /trip/[id]/poll 별도 | |
| 지도 탭 배너 | 지도 탭 상단 배너 | |

**Notes:** 미정 → 날짜없는 trip 즉시 생성. 온보딩 미정 카드 활성화. 호스트 관리 = plan 탭 상단 카드.

---

## 투표 대상 구조

| Option | Description | Selected |
|--------|-------------|----------|
| 후보 날짜범위 N개 (range) | 호스트 제안 범위에 가능/불가 | ✓ (둘 다) |
| 월 캘린더 per-day 그리드 | when2meet식 | ✓ (둘 다) |
| 단일 날짜 가부 | 하루 단위만 | |

**User's choice:** "1,2번 다 선택하게 해서 진행 가능?" → 추천(범위형 1종)을 override, **두 모드 다(호스트가 생성 시 선택)**. 범위 ~2배 트레이드오프 고지함.
**Follow-up (가능성 단계):**

| Option | Description | Selected |
|--------|-------------|----------|
| 가능/가능하면/불가 3단 | Doodle식, 0.5 가중 | |
| 가능/불가 2단 | binary, 단순 | ✓ |

**Notes:** 사용자가 "가능하면 많으면 재투표 비효율?" 우려 → 호스트 최종확정이 타이브레이커라 재투표 강제 없음 설명 후, 단순성 위해 **2단(가능/불가)** 으로 잠금(수정 추천).

---

## 집계·확정 전환

| Option | Description | Selected |
|--------|-------------|----------|
| 호스트만 확정 | 집계 열람, 확정은 호스트(range=옵션, grid=연속블록) → trip 날짜 | ✓ |
| 최다 득표 자동 확정 | 1위 자동 | |
| 호스트 확정 + 마감일 자동 | 마감일 기능 추가 | |

**Follow-up (확정 후 상태):**

| Option | Description | Selected |
|--------|-------------|----------|
| poll 잠금 + trip 정해짐 전환 | status=closed, trip 날짜 set, 웹 결과+가입 CTA | ✓ |
| poll 재오픈 가능 | 확정 후 재투표 | |

**Notes:** 호스트만 확정 → trip.start/end_date set. 확정 후 poll closed, 웹 결과 화면 + 가입 CTA. 재투표=새 poll.

---

## 댓글 스레드 (사용자 추가 요청)

| Option | Description | Selected |
|--------|-------------|----------|
| 백로그로 미룸 | 풀 댓글 별도 phase | |
| 투표자 한 줄 메모만 | votes.note 1컬럼 최소 | |
| 이번 phase에 댓글창 포함 | 풀 flat 스레드 | ✓ |

**Notes:** 사용자가 "확정 후 대화창/댓글창 같이 넣는 건 어때?" 제안. scope-creep 가드로 백로그 추천했으나 사용자가 **포함** 결정 → MVP 제약(flat 스레드, 익명 모델 재사용, 호스트 모더레이션, 실시간 패턴 재사용)으로 범위 고정. phase ~5 플랜으로 증가 명시.

## Claude's Discretion
- 옵션 개수 상한, poll code 형식, 테이블 분할, 실시간 채널명, 웹 라우트, soft nudge 문구/배치, 기기토큰 방식.

## Deferred Ideas
- 마감일 자동확정 · 3단 가능성 · 댓글 고도화(중첩/멘션/이미지) · 이메일 초대 발송 · poll 재오픈 · 장소+날짜 결합 투표.

---

## 후속 (UAT-driven, 2026-06-27) — 후보 날짜 입력 갭 + 실시간 충돌

> 휴먼 UAT(웹 2-브라우저 라이브) 실행 중 발견된 2개 차단성 이슈에 대한 후속 결정.

### 발견된 결함
- **GAP-19A — 후보 날짜 입력 표면 부재:** D-07이 range="후보 범위 N개 제안", grid="윈도우(예: 한 달)"를 정했으나, 이를 입력하는 UI/쓰기 경로가 앱 어디에도 미구현. `create_dateless_trip_with_poll`은 옵션 0개 poll만 생성 → 초대받은 voter는 "투표할 날짜가 아직 없어요"(grid)/빈 목록(range)으로 투표 불가. POLL-02 end-to-end 동작 불가. (백엔드 무관 — 옵션 수동 주입 시 투표 정상.)
- **GAP-19B — 같은 토픽 채널 충돌:** PollVoteIsland와 PollChat이 동일 토픽 `poll:{tripId}`로 같은 클라이언트에서 채널 2개 구독 → Realtime이 토픽당 한 바인딩에만 전달 → chat(comment)만 살고 island의 vote broadcast·presence가 죽음. raw supabase-js 최소 재현으로 확정. 유닛 264개는 채널 목킹이라 미포착(라이브 2-클라이언트에서만 노출).

### 결정 (후보 날짜 입력)

| Option | Description | Selected |
|--------|-------------|----------|
| plan 카드에서 입력 | D-05 관리 카드에 "후보 날짜 추가" 단계. create는 도시-only 유지(D-04) | ✓ |
| create 플로우에서 입력 | dateless create의 숨긴 날짜 피커를 후보 입력으로 부활 | |
| 둘 다 | 생성 시 기본 + 카드 편집 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 후보 있어야 공유 활성 | range ≥2 / grid 윈도우 ≥1 있어야 초대 공유 버튼 활성 (빈 poll 링크 차단) | ✓ |
| 공유 항상 허용 | 후보 없어도 공유 | |

**Notes (잠금):**
- iOS 전용(후보 입력=호스트 관리 액션, web 금지 §5). web은 열람·투표만.
- 입력 shape는 D-07 그대로: range=후보 범위 여러 개(각 `date_poll_options` 1행), grid=윈도우 1개(option 1행). 기존 `DatePickerSheet` 재사용.
- 후보 날짜는 모드 토글(D-07 lock, `canChangeMode=N===0`)처럼 **첫 투표 후 잠금**.
- 쓰기 경로: `date_poll_options_write` RLS(authenticated, can_edit_trip) 경유 — `setPollMode` 패턴 따라 `@moajoa/api` 타입드 래퍼 추가(새 마이그레이션 불필요).

### 결정 (GAP-19B 수정)
- 코드 주석이 이미 의도한 "단일 공개 채널 공유(chat reuses it)"대로, **chat이 island의 단일 채널을 재사용**하도록 수정(같은 토픽 2채널 → 1채널). 설계 변경 아님, 의도 복원.

### iOS UAT(항목 1)
- GAP-19A를 iOS에 구현한 뒤, Claude가 sim에서 onboarding→생성→카드(후보 추가→공유)→토글→확정까지 idb 구동 검증.
