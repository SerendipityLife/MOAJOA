# Feature Research — v2.0 전면 개편 (발견→결정→플랜→예약→정산)

**Domain:** AI 여행 플랫폼 (link-to-map → 일정 조율 → 자동 플랜 → 제휴 예약 → 여행 가계부)
**Researched:** 2026-06-21
**Confidence:** MEDIUM-HIGH (레퍼런스 앱 official 문서·헬프센터 기반. 전환율·UI 배치 패턴은 업계 글 기반 = MEDIUM. 환율·메일파싱 동작은 TripIt/Expensify official = HIGH)

> 이 문서는 **v2.0 신규 기능 4개 카테고리**(① 날짜/일정 조율 ② 자동 여행 플랜 ③ 가격비교+인앱 예약 ④ 여행 가계부)에 집중한다. 기존(동작 중) 추출·핀·보드·web 열람·auth는 베이스라인으로 전제하고, 신규 기능과의 의존성만 표기한다. 2026-05-25 v1 FEATURES.md(추출·공유 중심)와는 별개 문서로 새로 작성.

---

## 핵심 인사이트 (먼저 읽을 것)

1. **신규 4개 기능은 전부 "이미 검증된 표준 패턴"이 존재한다.** 발명할 게 거의 없다. 날짜 투표=When2meet/모여봐요, 자동 플랜=Wanderlog, 메일 파싱 가계부=TripIt/Expensify의 forward-email 패턴. **위험은 혁신이 아니라 "표준을 정확히 복제 + 한국 맥락(카톡·원화·일본 여행) 끼우기"에 있다.**

2. **MVP에서 가장 위험한 anti-feature = AI 플랜 자동 확정.** 2026 업계 컨센서스는 "AI 일정은 전부 수작업 검증 필요" — 영업시간·휴무·존재여부 hallucination이 일상이다. MOAJOA는 추출 좌표가 Google Places로 grounding되어 유리하지만, **순서·시간·동선을 AI가 단정하면 첫 실수에서 신뢰 영구 손실.** 플랜은 "초안(draft)"으로 명시하고 사용자가 드래그로 고치는 게 table stakes.

3. **예약은 두 군데 배치(인라인 + 통합 체크리스트)가 맞다 — 단, 인라인이 전환의 본체.** 업계 데이터상 "능동적으로 여행 계획 중인 맥락에 박힌 예약 링크"가 가장 높은 전환을 낸다(Klook 75%+ 모바일 전환, 맥락 콘텐츠 = 최고 전환 유형). 통합 체크리스트는 "대표가 한 번에"의 편의 기능이지 전환 엔진이 아니다. **둘 중 하나만 만든다면 인라인.**

4. **가계부의 진짜 가치 = "마찰 0".** TripIt/Expensify가 증명한 건 "메일 전달 한 번이면 끝"의 위력이다. 영수증 여러 장 업로드·수동 입력을 요구하는 순간 가계부는 죽는다. 단, forward-email은 **전달 주소 발급 + 메일 수신 인프라(inbound email)** 라는 새 백엔드 컴포넌트를 요구 = 신규 기능 중 인프라 부담 최대.

5. **날짜 투표 = "비로그인·초대 링크"가 비기능적 핵심.** When2meet·모여봐요 둘 다 핵심은 "계정 없이 링크만으로 참여". MOAJOA는 이미 web SSR 공개 보드 + share_slug 인프라가 있어 **재활용 가능** — 신규 4개 중 기존 자산 재활용도가 가장 높다.

---

## 카테고리 ① 날짜/일정 조율 (투표)

> 레퍼런스: **When2meet**(드래그 히트맵, 무가입 링크), **모여봐요/Oube**(한국 모임 날짜 투표, 다국어, 투표 시작 후 옵션 추가 가능), **TripIt**(여행 단위 묶기). MOAJOA 위치: "정해짐→날짜 입력 / 미정→일행과 날짜 투표(초대 링크)" 시작 분기.

### Table Stakes

| Feature | Why Expected | Complexity | 의존성 / Notes |
|---|---|---|---|
| **시작 분기: 날짜 정해짐 vs 미정** | PRODUCT.md 시작 앞단. 정해진 사람에게 투표 강요하면 마찰 | LOW | 신규. trip 생성 시 분기 UI. 정해짐→날짜 바로 입력 |
| **초대 링크/코드로 비로그인 참여** | When2meet·모여봐요의 정체성. "가입하라"는 순간 일행 절반 이탈 | MEDIUM | **기존 web SSR + `share_slug` 재활용 가능.** 비로그인 응답자는 이름만 입력(When2meet 패턴) |
| **후보 날짜에 가능/불가 표시 → 집계** | 투표의 본질. 누가 언제 되는지 한눈에 | MEDIUM | 신규 `date_votes` 테이블. 날짜별 가/부. RLS: 보드 멤버 + 링크 토큰 보유자 |
| **최다 겹침 날짜 하이라이트** | When2meet 히트맵의 핵심 가치 = "최적 슬롯 자동 부각" | LOW | 집계 쿼리. 색농도 or 카운트 정렬 |
| **대표(결제자) 식별** | PRODUCT.md: "여기서 대표(결제자)도 식별". 예약·가계부 권한 귀속점 | LOW | 신규 컬럼 `trips.organizer_id`. 생성자 default |
| **확정 → 날짜 잠금** | 투표는 결정으로 끝나야 함. 확정 후 플랜·예약이 그 날짜에 매달림 | LOW | `trips.confirmed_dates`. 확정 시 후속 단계 unlock |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **투표를 "같은 플랜 위에 얹기"** | 경쟁 앱은 날짜 투표 ≠ 일정 앱이 분리됨. MOAJOA는 추출→플랜→날짜투표가 한 trip 안에 연결 = 재입력 0 | MEDIUM | PRODUCT.md 핵심 UX. 투표는 옵션, 기본은 AI 추천 루트 |
| **투표 시작 후에도 후보 추가** | 모여봐요가 명시적으로 광고하는 차별점("스케줄 막힘 방지") | LOW | append-only 후보. 표준보다 한 끗 |
| **카톡 공유 최적화 OG 카드** | 한국 일행 조율 = 카톡. 미리보기에 "○명 중 △명 투표함" 뜨면 클릭률↑ | MEDIUM | 기존 `@vercel/og` 자산 확장 |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **시간대(time-of-day) 단위 투표** | When2meet는 분 단위 그리드 | 여행 날짜 결정은 "어느 **날**"이지 "몇 시"가 아님. 그리드 UX는 과잉 | 날짜(day) 단위만. 시간은 플랜 단계 |
| **타임존 처리** | 글로벌 일행 | 초기 타깃=한국인 한국 출발. 타임존 코드는 버그 온상 | KST 고정. 글로벌은 phase 2 |
| **실시간 동시편집(CRDT/Realtime)** | "투표 실시간으로 보고 싶다" | 폴링/새로고침으로 충분. Realtime 구독은 복잡도·비용↑ | 응답 시 refetch. Supabase Realtime은 후순위 |
| **캘린더(구글/애플) 연동 자동 가용성** | 편해 보임 | OAuth 스코프·동기화 지옥. When2meet조차 안 함 | 수동 가/부 표시. 표준이 수동인 데는 이유 있음 |

---

## 카테고리 ② 자동 여행 플랜 설계

> 레퍼런스: **Wanderlog**(Pro 동선 최적화 — 시작/끝점 선택 or auto-suggest, 일자별 자동 배치, 이동시간·거리 표시, 2026 AI 어시스턴트 추가), **TripIt**(여행 묶음 타임라인), **Google/Gemini Travel**(Maps·Flights·Gmail grounding이지만 출력이 문단 — 공유가능한 day-by-day 구조 부재 = 우리 기회). MOAJOA 위치: "추출 완료 = 즉시 AI 플랜 트리거".

### Table Stakes

| Feature | Why Expected | Complexity | 의존성 / Notes |
|---|---|---|---|
| **확정 장소 → 날짜별 일정으로 자동 배치** | "AI 플랜"의 최소 정의. 추출 핀이 그냥 목록이면 플랜 아님 | HIGH | **의존: 기존 추출 핀(좌표) + ① 확정 날짜.** 날짜 수로 핀 분배 |
| **일자별 동선(이동시간·거리) 표시** | Wanderlog 표준. 사용자가 "이 순서 말 되나" 판단 근거 | MEDIUM | Google Routes/Distance Matrix. **예산: Places 외 추가 API 비용 주의** |
| **드래그로 순서·날짜 재배치 (수동 override)** | AI는 초안일 뿐. 고칠 수 없으면 쓸모없음 | MEDIUM | 플랜 = 편집 가능 자료구조. 순서·소속일 변경 |
| **"필수 장소" 지정 (호텔·공항)** | PRODUCT.md: "확정 장소 + 필수 장소". 추출 안 된 앵커를 사용자가 고정 | MEDIUM | 기존 수동 핀 추가 재활용. `is_anchor` 플래그 |
| **플랜을 "초안(draft)"으로 명시** | 2026 AI 플랜 신뢰 위기의 답. 단정하면 첫 hallucination에 신뢰 붕괴 | LOW | UX 카피·시각 신호. "AI 제안 — 확인하세요" |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **추출 즉시 자동 플랜 (이탈 차단)** | PRODUCT.md 핵심: 추출→투표로 보내지 않고 즉시 "아하 순간". 경쟁 앱은 사용자가 수동으로 일정 구성 | MEDIUM | **의존: 기존 추출 파이프라인 완료가 트리거.** 날짜 미정이면 가배치 |
| **콘텐츠 맥락 보존 (왜 이 장소)** | 추출 시 LLM이 뽑은 맥락/타임스탬프가 플랜에 따라옴 = "영상에서 본 그 집" | MEDIUM | 기존 추출 메타 재활용. v1 jump-back과 연계 |
| **영업시간·휴무 grounding 경고** | AI 플랜 최대 약점(화요일 휴무에 배치)을 Places 데이터로 방어 | MEDIUM | Places `opening_hours` 활용. "이 날 휴무 가능" 플래그 |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **완전 자동 "최적" 일정 (TSP 풀최적화)** | "AI가 알아서 완벽히" | 외판원 문제는 NP-hard + 사용자 선호(아침형/저녁형, 식사시간) 모델링 불가. 과투자 | 휴리스틱(지리 클러스터→날짜 배분) + 수동 편집. Wanderlog도 "single day reorder"만 |
| **AI가 영업시간·가격·예약가능 단정** | "정보 다 채워주면 좋지" | 2026 hallucination 1위 피해(닫힌 박물관, 잘못된 시간). 단정=책임 | Places 실데이터만 표기. 모르면 "확인 필요" 명시 |
| **분 단위 타임 블로킹 일정표** | 빡빡한 계획 욕구 | 여행은 변수투성이. 분 단위는 첫날 깨지고 버려짐 | 오전/오후/저녁 느슨한 슬롯 |
| **교통·숙박을 플랜이 자동 예약** | "끝까지 알아서" | ④ 예약은 사용자 결정·결제. 자동예약은 환불·책임 지옥 | 플랜은 제안, 예약은 카테고리 ③에서 사용자 액션 |

---

## 카테고리 ③ 가격비교 + 인앱 예약 배치

> 레퍼런스: **Travelpayouts**(100+ 제휴 통합 대시보드 — 항공·투어·보험·eSIM, deeplink 생성), **Stay22**(숙소 지도+링크 AI 자동 수익화, deeplink), **Klook**(75%+ 모바일 전환, 30일 쿠키, 맥락 콘텐츠 = 최고 전환), **Booking**(세션 쿠키 = 즉시전환 아니면 손실). MOAJOA 위치: "플랜 인라인 카드(맥락) + 통합 예약 체크리스트(대표)", 수수료 Day1.

### Table Stakes

| Feature | Why Expected | Complexity | 의존성 / Notes |
|---|---|---|---|
| **딥링크 제휴 예약 (외부 OTA로 전송)** | MVP 수익 = 딥링크. API/화이트라벨 선투자 0 | MEDIUM | Travelpayouts/Stay22 deeplink 생성. **affiliate ID·tracking 파라미터 부착** |
| **플랜 인라인 예약 카드** | 전환의 본체. "이 호텔 근처" 맥락에 박힌 링크가 최고 전환 | MEDIUM | **의존: ② 플랜의 장소·날짜.** 숙소/액티비티/교통/eSIM 카테고리 |
| **카테고리 커버 (숙소·액티비티·교통·유심)** | PRODUCT.md 명시 4종. 하나라도 빠지면 "왜 여기선 안 돼" | MEDIUM | Stay22=숙소 / Travelpayouts=나머지. 둘 병용이 업계 표준 |
| **외부 이동 명시 (앱 떠난다는 신호)** | 딥링크는 외부 브라우저/앱 이동. 갑작스러우면 신뢰 손상 | LOW | "Booking에서 예약" 식 명시 라벨 |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **멀티플랫폼 가격비교 (한 화면 비교)** | PRODUCT.md "멀티플랫폼 가격비교". 단순 링크가 아니라 가격 나열 | HIGH | **주의: 딥링크만으론 실시간 가격 못 받음.** 가격비교는 검색 위젯/API 필요 → 복잡도 급상승. MVP는 "비교 링크 묶음"으로 축소 가능 |
| **통합 예약 체크리스트 (대표가 한 번에)** | ①에서 식별한 대표가 trip 전체 예약을 한 곳에서 체크 | MEDIUM | **의존: ① 대표 식별.** 인라인 카드를 한 리스트로 모은 뷰 |
| **예약 상태 추적 (예약함/안함)** | 체크리스트가 의미 있으려면 진행 표시 | LOW | 딥링크 클릭 ≠ 예약완료. 사용자 수동 체크 or ④ 가계부 메일로 자동 확인 |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **인앱 네이티브 결제 (MOR)** | "앱 안에서 결제까지" | PRODUCT.md 장기 항목. 결제대행·세금·환불·MOR 규제 = 거대 부담 | 딥링크로 OTA 결제 위임. MVP는 수수료만 |
| **실시간 가격 비교를 모든 카드에** | "가격 다 보여줘" | 실시간 가격 = 검색 API·재고 연동·캐싱. 딥링크 모델과 결이 다름, 비용·복잡도 폭증 | MVP: 대표 플랫폼 1~2곳 deeplink. 진짜 비교는 트래픽 후 |
| **자체 OTA 재고/예약 관리** | "우리가 예약 다 관리" | 화이트라벨 = 정산·취소·CS 책임. PRODUCT.md: 트래픽 후 | 딥링크 = 책임은 OTA. 우리는 소개자 |
| **숙박 예약을 통합 체크리스트에만 두기** | "한곳에 모으자" | 인라인(맥락) 제거 시 최고전환 경로 손실 | 둘 다. 인라인 우선, 체크리스트는 보조 집계 |

---

## 카테고리 ④ 여행 가계부 (메일 전달 자동 수집)

> 레퍼런스: **TripIt**(`plans@tripit.com` 전달 → 자동 파싱, 영·불·독·일·스페인어 지원, 수천 공급사 템플릿, Inbox Sync로 메일함 직접 연동도 제공), **Expensify**(`receipts@expensify.com` 전달 → SmartScan OCR, 150+ 통화, 등록된 주소에서만 수신), **Splitwise/Tricount**(다중통화·환율·정산: 누가 얼마 냈고 누가 갚을지). MOAJOA 위치: "개인 전용 주소로 예약 메일 전달 → AI 파싱(카드·통화·환율·결제시점)", 마찰 0.

### Table Stakes

| Feature | Why Expected | Complexity | 의존성 / Notes |
|---|---|---|---|
| **개인 전용 전달 주소 발급** | TripIt/Expensify 패턴의 진입점. 사용자별 고유 inbound 주소 | MEDIUM | **신규 인프라: inbound email 수신**(예: Postmark/SendGrid Inbound, Cloudflare Email Routing → webhook). 신규 기능 중 인프라 부담 최대 |
| **등록 주소에서만 수신 (보안)** | Expensify 명시 규칙. 아무나 보낸 메일 파싱하면 스팸·오염 | LOW | 발신 = 등록 이메일 검증 |
| **예약 메일 AI 파싱 → 항목 생성** | 핵심 가치. 금액·통화·날짜·공급사 추출 | MEDIUM | **기존 추출 Claude 파이프라인 재활용**(PRODUCT.md 명시). 이메일=새 입력타입 |
| **다중 통화 + 원화 환산** | 일본 여행 = ¥ 결제 → ₩ 인식 필요. Splitwise/Tricount 표준 | MEDIUM | 결제시점 환율 적용(Tricount=입력시점, Splitwise Pro=라이브). 환율 소스 필요 |
| **카드·결제수단·결제시점 기록** | PRODUCT.md 명시 4축. 가계부의 정체성 | LOW | 파싱 필드. 추출 안 되면 수동 보정 |
| **파싱 실패 시 수동 입력 fallback** | 메일 없는 직접 예약(항공권 등)도 PRODUCT.md가 포착 대상으로 명시 | LOW | 수동 추가 폼. 마찰 최소 유지 |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **우리 앱 미경유 예약도 포착** | PRODUCT.md 명시. 직접 예약 항공권도 메일 전달로 들어옴 = 가계부 완결성 | LOW | 전달 메일이면 출처 무관 파싱 |
| **추출 AI 재활용 (별도 OCR 불필요)** | Expensify는 OCR 엔진 별도. 우리는 기존 LLM 파이프라인 = 개발비 절감 | MEDIUM | 텍스트 메일은 OCR 불필요. 첨부 PDF만 별도 |
| **trip 자동 매칭** | TripIt가 날짜로 여행에 자동 귀속. 가계부 항목이 해당 trip에 붙음 | MEDIUM | **의존: trip 날짜.** 결제일/여행일로 매칭 |
| **환율차 가시화 (예약시점 vs 결제시점)** | PRODUCT.md "환율 차이". 카드사 환율 vs 예약시점 차이는 여행자 페인포인트 | MEDIUM | 결제 통화·시점 환율 보존 |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **영수증 사진 여러 장 업로드** | "다 찍어 올리면 정리" | PRODUCT.md 명시 거부("캡처 여러 장 업로드 X"). 마찰 = 가계부 죽음 | 메일 전달 한 번. 사진은 fallback도 후순위 |
| **메일함 직접 OAuth 연동 (Inbox Sync)** | TripIt Pro가 제공, 편해 보임 | Gmail/Outlook OAuth 스코프·심사·프라이버시 부담. MVP 과투자 | forward-email 먼저(TripIt도 이게 기본). Inbox Sync는 phase 2 |
| **풀 정산/송금 (Splitwise 수준)** | "나눠내기까지" | 송금·정산은 별개 거대 도메인. 대표 결제+개인 가계부면 MVP 충분 | 누가 냈는지 기록만. 정산 계산은 후순위, 송금은 범위 외 |
| **모든 은행/카드 자동 연동(오픈뱅킹)** | "카드 긁으면 자동" | PSD2/오픈뱅킹 연동 = 규제·인증 지옥 | 메일 전달 기반. 카드 연동은 장기 |
| **실시간 라이브 환율 (Splitwise Pro)** | 정확해 보임 | 환율 API 비용·복잡도. 결제시점 1회 환산이면 충분 | 결제시점 환율 스냅샷(Tricount 방식) |

---

## Feature Dependencies

```
[기존: 추출 파이프라인 (좌표·맥락 핀)]  ← 동작 중, 베이스라인
        │
        ├──trigger──> [② 자동 AI 플랜]  ← 추출 완료가 곧 플랜 생성
        │                   │
[① 날짜 조율(투표)] ──confirm 날짜──┤  ← 플랜은 확정 날짜에 핀 분배
        │                   │
        ├──identify──> [대표(결제자)]
        │                   │              ┌──inline──> [③ 인라인 예약 카드] ★전환 본체
        │                   └──places·dates──┤
        │                                  └──aggregate──> [③ 통합 예약 체크리스트]
        │                                                       │
        │                                                  (대표가 예약)
        │                                                       │
[신규 인프라: inbound email 수신] ──forward──> [④ 가계부 파싱]
                                                  │  └─reuse─> [기존 추출 Claude 파이프라인]
                                                  └──match──> trip (날짜 귀속)

[기존: web SSR + share_slug] ──reuse──> [① 비로그인 초대 링크 투표]
```

### Dependency Notes

- **② 플랜 requires 기존 추출 + ① 확정 날짜:** 핀 좌표 없이는 동선 없음, 날짜 없이는 일자 배분 없음. (날짜 미정이면 "가배치 플랜" → 확정 후 재배치)
- **③ 예약 requires ② 플랜:** 인라인 카드는 플랜의 장소·날짜·위치 맥락에 박힌다. 플랜 없이 예약 카드는 맥락 없는 광고.
- **③ 통합 체크리스트 requires ① 대표 식별:** "대표가 한 번에"의 주체가 ①에서 정해진다.
- **④ 가계부 requires 신규 inbound-email 인프라 + 기존 추출 AI:** 인프라(전달 주소·수신 webhook)는 신규지만 파싱 두뇌는 재활용.
- **① 투표 reuses 기존 web SSR + share_slug:** 신규 4개 중 기존 자산 재활용도 최고. 비로그인 링크 참여 인프라가 이미 있다.
- **충돌:** ③ "실시간 가격비교"(검색 API 모델) ↔ "딥링크 수익 모델"(전송 모델) — 같은 phase에 섞으면 아키텍처 혼란. 딥링크 먼저, 가격비교 위젯은 분리.

---

## MVP Definition

### Launch With (v2.0 MVP) — PRODUCT.md 스코프 컷라인과 정렬

- [ ] **① 시작 분기 + 날짜 투표 (비로그인 초대 링크)** — 기존 share_slug 재활용. 대표 식별 포함
- [ ] **② 추출 즉시 AI 플랜 (draft, 수동 편집 가능)** — 휴리스틱 동선 + 드래그 재배치. "초안" 명시
- [ ] **③ 딥링크 제휴 예약 (인라인 카드 우선)** — Travelpayouts+Stay22, 4카테고리. 수수료 Day1
- [ ] **④ 메일 전달 가계부 (전달 주소 + AI 파싱 + 원화 환산)** — 기존 Claude 재활용. 수동 fallback
- [ ] **네비게이션 재편** — `trip/[id]/(tabs)/{map,plan,book,ledger}` (별도 ARCHITECTURE 영역)
- [ ] **③ 통합 예약 체크리스트** — 인라인 카드 집계 뷰 (대표용)

### Add After Validation (v2.x)

- [ ] **멀티플랫폼 실시간 가격비교 위젯** — 트래픽 확보 후. 딥링크 전환 검증되면 검색 API 투자
- [ ] **예약 상태 자동 확인** — 가계부 메일로 예약 완료 역추적 (③↔④ 연계 고도화)
- [ ] **환율차 가시화 (예약시점 vs 결제시점)** — 가계부 기본 동작 후 분석 레이어
- [ ] **투표 카톡 OG 카드 고도화** — "○명 중 △명 투표" 동적 미리보기

### Future Consideration (phase 2+)

- [ ] **메일함 직접 OAuth 연동(Inbox Sync)** — forward-email 검증 후. OAuth 부담 큼
- [ ] **여행 당일 실시간(게이트·주차)** — PRODUCT.md phase 2 프리미엄
- [ ] **인앱 네이티브 결제(MOR)** — PRODUCT.md 장기
- [ ] **풀 정산/송금** — 별개 도메인. 대표결제+개인가계부로 MVP 충분
- [ ] **타임존·글로벌 다국어 투표** — 한국 출발 검증 후

### MVP에서 반드시 빼야 할 Anti-Features (스코프 크립 차단)

| 빼야 할 것 | 이유 | 대신 |
|---|---|---|
| **AI 플랜 자동 확정 / 영업시간·가격 단정** | 2026 hallucination 신뢰 붕괴 1위 | draft + Places grounding + "확인 필요" |
| **TSP 풀최적화 동선** | NP-hard 과투자, 선호 모델링 불가 | 휴리스틱 + 수동 드래그 |
| **실시간 가격비교 (모든 카드)** | 검색 API 모델 = 딥링크와 결 다름, 비용 폭증 | 딥링크 1~2곳 먼저 |
| **인앱 네이티브 결제(MOR)** | 결제대행·세금·환불·규제 거대 부담 | OTA 딥링크 결제 위임 |
| **영수증 사진 다중 업로드** | PRODUCT.md 명시 거부, 마찰=가계부 죽음 | 메일 전달 한 번 |
| **메일함 OAuth 연동** | OAuth 심사·프라이버시 부담 | forward-email 먼저 |
| **풀 정산·송금** | 별개 거대 도메인 | 누가 냈는지 기록만 |
| **시간대 그리드 날짜 투표 / 타임존** | 여행은 "날" 단위, 한국 출발 | day 단위, KST 고정 |

---

## Feature Prioritization Matrix

| Feature | User Value | Impl. Cost | 기존 자산 재활용 | Priority |
|---|---|---|---|---|
| ① 비로그인 날짜 투표 | HIGH | MEDIUM | HIGH (share_slug) | P1 |
| ② 추출 즉시 AI 플랜 (draft) | HIGH | HIGH | MEDIUM (추출 핀) | P1 |
| ③ 딥링크 예약 인라인 카드 | HIGH (수익) | MEDIUM | LOW | P1 |
| ④ 메일전달 가계부 파싱 | HIGH | HIGH (인프라) | MEDIUM (Claude) | P1 |
| 네비게이션 재편 | HIGH | MEDIUM | — | P1 |
| ③ 통합 예약 체크리스트 | MEDIUM | MEDIUM | LOW | P2 |
| 환율차 가시화 | MEDIUM | MEDIUM | LOW | P2 |
| 멀티플랫폼 실시간 가격비교 | MEDIUM | HIGH | LOW | P3 |
| 메일함 OAuth (Inbox Sync) | LOW | HIGH | LOW | P3 |
| 풀 정산/송금 | LOW | HIGH | LOW | P3 |

**복잡도 핫스팟(roadmap 깊은 리서치 플래그):**
- **④ inbound email 인프라** — 신규 백엔드 컴포넌트(수신 주소·webhook·보안). 신규 기능 중 인프라 부담 최대. 별도 리서치 권장.
- **② 동선 휴리스틱 + 라우팅 API 비용** — Places 외 Routes/Distance Matrix 추가 비용. PRODUCT.md 예산 제약(영상당 <$0.005)과 충돌 가능 → 비용 모델 검증 필요.
- **③ "가격비교"의 진짜 범위** — PRODUCT.md 표현은 "비교"지만 딥링크 모델로는 실시간 가격 불가. MVP 정의 시 "비교 링크 묶음 vs 실시간 비교" 명확화 필수.

---

## Competitor Feature Analysis

| Feature | When2meet / 모여봐요 | Wanderlog / TripIt | Travelpayouts / Stay22 | Expensify / Splitwise | MOAJOA 접근 |
|---|---|---|---|---|---|
| 날짜 조율 | 무가입 링크, 히트맵 / 다국어·옵션추가 | TripIt=여행 묶기만 | — | — | 비로그인 링크(share_slug 재활용), day 단위, 대표 식별, 플랜과 연결 |
| 자동 플랜 | — | Wanderlog=동선 최적화·AI / Google=문단형 | — | — | 추출 즉시 draft 플랜 + Places grounding + 수동 편집 |
| 예약 배치 | — | Wanderlog 2026=booking deals | 딥링크·수수료·100+제휴 / 지도 자동수익화 | — | 인라인(전환본체)+통합체크리스트, 딥링크 Day1 |
| 가계부/정산 | — | TripIt=`plans@` 메일파싱·다국어 | — | `receipts@` OCR·150통화 / 다중통화·환율·정산 | 전달주소+기존 Claude 재활용, 원화환산, 우리미경유 예약도 포착 |

---

## Sources

**날짜 조율:**
- [When2Meet: How It Works (meetergo)](https://meetergo.com/en/magazine/when2meet) — 무가입 드래그 히트맵, 캘린더 연동 없음 (MEDIUM)
- [When2meet official](https://www.when2meet.com/) — 무가입 링크 참여 (HIGH)
- [모여봐요 — 모임 날짜 정하기 (Google Play, Oube studio)](https://play.google.com/store/apps/details?id=studio.oube.moyeobwa&hl=ko) — 다국어, 투표 시작 후 옵션 추가, 초대 링크 (HIGH)

**자동 플랜:**
- [Optimize route (Wanderlog Help Center)](https://help.wanderlog.com/hc/en-us/articles/13545624787867-Optimize-route) — 시작/끝점·auto-suggest, 단일일 자동배치 (HIGH)
- [Wanderlog Pro 2026 (monkeyeatingmango)](https://monkeyeatingmango.com/blog/wanderlog-pricing-2026/) — 2026 AI 어시스턴트 + 동선 최적화 (MEDIUM)
- [Google Maps Trip Planner 2026 (nextbillion.ai)](https://nextbillion.ai/post/google-maps-trip-planner) — Gemini grounding이지만 day-by-day 구조 부재 (MEDIUM)
- [AI Travel Planners 2026: 수동 검증 필요 (Windows News)](https://windowsnews.ai/article/best-ai-travel-planners-in-2026-helpful-itineraries-still-need-human-verification.423305) — hallucination·영업시간 오류 (MEDIUM)
- [AI Travel Planners Inventing Fake Destinations (neurozzio)](https://neurozzio.com/ai/ai-travel-planning-dangers-fake-locations) — 존재하지 않는 장소 생성 위험 (MEDIUM)

**예약 배치:**
- [Stay22 vs Travelpayouts (Stay22 blog)](https://blog.stay22.com/are-you-using-the-right-travel-affiliate-program) — Stay22=숙소 지도 자동수익화, Travelpayouts=나머지 (MEDIUM)
- [Klook Affiliate (involve.asia)](https://involve.asia/blog/klook-affiliate-program/) — deeplink 생성, 쿠키 기간 (MEDIUM)
- [Klook mobile 전환 (AdExchanger)](https://www.adexchanger.com/mobile/mobile-performance-data-helps-travel-booking-service-klook-go-big-on-affiliate/) — 75%+ 모바일 전환 (MEDIUM)
- [Travel affiliate 비교 (backlinko)](https://backlinko.com/affiliate-marketing-travel) — Booking 세션쿠키 vs Klook 30일 (MEDIUM)

**가계부:**
- [TripIt How It Works](https://www.tripit.com/web/free/how-it-works) — `plans@tripit.com` 전달 자동 itinerary (HIGH)
- [TripIt Inbox Sync](https://www.tripit.com/web/blog/news-culture/automate-your-tripit-itineraries-inbox-sync) — 키워드·벤더 기반 파싱, OAuth 메일연동은 별도 (HIGH)
- [Expensify Receipt Scanning](https://use.expensify.com/receipt-scanning-app) — `receipts@expensify.com`, SmartScan, 150+통화, 등록주소만 (HIGH)
- [Tricount Multi-Currency](https://tricount.com/en-us/expense-tracker-features/multi-currency-support) — 다중통화·환율 환산 (HIGH)
- [Splitwise alternatives 2026 (squadtrip)](https://www.squadtrip.com/guides/top-splitwise-alternatives-for-group-travel-expenses/) — Splitwise Pro 라이브환율·최소정산 계산 (MEDIUM)

---
*Feature research for: AI 여행 플랫폼 v2.0 (발견→결정→플랜→예약→정산)*
*Researched: 2026-06-21 · 다음 소비자: REQUIREMENTS.md (카테고리별 table stakes/differentiator/anti-feature, 복잡도, 의존성, MVP 컷라인)*
