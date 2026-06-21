# Research Summary — MOAJOA v2.0 (전면 개편: 발견→예약→정산)

> 4개 병렬 리서치(STACK·FEATURES·ARCHITECTURE·PITFALLS) 종합. 요구사항·로드맵의 입력.
> **작성:** 2026-06-21 · Confidence: MEDIUM-HIGH

## 1. Stack additions — 신규 vs 기존 재사용

**신규 추가 (선투자 최소):**
- **Stay22 Allez 딥링크** (AID) — 숙소 지도형 비교. URL 템플릿만으로 생성, per-link API 불필요.
- **Travelpayouts** (marker) — 액티비티·교통·eSIM·항공 110+ 브랜드를 단일 계정/단일 정산.
- **Google Routes API** (`computeRouteMatrix`) — 플랜 이동시간 그라운딩. 기존 콘솔/키 재사용. legacy Directions/Distance Matrix는 2026-02 deprecated.
- **인바운드 이메일 인프라** — 프로바이더 미정(회색지대 §5).
- **Google Maps Android 키 + EAS Android 프로파일** — 재작성 아님, 빌드 타깃 + 키 분리.

**재사용 (신규 비용 0):**
- claude-sonnet-4-6 — extract-youtube 패턴 그대로 `parse-email`·`generate-plan`에 재활용(별도 LLM 도입 X).
- `share_slug` + `join_shared_board` — 날짜 투표 비로그인 초대 링크.
- 추출 파이프라인(status-column + claim + async + extraction_costs) — 가계부 파싱 구조 미러.

## 2. Feature table stakes / differentiators / anti-features

**Table stakes:** ① 시작 분기 + day 단위 날짜 투표(비로그인 링크) + 대표 식별 · ② 확정 장소 자동 배치 + 이동시간 + 드래그 재배치 + "초안" 명시 · ③ 딥링크 제휴 예약 4카테고리 + 인라인 카드 · ④ 전용 전달주소 + 등록주소만 수신 + AI 파싱(카드·통화·환율·결제시점) + 원화 환산 + 수동 fallback.

**Differentiators:** 추출 즉시 자동 플랜("아하 순간") + Places 영업시간 grounding · 투표를 같은 플랜 위에 얹기 + 카톡 OG · 통합 예약 체크리스트(대표) + 우리 미경유 예약 포착 + 환율차 가시화.

**Anti-features:** AI 플랜 자동 확정/영업시간·가격 단정, TSP 풀최적화, 모든 카드 실시간 가격, MOR 결제, 영수증 사진 다중 업로드, From 헤더 사용자 식별, 시간대 그리드 투표.

## 3. Architecture & build order (의존성)

> **★ 전제 (Pitfall 9, 맨 앞):** `packages/core`에 트립 스코프 **식별자 계약**(SubID 인코딩 `tripId[.placeId][.userId]`, 가계부·플랜 슬롯·예약 클릭이 모두 `trip_id`(+가능시 `place_id`) 보유)을 Phase A에서 잠그고 이후 전 phase가 import. 빠지면 초기 전환이 영구 익명화 → BM 플라이휠 붕괴(복구 불가).

- **Phase A — 기반:** 0016 마이그레이션(board_id 매달기 + RLS 헬퍼 재사용) + core Zod(동일 PR) + Expo Router `trip/[id]/(tabs)/{map,plan,book,ledger}` + index 진입분기 + 식별자 계약. **의존 없음, 비협상 첫 번째.**
- **Phase B — 플랜 ②:** `generate-plan` EF(claude + Routes 행렬) + plan.tsx. 의존 A. C와 병렬.
- **Phase C — 날짜 투표 ①:** date_polls/options/votes + share_slug 재사용. 의존 A. B와 병렬.
- **Phase D — 예약 ③:** `booking-redirect` EF(marker URL + 'clicked') + book.tsx. 의존 A+B. C와 병렬.
- **Phase E — 가계부 ④:** `inbound-email`+`parse-email` EF + ledger.tsx. 의존 A. **메일 인프라 리드타임 길어 A 직후 착수.**
- **Phase F — Android:** EAS 프로파일 + 키 분리 + 실기기 QA + Data Safety 폼. 의존 A–E.

## 4. Watch Out For (상위 함정 + 예방)

1. **SubID 누락 → 수수료 Unknown** — `buildAffiliateUrl` 단일 헬퍼, 손조립 금지, Day1 포맷 확정, Stay22 도메인 claim. exit gate = 전환 1건이 SubID로 어트리뷰션.
2. **인앱 브라우저 쿠키 격리/짧은 윈도우** — Stay22→Booking 24h. **시스템 브라우저**로 열어 쿠키 보존.
3. **전달메일 식별: From이 아니라 To 토큰** — opaque 토큰 박기, SPF/DKIM 검증, 본문 최소저장/TTL.
4. **LLM 플랜 환각** — 하이브리드(LLM=클러스터링/순서만, 영업시간·이동시간은 Places+Routes 후처리), 좌표 없는 장소 자동배치 금지, 비용 가드레일.
5. **환율 3중 불일치** — (원통화 금액 + 통화코드 + fx_rate + fx_source + fx_as_of) 원자 저장, ₩는 표시용 파생값.

*(추가: IA 옛 링크 리다이렉트 유지 · Android 패리티 실기기 검증 · Play Data Safety 폼 일치.)*

## 5. 회색지대 / Open questions (discuss-phase에서 잠글 것)

- **★ 인바운드 메일 프로바이더 — 에이전트 충돌:** STACK=**Cloudflare Email Routing + Worker**(무료, DNS만, postal-mime로 raw MIME 직접 파싱 / 단 Worker 한 단계 추가, SPF·DKIM 직접 처리). ARCHITECTURE·PITFALLS=**SendGrid/Mailgun/Postmark**(파싱·SPF/DKIM ergonomics 최고 / 단 비용·별도 계정·도메인 인증). 패턴(catch-all 서브도메인 → To 토큰 매칭)은 동일. → **Phase E discuss에서 결정.** 어느 쪽이든 Pitfall 3·4는 동일 적용.
- **★ "가격비교" 범위:** 딥링크로는 **실시간 가격 불가**. MVP = "비교 **링크 묶음**"(1~2곳 딥링크), 실시간 위젯은 트래픽 후 v2.x. → Phase D discuss 명문화.
- **플랜 트리거:** 옵션 A(extract 끝 fire-and-forget, 권장) vs B(클라 Realtime). → Phase B.
- **IA 보드↔trip 매핑 + 옛 링크 리다이렉트 + 0/1/N 진입 엣지.** → Phase A.
- **Routes API 비용 vs 추출당 <$0.005 예산.** → Phase B 검증.
- **문서 드리프트:** PROJECT.md/PRODUCT.md "SDK 54" → 실제 **SDK 56** (PROJECT.md 정정 완료).

## Research Flags

- **Needs deeper research (plan-phase):** Phase E(가계부 — 프로바이더 충돌 + 전달 포맷 + 환율), Phase D(어트리뷰션·쿠키 실측), Phase B(Routes 비용·그라운딩).
- **Standard patterns (discuss로 충분):** Phase A(검증된 마이그레이션/RLS/Router), Phase C(votes·share_slug 복제).
