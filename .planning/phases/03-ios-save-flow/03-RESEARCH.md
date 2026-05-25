# Phase 3: iOS Save Flow — Research

**Researched:** 2026-05-26
**Domain:** Expo SDK 54 iOS Share Extension + Supabase Realtime broadcast (mobile subscriber) + App Group SharedDefaults + Places Text Search Edge Function + offline drain
**Confidence:** HIGH (라이브러리·API 모두 1차 소스로 verify; 일부 UI 통합 디테일은 MEDIUM)

---

## Summary

Phase 3은 Phase 2가 만든 broadcast 채널을 iOS에서 처음 subscribe하고, iOS Share Extension을 Phase 1 D-16에 따라 처음 도입하는 phase다. 가장 큰 외부 의존성은 `expo-share-intent@6.1.1` (Expo SDK 54 호환 라인 = 5.x/6.x [VERIFIED: npm view 2026-05-25 publish]) 와 `@gorhom/bottom-sheet@5.2.14` (`>=3.16.0 || >=4.0.0-` reanimated peer를 명시 [VERIFIED: npm view]). 두 결정 모두 CONTEXT.md `<open_questions>`을 unblock한다.

라이브러리 선택 외 거의 모든 결정은 CONTEXT.md D-01~D-11이 lock 했기 때문에, 본 RESEARCH는 **"어떻게 (how)"** 에 집중한다:

- Share Extension target은 `expo-share-intent` config plugin이 prebuild 시점에 추가한다. App Group entitlement는 동일 plugin의 `iosAppGroupIdentifier` 옵션 + `extra.eas.build.experimental.ios.appExtensions[].entitlements`에 같이 선언 [CITED: docs.expo.dev/build-reference/app-extensions, github.com/achorein/expo-share-intent].
- 1탭 즉시 저장 토스트(D-01)는 기본 `expo-share-intent` 가능 — 풀 React Native 번들이 필요한 `expo-share-extension`은 아님. 기본 흐름은 native UIViewController가 텍스트만 표시하고 닫힘.
- broadcast subscribe는 `useEffect` + `useRef<RealtimeChannel>` + cleanup에서 `supabase.removeChannel(ch)` 패턴 [CITED: supabase docs Realtime + GH discussions/8573].
- AppState drain은 `AppState.addEventListener('change', ...)` 반환값에 `.remove()`를 cleanup에서 호출. Cold launch는 `_layout.tsx` mount 시 한 번 더 호출 (중복 호출 방어는 `useRef<boolean>` in-flight flag).
- resolve-place Edge Function은 기존 `places.ts` `resolveGooglePlace`의 `maxResultCount`를 1 → 5로 올리고 query-only 모드로 wrap한 form. 비용 로깅·FieldMask 패턴 그대로 차용.
- 수동 핀 RLS는 기존 `0001_init.sql`의 `places.insert` 정책이 이미 `can_edit_board()`로 통과 — 추가 마이그레이션 필요 X. `source_kind='manual'`은 Edge Function/RPC가 강제.

**Primary recommendation:** `expo-share-intent@^6.1.1` + `@gorhom/bottom-sheet@^5.2.14` 채택, App Group ID는 `group.com.serendipitylife.moajoa`로 lock, broadcast subscribe와 AppState drain은 둘 다 `useEffect` cleanup 엄격 강제, resolve-place는 기존 places.ts pipeline 함수의 generalized form (별도 디렉토리, 같은 패턴).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (from `<decisions>` D-01~D-11)

**Share Extension UX (SAVE-03)**
- **D-01:** boardpicker 없이 즉시 저장 + 한 줄 토스트. Share Extension 1탭 = "마지막 보드에 저장됨" 토스트. board 변경은 메인 앱 또는 별도 '철회' tap에서.
- **D-02:** "마지막 사용 보드" id 저장 = App Group SharedDefaults (`group.com.serendipitylife.moajoa`). Share Extension과 메인 앱이 같은 group 공유 — 양쪽에서 r/w. SAVE-04 enqueue 큐와 같은 storage 메커니즘.
- **D-03:** 로그인 안 됨 OR last board id 없음 → Share Extension은 "MOAJOA 앱 먼저 열기" 안내 + deeplink 버튼만 표시. share된 URL은 SharedDefaults에 `pending_links`로 enqueue.

**Offline enqueue / drain (SAVE-04)**
- **D-04:** Drain trigger = cold launch + foreground 복귀 둘 다. `AppState.addEventListener('change', ...)` + 앱 초기 mount 시 둘 모두에서 drain 호출.
- **D-05:** Enqueue 구조 = JSON array of `{url, board_id, queued_at, retry_count}` in App Group SharedDefaults 키 `pending_links`. board_id null이면 메인 앱이 board picker raise.
- **D-06:** 재시도 정책 = silent retry while `retry_count ≤ 3`. 초과 시 `pending_links_failed` 키로 이동 + "저장 실패" 시스템 보드 표시 + 명시적 재시도 버튼.

**수동 핀 (SAVE-05)**
- **D-07:** 장소 검색 = 텍스트 입력 + Places Autocomplete 드롭다운. 보드 상세 우측 상단 "+ 핀" → modal → text input → 서버 `resolve-place` → 상위 5개 결과 → 탭 = google_place_id 확정.
- **D-08:** `resolve-place` = 새 Edge Function. POST `{query?, lat?, lng?}` → `{google_place_id, displayName, formattedAddress, location, primaryType}`. extract-youtube와 동일한 명시적 FieldMask 패턴. extraction_costs에 `provider='google_places', model='text-search'` 기록.
- **D-09:** 편집/삭제 = 핀 탭 → bottom sheet → `[이름 수정][삭제][영상에서 위치]` (AI 핀만 마지막 버튼). 단일 sheet UI, source_kind에 따라 visibility만.

**추출 진행 UX (SAVE-02)**
- **D-10:** Phase 3 UI = 단순 spinner + done/error 토스트. broadcast 5단계 raw 노출 X. URL 추가 → "분석 중..." → done/error 토스트.
- **D-11:** p90 30초 측정 = `extraction_costs.duration_ms` SQL 집계 (이미 Phase 2가 로깅). 클라이언트 로깅 별도 X.

### Claude's Discretion (researcher/planner가 정함)
- iOS broadcast subscribe 패턴 helper 위치 (lib/realtime.ts 신규 vs lib/supabase.ts 확장)
- bottom sheet 라이브러리 (@gorhom/bottom-sheet vs Modal + custom vs expo-router modal)
- AppState listener registration 위치 (RootLayout vs custom hook)
- pending_links 직렬화 helper (native module bridge 패턴)
- expo-share-intent SDK 54+ 호환 확인 및 alternative

### Deferred Ideas (OUT OF SCOPE)
- 핀 탭 → 영상 timestamp jump 정교화 (Phase 5 또는 별도 minor add)
- 지도 long-press → reverse geocode 핀 추가 (v2)
- Share 후 in-app 즉시 점프 (v2 — D-01과 충돌)
- `/discover` 피드 (v1 out-of-scope)
- 공유 보드 멤버 초대·투표 UI (v2)
- Sentry/crash reporting (Phase 1 D-15 — v2)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAVE-01 | iOS 로그인 → 보드 목록 → 보드 상세까지 실기기 진입 | §"iOS Auth gate flow" — Phase 1 D-13 `app/index.tsx` 복원 + supabase.auth.getSession() routing |
| SAVE-02 | 보드 상세 YouTube URL → 30초 안에 핀 (p90) | §"Realtime broadcast subscribe pattern" — 기존 `extract:{link_id}` 채널 subscribe, done 시 places reload |
| SAVE-03 | 카톡/사파리 공유 시트 → 1탭 저장 | §"expo-share-intent setup", §"App Group SharedDefaults" |
| SAVE-04 | 오프라인 enqueue + 메인 앱 launch 시 drain | §"AppState drain pattern", §"pending_links JSON schema" |
| SAVE-05 | 수동 핀 추가·편집·삭제 (google_place_id 기반) | §"resolve-place Edge Function", §"places RLS already covers manual" |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Share Extension URL 수신 + 1탭 저장 | iOS native (Share Extension target) | App Group SharedDefaults | iOS framework가 host. URL은 SharedDefaults로 main app에 전달 |
| `pending_links` enqueue / drain | Main App (RN) | App Group SharedDefaults | Native UserDefaults는 cross-process store. Drain 로직은 RN side (supabase JS client 필요) |
| broadcast subscribe (extract progress) | Main App (RN) | Supabase Realtime | iOS는 consumer만. broadcast는 Phase 2 Edge Function이 sender |
| 수동 핀 검색 (Places Text Search) | Edge Function (`resolve-place`) | iOS client (debounce + dropdown) | Google API key 서버 보관 + extraction_costs 로깅 통합 (Phase 2 D-09) |
| 수동 핀 INSERT | DB (RLS `can_edit_board`) | iOS client → Edge Function | 클라이언트 좌표 신뢰 X — Edge Function이 google_place_id로 좌표 resolve 후 INSERT |
| 핀 bottom sheet UI / interaction | iOS RN (Expo Router) | NativeWind 토큰 | UI-SPEC §"Pin Bottom Sheet" 그대로 구현 |
| 인증 + last_board_id 기록 | Main App (RN) | Supabase Auth + SharedDefaults | 로그인은 supabase-js + AsyncStorage; last_board_id는 App Group으로도 mirror |

---

## Standard Stack

### Core (신규 도입)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-share-intent` | `^6.1.1` | iOS Share Extension target + URL 수신 | Expo SDK 54 호환 라인 = 5.x/6.x; 6.1.1은 2026-05-25 publish, SDK 54 명시 지원 [VERIFIED: npm view expo-share-intent] [CITED: github.com/achorein/expo-share-intent] |
| `@gorhom/bottom-sheet` | `^5.2.14` | 핀 디테일 bottom sheet | reanimated v4 호환 명시 (peer `>=3.16.0 \|\| >=4.0.0-`) [VERIFIED: npm view @gorhom/bottom-sheet]. v5.1.8+이 v4 호환 시점 [CITED: GH issue #2546 thread] |
| `lucide-react-native` | (optional) | 핀 / chevron / close 아이콘 | tree-shakable individual import. UI-SPEC §"Design System" optional 명시 |

### Supporting (이미 설치됨, 추가 사용)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-native-async-storage/async-storage` | `2.2.0` (already) | last_board_id mirror (RN-only fallback), supabase auth session | 이미 supabase 클라이언트가 사용 중 |
| `@supabase/supabase-js` | `^2.45.4` (already) | Realtime broadcast subscribe | `supabase.channel(...).on('broadcast', ...).subscribe()` |
| `expo-linking` | `~8.0.12` (already) | `moajoa://pending` deeplink (D-03) | Share Extension에서 main app open |
| `expo-router` | `~6.0.23` (already) | Stack navigation, modal presentation | + 핀 modal (`presentationStyle='pageSheet'`) |
| `react-native-maps` | `1.20.1` (already) | 지도 + Marker (변경 없음) | onPress event로 bottom sheet trigger |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-share-intent` | `expo-share-extension` (MaxAst) | 더 강력함 (custom React Native UI in Share Extension, Pinterest-style). 그러나 D-01 lock "1탭 즉시 저장 + 토스트"에는 오버스펙 — 풀 RN 번들 load time 부담. expo-share-intent의 기본 UIViewController는 즉시 dismiss 가능 [CITED: github.com/MaxAst/expo-share-extension README] |
| `@gorhom/bottom-sheet` | RN core `Modal` + 수동 gesture | Modal은 snap point 2단계 swipe 직접 구현 필요. v5.1.8+가 reanimated v4 호환되었으므로 굳이 다운그레이드 X [CITED: GH #2592] |
| `react-native-google-places-autocomplete` (FaridSafi) | (안 씀 — 클라이언트가 키 보관) | 클라이언트가 Google Places key를 갖는 모델. CONTEXT.md D-08은 명시적으로 server-side resolve-place Edge Function이라 부적합 |

**Installation (Phase 3 plan에서 실행):**

```bash
cd apps/ios
pnpm add expo-share-intent@^6.1.1 @gorhom/bottom-sheet@^5.2.14
# 선택 (icon이 emoji로 충분하면 skip)
# pnpm add lucide-react-native
```

**Version verification (planner: 첫 task에서 재확인):**

```bash
npm view expo-share-intent version           # → 6.1.1 (publish 2026-05-25)
npm view @gorhom/bottom-sheet version        # → 5.2.14
npm view @gorhom/bottom-sheet peerDependencies.react-native-reanimated  # → ">=3.16.0 || >=4.0.0-"
```

> **pnpm hoist 주의 (Phase 1 D-02 lesson):** apps/ios/.npmrc에 `node-linker=hoisted` 적용됨. 새 native dep도 동일 scope. `react-native-css-interop` 같은 transitive native module이 hoist 안 되면 apps/ios/package.json에 **직접 dep 선언** 패턴 적용 [VERIFIED: apps/ios/package.json line `"react-native-css-interop": "0.2.4"`]. expo-share-intent 추가 후 `pnpm install` → prebuild → CocoaPods install 단계에서 hoist 실패 시 같은 patch.

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ iOS Share Sheet (system)                                                 │
│   ↓ 사용자가 MOAJOA tap                                                   │
│ ┌─────────────────────────┐                                              │
│ │ Share Extension target  │  (native UIViewController via expo-share-    │
│ │   • URL 읽기            │   intent)                                    │
│ │   • SharedDefaults 읽기 │                                              │
│ │     - moajoa_session    │                                              │
│ │     - last_board_id     │                                              │
│ └─────────────────────────┘                                              │
│         │                                                                │
│   ┌─────┴────────────┐                                                   │
│   │                  │                                                   │
│   ▼ unauth/no board  ▼ auth + board                                      │
│  "MOAJOA 앱 열기"   ┌────────────────────────┐                           │
│  pending_links 큐    │ SharedDefaults: append │                          │
│  enqueue            │   pending_links 큐 +   │  (즉시 dismiss)           │
│  + deeplink         │   토스트 표시           │                           │
│                     └────────────────────────┘                          │
│                              │                                          │
│  ╔═══════════════════════════╪═══════════════════════════════════════╗  │
│  ║ App Group SharedDefaults  │ (group.com.serendipitylife.moajoa)    ║  │
│  ║  • pending_links[]        │                                       ║  │
│  ║  • pending_links_failed[] │                                       ║  │
│  ║  • last_board_id          │                                       ║  │
│  ║  • moajoa_session (mirror)│                                       ║  │
│  ╚═══════════════════════════╪═══════════════════════════════════════╝  │
│                              │                                          │
│                              ▼                                          │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Main App (Expo Router)                                              │ │
│ │  RootLayout (_layout.tsx)                                           │ │
│ │   ├─ supabase.auth.getSession() (existing)                          │ │
│ │   ├─ AppState listener — 'active' → drainPendingLinks()             │ │
│ │   └─ on mount → drainPendingLinks() (cold launch)                   │ │
│ │                                                                     │ │
│ │  drainPendingLinks() — lib/pending.ts                               │ │
│ │   ├─ read pending_links from SharedDefaults                         │ │
│ │   ├─ inFlight 가드 (useRef bool)                                    │ │
│ │   ├─ for each: addLink() + triggerExtraction()                      │ │
│ │   ├─ retry_count++ on fail, move to *_failed at >3                  │ │
│ │   └─ write back to SharedDefaults                                   │ │
│ │                                                                     │ │
│ │  boards/[id].tsx                                                    │ │
│ │   ├─ URL add → addLink + triggerExtraction                          │ │
│ │   ├─ subscribe extract:{link_id} broadcast (useEffect+cleanup)      │ │
│ │   │   on 'done' → reload + toast                                    │ │
│ │   │   on 'error' → toast (error mapping table)                      │ │
│ │   ├─ MapView Marker onPress → BottomSheet open                      │ │
│ │   └─ "+ 핀" → modal: text input → debounced resolve-place fetch     │ │
│ │                                                                     │ │
│ │  + 핀 modal                                                         │ │
│ │   └─ debounce 300ms → POST /functions/v1/resolve-place              │ │
│ │       ↓                                                             │ │
│ └───────│─────────────────────────────────────────────────────────────┘ │
│         ▼                                                               │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Supabase                                                            │ │
│ │  • Edge Function `resolve-place` (신규)                             │ │
│ │     - JWT 검증 → Google Places Text Search (maxResultCount=5)       │ │
│ │     - extraction_costs INSERT (link_id=null, provider=google_places)│ │
│ │     - 5개 결과 응답                                                  │ │
│ │  • Edge Function `extract-youtube` (Phase 2 — broadcast sender)     │ │
│ │  • DB places INSERT — RLS can_edit_board() (기존)                   │ │
│ │  • Realtime broadcast — 'extract:{link_id}' channel                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended File Structure (Phase 3 신규/수정)

```
apps/ios/
├── app/
│   ├── _layout.tsx              # 수정: AppState + cold-launch drain hook 마운트
│   ├── index.tsx                # 수정: D-13 복원 — auth gate redirect
│   ├── boards/
│   │   ├── [id].tsx             # 수정: spinner overlay + broadcast subscribe + BottomSheet + "+핀" header
│   │   └── _pin-sheet.tsx       # 신규: PinBottomSheet 컴포넌트
│   ├── _pending.tsx             # 신규(또는 modal route): pending_links board picker
│   └── _failed-board.tsx        # 신규(또는 modal): pending_links_failed 시스템 보드
├── lib/
│   ├── supabase.ts              # 수정: 변경 최소 (이미 AsyncStorage adapter 있음)
│   ├── realtime.ts              # 신규: subscribeExtractProgress({link_id, onProgress, onDone, onError}) helper
│   ├── pending.ts               # 신규: drainPendingLinks(), enqueuePendingLink(), reportFailed()
│   ├── shared-defaults.ts       # 신규: native module bridge (SharedDefaults r/w)
│   └── toast.ts                 # 신규: Toast 단일 인스턴스 (RootLayout가 host)
└── modules/
    └── shared-defaults/          # 신규 native module (Swift) — App Group UserDefaults wrapper
        ├── ios/SharedDefaultsModule.swift
        └── expo-module.config.json

supabase/functions/
└── resolve-place/                # 신규 Edge Function
    ├── deno.json
    ├── index.ts                  # POST {query, lat?, lng?} → 5 results
    └── pipeline/
        └── places-search.ts      # resolveGooglePlaceList() — maxResultCount=5 wrapper

packages/api/src/queries/
└── places.ts                     # 수정: addManualPlace는 그대로, deleteManualPlace + renameManualPlace 추가
```

### Pattern 1: Expo Share Intent — config plugin + appGroup

**What:** Share Extension target은 `expo-share-intent`가 app.config.ts plugin entry로 자동 생성. App Group ID + activation rules 모두 app.json/app.config.ts에서 선언. EAS Build는 `extra.eas.build.experimental.ios.appExtensions[]`에서 entitlement 인지.

**When to use:** 모든 새 iOS Share Extension target — Phase 3 첫 task.

**Example:**

```ts
// apps/ios/app.config.ts (Phase 3 수정)
// Source: github.com/achorein/expo-share-intent README + docs.expo.dev/build-reference/app-extensions
const config: ExpoConfig = {
  // ...existing...
  ios: {
    bundleIdentifier: 'com.serendipitylife.moajoa',
    // ...
    entitlements: {
      'com.apple.security.application-groups': ['group.com.serendipitylife.moajoa'],
    },
  },
  plugins: [
    'expo-router',
    'expo-splash-screen',  // 기존
    'expo-font',           // 기존
    [
      'expo-share-intent',
      {
        iosAppGroupIdentifier: 'group.com.serendipitylife.moajoa',
        iosShareExtensionName: 'MOAJOA 저장',
        iosActivationRules: {
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsWebPageWithMaxCount: 1,
          NSExtensionActivationSupportsText: 1,
        },
        // disableExperimental: false (기본 1탭 즉시 dismiss UIViewController 사용)
      },
    ],
  ],
  extra: {
    // ...existing...
    eas: {
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: 'ShareExtension',
                bundleIdentifier: 'com.serendipitylife.moajoa.ShareExtension',
                entitlements: {
                  'com.apple.security.application-groups': ['group.com.serendipitylife.moajoa'],
                },
              },
            ],
          },
        },
      },
    },
  },
};
```

[CITED: docs.expo.dev/build-reference/app-extensions, github.com/achorein/expo-share-intent README]

### Pattern 2: Broadcast subscribe (useEffect cleanup 엄격)

**What:** Phase 2가 보내는 `extract:{link_id}` 채널을 boards/[id].tsx에서 subscribe. URL 추가 직후 link.id 알면 즉시 subscribe, broadcast 'done' / 'error' 수신 시 cleanup + spinner 해제 + toast.

**When to use:** URL add 직후, 추출 진행 중일 때만. unmount 시 항상 unsubscribe.

**Example:**

```ts
// apps/ios/lib/realtime.ts (신규)
// Source: https://supabase.com/docs/guides/realtime/broadcast + GH discussions/8573
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ExtractProgress {
  step: 'metadata' | 'transcript' | 'llm' | 'places' | 'done' | 'error';
  progress_pct: number;
  places_extracted?: number;
  error?: string;
}

export function subscribeExtractProgress(
  linkId: string,
  onProgress: (p: ExtractProgress) => void,
): RealtimeChannel {
  const channel = supabase
    .channel('extract:' + linkId)
    .on('broadcast', { event: 'progress' }, (msg) => {
      onProgress(msg.payload as ExtractProgress);
    })
    .subscribe();
  return channel;
}
```

```tsx
// apps/ios/app/boards/[id].tsx (수정 — 발췌)
const [analyzing, setAnalyzing] = useState<string | null>(null); // link_id in flight

useEffect(() => {
  if (!analyzing) return;
  const ch = subscribeExtractProgress(analyzing, (p) => {
    if (p.step === 'done') {
      setAnalyzing(null);
      load(); // refresh places
      showToast(`${p.places_extracted ?? 0}개 핀 추가됨`);
    } else if (p.step === 'error') {
      setAnalyzing(null);
      showToast(mapErrorReason(p.error), 'error');
    }
  });
  return () => {
    supabase.removeChannel(ch); // CRITICAL: cleanup
  };
}, [analyzing]);
```

[CITED: supabase.com/docs/guides/realtime/broadcast, github.com/orgs/supabase/discussions/8573]

### Pattern 3: AppState drain — both cold launch and foreground

**What:** D-04에 따라 두 trigger에서 모두 drain 호출. 중복 호출 방어는 `useRef<boolean>` in-flight flag.

**When to use:** App root layout `_layout.tsx`. 다른 화면에서는 mount X.

**Example:**

```tsx
// apps/ios/app/_layout.tsx (수정 — drain 추가)
// Source: react-native AppState docs + facebook/react-native#34508
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { drainPendingLinks } from '@/lib/pending';
// ...existing imports...

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const inFlight = useRef(false);

  const runDrain = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await drainPendingLinks();
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    runDrain(); // cold launch

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') runDrain();
    });
    return () => {
      sub.remove(); // wrap to preserve emitter (#34508)
    };
  }, [ready]);

  if (!ready) return null;
  // ...existing return...
}
```

[CITED: blog.iampato.me/mastering-react-native-app-states, github.com/facebook/react-native/issues/34508]

### Pattern 4: Native module bridge for App Group SharedDefaults

**What:** Swift 모듈이 `UserDefaults(suiteName: "group.com.serendipitylife.moajoa")`을 wrap. JS side에서 string key r/w (JSON 직렬화는 JS layer에서).

**When to use:** `pending_links`, `pending_links_failed`, `last_board_id`, `moajoa_session` 모두 같은 모듈.

**Example:**

```swift
// apps/ios/modules/shared-defaults/ios/SharedDefaultsModule.swift (신규)
// Source: dev.to/cross19xx/ios-app-intents-in-an-expo-app + apple developer UserDefaults docs
import ExpoModulesCore

public class SharedDefaultsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SharedDefaults")

    Function("getString") { (suiteName: String, key: String) -> String? in
      return UserDefaults(suiteName: suiteName)?.string(forKey: key)
    }
    Function("setString") { (suiteName: String, key: String, value: String) -> Void in
      UserDefaults(suiteName: suiteName)?.set(value, forKey: key)
    }
    Function("remove") { (suiteName: String, key: String) -> Void in
      UserDefaults(suiteName: suiteName)?.removeObject(forKey: key)
    }
  }
}
```

```ts
// apps/ios/lib/shared-defaults.ts (신규)
import { requireNativeModule } from 'expo';
const Native = requireNativeModule('SharedDefaults');

const APP_GROUP = 'group.com.serendipitylife.moajoa';

export const SharedDefaults = {
  get<T>(key: string): T | null {
    const raw = Native.getString(APP_GROUP, key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  set<T>(key: string, value: T): void {
    Native.setString(APP_GROUP, key, JSON.stringify(value));
  },
  remove(key: string): void {
    Native.remove(APP_GROUP, key);
  },
};
```

> **Alternative:** `expo-share-intent`가 내부적으로 SharedDefaults 헬퍼를 노출하면 native module 신규 작성 X. **researcher 미확인** — Phase 3 첫 task에서 `node_modules/expo-share-intent/ios/` 안의 SharedDefaults 헬퍼 export 여부 grep. 노출되면 그것을 wrap, 아니면 위 native module 작성. [ASSUMED: 노출 안 됨 — README에 명시적 export 언급 없음]

### Pattern 5: resolve-place Edge Function (extract-youtube와 동일 패턴)

**What:** `query` 받아 Google Places Text Search 호출, 최대 5개 결과 반환. extraction_costs에 `link_id=null` row 기록.

**When to use:** + 핀 modal에서 debounce된 검색 input마다.

**Example:**

```ts
// supabase/functions/resolve-place/index.ts (신규 — extract-youtube/index.ts 패턴 차용)
// Source: existing supabase/functions/extract-youtube/index.ts + pipeline/places.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const RequestSchema = z.object({
  query: z.string().min(1).max(200),
  lat: z.number().optional(),
  lng: z.number().optional(),
  language: z.string().default('ko'),
});

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
].join(',');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return new Response('invalid body', { status: 400 });

  const placesKey = Deno.env.get('GOOGLE_PLACES_SERVER_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const t0 = performance.now();
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': placesKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: parsed.data.query,
      languageCode: parsed.data.language,
      maxResultCount: 5, // D-07 max 5
      ...(parsed.data.lat && parsed.data.lng ? {
        locationBias: {
          circle: { center: { latitude: parsed.data.lat, longitude: parsed.data.lng }, radius: 50000 }
        }
      } : {}),
    }),
  });
  const duration_ms = Math.round(performance.now() - t0);
  if (!res.ok) return new Response('places api failed', { status: 502 });

  const data = await res.json();
  const places = (data?.places ?? []).map((p: any) => ({
    google_place_id: p.id,
    displayName: p.displayName?.text ?? '',
    formattedAddress: p.formattedAddress ?? null,
    location: { lat: p.location?.latitude, lng: p.location?.longitude },
    primaryType: p.primaryType ?? null,
  }));

  // Phase 2 D-09 패턴: extraction_costs 1행 (link_id null)
  await admin.from('extraction_costs').insert({
    link_id: null, // null = standalone manual search
    provider: 'google_places',
    model: 'text-search',
    cost_usd: 0.032,
    duration_ms,
  }).catch((e) => console.warn('[cost-log] failed:', e));

  return new Response(JSON.stringify({ places }), {
    headers: { 'content-type': 'application/json' },
  });
});
```

> **Migration 변경 필요:** `extraction_costs.link_id` 컬럼이 `not null` constraint이면 (0004 마이그레이션 명시) 새 마이그레이션 0005에서 NULL 허용으로 변경 필요. **VERIFY:** `cat supabase/migrations/0004_extraction_hardening.sql` 결과 `link_id uuid not null references links(id) on delete cascade` → **NULL 허용 변경 필요** [VERIFIED via Read of 0004]. 또는 link_id를 optional column으로 두지 않고 `provider` enum에 'google_places_search' 추가 + 별도 `manual_searches` 테이블. **planner가 결정 (Claude's discretion)** — 가장 간단한 길은 0005에서 `alter table extraction_costs alter column link_id drop not null`.

[CITED: existing supabase/functions/extract-youtube/pipeline/places.ts, 0004_extraction_hardening.sql]

### Anti-Patterns to Avoid

- **Subscribe 후 cleanup 누락:** `useEffect` return 없이 `supabase.channel(...).subscribe()` 만 호출 → 매 reload마다 listener leak [CITED: GH supabase discussions/8573]
- **AppState 'remove' cleanup 누락:** `AppState.addEventListener` 반환 ignore → 컴포넌트 unmount 후에도 drain 호출. RootLayout가 unmount는 거의 없지만 hot reload 시 위험 [CITED: GH facebook/react-native#34508]
- **Share Extension에서 supabase-js 직접 사용:** Share Extension은 별도 process — supabase-js 번들 무거움 + auth refresh 안 됨. SharedDefaults enqueue만 하고 본격 작업은 main app에서.
- **클라이언트가 places.lat/lng 직접 INSERT:** RLS는 통과하지만 google_place_id 신뢰도 깨짐. 항상 Edge Function (`resolve-place`) 통해 좌표 resolve.
- **broadcast progress UI에 5단계 raw 노출:** D-10 lock — Phase 3는 spinner + done/error만. 5단계 메시지는 Phase 5.
- **`.js` extension on workspace imports:** `import { addLink } from '@moajoa/api'` ✓, `from '@moajoa/api.js'` ✗ [CITED: CLAUDE.md §4.5].

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS Share Extension target 생성 + entitlement 동기화 | 수동 Xcode target 추가 + Podfile patch | `expo-share-intent` config plugin | prebuild 매번 native dir 재생성 — 수동 수정 손실됨. config plugin이 CNG 호환 [CITED: docs.expo.dev/workflow/continuous-native-generation] |
| App Group UserDefaults JS bridge | NativeModules.RCTBridge 수동 | Expo Module API (`requireNativeModule`) | Expo SDK 54 표준 패턴. expo prebuild가 expo-module.config.json 인식 |
| Bottom sheet snap + gesture | Modal + Animated.spring 수동 | `@gorhom/bottom-sheet@5.2.14` | snap point, backdrop, keyboard avoidance 다 built-in. reanimated v4 호환 [VERIFIED: npm peer] |
| Places search debounce + cancel | useState + setTimeout 직접 | `useEffect` + setTimeout return cleanup 패턴 | 표준 React 패턴. 별도 라이브러리 불필요 |
| Realtime broadcast channel lifecycle | 직접 WebSocket 관리 | `supabase.channel(...).subscribe()` | Phase 2가 이미 사용 — 같은 client로 receiver만 |
| 디바운스 검색 표시 + loading 상태 | redux/store | 컴포넌트 local state (`useState`) | + 핀 modal 한 화면짜리 — store 도입 X (Karpathy §3.2) |
| Toast UI | react-native-toast-message 등 외부 | RootLayout에 단일 인스턴스 컴포넌트 | UI-SPEC §"Toast" 단일 인스턴스, 큐 X. 외부 라이브러리는 NativeWind 호환 issue 가능 |

**Key insight:** Share Extension + App Group은 native iOS 영역이라 hand-roll 함정이 가장 큰 영역. config plugin + Expo Module API 표준에 100% 따른다. broadcast subscribe / debounce / drain은 RN/JS 표준 패턴이라 외부 라이브러리 도입 비용이 더 큼.

---

## Runtime State Inventory

(Phase 3은 신규 도입 phase — 기존 runtime state는 거의 없음. 그러나 Share Extension target 도입은 prebuild 산출물에 영향.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | (DB) extraction_costs.link_id `not null` constraint — resolve-place의 manual search row가 link_id 없음 | Migration 0005에서 `alter column link_id drop not null` 또는 별도 테이블 — planner 결정 |
| **Stored data** | (DB) places.source_kind default 'ai' — 수동 INSERT 시 'manual' 명시 필요 | Edge Function 또는 add_manual_place RPC가 'manual' 강제 setting (코드 영역, 마이그레이션 X) |
| **Live service config** | (Supabase Dashboard) Edge Function deploy 목록 — resolve-place 추가 시 `supabase functions deploy resolve-place` 필요, secret `GOOGLE_PLACES_SERVER_KEY` 이미 set (Phase 2가 set) | Deploy + secrets verify (`supabase secrets list`) |
| **Live service config** | (Supabase Realtime) channel `extract:{link_id}`는 Phase 2가 이미 사용 — Phase 3는 새 채널 X | (변경 없음) |
| **OS-registered state** | iOS Share Extension target은 prebuild 매번 재생성. `apps/ios/ios/` 디렉토리 dirty 상태로 commit X (gitignore) | `.gitignore` 확인 — `apps/ios/ios/` 이미 무시되는지 verify (Phase 1 결정사항). 무시되어야 정상 — config plugin 기반 재현성 |
| **OS-registered state** | Apple Developer Portal: App ID `com.serendipitylife.moajoa` + Share Extension App ID `com.serendipitylife.moajoa.ShareExtension` + App Group `group.com.serendipitylife.moajoa` 등록 | EAS Build 사용 시 자동 동기화 [CITED: docs.expo.dev/build-reference/ios-capabilities]. local prebuild 사용 시 Xcode에서 capability 추가 — 1회성 작업. STATE.md "App Group identifier 최종 — Phase 3 prebuild 전" Open Question lock 시점 |
| **Secrets/env vars** | (Supabase) `GOOGLE_PLACES_SERVER_KEY` — 이미 Phase 2가 사용. resolve-place도 같은 키 | (변경 없음 — `supabase secrets list`로 verify) |
| **Secrets/env vars** | (iOS) `googleMapsApiKey` (app.config.ts) — Phase 6 평가 후 도입 (STATE.md Open Question) | Phase 3는 Apple Maps default (변경 없음) |
| **Build artifacts / installed packages** | `apps/ios/ios/Pods/`, `apps/ios/ios/build/` — expo-share-intent CocoaPods 추가 후 stale. prebuild + pod install 재실행 필요 | `pnpm --filter @moajoa/ios prebuild` 후 `cd apps/ios/ios && pod install` |
| **Build artifacts / installed packages** | `node_modules/expo-share-intent/` — 신규 install | `pnpm install` |
| **OS-registered state** | iOS deeplink scheme `moajoa://` — 이미 `app.config.ts` `scheme: 'moajoa'` 설정 [VERIFIED: app.config.ts read] | (변경 없음 — D-03 `moajoa://pending` route만 expo-router에 추가) |

**Nothing found in category (verified):**
- 다른 RN screen에서 broadcast subscribe — Phase 3가 첫 도입 (Phase 2는 sender만)
- AppState listener — RootLayout에 처음 도입 (현재 없음 [VERIFIED via Read of _layout.tsx])
- App Group entitlement — 현재 entitlements 비어 있음 (Phase 1은 도입 X — [CITED: 01-CONTEXT D-16])

---

## Common Pitfalls

### Pitfall 1: Share Extension에서 main app 번들 load 시도

**What goes wrong:** 어떤 개발자는 Share Extension 안에서 supabase-js를 직접 호출해 즉시 DB INSERT를 시도. 결과: 번들 100+kB, 첫 launch latency 1초+, auth refresh 토큰 동기화 깨짐.
**Why it happens:** "1탭 = DB 저장"이라는 단어 의미를 글자 그대로 해석.
**How to avoid:** Share Extension은 **SharedDefaults enqueue + 토스트** 만. 실 DB 저장은 메인 앱이 drain (D-04). expo-share-intent의 기본 UIViewController는 의도적으로 최소 동작 — 그 디자인을 따른다.
**Warning signs:** Share Extension target의 .swift 파일에 `import Supabase` 또는 fetch 호출이 보이면 빨간 깃발.

### Pitfall 2: App Group ID mismatch (Share Extension vs main app)

**What goes wrong:** entitlements 파일과 plugin 옵션의 App Group ID가 다르면 SharedDefaults는 silent하게 nil 반환. 에러 없음. share 후 메인 앱 launch 시 pending_links 0개.
**Why it happens:** prebuild + EAS appExtensions + plugin option 세 군데에 같은 string을 직접 입력해야 함 — typo 또는 변수화 누락.
**How to avoke:** **`group.com.serendipitylife.moajoa`를 app.config.ts 최상단 상수로 추출** 후 모든 곳에서 참조. 첫 plan task에 "App Group ID 단일 상수 추출" 명시 [CITED: dev.to/cross19xx App Group must match exactly between entitlement, UserDefaults(suiteName:), SharedDataStore].
**Warning signs:** Share 후 main app `last_board_id` `null`. 확인 명령: 실기기에서 share → main app 열기 → console에 `SharedDefaults.get('last_board_id')` log.

### Pitfall 3: @gorhom/bottom-sheet + NativeWind className 미적용

**What goes wrong:** `<BottomSheetView className="bg-white">` 가 무시되어 디폴트 흰 배경이 나오지만 동작이 다른 OS layer라 silent fail [CITED: GH gorhom/react-native-bottom-sheet/issues/1809].
**Why it happens:** BottomSheetView가 reanimated `Animated.View` wrap 형태인데 NativeWind 4.x가 일부 Animated 컴포넌트에서 className → style transform을 적용하지 않을 수 있음 [CITED: software-mansion/react-native-reanimated/issues/8329 — NativeWind 4.1.1 + reanimated 4 issue].
**How to avoid:** BottomSheetView 직접 styling 대신 **inner `<View className="...">`** 패턴 사용. 또는 `style={{ backgroundColor: '#fff' }}` 명시.
**Warning signs:** Bottom sheet 안 background 색 적용 안 됨. 1차 PR에서 시각 verify 필수.

### Pitfall 4: AppState listener cleanup return 형태 오류

**What goes wrong:** `return subscription.remove` (direct ref) → "undefined is not an object (evaluating emitter)" crash on cleanup [CITED: facebook/react-native#34508].
**Why it happens:** `.remove`을 unbound function ref로 넘기면 `this` 컨텍스트 손실.
**How to avoid:** `return () => subscription.remove();` (arrow wrap) — `Pattern 3` 예시 참고.
**Warning signs:** Hot reload 시 crash, 또는 unmount 시점 stack trace에 "emitter undefined".

### Pitfall 5: broadcast subscribe 후 link.id 변경 시 cleanup 누락

**What goes wrong:** URL 두 개 연속 추가 → 두 link.id 각각 subscribe → 첫 채널 cleanup 안 되면 첫 link의 'done' 토스트가 두 번째 link 끝난 후에도 발사.
**Why it happens:** `useEffect` deps에 `analyzing` (link_id) 넣지 않음 또는 cleanup 누락.
**How to avoid:** `useEffect(() => { ...; return () => supabase.removeChannel(ch); }, [analyzing])` — deps 정확히 한정. Pattern 2 예시 참고. **이 phase에서는 한 번에 한 추출만** 가정으로 단순화 (멀티 동시는 v2).
**Warning signs:** Toast가 엉뚱한 메시지 또는 두 번 발사.

### Pitfall 6: Places API Text Search FieldMask 와일드카드

**What goes wrong:** `X-Goog-FieldMask: *` → 비용 5배 + Phase 2 D-12 lock 위반.
**Why it happens:** Edge Function 신규 작성 시 기존 places.ts 패턴 참조 안 하고 example을 그대로 복사.
**How to avoid:** **새 Edge Function은 반드시 `pipeline/places.ts`의 `FIELD_MASK` 상수를 똑같이 사용**. Phase 2 D-12 verification grep을 phase 3 verify에도 추가:

```bash
grep -rn "X-Goog-FieldMask" supabase/functions/ | grep -v "places.id"  # 결과 0이어야 함
```

[CITED: existing supabase/functions/extract-youtube/pipeline/places.ts:29-35]

### Pitfall 7: pending_links retry storm

**What goes wrong:** 네트워크 5초 timeout → retry 3회 = 15초 + 추가 시도 → 같은 sec에 동일 URL 5번 INSERT 시도. links 테이블에 중복.
**Why it happens:** retry_count++ 만 하고 `queued_at` + `retry_after` 계산 안 함.
**How to avoid:** drain 한 turn은 **각 entry당 정확히 1회만** addLink 시도. 실패 시 retry_count++ 후 SharedDefaults에 즉시 write back, 그 entry는 같은 drain turn에서 재시도 X. 다음 drain trigger (AppState 'active' 또는 cold launch) 때 다시 시도.
**Warning signs:** links 테이블에 같은 url이 N개. 빨간 깃발 = `select url, count(*) from links group by url having count(*) > 1`.

### Pitfall 8: expo-share-intent prebuild 후 Pods missing

**What goes wrong:** plugin 추가 후 prebuild 했으나 `pod install` 누락 → Xcode build 시 "module not found" [CITED: Phase 1 D-02 lesson 유사 패턴].
**Why it happens:** prebuild는 Pods install을 매번 자동 실행하지 않음 (Expo SDK 54 기본 동작 변경됨).
**How to avoid:** Phase 3 첫 빌드 task의 순서:

```bash
pnpm install                                    # node_modules 동기화
pnpm --filter @moajoa/ios prebuild --clean      # native dir 재생성
cd apps/ios/ios && pod install                  # CocoaPods 동기화
cd .. && pnpm ios                               # build + install
```

**Warning signs:** "module 'ExpoShareIntent' not found" Xcode 빌드 에러.

### Pitfall 9: extraction_costs.link_id NOT NULL constraint

**What goes wrong:** resolve-place가 manual search cost를 INSERT 시도 → `null value in column "link_id" violates not-null constraint`. Function 응답은 200 OK지만 cost 로깅 silent fail (catch).
**Why it happens:** 0004 마이그레이션이 `link_id uuid not null references links(id)` 명시 [VERIFIED].
**How to avoid:** Migration 0005에서 `alter table extraction_costs alter column link_id drop not null;` — Phase 2 D-09 의도가 "API 호출 단위 1행"이지 "link 단위 cost만"이 아니므로 합리적 확장. 또는 manual search는 별도 `manual_search_costs` 테이블 — 더 깨끗하지만 마이그레이션 2개 ↑.
**Warning signs:** resolve-place 호출 후 `select * from extraction_costs where provider='google_places'` 행 수가 늘지 않음.

### Pitfall 10: Share Extension auth 토큰 만료

**What goes wrong:** 사용자가 main app에서 1주일 전 로그인 → access token 만료 → Share Extension은 SharedDefaults에 mirror된 token으로 user_id 추측 → DB INSERT 시 refresh 안 됨.
**Why it happens:** Share Extension은 supabase-js를 안 쓰는 게 좋다(Pitfall 1). 그러면 user_id를 어떻게 알아? → **SharedDefaults에 user_id (또는 last_session_user_id) 만 mirror**. Token refresh는 main app drain 시 supabase-js가 처리.
**How to avoid:** D-02/D-05대로 board_id + URL만 enqueue. drain 시 main app의 살아 있는 session으로 INSERT. Share Extension은 user_id조차 알 필요 없음 — `last_board_id` + auth status (boolean) 만으로 충분.
**Warning signs:** Share Extension code에 `Authorization: Bearer ...` 보이면 빨간 깃발.

---

## Code Examples

### Common Operation 1: drainPendingLinks

```ts
// apps/ios/lib/pending.ts
// Source: D-04/D-05/D-06 + existing addLink/triggerExtraction in @moajoa/api
import { addLink, triggerExtraction } from '@moajoa/api';
import { supabase } from './supabase';
import { SharedDefaults } from './shared-defaults';

interface Pending {
  url: string;
  board_id: string | null;
  queued_at: string; // ISO
  retry_count: number;
}

interface FailedPending extends Pending {
  failed_at: string;
  reason: 'network' | 'auth' | 'api' | 'unknown';
}

const KEY = 'pending_links';
const KEY_FAILED = 'pending_links_failed';

export async function enqueuePendingLink(url: string, boardId: string | null): Promise<void> {
  const queue = SharedDefaults.get<Pending[]>(KEY) ?? [];
  queue.push({ url, board_id: boardId, queued_at: new Date().toISOString(), retry_count: 0 });
  SharedDefaults.set(KEY, queue);
}

export async function drainPendingLinks(): Promise<{ ok: number; failed: number }> {
  const queue = SharedDefaults.get<Pending[]>(KEY) ?? [];
  if (queue.length === 0) return { ok: 0, failed: 0 };

  const stillPending: Pending[] = [];
  const failedAccum: FailedPending[] = [];
  let ok = 0;

  for (const item of queue) {
    if (!item.board_id) {
      // D-03 case: board picker route handle. Keep in queue, surface to UI.
      stillPending.push(item);
      continue;
    }
    try {
      const link = await addLink(supabase, { board_id: item.board_id, url: item.url });
      if (link.source_kind === 'youtube') {
        triggerExtraction(supabase, link.id).catch(console.warn);
      }
      ok++;
    } catch (e) {
      const next = { ...item, retry_count: item.retry_count + 1 };
      if (next.retry_count > 3) {
        failedAccum.push({
          ...next,
          failed_at: new Date().toISOString(),
          reason: classifyError(e),
        });
      } else {
        stillPending.push(next);
      }
    }
  }

  SharedDefaults.set(KEY, stillPending);
  if (failedAccum.length > 0) {
    const prevFailed = SharedDefaults.get<FailedPending[]>(KEY_FAILED) ?? [];
    SharedDefaults.set(KEY_FAILED, [...prevFailed, ...failedAccum]);
  }

  return { ok, failed: failedAccum.length };
}

function classifyError(e: unknown): FailedPending['reason'] {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  if (msg.includes('network') || msg.includes('fetch')) return 'network';
  if (msg.includes('unauthorized') || msg.includes('jwt')) return 'auth';
  if (msg.includes('places') || msg.includes('extraction')) return 'api';
  return 'unknown';
}
```

### Common Operation 2: Bottom sheet pin detail

```tsx
// apps/ios/app/boards/_pin-sheet.tsx (신규 — UI-SPEC §"Pin Bottom Sheet" 그대로)
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useRef, useEffect } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import type { Place } from '@moajoa/core';
import { hidePlace } from '@moajoa/api';
import { supabase } from '@/lib/supabase';

interface Props {
  place: Place | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function PinBottomSheet({ place, onClose, onDeleted }: Props) {
  const ref = useRef<BottomSheet>(null);

  useEffect(() => {
    if (place) ref.current?.snapToIndex(0);
    else ref.current?.close();
  }, [place]);

  if (!place) return null;

  const isAI = place.link_id !== null; // AI 핀 판별 (source_kind 별도면 그것 사용)

  async function onDelete() {
    Alert.alert('핀 삭제', '정말 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await hidePlace(supabase, place!.id);
          onDeleted();
          onClose();
        },
      },
    ]);
  }

  return (
    <BottomSheet ref={ref} snapPoints={['25%', '50%']} enablePanDownToClose onClose={onClose}>
      <BottomSheetView>
        <View className="px-6 pt-2 pb-6 bg-white">
          <Text className="text-lg font-semibold text-neutral-900 mt-3">{place.name_local}</Text>
          <Text className="text-sm text-neutral-600 mt-1">
            {place.address ?? place.name_ko ?? ''}
          </Text>
          <View className="self-start mt-2 px-1.5 py-0.5 rounded-md bg-neutral-100">
            <Text className="text-sm text-neutral-700">{isAI ? 'AI' : '수동'}</Text>
          </View>

          <Pressable className="bg-neutral-100 px-4 py-3 rounded-lg mt-4">
            <Text className="text-base text-neutral-800 text-center">이름 수정</Text>
          </Pressable>

          {isAI && (
            <Pressable
              className="bg-neutral-100 px-4 py-3 rounded-lg mt-2"
              onPress={() => Linking.openURL(/* youtube?t= */ '')}
            >
              <Text className="text-base text-neutral-800 text-center">영상에서 위치 보기</Text>
            </Pressable>
          )}

          <Pressable className="bg-white border border-danger px-4 py-3 rounded-lg mt-2" onPress={onDelete}>
            <Text className="text-base text-danger text-center">삭제</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
```

[CITED: gorhom.dev/react-native-bottom-sheet/ + UI-SPEC §"Pin Bottom Sheet"]

### Common Operation 3: + 핀 modal with debounced search

```tsx
// apps/ios/app/boards/_pin-add-modal.tsx (발췌)
const [q, setQ] = useState('');
const [results, setResults] = useState<ResolvedPlace[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  if (q.trim().length < 2) {
    setResults([]);
    return;
  }
  const t = setTimeout(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('resolve-place', {
        body: { query: q.trim(), language: 'ko' },
      });
      setResults(data?.places ?? []);
    } finally {
      setLoading(false);
    }
  }, 300); // D-08 debounce
  return () => clearTimeout(t);
}, [q]);
```

[CITED: docs.swmansion.com debounce + UI-SPEC §"+ 핀 Manual Add Modal"]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AppState.removeEventListener('change', cb)` | `const sub = AppState.addEventListener(...); sub.remove()` | RN 0.65+ | useEffect cleanup 표준 |
| Bottom sheet manual gesture | `@gorhom/bottom-sheet` v5 with snap points | v5.1.8+ (reanimated v4 호환) | 손수 작성 불필요 |
| Google Places Autocomplete API | Places API (New) **Text Search** v1 with FieldMask | Phase 2가 이미 New API 사용 [VERIFIED: places.ts] | Wildcard `*` 폐기 |
| `RCTBridge` Native Module | Expo Module API (`requireNativeModule`) | Expo SDK 47+ | TS 친화, expo-module.config.json 표준 |
| `expo-share-intent` 4.x | 6.1.1 (SDK 54 supported) | 2026-05-25 publish | SDK 54 호환 [VERIFIED: npm view] |

**Deprecated/outdated:**
- React Native `AppState.removeEventListener` — RN 0.65+ 부터 deprecated, 0.81에서는 함수 자체 제거됨 [CITED: blog.iampato.me/mastering-react-native-app-states].
- `add_manual_place` RPC의 client-supplied lat/lng — CONTEXT.md D-08이 resolve-place Edge Function이 좌표 server-side resolve. 기존 RPC signature는 유지하되 호출 시 lat/lng를 Edge Function 응답에서 받은 값만 전달.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Phase 3 Application |
|------------|---------------------|
| §4.5 NO `.js` extension on workspace imports | `import { addLink } from '@moajoa/api'` (✓), never `'@moajoa/api.js'` (✗) |
| §4.3 마이그레이션 append-only | 새 migration `0005_*.sql` 추가 (extraction_costs.link_id NULL 허용). 0004 수정 금지 |
| §4.4 service role은 Edge Function 안에서만 | resolve-place는 service role로 admin client 사용, 클라이언트는 anon key + Authorization JWT |
| §4.4 RLS deny-by-default + SECURITY DEFINER 헬퍼 | places INSERT 정책 `can_edit_board()` 이미 사용 — 추가 작업 X. add_manual_place RPC는 `can_edit_board(p_board_id)` 직접 호출 (security invoker — RLS 우회 X) [VERIFIED: 0001_init.sql L558-606] |
| §5 새 보드 생성·링크 추가 UI는 iOS 전용 (web에 신규 X) | 본 phase는 iOS만 — 위반 risk 없음 |
| §5 `.env.local` 커밋 금지 | Edge Function secrets는 `supabase secrets set`로만 |
| §3.2 Simplicity First | UI-SPEC이 5 신규 컴포넌트 명시 — 그 5개만. extra abstraction 금지 (예: Toast queue 등) |
| §3.3 Surgical Changes | boards/[id].tsx 수정 시 기존 코드 80% 유지. extraction overlay와 BottomSheet trigger만 추가 |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | local dev | ✓ (assumed — Phase 1 통과) | ≥18 | — |
| pnpm | monorepo | ✓ (assumed — Phase 1 통과) | latest | — |
| Xcode | local prebuild + Share Extension | ✓ (Phase 1 D-01에서 local A 통과) | 16+ | EAS Build (Phase 1 D-01 fallback) |
| CocoaPods | iOS native deps | ✓ (Phase 1 D-02 + locale 이슈 회피 lesson 적용) | latest | EAS Build |
| Apple Developer Account | App Group capability 등록 | ✓ ($99/yr 가입됨 — STATE.md Blockers section) | — | — |
| EAS CLI | `extra.eas.build...` 인지 | ✓ (assumed — Phase 1 EAS fallback profile 'development' 명시 [01 D-03]) | latest | local prebuild |
| Supabase CLI | Edge Function deploy + secrets | ✓ (assumed — Phase 2가 사용) | latest | Dashboard 수동 |
| `GOOGLE_PLACES_SERVER_KEY` | resolve-place | ✓ (Phase 2가 이미 set) | — | — |
| `GOOGLE_MAPS_IOS_KEY` | iOS Google Maps tiles | ✗ (STATE.md Open Question — Phase 6 평가 후) | — | Apple Maps default (react-native-maps `provider={undefined}`) — Phase 3는 fallback 충분 |
| Real iPhone device | Share Extension 검증 (시뮬은 불가) | ✓ (Phase 1 실기기 통과) | — | — (Share Extension은 시뮬레이터 동작 안 정확) |

**Missing dependencies with no fallback:** 없음.

**Missing dependencies with fallback:** Google Maps iOS Key 없음 → Apple Maps 사용 (이미 [id].tsx 동작 중).

---

## Validation Architecture

> `workflow.nyquist_validation` = true ([VERIFIED: .planning/config.json]). 이 섹션 포함.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **현재 RN 테스트 인프라 없음** — apps/ios/에 test config / test dir 없음 [VERIFIED: ls apps/ios/] |
| Config file | 없음 — Wave 0에서 도입 결정 또는 manual-only verification |
| Quick run command | (Wave 0 결정) |
| Full suite command | (Wave 0 결정) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAVE-01 | 로그인 → 보드 목록 → 상세 진입 | **manual-only (실기기)** | `pnpm --filter @moajoa/ios ios` + 수동 로그인 | manual UAT |
| SAVE-02 | URL → 30초 안에 핀 (p90) | **unit (broadcast subscribe handler)** + **manual e2e** | `pnpm --filter @moajoa/ios test:unit -- realtime.test.ts` | ❌ Wave 0 |
| SAVE-02 (p90 측정) | 30초 검증 | **SQL aggregate (Phase 6에서 실 데이터)** | psql / supabase studio query | ❌ (Phase 6) |
| SAVE-03 | Share sheet → 1탭 저장 | **manual-only (Share Extension는 시뮬 불완전)** | 실기기 카톡/사파리 share | manual UAT |
| SAVE-04 | offline enqueue + drain | **unit (drainPendingLinks 로직)** + **manual airplane mode test** | `pnpm --filter @moajoa/ios test:unit -- pending.test.ts` | ❌ Wave 0 |
| SAVE-05 (수동 핀) | + 핀 modal → resolve-place → DB INSERT | **integration (resolve-place Edge Function curl)** + **manual UI** | `deno test supabase/functions/resolve-place/test.ts` | ❌ Wave 0 |
| SAVE-05 (RLS) | non-member가 수동 핀 추가 시도 거부 | **integration (DB)** | psql + supabase migration test | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** typecheck (`pnpm --filter @moajoa/ios typecheck`) + ESLint. RN 단위 테스트는 도입 시 추가
- **Per wave merge:** Edge Function deploy + manual real-device smoke test
- **Phase gate:** 실기기에서 SAVE-01~05 manual UAT 5건 모두 PASS (이 phase의 핵심 — 자동화 가능한 부분은 unit로, 나머지는 명시적 manual UAT 시나리오 문서화)

### Wave 0 Gaps

- [ ] `apps/ios/jest.config.js` — Jest config (RN preset) **또는** Vitest config — planner 결정 (preferred: @testing-library/react-native + jest + babel-jest)
- [ ] `apps/ios/__tests__/realtime.test.ts` — covers SAVE-02 broadcast handler mock
- [ ] `apps/ios/__tests__/pending.test.ts` — covers SAVE-04 drain 로직 (SharedDefaults mock)
- [ ] `supabase/functions/resolve-place/test.ts` — covers SAVE-05 Edge Function (Deno test)
- [ ] `apps/ios/__tests__/__mocks__/shared-defaults.ts` — JS-side mock for native module
- [ ] `docs/manual-uat-phase3.md` — 실기기 UAT 시나리오 5건 (SAVE-01~05) 체크리스트
- [ ] Framework install: `pnpm --filter @moajoa/ios add -D jest jest-expo @testing-library/react-native @testing-library/jest-native`

**Note:** RN 자동 테스트 인프라는 본 phase가 첫 도입. Karpathy §3.2 "no abstractions for single-use code" 원칙에 따라 **얇게**: drain 로직 unit + Edge Function integration 둘만. UI는 manual UAT. 인프라 확장은 Phase 5 trust UI에서 재평가.

---

## Security Domain

> `security_enforcement` config 키 부재 — default = enabled. 포함.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | supabase-js + AsyncStorage session persistence (existing). Share Extension은 supabase-js 사용 X — auth 토큰은 main app만 |
| V3 Session Management | yes | Supabase JWT refresh (auto by supabase-js). Share Extension은 enqueue만 — token 무관 |
| V4 Access Control | yes | RLS `can_edit_board()` (places INSERT/UPDATE/DELETE), `can_read_board()` (SELECT). manual 핀도 같은 정책 |
| V5 Input Validation | yes | Zod (`PlaceAddManualSchema`, `LinkAddSchema`). resolve-place Edge Function도 Zod로 RequestSchema validate (Pattern 5 예시) |
| V6 Cryptography | no | 직접 암호화 없음 — 모두 Supabase/HTTPS |

### Known Threat Patterns for Phase 3 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Share Extension에 다른 앱이 임의 데이터 주입 | Tampering | App Group은 같은 team의 앱만 access 가능 (Apple sandbox). + 메인 앱은 enqueue 데이터에 Zod validate |
| Pending queue에 악성 URL 누적 | Repudiation/DoS | retry > 3 시 failed queue 이동 (D-06) + UI 노출 — 사용자가 인지 |
| resolve-place에서 Google API key 노출 | Information Disclosure | Edge Function 안에서만 사용 — 클라이언트 절대 X (Phase 2 D-12 lock 연장) |
| extraction_costs.cost_usd manipulation | Tampering | Edge Function service role만 INSERT (RLS deny-by-default) [VERIFIED: 0004 migration "No permissive policies"] |
| non-member가 수동 핀 추가 | Elevation of Privilege | `can_edit_board()` SECURITY DEFINER 헬퍼 (기존). + `add_manual_place` RPC가 `security invoker` + `if not can_edit_board(p_board_id) raise` |
| deeplink (`moajoa://pending`) hijacking | Spoofing | iOS deeplink scheme은 first-registered wins. App Store 외부 install은 자동 reject. + main app route는 `pending_links` 파싱 시 Zod 검증 |
| broadcast channel snooping | Information Disclosure | Supabase Realtime broadcast는 채널명 알면 누구나 subscribe — 그러나 link_id는 UUID라 추측 불가. 추가로 broadcast payload에 secret 없음 (step/progress_pct만) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | expo-share-intent의 SharedDefaults 헬퍼가 외부 노출되지 않음 (자체 native module 필요) | Pattern 4 | 자체 SharedDefaultsModule 작성 시간 1~2일 절약 기회 손실 — risk 낮음 |
| A2 | iOS Share Extension의 default UIViewController가 1초 이내 dismiss 가능 (D-01 1탭 토스트 충족) | §Pitfall 1, UI-SPEC §"Share Extension" | UX 미흡 — UIViewController가 무거우면 expo-share-extension(MaxAst) 도입 필요 |
| A3 | `extraction_costs.link_id` NOT NULL 제약을 0005 migration에서 NULL 허용으로 풀 수 있음 (기존 인덱스 영향 검증 필요) | Pattern 5, Pitfall 9 | 별도 `manual_search_costs` 테이블 추가 — 마이그레이션 1개 더 |
| A4 | `apps/ios/ios/` 디렉토리는 `.gitignore`로 무시됨 (prebuild 산출물이 git에 안 들어옴) — Phase 1 결정 | §Runtime State Inventory | git에 들어가 있으면 prebuild diff가 매번 PR에 추가 |
| A5 | EAS Build 'development' profile (Phase 1 D-03)이 `extra.eas.build.experimental.ios.appExtensions[]` 인지 — 별도 profile 추가 없이 동작 | Pattern 1 | EAS profile 별도 추가 작업 (build profile.json) |
| A6 | `react-native-maps` Marker의 `onPress` event가 reanimated v4 + NativeWind 환경에서 정상 동작 | Pattern 2 / UI-SPEC | bottom sheet trigger 안 됨 — 별도 PressableOverlay 패턴 필요 |
| A7 | UI-SPEC `text-danger` Tailwind 클래스가 ui-tokens preset에 정의되어 있음 (NativeWind 4.2 호환) | UI-SPEC §"Color" | className 무시 → 명시적 `style={{ color: '#DC2626' }}` 폴백 |
| A8 | Apple Maps Provider로도 SAVE-01~05 만족 (Google Maps iOS key 도입 Phase 6) | §Environment Availability | 사용자가 Google Maps만 익숙 — UAT에서 결정 |
| A9 | iOS Share Extension target 이름 `ShareExtension` 그대로 사용 (한국어 표시명만 `MOAJOA 저장`) | Pattern 1 | bundleIdentifier 변경 시 EAS 인증서 재발급 |
| A10 | broadcast 메시지 latency가 cold subscribe 직후에도 안정 (URL 추가 → 즉시 subscribe 사이 race 없음) | Pattern 2 | 일부 'metadata' 단계 메시지 놓침 — Phase 3는 'done'/'error'만 listen이라 영향 없음 |

**If this table is empty:** (해당 없음 — 10개 assumption 표시됨)

---

## Open Questions (RESOLVED)

1. **expo-share-intent에 SharedDefaults helper가 이미 있나?**
   - What we know: README와 deepwiki는 명시 안 함. `iosAppGroupIdentifier` option은 있음.
   - What's unclear: useShareIntent hook이 last_board_id 같은 임의 key를 read/write 지원하는지.
   - RESOLVED: Phase 3 첫 task에서 `grep -ri "UserDefaults\|SharedDefaults" node_modules/expo-share-intent/ios/` 실행. 결과에 helper 있으면 그것 사용, 없으면 자체 native module 작성. (Plan 03-04 Task 1이 이 결정을 실행)

2. **extraction_costs.link_id NULL 허용 vs 별도 테이블**
   - What we know: 0004는 `not null` 명시. resolve-place는 link 없는 cost가 있음.
   - What's unclear: 0005 마이그레이션이 깨끗한지, manual_search_costs 분리가 깨끗한지.
   - RESOLVED: `drop not null` 채택 (Karpathy §3.2 simplicity). Plan 03-01 Task 1에서 0005 migration으로 구현. query 시 `where link_id is not null` 필터가 모든 link-keyed aggregation에 필요 — partial index로 대응.

3. **Bottom sheet은 boards/[id]에 inline mount vs portal modal**
   - What we know: @gorhom/bottom-sheet는 `<BottomSheetModalProvider>` host pattern과 inline mount 둘 다 지원.
   - What's unclear: NativeWind className이 어떤 패턴에서 더 잘 적용되는지 (Pitfall 3).
   - RESOLVED: inline mount (boards/[id] 안에서 `<BottomSheet>` 직접) 채택. Plan 03-05 Task 1이 inline pattern으로 구현. className은 inner View에 적용 (Pitfall 3 workaround 사전 적용).

4. **+ 핀 modal full-screen vs pageSheet vs bottom sheet**
   - What we know: UI-SPEC §"+ 핀 Manual Add Modal" = expo-router modal `presentationStyle='pageSheet'`.
   - What's unclear: pageSheet은 SwiftUI sheet 스타일 — keyboard 가림 행동이 OS 11+ 다를 수 있음.
   - RESOLVED: UI-SPEC 그대로 pageSheet 채택. Plan 03-05 Task 2가 React Native `<Modal presentationStyle="pageSheet">`로 구현. `KeyboardAvoidingView` + `behavior='padding'` (iOS) wrap 포함.

5. **Share Extension 1탭 토스트 = native toast vs UNUserNotificationCenter banner**
   - What we know: CONTEXT.md `<specifics>`에 두 옵션 명시.
   - What's unclear: expo-share-intent의 default UIViewController가 어떤 방식인지.
   - RESOLVED: expo-share-intent default UIViewController 채택 (simplicity 우선, 별도 toast/banner code X). Plan 03-02가 plugin option `iosShareExtensionName='MOAJOA 저장'`만 설정. 만약 dismiss > 1.5s이면 expo-share-extension(MaxAst) 도입 검토 — Phase 3 UAT 결과에 따라.

---

## Sources

### Primary (HIGH confidence — 1차 source verified in this session)
- **npm registry** (Bash `npm view`) — expo-share-intent@6.1.1 (publish 2026-05-25), @gorhom/bottom-sheet@5.2.14 peer deps, expo-share-extension@5.0.6
- **github.com/achorein/expo-share-intent** README — config plugin options, useShareIntent hook signature
- **docs.expo.dev/build-reference/app-extensions** — `extra.eas.build.experimental.ios.appExtensions[]` config keys
- **MOAJOA repo** (Read tool) — `supabase/functions/extract-youtube/index.ts`, `pipeline/places.ts`, `0001_init.sql`, `0002_fix_rls_recursion.sql`, `0004_extraction_hardening.sql`, `apps/ios/app.config.ts`, `apps/ios/app/_layout.tsx`, `apps/ios/app/boards/[id].tsx`, `packages/core/src/schemas/place.ts`, `packages/api/src/queries/{places,links}.ts`

### Secondary (MEDIUM confidence — verified with official source)
- **supabase.com/docs/guides/realtime/broadcast** — broadcast channel API
- **github.com/orgs/supabase/discussions/8573** — React 18 + Strict Mode cleanup pattern
- **github.com/facebook/react-native/issues/34508** — AppState cleanup wrapper requirement
- **github.com/gorhom/react-native-bottom-sheet/issues/2546, #2592** — reanimated v4 compatibility (v5.1.8+ confirmed by maintainer comments)
- **github.com/MaxAst/expo-share-extension** README — alternative library tradeoffs
- **dev.to/cross19xx/ios-app-intents-in-an-expo-app** — App Group identifier matching requirement
- **docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x** — reanimated 4 migration notes

### Tertiary (LOW confidence — flagged for validation)
- **blog.iampato.me/mastering-react-native-app-states** — AppState.removeEventListener deprecation timing
- **productengineer.info/camp/en/ai-app-factory/learn/supabase-realtime-rn** — RN-specific patterns
- **github.com/gorhom/react-native-bottom-sheet/issues/1809** — NativeWind compatibility (오래된 v4 시점 issue, v5에서 변경 가능 — Pitfall 3가 첫 PR에서 verify 필요)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified, peer deps verified
- Architecture: HIGH — 모든 의사결정 CONTEXT.md D-01~D-11에 lock + 기존 Phase 2 코드 패턴 차용
- Pitfalls: MEDIUM — 8/10이 1차 source. Pitfall 3 (NativeWind + bottom sheet)는 첫 spike에서 verify 권장
- Native module integration: MEDIUM — Expo Module API 표준이지만 actual SDK 54 + Share Extension 통합은 spike 필요
- Security: HIGH — 기존 RLS 정책 재사용, Edge Function 패턴 재사용

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30일 — Expo SDK, supabase-js, gorhom 등 fast-moving 영역이라 30일 후 재verify 권장. 특히 expo-share-intent와 @gorhom/bottom-sheet는 publish가 5월 25일 / 활발한 issue 활동)
