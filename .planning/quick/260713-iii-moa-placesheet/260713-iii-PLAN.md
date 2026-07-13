---
phase: 260713-iii-moa-placesheet
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/moa/[id]/_components/place-sheet.tsx
  - apps/web/__tests__/place-sheet.test.tsx
autonomous: true
requirements: [QUICK-01]

must_haves:
  truths:
    - "시트 본문(리스트)에서 드래그해도 시트 앵커가 바뀌지 않는다 — 본문은 스크롤 전용"
    - "핸들·헤더에서 드래그하면 시트가 collapsed↔expanded로 움직인다 — 드래그 전용"
    - "본문 스크롤이 document로 체이닝되지 않는다 (overscroll-contain) — 페이지 전체가 밀리지 않는다"
    - "지도(moa-map)는 손대지 않는다 — gestureHandling 'greedy'로 지도 영역 팬만 유지"
  artifacts:
    - apps/web/app/moa/[id]/_components/place-sheet.tsx
    - apps/web/__tests__/place-sheet.test.tsx
  key_links:
    - "본문 div → onPointer* 핸들러 0개 + overscroll-contain (스크롤 전용 컨테이너)"
    - "핸들·헤더 div → touch-none + onPointerDown/Move/Up/Cancel (드래그 전용 표면)"
    - "controlled anchor 계약(anchor/onAnchorChange)은 그대로 — moa-island 무변경"
---

<objective>
/moa/[id] 지도 탭에서 지도와 PlaceSheet가 서로의 제스처를 먹는 문제를 고친다. 제스처 소유권을 표면별로 배타적으로 분리한다.

Purpose: 지금 시트 **본문**이 제스처 주인이 둘이다 — `onPointerDown/Move/Up/Cancel`로 시트를 드래그하면서(place-sheet.tsx:137-140) 동시에 `overflow-y-auto` 스크롤 컨테이너다(:136). 게다가 프로젝트 전체에 `overscroll-behavior`가 없어서, 본문에 스크롤할 내용이 없을 때(장소 0개 = 빈 상태) 스크롤이 document까지 체이닝되고 페이지 전체가 탄성 스크롤로 밀린다. 이때 `fixed`로 깔린 지도와 시트가 한 덩어리로 같이 움직인다. 사용자가 보고한 "어떨 땐 지도만, 어떨 땐 시트만, 어떨 땐 둘 다 움직인다"의 정체.

Output: 본문 = 스크롤 전용(체이닝 차단), 핸들·헤더 = 드래그 전용. 단일 파일 변경 + 계약 테스트.
</objective>

<user_locked_decisions>
- 시트 본문은 **스크롤 전용**. 접기/펴기는 **핸들·헤더로만**.
- expanded + 리스트 맨 위에서 아래로 스와이프해도 시트는 접히지 않는다. 방향 판정(direction detection) 로직은 **도입하지 않는다** — 단순·결정적 쪽을 사용자가 명시적으로 선택.
</user_locked_decisions>

<tasks>

## Task 1 — 계약 테스트 추가 (실패 상태로)

`apps/web/__tests__/place-sheet.test.tsx` 신규 작성. 기존 테스트 idiom(vitest + @testing-library/react)을 따른다. `place-list.test.tsx` / `moa-island.test.tsx`의 렌더·쿼리 스타일을 참고.

`PlaceSheet`를 controlled로 렌더(`anchor` + `onAnchorChange` 스파이)하고:
- **Test 1 (본문 = 스크롤 전용):** 본문 영역에서 pointerDown → pointerMove(위로 충분히) → pointerUp 시퀀스를 보내도 `onAnchorChange`가 **호출되지 않는다**.
- **Test 2 (핸들 = 드래그 전용):** 핸들·헤더 영역에서 같은 시퀀스를 보내면 `onAnchorChange`가 호출된다.
- **Test 3 (체이닝 차단):** 본문 요소의 className에 `overscroll-contain`이 있다.

jsdom은 `setPointerCapture`가 없으므로 스텁 필요 (`Element.prototype.setPointerCapture = vi.fn()` 등). `getBoundingClientRect` 높이도 0이라 `collapsedOffset`이 0이 될 수 있음 — Test 2는 "호출됐다"만 단언하고 최종 앵커 값은 단언하지 않아 이 취약점을 피한다.

→ verify: `pnpm --filter @moajoa/web test:run` — Test 1이 **실패**(현재 본문이 드래그를 시작하므로), Test 2·3도 실패/통과 여부 확인.

## Task 2 — place-sheet.tsx 수정

`apps/web/app/moa/[id]/_components/place-sheet.tsx` 단일 파일:

1. 본문 div(:134-141)에서 `onPointerDown` / `onPointerMove` / `onPointerUp` / `onPointerCancel` **네 개 모두 제거**. 순수 스크롤 컨테이너가 된다.
2. 본문 className에 `overscroll-contain` 추가. `touch-pan-y`(세로 네이티브 스크롤만 허용)와 `overflow-y-auto`는 유지.
3. 내 변경이 만든 고아 정리 (CLAUDE.md §3.3 — **기존 dead code는 건드리지 말 것**):
   - `bodyDragAllowed` (:106-107) 삭제 — 유일한 호출처가 사라짐
   - `bodyRef` (:31) 삭제 + 본문 div의 `ref={bodyRef}` 제거 — scrollTop 읽기 전용이었음
   - `startDrag`의 `allowed` 파라미터 삭제 → `startDrag(e: React.PointerEvent)`. 핸들은 `onPointerDown={startDrag}`로 배선
4. 핸들·헤더 div(:120-131)는 **그대로**. `touch-none` + 드래그 핸들러가 이미 정상.
5. 상단 JSDoc(:18-28)에 새 계약을 한 줄 반영: 본문 = 스크롤 전용(overscroll-contain으로 체이닝 차단), 드래그 = 핸들·헤더 전용. 기존 문체(한국어, 근거 표기) 유지.

→ verify: `pnpm --filter @moajoa/web test:run` 전체 통과 + `pnpm --filter @moajoa/web typecheck` 통과

</tasks>

<out_of_scope>
- `moa-map.tsx` — `gestureHandling: 'greedy'`는 지도 영역 전용 팬으로 이미 의도대로 동작. 무변경.
- `apps/web/app/globals.css` — 공유 파일. 이번 수정은 시트에 국한.
- `moa-island.tsx` — controlled anchor 계약 그대로. 무변경.
- 방향 판정 / non-passive touchmove / preventDefault — 사용자가 명시적으로 배제.
- iOS 앱 — v2.1 웹 퍼스트 동안 동결 (CLAUDE.md §5).
</out_of_scope>

<uat>
로컬 브라우저에서 /moa/[id] (장소 0개 보드):
1. 지도 영역 드래그 → **지도만** 팬. 시트 고정.
2. 시트 핸들·헤더 드래그 → **시트만** 위아래로. 지도 고정, 페이지 안 밀림.
3. 시트 본문(빈 상태 문구 영역) 드래그/트랙패드 스크롤 → 아무것도 안 움직인다 (페이지 전체가 밀리지 않는다).
4. 장소가 여러 개인 보드에서 시트를 펴고 리스트 스크롤 → 리스트만 스크롤, 지도·시트 고정.

드래그 체감·스냅은 jsdom 검증 불가 → 브라우저 UAT 항목 (place-sheet.tsx 주석에 명시된 프로젝트 관행).
</uat>
