# MOAJOA — 제품 · 디자인 방향

> 서비스의 목적, 제품 방향, 그리고 디자인 방향(UI/UX/색상)을 한 곳에 정리한 문서.
> 색·타이포·간격 등 수치는 모두 코드의 단일 출처에서 가져왔습니다. 임의 값 없음.
> 출처: [packages/ui-tokens/src/index.ts](../packages/ui-tokens/src/index.ts) · [packages/core/src/constants.ts](../packages/core/src/constants.ts) · [docs/ARCHITECTURE.md](ARCHITECTURE.md) · [apps/web/app/globals.css](../apps/web/app/globals.css)
>
> **마지막 업데이트:** 2026-06-10

---

## 1. 한 줄 정의

**유튜브·블로그·인스타 링크를 던지면, 영상 속 장소를 자동으로 추출해 지도 보드로 만들고, 친구와 공유해 같이 투표·결정하는 도구.**

- **현재 상태:** 2026-05-24 피봇 (Flutter ASIS → TypeScript 모노레포)
- **스택:** TS 모노레포 — Next.js 15(Web) · Expo SDK 54(iOS) · Supabase(DB·Auth·Edge·Realtime)

---

## 2. 서비스 목적 — 어떤 문제를 푸나

여행·맛집 콘텐츠는 넘치지만, "그래서 어디로 갈까"를 정하는 과정은 여전히 수동이다.

1. **저장과 정리의 단절** — 유튜브 "다음에 가볼 곳" 영상을 저장해도, 영상 속 가게 이름을 일일이 받아적고 지도에 찍는 건 사람 몫.
2. **흩어진 결정** — 친구들과 카톡으로 링크를 주고받지만, 의견(가고 싶다/별로)은 대화에 묻혀 사라지고 "확정 리스트"가 안 남는다.

MOAJOA는 이 두 지점을 메운다.

- **추출 자동화** — 링크 하나 → 영상 속 장소들이 지도 핀으로. (YouTube는 자동, 블로그·인스타는 운영 큐)
- **공유된 결정** — 보드를 친구와 공유 → 각자 ❤️ 투표 → 다수가 좋아한 곳이 "확정"으로 떠오른다.

> 핵심 가치: **"링크를 던지는 수고"만으로 "가볼 곳 지도 + 같이 내린 결정"이 나온다.**

---

## 3. 핵심 사용자 흐름

```
[저장]   iOS 공유시트로 유튜브 링크 → MOAJOA 보드에 던짐
   ↓
[추출]   Edge Function: 메타데이터 → 자막 → LLM(장소 후보) → Places API(좌표) → 핀 생성
   ↓     (진행 단계를 실시간 오버레이로 표시: 영상 정보 → 자막 → 장소 찾기 → 지도 표시)
[열람]   생성된 지도 보드를 본인이 확인 / 비로그인 친구는 공유 링크로 즉시 열람(Web SSR)
   ↓
[공유]   보드 visibility='shared' → 친구를 멤버로 초대 (editor / voter)
   ↓
[투표]   각 멤버가 장소에 ❤️ → Realtime으로 모두에게 즉시 반영
   ↓
[결정]   다수가 좋아한 장소가 "확정"으로 필터링 → 실제 여행 동선 확정
```

자세한 데이터 흐름·보안 모델: [docs/ARCHITECTURE.md](ARCHITECTURE.md)

### 도메인 한도 ([constants.ts](../packages/core/src/constants.ts) 기준)

| 항목 | 한도 |
|---|---|
| 보드 / 유저 | 20 |
| 링크 / 보드 | 50 |
| 멤버 / 공유보드 (owner 포함) | 20 |
| 링크 1개당 추출 장소 | 30 |
| 보드 제목 / 설명 | 60자 / 280자 |

### 핵심 enum

- **공유 모드:** `private`(본인만) · `shared`(초대 멤버 협업) · `public`(링크 가진 누구나 열람)
- **멤버 역할:** `owner` · `editor`(링크·장소 추가+투표) · `voter`(투표만)
- **투표:** MVP는 단일 `love`(❤️) 하나. 현재 "확정" = ❤️ 1개 이상. **목표 기준은 다수결(love/총멤버 ≥ 0.5)** — 단계적으로 전환 예정.
- **추출 상태:** `pending` · `processing` · `ready` · `failed` · `manual_review`

---

## 4. 제품 방향

### 4.1 플랫폼 역할 분담 (의도된 분리)

| | 역할 | 왜 |
|---|---|---|
| **iOS (Expo)** | **저장 · 공유 · 투표** | 공유시트로 링크를 "던지는" 행위가 모바일에서 일어남. 저장·투표의 홈. |
| **Web (Next.js)** | **열람 · 공유 랜딩** | 카톡으로 받은 공유 링크 → 비로그인 SSR 즉시 렌더 → OG 카드 → 가입 전환. 이게 핵심 획득 경로. |

> ⚠️ **Web에 "보드 생성/링크 추가" UI를 새로 만들지 않는다.** 현재 web의 폼은 dev tool이며 `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`에서만 노출. 생성·저장은 iOS 전용.

### 4.2 차별점

- **추출이 사람 손을 안 탄다** — 받아적기·지도 찍기 제거.
- **비로그인 공유 열람** — 링크만 있으면 친구가 앱 설치 없이 본다. 투표할 때만 가입.
- **결정이 남는다** — 대화에 묻히지 않고 보드에 "확정"으로 축적.

### 4.3 단계별 방향 (Phase)

- **MVP** — 저장 → 자동 추출 → 지도 보드, 단일 ❤️ 투표, 공개 보드 열람.
- **Phase 1.5** — 공유 보드 협업(초대·역할·실시간 투표), `resolve-place`로 수동 핀 좌표 서버 resolve.
- **Phase 2** — 둘러보기(`/discover`) 공개 보드 탐색, UI 텍스트 i18n(ko/ja).

### 4.4 로컬라이제이션

- 1차 **한국어(ko)** 기본, **일본어(ja)** 보조 (도쿄·오사카 등 일본 여행이 초기 타깃).
- 장소명 3필드 보존: `name_local`(현지 canonical) · `name_ko`(모국어) · `name_en`(선택).

---

## 5. UX 원칙

1. **"던지면 된다" (Zero-effort capture)** — 사용자의 유일한 수고는 링크 공유. 추출 중에는 단계별 진행 상태를 명확히 보여줘 기다림을 안심시킨다.
   (`영상 정보 가져오는 중 → 자막 읽는 중 → 장소 찾는 중 → 지도에 표시하는 중`)
2. **신뢰를 시각화한다** — AI 추출은 100%가 아니다. 핀에 신뢰도(vote-trust) 의미를 색으로 부여하고, 신뢰도 낮은 핀(< 0.7)은 흐리게 + 확인/거절 액션을 제공한다.
3. **지도가 중심** — 리스트가 아니라 지도가 1차 뷰. 핀 클릭 → 영상 타임스탬프로 점프.
4. **결정은 가볍게** — 투표는 탭 한 번(❤️). 결과(확정)는 필터로 즉시 본다.
5. **공유는 마찰 없이** — 공유 링크는 비로그인에서 즉시 열린다. 가입은 투표·복사 같은 행동 직전에만 요구.
6. **접근성 기본** — 키보드 포커스 가시성 유지, `prefers-reduced-motion` 존중(모션 끔).

---

## 6. 디자인 방향

### 6.1 브랜드 톤

- **MOAJOA Blue** 중심의 밝고 신뢰감 있는 톤. 여행의 설렘 + 정보의 신뢰.
- **플랫 디자인** — 그림자는 떠 있는 요소(FAB, 바텀 내비)에만. 카드·시트는 테두리와 면으로 구분.
- **틴티드 스캐폴드 + 흰 카드** — 앱 배경은 살짝 톤 다운된 회색(`#F5F6F8`), 카드·다이얼로그·시트는 순백(`#FFFFFF`).
- **한국어 가독성 우선** 타이포 (한·일 본문에 맞춘 줄간격).

### 6.2 색상

> 단일 출처: [packages/ui-tokens/src/index.ts](../packages/ui-tokens/src/index.ts). Web의 shadcn 호환 시맨틱 매핑은 [apps/web/app/globals.css](../apps/web/app/globals.css)의 `@theme`에만 존재(iOS 비영향).

**브랜드 (MOAJOA Blue)**

| 토큰 | HEX | 용도 |
|---|---|---|
| brand-50 | `#F5F7FF` | primary surface (배경 강조) |
| brand-100 | `#E0EAFF` | primary light / 텍스트 선택 배경 |
| brand-500 | `#2979FF` | **시그니처 액센트 (MOAJOA Blue)**, focus ring |
| brand-600 | `#2563EB` | **기본 버튼** |
| brand-700 | `#1D4ED8` | 버튼 hover / primary dark |

**지도 핀 상태 (vote-trust 의미)**

| 상태 | HEX | 의미 |
|---|---|---|
| candidate | `#94A3B8` | 추출됐지만 투표 없음 |
| loved | `#2979FF` | 누군가 ❤️ (brand-500) |
| confirmed | `#16A34A` | 다수가 좋아함 → 확정 (green-600) |
| hidden | `#D1D5DB` | 숨김 |

**서피스 / 중립**

- 스캐폴드 배경 `#F5F6F8` · 카드/시트 `#FFFFFF`
- Neutral 0~950 (Tailwind gray 계열). 본문 텍스트 `#111827`(neutral-900), 보조 텍스트 `#6B7280`(neutral-500), 보더 `#E5E7EB`(neutral-200).

**시맨틱**

| | HEX |
|---|---|
| success | `#10B981` |
| warning | `#F59E0B` |
| danger | `#EF4444` |
| info | `#3B82F6` |

**장소 카테고리 배지** (place 카드 칩)

자연 `#43A047` · 음식 `#FF8F00` · 문화 `#5C6BC0` · 웰니스 `#26A69A` · 쇼핑 `#8D6E63`

**랭킹 메달** — gold `#FFD700` · silver `#C0C0C0` · bronze `#CD7F32`

### 6.3 타이포그래피

- **폰트:** `IBM Plex Sans KR` → `IBM Plex Sans JP` → `Apple SD Gothic Neo` → `Noto Sans KR` → system-ui (한국어 우선, 일본어 폴백). mono는 `JetBrains Mono`.
  - Web: `next/font` · iOS: `expo-font`로 로드.
- **크기:** xs `12px` · sm `14px` · base `16px` · lg `18px` · xl `20px` · 2xl `24px` · 3xl `30px` · 4xl `36px`
- **굵기:** regular 400 · medium 500 · semibold 600 · bold 700
- **줄간격:** tight 1.25 · normal 1.5 · relaxed 1.65 (한·일 본문 가독성을 위해 영문 기본보다 타이트하게 설계)
- 글꼴 기능: `ss01`, `kern` 적용 + antialiased.

### 6.4 간격 · 모서리 · 그림자

- **Spacing:** 4px 그리드 기반 (1=4px, 2=8px, 4=16px, …).
- **Radius:** 버튼·인풋 `12px(lg)` · 카드 `16px(xl)` · 다이얼로그 `24px(2xl)` · 바텀시트 상단 `28px(3xl)` · 칩/FAB `full`.
- **Shadow (플랫 원칙 — 떠 있는 요소만):**
  - sm/md/lg는 미묘한 slate 그림자.
  - `fab`: `0 4px 16px rgba(41,121,255,.30)` (브랜드 글로우)
  - `nav`: `0 -2px 20px rgba(25,28,30,.10)` (바텀 내비)

### 6.5 모션

- 의존성 없는 **순수 CSS 진입 애니메이션** (Web globals.css의 `@utility`): `animate-fade-in` · `animate-fade-up` · `animate-scale-in`.
- 이징은 soft out-expo `cubic-bezier(0.16, 1, 0.3, 1)` — 정착감 있고 통통 튀지 않는 느낌.
- 리스트는 `animation-delay` stagger로 순차 등장.
- `prefers-reduced-motion: reduce`면 모션 끔. framer-motion은 정말 필요할 때만.

### 6.6 라이트 / 다크

- **현재 라이트 모드만** (`color-scheme: light`).
- 다크 모드는 계획됨 — `neutral` 0~950이 이미 정의돼 있어 CSS 변수 매핑만 추가하면 됨 ([WORKSTREAMS.md](WORKSTREAMS.md) §4).

---

## 7. 디자인 시스템 운영 규칙

플랫폼 간 시각 drift를 막기 위한 토큰 운영 규칙. (자세한 충돌 위험 영역은 [CLAUDE.md](../CLAUDE.md) §4.2)

1. **단일 출처는 `packages/ui-tokens`** — 색·간격·타이포·그림자. web(Tailwind)과 iOS(NativeWind) **둘 다** import. 여기를 바꾸면 양쪽 시각 확인 필수.
2. **Web 전용 시맨틱 레이어는 globals.css `@theme`에만** — shadcn/Radix 호환 이름(`--color-primary` 등)을 brand 토큰에 매핑. **`packages/ui-tokens`에 넣지 말 것**(iOS 깨짐).
3. **shadcn은 통째 init 금지** — Radix 접근성 프리미티브 + 없는 컴포넌트(select/dropdown/popover/tooltip/tabs)만 가져와 brand 색으로 리테마. 기존 컴포넌트·토큰 유지.
4. **컴포넌트 레벨 레이아웃**(gap, space-y 등)은 각 앱에 둠. 공유 토큰엔 시각 drift 위험이 있는 것만.

> 관련 합의 메모: 웹 프론트 폴리시는 "하이브리드 shadcn" 방식 (full init ❌). iOS 토큰 보호, 전역 톤/색은 ui-tokens가 아니라 web globals.css에서.

---

## 8. 미정 / 앞으로 정할 것

- **투표 확정 기준** — MVP(❤️ ≥ 1) → 목표(다수결 ≥ 50%) 전환 시점.
- **다크 모드** 매핑.
- **App icon / splash / 워드마크** assets (현재 토큰만 있고 실제 컴포넌트·assets 부재 — [WORKSTREAMS.md](WORKSTREAMS.md) §4).
- **블로그·인스타 추출** 운영 큐 UI.
- **UI 텍스트 i18n** (ko/ja) — Phase 2.
