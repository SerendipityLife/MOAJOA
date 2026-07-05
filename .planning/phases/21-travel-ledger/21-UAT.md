---
status: testing
phase: 21-travel-ledger
source: [21-VERIFICATION.md]
started: 2026-07-05T22:15:00Z
updated: 2026-07-05T22:15:00Z
---

## Current Test

number: 1
name: 21-04 Task 5 — CF 인프라 배포 + DNS 이전 + 시크릿 배선 (선행/BLOCKING)
expected: |
  moajoa.app DNS를 Cloudflare로 이전 → Email Routing 활성화 + Worker(moajoa-inbound-email) 지정 →
  INGEST_SECRET 양쪽(Worker + EF) 동일 배선 → supabase functions deploy inbound-email parse-email +
  wrangler deploy → EXPO_PUBLIC_FORWARDING_DOMAIN 확정.
  스모크: 본인 메일 1건 전달 → ledger_entries 행 생성 확인.
awaiting: user response

## Tests

### 1. 21-04 Task 5 — CF 인프라 배포 + DNS 이전 + 시크릿 배선 (선행/BLOCKING)
expected: moajoa.app DNS를 Cloudflare로 이전 → Email Routing 활성화 + Worker(moajoa-inbound-email) 지정 → INGEST_SECRET 양쪽(Worker+EF) 동일 배선 → supabase functions deploy inbound-email parse-email + wrangler deploy → EXPO_PUBLIC_FORWARDING_DOMAIN 확정. 스모크: 본인 메일 1건 → ledger_entries 행 생성 확인
why_human: 사용자 계정 작업(DNS 소유권 이전 + CF 대시보드) — 리드타임 있는 계정 태스크. 실행 중 '코드만 커밋' 결정(의도적 defer)
result: [pending]

### 2. 21-05 Task 5 — 디바이스 가계부 흐름 + 실메일 파싱 UAT (CF 배포 완료 전제)
expected: 1) pnpm sim/실기기 → me 탭 전달주소 복사(LEDGER-01) 2) 예약/카드 메일 전달 → ledger 탭 항목 자동 생성 + 환율 출처 배지(실청구/추정/확인안됨) 정확성(LEDGER-03) 3) 미분류→1탭 배정→멤버 공유, needs_review→1탭 수정→ready(LEDGER-06) 4) 외화 메일로 5요소 보존 + KRW 파생 확인(LEDGER-03) 5) 한국 카드사 실포맷 claude 프롬프트 정확도(RESEARCH A3)
why_human: 실기기 + 실제 메일 전달 + 라이브 파이프라인 필요 — 자동화 불가. 21-04 Task 5 CF 배포에 의존
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
