# MOAJOA Workstreams

병렬 개발 가이드. 각 워크스트림은 **파일 경계가 거의 겹치지 않도록** 설계됨. 공유 영역(스키마·디자인 토큰·DB 마이그레이션)은 별도 협의 채널 두기.

## 공유 영역 (충돌 위험, 합의 후 변경)

| 경로 | 누가 건드리나 | 원칙 |
|---|---|---|
| `packages/core/src/schemas/*` | 누구든 | 스키마 변경은 SQL 마이그레이션과 짝지어야 함. PR 시 두 변경 한 commit에 묶기. |
| `packages/core/src/constants.ts` | 누구든 | 도메인 상수 (한도·enum). UI/iOS/Edge 모두 import. |
| `packages/ui-tokens/src/*` | 디자인 | 색·간격·타이포 토큰. 변경 시 web + iOS 양쪽 시각 확인 필요. |
| `supabase/migrations/*` | 백엔드 + 누구든 (DB 변경 시) | 마이그레이션은 *append-only* — 기존 파일 수정 X, 새 번호 파일 생성. |
| `packages/api/src/queries/*` | 누구든 | 쿼리 helper. 새 패턴 추가는 OK, 기존 시그니처 변경은 caller 확인 후. |

---

## 1️⃣ iOS 앱 — 저장/공유/투표 (Owner: 모바일)

**상태:** **로컬 시뮬 빌드·실행 동작** (2026-06-03 — iPhone 17 Pro 시뮬에 로그인 화면까지 렌더 확인). 네이티브 모듈(expo-share-intent 등) 포함 빌드 OK.

> **v2.1 웹 퍼스트 동안 iOS 전면 동결 (Phase 23 피봇, 2026-07).** 아래 할 일은 v2.0 이전 기준의 역사 기록 — 현행 트립 4탭 구조는 v2.0 산출물이며, 동결 해제 후 재평가.

**파일 영역 (배타적):**
```
apps/ios/**          ← 전부
```

**해야 할 일 (우선순위 순):**

1. **로컬 시뮬 실행 — 동작함 ✅ (2026-06-03)**
   - 일상 개발: `cd apps/ios && EXPO_NO_WATCHMAN=1 pnpm start` → Metro hot reload (앱은 시뮬에 이미 설치됨)
   - 네이티브 재빌드 (네이티브 의존성/prebuild 변경 시만): `xcodebuild -workspace ios/MOAJOA.xcworkspace -scheme MOAJOA -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO build` → `xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/MOAJOA.app`
   - ⚠️ `pnpm ios`(expo run:ios)는 **Xcode 26 ↔ Expo CLI `devicectl` 버그**로 안 됨 → 위 `xcodebuild`로 대체 (expo 54.0.35+ 업그레이드 시 해결 가능성)
   - 적용된 Metro 우회 (`apps/ios/metro.config.js`, 각 why 주석 참고): `useWatchman`(env-gated, 콜드 watchman 행 회피) · `disableHierarchicalLookup=false`(pnpm 심링크 해석) · `ws`→empty stub(supabase realtime의 Node `ws` 의존 제거)
2. **첫 화면 동작 확인** — login → boards 탭 → 보드 상세
3. **링크 추가 → Edge Function 호출** — 이미 코드 있음 (`apps/ios/app/boards/[id].tsx`)
4. **Share Extension** — 카톡/사파리에서 URL 받기 → 보드 선택 → 저장 (Phase 1.5 핵심)
   - 의존성: `expo-share-intent` v5/v6 (SDK 호환 버전) 추가, native 빌드 필요
5. **지도 + 핀 클릭 → 영상 타임스탬프로 점프**

**막혔을 때 도움 되는 것:**
- Supabase 백엔드는 이미 동작 — 클라이언트 검증은 web에서 가능
- 이 디렉토리 한정해서 `node-linker=hoisted` 시도 가능
- Expo SDK 54 환경 (방금 업그레이드함)

---

## 2️⃣ Web — 입력·저장·편집 풀 서피스 (Owner: 프론트엔드)

**상태:** 작동. v2.1 웹 퍼스트 피봇(Phase 23, 2026-07 공식 반전)으로 웹이 **입력·저장·편집 풀 서피스** — 공유 열람·투표·채팅 포함. 현행 라우트: `/onboarding`(추가 위저드) · `/moa/[id]`(지도 보드·채팅) · `/t/[slug]`(공유 열람 + 게스트 참여) · `/poll/[code]`(날짜 투표).

**파일 영역 (배타적):**
```
apps/web/**          ← 전부
```

**해야 할 일 (우선순위 순):**

1. ~~`/b/[slug]` 공개 보드 페이지 폴리시~~ — `/t/[slug]` 공유 열람 표면으로 대체됨 (OG·SEO meta·모바일 반응형 포함, Phase 23–25)
2. ~~`/boards` 목록~~ — 구 보드 라우트 제거됨 (boards→trips 전환, v2.1)
3. ~~보드 생성/링크 추가 UI 제거 or admin-only로 격리~~ — `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 격리 완료. v2.1부터 정식 입력 UI는 `/onboarding` 위저드 · `/moa` add-sheet가 담당
4. ~~공유 보드 협업 UI (Phase 1.5)~~ — `/t/[slug]` 게스트 표면(찜·날짜 투표·닉네임 게이트)으로 구현됨 (Phase 25)
5. **둘러보기 (`/discover`)** — 공개 모아 탐색 (Phase 2)

**막혔을 때:**
- Next.js 15 + App Router + Tailwind v4 환경 (`@config` 디렉티브로 preset 로드)
- @types/react 19, React 19

---

## 3️⃣ 백엔드 / 추출 파이프라인 (Owner: 백엔드)

**상태:** 기본 동작. 정교화는 *나중에 더 깊이*. 현재는 baseline.

**파일 영역 (배타적):**
```
supabase/**          ← 전부 (스키마·함수)
```

**해야 할 일 (우선순위 순):**

1. **추출 정확도 측정 + 개선** (Eval-driven 권장)
   - 영상 10~20개 sample → expected places → actual places 비교
   - LLM 프롬프트 튜닝 (`supabase/functions/extract-youtube/pipeline/claude.ts`)
   - Places API resolution 실패 케이스 분석 (한국어 음차만 있는 가게)
2. **블로그·인스타 어드민 큐 시스템**
   - 새 테이블 `manual_extraction_queue` (link_id, assigned_to, status)
   - 운영진 어드민 UI (별도 라우트 또는 별도 Next.js 앱)
3. **`resolve-place` Edge Function** — 수동 핀 추가용 Places API 서버 프록시 (현재 `add_manual_place` RPC는 placeholder)
4. **추출 비용 모니터링** — Anthropic + Places API call 로깅 → 영상당 평균 비용 대시보드
5. **Webhook → Realtime push** — 추출 완료 시 Supabase Realtime 채널로 클라이언트에 알림

**막혔을 때:**
- 마이그레이션은 항상 새 번호 파일 (`0004_...sql`) — 기존 수정 X
- Edge Function 로컬 테스트: `supabase functions serve --env-file ./supabase/.env.local`
- DB 타입 재생성: `pnpm supabase:types` (스키마 변경 시 필수)

---

## 4️⃣ 디자인 시스템 (Owner: 디자인)

**상태:** 토큰만 정의됨. 실제 컴포넌트·assets 부재.

**파일 영역 (배타적):**
```
packages/ui-tokens/**           ← 색·간격·타이포·shadow
apps/web/app/globals.css        ← Web 전역 스타일
apps/ios/global.css             ← iOS 전역 스타일 (NativeWind)
apps/ios/assets/                ← icon, splash 이미지 (현재 미존재)
```

**해야 할 일 (우선순위 순):**

1. **App icon + splash** — iOS 빌드 위해 필요. `apps/ios/assets/icon.png` (1024×1024) + `splash.png`
2. **로고 / 워드마크** — Web 헤더, iOS 시작 화면
3. **컴포넌트 토큰 확장** — 버튼 height, input border-radius, card shadow 등을 토큰화
4. **다크 모드** — `colors.neutral` 이미 0~950까지 정의됨. CSS variable 매핑만 추가
5. **한국어·일본어 타이포 검증** — Pretendard + Noto Sans JP fallback. 한자 렌더링 테스트

---

## 5️⃣ Auth / 온보딩 (Owner: 풀스택)

**상태:** 이메일+비밀번호 + 매직 링크 동작. OAuth 버튼만 있고 provider 설정 미완.

**파일 영역:**
```
apps/web/app/login/page.tsx
apps/web/app/auth/callback/page.tsx
apps/ios/app/login.tsx
apps/ios/lib/supabase.ts
```

**해야 할 일:**

1. **Google OAuth 완료** — Google Cloud Console에서 OAuth Client 발급 → Supabase Dashboard에 입력. 자세한 건 `docs/CREDENTIALS-CHECKLIST.md` § 6.
2. **Apple Sign In** — Apple Developer 가입 필요 ($99/year). Service ID + Key.
3. **첫 로그인 시 환영 페이지** — 보드 1개 자동 생성 ("내 첫 여행") + 사용법 짧은 튜토리얼
4. **프로필 설정 UI** — display_name, avatar (Supabase Storage)

---

## 협업 채널 추천

- **PR 라벨**: `iOS`, `Web`, `Backend`, `Design`, `Auth` — 워크스트림 기반
- **마이그레이션 변경 시**: PR description에 `BREAKING DB CHANGE` 명시 + 모든 워크스트림 reviewer 추가
- **스키마(`packages/core`) 변경 시**: Web + iOS owner 둘 다 리뷰

## 글로벌 To-Do (누구든 해도 됨)

- [ ] CI 셋업 (`pnpm typecheck` + `pnpm lint` GitHub Actions)
- [ ] Sentry 또는 PostHog 에러 트래킹 통합
- [ ] Vercel 배포 (web) + 도메인 연결 (moajoa.app)
- [ ] Supabase Auth → custom SMTP (Resend) — 매직 링크 deliverability ↑
