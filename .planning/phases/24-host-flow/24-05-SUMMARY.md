---
phase: 24-host-flow
plan: 05
subsystem: web-map-tab
tags: [ui, presentation, drag-sheet, accordion, place-list]
requires:
  - "apps/web/lib/place-sort.ts (sortByLove — 24-02)"
  - "apps/web/lib/maps-url.ts (buildGoogleMapsPlaceUrl)"
  - "apps/web/lib/youtube.ts (buildYouTubeWatchUrl)"
  - "@moajoa/core (Place, Link 타입)"
  - "@/components (useToast)"
provides:
  - "PlaceSheet — non-modal 2단 앵커 드래그 시트 (D-09), controlled anchor"
  - "PlaceList — 정렬·아코디언·찜 하트·분석중/실패 행 (props-driven, 콜백만)"
affects:
  - "24-06 moa-island이 두 컴포넌트에 props/콜백 배선 (상태·mutation·realtime 소유)"
tech-stack:
  added: []
  patterns:
    - "vote-island 아코디언·출처 액션·하트 idiom 미러 (join/anon 분기 제외)"
    - "BottomSheet 시각 언어 미러 + hand-rolled pointer 드래그(vaul 미사용, D-09)"
    - "controlled anchor/openPlaceId — 상태는 island 소유, 컴포넌트는 프레젠테이션"
key-files:
  created:
    - "apps/web/app/moa/[id]/_components/place-sheet.tsx"
    - "apps/web/app/moa/[id]/_components/place-list.tsx"
    - "apps/web/__tests__/place-list.test.tsx"
  modified: []
decisions:
  - "아코디언은 vote-island 조건부 마운트 미러(max-height 상시 렌더 대신) — 한 번에 하나만 + getByText 유일 쿼리 보장"
  - "실패 행 배치: 분석중=리스트 상단, 실패=리스트 하단 (D-13/D-15 순서 비지정 → 진행중 우선)"
  - "REQUIREMENTS MOA-02/03/05/06은 여전히 Pending — 마커 탭·지도 색·추출 파이프라인은 24-06 island 배선 몫"
metrics:
  duration: "~11분"
  completed: "2026-07-08"
  tasks: 3
  files: 3
---

# Phase 24 Plan 05: place-sheet · place-list Summary

지도탭 시트 UI 2종 완성 — non-modal 2단 앵커 드래그 시트(place-sheet, D-09)와 그 본문의 장소 리스트(place-list: 찜순 정렬·순번 불변 배지·아코디언·하트·분석중/실패 행). 둘 다 props-driven 프레젠테이션 컴포넌트 — 상태·mutation은 24-06 island이 소유하며, 이 plan은 그 계약 표면을 독립 빌드·테스트해 wave를 벌린다.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | place-sheet — non-modal 2단 앵커 드래그 시트 (D-09) | 8f76ae8 | apps/web/app/moa/[id]/_components/place-sheet.tsx |
| 2 | place-list — 정렬·아코디언·하트·분석중/실패 행 | 9840831 | apps/web/app/moa/[id]/_components/place-list.tsx (251줄) |
| 3 | place-list RTL 테스트 (8케이스) | 50d4090 | apps/web/__tests__/place-list.test.tsx |

## What Was Built

**PlaceSheet (D-09):** controlled `anchor`('collapsed'~30vh / 'expanded' 85vh, A-3) + `onAnchorChange` + `header`/`children` 슬롯. 기존 BottomSheet 시각 언어만 미러(28px 상단 라운드·bg-white·핸들 h-1.5 w-10·snap 250ms ease-out) — modal(뒷막+닫기)이라 재사용 불가. 핸들/헤더 `onPointerDown`→`setPointerCapture`→move 중 live `translateY`(transition off)→release 시 가까운 앵커 snap. 플릭 방향 바이어스(마지막 delta 부호), expanded+본문 `scrollTop>0`이면 본문 드래그 억제(핸들은 항상 허용). 백드롭·onClose 0건(non-modal 상시 표시). max-w-lg 컬럼(A-10).

**PlaceList (MOA-02/05/06 + D-13/15):** props-driven, mutation 0(콜백만). `sortByLove(places, counts)`로 렌더 순서만 결정, 순번 배지는 항상 `place.seq_no`(정렬 인덱스 넘버링 금지, Pitfall 9). 행 anatomy — 좌: 20px 원 배지 `colorFor(added_by)` bg + 흰 seq_no, 중: name_local 16/600 truncate + `{닉네임}님이 담음`, 우: 찜 하트(aria-label="찜", off neutral-400 outline / on brand-500 filled, stopPropagation+disabled). 아코디언(A-7 순서): 주소→구글맵에서 보기→출처(youtube 타임스탬프 `출처 m:ss`/blog 원문 `출처 보기`, manual 생략)→답장 stub(useToast '채팅은 곧 열려요', Phase 26 핸들러 교체). openPlaceId 외부 변경 시 `scrollIntoView`(마커 탭 MOA-05). 분석 중 행(D-13, neutral-400 스피너), 실패 행(D-15: failed·manual_review·ready+0추출 → AlertCircle #EF4444 + 재시도 콜백), empty state.

**테스트:** RTL 8케이스 — 정렬 순서+배지 seq_no 이중 단언(Test 1), 동률 seq asc(Test 2), 아코디언 4요소+행 클릭 콜백(Test 3), 닉네임+배지색(Test 4), 하트 stopPropagation(Test 5), 분석중(Test 6), 실패+재시도 콜백(Test 7), empty(Test 8).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — grep 게이트 주석 리터럴 정정] place-sheet 주석의 `onClose`·`rounded-t-3xl` 리터럴이 acceptance grep 오탐**
- **Found during:** Task 1
- **Issue:** BottomSheet 대비를 설명하는 주석에 `onClose`·`rounded-t-3xl` 리터럴이 있어 `backdrop|onClose==0`·`rounded-t-3xl==1` acceptance 게이트가 오탐(각 1건씩 초과 카운트).
- **Fix:** 의미 보존한 채 주석을 재서술(`onClose`→"닫기 콜백", 코드 대비 설명의 `rounded-t-3xl`→"28px 상단 라운드"). 코드 동작 무변경.
- **Files modified:** apps/web/app/moa/[id]/_components/place-sheet.tsx
- **Commit:** 8f76ae8 (커밋 전 반영)

### Design Notes (deviation 아님)

- **아코디언 구현:** plan은 "max-height transition 200ms"를 명시했으나 vote-island analog(조건부 마운트)를 따랐다 — 상시 렌더 시 모든 행의 "구글맵에서 보기"가 DOM에 중복되어 `getByText` 유일 쿼리가 깨지고, "한 번에 하나만"(openPlaceId 단일) 계약과도 충돌하기 때문. plan이 지목한 재사용원(vote-island)의 established idiom이라 별도 deviation으로 계상하지 않음.

## Requirements

PLAN.md frontmatter의 MOA-02/03/05/06은 **컴포넌트 표면만** 완성 — REQUIREMENTS.md는 Pending 유지. 전체 완료(마커 탭↔행 연동의 지도 측, 추가자별 핀 색의 지도 렌더, 링크 자동 추출 파이프라인)는 24-06 moa-island 배선 몫(이 plan의 성공 기준 "island이 props만 배선하면 되는 상태"와 일치).

## Verification Results

- `pnpm --filter @moajoa/web test:run` — **96 passed** (88 기존 무회귀 + place-list 8 신규)
- `pnpm --filter @moajoa/web typecheck` — exit 0
- `pnpm --filter @moajoa/web build` — PASS (13/13 정적 페이지, noUncheckedIndexedAccess 블로커 0)
- 카피 grep 스윕 — 분석 중…·장소를 찾지 못했어요·님이 담음·채팅은 곧 열려요·재시도·아직 담은 장소가 없어요 전부 존재
- 보안 grep — dangerouslySetInnerHTML 0(T-24-14), mutation(castVote/retractVote/from) 0, `.js` 워크스페이스 import 0
- iOS 무접촉

## Threat Surface

plan `<threat_model>` 3종 전부 유지 — T-24-14(React 기본 이스케이프, dangerouslySetInnerHTML 0 grep 단언), T-24-15(외부 링크 `target="_blank" rel="noopener noreferrer"` + URL은 buildGoogleMapsPlaceUrl/buildYouTubeWatchUrl 헬퍼로만), T-24-16(배지 backgroundColor는 colorFor 반환값만 — user 문자열 스타일 경로 0). 신규 위협 표면 없음.

## Self-Check: PASSED

- 3/3 파일 존재 확인 (place-sheet·place-list·place-list.test)
- 3/3 커밋 존재 확인 (8f76ae8·9840831·50d4090)
