# Phase 20: Affiliate Booking (딥링크 제휴 예약) - Research

**Researched:** 2026-07-02
**Domain:** Travelpayouts 제휴 딥링크 + iOS 시스템 브라우저 어트리뷰션 + 예약 체크리스트 데이터 모델
**Confidence:** HIGH (딥링크 조립은 marker 745749로 라이브 실측 완료; 잔여 미검증 항목은 Assumptions Log에 격리)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 예약 카드 노출 규칙 (Area 1)
- **D-01:** 카드 위치 = **plan 탭 일정 흐름 안 맥락 삽입.** 액티비티성 장소 항목 아래 그 장소의 예약 카드, Day 1 시작 전에 숙소·유심 카드. "맥락형 인라인"(BOOK-01)의 직해.
- **D-02:** 노출 밀도 = **슬롯당 자리 고정.** 숙소·유심 = 여행 전체 1번(Day 1 상단), 교통(패스류) = 여행당 1번, 액티비티 = 예약성 장소 항목에만 작은 버튼/컴팩트 카드. **큼직한 카드는 최대 2~3장** — 일정이 광고판이 되지 않게.
- **D-03:** **book 탭 = 체크리스트 홈**(관리 지점: 완료/미완료 상태), plan 인라인 카드 = 발견 지점(맥락에서 바로 예약). 데이터는 하나, 표면만 둘. 17-04 스텁(`book.tsx` "곧 제공돼요")을 이 phase가 채운다.
- **D-04:** 노출 시점 = **플랜 초안 생성 후.** 플랜 없는 trip·날짜 미정(투표 중) trip에서는 카드·체크리스트 모두 숨김(빈 상태 안내). 날짜 없이는 숙소 검색 프리필도 무의미.

#### 숙소 슬롯 + 비교링크 (Area 2)
- **D-05:** 숙소 슬롯 = **비제휴 링크로 일단 완성.** 숙소 제휴 부재 상태에서 일반 검색 딥링크(도시·날짜 프리필, 수익 없음)로 카드·체크리스트 UX를 완성한다. 제휴(Stay22/Agoda) 승인 시 **provider만 스왑** — buildAffiliateUrl 구조가 이를 전제.
- **D-06:** 액티비티 비교 = **비교 프레임 카드.** 한 카드 안에 Klook·KKday를 나란히 + 정적 성격 라벨(예: 즉시확정/한국어 상품 강세) + 각각 [보기] 버튼. "버튼 두 개 던지기"가 아니라 비교 구도로 읽히게. **실시간 가격 표시는 명시 제외**(사용자와 논의 후 확정 — API 게이트·상품 매칭 난이도·가격 불일치 신뢰 리스크). 단, **카드 프레임은 나중에 가격이 끼워질 수 있는 구조**로 설계.
- **D-07:** 비교의 실질 편의 = **장소 타깃 검색 딥링크.** 버튼이 플랫폼 홈이 아니라 **해당 장소명 검색 결과 페이지로 직접 착지**(탭 1번에 가격 확인). 두 플랫폼 총 2탭으로 비교 완료. 플랫폼별 검색 URL 규격은 plan 단계 실측.
- **D-08:** 액티비티 버튼 대상 = **예약성 카테고리만.** places.category가 관광명소·액티비티·테마파크 계열일 때만 노출. 맛집·카페 제외(어색한 매칭 방지). 정확한 판정 경계는 기존 카테고리 체계(`packages/core/src/category.ts`) 기반 Claude 재량.
- **D-09:** 유심·교통 카드 = **도시/국가 기반 정적 매핑.** trip `city_code` → 국가 → Airalo 해당 국가 eSIM 딥링크; 교통은 국가/도시별 대표 패스 정적 테이블(일본 = JR패스 Klook/KKday 딥링크 등). 커버 안 되는 도시는 카드 숨김(억지 추천 금지).

#### 체크리스트 동작 (Area 3)
- **D-10:** 항목 생성 = **플랜에서 자동 파생 + 수동 추가.** 플랜 초안 생성 시 숙소 1·유심 1·교통 1 + 예약성 장소들이 자동 항목화. 불필요 항목 삭제 가능, 자유 텍스트 항목 직접 추가 가능(앱 밖 예약 — 항공권·레스토랑 등).
- **D-11:** 완료 처리 = **수동 체크 + 클릭 흔적 3단 상태.** `미완료 → 확인함(예약 링크 클릭 시 booking_clicks 기반 자동 표시) → 완료(사용자 수동 체크)`. 전환 postback이 없으므로 완료의 원천은 항상 사용자.
- **D-12:** 조작 권한 = **멤버 모두.** trip 편집 권한(can_edit_trip) 있는 멤버 누구나 진행·체크(공동 예약 현실). 대표 독점 권한 없음 — "대표가 진행"(BOOK-02)은 주 사용자 시나리오이지 권한 게이트가 아님. 기존 RLS 헬퍼 그대로.
- **D-13:** 플랜 변경 동기화 = **체크된 항목 보존.** 완료/확인함 항목은 플랜 재생성·장소 제거에도 유지(실제 돈 쓴 기록). 플랜에서 빠진 장소면 '플랜에 없음' 배지. 미체크 자동 항목은 새 플랜 기준 재파생.

#### 클릭 순간 UX (Area 4)
- **D-14:** 열기 = **탭 즉시 시스템 브라우저.** 중간 확인 시트 없음(비교 프레임에 행선지 정보가 이미 있음). 클릭 토큰 발행·booking_clicks 로깅은 백그라운드에서, **브라우저 오픈을 블록하지 않게.**
- **D-15:** 복귀 UX = **조용한 유도.** 앱 복귀 시 팝업 없이, 해당 항목이 '확인함' 상태로 바뀌고 체크리스트에 "예약했으면 체크해주세요" 인라인 힌트만. 방해 없이 기록 유도.
- **D-16:** 제휴 고지 = **설정/안내 페이지에만.** 카드 UI는 깨끗하게. ⚠️ planner 주의: Travelpayouts/각 프로그램 ToS의 최소 고지 요건을 plan 단계에서 확인 — 링크 인접 고지가 규정상 필수로 판명되면 카드 하단 최소 문구로 승격(사용자 재확인 없이 규정 준수 우선).

### Claude's Discretion
- 클릭 토큰 발행·로깅 아키텍처: 클라 직접 INSERT vs 리다이렉트 EF(ROADMAP 추정은 booking-redirect EF — marker/URL 조립 + 'clicked' 로깅). 단 **D-14의 "오픈 논블로킹" 제약** 하에 결정.
- 시스템 브라우저 구현: iOS에서 제휴 쿠키가 실제 보존되는 API 선택(`Linking.openURL` vs SFSafariViewController 계열 — 쿠키 격리 여부 실측). ATTR-02의 본질은 "쿠키 보존"이지 특정 API가 아님.
- 체크리스트 데이터 모델(테이블 신설 vs plan_items 확장), 자동 파생 시점·재파생 규칙 세부.
- Klook/KKday/Airalo 딥링크 URL 규격 + sub_id 파라미터 실측(tp.st 단축링크가 아니라 직접 조립 — 17-02 계약).
- 정적 매핑 테이블의 위치(packages/core 상수)와 초기 커버리지(일본 우선).
- 비교 프레임 카드의 정적 라벨 문구.
- booking_clicks 스키마 확장 필요 여부(0016 빈 테이블 → INSERT 경로 + 마이그레이션은 append-only 새 번호).

### Folded Todos
- **supabase-js 업그레이드 (GAP-19D presence)** — Phase 19 UAT에서 발견된 realtime presence 관련 supabase-js 업그레이드 대기 건(`.planning/todos/pending/supabase-js-upgrade-presence.md`). 사용자 결정으로 이번 phase에 포함. 예약 도메인과 무관한 인프라 작업이므로 **독립 wave/plan으로 분리** 권장(예약 코드와 커플링 금지).

### Deferred Ideas (OUT OF SCOPE)
- **실시간 가격 비교** — API 파트너십(트래픽 게이트)·상품 매칭·가격 신뢰 문제로 명시 제외. 비교 프레임 카드에 가격 자리가 들어갈 수 있는 구조만 유지. 트래픽 성장 + API 접근 확보 후 재검토.
- **웹 공유 페이지(/t/[slug]) 예약 카드** — 익명 방문자 대상 제휴 노출 + Travelpayouts 재심사용 트래픽 실적에 유리하나 이번 phase 범위 밖(로드맵은 plan 슬롯 = iOS). 후속 phase 후보.
- **대형 브랜드 제휴 재신청**(Agoda·Trip.com) — 2026-07-03 이후 재제출 가능, 실사용·공유 보드 축적 후.
- **예약 전환 자동 추적** — Travelpayouts postback/API로 전환 데이터를 당겨와 완료 자동화. 지금은 대시보드 수동 확인.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOK-01 | 플랜의 숙소/액티비티/교통/유심 슬롯에 맥락형 인라인 예약 카드(딥링크)가 표시된다 | 딥링크 조립 규격 라이브 검증(Klook·Airalo), KKday 대시보드 템플릿 1회 복사 필요; plan.tsx 조건부 카드 삽입은 19-03 관리카드 분기 선례 그대로; 예약성 카테고리 판정은 `placeVibe` 기반 `isBookableActivity` 신설 |
| BOOK-02 | 통합 '예약 체크리스트'에서 대표가 필요한 예약을 한 곳에서 진행하고 완료/미완료 상태를 본다 | plan_items는 재생성 시 삭제되므로(0017 draft 덮어쓰기) **trip-scoped 신규 테이블** `booking_checklist_items` 필요 — D-13 보존 규칙의 구조적 근거. 3단 상태 + 자동/수동 source + client-side reconcile 패턴 제시 |
| BOOK-03 | 숙소·액티비티 비교 링크(1~2곳)를 제시한다 | Klook·KKday 검색결과 딥링크(장소명 타깃) + 숙소 Agoda/Booking 비제휴 검색 URL(도시·날짜 프리필) 규격 확보 |
| ATTR-02 | 예약 링크는 시스템 브라우저로 열려 제휴 쿠키가 보존된다 | `Linking.openURL`(진짜 Safari) 채택 — expo-web-browser의 SFSafariViewController는 iOS 11+에서 per-app 격리 저장소(Expo 공식 문서 명시)라 요건의 본질(크로스 세션 쿠키 보존) 불충족 |
</phase_requirements>

## Summary

이 phase의 기술적 핵심 3가지를 전부 실측/검증했다. **(1) 딥링크 조립:** Travelpayouts의 동적 딥링크는 tp.st 단축링크가 아니라 **redirect 엔드포인트**로 조립한다 — Klook은 `c137.travelpayouts.com/click?...&promo_id=4110&custom_url={인코딩된 목적지}`, Airalo는 `tp.media/r?...&p=8310&u={인코딩된 목적지}&campaign_id=541`. 두 형식 모두 **marker 745749 + 우리 ClickToken 형식의 SubID(`shmarker=745749.c_xxx` dot-suffix)로 라이브 302 리다이렉트를 확인**했고, 목적지 URL이 제휴 네트워크 URL(`k_site`/`u`/`url` 파라미터)로 정확히 통과됨을 확인했다 — 장소명 검색결과 페이지 직행(D-07)이 구조적으로 가능하다. KKday만 프로그램 파라미터(p/promo_id)가 비공개라 **대시보드에서 딥링크 1개 복사(1분 작업)가 유일한 외부 준비물**이다.

**(2) 시스템 브라우저(ATTR-02):** expo-web-browser(`openBrowserAsync`)는 SFSafariViewController = iOS 11부터 Safari와 쿠키 미공유(앱별 격리 저장소, Expo 공식 문서가 명시). 진짜 시스템 브라우저는 **`Linking.openURL`**(expo-linking ~56.0.14 이미 설치됨)이며, 이것이 ATTR-02의 "인앱 격리 회피"를 문자 그대로 충족한다. **(3) 클릭 로깅:** D-14(오픈 논블로킹) 하에서 booking-redirect EF보다 **클라 직접 INSERT가 우월** — EF 리다이렉트는 Safari의 무인증 GET을 받는 공개 엔드포인트가 되어 보안 표면이 커지고 콜드스타트 지연이 오픈 경로에 끼어든다. 클라에서 토큰 발행(expo-crypto) → `Linking.openURL` 즉시 발화 → INSERT는 백그라운드 fire-and-forget. 이를 위해 0016의 빈 booking_clicks에 **0021 마이그레이션**(click_token 컬럼 + INSERT/멤버 SELECT 정책 + 체크리스트 테이블)이 필요하다.

체크리스트는 plan_items 확장이 **불가능**하다(플랜 재생성 = draft delete→insert로 rows가 파괴됨 — D-13 위반). trip-scoped 신규 테이블로 가고, supabase-js 업그레이드(2.45.4 → 2.110.0, @supabase/ssr 0.5.1 → 0.12.0 동반 필수, 루트 pnpm override 갱신 필수)는 독립 wave로 격리한다.

**Primary recommendation:** buildAffiliateUrl의 travelpayouts 분기를 "redirect-엔드포인트 + marker-dot SubID + 목적지 인코딩" 실규격으로 채우고, 클릭은 클라 직접 INSERT(오픈 선행), 브라우저는 Linking.openURL, 체크리스트는 신규 trip-scoped 테이블로.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 제휴 URL 조립 + 토큰 형식 검증 | packages/core (공유 순수함수) | — | 17-02 계약: buildAffiliateUrl이 유일한 조립 지점. 클라·웹·EF 어디서든 동일 로직 |
| 클릭 토큰 발행 (랜덤 생성) | iOS 클라이언트 | — | expo-crypto `getRandomValues` → base62 인코딩. 서버 왕복 없이 D-14 즉시 오픈 충족 |
| booking_clicks INSERT | iOS 클라이언트 → Supabase (RLS) | — | authenticated INSERT 정책(0021) + `can_read_trip` 헬퍼. EF 불필요 |
| 시스템 브라우저 오픈 | iOS 클라이언트 (Linking.openURL) | — | OS가 Safari로 라우팅. 제휴 쿠키는 Safari 저장소에 |
| 예약성 카테고리 판정 | packages/core (category.ts 옆) | — | placeVibe와 동일 계층 — web 재사용 가능(후속 phase 웹 예약카드 대비) |
| 유심·교통 정적 매핑 | packages/core 상수 | — | CITY_KO_MAP과 동일 위치·패턴. 도메인 상수는 core 소유 |
| 체크리스트 데이터 | Database (booking_checklist_items) | packages/api 쿼리 래퍼 | trip-scoped 영속 상태. RLS = 기존 can_*_trip 헬퍼 |
| 체크리스트 자동 파생/reconcile | packages/api (쿼리 헬퍼) + iOS 호출 | — | 순수 계산(파생 규칙)은 core, DB 반영은 api 래퍼 — 기존 house 계약 |
| 인라인 카드 / 체크리스트 UI | iOS (plan.tsx / book.tsx) | — | 로드맵상 plan 슬롯 = iOS 전용. 웹 예약 카드는 deferred |
| supabase-js 업그레이드 | 모노레포 인프라 (독립 wave) | — | web+ios+api 공유 의존 — 예약 코드와 커플링 금지 (CONTEXT folded todo) |

## Standard Stack

**이 phase는 신규 외부 패키지 설치가 0건이다.** 모든 필요 능력이 이미 설치된 패키지에 있다.

### Core (이미 설치됨 — 설치 작업 없음)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-linking | ~56.0.14 (installed) | `Linking.openURL` — 진짜 Safari 오픈 (ATTR-02) | [VERIFIED: apps/ios/package.json L34] Expo SDK 56 표준 |
| expo-crypto | ~56.0.4 (installed) | 클릭 토큰용 CSPRNG (`getRandomValues`) | [VERIFIED: apps/ios/package.json L32] Math.random 금지 대안 |
| zod | ^3.23.8 (installed) | 체크리스트/클릭 스키마 (@moajoa/core) | 기존 house 계약 |
| @supabase/supabase-js | ^2.45.4 → **2.110.0** (bump) | realtime presence 수정 (GAP-19D) | [VERIFIED: npm registry — 2.110.0, 2026-06-30 publish] |
| @supabase/ssr | ^0.5.1 → **^0.12.0** (bump) | supabase-js 2.108+ peer 요건 | [VERIFIED: npm registry — 0.12.0 peers `^2.108.0`; 0.5.1 peers `^2.43.4`로 비호환] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @gorhom/bottom-sheet | ^5.2.14 (installed) | 수동 항목 추가 시트 등 | 19-03 확정 시트 선례 그대로 |
| @expo/vector-icons | ^15.1.1 (installed) | 카드/체크리스트 아이콘 | 기존 Ionicons idiom |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Linking.openURL (진짜 Safari) | expo-web-browser openBrowserAsync (SFSafariViewController) | SFVC는 앱 내 유지(UX 부드러움)지만 iOS 11+ Safari와 쿠키 미공유 — 같은 SFVC 세션 내 구매는 어트리뷰션되나 나중에 Safari/네이티브 앱에서 구매 시 유실. ATTR-02 문구("인앱 격리 회피")를 직해하면 탈락 |
| 클라 직접 INSERT | booking-redirect EF (mint+log+302) | EF는 로깅 보장성↑이나: Safari의 무인증 GET을 받는 공개 엔드포인트 필요(`--no-verify-jwt`), 콜드스타트가 오픈 경로에 삽입(D-14 위반 소지), 구현 표면 3배. booking_clicks는 분석·'확인함' 용도지 돈 경로가 아니고 수익 원천 데이터는 Travelpayouts 서버측 통계 — 드문 INSERT 유실 허용 가능 |
| supabase-js 2.110.0 (latest) | 2.109.0 (Node 20 마지막 지원) | 2.110.0은 Node ≥22 요구 — 루트 engines `>=22.0.0`이라 무관. Vercel/EAS 빌드 노드 확인만 하면 latest가 맞음 |

**Installation:**
```bash
# 신규 설치 없음. supabase-js wave에서만:
# (1) 루트 package.json pnpm.overrides: "@supabase/supabase-js": "2.110.0"
# (2) packages/api, apps/web, apps/ios: "^2.110.0"
# (3) apps/web: "@supabase/ssr": "^0.12.0"
pnpm install
```

**Version verification (2026-07-02 실행):**
```bash
npm view @supabase/supabase-js version   # → 2.110.0 (published 2026-06-30)
npm view @supabase/ssr version           # → 0.12.0
npm view @supabase/ssr@0.12.0 peerDependencies  # → { "@supabase/supabase-js": "^2.108.0" }
npm view @supabase/ssr@0.5.1 peerDependencies   # → { "@supabase/supabase-js": "^2.43.4" }
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @supabase/supabase-js | npm | 수년 (2.110.0은 2일 전 publish) | 20.6M/wk | github.com/supabase/supabase-js | [SUS: too-new] | Approved — 아래 해석 참조 |
| @supabase/ssr | npm | 수년 (0.12.0은 3주 전 publish) | 4.5M/wk | github.com/supabase/ssr | [SUS: too-new] | Approved — 아래 해석 참조 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** @supabase/supabase-js, @supabase/ssr — seam의 `too-new` 플래그는 **최신 버전의 publish 시점**(각 2일/3주 전)에 반응한 것으로, 패키지 자체는 이미 repo에 2.45.4로 설치되어 있는 Supabase 공식 1st-party 패키지(주간 2천만 다운로드, 공식 repo, postinstall 없음)다. 슬롭스쿼팅 리스크가 아니라 **버전 신선도 신호**. planner 조치: 신규 설치 checkpoint 대신, folded todo의 검증 게이트(presence 2-브라우저 수렴 + web/iOS realtime 스모크 + auth 회귀 0 + `pnpm supabase:types` diff 0)를 supabase-js wave의 acceptance로 삼을 것. 만약 실행 시점에 2.110.x에서 회귀가 발견되면 2.109.0으로 보수 핀(presence fix floor는 2.108.2 — todo에서 실측 확인됨).

## Architecture Patterns

### System Architecture Diagram

```
[plan 탭 인라인 카드]        [book 탭 체크리스트]
  (발견 지점, D-01/02)          (관리 지점, D-03)
        │                          │
        └────────┬─────────────────┘
                 ▼ 탭 (예약 링크)
   ┌─────────────────────────────────────┐
   │ iOS 클릭 핸들러 (D-14 순서 엄수)      │
   │ 1. mintClickToken()  (expo-crypto)  │
   │ 2. buildAffiliateUrl(provider,      │
   │      productParams, token)          │  ← @moajoa/core (유일한 조립 지점)
   │ 3. Linking.openURL(url)  ◄── 즉시,  │
   │      await 로깅 금지                 │
   │ 4. (백그라운드) INSERT booking_clicks│
   │      {trip,place,user,provider,     │
   │       click_token, checklist_item}  │
   └───────────┬─────────────┬───────────┘
               │             │
        시스템 Safari    Supabase (RLS: 0021
               │          INSERT 정책, can_read_trip)
               ▼             │
   tp.media/r 또는            ▼
   c137.travelpayouts.com   booking_clicks row
   (TP가 sub_id 서버측 로깅,      │
    클릭ID 발급)                 ▼
               │          체크리스트 항목
               ▼          status: todo → clicked
   제휴 네트워크 리다이렉트      ('확인함', D-11/D-15)
   Klook: affiliate.klook.com/redirect?...&k_site={목적지}
   Airalo: airalo.pxf.io/...?...&u={목적지}
   KKday: invl.me/...?...&url={목적지}
               │
               ▼
   목적지 페이지 (장소명 검색결과 / 국가 eSIM 페이지)
   — 제휴 쿠키는 Safari 저장소에 설정·보존 (ATTR-02)
```

체크리스트 파생 흐름 (별도 경로):
```
plan 초안 (plans + plan_items, 0017)
      │ book 탭 진입 / 플랜 재생성 후
      ▼
reconcileChecklist (@moajoa/api)
  자동 파생: 숙소1 + 유심1(매핑 커버 시) + 교통1(매핑 커버 시)
           + isBookableActivity(place.category) 장소들
  규칙(D-13): status≠'todo' 또는 source='manual' → 보존
             신규 예약성 장소 → auto row upsert
             플랜서 빠진 미체크 auto row → 삭제
             플랜서 빠진 체크됨 row → 보존 + '플랜에 없음' 배지(클라 계산)
      ▼
booking_checklist_items (0021, trip-scoped — plan FK 금지!)
```

### 검증된 딥링크 규격 (2026-07-02 라이브 실측, marker 745749)

**Klook** — `c137.travelpayouts.com/click` 형식 [VERIFIED: 라이브 302 확인]:
```
https://c137.travelpayouts.com/click
  ?shmarker=745749.c_testresearch01        ← marker.SubID (dot 구분)
  &promo_id=4110                           ← Klook 프로그램 ID
  &source_type=customlink&type=click
  &custom_url=https%3A%2F%2Fwww.klook.com%2Fen-US%2Fsearch%2Fresult%2F%3Fquery%3DteamLab

→ 302 → https://affiliate.klook.com/redirect
           ?aid=api|13694|{클릭ID}-745749|pid|745749
           &k_site=https%3A%2F%2Fwww.klook.com%2Fen-US%2Fsearch%2Fresult%2F%3Fquery%3DteamLab
                    ↑ custom_url이 그대로 통과 — 장소 검색결과 직행(D-07) 성립
```

**Airalo** — `tp.media/r` 형식 [VERIFIED: 라이브 302 확인]:
```
https://tp.media/r
  ?marker=745749.c_testresearch01
  &p=8310&campaign_id=541                  ← Airalo 프로그램 ID (공식 문서 템플릿)
  &trs={PROJECT_ID}                        ← 대시보드에서 확인 (아래 Open Q1)
  &u=https%3A%2F%2Fwww.airalo.com%2Fjapan-esim

→ 302 → https://airalo.pxf.io/c/1209822/1310283/15608
           ?sharedID=745749_&subId1={클릭ID}-745749
           &u=https%3A%2F%2Fwww.airalo.com%2Fjapan-esim   ← 목적지 통과 확인
```

**KKday** — 네트워크는 Involve Asia. tp.st 샘플의 리다이렉트 체인으로 목적지 통과 구조 확인 [VERIFIED: 라이브 302]:
```
https://kkday.tp.st/gVbA69Yv
→ 302 → https://invl.me/clndj1c?aff_sub={클릭ID}-745749&url=https%3A%2F%2Fkkday.com
```
단, KKday의 동적 딥링크 템플릿(p/promo_id/campaign_id)은 공개 문서에 없음 → **사용자가 Travelpayouts 대시보드 Tools→Links에서 kkday.com 아무 페이지나 목적지로 넣어 딥링크 1개 생성·복사**하면 템플릿 파라미터가 드러난다(1분 작업, plan의 사전 준비물).

**SubID 규격** [CITED: support.travelpayouts.com — ID and SubID article, WebSearch 요약]:
- 허용 문자 = 라틴 문자·숫자·언더스코어, 최대 4096자. **dot(.)은 marker와 SubID의 구분자**라 SubID 값에 못 씀.
- **ClickTokenSchema(`c_[0-9A-Za-z]{8,30}`)와 완전 호환** — `c_` 접두의 언더스코어 허용, base62 본문 허용, dot 없음. 라이브 테스트에서 `shmarker=745749.c_testresearch01`이 정상 리다이렉트.
- tp.st 단축링크는 `?sub_id={값}` 동적 append 지원 [CITED: support.travelpayouts.com — dynamic SubID article]. `klook.tp.st/4wgIelSO?sub_id=c_testresearch01` 라이브 정상 [VERIFIED].

**buildAffiliateUrl 계약 테스트 호환 전략:** booking.test.ts는 travelpayouts URL에 `sub_id` substring + 토큰 substring을 단언한다. 실규격은 marker-dot이므로, **marker-dot(공식 규격) + `&sub_id={token}`(단축링크용 문서화 파라미터, redundant지만 무해)를 동시 주입**하면 계약 테스트 무수정으로 both 충족. TP가 어느 쪽을 통계에 집계하는지는 첫 실클릭 후 대시보드에서 확인(UAT 항목).

### 검색결과 딥링크 목적지 URL (D-07 / D-05)

| 대상 | URL 패턴 | 상태 |
|------|---------|------|
| Klook 장소 검색 | `https://www.klook.com/ko/search/result/?query={장소명}` | [ASSUMED] — en-US 패스로 302 통과는 확인, 렌더는 봇차단(403)으로 미확인 → 디바이스 UAT |
| KKday 장소 검색 | `https://www.kkday.com/ko/product/productlist?keyword={장소명}` | [ASSUMED] — 봇차단(403)으로 미확인 → 디바이스 UAT |
| Airalo 국가 eSIM | `https://www.airalo.com/{country}-esim` (예: japan-esim) | [VERIFIED: 라이브 fetch — "Japan eSIM, from $4.00" 페이지 확인] |
| Agoda 숙소 검색 (비제휴) | `https://www.agoda.com/ko-kr/search?textToSearch={도시}&checkIn={YYYY-MM-DD}&checkOut={YYYY-MM-DD}&rooms=1&adults=2` | [CITED: 검색결과 내 실제 Agoda URL 샘플 — texttosearch/checkin/checkout/rooms/adults 파라미터 확인] |
| Booking 숙소 검색 (비제휴) | `https://www.booking.com/searchresults.ko.html?ss={도시}&checkin={YYYY-MM-DD}&checkout={YYYY-MM-DD}&group_adults=2&no_rooms=1` | [CITED: developers.booking.com 문서 + 공개 예시 — ss는 자유 텍스트 목적지] |

숙소 비제휴 링크는 buildAffiliateUrl 밖 손조립이 되지 않게 **booking.ts 안에 `buildDirectSearchUrl(provider: 'agoda'\|'booking', params)` 별도 헬퍼**로 배치(잠긴 buildAffiliateUrl 시그니처 무수정, Pitfall-1 grep 가드가 booking.ts 밖 URL 리터럴 0을 계속 보장). booking_clicks에는 provider='agoda_direct' 등으로 로깅(수익 없어도 '확인함' 상태 전이에 필요).

### Recommended Project Structure
```
packages/core/src/
├── booking.ts             # buildAffiliateUrl 실규격 채움 + buildDirectSearchUrl 신설 (단일 조립 지점 유지)
├── booking-map.ts         # D-09 정적 매핑: BOOKING_REGION_MAP (city_code→국가→eSIM/교통패스) + 비교 라벨 상수
├── checklist.ts           # ChecklistItemSchema + deriveChecklistAutos 순수 파생 규칙 (D-10/D-13)
└── category.ts            # isBookableActivity 추가 (기존 placeVibe 무수정 — surgical append)

packages/api/src/queries/
└── bookings.ts            # listChecklist / reconcileChecklist / setItemStatus / addManualItem /
                           # deleteItem / logBookingClick (fire-and-forget INSERT)

supabase/migrations/
└── 0021_booking.sql       # booking_clicks: click_token 컬럼 + INSERT/멤버SELECT 정책
                           # booking_checklist_items 신설 + RLS (can_read/can_edit_trip 헬퍼 경유)

apps/ios/
├── app/trip/[id]/(tabs)/plan.tsx    # 인라인 카드 분기 (19-03 관리카드 분기 아래 surgical 삽입)
├── app/trip/[id]/(tabs)/book.tsx    # 스텁 → 체크리스트 홈 교체
└── components/booking/              # booking-card / compare-frame-card / checklist-row 등
```

### Pattern 1: 오픈 선행, 로깅 후행 (D-14)
**What:** 탭 즉시 브라우저 열고, 로깅은 절대 await하지 않는다.
**When to use:** 모든 예약 링크 탭.
```typescript
// apps/ios — 클릭 핸들러 (개념 코드; 실 구현은 @moajoa/api 래퍼 경유)
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import { buildAffiliateUrl, ClickTokenSchema } from '@moajoa/core';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function mintClickToken(): string {
  // CSPRNG — Math.random 금지. 16자 base62 (8-30 범위 내)
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  let body = '';
  for (const b of bytes) body += BASE62[b % 62];
  return ClickTokenSchema.parse(`c_${body}`);
}

async function onBookingTap(provider, productParams, ctx /* BookingClickContext */, itemId?) {
  const token = mintClickToken();
  const url = buildAffiliateUrl(provider, productParams, token);
  Linking.openURL(url);                      // ← 즉시. await 뒤에 로깅 두지 말 것
  logBookingClick(client, { ...ctx, provider, click_token: token, checklist_item_id: itemId })
    .catch(() => {});                        // fire-and-forget — 실패해도 UX 무영향 (D-14)
}
```
Source: expo-linking / expo-crypto 표준 API [CITED: docs.expo.dev/versions/latest/sdk/webbrowser — SFVC 쿠키 경고; expo-crypto getRandomValues]

### Pattern 2: 조건부 카드 삽입 (plan.tsx surgical)
**What:** 19-03 날짜투표 관리카드가 만든 선례 — 정상 렌더 앞/사이 조건 분기로 카드 삽입, 기존 상태머신(States A–F) 무수정.
**When to use:** Day 1 상단 숙소·유심·교통 카드(D-01/D-02) + 예약성 장소 항목 아래 컴팩트 버튼.
- 게이트: `plan !== null`(초안 존재) && `trip.start_date`(날짜 확정) — D-04. dateless trip은 19의 관리카드가 이미 점유하므로 충돌 없음(상호 배타 조건).
- 액티비티 버튼은 plan-item-row 렌더에 `isBookableActivity(place.category)` 분기로 추가.

### Pattern 3: 체크리스트 reconcile (D-10/D-13)
**What:** book 탭 로드 시 클라이언트가 파생 규칙을 실행해 auto rows를 DB와 화해시킨다.
```typescript
// @moajoa/core — 순수 파생 (테스트 용이); @moajoa/api가 DB 반영
// 자동 항목 키: 싱글턴은 (trip_id, kind) — 'stay' | 'esim' | 'transport'
//              액티비티는 (trip_id, place_id)
// reconcile:
//   1. 현 plan의 예약성 place_id 집합 + 매핑 커버되는 싱글턴 kind 집합 계산
//   2. 없는 auto 항목 INSERT (status='todo')
//   3. status='todo' AND source='auto' AND 집합 밖 → DELETE
//   4. status!='todo' → 절대 손대지 않음 (돈 쓴 기록, D-13)
// '플랜에 없음' 배지: 렌더 시 place_id ∉ 현 plan 집합이면 표시 (DB 상태 아님)
```
**Why client-side:** RLS(can_edit_trip)가 이미 게이트, 파생 규칙이 순수함수라 vitest로 계약 고정 가능, DB 트리거/EF보다 단순(Karpathy 2).

### Pattern 4: '확인함' 자동 전이 (D-11/D-15)
**What:** 클릭 로깅 성공 시 해당 checklist item의 status를 'todo'→'clicked'로 UPDATE(이미 'done'이면 무변경). 앱 복귀 시 재fetch로 조용히 반영 — 팝업 없음.
- booking_clicks에 `checklist_item_id` nullable FK를 두면 조인 불필요·전이 대상이 명시적. 인라인 카드 클릭(체크리스트 항목 존재 시)도 같은 item을 가리킴 — "데이터는 하나, 표면만 둘"(D-03).

### Anti-Patterns to Avoid
- **klook.com/kkday.com URL을 직접 오픈:** 어트리뷰션 0. 반드시 트래킹 URL(tp.media / c137.travelpayouts.com)이 첫 오픈 대상. 또한 목적지 도메인을 직접 열면 해당 네이티브 앱(Klook 앱 설치 시)이 universal link로 가로채 리다이렉트 체인 자체가 안 돈다. 트래킹 도메인을 열면 Safari 안에서 서버측 302로 진행되므로 universal link 자동 발동 없음(Safari는 리다이렉트에 배너만 표시).
- **plan_items에 체크 상태 저장:** 0017의 draft 덮어쓰기(delete→insert)가 재생성마다 rows를 파괴 — D-13 즉시 위반.
- **로깅 await 후 오픈:** 네트워크 지연/실패가 브라우저 오픈을 막음 — D-14 위반.
- **booking.ts 밖 URL 문자열 조립:** 17-02 Pitfall 1. grep 가드를 agoda/booking.com 리터럴까지 확장할 것.
- **marker/trs 하드코딩:** CLAUDE.md §4.7 — env 배선. 단 promo_id 4110 / p 8310 / campaign_id 541 같은 프로그램 구조 상수는 계정 비밀이 아니라 공개 프로그램 ID이므로 core 상수 허용(marker·trs만 env).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 클릭 어트리뷰션 서버 | 자체 리다이렉트 EF + 클릭ID 체계 | Travelpayouts redirect 엔드포인트 (tp.media/r, c*.tp.com/click) | TP가 클릭ID 발급·서버측 로깅·네트워크별 파라미터 변환(Impact/Involve Asia/Klook)을 전부 처리. 우리는 sub_id만 실어 보내면 대시보드에서 조회 가능 |
| 난수 토큰 | Math.random 기반 문자열 | expo-crypto getRandomValues | 예측 가능 토큰은 어트리뷰션 오염/충돌 위험. CSPRNG 한 줄 |
| URL 인코딩 | 수동 문자열 치환 | URLSearchParams / encodeURIComponent | 장소명(한글·공백·괄호)이 custom_url/u에 들어감 — 이중 인코딩·미인코딩 모두 리다이렉트 파손 |
| 권한 체크 | 클라 측 멤버십 검사 | 기존 can_read_trip/can_edit_trip RLS 헬퍼 | 0016 확립 패턴. 클라 중복 체크는 house 계약 위반 (T-18-17 선례) |
| presence 프로토콜 수정 | realtime 코드 패치/폴백 | supabase-js ≥2.108.2 업그레이드 | todo에서 2.108.2로 fix 실측 완료 — 앱 코드는 무수정이 정답 |

**Key insight:** 이 도메인의 복잡성은 전부 "제휴 네트워크마다 다른 파라미터 체계"에 있는데, Travelpayouts redirect 엔드포인트가 그 변환을 이미 흡수한다. 우리가 소유할 것은 (a) 토큰 형식, (b) 단일 조립 지점, (c) 목적지 URL 3가지뿐.

## Common Pitfalls

### Pitfall 1: tp.st 단축링크로 동적 딥링크 시도
**What goes wrong:** tp.st 링크는 생성 시점의 목적지에 고정 — 장소명 검색결과 직행(D-07)이 불가.
**Why it happens:** 대시보드가 기본으로 주는 게 단축링크라서.
**How to avoid:** 동적 조립은 redirect 엔드포인트(tp.media/r 또는 c*.travelpayouts.com/click) + 인코딩된 목적지 파라미터(u/custom_url). 라이브 검증 완료.
**Warning signs:** buildAffiliateUrl 출력에 tp.st가 남아 있으면 목적지 타깃팅이 안 되고 있는 것.

### Pitfall 2: SFafariViewController를 "시스템 브라우저"로 착각
**What goes wrong:** expo-web-browser로 열면 iOS 11+에서 Safari와 쿠키 미공유(앱별 격리 저장소) — 사용자가 나중에 Safari나 Klook 앱에서 구매하면 어트리뷰션 유실.
**How to avoid:** `Linking.openURL` — OS가 진짜 Safari로 라우팅. Expo 공식 문서가 이 격리를 명시함.
**Warning signs:** import에 expo-web-browser가 보이면 재검토. (참고: SFVC의 앱별 저장소도 영속적이라 같은 SFVC 세션 내 구매는 어트리뷰션됨 — 그러나 ATTR-02 문구와 크로스 세션 보존 모두 Linking.openURL이 우월.)

### Pitfall 3: 체크리스트를 plan에 묶기
**What goes wrong:** generate-plan EF는 draft를 delete→insert로 덮어씀(0017 멱등 규칙) — plan_id/plan_item_id FK가 있으면 재생성마다 체크 기록 소실(D-13 위반) 또는 FK 위반.
**How to avoid:** booking_checklist_items는 **trip_id + place_id(nullable)**로만 참조. plan과의 관계는 reconcile 시점의 계산일 뿐 FK 아님.
**Warning signs:** 0021 스키마에 `plan_id` 또는 `plan_item_id` 컬럼이 보이면 잘못된 설계.

### Pitfall 4: booking_clicks INSERT 정책 누락
**What goes wrong:** 0016은 owner-read SELECT만 있고 INSERT 정책이 0개 — 클라 INSERT가 RLS로 조용히 거부되고, fire-and-forget이라 에러도 안 보임 → '확인함' 전이가 영영 안 일어남.
**How to avoid:** 0021에서 `for insert to authenticated with check (user_id = auth.uid() and can_read_trip(trip_id))` + 멤버 SELECT 정책(`can_read_trip(trip_id)`) 추가 — D-11의 '확인함'은 멤버 모두의 클릭에 반응해야 하고(D-12), 현 owner-read로는 멤버가 남의 클릭 흔적을 못 봄.
**Warning signs:** psql `set role authenticated` INSERT 매트릭스 테스트 누락.

### Pitfall 5: pnpm override 미갱신으로 업그레이드 무효화
**What goes wrong:** 루트 package.json `pnpm.overrides`가 `"@supabase/supabase-js": "2.45.4"`로 **정확 핀** — 각 패키지의 `^2.110.0`을 올려도 override가 2.45.4로 강제해 업그레이드가 조용히 no-op.
**How to avoid:** override를 2.110.0으로 함께 갱신(또는 제거). `pnpm why @supabase/supabase-js`로 실 해석 버전 확인을 acceptance에 포함.
**Warning signs:** 업그레이드 후에도 presence가 계속 죽어 있음.

### Pitfall 6: @supabase/ssr peer 불일치
**What goes wrong:** ssr 0.5.1의 peer는 `^2.43.4` — supabase-js 2.110과 조합 시 peer 충돌 또는 런타임 auth 헬퍼 불일치.
**How to avoid:** `@supabase/ssr ^0.12.0` 동반 bump (peer `^2.108.0`). Edge Functions는 `jsr:@supabase/supabase-js@2`(deno.lock 2.105.4 핀)로 별도 세계 — npm bump와 무관함을 확인했다 [VERIFIED: supabase/functions/*/deno.lock].
**Warning signs:** apps/web 빌드 시 peer warning, 매직링크 로그인 회귀.

### Pitfall 7: 장소명 인코딩 파손
**What goes wrong:** 한글 장소명("팀랩 플래닛")이 custom_url/u 파라미터의 **중첩 쿼리**(목적지 URL 안의 query=)에 들어가 이중 인코딩 필요 — 한 번만 인코딩하면 TP redirect가 목적지 쿼리를 잘라먹거나, 두 번 인코딩하면 검색어가 %25EC%2585... 로 깨짐.
**How to avoid:** 목적지 URL을 먼저 완성(URLSearchParams로 query 인코딩) → 완성된 목적지 전체를 encodeURIComponent 1회 → u/custom_url에 주입. buildAffiliateUrl 계약 테스트에 한글 장소명 케이스 추가.
**Warning signs:** Safari 착지 페이지의 검색창에 %가 섞인 문자열.

### Pitfall 8: Klook/KKday 봇 차단 때문에 자동 검증 불가를 간과
**What goes wrong:** 두 사이트 모두 서버측 fetch에 403 — 검색 URL 패턴의 렌더 검증을 CI/자동 테스트로 못 한다. 패턴이 틀려도 코드 레벨에선 초록불.
**How to avoid:** 검색 URL 패턴을 core 상수로 두고(수정 1곳), phase UAT 체크리스트에 "실기기에서 카드 탭 → 검색결과 착지 확인" 명시. plan의 checkpoint:human-verify 대상.
**Warning signs:** 없음 — 구조적으로 사람 눈이 게이트.

## Code Examples

### buildAffiliateUrl travelpayouts 분기 실규격 (17-02 시그니처·가드 유지)
```typescript
// packages/core/src/booking.ts — Phase 20이 채울 형태 (개념 검증본)
// 라이브 검증: c137+promo_id=4110 (Klook), tp.media/r+p=8310&campaign_id=541 (Airalo)
// program 상수는 core, marker/trs는 env 주입 (CLAUDE.md §4.7)
type TpProgram = { kind: 'click'; host: string; promoId: string } | { kind: 'media'; p: string; campaignId: string };
const TP_PROGRAMS: Record<string, TpProgram> = {
  klook:  { kind: 'click', host: 'c137.travelpayouts.com', promoId: '4110' },
  airalo: { kind: 'media', p: '8310', campaignId: '541' },
  kkday:  { kind: 'media', p: 'FROM_DASHBOARD', campaignId: 'FROM_DASHBOARD' }, // Open Q1
};

// travelpayouts 분기 (기존 stay22 분기·ClickTokenSchema.parse 가드 무수정):
//   marker-dot이 공식 SubID 규격, sub_id 파라미터는 계약테스트 호환 + 단축링크 규격 겸용
// click형: `https://${host}/click?shmarker=${marker}.${token}&promo_id=${promoId}
//           &source_type=customlink&type=click&custom_url=${encodeURIComponent(destUrl)}&sub_id=${token}`
// media형: `https://tp.media/r?marker=${marker}.${token}&trs=${trs}&p=${p}
//           &campaign_id=${campaignId}&u=${encodeURIComponent(destUrl)}&sub_id=${token}`
```

### 0021 마이그레이션 골자 (append-only, 0016 idiom 준수)
```sql
-- click_token: 신규 컬럼은 NULLABLE (CLAUDE.md §4.3 downtime 회피)
alter table booking_clicks add column click_token text
  check (click_token ~ '^c_[0-9A-Za-z]{8,30}$');
alter table booking_clicks add column checklist_item_id uuid; -- FK는 테이블 생성 후

create table booking_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  kind text not null check (kind in ('stay','esim','transport','activity','custom')),
  title text not null check (char_length(title) between 1 and 80),
  status text not null default 'todo' check (status in ('todo','clicked','done')),
  source text not null default 'auto' check (source in ('auto','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 싱글턴 auto 항목 dedup: (trip, kind) — activity/custom 제외 partial unique
create unique index checklist_singleton_uq on booking_checklist_items (trip_id, kind)
  where source = 'auto' and kind in ('stay','esim','transport');
create unique index checklist_place_uq on booking_checklist_items (trip_id, place_id)
  where source = 'auto' and place_id is not null;

alter table booking_checklist_items enable row level security;
-- 전부 헬퍼 경유 (42P17 가드): SELECT=can_read_trip, INSERT/UPDATE/DELETE=can_edit_trip (D-12)
-- booking_clicks 추가 정책: INSERT to authenticated
--   with check (user_id = auth.uid() and can_read_trip(trip_id));
--   멤버 SELECT: using (can_read_trip(trip_id))  ← D-11 '확인함'을 멤버 모두가 봐야 함
```

### D-09 정적 매핑 (packages/core, CITY_KO_MAP 9개 도시와 정합)
```typescript
// CITY_KO_MAP 키: tokyo/osaka/kyoto/fukuoka/sapporo/okinawa (jp) + seoul/busan/jeju (kr)
// 한국인 타깃 → kr 도시는 eSIM 카드 자체를 숨김 (국내여행에 유심 무의미 — D-09 억지 추천 금지)
export const BOOKING_REGION_MAP: Record<string, {
  country: 'jp' | 'kr';
  esimPath: string | null;          // Airalo 목적지 경로
  transport: { labelKo: string; provider: 'klook' | 'kkday'; searchQuery: string } | null;
}> = {
  tokyo:   { country: 'jp', esimPath: 'https://www.airalo.com/japan-esim',
             transport: { labelKo: 'JR 패스', provider: 'klook', searchQuery: 'JR 패스' } },
  // osaka/kyoto → 간사이 패스, fukuoka/sapporo/okinawa → 지역 패스 or null …
  seoul:   { country: 'kr', esimPath: null, transport: null },  // 카드 숨김
  // …
};
```

### 비교 프레임 카드 정적 라벨 (D-06, 사용자 합의 결)
```
Klook  ─ 즉시확정·전세계 상품    [보기]
KKday  ─ 한국어 가이드 상품 강세  [보기]
```
(가격 자리: 각 행 라벨과 [보기] 사이 flex 공간 — 후일 가격 텍스트가 끼어도 레이아웃 무변경)

## Runtime State Inventory

해당 없음 — 이 phase는 rename/refactor/migration-of-identity가 아니라 신규 기능 추가. supabase-js 업그레이드도 스키마·데이터 무변경(todo 명시: "마이그레이션/스키마 무변경"). 카테고리별 확인:
- Stored data: 없음 — booking_clicks/booking_checklist_items는 신규 (기존 rows 0)
- Live service config: Travelpayouts 대시보드는 **읽기만** (marker/trs/템플릿 확인) — 변경 없음
- OS-registered state: 없음
- Secrets/env vars: **신규 추가만** (EXPO_PUBLIC_TP_MARKER 등) — 기존 키 무변경
- Build artifacts: pnpm lockfile 갱신 (supabase-js wave) — `pnpm install` 재실행으로 해소

## Common Pitfalls (프로세스)

(기술 pitfall은 위 섹션 — 여기는 planning 함정 1개만.)

### 플랜 wave에 supabase-js bump 섞기
CONTEXT가 명시 금지: 독립 wave/plan. lockfile 변경이 예약 코드 커밋과 섞이면 revert 불가 단위가 됨. supabase-js wave는 **파일 접점이 package.json 4개 + lockfile 뿐**이라 다른 wave와 완전 disjoint하게 병렬 가능하나, realtime 스모크(UAT)가 있으므로 **wave 1(또는 마지막 독립 wave)에 배치 + 자체 verify 게이트** 권장.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SFSafariViewController = Safari 쿠키 공유 | iOS 11부터 앱별 격리 저장소 | iOS 11 (2017) | "인앱 브라우저로 열어도 어트리뷰션 OK"는 9년 전 상식 — 현재는 Linking.openURL 필요 |
| tp.st 단축링크 중심 | tp.media/r 동적 딥링크 (u 파라미터) | TP 링크 API 도입 후 | 프로그램별 redirect 템플릿 하나로 임의 목적지 타깃 가능 |
| supabase-js 서브패키지 개별 버전 | 통합 버전(모든 @supabase/* 동일 버전) | 2.x 후기 | 2.110.0 bump 시 auth/postgrest/realtime/functions/storage 전부 2.110.0로 정렬됨 |
| supabase-js Node 18/20 지원 | 2.79.0에서 Node18 drop, 2.110.0에서 Node20 drop | 2025-04 / 2026-04 | 루트 engines node>=22라 무관하나 CI/Vercel 노드 버전 확인 필요 |

**Deprecated/outdated:**
- `WebBrowser.openBrowserAsync`를 어트리뷰션 목적으로 쓰는 패턴 — 쿠키 격리로 무의미 (문서·안내 페이지 열기엔 여전히 적합).

## Project Constraints (from CLAUDE.md)

- 마이그레이션 **append-only** — 0016~0020 무수정, 이 phase는 **0021**부터. 컬럼 추가는 NULLABLE/DEFAULT. 변경 후 `pnpm supabase:types` 재생성.
- RLS deny-by-default + cross-table은 SECURITY DEFINER 헬퍼(can_*_trip) 경유 — 직접 EXISTS 금지(42P17).
- 클라 = anon 키만. 서비스롤은 EF 안에서만 (이번 권고안은 EF 자체가 없음 — 서비스롤 미사용).
- 외부 입력 Zod validate (@moajoa/core). 워크스페이스 import `.js` 확장자 금지.
- `.env.local` 커밋 금지 — marker/trs는 `.env.local.example`에 placeholder, 실값은 env/eas.json.
- Conventional Commits + `packages/core`·`supabase/migrations`는 충돌 위험 영역(스키마·마이그레이션 페어 변경).
- Karpathy 4: 요청 범위만(비교 카드에 가격 fetch 금지 — deferred), surgical(plan.tsx 기존 상태머신 무수정 분기), 검증 가능한 목표(계약 테스트 + psql RLS 매트릭스).
- Web에 새 "보드 생성" UI 금지 — 이 phase는 iOS 전용 surface라 무관 (웹 예약 카드는 deferred 확인).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Klook 검색결과 URL이 `/ko/search/result/?query={장소명}` 형식으로 렌더된다 (봇차단으로 실렌더 미확인 — en-US 경로가 TP redirect를 통과하는 것까지만 확인) | 검색 딥링크 표 | 카드가 홈/404에 착지 → D-07 실패. 디바이스 UAT 1탭으로 판명, core 상수 1곳 수정으로 복구 |
| A2 | KKday 검색결과 URL이 `/ko/product/productlist?keyword={장소명}` 형식이다 | 검색 딥링크 표 | 동상 — UAT + 상수 수정 |
| A3 | tp.media/r에서 `trs` 생략 시에도 클릭이 marker 745749 계정에 정상 귀속된다 (redirect는 trs 없이 동작 확인했으나 통계 귀속은 미확인) | 딥링크 규격 | 클릭이 프로젝트 미귀속/유실 가능 → 대시보드에서 trs 확인해 env 주입 (Open Q1) — plan은 trs 포함을 기본으로 |
| A4 | marker-dot SubID(`745749.c_xxx`)가 TP 통계에 SubID로 집계된다 (공식 문서 규격이나 계정 대시보드 실측은 첫 실클릭 후 가능) | SubID 규격 | 집계 안 되면 `sub_id=` 파라미터(동시 주입 권고안)가 백업 — 첫 클릭 후 대시보드 확인이 UAT 항목 |
| A5 | Klook promo_id=4110이 이 계정의 Klook 프로그램에 유효하다 (문서 예시값 + 라이브 redirect 성공으로 방증되나, 계정별 상이 가능성 잔존) | 딥링크 규격 | 커미션 미귀속 가능 → 대시보드 생성 링크와 대조(Open Q1과 같은 1분 작업에 포함) |
| A6 | Agoda `textToSearch` + checkIn/checkOut 파라미터가 로그인 없이 검색결과를 프리필한다 | 검색 딥링크 표 | 숙소 카드가 빈 검색으로 착지 → Booking.com(ss 파라미터, 공식 문서 확인됨)으로 폴백 |
| A7 | EAS/Vercel 빌드 환경 Node ≥22 (supabase-js 2.110.0 요건) | Standard Stack | 빌드 실패 시 2.109.0으로 핀 (Node20 마지막 지원) |

## Open Questions

1. **KKday 동적 딥링크 템플릿 파라미터 (p 또는 promo_id / campaign_id)**
   - What we know: 네트워크는 Involve Asia(invl.me), 목적지 `url=` 통과 구조 확인. 공개 문서에 프로그램 ID 없음.
   - What's unclear: tp.media/r 형식의 KKday p/campaign_id 값.
   - Recommendation: **plan의 사전 준비물(checkpoint)** — 사용자가 대시보드 Tools→Links에서 kkday.com 목적지로 딥링크 1개 생성·복사 (동시에 Klook·Airalo 템플릿도 복사해 A3/A5의 trs·promo_id 대조까지 한 번에, 총 5분). 획득 전까지 KKday 버튼은 tp.st 정적 링크 + `?sub_id=` 폴백 가능(목적지 타깃만 손해).
2. **제휴 고지 위치 (D-16 planner 숙제)**
   - What we know: Travelpayouts 약관은 "법적 요건 + 각 프로그램 약관을 만족하는 고지"를 파트너 책임으로 규정 [CITED: support.travelpayouts.com Terms]. **링크 인접 고지를 명시 강제하는 조항은 발견 못 함.** 한국 표시광고법(공정위 지침)상 대가성 링크는 소비자가 인지 가능한 고지가 필요하다는 일반 원칙 존재 [ASSUMED — 법률 자문 아님].
   - Recommendation: D-16대로 설정/안내 페이지 고지로 시작하되, 카드 하단에 극소 문구("예약 시 수수료를 받을 수 있어요") 1줄을 **옵션 플래그**로 준비해 두면 규정 이슈 판명 시 즉시 승격 가능. planner가 카드 컴포넌트에 optional footer slot만 넣으면 됨.
3. **booking_clicks ↔ 체크리스트 항목 매핑 방식**
   - What we know: FK(checklist_item_id) 방식이 가장 명시적. 대안은 (trip,place,provider) 매칭.
   - Recommendation: FK 채택(위 0021 골자). 인라인 카드 탭 시점에 항목이 아직 없을 수 있음(체크리스트 미방문) → reconcile을 클릭 핸들러에서도 lazy 실행하거나 checklist_item_id를 nullable로 두고 사후 매칭 — planner 재량, nullable + 사후 매칭이 단순.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry 접근 | supabase-js bump 검증 | ✓ | npm view 정상 동작 확인 | — |
| Docker (supabase local) | 0021 로컬 적용 + typegen | ✗ (이 Windows 머신 — 메모리 기록) / ✓ (사용자 Mac colima — 19-01 선례) | — | 19-01 패턴: 마이그레이션 적용 task를 Docker 게이트로 표시 (autonomous:false 선례) |
| iOS 시뮬/디바이스 | 카드 UAT, Safari 오픈 검증 | ✗ (Windows) / ✓ (사용자 Mac `pnpm sim`) | — | checkpoint:human-verify (16-03/18-05/19-03 선례) |
| Travelpayouts 대시보드 | KKday 템플릿 + trs 확인 | ✓ (사용자 계정 활성, marker 745749) | — | — |
| supabase CLI | typegen/reset | ✓ | 로컬 설치 (메모리: dev-env-windows) | — |

**Missing dependencies with no fallback:** 없음 — Docker/iOS는 사용자 Mac에서 가용 (기존 phase 전부 이 패턴으로 실행됨).
**Missing dependencies with fallback:** 이 Windows 머신에서의 Docker/iOS — 실행 머신 분리로 해소.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^1.6.0 (core·api·web) + jest 29/jest-expo 56 (ios) |
| Config file | packages/*/vitest 설정 + apps/ios jest (기존) — 신규 설정 불필요 |
| Quick run command | `pnpm --filter @moajoa/core test` / `pnpm --filter @moajoa/api test` / `pnpm --filter @moajoa/ios test -- --watchman=false` |
| Full suite command | `pnpm -r --parallel run test` + `pnpm typecheck` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOK-01 | buildAffiliateUrl 실규격 (marker-dot·목적지 인코딩·한글 장소명) | unit | `pnpm --filter @moajoa/core test -- booking` | ✅ booking.test.ts 확장 (기존 15 케이스 무파손 필수) |
| BOOK-01 | isBookableActivity 판정 경계 (culture 포함, food/cafe 제외) | unit | `pnpm --filter @moajoa/core test -- category` | ✅ category 테스트 확장 |
| BOOK-01 | plan.tsx 인라인 카드 조건 렌더 (초안+날짜 게이트 D-04) | unit (RNTL) | `pnpm --filter @moajoa/ios test -- plan --watchman=false` | ✅ plan.test.tsx 확장 (19-03 관리카드 케이스 선례) |
| BOOK-02 | deriveChecklistAutos 파생/보존 규칙 (D-10/D-13) | unit | `pnpm --filter @moajoa/core test -- checklist` | ❌ Wave 0 — checklist.test.ts 신설 |
| BOOK-02 | bookings.ts 쿼리 래퍼 (RPC/체인 계약 + {error} throw) | unit | `pnpm --filter @moajoa/api test -- bookings` | ❌ Wave 0 — bookings.test.ts 신설 (plans.test.ts makeChain 하네스 복사) |
| BOOK-02/D-12 | 0021 RLS 매트릭스 (멤버 INSERT/UPDATE, 비멤버 거부) | integration | psql `set role authenticated` 매트릭스 (19-01 선례) | ❌ 마이그레이션 task 내 [BLOCKING, Docker 게이트] |
| BOOK-03 | buildDirectSearchUrl (Agoda/Booking 날짜 프리필) | unit | `pnpm --filter @moajoa/core test -- booking` | ✅ booking.test.ts 확장 |
| ATTR-02 | 탭 → Linking.openURL 즉시 호출 + 로깅 미대기 (mock 검증) | unit | `pnpm --filter @moajoa/ios test --watchman=false` | ❌ Wave 0 — booking-card 테스트 신설 |
| ATTR-02 | 실기기: Safari 오픈 + 착지 페이지 + TP 대시보드 클릭 집계 | manual-only | — (봇차단 + 실브라우저 필요) | checkpoint:human-verify |
| GAP-19D | presence 2-브라우저 수렴 + realtime 스모크 | manual-only | — (원격 realtime 필요, todo의 검증 기준) | checkpoint:human-verify |

### Sampling Rate
- **Per task commit:** 해당 패키지 filtered test + typecheck
- **Per wave merge:** `pnpm -r --parallel run test` + `pnpm typecheck` (현 베이스라인: core 77 / api 35 / web 65 / ios 87 — 전부 green 유지)
- **Phase gate:** full suite green + psql RLS 매트릭스 + 디바이스 UAT 배치 → `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/core/src/checklist.test.ts` — BOOK-02 파생 규칙
- [ ] `packages/api/src/queries/bookings.test.ts` — BOOK-02 쿼리 계약
- [ ] `apps/ios` booking 컴포넌트 테스트 — ATTR-02 오픈-선행 계약
- 프레임워크 설치 불필요 (vitest/jest 모두 기설치·기동작)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (기존 auth 재사용) | Supabase auth — 이 phase 신규 표면 없음 |
| V3 Session Management | no | — |
| V4 Access Control | **yes** | RLS: can_read_trip(SELECT)/can_edit_trip(write) SECURITY DEFINER 헬퍼 — 0021 정책 전부 헬퍼 경유, psql role 매트릭스로 검증 (19-01 선례) |
| V5 Input Validation | **yes** | zod (@moajoa/core): ClickTokenSchema 재파스(기존), ChecklistItem 스키마 신설, title 1..80. DB CHECK 이중화 |
| V6 Cryptography | **yes** | 토큰 = expo-crypto getRandomValues (CSPRNG). 절대 Math.random 금지 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL 인젝션 (장소명→custom_url) | Tampering | URLSearchParams/encodeURIComponent만 사용 — 문자열 연결 조립 금지 (buildAffiliateUrl 단일 지점이 구조적 방어) |
| 오픈 리다이렉트 표면 | Spoofing | booking-redirect EF **미채택**으로 표면 자체 제거 — 목적지는 core 상수/파생값만, 사용자 입력 URL 없음 |
| 타 사용자 명의 클릭 위조 | Spoofing | INSERT 정책 `user_id = auth.uid()` with check — 남의 user_id로 INSERT 불가 |
| 비멤버의 클릭/체크리스트 열람 | Info Disclosure | SELECT 정책 can_read_trip — 클릭 토큰은 opaque(PII 없음, 17-02 설계) |
| 예측 가능한 클릭 토큰 | Tampering | CSPRNG 16자 base62 (~95 bit) — 충돌·추측 비현실적 |
| 서비스롤 노출 | Elevation | 이 권고안은 서비스롤 자체를 안 씀 (클라 anon 키 + RLS 만) |

## Sources

### Primary (HIGH confidence — 라이브 실측)
- **라이브 리다이렉트 검증 (marker 745749, 2026-07-02):** klook.tp.st/4wgIelSO(+`?sub_id=`) → affiliate.klook.com/redirect(k_site 통과); c137.travelpayouts.com/click?shmarker=745749.c_xxx&promo_id=4110&custom_url=... → k_site 정확 통과; tp.media/r?marker=745749.c_xxx&p=8310&campaign_id=541&u=... → airalo.pxf.io(u 통과); kkday.tp.st → invl.me(url 통과); airalo.com/japan-esim 페이지 실존
- **codebase:** packages/core/src/booking.ts(+test), category.ts, packages/api/src/queries/plans.ts, supabase/migrations/0016(L582-606 booking_clicks)·0017~0020, apps/ios/package.json, 루트 package.json(pnpm override), supabase/functions/*/deno.lock(jsr 핀)
- **npm registry:** supabase-js 2.110.0(2026-06-30) / @supabase/ssr 0.12.0 peer `^2.108.0` / 0.5.1 peer `^2.43.4`

### Secondary (MEDIUM confidence — 공식 문서, WebSearch 요약 경유)
- docs.expo.dev/versions/latest/sdk/webbrowser — openBrowserAsync=SFSafariViewController, iOS 11+ Safari 쿠키 미공유 명시, Safari 앱 오픈 옵션 부재 (직접 fetch 성공)
- support.travelpayouts.com — ID/SubID(marker.subid, 라틴·숫자·언더스코어, 4096), dynamic sub_id(tp.st), Klook links(promo_id 4110), Airalo(tp.media/r 템플릿 p=8310 campaign_id=541), Terms(고지 책임) — 사이트가 봇 403이라 WebSearch 요약 경유
- developers.booking.com — searchresults.html?ss/checkin/checkout/group_adults/no_rooms
- github.com/supabase/supabase-js releases + supabase.com/changelog — Node 지원 drop 시점, realtime serializer 변경
- branch.io / AppAuth-iOS #120 — iOS 11 SFVC 쿠키 격리 역사 (교차 확인)

### Tertiary (LOW confidence — UAT로 검증 필요)
- Klook `/ko/search/result/?query=` · KKday `/ko/product/productlist?keyword=` 렌더 (A1/A2)
- Agoda textToSearch 프리필 동작 (A6 — 검색결과 내 실 URL 샘플에서 파라미터명 확인은 됨)

## Metadata

**Confidence breakdown:**
- 딥링크 조립·SubID 호환: HIGH — 계정 실 marker로 라이브 302 실측 (KKday 템플릿만 대시보드 1회 복사 잔존)
- 시스템 브라우저 선택: HIGH — Expo 공식 문서 + 역사적 교차 확인
- 체크리스트 데이터 모델: HIGH — plan_items 파괴 규칙(0017)이 codebase에서 직접 확인된 구조적 근거
- supabase-js 업그레이드: HIGH — npm registry 직접 확인 + peer 매트릭스 실측
- 검색 URL 렌더: LOW — 봇차단으로 실기기 UAT가 유일한 게이트 (구조상 상수 1곳 수정으로 복구 가능하게 설계)

**Research date:** 2026-07-02
**Valid until:** 2026-08-01 (딥링크 규격·supabase-js 버전은 30일 내 안정 예상; TP 프로그램 파라미터는 계정 대시보드가 항상 우선)
