# Stack Research — MOAJOA v2.0 전면 개편 (발견→결정→플랜→예약→정산)

**Domain:** AI 여행 라이프사이클 플랫폼 (TS 모노레포: Next.js 15 web + Expo SDK 56 iOS/Android + Supabase)
**Researched:** 2026-06-21
**Confidence:** HIGH (제휴/이메일/라우팅/Android = 공식 문서 교차검증) · MEDIUM (제휴 수수료율·승인 장벽 = 커뮤니티 사례 기반)

---

## 0. 연구 범위 — 신규 capability만

이 문서는 **이미 동작 중인 코어 스택을 재조사하지 않는다.** v2.0 신규 기능 5개(+이후 2개)에 필요한 *추가/변경*만 다룬다.

**확정된 코어 (변경 X — 코드베이스에서 실측 검증):**
- `expo@~56.0.12` · `react-native@0.85.3` · `react@19.2.3` · `expo-router@~56.2.11` · `expo-share-intent@^7.0.0` · `nativewind@^4.2.5` · `react-native-maps@1.27.2`
- Next.js 15 (App Router, web 열람) · Supabase (Postgres + PostGIS + RLS + Edge Functions(Deno) + Realtime)
- Anthropic `claude-sonnet-4-6` (extract-youtube Edge Function에서 이미 구조화 추출에 사용 중) · Google Places API · Zod · pnpm workspaces

> **주의 — 문서 드리프트:** `.planning/PROJECT.md`와 `docs/PRODUCT.md`는 "Expo SDK 54"로 적혀 있으나 실제 `apps/ios/package.json`은 **SDK 56**(RN 0.85 / React 19.2)이다. 이 STACK은 실측 기준으로 작성. PROJECT.md 갱신 필요.

---

## 1. 제휴/예약 수익화 — 가격비교 + 딥링크 (MVP 핵심)

### 1.1 결정 요약

| 영역 | 결정 | 방식 | WHY |
|---|---|---|---|
| **숙소 (지도형 비교)** | **Stay22 Allez Deeplink** | URL 템플릿 (per-link API 호출 불필요) | ML이 사용자 지역/언어/통화 보고 최적 OTA(Booking/Agoda/Expedia/Airbnb 등)로 라우팅. 우리는 좌표·날짜만 채워 URL 생성 |
| **액티비티·교통·eSIM·항공** | **Travelpayouts** | Partner-link API 또는 deeplink 수동 생성 | Klook·GetYourGuide·Airalo·Trip.com·Booking·Agoda 등 110+ 브랜드를 **단일 계정/단일 정산**으로 커버 |
| 숙소 실시간 가격 inline (옵션) | Stay22 **Direct Travel API** | REST (`/v1/accommodations`) | 자체 UI에 실가격 카드 노출이 필요할 때만. MVP는 딥링크로 충분 |

**전략: 딥링크 먼저, API는 트래픽 후.** 두 네트워크 모두 가입·승인·정산이 **하나**로 묶이므로 통합 부담이 작다. 코드상으로는 "장소/날짜 → 제휴 URL 빌더" 순수 함수 하나가 MVP의 80%.

### 1.2 Travelpayouts — 가입/승인/정산

| 항목 | 내용 |
|---|---|
| **가입 장벽** | 낮음. 무료 가입 후 **프로그램별로 연결**. 일부는 즉시 승인, 일부는 브랜드 심사(웹사이트/앱 보유 권장). 신생 앱은 일부 프리미엄 브랜드(예: Booking)에서 보류될 수 있음 → **MVP는 Aviasales/Klook/Airalo 등 자동승인 위주로 시작** |
| **딥링크 마커** | 가입 시 `marker`(Partner ID) 부여. 링크에 항상 포함. SubID로 트립/유저 단위 트래킹 가능 |
| **딥링크 URL 형식** | `https://tp.media/click?shmarker={marker}&promo_id={promo}&source_type=link&type=click&campaign_id={brand}&trs={projectId}&...` + 타겟 URL 인코딩 |
| **Partner-link API** | 직접 브랜드 URL → 파트너 URL 변환 엔드포인트 제공. 17개 프로그램이 API 노출. SubID 자동 삽입 가능 |
| **수수료 (사례 기반, MEDIUM)** | GetYourGuide ~8% · Airalo ~12% · Klook 2–5% · Booking ~4%(세션 쿠키) · Agoda(고전환). 쿠키 30일 다수(Booking은 세션) |
| **정산** | 네트워크 단일 정산. 최소 출금액·지급주기 존재(계정 대시보드 확인) |
| **커버리지 확인** | Klook · Booking · Agoda · GetYourGuide · Airalo · Trip.com **모두 Travelpayouts 내 존재 확인됨** |

### 1.3 Stay22 — 가입/승인/정산

| 항목 | 내용 |
|---|---|
| **가입 장벽** | 매우 낮음. Hub(`hub.stay22.com`) 가입 → `AID` 발급. 스크립트/딥링크는 즉시 사용. **Direct Travel API는 별도 키 + 파트너십 문의**(`arjun@stay22.com`) |
| **Allez 딥링크 형식 (HDP)** | `https://www.stay22.com/allez/roam?aid={aid}&campaign={label}&hotelname={name}&address={location}` |
| **Allez 딥링크 형식 (SRP/지역)** | `https://www.stay22.com/allez/roam?aid={aid}&campaign={label}&address={location}&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD` |
| **핵심 장점** | URL 템플릿만으로 생성(per-link API 호출 X) → Edge Function/클라이언트 어디서든 가능. 사용자 geo/언어/통화 기반 OTA 자동 선택 |
| **Direct Travel API** | `GET /v1/accommodations?provider=booking&address=...` 실시간 가격·재고. provider: booking/expedia/hotels/vrbo. **자체 UI 가격카드 필요할 때만.** 권고: 결과 60분 KV 캐싱 |
| **수수료 (사례 기반, MEDIUM)** | OTA 수수료의 일부 share(블로그 사례 ~30%; 볼륨에 따라 협상). 비공개·변동 |
| **정산** | Stay22 단일 정산 |

### 1.4 통합 지점 (기존 스택과)

- **`packages/core`**: `buildStay22Link(place, dates)` / `buildTravelpayoutsLink(brand, target, subId)` 순수 함수 + 제휴 상수(marker/aid/브랜드 promo_id). web/iOS/Edge 공유.
- **클릭 트래킹**: SubID/campaign에 `trip_id`(+ 익명 user hash) 넣어 전환 귀속. 별도 클릭 로그 테이블(append-only) 권장.
- **수익 리포팅**: 두 네트워크 모두 transaction reporting API 있음 → 이후 Edge cron으로 수익 동기화(MVP는 대시보드 수동).

### 1.5 추가하면 안 되는 것

- ❌ **OTA 직접 제휴(Booking/Agoda/Klook 개별 계약)** — 신생 2인 팀엔 승인·정산·세금 부담만 큼. 네트워크가 그걸 흡수함. 트래픽 증명 후 재고.
- ❌ **자체 결제(MOR)·인앱 결제** — PRODUCT.md에서 장기로 명시. MVP는 딥링크 아웃바운드만.
- ❌ Stay22 **스크립트 위젯**(`<script>` DOM 후킹) — 블로그용. RN/Next 앱엔 딥링크/API가 맞음.

---

## 2. 인바운드 이메일 수신·파싱 — 여행 가계부 (MVP)

### 2.1 결정 요약

| 후보 | 비용 | Supabase 통합 | 결정 |
|---|---|---|---|
| **Cloudflare Email Routing + Email Worker** | **무료** (일 10만 trigger) | Worker `email()` → `fetch()` → Supabase Edge 웹훅 | **권장 (1순위)** — 가계부는 저빈도라 무료로 충분, 추가 ESP 계정 불필요 |
| Mailgun Routes (Inbound) | Flex $2/1k (2025.12 인상) · 무료 100/일 | Route → HTTP POST → Edge Function | 2순위 — 파싱·라우팅 ergonomics 최고. CF가 막힐 때 |
| AWS SES Inbound (Mail Manager) | $0.10/1k + 청크/스토리지 별도 | SNS/Lambda 경유 필요 | 비권장 — primitive만 줘서 조립 부담, Supabase와 거리 멈 |
| SendGrid Inbound Parse | 영구 무료 폐지(2025), 트라이얼만 | POST → Edge | 비권장 — 무료 사라짐 |

**권장: Cloudflare Email Routing + Worker.** 이유:
1. **무료** (가계부 메일은 트립당 수 통 수준의 저빈도).
2. **별도 ESP 가입·도메인 인증 불필요** — DNS만 CF면 즉시.
3. Worker에서 raw MIME 파싱 후 **Supabase Edge Function(Deno) 웹훅**으로 JSON POST → 깔끔한 서버리스 파이프라인.

### 2.2 아키텍처

```
사용자 → 예약 메일을 [ledger+<token>@inbox.moajoa.app] 로 전달
   ↓ (MX = Cloudflare)
Cloudflare Email Routing → Email Worker (email() handler)
   ↓  raw MIME 추출 + 발신/제목/본문/첨부 정리, 서명 시크릿 부착
Supabase Edge Function (Deno 웹훅, verify_jwt=false + HMAC 검증)
   ↓  본문 → Claude claude-sonnet-4-6 (구조화 파싱, 기존 extract 패턴 재사용)
   ↓  {플랫폼·항목·카드·통화·금액·환율·결제시점} → Zod 검증
Postgres ledger_entries (RLS: token→user 매핑)
```

### 2.3 구현 디테일

| 항목 | 결정 |
|---|---|
| **개인 전용 주소** | `ledger+{opaque_token}@inbox.moajoa.app` (plus-addressing). token = user별 랜덤. DB에서 token→user_id 매핑. 추측 불가 |
| **MX 서브도메인** | `inbox.moajoa.app` 에 Cloudflare Email Routing MX. 메인 도메인 메일과 분리(격리·보안) |
| **AI 파싱** | **기존 `claude-sonnet-4-6` 재사용** (새 모델 도입 X). extract-youtube와 동일하게 JSON 강제(stop_sequences/structured output) + Zod 검증. 프롬프트만 신규: 다국어(한·일·영) 예약메일 → 표준 ledger 스키마 |
| **웹훅 인증** | Supabase Edge `verify_jwt=false` + Worker가 붙인 **HMAC 서명 헤더** 검증(service role 노출 금지). Edge 내부에서만 service role로 insert |
| **첨부(PDF 영수증)** | MVP는 본문 텍스트만. PDF 파싱은 이후 (Claude의 PDF/비전 입력으로 확장 가능) |
| **멱등성** | `Message-ID` unique 인덱스로 중복 전달 방지 |

### 2.4 패키지/도구

- Cloudflare: `wrangler@^4`(Worker 배포), `postal-mime`(Worker 내 MIME 파싱, CF 권장 라이브러리). 별도 npm 의존성 최소.
- Supabase Edge: 기존 Deno 런타임. 신규 의존성 사실상 없음(fetch + Zod + Anthropic fetch 재사용).

### 2.5 추가하면 안 되는 것

- ❌ 사용자에게 **OAuth로 Gmail 받은편지함 스캔** — 권한·심사·프라이버시 부담 큼. "전달" 패턴(TripIt/Expensify)이 마찰도 신뢰도 우위.
- ❌ 가계부용 **별도 LLM(GPT/Gemini)** — claude-sonnet-4-6 재사용으로 통일(스택·비용·프롬프트 노하우 일원화).
- ❌ 무거운 **IMAP 폴링 서버** 운영 — 푸시(웹훅)가 서버리스에 맞음.

---

## 3. 자동 여행 플랜 생성 — 동선·일정 (MVP)

### 3.1 결정 요약

| 레이어 | 결정 | WHY |
|---|---|---|
| **플랜 생성 두뇌** | **claude-sonnet-4-6 (기존 재사용)** | 추출 직후 트리거. 확정 장소+필수 장소 → 날짜별 그룹핑/순서/시간 배치. 새 모델 불필요 |
| **이동시간 그라운딩** | **Google Routes API — `computeRouteMatrix`** | LLM 단독은 거리 환각. 핀 좌표 N×N 이동시간/거리를 실측해 프롬프트에 주입하거나 후처리 |
| **순서 최적화** | LLM이 1차 정렬 + (옵션) **`computeRoutes` `optimizeWaypointOrder`** | Google이 직접 쓰는 "LLM 생성 → 최적화 후처리" 하이브리드 패턴과 동일 |

**권장 패턴 (Google의 hybrid LLM+optimization과 동형):**
1. 장소 좌표 모음 → `computeRouteMatrix`로 페어와이즈 이동시간(도보/대중교통/차) 획득.
2. 행렬 + 장소(영업시간·맥락) → claude-sonnet-4-6: 날짜별 클러스터링 + 시간 배치 + 동선 제안 (JSON, Zod).
3. (옵션) 하루 내 방문 순서를 `optimizeWaypointOrder=true`로 정밀화.

### 3.2 라우팅 데이터 소스 — 선택지

| 옵션 | 비용/특성 | 결정 |
|---|---|---|
| **Google Routes API** (`computeRouteMatrix` 요소당 과금, `computeRoutes` Basic $5 CPM) | 이미 Google Places 쓰는 중 → 동일 콘솔/키/결제. Matrix는 origins×dest 요소 과금 | **MVP 권장** — 기존 Google 통합 재사용, 도시 단위 N 작음(트립당 수십 핀)이라 비용 미미 |
| OSRM (self-host, OSM 데이터) | 인프라 고정비, 호출당 무료, TSP 내장 | 비권장(MVP) — 2인 팀이 라우팅 엔진 운영할 이유 없음. 호출량 폭증 시 재고 |
| Google **Route Optimization API** (Fleet/차량 스케줄링) | shipment 단위 과금, 물류용 | 비권장 — 차량/배송 모델. 여행 일정엔 과함 |

> 주의: legacy **Directions/Distance Matrix는 2026-02-25 deprecated**. 신규는 반드시 `routes.googleapis.com`(Routes API). FieldMask로 필요한 필드만 받아 비용 최소화(기존 Places 패턴과 동일).

### 3.3 통합 지점

- 새 Edge Function `generate-plan` (또는 extract 파이프라인 말미에 체이닝) — 추출 완료가 곧 플랜 트리거(PRODUCT.md §7).
- `packages/core`에 plan/itinerary Zod 스키마 + SQL 마이그레이션 **짝지어** 추가(append-only, 새 번호).

### 3.4 추가하면 안 되는 것

- ❌ 별도 itinerary SaaS/제3 플래너 API — claude + Routes로 자급.
- ❌ 차량 경로최적화(Route Optimization API) — 여행 동선엔 과한 모델.

---

## 4. Android — Expo/EAS (MVP, 단 우선순위 조정 가능)

### 4.1 결정 요약

Expo(SDK 56)라 **재작성 아님** — 동일 RN 코드에 Android 빌드 타깃 + 플랫폼 분기만.

| 항목 | 결정 | WHY |
|---|---|---|
| **빌드** | **EAS Build (Android)** — `eas build -p android` | 이미 iOS를 EAS로 빌드. profile에 android 추가만 |
| **공유 수신** | **`expo-share-intent@^7` (이미 설치됨)** — Android intent-filter 자동 구성 | iOS Share Extension과 **동일 패키지**가 Android `ACTION_SEND`(text/URL) 처리. config plugin이 manifest 작성 |
| **공유 라우팅** | `expo-router` + `+native-intent.ts` | 들어온 공유 path 검사 → 보드/트립 선택 화면으로 redirect (iOS와 공유) |
| **지도** | `react-native-maps@1.27.2` (설치됨) | iOS=Apple/Google, Android=Google Maps. Android는 **Maps SDK for Android API 키** 별도 필요 |
| **유통** | Google Play (`aab`), 내부테스트 트랙 | dogfooding은 내부테스트로 충분 |

### 4.2 Android 특이 체크리스트 (네이티브 패리티)

| 영역 | 주의 |
|---|---|
| **share intent** | `expo-share-intent` plugin이 `<intent-filter ACTION_SEND mimeType="text/plain">` 주입. EAS 빌드 전 `ios/`·`android/` 커밋하지 말고 prebuild로 재생성 |
| **딥링크/스킴** | `moajoa://` + (선택)App Links(`autoVerify`)로 web 보드 URL을 앱에서 열기 |
| **지도 키** | Google Maps Android API 키 별도 발급, `app.json` android config |
| **푸시(이후)** | iOS=APNs, Android=FCM. v2.0 알림은 phase 2(게이트/주차)와 함께 |
| **결제자=Android 시나리오** | PRODUCT.md: 대표/결제자가 Android일 수 있음 → 예약·가계부 탭이 Android에서 1급이어야. 임시 폴백은 반응형 web 예약 경로 |

### 4.3 추가하면 안 되는 것

- ❌ Android 전용 네이티브 모듈 신규 작성 — Expo 모듈/config plugin으로 해결되는 한 RN 공유 코드 유지(2인 팀 유지보수).
- ❌ 별도 Android 공유 라이브러리 — `expo-share-intent` 하나가 iOS/Android 양쪽 담당.

---

## 5. (이후 · phase 2 프리미엄) 항공 상태 + 공항 주차 — 조사만, MVP 제외

> PROJECT.md/PRODUCT.md에서 **이번 마일스톤 범위 외**. 미리 옵션만 픽스해 둔다. MVP에 빌드 X.

### 5.1 항공 상태 API

| 후보 | 가격 | 결정 |
|---|---|---|
| **AeroDataBox** | 무료 500/월(개인) · $100/월 10k(상용 B2C) · 자체 alert API(2026) | **권장(시작)** — 가격 투명, 상용 B2C 명시, 게이트/지연/벨트 커버. 한국 노선 포함 |
| FlightAware AeroAPI v3 | 쿼리당 종량제(15레코드/페이지) | 정밀 라이브 트래킹 필요 시. 비용 예측 어려움 |
| Cirium FlightStats | 엔터프라이즈 커스텀 견적 | 규모 커진 후. 초기엔 과함 |

**권장:** 프리미엄 출시 시 **AeroDataBox**로 시작(무료 티어로 PoC), 정밀 실시간 수요 검증되면 FlightAware. Cirium은 엔터프라이즈 단계.

### 5.2 공항 주차 혼잡도 — data.go.kr 무료 공공데이터

| 데이터셋 | 출처 URL | 특성 |
|---|---|---|
| **인천국제공항공사_주차 정보** | https://www.data.go.kr/data/15095047/openapi.do | T1/T2 주차장별 주차차량수·총면수·갱신시각. JSON/XML. 개발 1,000/일, 운영 신청 시 1,000,000/일. **자동승인** |
| **한국공항공사_전국공항 주차장 혼잡도** | https://www.data.go.kr/data/15063437/openapi.do | 전국공항 실시간 혼잡도. 엔드포인트 `openapi.airport.co.kr/.../airportParkingCongestionRT`. 개발 자동승인 / 운영 심의 |
| (참고) 인천공항 출국장 혼잡도 | https://www.data.go.kr/data/15148225/openapi.do | 출국장 혼잡도 — 게이트 동선 부가정보 |

**결정:** 둘 다 **무료**. 인천공항 주차는 자동승인이라 PoC 즉시 가능. Edge Function cron이 폴링 → 캐시 → 푸시 알림.

### 5.3 추가하면 안 되는 것 (이후 단계)

- ❌ 항공 데이터 유료 API를 MVP에 미리 결제 — 프리미엄 검증 전까지 보류.
- ❌ 공항 주차를 위해 스크래핑 — 공공 API가 무료·합법으로 존재.

---

## 6. 신규 의존성 설치 (요약)

```bash
# 클라이언트(iOS/Android) — 대부분 이미 설치됨. Android는 코드 추가 없이 빌드 타깃만.
# (expo-share-intent@^7, react-native-maps@1.27.2 이미 존재)

# Cloudflare Email Worker (별도 워크스페이스 또는 supabase 외부 디렉토리)
pnpm add -D wrangler        # ^4
pnpm add postal-mime        # Worker 내 MIME 파싱

# Edge Functions(Deno) — npm 설치 아님. import map/URL import.
#   Routes API, Anthropic, data.go.kr 모두 fetch + 기존 Zod 재사용 → 신규 npm 패키지 사실상 0
```

| 신규 외부 계정/키 | 용도 | MVP? |
|---|---|---|
| Travelpayouts marker | 액티비티·eSIM·교통·항공 딥링크 | ✅ |
| Stay22 AID | 숙소 지도형 딥링크 | ✅ |
| Cloudflare (도메인 DNS + Email Routing + Workers) | 인바운드 가계부 메일 | ✅ |
| Google Maps **Routes API** 활성화 (기존 콘솔) | 플랜 이동시간/순서 | ✅ |
| Google Maps **Android** API 키 | Android 지도 | ✅ |
| Stay22 Direct Travel API 키 | inline 실시간 가격(옵션) | ➖ 트래픽 후 |
| AeroDataBox 키 | 항공 상태 | ❌ 이후 |
| data.go.kr 인증키 | 공항 주차 | ❌ 이후 |

---

## 7. 무엇을 추가하면 안 되는가 (스택 규율)

| 금지 | 이유 | 대신 |
|---|---|---|
| Firebase/Firestore | 피봇 결정 위반 | Supabase |
| 가계부/플랜용 별도 LLM | 스택 분산·비용 | claude-sonnet-4-6 재사용 |
| legacy Directions/Distance Matrix API | 2026-02 deprecated | Routes API (`routes.googleapis.com`) |
| OTA 개별 직접 제휴 | 신생 팀 승인·정산 부담 | Travelpayouts/Stay22 네트워크 |
| Gmail OAuth 받은편지함 스캔 | 권한·심사·프라이버시 | 전달주소(plus-addressing) |
| SES Inbound / SendGrid Parse | 조립부담 / 무료폐지 | Cloudflare Email Routing+Worker |
| Android 신규 네이티브 모듈 | 2인 팀 유지보수 | Expo config plugin / 공유 RN 코드 |
| service role 키 클라이언트 노출 | 보안 (CLAUDE.md §4.4) | Edge Function 내부에서만 |
| 기존 마이그레이션 수정 | append-only (CLAUDE.md §4.3) | 새 번호 SQL + core 스키마 동시 |

---

## 8. MVP vs 이후 분리 (로드맵 입력)

**MVP (이번 마일스톤):**
1. 제휴 딥링크 빌더(Stay22 + Travelpayouts) — `packages/core` 순수함수 + 클릭 트래킹 (선투자 0, Day1 수익)
2. 인바운드 가계부 — Cloudflare Email Routing+Worker → Supabase Edge → claude 파싱 → ledger
3. 자동 플랜 — `generate-plan` Edge (claude + Routes API matrix), 추출 직후 트리거
4. Android — EAS Android 빌드 + expo-share-intent Android intent + Google Maps Android 키
5. (지원) 시작 일정 분기 + 날짜 투표 — 기존 votes/boards 스키마 확장 (신규 외부 스택 불요)

**이후 (phase 2+):**
- Stay22 Direct Travel API (inline 실시간 가격), 수익 transaction reporting 동기화
- 항공 상태(AeroDataBox→FlightAware) + 공항 주차(data.go.kr) — 프리미엄
- PDF 영수증 비전 파싱, OSRM 자체호스팅(라우팅 호출 폭증 시)

---

## 9. Sources

**제휴/예약**
- Travelpayouts — partner-link API · brands(Klook/Booking/Agoda/GetYourGuide/Airalo/Trip.com 확인): https://support.travelpayouts.com/hc/en-us/articles/25289759198226 · https://www.travelpayouts.com/en/ (MEDIUM — 수수료는 커뮤니티 사례)
- tp.media 딥링크 형식(marker/trs): https://support.travelpayouts.com/hc/en-us/articles/203955653 (MEDIUM)
- Stay22 Allez 딥링크 형식·AID: https://community.stay22.com/allez-deep-links-everything-you-need-to-know (HIGH — 공식 커뮤니티)
- Stay22 Direct Travel API(`/v1/accommodations`, hub.stay22.com): https://api.stay22.com/docs/ (HIGH)

**인바운드 이메일**
- Cloudflare Email Routing + Workers(`email()` handler, 무료 10만/일): https://developers.cloudflare.com/email-routing/email-workers/ · https://blog.cloudflare.com/announcing-route-to-workers/ (HIGH)
- ESP 비교(Mailgun Flex $2/1k 2025.12 인상, SendGrid 무료폐지, SES inbound): https://www.frugaltesting.com/blog/sendgrid-vs-mailgun-vs-amazon-ses-2026 (MEDIUM)
- Mailgun↔Supabase Edge 통합: https://help.mailgun.com/hc/en-us/articles/43654346999963 (HIGH)

**플랜/라우팅**
- Google hybrid LLM+optimization 여행 플랜: https://research.google/blog/optimizing-llm-based-trip-planning/ (HIGH)
- Routes API `computeRouteMatrix`/billing · Directions deprecated 2026-02-25: https://developers.google.com/maps/documentation/routes/usage-and-billing · https://developers.google.com/maps/documentation/routes/migrate-routes-why (HIGH)
- 웨이포인트 최적화(`optimizeWaypointOrder`): https://developers.google.com/maps/documentation/routes_preferred/waypoint_optimization_proxy_api (HIGH)

**Android/Expo**
- expo-share-intent(iOS+Android, SDK 56): https://github.com/achorein/expo-share-intent · https://www.npmjs.com/package/expo-share-intent (HIGH)
- Expo SDK 56(RN 0.85/React 19.2, 2026-05): https://expo.dev/changelog/sdk-56 (HIGH) — 코드베이스 package.json 실측 일치

**이후(항공/주차)**
- AeroDataBox 가격(무료 500/월, $100/월 10k): https://aerodatabox.com/pricing/ (HIGH)
- FlightAware AeroAPI v3: https://www.flightaware.com/commercial/aeroapi/ (HIGH)
- 인천공항 주차 정보 API(자동승인, 무료): https://www.data.go.kr/data/15095047/openapi.do (HIGH)
- 한국공항공사 전국공항 주차 혼잡도: https://www.data.go.kr/data/15063437/openapi.do (HIGH)

**코어 검증(모델·버전)**
- claude-sonnet-4-6(현행 Sonnet): https://www.anthropic.com/news/claude-sonnet-4-6 (HIGH) — extract-youtube에서 사용 중과 일치

---
*Stack research for: MOAJOA v2.0 (full travel lifecycle)*
*Researched: 2026-06-21 · 코어 스택은 apps/ios/package.json + supabase functions 실측 기준*
