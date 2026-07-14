---
status: diagnosed
trigger: "Phase 29 배포 후 라이브에서 게스트가 통일 채팅을 전혀 볼 수 없다 (UAT gap 1+2)"
created: 2026-07-14T14:30:00Z
updated: 2026-07-14T15:10:00Z
---

## Current Focus

hypothesis: CONFIRMED — 코드 결함 아님. UAT 관찰이 (a) 배포 전(pre-29) 프로덕션 빌드에 대해 이루어졌고 (b) 이틀 전 죽은 익명 세션의 투표자 목록 잔재(클로드게스트)를 '현재 join됨'으로 오독함. 라이브 신코드+백엔드는 전 구간 정상 동작 실증.
test: 완료 — Vercel 배포 SHA/시각 대조 + date_votes/profiles 타임라인 + 익명 voter 멤버로 hydrateMember 전 쿼리 라이브 재현
expecting: —
next_action: ROOT CAUSE FOUND 리포트 반환 (diagnose-only 모드)

## Symptoms

expected: dates/both 공유 게스트가 join 후 MoaIsland(탭바: 모으기/채팅/마이) + pollSlot을 본다. /poll 게스트는 투표 UI 아래 채팅 섹션을 본다.
actual: 게스트 시크릿 브라우저 /t/{slug} — 날짜투표 섹션+장소 렌더되나 탭바 자체 없음. 채팅 접근 불가. /poll에도 채팅 섹션 없음. 게스트 '클로드게스트'는 투표자 목록에 표시(투표 성공 = join 성공 추정). 호스트 /moa 채팅탭은 정상.
errors: 없음 (사용자 보고 기준 — 콘솔 미확인)
reproduction: 시크릿 브라우저에서 dates/both 공유 링크 /t/{slug} 열기 → 투표 → 탭바/채팅 없음
started: Phase 29 배포 직후 (origin/main eea5cc3..3289bde)

## Eliminated

- hypothesis: (H5) 프로덕션이 옛 번들 서빙 (배포 전파/캐시 문제)
  evidence: 라이브 moajoa-web.vercel.app/t/3uo4yyvlxhqc의 JS 청크(chunk-477, page chunk)에 신코드 마커 `hidePlaceAdd` 존재 + 은퇴 문자열 '한마디' 0건. cache-control no-store, x-vercel-cache MISS. 새 빌드가 서빙 중.
  timestamp: 2026-07-14T14:40:00Z

- hypothesis: (H1/H2/H3/H4) hydrateMember가 voter 게스트에서 RLS/null로 실패해 island 미마운트
  evidence: 라이브 재현 프로브(scratchpad/probe-hydrate.mjs) — signInAnonymously → join_moa_by_poll_code('z1nplsvaw88c') → voter 멤버(accepted_at 세팅됨) 상태에서 hydrateMember의 전 쿼리 실행: getTrip OK(visibility=shared, share_mode=both), places 2행·links 0·members 1·messages 3행, vote_counts RPC OK, profiles OK. 실패 0. (멤버십은 self-delete로 정리 완료)
  timestamp: 2026-07-14T14:55:00Z

## Evidence

- timestamp: 2026-07-14T14:30:00Z
  checked: guest-surface.tsx 마운트 조건 (dates L338, both L366)
  found: 두 분기 모두 `joined && moaSeed` — 스크린샷(poll+places 렌더)은 이 조건이 falsy임을 의미. both의 else 분기가 pollSection+readOnlyPlaces를 렌더 = 스크린샷과 일치.
  implication: joined=false이거나 moaSeed=null. hydrateMember(L189-222)가 seed의 유일한 소스. getTrip null이면 조기 return(seed null인데 joined는 true 가능), throw면 revisit 경로(L114)에서 setJoined(true) 도달 못함(try/catch 없음).

- timestamp: 2026-07-14T14:45:00Z
  checked: Vercel 배포 이력 (vercel ls + API)
  found: dpl_4QjmH4YfWDL4mG6X3dWqHJPz1mVp = 3289bde(29-04 최종), Ready 2026-07-14 14:55:52 KST, moajoa-web.vercel.app alias. 이후 배포 전부 Ready(빌드 실패 0). 21:38~23:10 KST 배포들은 quick 작업(login/landing/switcher) — guest-surface.tsx diff 0, moa-island moas prop은 optional(게스트 미전달=정적 pill).
  implication: 신코드는 14:56 KST부터 프로덕션 서빙. UAT 공식 윈도(15:20~23:05 KST) 동안 신코드였음.

- timestamp: 2026-07-14T15:00:00Z
  checked: date_votes 원시 행 + profiles 교차 (임시 멤버 프로브, self-clean 완료)
  found: 클로드게스트 vote 2026-07-12T01:28Z(profile 07-10, chat msg 07-10) — Phase 29 이틀 전. 빅맨 07-14 07:44 KST, 김영동 08:16 KST — 14:55 배포 이전(구코드 대상 테스트). rkawk 23:03 KST — 배포 후, authed 경로(profile 존재=게이트+join 실행됨), 4표 성공.
  implication: Test 2가 인용한 '클로드게스트 투표자 목록' 근거는 이틀 전 죽은 익명 세션의 잔재. 새 시크릿 창에는 그 세션이 없어 비join 뷰(설계 그대로)가 렌더된 것. 구코드 시절 /poll엔 실제로 '채팅' 섹션이 없었음(한마디만) — Test 1 보고와 정합.

- timestamp: 2026-07-14T15:05:00Z
  checked: 29-UI-SPEC.md:148-155, :276(A-2) 설계 계약
  found: 비join dates/both 게스트에 채팅 teaser·탭바 미노출은 설계 의도. 채팅은 현재 세션에서 join 액션(투표/찜/전송→닉네임 게이트) 후 MoaIsland 탭바 경유. 상시 노출 채팅 섹션은 /poll에만(A-7).
  implication: 스크린샷의 상태(투표 섹션+장소+탭바 없음)는 비join 게스트의 정상 화면.

## Resolution

root_cause: 배포 코드 결함 아님. (a) 게스트 테스트 웨이브(빅맨 07:44·김영동 08:16 KST)가 Phase 29 배포(14:55 KST) 이전 프로덕션에서 수행돼 구코드 증상(/poll 채팅 섹션 부재, /t 비join 뷰)을 관찰했고, (b) 이틀 전(07-12) 죽은 익명 세션의 투표자 목록 잔재(클로드게스트)를 '현재 브라우저가 join된 상태'로 오독 — 새 시크릿 창은 세션이 없어 설계대로 비join 뷰를 렌더. 라이브 프로브로 신코드 게스트 경로(join→hydrateMember 전 쿼리→island 마운트 조건) 전부 정상 실증.
fix: (diagnose-only — 미적용) ① UAT 재실행: 배포 후 새로 연 시크릿 창에서 join 액션 수행 후 검증. ② 강건화 후보: guest-surface.tsx:114 unguarded await hydrateMember(세션 effect try/catch 부재 — 일시 실패 시 무증상 비join 감금), 죽은 세션+저장 닉네임 상태의 '다시 참여' 어포던스 부재.
verification: 라이브 재현 프로브(익명 voter join→전 hydrate 쿼리 성공), 라이브 /poll HTML에 통일 채팅 섹션 마크업 존재, Vercel 배포 SHA-시각 실측, date_votes/profiles 타임라인 실측.
files_changed: []
