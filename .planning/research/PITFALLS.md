# MOAJOA Pitfalls Research

**Domain:** 영상 링크 → 지도 보드 자동 추출 + 협업 공유 (Next.js 15 + Expo SDK 54 + Supabase + Anthropic + Google Places)
**Researched:** 2026-05-25
**Confidence:** HIGH (대부분의 항목은 ASIS 1년+ 경험 + 최근 베이스라인 시행착오 + 2026년 공식 문서로 검증됨)

> 이 문서의 목적은 일반론이 아니라, **MOAJOA 2인팀이 ASIS 1년의 학습을 통해 알게 된 것 + Day 1~2 베이스라인에서 이미 데인 것 + 앞으로 데기 쉬운 것**을 phase별로 묶어두는 것이다. 추상적인 best practice는 의도적으로 뺐다.

---

## Critical Pitfalls (반드시 막아야 할 것)

### Pitfall 1: LLM이 영상에 안 나온 장소를 만들어낸다 (Hallucinated Places)

**무엇이 잘못되는가:**
Claude가 transcript에서 장소를 추출할 때, 자막에 없는 유명 관광지를 "맥락상 있을 법한" 것으로 추가한다. 특히 도쿄·오사카 영상에서 "긴자", "신주쿠" 같은 일반 지명이 자막에 단 한 번 언급되면 그걸 가게 이름으로 오해해 "긴자 본점" 같은 가짜 장소를 만든다. Places API는 이 가짜 이름으로도 *유사한* 가게를 찾아주기 때문에 표면적으로는 결과가 나오지만, **사용자가 영상에서 찾으려던 가게가 아니다**. 이게 "링크 → 30초 안에 지도 위의 핀"의 신뢰도를 깨는 가장 큰 위협이다.

**왜 일어나는가:**
- LLM은 transcript의 **누락된 부분을 자기가 채우려는** 경향이 있다 (자막 자동생성은 가게 이름을 자주 놓침)
- "구조화된 JSON을 내라"라는 프롬프트는 *모르면 빈 배열*보다 *그럴듯한 것*을 더 선호하게 만든다
- 한국어 음차된 일본 가게 이름 ("이찌란", "잇푸도")은 transcript 정확도가 낮아서 LLM이 "가장 비슷한 유명 체인"으로 정정해버린다
- 검증 단계가 없다 — 추출 → Places API → 저장이 한 흐름이고, "이게 정말 영상에 나왔는가?"를 확인하는 게이트가 없다

**어떻게 막나:**
1. **Citation 강제** — Claude 응답 스키마에 `transcript_quote: string` (해당 장소가 언급된 자막 원문 5~30자) 필드를 필수로 추가. quote가 없으면 그 후보는 버린다.
2. **2단계 확인** — 1차 추출 후 별도 prompt로 "이 장소들이 정말 transcript에 나오는지 yes/no" 검증 패스. 비용은 두 배지만 영상당 여전히 < $0.005.
3. **Confidence threshold** — `confidence < 0.7`인 후보는 "사용자에게 검토 요청" 상태로 저장 (`place.review_status = 'low_confidence'`), 지도엔 음영 핀으로 표시.
4. **Eval baseline** — sample 10~20개 영상의 "expected places" 골드 셋을 만들고, 매 프롬프트 변경마다 precision/recall 측정. 이건 ASIS 시절에도 안 했던 거니까 이번엔 *반드시* 한다.

**조기 경보 신호:**
- 베이스라인 dogfooding 중 "내가 영상에서 본 가게가 아닌 핀"이 1주에 2개 이상 발견됨
- Places API resolution이 100% 성공하는데 사용자가 "이 가게 본 적 없는데?" 라고 함 (LLM이 그럴듯한 거 만들고 Places가 그럴듯하게 매칭한 경우)
- transcript에 한국어 자막 자동생성 비율이 높을수록 hallucination이 증가

**Phase에서 다루기:**
- **Phase 1 (MVP):** 항목 1 (citation 필드) + 항목 3 (confidence threshold) — 비용 없음, 스키마 변경만
- **Phase 2 (추출 정교화 마일스톤):** 항목 2 (2단계 확인) + 항목 4 (eval baseline) — eval-driven 개선 본격 시작

---

### Pitfall 2: 잘못된 도시·국가에 핀이 찍힌다 (Wrong City Assignment)

**무엇이 잘못되는가:**
영상은 도쿄 영상인데, 가게 이름이 흔해서 (예: "스타벅스 본점") Places API가 한국·미국 매장을 반환한다. 또는 한 영상에 도쿄와 후쿠오카가 같이 등장하는데 LLM이 도시 컨텍스트를 후반에서 잃어버린다. 사용자는 "도쿄 여행 보드"를 만들었는데 핀이 서울에 찍혀 있다.

**왜 일어나는가:**
- Places Text Search에 `locationBias` 또는 `locationRestriction`을 안 넣으면 글로벌 검색이 됨
- 보드 단위 `city_code` 또는 `country_hint`가 LLM 프롬프트에는 전달돼도 Places 호출엔 전달 안 됨 (두 단계가 분리됨)
- 한 영상에 도시가 여러 개일 때 LLM이 마지막에 언급된 도시를 모든 장소에 일괄 적용

**어떻게 막나:**
1. **Place 후보에 `inferred_city` 필드 필수** — LLM이 후보별로 도시를 명시하게 강제. 영상 전체의 한 도시로 일괄 적용 X
2. **Places API에 `locationBias` 항상 전달** — 보드 또는 후보별 도시 코드 → Places `locationBias.rectangle` 또는 `circle`로 변환
3. **국가/도시 sanity check** — 추출 결과의 위경도가 보드 도시 bounding box 밖이면 `low_confidence`로 떨어뜨림
4. **`boards.city_code`가 NULL이면 추출 차단** — UX적으로 보드 생성 시 도시 선택 강제 (또는 첫 추출에서 도시 자동 추론 후 사용자 확인)

**조기 경보 신호:**
- 도쿄 보드인데 핀이 한국 좌표에 찍힘
- Places API 응답에서 `formattedAddress`의 국가가 보드 의도 국가와 다름

**Phase에서 다루기:**
- **Phase 1 (MVP):** 항목 2, 3 — Edge Function 한 곳만 수정하면 됨
- **Phase 1.5:** 항목 4 (UX) — 온보딩 흐름 잡을 때 함께

---

### Pitfall 3: Transcript 타임스탬프와 실제 화면이 어긋난다 (Timing Drift)

**무엇이 잘못되는가:**
"핀 클릭 → 영상 타임스탬프 jump"가 핵심 UX인데, 자동생성 자막의 시작 시각이 화면에 가게가 등장하는 시각보다 5~15초 지연돼있다. 사용자는 핀을 누르고 점프했는데 다른 가게가 나오고 있어서 "이 앱 못 믿겠다"라고 느낀다.

**왜 일어나는가:**
- YouTube `timedtext` 자동 자막은 음성 발화 시점 기준 → 실제 화면 등장과 어긋남 (특히 vlog 형식)
- LLM이 추출한 장소의 timestamp는 "transcript의 어느 줄에서 언급됐는가" 기준이지 "영상의 어느 시점에 보이는가" 기준이 아님
- transcript 한 줄에 여러 장소가 묶이면 모든 장소가 같은 timestamp가 됨

**어떻게 막나:**
1. **timestamp range 저장** — `place.video_start_sec`, `place.video_end_sec` (단일 시점이 아니라 범위로 — "3:20~3:50 사이에 언급됨")
2. **Jump는 시작 시각보다 -3초 offset** — 사용자가 가게 등장 직전부터 보게 해서 "어, 이 가게구나" 인지 시간 확보
3. **여러 timestamp가 있으면 multiple anchor** — 핀 클릭 시 "3:20 / 8:45 / 12:10" 중 선택 가능한 chip UI
4. **수동 보정 UI** — Phase 1.5에 "이 핀의 시각을 영상 현재 위치로 변경" 버튼 (사용자가 옳다고 생각하는 시각으로 덮어쓰기)

**조기 경보 신호:**
- 자체 dogfooding 중 "점프한 화면이 그 가게가 아님" 빈도 측정
- transcript에 동일 줄에 묶인 장소가 3개 이상인 추출 결과 비율

**Phase에서 다루기:**
- **Phase 1 (MVP):** 항목 1, 2 — 스키마 + Edge Function 변경
- **Phase 1.5:** 항목 3, 4 — UX 정교화

---

### Pitfall 4: Supabase RLS 무한 재귀 — 다음 라운드 (Next RLS Recursion)

**무엇이 잘못되는가:**
이미 boards ↔ memberships 사이클은 0002, 0005에서 SECURITY DEFINER 헬퍼(`am_board_owner`, `am_board_member`)로 끊었다. 하지만 협업 보드 투표·초대·매뉴얼 큐 등이 들어오면 **새로운 사이클이 생긴다**. 예: `invitations` 테이블 정책이 `memberships`를 EXISTS로 참조, `memberships`는 `boards`를 참조, `boards`는 다시 `invitations`를 참조 → 42P17.

**왜 일어나는가:**
- RLS 정책 안에서 다른 RLS 테이블을 `EXISTS (SELECT FROM other_table)`로 참조하면 그 정책도 평가됨
- 새 테이블 추가 시 "기존 패턴(SECURITY DEFINER 헬퍼)"을 잊고 EXISTS 작성
- Append-only migration 규칙 때문에 잘못 만든 정책을 *다시 DROP하고 새로 만드는* 추가 마이그레이션이 필요 — 점점 누더기가 됨

**어떻게 막나:**
1. **새 테이블 RLS는 무조건 헬퍼 함수만** — 직접 `EXISTS (SELECT FROM table)` 금지. `am_board_member(board_id)`, `can_read_board(board_id)`, `can_edit_board(board_id)` 같은 4~5개 헬퍼로 모든 정책 표현
2. **RLS 테스트 픽스처** — 마이그레이션 추가 시 `supabase/tests/rls/<feature>.sql`에 시나리오(소유자/멤버/외부인/익명) 테스트. CI 없어도 로컬에서 `supabase db reset && psql -f tests/rls/*.sql` 실행 의무화
3. **헬퍼 함수는 STABLE + SECURITY DEFINER + search_path 고정** — `SET search_path = public, pg_catalog` 명시 (없으면 search_path 공격 가능)
4. **재귀 깊이 모니터링** — Supabase 로그에서 `42P17` (infinite recursion) 발생 시 즉시 알림. 한 번 발생하면 prod 사용자에 500 에러

**조기 경보 신호:**
- 새 마이그레이션 PR에서 정책에 `EXISTS (SELECT 1 FROM` 패턴 등장 (헬퍼 함수 우회)
- 로컬 RLS 테스트 추가 안 한 채 prod push
- `am_board_*` 헬퍼 함수가 새 테이블 케이스 (예: invitee 본인) 커버 안 되어 정책이 직접 JOIN 시작

**Phase에서 다루기:**
- **Phase 1 (MVP):** 항목 1, 3 — 컨벤션 문서화 (CLAUDE.md에 이미 있지만 강화)
- **Phase 1.5 (협업·투표):** 항목 2 — invitations·notifications 추가 시 테스트 픽스처 필수
- **Phase 2:** 항목 4 — Sentry/PostHog 도입 시 42P17 알림

---

### Pitfall 5: Google Places API 비용 폭주 (Cost Runaway)

**무엇이 잘못되는가:**
영상 한 개에 10개 장소가 추출되고, 각각 Text Search → Place Details까지 호출하면 한 영상당 비용이 예산($0.005)의 10배가 된다. 더 나쁜 경우: 추출 실패 시 재시도가 무한 루프 → 한 영상이 100번 호출됨 → 한 달에 한 영상이 $1+ 발생. $200 무료 크레딧이 일주일에 소진된다.

**왜 일어나는가:**
- Places API "(New)" SKU는 tiered pricing — FieldMask에 `places.id, places.displayName` (Essentials)만 요청하면 저렴하지만, `places.*` (와일드카드)나 `places.photos`까지 요청하면 Pro/Enterprise SKU로 자동 승급되어 단가가 5~10배
- 추출 retry 로직이 exponential backoff 없이 즉시 재시도
- 동일 영상을 사용자가 두 번 share → 같은 추출이 중복 실행
- 같은 가게가 여러 영상에 나와도 매번 새로 Places API 호출 (캐싱 X)

**어떻게 막나:**
1. **FieldMask는 명시적 최소 셋만** — `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location` 만. 와일드카드 절대 금지. 프로덕션에서 와일드카드 쓰면 비용이 예측 불가능
2. **링크 중복 가드** — `(board_id, url)` UNIQUE constraint로 같은 보드에 같은 URL 두 번 insert 차단 (이미 ASIS에서 했던 패턴이면 유지)
3. **Place ID 캐시 테이블** — `place_text_cache(query_text, locale, city_code, google_place_id, cached_at)` — 같은 "긴자 본점, 도쿄, ja" 쿼리는 30일 캐시 활용. Edge Function이 호출 전 캐시 확인
4. **영상당 API call 예산 enforcement** — Edge Function 내부 카운터: "이 영상 처리에서 Places API 12회 초과 시 즉시 abort, 나머지 장소는 `unresolved` 상태로 저장". 사용자에겐 "10개 중 7개만 위치 확인됨" 표시
5. **Retry 정책 명시** — 같은 link_id에 대해 최대 2회 재시도, exponential backoff (10s, 60s). `extraction_status='failed'` 후엔 사용자 수동 트리거만
6. **Daily/Monthly budget alert** — Google Cloud Console에서 알림 설정 ($50, $100, $150 임계). 시도해본 적 없어도 셋업 자체는 5분

**조기 경보 신호:**
- Edge Function 로그에서 같은 link_id가 1시간에 5번 이상 처리됨
- Google Cloud billing dashboard에서 일일 비용 > $5
- Places API 응답 시간 < 100ms (캐시될 만한 반복 쿼리 흔적)

**Phase에서 다루기:**
- **Phase 1 (MVP):** 항목 1, 2, 5, 6 — 비용 폭주 방어선 (1주일 안에 셋업)
- **Phase 1.5:** 항목 3 (캐시 테이블) — 추출 빈도 늘기 전에
- **Phase 2:** 항목 4 (영상당 예산) — 추출 정교화 마일스톤에서 같이

---

### Pitfall 6: Expo SDK 54 + pnpm 모노레포 빌드 실패 — 시간 블랙홀 (Build Time Sink)

**무엇이 잘못되는가:**
*이미 현재 블로커.* `pod install` 단계에서 `react-native-reanimated` podspec이 pnpm isolated store 경로를 못 풀어 빌드 실패. 우회법이 여러 개 있지만 (shamefully-hoist, EAS Build, yarn 분리) 각각의 장단점이 있어 잘못 고르면 *해결 후 다른 패키지가 깨진다*. 2인팀이 여기 1주일 박혀있으면 전체 일정이 무너진다.

**왜 일어나는가:**
- pnpm은 기본 isolated install (각 패키지가 자기 node_modules에 symlink만 가짐) — RN 0.81/Reanimated 4.x peer dependency 검사가 이 구조를 못 풀음
- Expo SDK 54는 isolated install을 "지원"하지만, 모든 RN 네이티브 라이브러리가 호환되는 건 아님
- Reanimated 4.1+는 `react-native-worklets`를 명시적 peer dependency로 요구 (이전엔 내부 번들이었음) — 자동 설치 안 됨
- 모노레포 root에 hoist하면 web의 React 19 / iOS의 React 18 충돌 (이미 한 번 데임 — bug #2)

**어떻게 막나:**
1. **결정 트리 미리 잠그기** — 다음 중 하나로 *이번 주에* 결정:
   - **A안 (권장)**: `apps/ios/.npmrc`에 `node-linker=hoisted` (apps/ios 디렉토리 한정). web의 isolation 깨지지 않음
   - **B안**: EAS Build (클라우드) — Apple Developer $99/year 필요. 로컬 toolchain 우회. 빌드 시간 + 비용
   - **C안 (비권장)**: yarn workspaces로 iOS만 분리 — 두 패키지 매니저 공존은 누적 부채
2. **명시적 peer dependency 설치** — `pnpm -F @moajoa/ios add react-native-worklets@latest` 즉시 실행 (Reanimated 4.x peer requirement)
3. **빌드 성공 시 lockfile 잠금** — 동작하는 lockfile을 git에 커밋하고, 향후 `pnpm install`은 `--frozen-lockfile`로 (CI 도입 전이라도 로컬 컨벤션)
4. **빌드 실패 시간 박스** — 한 빌드 이슈에 4시간 이상 박지 말 것. 4시간 초과 시 EAS Build로 즉시 전환

**조기 경보 신호:**
- `pod install` 에러에 `Unable to find a specification` 또는 `podspec not found`
- Metro bundler가 `react-native-reanimated` 경로 못 찾음
- iOS 빌드 후 `worklets` 관련 런타임 에러 (peer 누락 신호)

**Phase에서 다루기:**
- **Phase 1 (MVP) - 최우선 블로커:** 항목 1, 2 — 이번 주 결정. 결정 늦으면 share extension·dogfooding 전체 지연
- **Phase 1.5:** 항목 3 — 빌드 안정화 후

---

### Pitfall 7: 2인팀의 Scope Creep — ASIS 재현 (Scope Creep Redux)

**무엇이 잘못되는가:**
ASIS Flutter 버전이 1년+ 걸린 이유는 기술 선택보다 *기능 확장*이었을 가능성이 높다. v1 MVP("링크 → 핀 → 공유 열람")가 검증되기 전에:
- 협업 투표 UI를 미리 만들기 시작
- 둘러보기 피드를 "있으면 좋겠다"고 짓기 시작
- 어드민 큐 시스템을 "곧 필요할 거니까" 미리 셋업
- "다국어 / 다크모드 / OAuth / 알림" 같은 비핵심 기능에 매주 조금씩 시간 씀

결과: dogfooding 못 하는 채로 6개월 → 동기 잃음 → 다시 피봇 사이클.

**왜 일어나는가:**
- 2인팀은 review 압력이 적어서 개인 호기심으로 코드가 추가됨
- "이거 곧 필요해" = 거의 항상 *지금은 안 필요*
- Karpathy 4 원칙 중 3.2 (Simplicity First)와 3.3 (Surgical Changes)이 LLM 코딩 에이전트뿐 아니라 *사람에게도* 적용돼야 함
- GSD plan에 없는 작업을 "잠깐만"이라며 끼워넣음
- 코드 리뷰 시 "옆에 있는 거 정리하고 싶다"가 PR 키움

**어떻게 막나:**
1. **PROJECT.md의 Out of Scope를 매주 1회 읽기** — `/gsd-progress` 결과에 강제 출력. "이거 정말 v1에 필요?"
2. **모든 PR은 GSD plan의 task ID 참조 필수** — plan에 없는 작업은 PR 거절 (또는 별도 `/gsd-quick` PR로 분리)
3. **"옆 코드 정리하고 싶음"은 따로 issue로** — 본 PR에 끼우지 않음 (CLAUDE.md § 3.3 이미 정의됨, 사람도 동일)
4. **Dogfooding 게이트** — Phase 1 완료 = "내가 일본 여행 계획에 실제로 7일간 사용했음" 증명 (스크린샷·실제 핀 목록·실제 결정 결과). 이 게이트 전엔 Phase 1.5 코드 한 줄도 안 씀
5. **Sprint = 1주, 끝에 demo** — 2인이지만 매주 금요일 "이번 주에 뭐가 동작하나" 30분 시연. 시연할 게 없으면 깊이 반성

**조기 경보 신호:**
- 한 주 동안 dogfooding 가능한 새 기능이 0개
- PR diff에 plan에 없는 파일이 포함됨
- "이거 곧 필요할 거니까" / "기왕 하는 김에" / "리팩토링 한번..." 단어 등장
- Out of Scope 리스트에서 항목이 슬며시 Active로 이동

**Phase에서 다루기:**
- **Phase 1 (MVP):** 항목 1, 2, 4, 5 — 워크플로우 컨벤션. 코드 변경 없음
- **모든 Phase 전반:** 항목 3 — 코드 리뷰 룰

---

## Moderate Pitfalls (조심해야 할 것)

### Pitfall 8: Next.js 15 App Router + Supabase SSR 쿠키 동기화

**무엇이 잘못되는가:**
RSC(React Server Component)에선 쿠키 *읽기만* 가능, 쓰기 불가. Supabase 세션 refresh가 RSC 안에서 실행되면 쿠키 set이 silently fail → 클라이언트는 로그인된 줄 알고 hydration mismatch + 다음 요청에서 anon으로 fallback. Next.js 15.3+ Turbopack에선 `cookies()` 비동기화로 "cookies() should be awaited" 런타임 에러도 발생.

**왜 일어나는가:**
- `createServerClient`의 setAll 콜백이 try/catch로 묶여있어야 하는데 새 패키지 설치 시 그게 빠질 수 있음
- middleware.ts에서 세션 refresh 안 하면 RSC에서 만료된 토큰 그대로 사용
- 클라이언트 컴포넌트와 서버 컴포넌트가 같은 페이지에 있을 때 user state 불일치

**어떻게 막나:**
1. middleware.ts에 `updateSession` 항상 셋업 (Supabase 공식 가이드 그대로) — 세션 refresh는 middleware 책임
2. server client는 항상 `async createClient()` (Next.js 15+ `cookies()` 비동기)
3. setAll 콜백 try/catch로 RSC write 에러 무시
4. 2026년 말까지 anon key는 동작하지만, `sb_publishable_xxx`로 전환 계획 — 새 키는 회전 가능

**Phase:** Phase 1 (MVP) — 처음 셋업할 때 정확히 하고 잊기

---

### Pitfall 9: 마이그레이션 Append-Only 규칙 위반 유혹

**무엇이 잘못되는가:**
"방금 만든 0007_xxx.sql에 작은 오타가 있다 — 그냥 고치자" — 로컬에서 동작하지만 prod엔 이미 적용됐다면 다음 사람이 `supabase db reset`할 때 다른 결과가 나옴. RLS 정책의 미묘한 차이는 prod에서만 발견되어 추적 지옥.

**왜 일어나는가:**
- "아직 push 안 했으니까" 자체가 위험 — push 전 commit이 머지되면 다른 환경에 적용됨
- prod에 적용된 마이그레이션을 *덮어쓰는* 새 마이그레이션은 git diff로 안 보임 (논리적 변화만 있음)

**어떻게 막나:**
1. 마이그레이션 파일은 한 번 commit 후 절대 수정 X. 수정이 필요하면 `0008_fix_0007.sql` 새 파일
2. `supabase migration list` 정기 점검 — 로컬과 prod 동기화 상태 확인
3. PR에 마이그레이션 포함 시 description에 `BREAKING DB CHANGE` 명시 (이미 CLAUDE.md § 4.6에 있음)

**Phase:** 모든 Phase — 컨벤션

---

### Pitfall 10: 한국어 IME + Share Extension 한국어 앱 이름

**무엇이 잘못되는가:**
iOS Share Extension의 "Activity" 이름(공유 시트에 뜨는 앱 이름)이 한글로 표시 안 되거나, 카톡에서 공유 시 한글 URL 인코딩이 깨짐. 한국어 IME 사용 중 textarea에서 한 글자가 두 번 입력되는 React Native 이슈.

**왜 일어나는가:**
- `expo-share-intent` 또는 `expo-share-extension` config 플러그인의 `displayName`을 한글로 지정 시 `Info.plist`의 `CFBundleDisplayName` 인코딩 이슈 가능
- React Native TextInput에서 한국어 조합형 입력 시 `onChangeText` 이벤트가 음절 분해/결합마다 발생 — 검색 자동완성 등에서 중복 호출

**어떻게 막나:**
1. Share extension `displayName`은 영문 + 한글 병기 또는 한글만 (둘 다 빌드 테스트)
2. 한국어 입력 검색은 `onChangeText` 대신 debounce (150~300ms) 적용
3. URL 인코딩은 항상 `encodeURIComponent` 거친 후 Supabase에 저장

**Phase:** Phase 1.5 (Share Extension) — 실기기 검증 시

---

### Pitfall 11: Pretendard 폰트 로딩 — Hermes + iOS 빌드

**무엇이 잘못되는가:**
Pretendard는 9개 weight(100~900)가 있는데 다 번들하면 앱 크기 ~30MB 증가. 또 `useFonts` 훅으로 런타임 로딩 시 첫 렌더 깜빡임(FOUT). Hermes 엔진은 정적 분석이 강해서 dynamic require로 폰트 import하면 빌드 실패.

**왜 일어나는가:**
- Pretendard variable font는 OTF/TTF로 변환된 weight별 파일 → 모두 번들 시 용량 증가
- `expo-font` config plugin은 빌드 타임 embed (빠름), `useFonts`는 런타임 (느림). 둘 섞이면 우선순위 모호
- Hermes는 `require(variableExpression)` 패턴 못 풂

**어떻게 막나:**
1. 사용 weight만 번들 (Regular 400, Medium 500, SemiBold 600, Bold 700 — 4개면 충분)
2. `expo-font` config plugin으로 빌드 타임 embed (config plugin > useFonts)
3. 폰트 import는 정적 require만 — `require('./assets/fonts/Pretendard-Regular.otf')` 직접

**Phase:** Phase 1 (디자인 시스템 트랙) — 디자인 토큰 정의할 때 함께

---

## Minor Pitfalls

### Pitfall 12: Realtime 구독 누수
보드 화면 unmount 시 Supabase Realtime 채널 unsubscribe 안 함 → 연결 수 누적 → 무료 tier 동시 연결 한도 초과.
**예방:** `useEffect` cleanup에서 `channel.unsubscribe()` 컨벤션화. ESLint 룰로 검증 가능.
**Phase:** Phase 1.5 (Realtime 도입 시)

### Pitfall 13: OG 이미지 자동 생성 — 한자 렌더링 실패
`@vercel/og`에서 한국어/일본어 폰트 미포함 시 한자가 □로 표시. 카톡 공유 카드 망함.
**예방:** OG generator에 Pretendard + Noto Sans JP 폰트 명시적 fetch (또는 edge function에 번들).
**Phase:** Phase 1.5 (web 폴리시)

### Pitfall 14: Magic Link 만료 + 무료 SMTP rate limit
Supabase 무료 SMTP는 시간당 4개, 매직링크 만료 5분 — dogfooding 중 친구 5명에게 동시 invite 시 깨짐.
**예방:** Phase 1.5 외부 사용자 받기 전 Resend 또는 Postmark로 SMTP 교체.
**Phase:** Phase 1.5 또는 Phase 2

### Pitfall 15: Anthropic claude-sonnet-4-6 응답 JSON 깨짐
LLM이 가끔 JSON 앞뒤에 마크다운 코드블록 ```json ... ``` 두름 → JSON.parse 실패.
**예방:** Edge Function에서 응답 파싱 전 ```...``` 제거 + Zod로 validate. 실패 시 1회 재시도.
**Phase:** Phase 1 — 이미 베이스라인에서 발생 가능

---

## Technical Debt Patterns

| Shortcut | 즉각 이득 | 장기 비용 | 언제 OK? |
|---|---|---|---|
| `add_manual_place` RPC가 클라이언트 좌표 신뢰 (현 상태) | 빠른 베이스라인 | 악성 클라이언트가 가짜 좌표 주입 가능 | dogfooding 단계만. Phase 1.5에 `resolve-place` Edge Function 필수 |
| Web의 dev tool UI (보드 생성/링크 추가) 노출 | 개발 검증 빠름 | 외부 사용자 혼란 ("web에서도 되는 줄") | `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1` 게이트로 즉시 격리 |
| 무료 Supabase SMTP | $0 | 시간당 4개, 스팸함 분류 | 2인 dogfooding만. 친구 invite 시작 전 Resend |
| 추출 정확도 측정 없음 | 코드 작성 빠름 | 회귀 detect 불가, 프롬프트 변경마다 도박 | Phase 1 baseline 측정 후엔 *절대 안 됨* |
| `apps/ios/.npmrc shamefully-hoist=true` | iOS 빌드 통과 | 모노레포 isolation 깨지면 web/iOS dep 충돌 재발 | iOS 디렉토리 한정으로만 (root 전체 X) |
| placeholder Database 타입 (`SupabaseClient<any,any,any>`) | 타입 충돌 회피 | 타입 안전성 손실 | `pnpm supabase:types` 자동 생성 후 즉시 교체 (이미 Day 2에 해결) |
| Eval sample 없이 프롬프트 변경 | 빠른 iteration | 무엇이 개선/회귀인지 모름 | 절대 안 됨 — Phase 2 본격 정교화 전에 sample 10~20개 만들기 |

---

## Integration Gotchas

| 통합 | 흔한 실수 | 올바른 접근 |
|---|---|---|
| **Google Places API (New)** | FieldMask 와일드카드 `places.*` 사용 → Enterprise SKU로 자동 승급, 10배 비용 | 명시적 필드만 (`places.id,places.displayName,places.formattedAddress,places.location`). 와일드카드는 dev에서만 |
| **Anthropic Claude** | system prompt에서만 "JSON으로 답해"라고 함 | Response prefill (`{"places": [`)로 시작 강제 + Zod로 validate + 실패 시 1회 retry |
| **Supabase RLS** | 정책에 `EXISTS (SELECT FROM other_table)` 직접 작성 | 모든 cross-table 검증은 SECURITY DEFINER 헬퍼 함수 (`am_board_owner`, `am_board_member`) |
| **Supabase Realtime** | channel을 컴포넌트 안에서 매 렌더마다 생성 | `useEffect`로 mount/unmount 정확히 (cleanup 필수). Channel 이름은 보드별 unique |
| **YouTube timedtext** | 자막 없는 영상에 대한 fallback 없음 → Edge Function 500 | 자막 없으면 `extraction_status='no_transcript'` + 메타데이터(title, description)만으로 best-effort |
| **expo-share-intent** | iOS Share Extension target에 Supabase URL/key 환경변수 자동 주입 안 됨 (별도 target임) | config plugin의 `iosShareExtensionInfoPlist`에 `MOAJOA_SUPABASE_URL` 명시 주입, 또는 App Groups로 main app 키 공유 |
| **expo-share-intent + pnpm** | isolated install로 native module 못 풀음 | apps/ios만 `node-linker=hoisted`. Reanimated와 같은 트레이드오프 |
| **Next.js 15 cookies() in createClient** | 동기 호출 → "cookies() should be awaited" 에러 | `createClient`를 async 함수로, `const cookieStore = await cookies()` |
| **@vercel/og** | 폰트 미주입 → 한자 □ 렌더링 | Pretendard + Noto Sans JP woff/woff2를 generator에 fetch로 주입 |

---

## Performance Traps

| 함정 | 증상 | 예방 | 언제 깨지나 |
|---|---|---|---|
| **PostGIS index 누락** — places 테이블의 `location geography` 컬럼에 GIST index 없음 | 지도 viewport 쿼리 시 full table scan, 응답 > 1s | 마이그레이션에 `CREATE INDEX places_location_gix ON places USING GIST (location)` 명시 | 보드당 places 100개 넘어가면 체감 |
| **N+1 쿼리 in 보드 페이지** — 핀 N개 each마다 votes 별도 fetch | 보드 페이지 SSR > 2s | `vote_counts_for_places(board_id)` RPC로 한 번에 집계 (이미 ASIS 패턴) | 핀 10개부터 체감 |
| **Edge Function cold start** — Deno isolate 매번 새로 부팅 | 첫 추출 요청 8~12s | Deno KV warm-up 또는 invocation 빈도 늘리기 (dogfooding 단계엔 OK) | 추출 빈도 낮을 때 — dogfooding에선 항상 |
| **이미지 Optimization 안 함** — Google Places photo URL 직접 사용 | 모바일 데이터 사용량 폭증, LCP 나쁨 | Next.js `<Image>` + `cloudinary` 또는 Vercel Image Optimization 거치기 | Web `/b/[slug]` 폴리시 단계 |
| **Realtime 구독 폭증** — 보드 페이지 visit마다 새 채널 | 무료 tier 200 concurrent 한도 hit | 채널 재사용 (singleton pattern) + 비로그인 페이지는 polling으로 | 동시 사용자 100명+ (Phase 2 한참 뒤) |
| **추출 동시 다발** — 한 사용자가 5개 영상 share extension으로 보냄 | Edge Function 5개 동시 실행, Anthropic rate limit hit | Edge Function 큐 + 순차 처리 (또는 Supabase pg_cron + queue 테이블) | dogfooding 중에도 발생 가능 |

---

## Security Mistakes

| 실수 | 위험 | 예방 |
|---|---|---|
| **Service role key 클라이언트 번들 노출** | RLS bypass 가능, DB 전체 노출 | `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function의 `Deno.env.get`만. apps/web/apps/ios 어디서도 import 금지. `.env.example`에서 명확히 분리 |
| **Google Maps API 키 restriction 누락** | 누군가 키를 추출해 본인 앱에 사용 → 비용 폭주 | Web 키는 HTTP referrer (moajoa.app), iOS 키는 bundle ID, Server 키는 Edge Function IP/no restriction. *키 3개 분리* |
| **share_slug 추측 가능** — 짧은 보드 slug | 비공개 보드를 외부인이 URL 추측으로 접근 | `share_slug`는 16+ chars cryptographic random (`nanoid(16)`), URL safe |
| **`public_board_view` RPC가 visibility 체크 안 함** | RPC를 직접 호출하면 비공개 보드도 노출 | RPC 내부에서 `WHERE visibility = 'public' AND share_slug = $1`. SECURITY DEFINER라도 조건 필수 |
| **클라이언트가 좌표 직접 INSERT** (현 `add_manual_place` 상태) | 사용자가 가짜 가게 좌표 주입 → 보드 신뢰도 파괴 | Phase 1.5 `resolve-place` Edge Function — 클라이언트는 `google_place_id`만 전달, 서버가 Places API로 검증 |
| **Edge Function에 caller JWT 검증 누락** | 비인증 사용자가 service role 권한으로 DB 수정 | Edge Function 시작 시 `Authorization: Bearer <JWT>` 검증 후 `auth.uid()` 추출 |
| **invitee 이메일이 RLS로 보호 안 됨** | 보드 owner가 아닌 사람이 invitations 테이블 조회로 다른 사람 이메일 수집 | invitations RLS는 invitee 본인 + 보드 owner만 SELECT |

---

## UX Pitfalls

| 함정 | 사용자 영향 | 더 나은 접근 |
|---|---|---|
| **추출 30초 동안 로딩 spinner만** | 사용자가 "고장났나?" 의심하고 앱 종료 | 단계별 progress ("자막 가져오는 중 → 장소 찾는 중 → 지도에 표시 중"). Realtime으로 백엔드 status push |
| **핀 클릭 → 영상 점프 시 잘못된 시각** (Pitfall 3) | "이 앱 못 믿겠다" | Timestamp range + -3초 offset (Pitfall 3 참조) |
| **저신뢰 핀과 고신뢰 핀이 시각적으로 동일** | 사용자가 어느 게 정확한지 모름, 전부 의심 | confidence 별 색상/투명도 (`high`=진한 색, `low`=흐림 + ⚠️ 아이콘) |
| **보드 첫 진입 시 빈 상태** | "뭘 해야 하지?" | 첫 보드 자동 생성 + 샘플 유튜브 링크 1개 미리 추출되어 있음 (이미 v1 active list에 있음) |
| **공유 링크로 들어온 비로그인 사용자 → 로그인 강제** | 친구가 카톡으로 받은 사람이 "가입해야 된다고? 그냥 닫자" | `/b/[slug]`는 SSR로 즉시 렌더 (이미 결정됨). 투표만 로그인 게이트 |
| **추출 실패 시 사용자 행동 불가** | "왜 실패했지?" 끝 | 실패 시 "수동 추가" 버튼 + 자막 없음/장소 없음/할당량 초과 등 실패 사유 명시 |
| **여러 도시 보드에 핀이 흩어짐** | "내 핀이 어디 있지?" 검색 어려움 | 지도가 자동으로 보드 도시 + bbox로 fit. "도시별 묶기" 필터 |
| **한국어/일본어 mixed transcript에서 한쪽만 추출** | 일본 영상에서 일본인 가게 이름이 빠짐 | LLM 프롬프트에 명시: "한·일·영 어느 언어든 장소면 추출". transcript 언어 폴백 ko → ja → en |

---

## "Looks Done But Isn't" Checklist

배포 직전 또는 dogfooding 시작 전 검증:

- [ ] **추출 파이프라인:** transcript 없는 영상은 어떻게 되나? (현재 500? `no_transcript` 상태로 graceful?)
- [ ] **추출 파이프라인:** Places API 호출 5개 중 2개 실패 시 부분 결과가 저장되나? (all-or-nothing 아니어야 함)
- [ ] **추출 파이프라인:** 같은 영상을 같은 보드에 다시 share extension으로 보내면 중복 핀 생기나?
- [ ] **RLS:** 비멤버가 `/b/<private-slug>` 접근 시 정확히 404 (200 빈 데이터 X)
- [ ] **RLS:** anon이 직접 `boards` 테이블 SELECT 시도 시 0행 반환 (에러 X, 빈 결과)
- [ ] **RLS:** owner가 본인 보드 DELETE 시 places·links·votes 모두 cascade 되나?
- [ ] **iOS Share Extension:** 카톡에서 공유 → 보드 선택 화면이 1초 안에 뜨나? (cold start 포함)
- [ ] **iOS Share Extension:** Share extension에서 Supabase 호출 시 main app과 같은 user session 공유되나? (App Groups 셋업)
- [ ] **Web `/b/[slug]`:** 카톡으로 링크 공유 시 OG 카드에 보드 제목 + 지도 썸네일이 뜨나?
- [ ] **Web `/b/[slug]`:** Lighthouse 모바일 점수 > 80 (실제 모바일 사용자가 다수)
- [ ] **인증:** 매직 링크 클릭 → 같은 디바이스 다른 브라우저에서 열어도 동작하나?
- [ ] **인증:** 로그아웃 후 RSC 캐시에 이전 user 데이터 남나? (router.refresh 강제)
- [ ] **비용:** Google Cloud billing 일일 알림 셋업됨 ($5, $20, $50)
- [ ] **비용:** Anthropic usage dashboard 주간 점검 컨벤션
- [ ] **추출 정확도:** sample 10개 영상으로 baseline precision/recall 측정 결과 문서화
- [ ] **에러:** Edge Function 실패 시 로그에 link_id + 실패 단계 명시 (디버깅 가능)
- [ ] **앱 아이콘 + splash:** 실기기에서 확인됨 (시뮬레이터 ≠ 실기기)
- [ ] **Pretendard:** iOS·Web 양쪽에서 한자 fallback 정상 (Noto Sans JP)
- [ ] **첫 사용자 흐름:** 로그인 → 30초 안에 첫 핀이 지도에 뜨나? (e2e cold flow)

---

## Recovery Strategies

| 함정 발생 시 | 회복 비용 | 회복 단계 |
|---|---|---|
| **RLS 무한 재귀 (Pitfall 4) prod에 배포됨** | HIGH | 1) 즉시 새 마이그레이션으로 해당 정책 DROP + 최소 권한으로 임시 교체 2) SECURITY DEFINER 헬퍼로 재작성 3) prod에 push 4) 로컬에 RLS 테스트 추가 |
| **Places API 비용 폭주 (Pitfall 5) 발견됨** | MEDIUM | 1) Google Cloud에서 API key 일시 차단 2) Edge Function에 emergency switch (`EXTRACTION_ENABLED=false`) 3) FieldMask·캐시·budget 한 번에 도입 4) 사용자에게 "일시 점검" 공지 |
| **iOS 빌드 1주 이상 박힘 (Pitfall 6)** | MEDIUM | 1) EAS Build로 즉시 전환 (Apple Dev 계정만 있으면 1일) 2) 로컬 빌드는 백로그로 미루기 3) Web으로 가능한 검증 계속 |
| **Hallucinated places (Pitfall 1) 다수 발견됨** | LOW | 1) 영향받은 places 일괄 `low_confidence`로 마킹 2) 프롬프트에 citation 강제 패치 3) eval sample로 회귀 측정 |
| **Wrong city (Pitfall 2) 보고됨** | LOW | 1) 영상 단위 재추출 API (`POST /api/links/:id/reextract`) 2) 사용자가 트리거 가능 3) 백엔드는 locationBias 패치 |
| **마이그레이션 수정해버림 (Pitfall 9)** | HIGH | 1) prod DB schema vs local 차이 진단 (`pg_dump --schema-only` 비교) 2) drift fix용 새 마이그레이션 작성 3) 향후 룰 강화 |
| **Scope creep (Pitfall 7)로 dogfooding 못 함** | HIGH | 1) `/gsd-pause-work`로 모든 활성 작업 freeze 2) PROJECT.md Out of Scope 재정독 3) 가장 작은 dogfooding 가능 단위로 plan 재작성 4) 1주 sprint로 demo 강제 |

---

## Pitfall-to-Phase Mapping

로드맵 phase가 각 pitfall을 어떻게 다루는지.

| Pitfall | 예방 Phase | 검증 방법 |
|---|---|---|
| 1. Hallucinated places | Phase 1 (citation) + Phase 2 (eval) | sample 영상 10개의 precision ≥ 0.8 |
| 2. Wrong city | Phase 1 | bounding box 위반율 < 5% |
| 3. Timing drift | Phase 1 (range) + Phase 1.5 (UX) | 점프 정확도 dogfooding 평가 (틀린 점프 < 20%) |
| 4. RLS 재귀 next round | Phase 1 (컨벤션) + Phase 1.5 (테스트) | 새 마이그레이션 PR마다 RLS 테스트 첨부 |
| 5. Places API 비용 폭주 | Phase 1 (FieldMask + budget alert) | 일일 비용 dashboard < $5 |
| 6. iOS 빌드 시간 블랙홀 | Phase 1 (이번 주 결정) | iOS 실기기에서 앱 실행 가능 |
| 7. Scope creep | 전 Phase | 매주 demo + Out of Scope 점검 |
| 8. Next.js SSR 쿠키 | Phase 1 (Web 폴리시) | 로그인 → RSC 페이지 새로고침 → 세션 유지 |
| 9. Migration append-only 위반 | 전 Phase | `supabase migration list` 정기 점검 |
| 10. 한국어 IME + Share Ext | Phase 1.5 | 실기기 카톡 공유 테스트 |
| 11. Pretendard 로딩 | Phase 1 (디자인 트랙) | 앱 cold start 폰트 깜빡임 없음 |
| 12. Realtime 누수 | Phase 1.5 | Supabase dashboard 동시 연결 수 < 50 |
| 13. OG 한자 렌더링 | Phase 1.5 | OG 이미지에 일본어 가게 이름 정상 표시 |
| 14. Magic link rate limit | Phase 1.5 (외부 사용자 전) | Resend SMTP 전환 |
| 15. LLM JSON 깨짐 | Phase 1 | Edge Function 파싱 실패율 < 1% |

---

## Sources

### Context: 프로젝트 내부 (검증된 1차 정보)
- `/Users/wcb/Documents/MOAJOA/.planning/PROJECT.md` — v1 범위, 제약, key decisions
- `/Users/wcb/Documents/MOAJOA/CLAUDE.md` — 컨벤션 (RLS·마이그레이션·import 룰)
- `/Users/wcb/Documents/MOAJOA/docs/ARCHITECTURE.md` — 데이터 플로우, security model
- `/Users/wcb/Documents/MOAJOA/docs/WORKSTREAMS.md` — 트랙별 상태·블로커
- `/Users/wcb/Documents/MOAJOA/docs/SESSION-NOTES-2026-05-24.md` — 피봇 스캐폴드 + 알려진 한계
- `/Users/wcb/Documents/MOAJOA/docs/SESSION-NOTES-2026-05-25.md` — Day 2 발견된 버그 6개 (RLS 재귀 포함)

### 외부 검증 (2026년 공식 / 최신)
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54) — isolated install / Reanimated 4.x peer 변경 (HIGH)
- [Expo Monorepo guide](https://docs.expo.dev/guides/monorepos/) — pnpm node-linker 옵션 (HIGH)
- [Upgrading to Expo 54 Survival Story (Medium)](https://medium.com/@shanavascruise/upgrading-to-expo-54-and-react-native-0-81-a-developers-survival-story-2f58abf0e326) — react-native-worklets peer 누락 이슈 (MEDIUM)
- [Upgrading Expo SDK 54 Common Issues (Medium)](https://diko-dev99.medium.com/upgrading-to-expo-sdk-54-common-issues-and-how-to-fix-them-1b78ac6b19d3) (MEDIUM)
- [Google Places API Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) — FieldMask SKU 티어링 (HIGH)
- [Google Places: Choose Fields](https://developers.google.com/maps/documentation/places/web-service/choose-fields) — 와일드카드 금지 권고 (HIGH)
- [Manage Google Maps Platform costs](https://developers.google.com/maps/billing-and-pricing/manage-costs) — budget alert 셋업 (HIGH)
- [Supabase SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — 쿠키·middleware 패턴 (HIGH)
- [Supabase SSR client creation](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — setAll try/catch (HIGH)
- [Next.js + Supabase cookies() should be awaited (GH discussion)](https://github.com/vercel/next.js/discussions/81445) — Next.js 15.3+ async cookies (MEDIUM)
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) (HIGH)
- [Supabase RLS SECURITY DEFINER (DEV)](https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2) — 패턴 확인 (MEDIUM)
- [Supabase RLS Production Patterns (DEV)](https://dev.to/whoffagents/supabase-row-level-security-in-production-patterns-that-actually-work-2l78) (MEDIUM)
- [Infinite recursion discussion (GH)](https://github.com/orgs/supabase/discussions/1138) — 42P17 트리거 패턴 (HIGH)
- [expo-share-intent (npm)](https://www.npmjs.com/package/expo-share-intent) — config plugin 사용 (HIGH)
- [expo-share-extension (MaxAst)](https://github.com/MaxAst/expo-share-extension) — 대안 패키지 (MEDIUM)
- [iOS App Extensions Expo docs](https://docs.expo.dev/build-reference/app-extensions/) — entitlements 처리 (HIGH)
- [K-HALU 한국어 hallucination 벤치마크](https://proceedings.iclr.cc/paper_files/paper/2025/file/cfcadfe84ee49908cde1fc2992c38d20-Paper-Conference.pdf) — 한국어 LLM hallucination 빈도 영문보다 높음 (MEDIUM)
- [Expo Fonts docs](https://docs.expo.dev/develop/user-interface/fonts/) — config plugin vs runtime (HIGH)
- [Karpathy LLM coding observations](https://x.com/karpathy/status/2015883857489522876) — Scope creep / simplicity 원칙 (이미 CLAUDE.md § 3에 반영) (HIGH)

### 신뢰 등급
- HIGH: Supabase·Expo·Google 공식 문서, 프로젝트 내부 코드/세션노트
- MEDIUM: 검증된 커뮤니티 게시물 (DEV.to, Medium), GitHub 토론
- LOW: 없음 (모든 항목은 최소 MEDIUM 이상 출처로 검증됨)

---

*Pitfalls research for: MOAJOA (link-to-map travel curation app, post-pivot from Flutter to TS monorepo)*
*Researched: 2026-05-25 by GSD researcher*
*Next review: Phase 1 완료 시 (dogfooding 게이트 통과 후 — 새로 발견된 pitfall 추가)*
