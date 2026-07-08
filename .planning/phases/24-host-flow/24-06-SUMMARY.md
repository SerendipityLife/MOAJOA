---
phase: 24-host-flow
plan: 06
subsystem: web-map-tab
tags: [web, realtime, postgres-changes, map, optimistic, rsc, island]
requires:
  - "@moajoa/core (moaChannelName, Place/Link/Trip 타입)"
  - "@moajoa/api (listPlacesByTrip·listLinksByTrip·getVoteCounts·getMyVotedPlaceIds·getTrip·listTripMembers·getProfileNames·castVote·retractVote·triggerExtraction)"
  - "apps/web/lib/member-color.ts (memberColor — 24-02)"
  - "apps/web/lib/marker-svg.ts (buildMarkerIconUrl fill — 24-02)"
  - "apps/web/app/moa/[id]/_components/place-sheet.tsx·place-list.tsx (24-05)"
  - "supabase/migrations/0026 realtime publication (places·links — 24-01, 로컬 적용)"
provides:
  - "MoaMap — persistent 지도(마커 diff·fitBounds·추가자 색), 재init 0 (D-16)"
  - "MoaIsland — 상태·realtime 구독·optimistic 찜·reconcile 허브 (MOA-03/05/06)"
  - "/moa/[id] RSC — auth 게이트 + 초기 데이터 로드"
  - "moa:{tripId} 단일 채널 인프라 (Phase 25/26 재사용)"
affects:
  - "24-07이 FAB·함께 정하기 버튼을 이 island에 붙임"
tech-stack:
  added: []
  patterns:
    - "persistent map ref + 마커 diff (public-board-map 재init 구조 폐기, RESEARCH Pitfall 4)"
    - "single postgres_changes channel per screen — payload 무시·refetch reconcile (RLS 재평가)"
    - "vote-island optimistic+rollback 찜 (join/anon 분기 제외 — 호스트 화면)"
    - "RSC seed → client island (vote-island 설계 미러, 캐시 없음)"
key-files:
  created:
    - "apps/web/app/moa/[id]/_components/moa-map.tsx"
    - "apps/web/app/moa/[id]/_components/moa-island.tsx"
    - "apps/web/app/moa/[id]/page.tsx"
    - "apps/web/__tests__/moa-island.test.tsx"
  modified: []
decisions:
  - "지도 재init 금지: mapRef 1회 생성 + markersRef diff + prevCountRef 증가 시에만 fitBounds (D-16) — new g.Map 단일 경로"
  - "colorFor/onMarkerTap을 ref로 보관해 지도 diff effect deps를 [places]로 한정 — 콜백 변경이 마커 재생성 유발 안 함"
  - "reconcile은 payload 미신뢰 전체 refetch — hard-delete/hidden_at 드리프트 차단 + WALRUS RLS 재평가 (T-24-18/19)"
  - "접근 권한은 RLS 자연 게이트 — getTrip null → notFound (IDOR 방어, 서비스 롤 0, T-24-17)"
  - "MOA-05는 Test 5로 단위 검증 완료(마커 탭→행 aria-expanded). MOA-03(realtime 실반영)·MOA-06(지도 핀 색)의 라이브 측면은 verify-work 몫(원격 db push 게이트 선행)"
metrics:
  duration: "~15분"
  completed: "2026-07-08"
  tasks: 3
  files: 4
---

# Phase 24 Plan 06: /moa/[id] 지도탭 허브 Summary

지도탭 전체 배선 완성 — RSC 초기 로드(page.tsx) + 깜빡임 없는 persistent 지도(moa-map) + 상태·realtime·optimistic 찜·reconcile 허브(moa-island). 24-05의 place-sheet/place-list를 소비해 추출 완료가 postgres_changes 단일 채널로 리스트·지도·토스트에 자동 반영되는 D-13→D-16 전 사이클을 잠갔다. FAB·함께 정하기 버튼만 24-07에 남는다.

## Tasks Completed

**Task 1 — moa-map (feat f838434):** `moa-map.tsx` 신규. public-board-map의 스크립트 로딩(`script[data-moajoa-gmaps]` dedupe·`libraries=marker`·키 부재 정적 fallback)·맵 옵션(`disableDefaultUI·zoomControl·gestureHandling:'greedy'·clickableIcons:false`)·마커 생성 idiom은 계승하되, **places 의존 재init 구조는 폐기**(RESEARCH Pitfall 4). 지도는 mapRef로 마운트당 1회만 생성(`new g.Map` 단일 경로), places 변경 시엔 markersRef를 대조해 **추가/삭제 마커만 diff** — 기존 마커는 그대로라 realtime 이벤트마다 깜빡임 0. 마커 아이콘 `fill=colorFor(p.added_by)`(MOA-06)·탭 리스너 `onMarkerTap(p.id)`(MOA-05). fitBounds는 prevCountRef로 **장소 수가 증가했을 때만**(0→N 초기 로드 포함) — 사용자 팬 강제 리셋 금지(D-16). colorFor·onMarkerTap은 ref로 보관해 diff effect deps를 `[places]`로 한정.

**Task 2 — moa-island + page (feat b4da89c):** `moa-island.tsx`(약 230줄) — RSC seed props를 받아 상태(places·links·counts·myVotes·votePending·profileNames·openPlaceId·sheetAnchor)·realtime·찜·reconcile을 소유. `colorFor = memberColor(uid, trip.owner_id, memberIdsInJoinOrder)`. **realtime:** `moaChannelName(trip.id)` 단일 채널에 places INSERT + links UPDATE 2바인딩만, cleanup `removeChannel` — broadcast·다중 채널 없음(D-14, "ONE channel per screen"). **reconcile:** payload 무시 전체 refetch(`listPlacesByTrip`·`listLinksByTrip`→`getVoteCounts`, 새 added_by 미보유분만 `getProfileNames` 추가) → 장소 증가 시 `장소 N개 추가됨` 토스트(D-16). **찜(A-5):** vote-island optimistic+rollback verbatim(join/anon 분기 제외 — 호스트 로그인 전제). **마커 탭(MOA-05):** `setOpenPlaceId + setSheetAnchor('expanded')`, 스크롤은 place-list openPlaceId effect. **재시도(D-15):** `triggerExtraction → reconcile`(router.refresh 대신). 레이아웃: max-w-lg 중앙 컬럼(A-10)·MoaMap 풀 채움·back chevron 오버레이(`aria-label="뒤로"`→`/moa`)·PlaceSheet(header 모아명+장소 수, children PlaceList 전체 배선). `page.tsx` RSC — Next 15 `await params`·auth 미로그인 `redirect('/login?next=/moa/{id}')`·`getTrip` null `notFound()`(RLS 자연 게이트)·`Promise.all` 초기 로드→MoaIsland.

**Task 3 — 테스트 (test 53c8de8, tdd GREEN-only):** `__tests__/moa-island.test.tsx` 5케이스. Test 1: `moa:trip-1` 단일 채널 + places INSERT·links UPDATE 2바인딩 + subscribe(채널명 prefix 정확 단언). Test 2: 언마운트 removeChannel 동일 인스턴스. Test 3: places INSERT 콜백 발화→listPlacesByTrip refetch + 장소 +1 시 `장소 1개 추가됨` 토스트. Test 4: 하트 optimistic +1(즉시)→castVote reject 원복 + 에러 토스트. Test 5: 마커 탭(MoaMap 스텁 노출)→place-list 행 aria-expanded=true. 채널 fake(`on/subscribe` 체이너블·`on` 3번째 인자 콜백 캡처)·supabase·@moajoa/api·useToast·next/navigation·MoaMap 전부 mock(Google Maps는 jsdom 불가 — 실지도는 manual UAT). 구현이 Task 2 선행이라 회귀 커버리지.

## Verification

- **web typecheck:** exit 0 (신규 3파일 + 테스트 포함)
- **web build:** PASS — 라우트 테이블에 `ƒ /moa/[id]` (7.01 kB / 207 kB First Load), 무회귀
- **web test:** 96→**101 그린**(18 파일) — moa-island 5케이스 추가, 무회귀
- **grep 게이트:** postgres_changes 2건·presence 0건·removeChannel·moaChannelName·`개 추가됨`·`aria-label="뒤로"`·notFound·`new g.Map` 1건·`'use client'`(page) 0건 전부 통과
- **`.js` 워크스페이스 import 0 · iOS 무접촉**

## Deviations from Plan

None — plan executed exactly as written. Rules 1-3 미발동.

## Threat Surface

플랜의 `<threat_model>` 범위 내(T-24-17~20). 신규 보안 표면 없음:
- T-24-17(IDOR): getTrip null→notFound + anon 키/쿠키 세션만, 서비스 롤 0 ✓
- T-24-18/19(이벤트 누출·payload 신뢰): payload 무시·refetch reconcile(RLS 재평가) ✓
- T-24-20(Maps 키): NEXT_PUBLIC 브라우저 키는 설계상 공개(accept) ✓

## Known Stubs

없음. place-list의 A-4 답장 버튼은 24-05가 이미 stub으로 문서화(Phase 26 몫) — 이 plan 신규 아님.

## Follow-ups (verify-work)

- **라이브 realtime 스모크(manual):** 링크 추가→분석 중 행→추출 완료 시 핀 등장 + 토스트, 마커 탭→행 스크롤+펼침. **원격 db push(0024·0025·0026) 게이트 선행** — Vercel Preview e2e.
- REQUIREMENTS: MOA-05는 단위 검증 완료. MOA-03(실시간 반영)·MOA-06(지도 핀 색)은 라이브 UAT 후 마킹.

## Self-Check: PASSED
