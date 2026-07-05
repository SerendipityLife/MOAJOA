# Phase 21: Travel Ledger (메일 전달 가계부) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 21-travel-ledger
**Areas discussed:** 메일 수신 인프라, 가계부 공유 범위, trip 매칭, 환율 소스

---

## 메일 수신 인프라 (리서치 에이전트 충돌 해소)

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare Email Routing | 무료·수신량 제한 없음. DNS를 CF로 이전 필요. Email Worker → raw MIME → Supabase EF POST. SPF/DKIM은 CF 검증 헤더 활용 (리서치 STACK안) | ✓ |
| SendGrid Inbound Parse | DNS 이전 불필요(서브도메인 MX만). 웹훅에 파싱 필드 + SPF/DKIM 결과 정리 도착 — ergonomics 최고. Twilio 계정 + 무료 티어 정책 변동 리스크 (리서치 ARCHITECTURE·PITFALLS안) | |
| Mailgun / Postmark | 유사 인바운드 파싱, 유료(월 $15+) — 초기 볼륨에 과함 | |

**Notes:** 어느 쪽이든 catch-all 서브도메인 → To 토큰 매칭 패턴 동일(스왑 비용 낮음 → deferred에 전환 조건 기록). moajoa.app DNS 이전은 사용자 측 외부 준비물, 리드타임 있어 조기 착수.

---

## 가계부 공유 범위

| Option | Description | Selected |
|--------|-------------|----------|
| 멤버 공유 열람 | trip 멤버 전원 열람, 수정·삭제는 전달한 본인만. '정산' 컨셉 전제. 기존 can_read_trip 헬퍼 재사용 | ✓ |
| 개인 전용 | 본인 항목만 본인 열람. 공유·정산은 후속 phase. RLS 단순 | |

---

## trip 매칭 (전달 메일 → 여행 배정)

| Option | Description | Selected |
|--------|-------------|----------|
| AI 추정 + 미분류 인박스 | 확신 있을 때만 자동 배정, 애매하면 미분류로 남겨 1탭 배정 — LEDGER-06 수정 UX와 한 흐름 | ✓ |
| 항상 미분류 → 수동 배정 | 오배정 0, 대신 매번 1탭 필요 | |
| 진행 중 trip 자동 배정 | 여행 1개면 무조건 그 여행. 규칙만이라 단순하나 지난 여행 메일 오배정 가능 | |

---

## 환율 소스 (LEDGER-03)

| Option | Description | Selected |
|--------|-------------|----------|
| 메일 명시값 우선 + API fallback | 메일에 청구 환율/원화 환산액 있으면 그 값(fx_source='email' — 실청구액 일치), 없으면 결제일 기준 무료 API | ✓ |
| 환율 API 단일 소스 | 일관성 있으나 실제 카드 청구액과 괴리(카드사 환율·수수료 미반영) | |
| 한국은행 고시환율 | 공신력 있는 KRW 기준. API 키 발급 + 주말·공휴일 미고시 처리 부담 | |

**Notes:** 환율 5요소(원통화 금액·통화코드·fx_rate·fx_source·fx_as_of) 원자 저장 + KRW 표시용 파생은 리서치 Pitfall 5에서 선잠금 — 논의 대상은 소스만. 구체 API 선택은 plan 단계 실측.

---

## 리서치 선잠금 재확인 (재논의 없음)

- 사용자 식별 = **To 토큰**(From 헤더 식별은 안티피처) + SPF/DKIM 게이트 (Pitfall 3)
- 메일 본문 최소 저장 + TTL (Pitfall 3)
- LLM = claude-sonnet-4-6 재활용, 파이프라인 = extract-youtube 미러(status/claim/async/extraction_costs)
- 영수증 사진 업로드 = 안티피처 → out of scope
