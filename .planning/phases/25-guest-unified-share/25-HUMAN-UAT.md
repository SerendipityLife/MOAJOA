---
status: partial
phase: 25-guest-unified-share
source: [25-VERIFICATION.md, 25-USER-SETUP.md]
started: 2026-07-10T00:00:00Z
updated: 2026-07-10T00:00:00Z
---

## Current Test

[awaiting human — 선행: 배포 게이트 2종(원격 0029 push + Manual linking 토글)]

## Tests

### 1. [배포 게이트] 원격 0029 마이그레이션 적용
expected: `git push origin main`(Supabase↔GitHub 자동 적용) 또는 `supabase db push` → `supabase migration list`의 Remote가 0029까지 정합. public_trip_poll·public_trip_view share_mode·cast_date_vote_authed·hide_place_as_member 라이브.
result: pass

### 2. [설정 게이트] Manual linking 활성화
expected: Supabase Dashboard → Authentication → Settings → "Manual linking" ON.
result: pass

### 3. [라이브] SSR 즉시 렌더 + 게스트 참여 완주 (SC1~4)
expected: 비로그인 시크릿 브라우저로 /t/[slug] 열기 → 모아 이름·지도·장소 즉시 렌더(SC1). 첫 찜/추가/투표 시 닉네임 시트 → 익명 인증 → join → 액션 완료(SC2). share_mode별 참여(찜·장소/링크 추가·날짜투표, SC3). 호스트 화면에 실시간 반영 + 게스트 추가 장소 #N+1 순번(SC4).
result: issue
reported: "둘다 모드인데 날짜투표 UI가 안 뜸. 찜(하트)도 안 눌러짐. 닉네임 입력 후엔 호스트형 moa 화면(모으기/채팅 탭 + [함께 정하기])이 뜸."
severity: blocker
notes: "SC1(즉시 렌더)·SC2(닉네임→익명인증→join→참여화면)는 동작 확인됨. SC3(모드별 참여·찜)가 깨짐."

### 4. [라이브] D-12 own-only 삭제 + 계정 승격
expected: 게스트가 자기 장소만 삭제 가능(남의 장소 삭제 어포던스 없음 + API 직타도 DB 거부). "로그인하고 내 여행에 담기" → 카카오 로그인 → linkIdentity로 익명 이력 유지된 채 정식 전환. (⚠️ A4: kakao linkIdentity 지원 배포 전 실 e2e 권장)
result: [pending]

## Summary

total: 4
passed: 2
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "둘다/날짜 모드에서 게스트가 날짜투표에 참여할 수 있다 (SC3)"
  status: failed
  reason: "웹 '둘다 정하기' 공유(shareMoa)가 share_mode만 UPDATE하고 date_poll을 생성하지 않음. public_trip_poll(slug)은 poll 없으면 null 반환 → guest-surface pollMeta=null → 날짜투표 섹션 미렌더. date_poll 생성은 0018 RPC(iOS/별도 플로우)에만 있고 웹 호스트 공유 경로엔 없음. 게다가 후보 날짜 세팅 UI도 웹엔 부재 → 투표할 대상 자체가 없음."
  severity: blocker
  test: 3
  artifacts: [packages/api/src/queries/trips.ts:194 shareMoa, supabase/migrations/0029_public_trip_poll.sql public_trip_poll, apps/web/app/moa/[id]/_components/share-sheet.tsx]
  missing: [웹 호스트 date_poll 생성 + 후보 날짜 세팅 플로우]

- truth: "게스트가 장소에 찜(가고싶어)할 수 있다 (SC3)"
  status: failed
  reason: "join 후 재사용된 MoaIsland의 찜(onToggleVote)이 동작 안 함. RLS(can_vote_trip)는 accepted 멤버 전원 허용이라 게스트 editor도 통과 가능 — 즉 서버 권한 아님. 클라이언트 런타임 이슈 추정(브라우저 콘솔 에러 확인 필요). 코드상 onToggleVote는 정상 형태(optimistic+rollback)."
  severity: blocker
  test: 3
  artifacts: [apps/web/app/moa/[id]/_components/moa-island.tsx:198 onToggleVote]
  missing: [브라우저 콘솔 에러로 근본원인 확정]

- truth: "게스트에게 호스트 전용 컨트롤이 노출되지 않는다 (polish)"
  status: failed
  reason: "GuestSurface가 호스트 MoaIsland를 그대로 재사용(D-08 無수정)해 게스트에게도 [함께 정하기](호스트 공유 버튼)가 보임. 기능 블로커는 아니나 게스트 UX 혼란."
  severity: minor
  test: 3
  artifacts: [apps/web/app/t/[slug]/_components/guest-surface.tsx:336 MoaIsland 재사용]
  missing: [게스트 컨텍스트에서 호스트 전용 컨트롤 숨김]
