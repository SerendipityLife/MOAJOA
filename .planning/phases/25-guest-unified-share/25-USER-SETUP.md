# Phase 25: User Setup Required

**Generated:** 2026-07-10
**Phase:** 25-guest-unified-share
**Status:** Incomplete

Complete these items for the Phase 25 backend seam to function in production. Claude
automated everything local (0029 applied via `supabase db reset`, types regenerated,
smoke green); the remaining step requires pushing the migration to the remote Supabase
project — a production DB change Claude does not force autonomously.

## Dashboard Configuration

- [ ] **원격 Supabase에 0029 마이그레이션 적용**
  - **경로 A (권장, 0028 선례):** 로컬 커밋을 `origin/main`에 push → Supabase↔GitHub 통합이 새 마이그레이션(0029)을 자동 적용
    ```bash
    git push origin main
    ```
  - **경로 B (수동):** 링크된 프로젝트에 직접 push (colima+docker 가동 상태)
    ```bash
    supabase db push
    ```
  - **적용되는 것:** `public_trip_poll(slug)` anon RPC · `public_trip_view` share_mode 추가 · `cast_date_vote_authed`(서버파생 device_token) · `hide_place_as_member`(D-12 own-only 소프트삭제)
  - **주의:** 라이브 dates/both 게스트 날짜투표 · share_mode SSR 화면 분기 · D-12 own-only 삭제는 이 적용 후에만 동작 (Plan 02/03/05 라이브 검증 전제)

## Verification

원격 적용 후:

```bash
# 원격 마이그레이션 목록에 0029 반영 확인
supabase migration list

# (선택) 로컬 스모크 재실행 — anon poll read + share_mode + own-only hide
bash supabase/tests/public_trip_poll_smoke.sh
```

Expected results:
- `supabase migration list`의 Remote 컬럼이 `0029`까지 정합
- 스모크 exit 0 (`PASS: public_trip_poll(anon) + public_trip_view.share_mode=dates + hide_place_as_member own-only`)

---

**Once all items complete:** Mark status as "Complete" at top of file.
