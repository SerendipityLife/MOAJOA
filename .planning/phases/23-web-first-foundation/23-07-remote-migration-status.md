# 23-07 Task 1 — 원격 마이그레이션 상태 실측 (2026-07-08)

`supabase migration list` 실행 결과 (linked project: `xfoauhsraguyrifingct`, CLI 2.101.0).
**`supabase db push` 미실행** — Open Q1 결정: 원격 push는 phase 23 범위 외.

## 로컬 vs 원격 적용 상태

| Migration | Local | Remote | 비고 |
|-----------|-------|--------|------|
| 0016~0023 | ✓ | ✓ | 정합 — 17-03 "remote reset deferred" 이후 0022(ledger)·0023까지 원격 적용 확인됨 |
| 0024_place_seq | ✓ | ✗ | 로컬 전용 (23-01 작성, 23-04 로컬 적용) |
| 0025_web_share | ✓ | ✗ | 로컬 전용 (23-02 작성, 23-04 로컬 적용) |

## 후속 (잠금)

**Phase 24가 Vercel Preview에서 카카오 e2e를 하려면 그 전에 `supabase db push`(0024·0025)가 필요하다.**
원격에는 `join_moa` RPC·`trip_messages`·`share_mode`·`seq_no`가 아직 없으므로, push 전에는
프로덕션/Preview에서 웹 공유·join·채팅 경로가 동작하지 않는다. 이 파일의 내용은 23-07-SUMMARY.md에
표로 옮겨 기록한다.
