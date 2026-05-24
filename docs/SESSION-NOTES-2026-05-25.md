# Session Notes — 2026-05-25 (Day 2)

피봇 스캐폴드 + 인증·DB·Edge Function 배포 + 1차 검증까지 끝낸 상태.

## 추가로 잠긴 결정 (Day 1 SESSION-NOTES와 함께 봐주세요)

| 결정 | 선택 |
|---|---|
| Web 역할 (재확인) | **공개 보드 열람 전용** — 보드 생성/링크 추가 UI는 dev tool, MVP에선 제거 또는 admin-only |
| 인증 (1차) | **이메일 + 비밀번호** 메인 / 매직 링크 토글 / Google OAuth (provider 설정만 남음) / Apple은 Phase 2 |
| Confirm Email | **OFF** — 매직 링크 자체가 이메일 인증 역할 |
| 추출 정교화 | **나중에 깊게** — 현재 baseline (Claude + Places API)만 |
| iOS 빌드 경로 | **로컬 native build는 모노레포 + RN 이슈로 보류** — EAS Build 또는 npmrc 조정 후 재시도 |

## 이번 세션에서 작동 확인된 것

- ✅ Web SSR 렌더링 (홈, 로그인, 보드)
- ✅ Supabase Auth (이메일 가입/로그인)
- ✅ Supabase 마이그레이션 3개 배포 (`0001_init` · `0002_fix_rls_recursion` · `0003_boards_owner_default`)
- ✅ Edge Function `extract-youtube` 배포 + 시크릿 설정 (ANTHROPIC + Google Places)
- ✅ DB 타입 자동 생성 (`pnpm supabase:types` 동작)
- ✅ RLS 정책 (boards/memberships 사이클 깨진 거 수정함)

## 발견·해결된 버그 6개

| # | 버그 | 해결 |
|---|---|---|
| 1 | placeholder Database 타입이 너무 빡빡해서 SupabaseClient 제네릭 컴파일 실패 | MoajoaSupabaseClient → SupabaseClient<any,any,any> |
| 2 | pnpm @types/react 18(iOS) ↔ 19(Web) 충돌 | 루트 `.npmrc` 에 `public-hoist-pattern[]=` 추가해 isolation |
| 3 | Turbopack이 `from './foo.js'` 형식 import 못 풀음 | 워크스페이스 패키지의 `.js` extension 일괄 제거 |
| 4 | Tailwind v4가 `tailwind.config.ts` 자동 로드 안 함 → 브랜드 컬러 무시 | `@config "../tailwind.config.ts"` 디렉티브 추가 |
| 5 | 마이그레이션 ordering: boards 정책이 미생성 memberships 참조 | 정책 선언을 memberships 생성 뒤로 이동 |
| 6 | RLS 사이클 (boards↔memberships) → 42P17 | SECURITY DEFINER 헬퍼 함수 (`am_board_owner`, `am_board_member`)로 끊음 |

## 미완 / 알려진 이슈

### 🔴 iOS local build 막힘
- 증상: `pod install` 단계에서 react-native-reanimated podspec이 pnpm 가상 store 경로 못 풀음
- 우회 시도해본 것: 없음 (시간 절약 위해 보류)
- 다음 시도 후보:
  1. `apps/ios/.npmrc`에 `node-linker=hoisted` 또는 `shamefully-hoist=true`
  2. EAS Build (클라우드)
  3. Yarn으로 iOS만 분리
- 영향: Share Extension 실험, 실기기 테스트 불가. **Web으로 검증은 가능**

### 🟡 OAuth provider 미설정
- Google/Apple 버튼은 UI에 있지만 Supabase Dashboard에서 provider 활성화 안 됨
- 가이드: `docs/CREDENTIALS-CHECKLIST.md` § Google OAuth 절차

### 🟡 추출 비용·정확도 측정 부재
- Edge Function 동작하지만 영상별 비용·정확도 데이터 없음
- 다음 단계: eval sample 10~20개로 baseline 측정

### 🟢 (참고) Supabase 무료 SMTP 한계
- 시간당 4개 이메일 제한, 스팸 분류 잦음
- 운영 시 Resend 같은 커스텀 SMTP로 교체 권장

## 팀 분배 가이드

상세는 `docs/WORKSTREAMS.md` — 5개 트랙 (iOS · Web · 백엔드 · 디자인 · Auth) 으로 분리. 파일 경계 거의 안 겹침.

## 다음 세션 후보 시작점

(누가 무엇을 가져가느냐에 따라)

- **iOS 담당자:** `apps/ios/.npmrc`에 `shamefully-hoist=true` 또는 EAS Build 셋업
- **Web 담당자:** `/b/[slug]` 폴리시 + OG 이미지 생성 (`@vercel/og`)
- **백엔드 담당자:** eval sample 10개 영상으로 추출 정확도 baseline 측정
- **디자인 담당자:** `apps/ios/assets/icon.png` 1024×1024 + splash
- **풀스택:** Google OAuth provider 설정 마무리 (Cloud Console + Supabase Dashboard)
