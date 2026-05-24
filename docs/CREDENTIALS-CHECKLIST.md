# Credentials Checklist

서비스를 실제로 돌리려면 아래 항목을 받아 `.env.local` 파일들에 채워야 합니다. 현재는 모두 placeholder 상태.

## 우선순위

| 우선 | 항목 | 막히면 안 되는 것 |
|---|---|---|
| 🔴 P0 | Supabase 프로젝트 | 모든 것 (DB·인증·Edge Function) |
| 🔴 P0 | Google Maps Platform 키 (Web + iOS + Server) | 지도 렌더링, 장소 자동완성, Places 좌표 resolve |
| 🔴 P0 | Anthropic API 키 | YouTube 자동 추출 |
| 🟡 P1 | YouTube Data API 키 | 영상 description 풀텍스트 (없으면 oEmbed로 폴백 — 제목만) |
| 🟡 P1 | Apple Developer 계정 + Bundle ID | iOS TestFlight 배포 (로컬 시뮬레이터는 무관) |
| 🟢 P2 | Apple Sign In configuration | 소셜 로그인 (매직 링크로 우회 가능) |
| 🟢 P2 | Google OAuth credentials | 소셜 로그인 (매직 링크로 우회 가능) |
| 🟢 P2 | PostHog API 키 | 분석 (없어도 운영 가능) |
| 🟢 P2 | Resend API 키 | 트랜잭션 메일 (Supabase 기본 SMTP로 시작) |

## 항목별 발급 가이드

### 1. Supabase

1. https://supabase.com/dashboard 에서 새 프로젝트 생성 (region: ap-northeast-1 권장)
2. Project Settings → API 에서 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - service_role secret → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 클라이언트에 노출 금지)
3. `supabase link --project-ref <ref>` 후 `supabase db push`로 마이그레이션 배포
4. `supabase functions deploy extract-youtube` 로 함수 배포

### 2. Google Maps Platform

https://console.cloud.google.com/google/maps-apis 에서 프로젝트 생성 후 아래 API 활성화:

- Maps JavaScript API (Web 지도)
- Places API (New) (장소 자동완성 + Text Search)
- Maps SDK for iOS (iOS 지도)

키는 **3개 분리 생성**해 restriction 설정:

| 키 | restriction | 사용처 |
|---|---|---|
| `GOOGLE_MAPS_WEB_KEY` | HTTP referrer: `https://moajoa.app/*`, `http://localhost:3000/*` | Web (`NEXT_PUBLIC_GOOGLE_MAPS_KEY`) |
| `GOOGLE_MAPS_IOS_KEY` | iOS bundle ID: `com.serendipitylife.moajoa` | iOS (`app.config.ts`) |
| `GOOGLE_PLACES_SERVER_KEY` | API restriction만 (Places API only), referrer/IP 제한 없음 | Edge Function 서버 사이드 |

**Billing 활성화 필수** — 모든 키는 결제 계정 연결되어야 동작.

비용 가이드:
- Maps JS load: $7 / 1000회 (cap 가능)
- Places Text Search: $32 / 1000회 (FieldMask로 최소화: ID·displayName·location·primaryType만)
- Autocomplete (세션 토큰): $0.017 / 세션 (자동완성 호출 자체는 무료, Details만 과금)

### 3. Anthropic Claude

1. https://console.anthropic.com 에서 API 키 발급
2. `.env`의 `ANTHROPIC_API_KEY`에 설정
3. Edge Function이 `claude-sonnet-4-6` 모델 사용 (입력 토큰 $3/M, 출력 $15/M)
4. 영상 1개당 평균 비용 추정:
   - 입력 ~10k 토큰 (transcript + description) = $0.03
   - 출력 ~500 토큰 (JSON 응답) = $0.008
   - **합계 ~$0.04 / 영상**

### 4. YouTube Data API v3 (선택)

1. Google Cloud Console에서 YouTube Data API v3 활성화
2. API 키 발급 → `YOUTUBE_API_KEY` 환경변수
3. 일일 quota 10,000 unit (videos.list는 1 unit/call) — 충분
4. 없으면 oEmbed로 폴백 (description 텍스트가 더 빈약해짐 → 추출 품질 ↓)

### 5. Apple Developer

1. https://developer.apple.com 가입 ($99/year)
2. Bundle ID 등록: `com.serendipitylife.moajoa`
3. App Store Connect에서 앱 레코드 생성
4. (소셜 로그인 시) Sign in with Apple capability 활성화 + Service ID 등록

### 6. Google OAuth (소셜 로그인용)

1. Google Cloud Console → OAuth consent screen 설정
2. Credentials → OAuth 2.0 Client ID 생성 (Web application)
3. Authorized redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
4. Supabase Dashboard → Authentication → Providers → Google 활성화 후 client_id/secret 입력

## 검증 명령어

키 채운 후 동작 확인:

```bash
# DB 마이그레이션 적용
supabase db reset

# Edge Function 로컬 테스트
supabase functions serve --env-file ./supabase/.env.local

# 다른 터미널에서 호출
curl -X POST http://localhost:54321/functions/v1/extract-youtube \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"link_id":"<some-uuid>"}'
```
