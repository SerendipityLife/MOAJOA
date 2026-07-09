---
phase: 26-realtime-chat
reviewed: 2026-07-10T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - supabase/migrations/0028_chat_realtime_publication.sql
  - packages/api/src/queries/chat.ts
  - packages/api/src/queries/chat.test.ts
  - packages/api/src/queries/index.ts
  - apps/web/app/moa/[id]/_components/moa-chat.tsx
  - apps/web/app/moa/[id]/_components/moa-tab-bar.tsx
  - apps/web/app/moa/[id]/_components/moa-island.tsx
  - apps/web/app/moa/[id]/page.tsx
  - apps/web/app/moa/[id]/_components/place-list.tsx
  - apps/web/__tests__/moa-chat.test.tsx
  - apps/web/__tests__/moa-island.test.tsx
  - apps/web/__tests__/place-list.test.tsx
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
  resolved: [WR-01, IN-01]
status: issues_found
---

# Phase 26: 코드 리뷰 리포트 (Realtime Chat)

**리뷰 일시:** 2026-07-10
**깊이:** standard
**리뷰 파일 수:** 12
**상태:** issues_found (Warning 1 · Info 2 · Critical 0)

## 요약

실시간 채팅(postgres_changes + presence, 단일 `moa:{tripId}` 채널) 기능을 리뷰했습니다.
집중 점검 항목은 전부 양호합니다:

- **RLS/보안 (0028 트리거):** `trip_messages_default_user_id()`가 `security definer`
  + `set search_path = public`로 `new.user_id`가 null일 때만 `auth.uid()`를 채웁니다.
  `sendTripMessage`는 insert 객체에 `user_id`를 **넣지 않고**, 0025 INSERT RLS의
  `with check (user_id = auth.uid() ...)`가 트리거 실행 **후** 최종 행을 검증합니다
  (Postgres BEFORE 트리거 → RLS WITH CHECK 순서). 클라이언트가 남의 `user_id`를 위조해도
  WITH CHECK에서 거부됩니다. `chat.test.ts`의 `not.toHaveProperty('user_id')` 단언이 이 계약을
  회귀 보호합니다. **인증 우회/user_id 스푸핑 경로 없음.**
- **채널 바인딩 순서:** 4개 `.on()` 바인딩(places INSERT · links UPDATE · trip_messages INSERT ·
  presence sync)이 전부 `.subscribe()` **이전**에 체이닝됨 — postgres_changes negotiate 타이밍
  이슈(#1917) 없음. 테스트 1이 3개 pg 바인딩 + presence를 단언.
- **effect cleanup:** `return () => void client.removeChannel(channel)` 정상. 테스트 2가 동일
  인스턴스 removeChannel을 검증. 탭 전환은 hidden 토글이라 언마운트/채널 churn 없음(테스트 12).
- **XSS:** `m.body`·`m.nickname`·`p.name`은 모두 JSX text child로 렌더 → React 자동 이스케이프.
  `dangerouslySetInnerHTML`/`eval`/`innerHTML` 사용 0.
- **echo dedup:** 전송자가 자기 INSERT echo를 받아도 `appendMessage`가 id로 dedup(테스트 10).
- **`.js` 워크스페이스 import 위반:** 없음. `@moajoa/core`·`@moajoa/api` 모두 확장자 없음(§4.5 준수).
- **Zod 검증:** `handleSend`가 UI 경계에서 `TripMessageCreateSchema.parse`로 검증(§4.5 준수).
- **마이그레이션 append-only:** 0028은 신규 번호, 기존 SQL 미수정(§4.3 준수).

아래는 정확성·UX 관점의 경미한 항목들입니다. 배포 차단(blocker)은 없습니다.

## Warnings

### WR-01: 한글 IME 조합 중 Enter가 조기 전송을 유발 ✅ RESOLVED (commit 197f5fc)

> **해결됨:** `onKeyDown`에 `!e.nativeEvent.isComposing` 가드 추가 + 회귀 테스트
> (`moa-chat.test.tsx` — Enter+isComposing:true → onSend 미호출). web 10/10 그린·tsc 0.

**File:** `apps/web/app/moa/[id]/_components/moa-chat.tsx:154`
**Issue:** compose 입력의 `onKeyDown`이 `e.key === 'Enter'`만 검사하고 IME 조합 상태를
확인하지 않습니다. 한글 입력 중 마지막 자모가 조합 중일 때 Enter를 누르면
(예: 확정 목적으로) `keydown` Enter가 `isComposing=true`로 발화해 조합이 끝나기 전에
메시지가 전송됩니다. 한국어가 1차 사용자층인 채팅에서 흔한 오전송/중복 전송 버그입니다.
**Fix:** 조합 중 Enter를 무시합니다(표준 패턴).
```tsx
onKeyDown={(e) => {
  if (e.nativeEvent.isComposing) return; // IME 조합 중 Enter 무시
  if (e.key === 'Enter') void send();
}}
```

## Info

### IN-01: 장소를 1.5s 내에 닫으면 하이라이트 링이 남는 엣지 케이스 ✅ RESOLVED

> **해결됨:** highlight effect가 `openPlaceId → null`일 때 `setHighlightId(null)`로 즉시
> 링을 끄도록 수정 + 회귀 테스트(`place-list.test.tsx` Test 14 — 타이머 전 닫으면
> `data-highlighted` 소멸). web 14/14 그린·tsc 0.

**File:** `apps/web/app/moa/[id]/_components/place-list.tsx:73-78`
**Issue:** 하이라이트 effect는 `if (!openPlaceId) return;`으로 시작합니다. 사용자가
칩/마커 탭으로 행을 연 뒤 1.5s 타이머가 끝나기 전에 그 행을 닫으면(`openPlaceId → null`),
React가 이전 run의 cleanup으로 타이머를 먼저 clear한 다음 effect 본문에서 조기 return합니다.
결과적으로 `highlightId`를 끄는 주체(타이머)가 사라져 링(`ring-2 ring-brand-300`)이 다음
`openPlaceId` 변경 전까지 해당 행에 계속 남습니다. 시각적 잔상일 뿐 기능/데이터 영향은 없습니다.
**Fix:** null로 바뀔 때도 하이라이트를 끕니다.
```tsx
useEffect(() => {
  if (!openPlaceId) {
    setHighlightId(null);
    return;
  }
  setHighlightId(openPlaceId);
  const t = setTimeout(() => setHighlightId(null), 1500);
  return () => clearTimeout(t);
}, [openPlaceId]);
```

### IN-02: 채널 effect 의존성에서 currentUserId·currentUserNickname 누락(의도된 disable)

**File:** `apps/web/app/moa/[id]/_components/moa-island.tsx:158-195`
**Issue:** realtime effect가 `currentUserId`(presence key)와 `currentUserNickname`
(track payload)을 클로저로 읽지만 deps는 `[trip.id]`뿐이고 `react-hooks/exhaustive-deps`가
disable돼 있습니다. 현재 라우팅상 이 값들은 마운트 동안 안정적이라 실질 버그는 아니며,
채널 재생성을 막으려는 의도된 설계(D-02, "ONE channel per screen")로 보입니다. 다만 향후
사용자 전환이 리마운트 없이 일어나면 stale presence/nickname이 track될 수 있으니, disable
사유를 주석 한 줄로 남겨두면 유지보수에 도움이 됩니다.
**Fix:** (선택) `eslint-disable` 위에 "presence key/nickname은 마운트 동안 불변 — 의도적으로
deps 제외(채널 churn 방지)" 근거 주석 추가. 코드 변경 불필요.

---

_Reviewed: 2026-07-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
