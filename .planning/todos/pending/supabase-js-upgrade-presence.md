---
created: 2026-06-28
priority: medium
source: 19-DISCUSSION-LOG.md GAP-19D (UAT-driven), phase 19 잔여 UAT
blocked_on: discuss-phase 결정 (타깃 버전·스코프·검증 게이트) + 마일스톤 슬롯 (현 v2.0 17~22는 기능 phase로 만차 → 다음 마일스톤 또는 별도 인프라 phase)
---

# @supabase/supabase-js 업그레이드 (presence 복구)

## 배경
phase 19 웹 비로그인 투표 island의 presence("지금 N명 보는 중")가 **실제로 미동작**한다 (GAP-19D, 2026-06-28 조사). "로컬 미검증"이 아니라 원격 realtime에서도 깨져 있다 — 사람이 2-브라우저로 봤어도 양쪽 빈 화면.

격리 증거 (코드와 동일 SDK·키·서버로 직접 재현):
- **broadcast(투표 fan-out)는 정상** — 2-클라이언트 ping 송수신 OK. 채널 조인·publishable 키 인증 문제 없음.
- **presence만 실패** — `track()`은 `"ok"`인데 `sync` 콜백 영영 안 뜸. raw 프레임: 서버는 `presence_diff` 정상 전송하나 **초기 `presence_state` 스냅샷 미전송**.
- realtime-js **2.10.2** 소스: `presence_state`로 `joinRef` 세팅 전엔 모든 diff를 `pendingDiffs`에 큐잉하고 `onSync` 미호출 → state 안 오면 영영 잠김.
- 최신 realtime-js **2.108.2로 동일 테스트 → PASS** (두 클라 2명 수렴).

근본 원인: 핀된 `@supabase/supabase-js@^2.45.4`(→ realtime-js 2.10.2)가 현재 Realtime 서버 presence 프로토콜과 비호환. `apps/web/app/poll/[code]/_components/poll-vote-island.tsx` 앱 코드 자체는 정상.

현재 영향: presence strip은 `viewers > 0` 게이트 → 깨진 UI 없이 조용히 no-op. **사용자 피해 0** (그래서 급한 장애 아님, 큐잉 처리).

## 해법
`@supabase/supabase-js`를 현재 Realtime 서버와 presence 호환되는 버전으로 모노레포 전체 업그레이드. fix가 동작함은 2.108.2로 실측 확인.

영향 패키지 (현재 모두 `^2.45.4` 단일 버전, hoisted):
- `packages/api` — Supabase 클라이언트 + 타입드 쿼리
- `apps/web` — `@supabase/ssr ^0.5.1` + supabase-js
- `apps/ios` — supabase-js (React Native realtime 트랜스포트)

## 결정 필요 (discuss-phase에서 잠금)
- **타깃 버전:** 최신 2.x(2.108.x) vs presence 고치는 최소 버전으로 보수적 핀. (점프 폭 ↔ 회귀 위험 트레이드오프)
- **스코프/순서:** web/api/ios 동시 vs web 먼저→iOS 후속. iOS는 RN이라 realtime ws 트랜스포트 회귀 위험 최상.
- **`@supabase/ssr` 동반 bump:** 0.5.1 → 0.6.x 필요 여부 (신 supabase-js 호환).
- **타이밍:** 이번에 별도 인프라 phase로 vs 다음 마일스톤. (현 v2.0 17~22는 기능 phase로 만차)

## 검증 기준
- presence 2-클라이언트(또는 2-브라우저) → 양쪽 viewer count 수렴 (이 todo의 재현 스크립트 패턴 = scratchpad presence-check)
- web realtime 스모크: 투표 broadcast fan-out + presence strip 라이브 (원격 backed)
- iOS sim realtime 스모크: subscribePollChannel 정상 (RN 트랜스포트 회귀 0)
- auth/매직링크 + 타입드 쿼리 회귀 0 (supabase-js major 동작 변화 확인)
- Edge Functions(Deno) 영향 확인 — Deno는 별도 import map이라 무관할 가능성 높으나 확인
- `pnpm supabase:types` 재생성 후 diff 0 (스키마 무변경)

## 주의 (surgical / 충돌 위험)
- supabase-js는 web+iOS+Edge 공유 의존 (CLAUDE.md §4.2 충돌 위험 영역) — 임의 bump 금지, discuss 경유.
- 마이그레이션/스키마 무변경 (append-only 규칙 무관).
- presence strip 앱 코드는 손대지 않음 — 버전만 올리면 동작. broadcast 경로도 무변경.
