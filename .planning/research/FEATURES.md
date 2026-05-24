# Feature Research

**Domain:** 소셜 콘텐츠 기반 여행 계획 (link-to-map travel planner)
**Researched:** 2026-05-25
**Confidence:** MEDIUM (경쟁사 official 문서·리뷰 기반. Korean travel UX는 Naver Map official 발표 + UX 분석 글 기반)

## 컨텍스트 요약

MOAJOA의 v1 범위는 (1) 링크 던지기 → 자동 추출 → 핀, (2) 공개 보드 URL 비로그인 열람, 두 가지 뿐이다. 협업 투표·디스커버리·블로그/IG 자동 추출은 **명시적으로 v1 out-of-scope**. 따라서 본 리서치는 "이 두 흐름이 dogfooding 단계에서 '완성도 있게 느껴지려면' 무엇이 필요한가"에 집중한다.

직접 비교 대상은 **Plotline** (가장 유사한 컨셉: TikTok/IG/YouTube → 핀), **Mapstr** (place-bookmark 진영의 원조), **Wanderlog** (Google Docs-스타일 협업), **Google Maps Lists** (universal 베이스라인), **네이버 지도 저장 탭** (한국 사용자가 무의식 기준점으로 삼는 것). 직접 경쟁은 Plotline > Mapstr > 네이버 저장 탭 순.

핵심 인사이트 4가지:
1. **Plotline (2026 출시)이 이미 "social → map" 정확히 같은 포지션을 선점**. MOAJOA의 차별점은 (a) 한국어/일본어 transcript 우선, (b) 공개 보드 SSR이 강한 web (Plotline은 iOS only), (c) 비디오 타임스탬프 jump back. 이 3가지를 살리는 feature를 우선해야 한다.
2. **Korean 사용자는 "단일 앱이 아닌 stage별 app 조합" 사용 패턴**. → MOAJOA는 "발견" 단계에서 끼어드는 보조 도구로 self-position. 항공·숙박·결제로 확장하려는 유혹은 anti-pattern.
3. **AI 추출 신뢰 UX는 'confident-wrong이 가장 위험'**. → 추출 결과는 명시적으로 "AI가 뽑았어요, 확인하세요" 신호를 줘야 함. 자동으로 "확정 핀"처럼 보이게 만들면 첫 hallucination에서 신뢰 영구 손실.
4. **공유 링크는 OG 카드 + SSR이 첫 인상의 전부**. 카톡 미리보기에서 지도 썸네일 안 뜨면 클릭률 급락.

---

## Feature Landscape

### Table Stakes (없으면 미완성으로 느낌)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Share Sheet에서 URL 수신 (iOS Share Extension)** | Plotline·Pintrip·Mapstr 사용자가 모두 share sheet를 첫 진입점으로 학습. 앱을 열고 URL 붙여넣기시키면 "왜 share에 없지" 마찰 | M | `expo-share-intent` config plugin. SDK 54 호환 버전 확인. 이미 WORKSTREAMS Phase 1.5로 잡힘 |
| **추출 진행 상태 표시** (pending → processing → ready/failed) | 30초 e2e 동안 사용자가 "되고 있긴 한가?" 확신 필요. Plotline은 카드 위 스피너 + "Finding places…" 텍스트 | S | `links.extraction_status` 이미 스키마 존재. UI에서 진행/실패 표시만 |
| **핀 → 원본 영상으로 jump-back (타임스탬프 포함)** | Plotline의 핵심: "왜 이 가게가 추천됐는지 알고 싶다 → 영상 그 구간 재생". 없으면 사용자가 결국 YouTube에서 영상 다시 찾음 | M | YouTube URL에 `?t=Xs` 붙이기. `places.video_offset_sec` 컬럼 필요 (없으면 추가). 추출 시 LLM이 timestamp도 함께 뽑게 |
| **핀 수동 편집 (제목·메모·삭제)** | 추출이 100% 정확할 수 없음. 사용자가 "이 가게 아닌데" 거를 수 있어야 함 | S | `places` UPDATE/DELETE. RLS는 이미 board editor 허용 |
| **수동 핀 추가** (검색 → 선택) | 영상에 안 나온 호텔·공항을 직접 추가하고 싶음. 자동만으로는 보드 완성 불가 | M | `add_manual_place` RPC placeholder 존재. `resolve-place` Edge Function으로 server-side Places 해결 필요 (Phase 1.5에 표시됨) |
| **보드 목록 + 보드별 핀 개수** | 사용자가 보드 여러 개 가지면 "어디 들어가야 하지" 즉시 알아야 함. Mapstr의 list view 기준 | S | Web `/boards` 이미 존재. iOS는 미검증 |
| **공유 URL 복사 + 카톡 공유 (iOS)** | 한국 사용자에게 "공유 = 카톡". iOS UIActivityViewController 기본 시트로 충분 | S | `boards.share_slug` 이미 자동 생성 |
| **공개 보드 OG 카드 (제목 + 도시 + 핀 수)** | 카톡 미리보기에 텍스트만 뜨면 클릭률 폭락. Wanderlog/Google Maps Lists는 모두 지도 썸네일 OG | M | `@vercel/og` + 보드 메타. Active 항목에 있음 |
| **공개 보드 SSR + 모바일 반응형** | 카톡으로 받은 링크는 90% 모바일. 데스크탑 위주 레이아웃이면 즉시 이탈 | M | Next.js 15 SSR 기반 동작 중. 모바일 폴리시만 남음 |
| **로그인 없이 공개 보드 열람** | 비로그인 진입장벽 = 0이어야 acquisition 성립. `public_board_view` RPC 이미 구현됨 | S | 이미 동작 중. 검증만 필요 |
| **첫 로그인 자동 "내 첫 여행" 보드 생성** | 빈 boards 화면은 "뭐 해야 하지" 마찰. Monday "Your First Board" 패턴이 표준 | S | Active 항목에 있음. trigger로 INSERT |
| **추출 실패 시 명시적 오류 + 재시도** | transcript 없는 영상, 비공개, 차단 영상 등 실패 흔함. 무반응이면 사용자는 자기가 잘못한 줄 앎 | S | `extraction_status='failed'` + `error_reason` 컬럼. UI에서 retry 버튼 |
| **장소 한국어 표기 우선 (`name_ko`)** | 도쿄 가게도 "스시 사이토" 표시되어야 한국 사용자가 인지. 영어/일본어만 뜨면 외국 앱 느낌 | S | 스키마에 `name_local`/`name_ko`/`name_en` 이미 분리됨. UI 우선순위만 |

### Differentiators (왜 MOAJOA를 쓰나)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **YouTube 한국어 transcript 우선 추출** | Plotline은 영어 중심. 한국 여행 유튜버(쯔양·풍자·빠니보틀)는 timedtext가 한국어만. ko → ja → en 폴백이 다른 경쟁사에 없음 | M | 이미 baseline 동작 중. 정확도 측정·튜닝이 v2 |
| **핀당 transcript 발췌 + 영상 타임스탬프** | "왜 이 핀이 뽑혔지" 근거 표시. AI 신뢰 UX의 핵심. Plotline은 영상 전체 링크만 줌, 타임스탬프 없음 | M | LLM 출력 스키마에 `quote`(원문 발췌) + `offset_sec` 추가. `places` 컬럼 신설 |
| **Web SSR 공개 보드 (앱 설치 없이 열람)** | Plotline/Mapstr는 iOS only or 앱 안에서만 풀 기능. 카톡 링크 비로그인 열람은 한국 acquisition에 결정적 | M | Next.js 15로 동작 중. 정교화만 남음 |
| **AI 추출 결과 "AI가 뽑았어요" 시각 신호 + 한 번에 reject** | NN/G: confident-wrong이 신뢰 파괴의 1번 원인. AI-extracted vs 사용자-수정 핀을 시각 구분 (예: 점선 vs 실선 핀) | M | `places.source_kind`(`auto`/`manual`/`edited`) 추가. UI 토큰 분리 |
| **공개 보드 OG 카드에 미니맵 썸네일** | 텍스트만 OG는 카톡에서 묻힘. Google Static Maps API로 핀 위치 미니맵을 OG 이미지에 합성하면 차별화 | M | `@vercel/og` + Static Maps URL. 비용 ~$0.002/render, edge cache 활용 |
| **다중 영상 → 한 보드로 누적 (중복 제거)** | "도쿄 라멘" 영상 3개를 한 보드에 던지면 같은 가게가 한 핀으로 합쳐짐. `(board_id, google_place_id)` unique 이미 있음 | S | 이미 스키마에 unique constraint. UI에서 "X개 영상에서 언급됨" 뱃지 |
| **공개 보드 "방문 인텐트 표시" (가벼운 react)** | 비로그인 사용자가 "오 가고싶다" 표현. magic link로 로그인 유도. 협업 투표 (Phase 1.5) 정식 기능의 가벼운 선행체 | M | v1 범위 밖. v1.5 준비용으로만 기억 |

### Anti-Features (의도적으로 짓지 않는 것)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Day-by-day itinerary builder** (Wanderlog 스타일 일정표) | 사용자가 "보드 만들었으니 일정도 짤래" 자연스럽게 요청. Plotline·Wanderlog 모두 가짐 | Core Value("링크 → 핀")와 다른 차원. UI 복잡도 폭발, 항공·숙박·시간대 캘린더 다 끌어옴. 2인팀에 무리 | "Google Maps에 보내기" 한 버튼으로 외부 위임 (`maps.google.com/?q=` deep link) |
| **항공·숙박·결제 통합** | MyRealTrip·Klook 모델. 수익화 명백 | OTA는 별개 비즈니스. 2인 팀이 inventory·결제·환불 책임 못 짐. Korean UX 분석: 사용자는 stage별로 다른 앱 씀 — 통합은 오히려 어색 | 외부 링크만 (제휴 마케팅도 v3 이후) |
| **AI 챗봇 / "이 도시 추천해줘"** | 트렌드. 사용자도 막연히 기대 | Core Value 와 직교. 추천 정확도 평가 무한 작업. Google/ChatGPT가 이미 잘함 | 영상 추출 정확도에만 LLM 예산 집중 |
| **소셜 피드 / 팔로우 / 좋아요** | Mapstr는 "follow other mappers" 있음. 네트워크 효과 매력적 | 외부 사용자 유입 전엔 빈 그래프. moderation·신고·차단 즉시 필요 → 2인 팀 운영 부담. v1은 self-dogfooding이 목표 | 공개 보드 URL 공유만으로 가벼운 broadcast (`/discover`는 v2) |
| **자동 일정 최적화 (TSP/거리 기반)** | "핀 다 찍었으니 최단경로로 짜줘" 자연 요청 | 영업시간·교통수단·식사 시간대 변수 폭증. 잘못 제안하면 신뢰 손실 | "Google Maps에서 경로 보기" 외부 위임 |
| **블로그/Instagram 자동 추출 (v1)** | 사용자가 "유튜브만 되네?" 즉시 물음 | IG는 oEmbed/transcript 없음, 스크래핑은 ToS 위반·차단. 블로그는 site별 파싱 필요 | v1은 manual queue (운영진 추출). PROJECT.md 이미 그렇게 결정 |
| **다크 모드 / i18n UI** | "당연한 거 아냐?" 기대 | 토큰만 정의됐고 매핑 안 됨. 한국어 1차로 충분, dogfooding에 영향 없음 | Phase 2 (PROJECT.md 결정) |
| **댓글 / 메모 스레드** | 협업 보드에서 자연스럽게 요청 | 알림·moderation·email digest 끌고 옴 | v1.5 협업은 ❤️ 투표만. 텍스트 코멘트는 v2 |
| **오프라인 모드 / 캐시된 보드** | 여행 중 비행기·해외 데이터 문제 | Realtime·RLS 검증 충돌. cache invalidation 지옥 | 보드 PDF 내보내기 또는 Google Maps 리스트 export (v2) |
| **Push notification ("새 댓글" 등)** | 표준 모바일 UX 기대 | dogfooding 단계엔 noise. APNs 셋업 비용 | v1.5 협업 보드부터 (투표 알림만) |
| **추출 결과 자동 "Top picks" 추천** | "이 보드에서 어디 갈래?" 자동 요약 | LLM이 자기가 뽑은 핀을 다시 평가 → bias 누적. confident-wrong 위험 | v2에 사용자 ❤️ 카운트 기반 "확정" 필터만 (이미 ARCHITECTURE에 vote_counts_for_places RPC 계획됨) |
| **Web에서 "보드 생성·링크 추가" UI** (정식 기능으로) | 사용자가 web에서 다 하려고 함 | iOS share extension의 dogfooding 동기 약화. 두 클라이언트가 같은 input UI 유지 = 유지 비용 2배 | dev tool 환경변수로만 노출 (`NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`). WORKSTREAMS에 이미 명시 |

---

## Feature Dependencies

```
[iOS 로컬 빌드 통과]
        └──blocks──> [Share Extension]
                           └──blocks──> [실사용 dogfooding 진입경로]

[YouTube 추출 Edge Function]  (이미 동작)
        └──enables──> [핀 → 영상 타임스탬프 jump]
                           └──requires──> [LLM 프롬프트에 offset 출력 추가]
                                                └──requires──> [places.video_offset_sec 컬럼]

[공개 보드 SSR]  (이미 동작)
        └──requires──> [OG 카드 자동 생성]
                           └──enhances──> [카톡 공유 클릭률]

[수동 핀 추가]
        └──requires──> [resolve-place Edge Function]
                           └──requires──> [Places API 키 서버 사이드]  (이미 있음)

[첫 보드 자동 생성]
        └──requires──> [auth signup trigger]
        └──enhances──> [빈 상태 첫 인상]

[AI 추출 시각 신호 (점선 핀)]
        └──requires──> [places.source_kind 컬럼]
        └──enhances──> [AI 신뢰 UX]

[추출 진행 상태 UI]
        └──requires──> [links.extraction_status 변화 구독]  (Realtime 또는 polling)

[다크 모드]  ──conflicts──> [Phase 2 일정]   (지금 매핑하면 토큰·아이콘 다 검토 필요)

[댓글 스레드]  ──conflicts──> [v1.5 협업 범위]  (notification·moderation 폭발)
```

### Dependency Notes

- **iOS 빌드 통과가 모든 dogfooding의 게이트**: Share Extension·실기기 동작 검증·OAuth 모두 빌드 없이 진행 불가. WORKSTREAMS Phase 1의 최우선.
- **`places.video_offset_sec` + `places.source_kind` + `places.quote` 컬럼 추가는 한 마이그레이션에 묶기**: 어차피 추출 파이프라인 LLM 프롬프트도 함께 수정 (`packages/core/schemas/extraction-output.ts` 동시 변경). append-only 원칙 유지.
- **OG 카드와 모바일 반응형은 묶어서 출시**: 카톡에서 OG로 끌어들였는데 모바일 레이아웃 깨지면 OG 작업이 무의미.
- **수동 핀 추가는 `resolve-place` Edge Function이 없으면 보안상 출시 불가**: 클라이언트가 lat/lng를 직접 보내면 변조 가능. 현재 `add_manual_place` RPC는 placeholder이므로 v1 출시 전 server-side resolve로 교체 필수.

---

## MVP Definition

### Launch With (v1 — self-dogfooding 가능선)

- [ ] **iOS 로컬 빌드 통과** — 모든 흐름의 게이트 (WORKSTREAMS Phase 1)
- [ ] **iOS Share Extension** — share sheet → 보드 선택 → 저장. 진입경로 #1
- [ ] **iOS 보드 목록 + 보드 상세 + 핀 지도** — 핵심 열람 흐름
- [ ] **추출 진행 상태 표시** (pending/processing/ready/failed + 실패 사유 + retry 버튼) — confident-wrong 회피
- [ ] **핀 → 영상 타임스탬프 jump-back** — 핵심 differentiator
- [ ] **핀 수동 편집/삭제** — 추출 오류 대응. 없으면 신뢰 영구 손상
- [ ] **수동 핀 추가** (Places 검색 + `resolve-place` Edge Function) — 영상에 없는 호텔/공항
- [ ] **첫 로그인 자동 보드 생성** ("내 첫 여행" + 짧은 안내 카드 1장)
- [ ] **공개 보드 `/b/[slug]` SSR + 모바일 반응형 + OG 카드** — acquisition 의 전부
- [ ] **OG 카드에 미니맵 썸네일** — 카톡 클릭률
- [ ] **공유 URL 복사 + iOS share sheet** — 카톡 공유 경로
- [ ] **장소 한국어 표기 (`name_ko`) 우선 렌더링** — 한국 사용자 인지
- [ ] **AI vs 수동 핀 시각 구분** — 신뢰 UX. 작은 뱃지로도 충분

### Add After Validation (v1.5 — dogfooding 통과 후)

- [ ] **협업 보드: 멤버 초대 + ❤️ 투표 + 확정 필터** — PROJECT.md에 명시된 v1.5 범위
- [ ] **블로그·Instagram manual extraction queue** — 운영진 추출. 사용자 요청 누적으로 우선순위 검증
- [ ] **추출 정확도 평가 데이터셋 + 프롬프트 튜닝** — sample 10~20개 baseline 측정 후
- [ ] **다중 영상 누적 시 "X개 영상에서 언급됨" 뱃지** — 확신 신호. 데이터는 이미 있음
- [ ] **보드 PDF/이미지 export** — 오프라인 여행 시 백업
- [ ] **Google/Apple OAuth** — 외부 사용자 받기 시작할 때
- [ ] **추출 실패 → 사용자가 "수동 변환 요청"으로 큐로 보내기** — 자동/수동 큐 연결

### Future Consideration (v2+)

- [ ] **`/discover` 공개 보드 탐색 피드** — 사용자/콘텐츠 충분히 쌓인 후. 빈 피드는 negative signal
- [ ] **UI i18n (ja)** — 일본 사용자 진입 시
- [ ] **다크 모드** — 토큰은 있음. 매핑만
- [ ] **댓글 스레드** — 협업 보드 사용량 검증 후
- [ ] **Push notification** — 협업 활성화 후
- [ ] **에러 트래킹 (Sentry/PostHog)** — 외부 사용자 받기 직전
- [ ] **블로그·Instagram 자동 추출** — 외부 API/스크래핑 ToS 검토 필요
- [ ] **iOS → Android (Expo)** — 사용자 요청 누적 후
- [ ] **요금제 / Pro 기능** — PMF 후

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| iOS 로컬 빌드 통과 | HIGH (모든 흐름 게이트) | HIGH (Expo+pnpm podspec) | **P1** |
| iOS Share Extension | HIGH | MEDIUM | **P1** |
| 추출 진행 상태 + retry | HIGH (신뢰) | LOW | **P1** |
| 핀 → 타임스탬프 jump | HIGH (차별점) | MEDIUM | **P1** |
| 핀 수동 편집/삭제 | HIGH (신뢰) | LOW | **P1** |
| 수동 핀 추가 + resolve-place | HIGH (완성도) | MEDIUM | **P1** |
| 공개 보드 OG 카드 + 모바일 | HIGH (acquisition) | MEDIUM | **P1** |
| OG에 미니맵 썸네일 | MEDIUM (차별점) | MEDIUM | **P1** |
| AI vs 수동 시각 구분 | MEDIUM (신뢰) | LOW | **P1** |
| 첫 보드 자동 생성 | MEDIUM | LOW | **P1** |
| Places 한국어 표기 우선 | HIGH (한국 사용자) | LOW | **P1** |
| Web dev tool UI 격리 | LOW (개발자 UX) | LOW | **P1** (오염 방지) |
| 다중 영상 누적 뱃지 | MEDIUM | LOW | P2 |
| 협업 보드 (멤버+투표) | HIGH (v1.5 핵심) | HIGH | P2 |
| Manual extraction queue (blog/IG) | MEDIUM | MEDIUM | P2 |
| 추출 정확도 평가 데이터셋 | HIGH (장기) | MEDIUM | P2 |
| OAuth (Google/Apple) | MEDIUM (외부 사용자) | MEDIUM | P2 |
| Boards PDF export | LOW | MEDIUM | P3 |
| Discover 피드 | LOW (v1엔 빈 피드) | HIGH | P3 |
| Dark mode | LOW | LOW | P3 |
| 댓글 스레드 | LOW (협업 검증 후) | HIGH | P3 |
| Day-by-day itinerary | NEGATIVE (scope creep) | HIGH | **anti** |
| 항공·숙박 통합 | NEGATIVE | HIGH | **anti** |
| AI 챗봇 | NEGATIVE | MEDIUM | **anti** |

---

## Competitor Feature Analysis

### 1. Save-from-link UX

| Feature | Plotline (2026) | Mapstr | 네이버 지도 저장 탭 | MOAJOA 접근 |
|---|---|---|---|---|
| Share sheet에서 URL 수신 | ✓ (TikTok/IG/YouTube/blog) | ✓ (기본 share만) | △ (수동 추가가 주) | ✓ (iOS Share Extension, YouTube 우선) |
| 자동 장소 추출 | ✓ (영상 → 장소+사진+컨텍스트) | ✗ (수동 태그) | ✗ | ✓ (한국어 transcript 우선, 차별점) |
| 추출 진행 표시 | ✓ (스피너 + "Finding places…") | n/a | n/a | **table stake — 반드시 구현** |
| 원본 컨텍스트 보존 (영상·창작자·이유) | ✓ (creator·what to order·source video) | ✗ | △ (출처 링크만) | ✓ + **타임스탬프까지** (차별점) |
| 다중 소스 한 보드 누적 | ✓ (place merge) | ✓ | △ | ✓ (DB unique constraint 이미 있음) |

### 2. Public 보드 viewing UX

| Feature | Wanderlog | Google Maps Lists | 네이버 지도 공유 | MOAJOA 접근 |
|---|---|---|---|---|
| 비로그인 열람 | ✓ (browser) | ✓ | ✓ | ✓ (이미 동작) |
| 모바일 SSR | ✓ | ✓ | ✓ | ✓ (Next.js 15) |
| OG 카드 미니맵 | ✓ | ✓ (지도 썸네일) | △ (텍스트만 자주) | **차별점 — Static Maps 합성** |
| 앱 설치 강요 | ✗ | ✗ | △ (앱 권유 배너) | ✗ (web 완결) |
| 핀 클릭 → 원본 영상 | ✗ (Wanderlog에 영상 없음) | ✗ | ✗ | ✓ + **타임스탬프** (차별점 #1) |

### 3. Pin → multimedia jump

| Feature | Plotline | Pin Traveler | YouTube native | MOAJOA 접근 |
|---|---|---|---|---|
| 핀 → 영상 링크 | ✓ (rewatch 기능) | ✗ | n/a | ✓ |
| 핀 → 영상 **타임스탬프** | ✗ (영상 전체로만) | ✗ | ✓ (`?t=Xs` 표준) | ✓ (`?t=Xs` 자동 부착, 차별점) |
| 핀에 transcript 발췌 표시 | ✗ | ✗ | n/a | ✓ (LLM `quote` 출력) |
| 영상 시작 시점 미리보기 썸네일 | ✗ | ✗ | ✓ (timestamp preview) | v1.5 (YouTube embed iframe) |

### 4. 첫 보드 온보딩

| Feature | Plotline | Wanderlog | Monday (참고) | MOAJOA 접근 |
|---|---|---|---|---|
| 빈 상태 안내 | ✓ (sample TikTok URL) | ✓ (템플릿 선택) | ✓ ("Your First Board" 자동) | ✓ ("내 첫 여행" 자동 생성, PROJECT.md) |
| 샘플 데이터 | ✓ | ✓ | ✓ | △ (보드만, 핀은 없음 — 진짜 URL로 첫 핀이 더 가치) |
| 첫 액션 명확화 | ✓ (CTA "Save your first spot") | ✓ | ✓ | **반드시 구현 — "유튜브 링크 붙여보기" CTA** |
| 튜토리얼 길이 | 1 step | 3 steps | 1 step | 1 step 권장 (마찰 최소) |

### 5. AI 추출 신뢰 UX

| Feature | 일반 패턴 (NN/G·Smashing) | Gmail Smart Compose | Waze 추천 | MOAJOA 접근 |
|---|---|---|---|---|
| AI 출력 시각 구분 | ✓ (회색·점선·아이콘) | ✓ (회색 텍스트) | ✓ (제안 아이콘) | ✓ (점선/회색 핀 — `source_kind`) |
| 한 클릭 reject/edit | ✓ (강력 권장) | ✓ (Esc/계속 타이핑) | ✓ (수락/거절) | ✓ (핀 삭제·편집 직접) |
| Undo / Action log | ✓ (권장) | ✓ | △ | △ (v1엔 삭제만, undo는 v1.5) |
| Confidence 표시 | △ (논쟁 있음) | ✗ | ✓ (예상 시간 차) | △ (v1엔 표시 안 함 — 오히려 노이즈, v2 evaluation 데이터 쌓인 후) |
| 출처 노출 | ✓ (권장) | ✗ | ✗ | ✓ (영상 + 타임스탬프 + transcript quote) |

### 6. 한국 사용자 UX 컨벤션

| Feature | 네이버 지도 | MyRealTrip | Klook | MOAJOA 접근 |
|---|---|---|---|---|
| 한국어 장소명 우선 | ✓ | ✓ | △ (영문 위주) | ✓ (`name_ko` 우선) |
| 카톡 공유 최적화 (OG) | ✓ | ✓ | ✓ | **반드시 — 한국 공유 = 카톡** |
| 비로그인 열람 | ✓ | △ | △ | ✓ |
| 1차 진입을 share sheet로 | △ | ✗ (앱 내 검색) | ✗ | ✓ (차별점) |
| 한국 결제·항공 통합 | n/a | ✓ | ✓ | ✗ (**anti — stage별 다른 앱이 한국 패턴**) |
| Stage별 도구 포지셔닝 | "저장" 도구 | "예약" 도구 | "액티비티" 도구 | "**발견/계획**" 도구 (명확한 자리) |

---

## Roadmap에 주는 함의

1. **Phase 1 (현재 milestone) 최우선 = iOS 빌드 → Share Extension → 핀↔타임스탬프**. 이 셋이 dogfooding 가능성을 결정.
2. **Phase 1 두 번째 = 공개 보드 OG 카드 + 모바일 SSR**. 카톡으로 공유했을 때 클릭률은 곧 self-dogfooding 의 확장성 = 주변 사람한테 보여줄 수 있느냐.
3. **Phase 1.5 (협업) 전에 반드시 끝낼 신뢰 UX = AI vs 수동 핀 시각 구분 + 진행 상태 + retry**. confident-wrong이 한 번 발생하면 협업 단계에서 멤버 신뢰까지 동시 손실.
4. **Out-of-scope를 단호히 지킬 것**: itinerary builder, AI 챗봇, 항공/숙박 통합은 모든 경쟁사가 가지고 있어서 자연스럽게 끌리지만, "링크 → 30초 → 핀" Core Value를 흐림. 외부 위임(Google Maps deep link)으로 충분.
5. **다중 영상 누적 뱃지("3개 영상에서 언급됨")는 P2지만 무게 대비 가치 큼** — Plotline에 없는 강한 신호. v1.5에 빠르게 추가 검토 권장.

---

## Sources

- [Plotline — Turn Social Saves into Real Adventures (official)](https://getplotline.app/)
- [Plotline vs Mapstr comparison (vendor blog, 편향 감안)](https://getplotline.app/blog/plotline-vs-mapstr)
- [Plotline iOS App Store listing](https://apps.apple.com/us/app/plotline-travel-map-planner/id6759443026)
- [Mapstr official site](https://en.mapstr.com/)
- [Mapstr FAQ](https://en.mapstr.com/faq)
- [Wanderlog FAQ & Help Center](https://help.wanderlog.com/hc/en-us)
- [Wanderlog vs Google My Maps 2026 comparison](https://www.wandrly.app/comparisons/wanderlog-vs-google-my-maps)
- [Pin Traveler](https://pintraveler.net/)
- [TokSpot — TikTok/IG videos to map pins](https://mwm.ai/apps/tokspot/6756735375)
- [YouTube Timestamp Link Format Explained](https://www.sendible.com/insights/youtube-timestamp-link)
- [네이버 지도 저장 탭 개편 (전자신문, 2022)](https://www.etnews.com/20221213000198)
- [네이버 지도 저장 탭 공유 기능 (ZDNet Korea, 2022)](https://zdnet.co.kr/view/?no=20221213140210)
- [How Koreans Prepare for International Travel (UXR Player)](https://www.uxrplayer.com/post/how-koreans-prepare-for-international-travel-the-structure-of-travel-planning-revealed-through-app)
- [MyRealTrip overview (KoreaTechDesk)](https://koreatechdesk.com/myrealtrip-the-leading-korean-platform-that-meets-all-travel-needs)
- [AI Hallucinations: What Designers Need to Know (NN/G)](https://www.nngroup.com/articles/ai-hallucinations/)
- [Designing for Agentic AI: UX Patterns for Control, Consent (Smashing Magazine 2026)](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)
- [Designing for Trust: UX Patterns for AI Features (DesignKey)](https://www.designkey.studio/post/designing-for-trust-ux-ai-features)
- [The Role of Empty States in User Onboarding (Smashing Magazine)](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/)
- [Empty State UX examples and design rules (Eleken)](https://www.eleken.co/blog-posts/empty-state-ux)

---
*Feature research for: 소셜 콘텐츠 기반 여행 계획 (link-to-map)*
*Researched: 2026-05-25*
