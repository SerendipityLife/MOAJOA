# 05-VALIDATION — Phase 5 Verification Plan

**Phase:** 05 — Trust UI & Onboarding
**Generated:** 2026-05-26 (auto mode)
**Requirements:** TRUST-01, TRUST-02, TRUST-03, TRUST-04, ONBOARD-01, ONBOARD-02

Karpathy §3.4 goal-driven: "고쳤어요" 대신 "X가 통과합니다"로 말할 수 있게.

---

## Verification Matrix

각 요구사항 = falsifiable check + 증거 채집 방식.

### TRUST-01 — AI vs 수동 시각 구분 (iOS + Web)

**iOS:**
- [ ] **V1.iOS-1** SQL setup: 같은 보드에 1 AI/high(`source_kind='ai'`, conf=0.9) + 1 AI/low(conf=0.4) + 1 manual(`source_kind='manual'`) 핀.
- [ ] **V1.iOS-2** 보드 상세 진입 — 3 marker 시각 차이 캡처. AI 주황, manual 검정, low_conf opacity 0.5 + `?` 배지.
- [ ] **V1.iOS-3** 만약 Apple Maps opacity 무시 시 — children-only marker 패턴으로 fallback (CONTEXT open_question #2 lock).

**Web:**
- [ ] **V1.Web-1** 같은 보드를 public visibility로 전환 → `/b/<slug>` Mobile Safari iPhone viewport
- [ ] **V1.Web-2** 3 marker 시각 동일 차이 (주황 진함/주황 옅음+?/검정)
- [ ] **V1.Web-3** Marker 클릭 → YouTube 새 탭 (Phase 4 회귀 X)

**Evidence:** screenshots in `.planning/phases/05-trust-ui-onboarding/uat-screens/` (수동 캡처)

### TRUST-02 — 진행 단계 UI (iOS)

- [ ] **V2-1** YouTube URL 추가 → overlay 진입 → step list 4줄 + spinner 모두 가시
- [ ] **V2-2** 첫 broadcast 'metadata' 수신 시 첫 줄 (영상 정보 가져오는 중)이 `text-base font-semibold text-brand-500` (현재)
- [ ] **V2-3** broadcast 'transcript' 전환 시 첫 줄은 `text-sm text-neutral-500` (완료) + ●, 둘째 줄 현재로 highlight 이동
- [ ] **V2-4** 미래 줄(아직 안 온 step)은 `text-xs font-medium text-neutral-300` (UI-SPEC D-22 reassignment audit)
- [ ] **V2-5** broadcast 'done' → overlay dismiss + "{N}개 핀 추가됨" toast (Phase 3 회귀 X)

**Evidence:** iOS 시뮬레이터/실기기 화면 녹화 또는 4 capture (각 step별)

### TRUST-03 — 실패 retry (iOS)

- [ ] **V3-1** 자막 없는 YouTube URL 추가 → "분석 실패: 자막이 없는 영상" toast 등장, 우측 `[재시도]` 가시
- [ ] **V3-2** `[재시도]` 탭 → step indicator overlay 재진입, `triggerExtraction` 재호출 (Supabase logs 확인)
- [ ] **V3-3** toast 8초 후 자동 dismiss (timer)
- [ ] **V3-4** 보드 상세 링크 리스트 행: failed status 행 → "분석 실패 — 탭하여 재시도" (danger 색), 다른 status는 회색
- [ ] **V3-5** failed 행 탭 → retry 트리거. ready/pending/processing 행 탭 → no-op

**Evidence:** capture × 2 (toast retry, link list row)

### TRUST-04 — Low confidence confirm/reject (iOS)

- [ ] **V4-1** low_conf 핀 (conf=0.4) marker 탭 → bottom sheet에 "AI" + "신뢰도 낮음" 배지 2개
- [ ] **V4-2** "AI가 자신 없어해요. 맞으면 확인, 아니면 삭제해 주세요." 안내 텍스트 가시
- [ ] **V4-3** `[확인]` + `[잘못됨]` 두 버튼이 stack 위쪽에 인서트, 그 아래 기존 [이름 수정][영상에서 위치][삭제]
- [ ] **V4-4** `[확인]` 탭 → SQL `SELECT source_kind, confidence FROM places WHERE id='<x>'` → `manual, NULL`. Marker 색이 검정으로 즉시 전환 (수동 시각)
- [ ] **V4-5** 다른 low_conf 핀 `[잘못됨]` 탭 → SQL `hidden_at` not null. Marker 사라짐
- [ ] **V4-6** high_conf AI 핀 탭 → 기존 Phase 3 sheet 그대로 (신규 액션 X)
- [ ] **V4-7** manual 핀 탭 → 신규 액션 X (isAI false)

**Evidence:** capture × 3 (low_conf sheet, after confirm, after reject)

### ONBOARD-01 — 첫 보드 자동 생성

- [ ] **V5-1** 신규 가입 직후 `SELECT count(*) FROM boards WHERE owner_id = '<new-user-id>'` = 1
- [ ] **V5-2** 자동 보드 title = `'내 첫 여행'`, visibility = `'private'`
- [ ] **V5-3** 기존 dogfooder(본인) profile에 backfill 적용 — 사용자가 이미 보드 N개 있어도 backfill 트리거의 NOT EXISTS 가드 통과 시 카운트 1+
- [ ] **V5-4** 트리거 idempotency: 같은 트랜잭션 재시도 시 중복 생성 X (NOT EXISTS guard)
- [ ] **V5-5** 신규 가입 후 보드 목록 진입 → empty state 카피 ("아직 보드가 없어요") 노출 X — "내 첫 여행" 카드 1개 가시

**Evidence:** SQL output + iOS 보드 목록 capture

### ONBOARD-02 — 안내 카드

- [ ] **V6-1** AsyncStorage clear 상태에서 빈 보드 진입 → amber 카드 가시 ("유튜브 링크를 붙여넣어 보세요")
- [ ] **V6-2** 카드 leading 이모지 💡, trailing × 가시
- [ ] **V6-3** URL TextInput 위 위치 (UI-SPEC wireframe과 시각 매칭)
- [ ] **V6-4** × 탭 → 카드 즉시 unmount, AsyncStorage `@moajoa/onboard:link_card_dismissed = 'true'`
- [ ] **V6-5** 다른 빈 보드 진입 → 카드 표시 X (글로벌 dismiss)
- [ ] **V6-6** URL 1개 추가 → 카드 즉시 숨김 (links > 0)
- [ ] **V6-7** AsyncStorage.removeItem 후 재진입 → 카드 다시 표시 (회복 가능)

**Evidence:** capture × 2 (카드 가시, dismiss 후 X)

---

## Cross-cutting (회귀 방지)

- [ ] **R-1** Phase 3 single bottom sheet — manual 핀 탭 시 신규 액션 안 보임, "영상에서 위치"도 안 보임 (isAI false)
- [ ] **R-2** Phase 4 web `/b/<slug>` SSR cold load p90 < 800ms (VIEW-01 회귀 X)
- [ ] **R-3** Phase 4 OG image render 정상 — 0006 마이그레이션이 public_board_view 재정의했지만 OG 호출자는 같은 jsonb shape에서 필요한 필드만 추출
- [ ] **R-4** Phase 3 success/info toast 단일 텍스트 그대로 (action slot은 optional)
- [ ] **R-5** `pnpm -F @moajoa/core build && pnpm -F @moajoa/api build && pnpm -F web build` 통과
- [ ] **R-6** TypeScript strict: 모든 파일 컴파일

---

## Migration Apply Sequence

```bash
# Local
supabase db reset      # full replay 0001-0006
pnpm supabase:types    # regen database.ts
pnpm install           # if any new dep (none expected)
pnpm -r build          # core, api, web

# Production (Phase 5 merge 후)
supabase db push       # 0006 apply
# Edge Function redeploy: extract-youtube + (no new functions)
# Vercel: NEXT_PUBLIC_* unchanged. 자동 redeploy로 web 최신.
```

---

## Out of Scope (verification not required)

- Push notification, 다국어, 다크 모드 — REQUIREMENTS Out of Scope
- p90 timing (Phase 6 SQL aggregate에서 측정)
- Sentry 로깅 (OBS-01 v2)
- Web confirm/reject (D-17 lock)
- OG image AI/manual 비율 (D-25 v2)

---

## Dogfooding Bridge (Phase 6 준비)

본 phase 끝나면 Phase 6 entry 조건:
- 본인 7일 사용 시작 가능 (TRUST 4 + ONBOARD 2 surface 모두 가시)
- confident-wrong 발생 시 사용자가 `[잘못됨]`으로 dataset에 fold (Phase 6 baseline 측정 입력)
