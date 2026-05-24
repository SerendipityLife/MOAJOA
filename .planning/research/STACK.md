# Stack Research — MOAJOA v1 MVP Add-ons

**Domain:** Link-to-map travel app (Next.js 15 + Expo SDK 54 + Supabase 모노레포)
**Researched:** 2026-05-25
**Confidence:** HIGH (모든 항목 공식 문서로 교차 검증)

---

## 0. 연구 범위

이 문서는 **이미 확정된 코어 스택을 재검증하지 않는다.** 피봇 결정(2026-05-24) 직후의 stack은 유지되며,
v1 MVP 완성을 위해 *추가로* 필요한 6개 add-on의 현재(2025-2026) 권장 버전·패턴·gotcha만 다룬다.

**확정된 코어 (변경 X):**
Next.js 15 · Expo SDK 54.0.34 · React 19.1 · React Native 0.81.5 · Supabase (Postgres + PostGIS + Edge Functions Deno) · Anthropic claude-sonnet-4-6 · Google Places API · Zod 3.23 · TypeScript 5.6 strict · pnpm workspaces (no turbo) · Tailwind v4 (web) · NativeWind 4 (iOS)

---

## 1. iOS Share Extension (`expo-share-intent`)

### 권장 버전 & 패턴

| 항목 | 결정 |
|---|---|
| **패키지** | `expo-share-intent@^5` (SDK 54 호환 라인) |
| **방식** | Config plugin (prebuild). Expo Go 사용 불가 |
| **부가 의존성** | `expo-linking` (SDK 52+ 필수), `patch-package` (postinstall 필수) |
| **빌드 경로** | `expo prebuild --no-install --clean` → `expo run:ios` (로컬) 또는 EAS Build (클라우드) |
| **권장 대안 X** | `MaxAst/expo-share-extension` — 별도 SwiftUI 커스텀 뷰가 필요할 때만. MOAJOA는 "URL 받기 → 메인 앱에서 보드 선택"이라 커스텀 뷰 불필요 |

**핵심 이유:** SDK 54 호환 매트릭스는 `5.x` 라인. `6.x`는 SDK 55+ 전용. iOS 빌드가 이미 블로커인 상황에서 SDK 점프는 risk를 키운다.

### app.json 설정 (요약)

```json
{
  "expo": {
    "scheme": "moajoa",
    "plugins": [
      [
        "expo-share-intent",
        {
          "iosActivationRules": {
            "NSExtensionActivationSupportsWebURLWithMaxCount": 1,
            "NSExtensionActivationSupportsWebPageWithMaxCount": 1,
            "NSExtensionActivationSupportsText": true
          },
          "iosAppGroupIdentifier": "group.com.serendipitylife.moajoa"
        }
      ],
      "expo-linking"
    ]
  }
}
```

### 주요 gotcha

1. **`patch-package` postinstall 필수** — xcode 프로젝트 sync 실패 방지용. 빠뜨리면 build error.
2. **App Group ID는 Apple Developer 계정에서 사전 생성 필요** — `group.com.serendipitylife.moajoa` 형식. Apple Developer 가입 ($99/yr) 필요.
3. **EAS Build 사용 시 single extension target만 지원** — 다른 extension(예: NotificationServiceExtension)과 동시 사용은 별도 설정.
4. **현재 iOS 로컬 빌드 블로커(pnpm hoisting)와 별개 문제** — Share Extension 추가 전에 먼저 베이스 iOS 빌드부터 통과시켜야 함.
5. **수신 핸들러는 `expo-router`의 root layout에서 등록** — `useShareIntentContext()` hook으로 받음. URL은 deep link로 들어옴.

### Confidence

**HIGH** — 공식 GitHub README + npm 페이지 + 컴파티빌리티 매트릭스 모두 일치.

---

## 2. Next.js 15 OG 이미지 (`next/og` + `opengraph-image.tsx`)

### 권장 버전 & 패턴

| 항목 | 결정 |
|---|---|
| **패키지** | **`next/og` (Next.js 15 빌트인)** — 별도 `@vercel/og` 설치 불필요 |
| **파일 위치** | `apps/web/app/b/[slug]/opengraph-image.tsx` (file convention) |
| **이미지 크기** | 1200×630 (OG 표준) |
| **포맷** | `image/png` |
| **런타임** | 기본 Edge runtime, 정적 자산 읽어야 하면 `runtime = 'nodejs'` |
| **권장 대안 X** | `satori` 직접 사용, 외부 OG 서비스 (Bannerbear 등) — 모두 over-engineering |

**핵심 이유:** Next.js 15에서 `opengraph-image.tsx` file convention이 표준. `<head>` meta tag 자동 생성, 빌드 시 정적 최적화, 동적 라우트에서 `params`만 await하면 됨.

### 구현 패턴

```tsx
// apps/web/app/b/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'MOAJOA 보드'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // public_board_view RPC로 보드 메타 가져오기 (anon 가능)
  const board = await fetchPublicBoard(slug)

  // 한국어 폰트 필수 (Pretendard) — 기본 폰트는 한글 미지원
  const pretendard = await readFile(
    join(process.cwd(), 'assets/Pretendard-Bold.ttf')
  )

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#fff',
        padding: 80,
      }}>
        <div style={{ fontSize: 72, fontWeight: 700 }}>{board.title}</div>
        <div style={{ fontSize: 36, color: '#666', marginTop: 24 }}>
          핀 {board.pinCount}개 · {board.cityCode}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Pretendard', data: pretendard, weight: 700, style: 'normal' }],
    }
  )
}
```

### 주요 gotcha

1. **`params`는 **Promise** (Next.js 15 v16부터)** — 반드시 `await params`. 동기 접근은 deprecated.
2. **한글 폰트 직접 로드 필수** — `next/og`의 기본 폰트는 한글 미지원. Pretendard `.ttf`를 `apps/web/assets/`에 두고 `readFile`로 로드.
3. **`.ttf`/`.otf`/`.woff`만 지원, `.woff2` 불가.**
4. **`display: flex`가 거의 모든 컨테이너에 필요** — Satori 제약. 빠뜨리면 런타임 에러.
5. **외부 데이터 fetch 시 정적 최적화 깨질 수 있음** — `revalidate`로 ISR 명시 (`export const revalidate = 60`).
6. **이미지 사이즈 한도**: OG 8MB, Twitter 5MB 초과 시 build fail. 1200×630 PNG는 보통 200KB 내외라 안전.
7. **로컬 파일 fetch 시 `runtime = 'nodejs'` 명시** — Edge runtime에서는 `node:fs` 불가.

### Confidence

**HIGH** — Next.js 공식 문서 (v16.2.6 기준) 직접 인용. v15 동일 API.

---

## 3. iOS 지도: `expo-maps` vs `react-native-maps`

### 권장 버전 & 패턴

| 항목 | 결정 |
|---|---|
| **패키지** | **`react-native-maps@1.20.1` 유지** (현재 설치된 것 그대로) |
| **provider** | iOS: Apple Maps (default, 무료) / Android: Google Maps (key 필요) |
| **권장 대안 X (현재로선)** | `expo-maps` — **alpha 상태**, breaking changes 빈번, iOS 18.0+ 일부 기능, iOS에서 Apple Maps만 (Google Maps 미지원) |

**핵심 이유:**

1. **`expo-maps`는 alpha** — 공식 문서가 "frequently experience breaking changes"라고 명시. MVP 출시까지 위험.
2. **`react-native-maps@1.20.x`는 SDK 54의 default** — New Architecture interop layer로 안정 동작. `1.21.x`는 New Arch-first지만 아직 stabilizing.
3. **iOS에서 Google Maps 필요할 수 있음** — `expo-maps`는 iOS에서 Apple Maps 강제. 한국·일본 POI 검색 결과 정합성을 Places API와 맞추려면 Google Maps provider 옵션이 있는 게 유리.
4. **MOAJOA는 핀 표시 + 클릭 → timestamp jump 정도라 단순** — `react-native-maps`의 표준 `<Marker>` 컴포넌트로 충분.

### 사용 패턴 (요약)

```tsx
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'

<MapView
  // iOS는 Apple Maps default. Google Maps 통일하려면 PROVIDER_GOOGLE
  // (단, iOS Google Maps는 별도 setup 필요 — 일단 Apple Maps로 시작)
  initialRegion={{ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
>
  {places.map(p => (
    <Marker
      key={p.id}
      coordinate={{ latitude: p.lat, longitude: p.lng }}
      title={p.name_ko ?? p.name_local}
      onPress={() => jumpToTimestamp(p.link_id, p.timestamp_sec)}
    />
  ))}
</MapView>
```

### 재평가 시점

- **Phase 2 / SDK 55 업그레이드 시점에 `expo-maps` 재평가** — alpha 졸업 + 3D 빌딩·SwiftUI 통합 같은 native UX가 정말 필요할 때.
- **iOS Google Maps key 필요해질 때** — Apple Maps의 한국 POI 품질이 dogfooding에서 부족하면 그때 전환.

### 주요 gotcha

1. **`react-native-maps@1.20`은 New Arch interop 동작** — `expo prebuild` 후 pod install 필수.
2. **Google Maps API key는 iOS·Android 분리** — bundle ID/package name restriction 걸기 (이미 `docs/ARCHITECTURE.md`에 명시됨).
3. **PostGIS에서 받은 좌표는 `(longitude, latitude)` 순서** — RN Marker는 `{latitude, longitude}` object. 어댑터 함수 한 군데에 격리.

### Confidence

**HIGH** — Expo 공식 docs (expo-maps alpha 상태) + react-native-maps GitHub discussion #5782 (SDK 54 호환) 모두 확인.

---

## 4. NativeWind v4 + Expo SDK 54

### 권장 버전 & 패턴

| 항목 | 결정 |
|---|---|
| **패키지** | **`nativewind@^4.2.0`** (4.1.23 → 4.2.x 업그레이드) |
| **Tailwind CSS** | `tailwindcss@3.4.17` (v4가 아닌 **v3**) |
| **Reanimated** | `react-native-reanimated@~4.1.7` (Expo SDK 54 기본) — 그대로 유지 |
| **Babel plugin** | `react-native-reanimated/plugin`만. **`react-native-worklets/plugin` 동시 사용 금지** |
| **권장 대안 X** | NativeWind v5 — 아직 베타. v4.2 안정화 라인이 안전. Tailwind v4 (RN용) — NativeWind가 아직 Tailwind v4 미지원 |

**핵심 이유:** 현재 설치된 `nativewind@4.1.23`은 **Reanimated v4와 호환 안 됨** — peer dependency가 `reanimated@~3.17.4`로 고정. Expo SDK 54는 Reanimated v4.1.x를 ship. **`className` 스타일이 적용되지 않는 silent failure**가 발생. `4.2.0`에서 패치됨.

### 업그레이드 액션

```bash
pnpm --filter @moajoa/ios add nativewind@^4.2.0
# tailwindcss는 v3 라인 유지 (현재 ^3.4.13 → 3.4.17로 minor bump)
pnpm --filter @moajoa/ios add -D tailwindcss@^3.4.17
```

`babel.config.js`에서 `react-native-worklets/plugin`이 들어있으면 제거 (Reanimated v4에 worklets 포함됨).

### 주요 gotcha

1. **NativeWind는 Tailwind v3에 묶임 — Web의 Tailwind v4와 버전이 다름** — `packages/ui-tokens`는 두 버전 모두에서 동작하는 토큰 정의만 export 권장 (CSS custom properties / plain JS object). v4 전용 문법 (`@theme` 디렉티브) 토큰 파일에 X.
2. **`global.css`에 `@tailwind base/components/utilities` 명시 필수** — Expo Metro가 자동 inject 안 함.
3. **Reanimated v4 worklets 중복 설정 주의** — 위에 명시.
4. **HMR이 className 변경 안 받을 때 — Metro cache clear** (`expo start -c`).

### Confidence

**HIGH** — NativeWind GitHub discussion #1604, Expo SDK 54 changelog, 사용자 다수 보고된 known issue.

---

## 5. Supabase JS Client v2 + Edge Functions (Deno) 패턴

### 권장 버전 & 패턴

| 항목 | 결정 |
|---|---|
| **클라이언트 (web/iOS)** | `@supabase/supabase-js@^2.45.4` 유지. `@supabase/ssr@^0.5.1` (web) 유지 |
| **Edge Function import** | **`npm:@supabase/supabase-js@2`** (Deno npm specifier) |
| **HTTP 서버** | **`Deno.serve`** (Deno 1.35+ 빌트인) — `std/http`의 `serve` 사용 X |
| **함수당 deno.json** | 각 함수 디렉토리에 `deno.json` 두기 (의존성 격리) |
| **권장 대안 X** | `esm.sh/@supabase/supabase-js` — npm specifier가 type resolution이 더 안정. `withSupabase` from `npm:@supabase/server` — 신생 wrapper, 아직 보편 안 됨. 명시적 createClient + JWT 전파가 명확. |

**핵심 이유:** MOAJOA는 이미 `extract-youtube` Edge Function이 동작 중. 새 패턴 도입 risk보다 일관성 우선. **`npm:` specifier + 명시적 createClient + Authorization header 전파** 패턴이 표준이고 검증됨.

### 표준 Edge Function 스켈레톤

```ts
// supabase/functions/extract-youtube/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // 2. 호출자 JWT 검증 (Supabase 플랫폼이 verify_jwt=true일 때 자동, 단 user identity는 직접 검증)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 3. RLS 적용 클라이언트 — 호출자 JWT 전파
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // 4. user identity 확인
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 5. RLS bypass 필요할 때만 service role (예: links UPDATE extraction_status)
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ... 추출 로직
})
```

### 주요 gotcha

1. **`SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트 번들에 X** — Edge Function 환경변수에만. `.env.local`은 git ignore (이미 됨).
2. **`verify_jwt = true` (기본값) 유지** — false로 하면 anon이 함수 직접 호출 가능해짐. `extract-youtube`는 인증된 사용자만 호출해야 함.
3. **JSR (`jsr:@supabase/...`)는 아직 미성숙** — npm specifier가 안전.
4. **Cold start 0~5ms로 빠르지만 큰 의존성 추가 시 늘어남** — Anthropic SDK는 obj size 큼. 함수 분리 고려.
5. **`Deno.env.get`는 deploy 후에만 값 반환** — 로컬은 `supabase functions serve --env-file ./supabase/.env.local`.
6. **타입 재생성 잊지 말 것** — 스키마 변경 후 `pnpm supabase:types` 필수 (CLAUDE.md에 이미 명시).

### Confidence

**MEDIUM-HIGH** — npm specifier + Deno.serve + JWT 전파는 Supabase 공식 docs 표준. `withSupabase` wrapper(`@supabase/server`)는 신생이라 의도적으로 채택 보류 (검증 후 도입 검토는 Phase 1.5).

---

## 6. Anthropic SDK + Prompt Caching (장소 추출 비용 절감)

### 권장 버전 & 패턴

| 항목 | 결정 |
|---|---|
| **SDK** | `@anthropic-ai/sdk@latest` (Deno에서 `npm:@anthropic-ai/sdk`) |
| **모델** | `claude-sonnet-4-6` (현재 결정) |
| **캐싱** | **명시적 `cache_control` breakpoint** — automatic caching이 아닌 system prompt block에 직접 설정 |
| **TTL** | **`5분 ephemeral`** (default) — 1시간 캐시는 2x 가격, 추출 트래픽 패턴이 burst일 가능성 높아 5분으로 충분 |
| **최소 캐시 토큰** | Sonnet 4.6는 **1,024 토큰** — system prompt + few-shot 예시 합치면 충족 가능 |

**핵심 이유:**

1. **추출 system prompt는 거의 변하지 않음** — JSON schema, few-shot 예시, 출력 규칙. 캐싱 효과 최대 (cache read = 0.1x).
2. **영상별로 다른 건 transcript뿐** — user message로 분리하면 system prompt는 매번 cache hit.
3. **비용 budget < $0.005/영상** — 캐싱 없이 system prompt 2K + transcript 5K = 7K input tokens. 캐싱 시 system 2K는 0.1x → cache write 1.25x 첫 호출, 이후 0.1x. 누적 효과 큼.

### 구현 패턴

```ts
// supabase/functions/extract-youtube/pipeline/claude.ts
import Anthropic from 'npm:@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

const SYSTEM_PROMPT = `당신은 여행 영상 transcript에서 장소를 추출하는 도우미입니다.

규칙:
- 출력은 JSON array. 각 원소: { name_local, name_ko, timestamp_sec, confidence }
- 음식점·관광지·랜드마크만. 광범위한 지명(도시·동)은 제외.
- name_local은 영상의 원어 (일본 영상이면 일본어)
... (긴 few-shot 예시 다수 포함, 총 1500+ 토큰)
`

export async function extractPlaces(transcript: string) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // 명시적 breakpoint
      },
    ],
    messages: [
      {
        role: 'user',
        content: `다음 transcript에서 장소를 추출하세요:\n\n${transcript}`,
      },
    ],
  })

  // 캐시 hit rate 로깅 (비용 검증)
  console.log({
    cache_creation: response.usage.cache_creation_input_tokens, // 1.25x
    cache_read: response.usage.cache_read_input_tokens,         // 0.1x ← 우리가 원하는 것
    input: response.usage.input_tokens,                          // 1x (transcript)
    output: response.usage.output_tokens,
  })

  return parseResponse(response)
}
```

### 주요 gotcha

1. **`cache_control`을 변하는 콘텐츠에 두면 hit 안 함** — system prompt 마지막 block에만. transcript는 user message로 분리.
2. **System prompt가 1024 토큰 미만이면 캐싱 무시 (no error)** — `cache_creation`과 `cache_read`가 둘 다 0이면 캐시 안 된 거. 로그로 검증 필수.
3. **5분 TTL** — burst 트래픽이 아니면 효과 작음. 일정 간격 호출이라면 1시간 TTL도 고려 (2x 가격이지만 hit rate 보장).
4. **Few-shot 예시가 frequently 바뀌면 캐시 무효화** — 프롬프트 튜닝 phase 끝나고 lock하기 전까지는 캐싱 효과 제한적.
5. **System prompt 한국어 길이 주의** — 한글 1자 ≈ 2~3 토큰. 1024 토큰 목표 → 약 400~500자 이상.
6. **응답 JSON 검증은 Zod로** — Claude가 가끔 추가 prose 붙임. `@moajoa/core/schemas`에 `PlaceCandidate` 스키마 두고 parse 실패 시 retry.

### Confidence

**HIGH** — Anthropic 공식 docs (`platform.claude.com/docs/.../prompt-caching`) 직접 인용. Sonnet 4.6 1024 토큰 최소값, TTL 옵션, response usage 필드 모두 확인.

---

## 종합: 우선순위 권장 액션

v1 MVP까지 적용 순서 (의존성 기반):

1. **NativeWind 4.2.0+ 업그레이드** (즉시) — 이미 silent failure 가능성. iOS 빌드 디버깅 전에 처리.
2. **iOS 로컬 빌드 통과** (블로커) — 기존 워크스트림 #1. Share Extension은 빌드 통과 후.
3. **`expo-share-intent@^5` 추가** (iOS 빌드 통과 후) — Apple Developer 계정 + App Group ID 사전 준비.
4. **Web `opengraph-image.tsx` 추가** (iOS와 병렬 가능) — Pretendard `.ttf` 자산 준비 필요 (워크스트림 #4 디자인과 협업).
5. **Anthropic prompt caching 도입** (백엔드 워크스트림 #3 추출 정확도 측정과 함께) — system prompt 안정화 후가 효과 큼.
6. **Supabase Edge Function 패턴 점검** — 이미 동작 중이라 *변경 없음*. 신규 함수(`resolve-place` 등) 추가 시 위 스켈레톤 사용.

---

## 무엇을 추가하지 말 것 (Anti-recommendations)

| 추가 X | 이유 | 대신 |
|---|---|---|
| `@vercel/og` 별도 설치 | Next.js 15는 `next/og` 빌트인 | `next/og` import |
| `expo-maps` (현 시점) | Alpha 상태, breaking changes, iOS Google Maps 미지원 | `react-native-maps@1.20` 유지 |
| `MaxAst/expo-share-extension` | SwiftUI 커스텀 뷰 필요할 때만 | `achorein/expo-share-intent@5` |
| NativeWind v5 | 아직 베타 | 4.2.x 안정 라인 |
| Tailwind v4 (iOS) | NativeWind가 v3에 묶임 | Web만 v4, iOS는 v3 — `ui-tokens`로 통합 |
| `react-native-worklets/plugin` (Reanimated v4와 함께) | Reanimated v4에 worklets 내장 — 충돌 | `react-native-reanimated/plugin`만 |
| `@supabase/server` `withSupabase` wrapper | 신생, MOAJOA 기존 함수와 패턴 불일치 | 명시적 `createClient` + JWT 전파 |
| `cache_control`을 user message에 | 매 요청마다 hash 달라 cache miss | system prompt block에만 |
| Anthropic 1시간 캐시 TTL (현 시점) | 2x 가격, 추출이 burst 패턴 | 5분 ephemeral default |
| esm.sh import (Edge Function) | type resolution 불안정 | `npm:` specifier |
| Firebase 재도입 (어떤 형태든) | 피봇 결정 | Supabase only |

---

## 버전 호환성 매트릭스 (요약)

| 패키지 | 현재 (package.json) | 권장 (v1 MVP) | 액션 |
|---|---|---|---|
| `nativewind` | `^4.1.23` | `^4.2.0` | **업그레이드 필수** (Reanimated v4 호환) |
| `tailwindcss` (iOS) | `^3.4.13` | `^3.4.17` | minor bump |
| `tailwindcss` (Web) | `^4.0.0-beta.2` | 유지 | — |
| `react-native-maps` | `1.20.1` | 유지 | — |
| `react-native-reanimated` | `~4.1.7` | 유지 | — |
| `@supabase/supabase-js` | `^2.45.4` | 유지 | — |
| `expo-share-intent` | **미설치** | `^5.x` | **신규 추가** |
| `expo-linking` | `~8.0.12` | 유지 | — (share-intent 의존성으로 OK) |
| `next/og` | (Next 15 빌트인) | — | 별도 설치 X |
| `@anthropic-ai/sdk` | (Edge Function) | `latest` | npm specifier 사용 |
| `patch-package` | 미설치 | latest | **신규 추가** (share-intent 위해) |

---

## 설치 명령 (한 번에)

```bash
# NativeWind 업그레이드 (즉시)
pnpm --filter @moajoa/ios add nativewind@^4.2.0
pnpm --filter @moajoa/ios add -D tailwindcss@^3.4.17

# Share Extension 추가 (iOS 빌드 통과 후)
pnpm --filter @moajoa/ios add expo-share-intent@^5
pnpm --filter @moajoa/ios add -D patch-package
# postinstall script 추가 + xcode 패치 파일을 apps/ios/patches/에 복사
# app.json plugins에 ["expo-share-intent", { ... }] 추가
# 그 다음:
pnpm --filter @moajoa/ios prebuild
pnpm --filter @moajoa/ios ios

# Web OG 이미지 (코드만 추가, 의존성 X)
# apps/web/app/b/[slug]/opengraph-image.tsx 생성
# apps/web/assets/Pretendard-Bold.ttf 추가
```

---

## Sources

### 1차 (공식, HIGH confidence)

- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) — SDK 호환성
- [expo-share-intent README (achorein)](https://github.com/achorein/expo-share-intent) — v5 ↔ SDK 54, 설치 매트릭스, patch-package 요구사항
- [Next.js Metadata Files: opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) — v16.2.6 기준, `params` Promise API, 폰트 로딩 패턴
- [Next.js ImageResponse API](https://nextjs.org/docs/app/api-reference/functions/image-response) — Satori 제약, 폰트 포맷
- [Expo Maps Documentation](https://docs.expo.dev/versions/latest/sdk/maps/) — alpha 상태 명시, iOS 18+ 일부 기능, Apple Maps only
- [react-native-maps Discussion #5782](https://github.com/react-native-maps/react-native-maps/discussions/5782) — SDK 54 호환 확인
- [NativeWind ↔ Expo 호환성 Discussion #1604](https://github.com/nativewind/nativewind/discussions/1604) — v4.2.0+ 패치
- [NativeWind + Reanimated v4 Discussion #1529](https://github.com/nativewind/nativewind/discussions/1529) — peer dep 충돌, 해결책
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions) — 표준 구조
- [Supabase Edge Functions Auth Guide](https://supabase.com/docs/guides/functions/auth) — JWT 전파 패턴
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — Sonnet 4.6 1024 토큰 최소, TTL 옵션, usage 필드

### 2차 (보조, MEDIUM confidence)

- [Vercel OG Image Generation Docs](https://vercel.com/docs/og-image-generation)
- [Introducing expo-maps blog post (Expo)](https://expo.dev/blog/introducing-expo-maps-a-modern-maps-api-for-expo-developers)
- [NativeWind v4 styling not working with SDK 54 (Medium)](https://medium.com/@matthitachi/nativewind-styling-not-working-with-expo-sdk-54-54488c07c20d) — 실 사용자 트러블슈팅

---

*Stack research for: MOAJOA v1 MVP 추가 add-ons (코어 스택은 재검증 X)*
*Researched: 2026-05-25*
*Author: gsd-researcher (project-research)*
