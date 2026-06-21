# Pitfalls Research — MOAJOA v2.0 (발견→예약→정산 풀 루프)

**Domain:** AI 여행 플랫폼 — 제휴 수익화 · 인바운드 이메일 파싱 · LLM 자동 플랜 · 다통화 가계부 · Android 포팅 · 네비게이션 재편
**Researched:** 2026-06-21
**Confidence:** MEDIUM-HIGH (제휴/이메일/Play Store는 official+다중 출처 HIGH, LLM 플랜·FX는 도메인 패턴 MEDIUM, Android Expo 패리티는 plugin docs MEDIUM)

> 이 문서는 v2.0 전면 개편 기준 신규 작성이다. v1 마일스톤의 share-extension·deep-link·App Group 함정은 이미 코드에 인라인 인용돼 해소됨(`+native-intent.tsx`, `app.config.ts`). 여기서는 **이번 마일스톤에 새로 들어오는 6개 기능 영역에 특화된 함정 + 영역 간 통합 함정**만 다룬다. 일반 웹 보안·일반 LLM 팁은 제외.

---

## Critical Pitfalls

### Pitfall 1: 제휴 어트리뷰션 마커(SubID) 누락 — 수수료가 "Unknown"으로 빠짐

**What goes wrong:**
딥링크 예약 버튼은 잘 뜨고 클릭도 잘 되는데, 정작 정산 대시보드에서 우리가 발생시킨 예약이 우리 것으로 안 잡힌다. Travelpayouts는 `marker=ID.subID`가, Stay22(Allez)는 campaign ID + claimed domain이 붙어야 어트리뷰션이 된다. 이게 빠지면 클릭은 카운트돼도 커미션이 "Unknown" 버킷으로 가거나 0원이 된다.

**Why it happens:**
- 개발 중에는 베어 어필리에이트 링크(마커만, SubID 없음)로 테스트 → "링크 열림 = 끝"으로 착각.
- SubID는 per-trip/per-user 분해(어느 여행·어느 사용자가 전환시켰나)에 쓰는데, MVP에선 "나중에 붙이면 되지"로 미룸 → 초기 데이터가 영구히 익명화됨.
- Stay22는 settings에서 도메인을 claim 안 하면 모든 전환이 `Unknown` 태그. 앱 딥링크(WebView/in-app browser)는 referer 도메인이 없어 특히 위험.

**How to avoid:**
- 딥링크를 만드는 단 하나의 헬퍼를 `packages/core`에 둔다(예: `buildAffiliateUrl(provider, productParams, { tripId, userId })`). 손으로 링크를 조립하는 코드를 절대 허용하지 않음 → 마커/SubID 누락이 구조적으로 불가능해짐.
- SubID 포맷을 Day1에 확정: `tripId` 또는 `tripId.userId`. 익명 이후 채우기는 불가능하니 첫 줄부터 넣는다.
- Stay22 도메인 claim + 가능하면 deep-link에 자체 식별자 동봉. 인앱 브라우저(WKWebView / Android Custom Tabs)가 third-party cookie를 어떻게 다루는지 실측(아래 Pitfall 2).
- "전환 1건이 우리 SubID로 대시보드에 찍힌다"를 phase exit criterion으로 삼는다 — 클릭 카운트가 아니라 **attributed booking**으로.

**Warning signs:**
- 대시보드 `Unknown`/`no subid` 비율 > 0.
- 딥링크 URL에 `marker=`/`sub_id=`/campaign param이 없음.
- 클릭 수 >> 전환 수인데 전환의 SubID가 비어 있음.

**Phase to address:** 가격비교/제휴 예약 phase (수익화). exit gate = 실제 전환 1건이 SubID로 어트리뷰션됨.

---

### Pitfall 2: 인앱 브라우저 쿠키 격리 + 짧은 쿠키 기간 → 어트리뷰션 윈도우 증발

**What goes wrong:**
어필리에이트는 클릭 시 디바이스에 쿠키를 심고, 그 기간 안에 예약하면 커미션이 잡힌다. 그런데 (a) 쿠키 기간이 생각보다 짧고 — **Stay22↔Booking은 24시간**, Travelpayouts는 보통 **30일이지만 프로그램마다 다름** — (b) iOS `WKWebView`/Android Custom Tabs의 ephemeral/격리 쿠키 저장소에서 열면 third-party 쿠키가 시스템 사파리·크롬과 공유 안 돼, 사용자가 나중에 "진짜 브라우저"로 돌아와 예약하면 쿠키가 없어 전환이 날아간다.

**Why it happens:**
- "쿠키 30일이니 넉넉하다"고 가정하지만 핵심 숙소 제휴(Stay22→Booking)가 24시간이라는 걸 모름. 여행 예약은 며칠~몇 주 숙고하는 게 정상이라, 24시간 윈도우는 실제 전환의 대부분을 놓친다.
- 인앱 WebView vs 시스템 브라우저(ASWebAuthenticationSession / Custom Tabs)의 쿠키 공유 차이를 검증 안 함. 보안상 격리된 WebView에서 열면 어트리뷰션이 거기서 끝남.

**How to avoid:**
- 외부 예약은 **시스템 브라우저**(`expo-web-browser`의 적절한 모드 / Custom Tabs / Safari)로 연다. 격리 WebView 금지 — 쿠키가 사용자의 실제 브라우저에 남아야 나중 전환도 잡힌다.
- 각 제휴 프로그램의 쿠키 기간을 표로 관리하고(24h vs 30d) 24h짜리 숙소는 UX로 "지금 바로 예약" 넛지를 더 강하게. 30d 프로그램(항공·eSIM 등)을 우선 노출 검토.
- 제휴 프로그램 선택 자체를 쿠키 기간·커미션율 기준으로 한다. 24h 윈도우 프로바이더에 트래픽을 몰지 않는다.

**Warning signs:**
- "딥링크 클릭은 많은데 전환율이 비정상적으로 낮음"(쿠키 증발).
- 외부 링크가 인앱 모달 WebView로 열림(시스템 브라우저 아님).
- 쿠키 기간을 모르는 채 제휴 프로그램을 붙임.

**Phase to address:** 가격비교/제휴 예약 phase. 브라우저 오픈 모드 결정은 `/gsd-discuss-phase`에서 잠근다.

---

### Pitfall 3: 전달 이메일 사용자 식별 — 누가 보냈는지 vs 누구의 여행인지

**What goes wrong:**
가계부의 핵심 입력 경로는 "개인 전용 주소로 예약 메일 전달". 그런데 사용자가 메일을 전달하면 인바운드 SMTP가 보는 **발신자(From)는 사용자가 아니라 사용자의 메일 클라이언트/원래 예약처**가 될 수 있고, 전달 헤더 포맷은 Gmail/Outlook/Apple Mail마다 다 다르다. "From으로 사용자 식별"을 하면 잘못된 사용자의 가계부에 항목이 붙거나(데이터 유출!) 매칭 실패로 드롭된다. TripIt조차 "다른 사람이 전달한 확인 메일은 트래블러를 구분 못 한다"고 명시한다.

**Why it happens:**
- 단일 인박스(`ledger@moajoa.app`)로 받고 From 헤더로 사용자를 찾으려 함 → 전달 시 From이 변형/스푸핑 가능, 신뢰 불가.
- 전달된 메일의 "원본 발신자"를 본문에서 정규식으로 긁으려다 클라이언트별 포맷 폭발에 빠짐.

**How to avoid:**
- **주소 자체에 사용자 토큰을 박는다(plus-addressing 또는 서브도메인):** `ledger+<opaqueUserToken>@moajoa.app` 또는 `<token>@inbound.moajoa.app`. 받는 주소(envelope recipient / `To`)로 사용자를 식별 — From은 식별에 절대 쓰지 않는다. TripIt 패턴: "최종 배달 목적지를 읽지, 원래 발신자를 읽지 않는다."
- 토큰은 추측 불가능한 랜덤(유저 UUID 직접 노출 X). 토큰 유출 시 회전 가능하게.
- 인바운드 서비스(Postmark/SendGrid Inbound Parse 등)는 envelope `To`/`recipient` 필드를 제공하니 그걸로 라우팅. 본문 파싱은 사용자 식별이 끝난 뒤에만.

**Warning signs:**
- 사용자 식별 로직이 `From:` 헤더를 읽음.
- 모든 사용자가 같은 주소(`ledger@`)로 보냄.
- 다른 사람이 전달한 테스트 메일이 엉뚱한 계정에 붙음.

**Phase to address:** 여행 가계부(인바운드 메일 파싱) phase. 주소 스킴 결정을 가장 먼저 잠근다.

---

### Pitfall 4: 인바운드 메일 스푸핑 + 본문 무차별 저장(개인정보)

**What goes wrong:**
인바운드 주소는 공개되면 누구나 메일을 쏠 수 있다. 인증(SPF/DKIM/DMARC) 검증 없이 받으면 (a) 공격자가 위조 예약을 사용자 가계부에 주입하거나, (b) 스팸이 LLM 파싱 비용을 태운다. 동시에 예약 메일은 카드 끝자리·여권·예약 PNR 등 민감정보 덩어리 — 원문을 그대로 DB에 영구 저장하면 개인정보 사고의 폭탄을 안는 셈.

**Why it happens:**
- 인바운드 파싱을 "그냥 받아서 LLM에 던지면 됨"으로 단순화.
- 디버깅 편의로 raw 메일 전체(원문 HTML+첨부)를 테이블에 박아둠 → 잊혀진 채 누적.

**How to avoid:**
- 인바운드 프로바이더가 검증한 SPF/DKIM 결과를 신뢰 신호로 사용. DMARC 정렬 실패/미인증 메일은 격리하거나 LLM에 안 태움. envelope recipient 토큰이 유효 사용자와 매칭될 때만 처리.
- **본문 저장 최소화:** LLM 파싱 결과(구조화 필드: 금액·통화·날짜·프로바이더·항목)만 저장하고 원문은 짧은 TTL(예: 파싱 성공 후 N일) 후 폐기하거나 아예 안 저장. 저장해야 하면 카드번호·PNR 등은 마스킹/레닥션 후 저장.
- 첨부(PDF e-ticket 등)는 신뢰 발신자에서만 처리, 크기·타입 화이트리스트.
- 데이터 최소화는 Play/App Store Data Safety 신고(아래 Pitfall 10)와도 직결 — "수집 안 하면 신고할 것도 없다."

**Warning signs:**
- 인바운드 핸들러에 SPF/DKIM 분기 없음.
- `inbound_emails.raw_html` 같은 컬럼에 원문이 무기한 쌓임.
- 미인증 발신자의 메일이 가계부에 항목을 만듦.

**Phase to address:** 여행 가계부 phase. RLS·저장 스키마 설계 시 마이그레이션과 짝지어 결정.

---

### Pitfall 5: LLM 자동 플랜 환각 — 닫힌 가게·불가능한 동선·비용 폭증

**What goes wrong:**
"추출 직후 = 즉시 AI 플랜"이 v2의 아하 순간인데, LLM 단독 일정은 (a) 이미 문 닫은 시간에 박물관 배치, (b) 차로 2시간 거리를 30분 슬롯에 우겨넣기, (c) 존재하지 않거나 폐업한 장소를 그럴듯하게 생성, (d) 추출된 장소 수가 많을수록 토큰·호출이 늘어 추출당 < $0.005 예산을 넘김. 연구 일관된 결론: **그라운딩 없는 LLM은 정량 제약(영업시간·이동시간)에서 신뢰 불가, Maps 데이터로 그라운딩하면 환각·비현실 타이밍이 사실상 사라진다.**

**Why it happens:**
- "Claude한테 장소 리스트 주고 일정 짜줘" 한 방으로 끝내려 함. LLM은 정성(취향·테마)은 잘하지만 정량(거리·시간)은 못한다.
- 영업시간/좌표를 이미 Places API로 갖고 있는데 프롬프트에 안 넣음 → LLM이 추측(환각).
- 출력 검증 루프가 없어 "그럴듯한 잘못된 일정"이 그대로 사용자에게 노출.

**How to avoid:**
- **하이브리드:** LLM은 클러스터링/순서/테마만 정하고, 영업시간·이동시간은 우리가 가진 Places 데이터 + 거리 행렬로 후처리 검증·조정. 우리는 이미 추출 단계에서 좌표·영업시간을 확보하니 그걸 플랜 단계로 흘린다.
- 좌표 없는/검증 안 된 장소는 일정에 자동 배치하지 않음(LLM이 새 장소를 "발명"하지 못하게 입력 후보를 우리 DB place로 제약).
- 비용 가드레일: 입력 장소 수 상한, 출력 토큰 상한, 일정 길이 상한. 추출 코스트 테이블(이미 0004/0005 존재) 패턴 재사용해 플랜 코스트도 로깅. 캐싱(같은 보드 재플랜 시 재사용).
- 검증 가능한 성공 기준: "생성된 일정의 모든 슬롯이 (영업시간 내) AND (직전 장소에서 이동시간 ≤ 슬롯 갭)" 자동 체크 → 위반 시 재배치. `/gsd-plan-phase`의 verify 루프로.

**Warning signs:**
- 플랜에 좌표 없는 장소가 등장.
- 이동시간 검증 코드 없음(슬롯 시간 = LLM이 부른 대로).
- 플랜 1건 코스트가 추출 코스트보다 큰데 측정 안 함.
- 사용자 테스트에서 "여기 지금 닫았는데?" 피드백.

**Phase to address:** 자동 AI 플랜 phase. exit gate = 영업시간·이동시간 검증 통과율 측정.

---

### Pitfall 6: 환율 — 예약시점 vs 결제일 vs 카드명세 환율의 3중 불일치

**What goes wrong:**
가계부가 "카드·통화·환율·결제시점"을 정리한다고 약속했는데, 외화 결제는 환율이 **세 시점에서 다르다**: 예약 확정 시점(메일에 찍힌 환율), 카드사 결제(매입) 시점(보통 T+1~T+2 뒤 settlement rate), 그리고 최종 명세 표시. 메일의 ₩ 환산액을 "진짜 낸 돈"으로 저장하면 카드 명세와 안 맞아 사용자가 신뢰를 잃는다. 또 ₩/$/¥가 섞인 여행에서 통화를 안 들고 다니면 합계가 의미 없어진다.

**Why it happens:**
- 메일에 적힌 한 줄 ₩ 금액을 그대로 "지출"로 저장 → 그건 예약시점 추정 환율일 뿐 실제 매입가가 아님.
- 내부적으로 모든 걸 ₩ 단일 통화로 캐스팅해 원통화·원환율 정보를 버림 → 사후 정정 불가.

**How to avoid:**
- **항상 (원통화 금액 + 원통화 코드 + 환율 출처/시점)을 원자적으로 저장.** ₩ 환산은 표시용 파생값이지 진실의 원천이 아니다. 결제일 매입 환율이 확정되면 그때 갱신(또는 "예약시점 추정 / 결제확정" 상태 플래그).
- 통화는 ISO 4217 코드로, 합계는 통화별로 분리하거나 표시 시점 환율로 환산(환산이라고 라벨링). "혼재 통화 합계"를 단일 숫자로 뭉개지 않는다.
- 환율 소스를 명시(메일 내 값 / 외부 환율 API / "추정"). 정확도를 못 보장하는 값은 "약" 표기.
- 스키마에 `amount`, `currency`, `fx_rate`, `fx_source`, `fx_as_of`, `amount_krw_est` 분리 — 마이그레이션과 짝지어.

**Warning signs:**
- 지출 레코드에 통화 컬럼이 없거나 항상 'KRW'.
- 메일의 ₩ 값을 실제 결제액으로 신뢰.
- 다통화 합계가 단일 숫자로 표시되고 환산 시점 라벨 없음.

**Phase to address:** 여행 가계부 phase(스키마). FX 표시 정확도는 LLM 파싱 phase와도 연결.

---

### Pitfall 7: 네비게이션 재편 — 탭바 유실 · 딥링크/공유 라우트 깨짐 · 1개 여행 바로진입 엣지

**What goes wrong:**
`(tabs)/{boards,discover,me,friends,new}` 전역 탭에서 `trip/[id]/(tabs)/{map,plan,book,ledger}` **여행 스코프 탭**으로 IA를 통째로 뒤집는다. 흔한 사고:
- 중첩 `(tabs)` 그룹에서 `_layout`을 잘못 짜 상세 화면 진입 시 탭바가 사라짐(혹은 탭바 안에 탭바가 중첩).
- 기존 딥링크/공유 링크(`/boards/[id]`, `/share-handler`, web `/b/[slug]`)가 새 `trip/[id]/...` 구조로 못 가 404 → 카톡으로 뿌린 옛 링크가 다 깨짐.
- "여행 1개면 목록 없이 바로 진입 / 여러 개면 마지막 / 0개면 welcome" 진입 로직의 엣지(여행 삭제 직후 0개, 동시 생성 경합, 마지막 여행이 삭제된 경우)에서 빈 화면/크래시.
- `+native-intent.tsx`가 share 딥링크를 `/share-handler`로 보내는데, share-handler가 새 trip 라우트로 라우팅하도록 같이 안 고치면 저장 플로우가 끊김.

**Why it happens:**
- expo-router 그룹/중첩 레이아웃은 라우트 머신이라 한 번에 뒤집으면 회귀가 조용히 숨음(타입드 라우트가 있어도 런타임 진입 순서까지는 못 잡음).
- 기존 보드(=여행)와 새 trip 컨셉의 매핑/마이그레이션을 안 정해 "기존 보드는 어느 trip 탭으로?"가 공백.
- 진입 로직을 한 곳(`index.tsx`)에만 두고 0/1/N 분기를 테스트 안 함.

**How to avoid:**
- 보드↔trip 매핑을 먼저 결정: 기존 `boards`가 곧 trip인가, 아니면 trip이 boards를 감싸나? 데이터 마이그레이션(또는 뷰)로 기존 보드가 새 라우트에서 그대로 열리게. append-only 마이그레이션 규칙 준수.
- **하위호환 라우트 유지:** 옛 `/boards/[id]` → 새 `trip/[id]/...`로 리다이렉트(앱 내 + web). 이미 배포된 공유 링크는 영구히 살아 있어야 함. web `/b/[slug]`는 SSR 열람 경로라 절대 깨면 안 됨.
- 진입 분기(0/1/N 여행)를 명시적 함수로 빼고 각 케이스 테스트: 0→welcome, 1→`trip/<id>/plan`, N→마지막. "마지막 여행이 방금 삭제됨" 엣지 포함.
- 탭바 유지를 검증 기준으로: 모든 4탭 + 상세 push에서 탭바가 보인다(중첩 레이아웃 회귀 체크).
- `+native-intent.tsx`/`share-handler.tsx`/`index.tsx`를 IA 변경과 **한 phase에서 같이** 고친다(흩어지면 한쪽만 새 라우트를 알게 됨).

**Warning signs:**
- 상세 화면에서 탭바가 사라짐.
- 옛 공유 링크가 404 / 새 구조로 리다이렉트 안 됨.
- 여행 0개 또는 삭제 직후 빈 화면/크래시.
- share-handler가 여전히 `/boards/...`로만 보냄.

**Phase to address:** 네비게이션/IA 재편 phase. 회색지대(보드↔trip 매핑, 리다이렉트 정책, 진입 분기)는 반드시 `/gsd-discuss-phase`에서 잠근다.

---

### Pitfall 8: Android 포팅 — share intent 패리티 · 권한/네이티브 모듈 차이 · Play 심사

**What goes wrong:**
"Expo라 재작성 아님"은 맞지만 **자동 패리티는 아니다.** 함정:
- iOS share extension은 별도 프로세스 + App Group으로 통신하지만, Android는 `ACTION_SEND` intent + AndroidManifest 인텐트 필터로 동작 — 모델이 다르다. iOS의 App Group(`group.com.serendipitylife.moajoa`) 의존 코드는 Android에서 무의미. `expo-share-intent`가 양쪽을 추상화하지만 활성화 규칙·받는 MIME/payload 형태가 달라 한쪽만 테스트하면 다른쪽이 빈 payload로 깨진다.
- 권한 모델 차이: iOS `infoPlist` 문자열 vs Android 런타임 권한 + `AndroidManifest` 선언. 위치·알림·딥링크(App Links vs Universal Links) 설정이 별도.
- react-native-maps: iOS는 Google Maps API 키를 플러그인이 주입(현 config), Android는 별도 키 + SHA-1 서명 등록 + Maps SDK 활성화 필요. 키 누락 시 회색 지도.
- Hermes/엔진은 공유지만 네이티브 빌드는 별개 — iOS에서 동작한 게 Android 빌드에서 깨질 수 있음.
- Play 심사: Data Safety 폼(아래 Pitfall 10), 타깃 API 레벨, 딥링크 검증.

**Why it happens:**
- "iOS에서 됐으니 Android도 되겠지"라는 가정. 공유 코드(RN/Expo)와 네이티브 설정(권한·키·intent)을 구분 안 함.
- iOS 전용 가정(App Group, Universal Links, infoPlist)이 코드에 박혀 있고 Android 분기 없음.

**How to avoid:**
- share 입력 경로를 플랫폼 추상화 뒤로: payload 읽기를 `expo-share-intent`의 크로스플랫폼 API로만(App Group 직접 접근 코드를 share 로직에 두지 않음). Android `ACTION_SEND`로 URL/텍스트 받는 걸 실기기에서 별도 검증.
- 권한·키를 플랫폼별 체크리스트로: Android Maps 키 + SHA-1, 위치 런타임 권한, 알림, App Links(`assetlinks.json`) — iOS 설정과 1:1 대조.
- "iOS에서 됨 = 완료"를 금지. share 저장·지도·딥링크·예약 외부브라우저(Custom Tabs 쿠키, Pitfall 2)를 Android 실기기에서 재검증.
- 임시 fallback(반응형 웹 예약)을 둬서 Android 네이티브가 늦어도 결제자(대표)가 막히지 않게 — PRODUCT 12절 명시 경로.

**Warning signs:**
- share 로직이 App Group/UserDefaults를 직접 읽음(iOS 전용).
- Android에서 지도가 회색(키/SHA-1 누락).
- Android share가 빈 payload.
- Android 실기기 테스트 없이 "패리티 완료" 선언.

**Phase to address:** Android 포팅 phase. share·maps·권한 패리티 각각을 exit criterion으로.

---

## Integration Pitfalls (영역 간 — 가장 놓치기 쉬움)

### Pitfall 9: 추출→플랜→예약→가계부 식별자 단절(루프가 안 닫힘)

**What goes wrong:**
플라이휠의 핵심은 한 trip 안에서 place → plan slot → 예약 클릭(딥링크 SubID) → 결제 메일(가계부 항목)이 **같은 trip/place로 연결**되는 것. 그런데 각 기능을 따로 만들면: 딥링크 SubID는 `tripId`만 담고 어느 place에서 눌렀는지 안 담음 → 가계부의 ₩50,000 호텔비가 어느 일정·어느 추천에서 나왔는지 매칭 불가 → "예약·결제 데이터가 다음 발견을 똑똑하게"라는 BM 근거(방문 인증 제거의 대체물)가 성립 안 함.

**Why it happens:**
기능별 phase가 독립적으로 진행되며 공통 식별자 계약을 안 정함. SubID 포맷, 가계부 항목의 `trip_id`/`place_id` FK, 플랜 슬롯↔place 링크가 제각각.

**How to avoid:**
- `packages/core`에 **트립 스코프 식별자 계약**을 한 번 정의: SubID 인코딩(`tripId[.placeId][.userId]`), 가계부 항목·플랜 슬롯·예약 클릭이 모두 `trip_id`(+가능하면 `place_id`) 보유. 예약 메일 파싱 시 프로바이더·날짜·금액으로 휴리스틱 매칭하되, SubID가 살아 돌아오면(일부 네트워크는 SubID를 리포트에 반환) 그걸로 정확 매칭.
- 루프 닫힘을 통합 테스트: "딥링크 클릭 → (모의) 예약 메일 → 가계부 항목이 같은 place에 붙음"을 한 번이라도 e2e로 통과.

**Warning signs:**
- SubID에 trip/place 컨텍스트 없음.
- 가계부 항목에 `trip_id` FK 없음.
- "이 지출이 어느 추천에서 왔나"를 답할 수 없음.

**Phase to address:** 가장 먼저 진행되는 수익화 또는 가계부 phase에서 식별자 계약을 잠그고, 나머지 phase가 그 계약을 import.

---

### Pitfall 10: Play/App Store Data Safety 폼 ↔ 실제 데이터 흐름 불일치(심사 거절 #1) + 제휴 공시

**What goes wrong:**
2026 Play 심사에서 가장 빈번한 거절은 데이터 수집 자체가 아니라 **Data Safety 폼 신고와 앱 실제 행동의 불일치**. v2는 새 데이터를 대거 수집: 이메일 본문(예약/결제 정보), 카드 끝자리·통화, 위치, 그리고 제휴 클릭 트래킹. SDK/API(어트리뷰션, 분석)가 뒤에서 수집하는 것까지 신고 안 하면 "deceptive disclosure"로 즉시 거절. 또 제휴 수익(커미션)을 사용자에게 공시 안 하면 deceptive behavior 정책에 걸릴 수 있음.

**Why it happens:**
- 직접 수집하는 것만 신고하고 어트리뷰션/분석 SDK가 긁는 식별자·위치를 빠뜨림.
- 가계부가 결제·금융 정보를 다루는데 폼의 financial info 항목을 누락.
- 제휴 링크가 수익을 낸다는 공시를 UX에 안 넣음.

**How to avoid:**
- v2에서 추가되는 모든 데이터(이메일 본문→파싱 필드, 카드 끝자리, 통화, 위치, 어트리뷰션 ID)를 Data Safety/App Privacy 폼에 정확히 매핑. Pitfall 4의 데이터 최소화는 신고 부담도 줄임 — "안 저장하면 신고 안 해도 됨."
- 제휴 링크에 "예약 시 수수료를 받을 수 있어요" 류 공시(앱 정책·약관 + 가능하면 인라인).
- iOS App Privacy(Nutrition Label)도 동일하게 일치시킴 — 양쪽 스토어 동시 대응.

**Warning signs:**
- Data Safety 폼이 직접수집만 나열, SDK 수집 누락.
- 금융/이메일 데이터 항목 미신고.
- 제휴 수익 공시 없음.

**Phase to address:** Android 포팅 phase + 가계부 phase. 출시 전 폼 검수를 ship 게이트로.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 베어 어필리에이트 링크(SubID 없이) | 빠른 예약 버튼 데모 | 초기 전환이 영구 익명화, BM 데이터 소실 | **never** — Day1부터 SubID |
| 메일 본문 raw 전체 저장 | 파싱 디버깅 쉬움 | 개인정보 폭탄 + Data Safety 신고 부담 | 짧은 TTL/마스킹 전제로만 단기 |
| LLM 단독 일정(그라운딩 X) | 플랜 화면 빨리 띄움 | 닫힌 가게·불가능 동선으로 신뢰 붕괴 | MVP 데모용 한정, 출시 전 그라운딩 필수 |
| ₩ 단일 통화로 캐스팅 | 가계부 합계 코드 단순 | 원통화/환율 소실, 명세 불일치, 사후정정 불가 | **never** — 원통화+환율 원자 저장 |
| IA 한 번에 빅뱅 전환(리다이렉트 X) | 새 구조 빨리 봄 | 배포된 공유 링크 전부 깨짐 | **never** — 하위호환 리다이렉트 유지 |
| iOS만 테스트하고 Android 패리티 가정 | iOS 먼저 출시 | Android에서 share/지도/예약 조용히 깨짐 | Android를 명시적 phase로 분리하면 OK |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Travelpayouts | 마커만, SubID 없이 링크 생성 | `marker=ID.subID`, SubID에 trip(.place.user) 인코딩 |
| Stay22 (Allez) | 도메인 claim 안 함 → 전환 Unknown | settings에서 도메인 claim + campaign ID, 24h 쿠키 인지 |
| 인앱 브라우저 | 격리 WebView로 예약 링크 오픈 | 시스템 브라우저(Custom Tabs/Safari)로 — 쿠키 보존 |
| Postmark/SendGrid Inbound | From으로 사용자 식별 | envelope `To` 토큰으로 식별, From 무시, SPF/DKIM 검증 |
| Google Places (플랜 그라운딩) | 좌표/영업시간 있는데 프롬프트에 안 넣음 | 추출 단계 Places 데이터를 플랜 후처리 검증에 주입 |
| react-native-maps (Android) | iOS 키만, Android SHA-1 누락 | Android 별도 키 + SHA-1 등록, 회색지도 체크 |
| expo-share-intent (Android) | iOS App Group 코드 재사용 | `ACTION_SEND` payload를 크로스플랫폼 API로만 읽기 |

## Performance / Cost Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 플랜 LLM 코스트 폭증 | 추출당 $0.005 예산 초과 | 입력 장소 수·출력 토큰 상한, 재플랜 캐싱, 코스트 로깅 | 장소 많은 보드 / 잦은 재생성 |
| 스팸 메일이 LLM 비용 태움 | 인바운드 호출 급증 | SPF/DKIM 미인증·토큰 불일치는 LLM 전에 드롭 | 인바운드 주소 공개 후 |
| 가격비교 다중 프로바이더 동기 호출 | 예약 화면 느림 | 캐싱·타임아웃·부분 결과 표시 | 프로바이더 늘어날 때 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 인바운드 메일 인증 미검증 | 위조 예약 주입 / 타인 데이터 오염 | SPF/DKIM/DMARC + envelope 토큰 매칭 |
| 인바운드 토큰 = 노출형(UUID 그대로) | 토큰 추측해 타인 가계부 주입 | 추측불가 랜덤 토큰, 회전 가능 |
| 메일 본문(카드·PNR) 평문 영구 저장 | 개인정보 유출 사고 | 구조화 필드만, 민감정보 마스킹, 원문 TTL 폐기 |
| service role로 인바운드/플랜 처리 후 RLS 우회 노출 | 권한 상승 | Edge Function 내부에서만 service role, 클라이언트는 anon |
| 제휴 SubID에 PII 인코딩 | 제3자 네트워크에 사용자 식별정보 누출 | opaque trip/place 토큰만, 이메일/이름 금지 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 닫힌 가게·불가능 동선 일정 | "이 앱 못 믿겠다" 즉시 이탈 | 영업시간·이동시간 그라운딩 검증 |
| 가계부 ₩ 값이 카드 명세와 안 맞음 | 신뢰 붕괴(돈 다루는 기능) | 원통화+환율 시점 라벨, "약/추정" 표기 |
| 옛 공유 링크 404 | 카톡에 뿌린 링크 다 깨짐 | 하위호환 리다이렉트 |
| 여행 1개인데 목록 거쳐 진입 | 마찰 | 1개→바로진입(PRODUCT 6절) |
| 메일 전달했는데 항목 안 생김(조용히 실패) | 가계부 빔, 원인 모름 | 파싱 실패 시 사용자에게 알림 + 수동 추가 fallback |

## "Looks Done But Isn't" Checklist

- [ ] **제휴 딥링크:** 링크는 열리는데 — 실제 전환 1건이 **우리 SubID로 대시보드에 어트리뷰션**되나? (클릭 ≠ 어트리뷰션)
- [ ] **외부 예약 오픈:** 시스템 브라우저인가 격리 WebView인가? (쿠키 보존 확인)
- [ ] **인바운드 메일:** Gmail/Outlook/Apple Mail **3개 클라이언트 전달 포맷** 다 파싱되나? From이 아니라 To 토큰으로 식별하나?
- [ ] **메일 파싱 실패:** 실패 시 조용히 드롭 아니라 사용자 알림 + 수동 추가 경로 있나?
- [ ] **AI 플랜:** 모든 슬롯이 영업시간 내 + 이동시간 ≤ 갭 검증 통과하나? 좌표 없는 발명 장소 없나?
- [ ] **가계부 통화:** 원통화 코드 + 환율 시점이 레코드에 저장되나? 다통화 합계 라벨 있나?
- [ ] **IA 재편:** 4탭 + 상세 push에서 탭바 유지? 옛 `/boards/[id]`·`/b/[slug]` 리다이렉트? 여행 0/1/N 진입 분기 테스트?
- [ ] **share-handler:** 새 trip 라우트로 라우팅하도록 같이 고쳐졌나?
- [ ] **Android:** share·지도·예약 외부브라우저·딥링크를 **실기기**에서 재검증했나?
- [ ] **Data Safety 폼:** 이메일/금융/위치/어트리뷰션 데이터 + SDK 수집까지 신고했나? 제휴 수익 공시?
- [ ] **루프 닫힘:** 가계부 지출이 어느 trip/place 추천에서 왔는지 매칭되나?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SubID 누락(초기 전환 익명화) | HIGH | 과거 어트리뷰션 복구 불가 — 즉시 SubID 도입해 손실 중단 |
| 옛 공유 링크 404 | MEDIUM | 리다이렉트 라우트 추가(앱+web). 이미 전송된 링크는 영구라 빨리 |
| 메일 본문 무차별 저장 | MEDIUM | 레닥션 마이그레이션 + TTL 잡 도입. 노출 범위 감사 |
| ₩ 단일통화 저장 | HIGH | 원통화 정보 소실분은 복구 불가 — 스키마 확장 후 신규부터 정확히 |
| IA 빅뱅으로 탭바/라우트 깨짐 | MEDIUM | 중첩 `_layout` 회귀 수정, 진입 분기 케이스별 픽스 |
| Android 패리티 미검증 | LOW-MED | Android 실기기 체크리스트 재실행, 임시 웹 예약 fallback |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. SubID 어트리뷰션 누락 | 가격비교/제휴 예약 | 전환 1건이 SubID로 대시보드 어트리뷰션 |
| 2. 쿠키 격리/짧은 윈도우 | 가격비교/제휴 예약 (discuss에서 브라우저 모드 잠금) | 시스템 브라우저 오픈 + 쿠키 보존 확인 |
| 3. 전달메일 사용자 식별 | 가계부(인바운드) — 주소 스킴 최우선 | To 토큰 식별, 타인 전달 메일 오염 안 됨 |
| 4. 스푸핑/본문 저장 | 가계부(인바운드) — 마이그레이션과 짝 | 미인증 메일 드롭, 원문 미저장/TTL |
| 5. LLM 플랜 환각 | 자동 AI 플랜 | 영업시간·이동시간 검증 통과율 |
| 6. 환율 3중 불일치 | 가계부(스키마) | 원통화+환율 원자 저장, 합계 라벨 |
| 7. IA 재편 라우트 깨짐 | 네비게이션 재편 (discuss에서 매핑/리다이렉트/진입분기 잠금) | 탭바 유지·옛 링크 리다이렉트·0/1/N 진입 |
| 8. Android 패리티 | Android 포팅 | share·지도·예약·딥링크 실기기 통과 |
| 9. 루프 식별자 단절 | 첫 수익화/가계부 phase에서 계약 잠금 | e2e: 클릭→메일→가계부 같은 place 매칭 |
| 10. Data Safety 불일치 | Android 포팅 + 가계부 (ship 게이트) | 폼↔실제 흐름 일치, 제휴 공시 |

## Sources

- [Travelpayouts — ID and SubID (Affiliate marker)](https://support.travelpayouts.com/hc/en-us/articles/203955653-ID-and-SubID-Affiliate-marker-and-additional-marker) — 30일 쿠키, SubID 포맷 `marker=ID.subID` (HIGH)
- [Travelpayouts — How to dynamically change SubID](https://support.travelpayouts.com/hc/en-us/articles/12729746524050-How-to-dynamically-change-SubID-in-short-affiliate-links) (HIGH)
- [Travelpayouts — How to choose an affiliate program](https://support.travelpayouts.com/hc/en-us/articles/11395847483154-How-to-choose-an-affiliate-program) — 플랫폼 무최소트래픽 / 브랜드별 승인 (MEDIUM)
- [Stay22 — Breaking Down Stay22 Analytics for Affiliate Tracking](https://blog.stay22.com/breaking-down-stay22-analytics-for-affiliate-tracking) — campaign ID, 24h Booking 쿠키, 도메인 claim (MEDIUM)
- [Stay22 — Allez deep link generator](https://www.stay22.com/allez) (MEDIUM)
- [TripIt — Inbox Sync / forwarded traveler identification](https://help.tripit.com/en/support/solutions/articles/103000063359-inbox-sync-posting-other-traveler-s-trips) — 전달 메일 트래블러 구분 불가 (HIGH)
- [TripIt Privacy Statement](https://www.tripit.com/uhp/privacyPolicy) — 최종 배달지 읽음, 원발신자 아님 (MEDIUM)
- [TrustedSec — Spoof-Proofing Email With SPF, DKIM, DMARC](https://www.trustedsec.com/blog/real-or-fake-spoof-proofing-email-with-spf-dkim-and-dmarc) (HIGH)
- [Google Research — Optimizing LLM-based trip planning](https://research.google/blog/optimizing-llm-based-trip-planning/) — 그라운딩으로 환각·비현실 타이밍 제거 (HIGH)
- [ACL 2025 — Preference-Driven LLM-Solver for Travel Planning](https://aclanthology.org/2025.acl-long.1339.pdf) — 정량 제약 취약 (MEDIUM)
- [Foreign Exchange Transactions and Settlement Dates](https://theintactone.com/2026/02/28/foreign-exchange-transactions-and-settlement-dates/) — T+2, 예약시점 vs 결제시점 환율 (MEDIUM)
- [expo-share-intent (achorein/GitHub)](https://github.com/achorein/expo-share-intent) — iOS extension vs Android ACTION_SEND 모델 차이 (MEDIUM)
- [Supporting iOS Share Extensions & Android Intents on RN](https://www.devas.life/supporting-ios-share-extensions-android-intents-on-react-native/) (MEDIUM)
- [Google Play — Developer Program Policy](https://support.google.com/googleplay/android-developer/answer/16810878?hl=en) (HIGH)
- [Avoid Google Play Rejection: Checklist 2026 — AppTester](https://www.apptester.co/blog/avoid-google-play-rejection) — Data Safety 폼 불일치가 #1 거절 (MEDIUM)
- 코드베이스 인라인 인용: `apps/ios/app/+native-intent.tsx`, `apps/ios/app.config.ts`(App Group), `apps/ios/app/index.tsx`(진입 분기), `supabase/migrations/0004,0005`(extraction cost 패턴) (HIGH — 직접 확인)

---
*Pitfalls research for: MOAJOA v2.0 — 발견→예약→정산 풀 루프*
*Researched: 2026-06-21*
