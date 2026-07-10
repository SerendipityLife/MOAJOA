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
result: [pending]

### 2. [설정 게이트] Manual linking 활성화
expected: Supabase Dashboard → Authentication → Settings → "Manual linking" ON. (config.toml 로컬 값은 커밋됨; 원격은 대시보드 토글 필수) → linkIdentity(D-03) 런타임 동작.
result: [pending]

### 3. [라이브] SSR 즉시 렌더 + 게스트 참여 완주 (SC1~4)
expected: 비로그인 시크릿 브라우저로 /t/[slug] 열기 → 모아 이름·지도·장소 즉시 렌더(SC1). 첫 찜/추가/투표 시 닉네임 시트 → 익명 인증 → join → 액션 완료(SC2). share_mode별 참여(찜·장소/링크 추가·날짜투표, SC3). 호스트 화면에 실시간 반영 + 게스트 추가 장소 #N+1 순번(SC4). 새로고침 시 동일 신원(찜·추가 이력 유지).
result: [pending]

### 4. [라이브] D-12 own-only 삭제 + 계정 승격
expected: 게스트가 자기 장소만 삭제 가능(남의 장소 삭제 어포던스 없음 + API 직타도 DB 거부). "로그인하고 내 여행에 담기" → 카카오 로그인 → linkIdentity로 익명 이력 유지된 채 정식 전환. (⚠️ A4: kakao linkIdentity 지원 배포 전 실 e2e 권장)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
