---
status: diagnosed
trigger: "Gap 4 [minor]: 호스트 /moa 채팅탭에서 메시지 입력창과 보내기 버튼이 하단에 살짝 가려짐"
created: 2026-07-14T00:00:00Z
updated: 2026-07-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — 채팅탭 컨테이너 pb-[64px]가 실제 탭바 높이(~65.5px)보다 작아 입력바 하단이 겹침
test: CSS 산술 검증 완료
expecting: n/a
next_action: return diagnosis (goal: find_root_cause_only)

## Symptoms

expected: 호스트 /moa 채팅탭 입력창·보내기 버튼이 온전히 보인다 (CHAT-07 무회귀)
actual: 입력창·보내기 버튼이 하단 탭바(moa-tab-bar)에 살짝 가려짐
errors: 없음 (시각)
reproduction: /moa/[id] 채팅탭 진입
started: Phase 29 UAT에서 보고

## Eliminated

- hypothesis: "Phase 29가 채팅 레이아웃을 변경해 발생한 회귀"
  evidence: git log — moa-chat.tsx는 26-02(3ef1e25)+IME fix(197f5fc) 이후 무변경. 채팅탭 컨테이너(pb-[64px])는 26-03(2eeb9b5) 도입 후 무변경. 29-02는 hidePlaceAdd prop만 추가(6e166ab)
  timestamp: 2026-07-14

## Evidence

- timestamp: 2026-07-14
  checked: moa-island.tsx:659-676 (채팅탭 컨테이너)
  found: `pb-[64px]`로 탭바 공간 확보. 주석 자체가 "탭바(fixed bottom ~56px)"로 높이를 추정치로 기재
  implication: 64px 예약은 잘못된 ~56px 추정에서 유도됨

- timestamp: 2026-07-14
  checked: moa-tab-bar.tsx:40-63 (탭바 실측 산술)
  found: border-t 1px + button py-2.5(20px) + icon 24px + gap-1(4px) + text-[11px] 라벨(임의값 폰트 크기라 line-height 미설정 → 상속 1.5 = 16.5px) = 총 ≈65.5px
  implication: 65.5px > 64px 예약 → 입력바(moa-chat.tsx:149-171 compose row, flex column 최하단) 하단 ~1.5-2px가 탭바 뒤로 들어감 — "살짝 가려짐"과 정확히 일치. DPR/폰트 렌더링에 따라 기기별로 보였다 안 보였다 함

- timestamp: 2026-07-14
  checked: components/bottom-nav.tsx (앱 셸 하단바)
  found: 동일 구조(py-2.5 + 24px icon + gap-1 + text-[11px]) — 동일 ~65.5px
  implication: 탭바 시각 계약을 고치면 두 곳에 영향(HC-6: moa-tab-bar 계약 무변경 요구) — 컨테이너 padding 쪽 수정이 surgical

## Resolution

root_cause: |
  moa-island.tsx:665 채팅탭 컨테이너 `pb-[64px]`가 MoaTabBar 실제 높이(≈65.5px:
  border 1 + py-2.5 20 + icon 24 + gap 4 + 11px 라벨×상속 line-height 1.5 ≈16.5)보다 작음.
  주석의 "~56px" 추정(moa-island.tsx:659)에서 유도된 값. Phase 26 (26-03, 2eeb9b5) 도입 —
  Phase 29 회귀 아님.
fix: (diagnose-only — 미적용)
verification: (미적용)
files_changed: []
