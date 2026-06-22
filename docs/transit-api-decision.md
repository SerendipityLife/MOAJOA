# 결정 브리프 — 일본 대중교통(전철/버스) 소요시간 API

**작성:** 2026-06-23 · **상태:** 🟡 결정 대기 (팀 상의 필요)
**관련:** Phase 18 (Auto Plan, PLAN-04 "이동시간 그라운딩") · 향후 V2/18.x 가능성
**결정 소유자:** (미정 — wcb / 동료)

> 이 문서는 동료와 "전철 이동시간을 어떻게 얻을지"를 정하기 위한 브리프예요. 대화 맥락 없이 읽어도 되게 정리했습니다.

---

## 1. 문제 — Google은 일본 대중교통을 안 준다 (실측 확인)

플랜의 일정 항목 사이에 **이동시간(몇 분)**을 표시하려고 Google **Routes/Directions API**를 쓰는데, **일본 transit(전철/버스)이 안 나옵니다.**

- 실측(신주쿠→시부야, 전철 천지인 구간):
  - Routes API `TRANSIT` → `200 {}` (routes 없음)
  - Directions API `mode=transit` → `"available_travel_modes": ["DRIVING","WALKING","BICYCLING"]`, `status: ZERO_RESULTS` (TRANSIT이 목록에 아예 없음)
  - 같은 키로 **WALK/DRIVE는 정상** (도보 8803s, 차 1472s)
- 원인: **Google Maps Platform(개발자 API)은 일본 대중교통 데이터를 라이선스받지 못함.** 소비자용 Google 지도 앱은 전철이 나오지만(별도 계약), 그 데이터는 **개발자 API로 재배포 안 됨.** 콘솔 토글·파라미터로 켤 수 있는 게 아님.
- **앱 화면 스크래핑은 ToS 위반** → 불가.

**결론: 진짜 전철 시간을 원하면 Google이 아닌 일본 전용 API가 필요하다.**

---

## 2. 우리가 필요한 것 (제약)

- **입력:** 인접한 두 장소의 위경도(좌표) → **출력: 소요시간(분).** 시간표 화면 아님, 구간 "몇 분"만.
- **환경:** Supabase Edge Function(Deno)에서 서버 측 REST 호출. **자체 서버 운영은 피하고 싶음**(2인 사이드, 서버리스 유지).
- **비용:** 민감(수익 전 MVP). 호출은 **인접 구간만(N-1) + 좌표쌍 캐싱**으로 최소화 가능.
- **시장:** 도쿄 우선 → 오사카·교토 확장.
- **팀:** 한국 개발자 → **해외에서 키 발급·영문 문서·카드 결제**가 쉬울수록 좋음.

---

## 3. 옵션 비교 (리서치 검증 결과)

| 옵션 | 일본 커버리지 | 좌표→분 | 해외 키 발급 | 가격 | 판정 |
|---|---|---|---|---|---|
| **NAVITIME** (RapidAPI) | ✅ 전철·버스 | ✅ 루트검색 | ✅ **RapidAPI 즉시**(영문·카드) | 무료 500콜 / PRO **$200·월** / ULTRA $300 | 🟢 접근 최易 |
| **駅すぱあと (Ekispert)** | ✅ 전철·버스·도보 | ✅ 분 단위 응답 | 영문 문서 O, 좌표 입력 O | ⚠️ **미검증** | 🟢 JP 표준 |
| **HERE Transit v8** | ❓ **JP 커버리지 미확인** | ✅ duration(초) | ✅ freemium·글로벌 | 저렴 | 🟡 데이터 리스크 |
| **ODPT 오픈데이터 + OpenTripPlanner(자체호스팅)** | ✅ 도쿄 철도 강함 | ✅ OTP가 계산 | 가입 불필요(무료 데이터) | 데이터 무료, **서버 운영비/관리** | 🟡 장기 옵션 |
| Transitland | ❌ 미국만 | ✅(초) | — | — | 🔴 제외 |
| Mapbox / Rome2Rio | ❌ JP transit 없음/거침 | — | — | — | 🔴 제외 |

---

## 4. 옵션별 상세 + 출처 (전부 1차 공식 문서, 교차검증)

### 🟢 NAVITIME — 접근성 최고
- 루트검색(토탈내비)으로 일본 전철·버스 커버. **RapidAPI / SBI API Hub / 직접계약** 채널.
- RapidAPI 가격: **BASIC 무료(50req/min, 500 access)** · **PRO $200/월(5,000)** · **ULTRA $300/월 +$0.05 초과(10,000)**.
- 출처: [navitime api 소개](https://api-sdk.navitime.co.jp/api/specs/description/about_navitime_api.html) · [RapidAPI](https://rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi)
- **장점:** RapidAPI라 한국 팀이 즉시 키 발급(영문·카드), Deno EF에서 `fetch` 한 줄. **단점:** PRO $200/월은 부담, 무료 500콜은 도그푸딩용. → 캐싱 필수.
- ⚠️ **붙이기 전 확인:** RapidAPI 엔드포인트가 **좌표쌍**을 받는지(역코드만이 아니라).

### 🟢 駅すぱあと (Ekispert / Val Laboratory) — 일본 표준
- 좌표(lat/lon) 입력 지원(viaList에 좌표) + 응답이 **분 단위**(`timeOnBoard`/`timeWalk`/`timeOther`) + 전철·버스(路線バス)·도보 커버. 영문 문서 있음.
- 출처: [course/extreme API](https://docs.ekispert.com/v1/en/api/search/course/extreme.html) · [좌표→코스 tip](https://docs.ekispert.com/v1/tips/get-course-by-geo-point-via-nearest-gate/) · [요금제](https://api-info.ekispert.com/plan/)
- **장점:** 우리 요구(좌표→분)에 가장 정확히 맞고 JP 표준. 저볼륨엔 보통 NAVITIME보다 유연.
- ⚠️ **붙이기 전 확인:** **해외 가입 절차 · 정확 가격 · 상업적 사용/재배포 라이선스**(리서치에서 미검증).

### 🟡 HERE Public Transit API v8 — API는 완벽, JP 데이터가 물음표
- `/v8/routes`가 WGS-84 좌표 입력, `travelSummary.duration`(초) 반환, REST GET → Deno에서 쉬움. freemium·글로벌·영문.
- 출처: [HERE dev guide](https://www.here.com/docs/bundle/public-transit-api-developer-guide/page/routing/README.html) · [v8 reference](https://www.here.com/docs/bundle/public-transit-api-v8-api-reference/page/index.html)
- ⚠️ **치명적 미확인:** 공식 문서에 **일본/도쿄 커버리지 명시가 없음**(검증 결과 "미확인"으로 확정). HERE는 역사적으로 일본 transit이 약함. **도쿄 2점 실측으로 실제 경로가 나오는지 확인 전엔 채택 금지.**

### 🟡 ODPT 오픈데이터 + OpenTripPlanner(자체 호스팅) — 무료지만 운영 부담
- ODPT는 **GTFS-JP/GTFS-RT/JSON 오픈데이터만** 제공, **경로검색 API 없음** → 우리가 라우팅 엔진을 돌려야 함.
- **OpenTripPlanner(OTP)**: GTFS+OSM로 네트워크 구성, GTFS-RT 실시간 반영, 좌표→좌표 소요시간 계산, **GraphQL API로 외부(EF)에서 호출 가능.** 도쿄 철도 GTFS는 [TokyoGTFS]로 생성 가능.
- 출처: [developer.odpt.org](https://developer.odpt.org/) · [OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner) · [TokyoGTFS](https://github.com/MKuranowski/TokyoGTFS)
- **장점:** 데이터 무료·풀컨트롤·확장 자유. **단점:** OTP 서버를 띄워 운영·갱신해야 함 → "서버리스 2인 MVP"와 안 맞음. **장기/볼륨 커지면 비용 최적.**

### 🔴 제외
- **Transitland v2 Routing:** 베타가 **미국만** — [transit.land](https://www.transit.land/documentation/routing-api/).
- **Mapbox / Rome2Rio:** JP 대중교통 경로 없음 / 도시 간 위주로 너무 거침. 분 단위 정확도 부적합.

---

## 5. 추천 (상의용 초안)

**전철을 기본값으로 가려면 → 유료 일본 API 연동 = 새 작업(별도 phase).** Phase 18의 Routes 자리에 provider를 하나 더 끼우는 구조 (도보/차 = Google, 전철 = NAVITIME/Ekispert).

- **1순위: NAVITIME (RapidAPI)** — 즉시 시작 가능(해외 키·영문·REST). 비용은 캐싱으로 방어. 도그푸딩은 무료 tier로 시작.
- **2순위: 駅すぱあと** — 가격·라이선스 확인되면 저볼륨에 더 경제적일 수 있음.
- **HERE** — 도쿄 실측 통과하면 가장 싸고 쉬움(미확인이라 검증 먼저).
- **OTP 자체호스팅** — 지금은 과하고, 볼륨/비용 커지면 재검토.

**비용 핵심:** 두 좌표 간 전철 시간은 거의 안 변함 → **(origin,dest,mode) 캐시 테이블**로 재호출 차단하면, 인접구간(N-1)만 + 캐시로 호출량이 매우 적어 어떤 옵션이든 저렴 tier로 도그푸딩 가능.

**임시 대안(연동 전까지):** 지금처럼 **도보 기본값**(Google Routes — 실제 분 나옴) + 전철은 "준비 중"/숨김. 비용 0, 즉시. 플랜이 동네별로 묶여 구간 대부분 도보권이라 당장 큰 손해 없음.

---

## 6. 같이 정해야 할 것 (체크리스트)

- [ ] **전철 기본값이 MVP에 꼭 필요한가?** 아니면 도보 기본 + 전철은 V2로?
- [ ] **유료 API 월 비용**(NAVITIME PRO $200 등)을 MVP 단계에 쓸 의향?
- [ ] provider 선택: **NAVITIME(빠름) vs Ekispert(JP표준·가격확인 필요) vs HERE(실측 필요)**
- [ ] 연동 시점: **Phase 18.1로 바로** vs **Phase 19/20 끝나고 V2로**
- [ ] 캐싱 전략 합의(좌표쌍 캐시 테이블) — 비용 방어 전제

### 붙이기 전 30분 검증(누가 할지)
- [ ] HERE: 도쿄 2점 transit 실호출 → 실제 routes 나오나
- [ ] Ekispert: 해외 가입·가격·상업 라이선스 확인
- [ ] NAVITIME: RapidAPI 엔드포인트가 좌표쌍 입력을 받나

---

## 7. 결정 기록 (정해지면 채우기)

- **결정:**
- **provider:**
- **시점(phase):**
- **결정일 / 합의자:**

---

*리서치 방법: deep-research(5각도 병렬 웹서치 → 22개 1차 소스 → 25 claim 3표 교차검증 → 21 confirmed). 가격·접근성은 변동되니 계약 전 재확인 권장.*
