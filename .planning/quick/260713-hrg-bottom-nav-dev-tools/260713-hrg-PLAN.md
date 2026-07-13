---
phase: 260713-hrg-bottom-nav-dev-tools
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/moa/[id]/_components/account-sheet.tsx
  - apps/web/__tests__/account-sheet.test.tsx
  - apps/web/app/moa/[id]/_components/moa-tab-bar.tsx
  - apps/web/components/bottom-nav.tsx
autonomous: true
requirements: [QUICK-01, QUICK-02]

must_haves:
  truths:
    - "/moa/[id] 탭바에 [마이]가 보이고, 탭하면 계정 시트가 열린다"
    - "계정 시트를 닫으면 원래 있던 탭(모으기/채팅)에 그대로 남는다 — 탭 전환 아님"
    - "로그인 사용자는 시트에서 이름·이메일을 보고 로그아웃할 수 있다"
    - "비로그인/익명 게스트는 시트에서 /login?next=<현재경로> 로그인 CTA를 본다"
    - "프로덕션 빌드(dev-tools off)에서도 /moa · /discover · /me 앱셸 탭바가 렌더된다"
    - "moa:{tripId} realtime 채널은 마이 시트를 열고 닫아도 재생성되지 않는다"
  artifacts:
    - apps/web/app/moa/[id]/_components/account-sheet.tsx
    - apps/web/__tests__/account-sheet.test.tsx
  key_links:
    - "moa-tab-bar TABS의 account 엔트리 → AccountSheet open 상태 (activeTab 미변경)"
    - "AccountSheet → getSupabaseBrowser().auth.getUser() 자체 조회 (island prop 무의존)"
    - "AccountSheet 로그아웃 → auth.signOut() → router.replace('/login')"
    - "bottom-nav 렌더 조건 → onTab 단독 (dev-tools 게이트 제거)"
---

<objective>
/moa/[id] 상세 화면에서 로그인/로그아웃에 도달할 수 없는 문제를 두 갈래로 막는다.

1. moa 내부 탭바(모으기/채팅)에 [마이] 액션 탭을 추가해 계정 BottomSheet를 연다 (QUICK-01).
2. 앱셸 탭바(bottom-nav)의 dev-tools 게이트를 제거해 프로덕션에서도 [내 정보]가 렌더되게 한다 (QUICK-02).

Purpose: 오늘 웹 프로덕션에서 로그아웃 경로가 0개다. 앱셸 탭바는 dev-tools 게이트에 막혀 절대 렌더되지 않고, moa 상세에는 계정 진입점 자체가 없다. v2.1 웹 퍼스트에서 웹이 실 제품 서피스이므로 둘 다 실패다.
Output: AccountSheet 컴포넌트 + 테스트, moa-tab-bar 3번째 액션 탭, bottom-nav 게이트 해제.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# 확장 대상
@apps/web/app/moa/[id]/_components/moa-tab-bar.tsx
@apps/web/components/bottom-nav.tsx

# 재사용할 검증된 패턴 (읽기 전용 — 수정 금지)
@apps/web/app/moa/[id]/_components/share-sheet.tsx
@apps/web/components/bottom-sheet.tsx
@apps/web/app/me/_components/me-content.tsx
@apps/web/app/me/page.tsx
@apps/web/__tests__/share-sheet.test.tsx
</context>

<decisions>
설계 결정 (조사 완료 — 재논의 금지):

- **D-A: 계정 시트 상태는 MoaTabBar가 소유한다** (MoaIsland 아님).
  근거: 시트가 island 상태에 전혀 의존하지 않는다(세션을 스스로 조회 — D-B). island로 끌어올리면 순수 prop 배선만 늘고, `moa-island.test.tsx`의 `@/components` 목이 BottomSheet를 노출하지 않아 시트를 sibling으로 렌더하는 순간 기존 테스트가 깨진다. 탭바 소유 = `moa-island.tsx` 무수정 + 기존 테스트 파일 0개 수정.
  (`moa-island.test.tsx`는 MoaTabBar를 통째로 목킹하고, `guest-surface.test.tsx`는 MoaIsland를 통째로 목킹한다 → 탭바 내부 변경은 두 테스트에 무영향.)

- **D-B: AccountSheet는 세션을 스스로 조회한다** — `getSupabaseBrowser().auth.getUser()`, `open`이 true가 될 때만.
  근거: `/moa/[id]`(호스트, RSC seed)와 `/t/[slug]`(게스트, 익명 세션) 양쪽에서 같은 탭바가 뜬다. prop 드릴링하면 `moa/[id]/page.tsx` + `guest-surface.tsx` 둘 다 손대야 하고 게스트 경로엔 email/avatar가 아예 없다. ShareSheet가 이미 `open`에서 poll을 자체 조회하는 선례가 있다.

- **D-C: "게스트" 판정 = `!user || user.is_anonymous`.**
  근거: `/t/[slug]`는 join 시 `signInAnonymously`를 태우므로 게스트도 세션은 있다. 익명 유저는 email·name이 비어 있어 프로필 렌더가 깨진다. 익명 = 로그인 CTA를 보여줄 대상이 맞다.

- **D-D: 시트 내용은 프로필 + 로그아웃(또는 로그인 CTA)만.** `/me`의 메뉴 행(내 프로필/앱 설정/도움말/이용약관/개인정보처리방침)은 명시적 범위 밖 — 넣지 말 것.
</decisions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: AccountSheet — moa 서피스 계정 시트 (QUICK-01a)</name>
  <files>apps/web/app/moa/[id]/_components/account-sheet.tsx, apps/web/__tests__/account-sheet.test.tsx</files>

  <behavior>
    account-sheet.test.tsx 가 먼저 실패해야 한다. 목 구성은 `apps/web/__tests__/share-sheet.test.tsx` 헤더를 그대로 미러 (같은 BottomSheet를 쓰는 검증된 선례):
      - `@/components` 목: BottomSheet 스텁 (`open ? <div>{children}{footer}</div> : null`) + Button 패스스루.
      - `@/lib/supabase/browser` 목: `getSupabaseBrowser: () => ({ auth: { getUser, signOut } })`.
      - `next/navigation` 목: `useRouter: () => ({ replace })`, `usePathname: () => '/moa/trip-1'`.
      - `window.confirm`은 `vi.spyOn(window, 'confirm')`으로 케이스별 제어.

    - Test 1 (비로그인): getUser → `{ data: { user: null } }` → '로그인' CTA가 `href="/login?next=%2Fmoa%2Ftrip-1"` 로 렌더. 로그아웃 버튼 부재.
    - Test 2 (익명 게스트, D-C): getUser → `{ data: { user: { id:'anon-1', is_anonymous: true, email: null, user_metadata: {} } } }` → Test 1과 동일하게 로그인 CTA. 프로필·로그아웃 부재.
    - Test 3 (로그인 사용자): getUser → user_metadata `{ full_name: '김와이디', avatar_url: 'https://x/a.png' }` + `email: 'a@b.com'`, `is_anonymous: false` → 이름·이메일 렌더 + 로그아웃 버튼 노출. 로그인 CTA 부재.
    - Test 4 (로그아웃 확정): Test 3 상태에서 confirm→true, 로그아웃 클릭 → `signOut` 1회 + `replace('/login')` 1회.
    - Test 5 (로그아웃 취소): confirm→false → `signOut` 미호출, `replace` 미호출.
    - Test 6 (닫힌 시트는 세션을 안 캔다): `open={false}` 렌더 → `getUser` 미호출.
  </behavior>

  <action>
    `apps/web/app/moa/[id]/_components/account-sheet.tsx` 신규 작성 ('use client').

    Props: `{ open: boolean; onClose: () => void }` — 그 이상 받지 말 것 (D-B).

    세션 조회: `open`이 true일 때만 `useEffect`에서 `getSupabaseBrowser().auth.getUser()`. share-sheet.tsx의 `let active = true` cleanup 가드 패턴을 그대로 쓴다(언마운트 후 setState 방지). 조회 실패(네트워크/에러 응답)는 게스트로 폴백 — 시트가 빈 화면으로 죽으면 안 된다.

    분기 (D-C): `const signedIn = user !== null && !user.is_anonymous;`
      - 로딩 중: 본문·푸터 렌더 생략 (깜빡임 방지용 스켈레톤 금지 — 요청 범위 밖).
      - signedIn: 프로필 블록만 — 아바타(있으면 img, 없으면 이름 첫 글자 이니셜) + 이름 + 이메일. 이름/아바타 파생은 `apps/web/app/me/page.tsx` L12–21 로직을 클라이언트에서 그대로 미러(full_name → name → '사용자', avatar_url → picture → null). me/page.tsx를 공용 헬퍼로 리팩터링하지 말 것 (§3.3 surgical — 서버 컴포넌트다).
      - 게스트: 안내 문구 1줄 + 로그인 CTA.

    푸터 (BottomSheet `footer` prop 사용 — 스크롤 밖 고정 CTA, 최근 커밋 7c15db7이 세운 구조):
      - signedIn: 로그아웃 버튼. 동작은 me-content.tsx L32–36 그대로 — `window.confirm('정말 로그아웃 하시겠습니까?')` → false면 return, true면 `await getSupabaseBrowser().auth.signOut()` → `router.replace('/login')`. 스타일은 me-content.tsx L110–117의 `text-danger` 텍스트 버튼을 미러.
      - 게스트: `next/link`의 `<Link href={`/login?next=${encodeURIComponent(pathname)}`}>` 로그인 CTA. pathname은 `usePathname()`. (login/page.tsx가 이미 `next=`를 `/`로 시작하고 `//`가 아닌 값만 허용하도록 검증한다 — 그 계약에 맞는 값만 넘긴다.)

    시트 title은 '마이'. BottomSheet·Button은 `@/components`에서 import (index 배럴 경유, `.js` 확장자 금지).

    범위 밖 (D-D): /me의 메뉴 행(내 프로필/앱 설정/도움말/이용약관/개인정보처리방침), 프로필 편집, 토스트, 배지 — 전부 넣지 말 것.
  </action>

  <verify>
    <automated>pnpm --filter @moajoa/web exec vitest run __tests__/account-sheet.test.tsx</automated>
  </verify>

  <done>
    account-sheet.test.tsx 6개 테스트 통과. AccountSheet가 open일 때만 getUser를 호출하고, 로그인/익명/비로그인 3상태를 올바르게 분기한다.
  </done>
</task>

<task type="auto">
  <name>Task 2: moa-tab-bar에 [마이] 액션 탭 배선 (QUICK-01b)</name>
  <files>apps/web/app/moa/[id]/_components/moa-tab-bar.tsx</files>

  <action>
    `MoaTab` 타입('moa' | 'chat')은 **그대로 둔다** — [마이]는 탭 전환이 아니라 시트를 여는 액션이다. `MoaTabBarProps`도 변경 없음 (D-A: 시트 상태는 탭바 내부 `useState`).

    TABS 배열에 3번째 엔트리 추가: `{ key: 'account', label: '마이', Icon: PersonIcon }`. 파일 상단 주석이 "TABS는 배열이라 확장이 trivial"이라고 이미 명시한 그 확장점이다.

    렌더 분기 (map 안, 최소 변경):
      - `key === 'account'` → `onClick`이 로컬 `setAccountOpen(true)`. `activeTab`을 건드리지 않으므로 시트를 닫으면 사용자는 있던 탭에 그대로 남는다. `aria-current`를 주지 말고 `aria-haspopup="dialog"`를 준다 (BottomSheet가 `role="dialog"`).
      - 나머지 → 기존 `onTabChange(key)` 경로 그대로.
      - active 하이라이트: account는 절대 active가 되지 않아야 한다.
      삼항을 인라인으로 써서 TS가 `key`를 'moa' | 'chat'으로 좁히게 할 것 (`onTabChange`에 'account'가 들어가면 typecheck가 잡는다).

    PersonIcon: `bottom-nav.tsx`의 PersonIcon SVG 패스를 이 파일의 `svgProps` 스타일로 그대로 옮겨 심는다 (circle cx12 cy8 r4 + path M4 20c0-3.5...). 두 파일이 이미 각자 로컬 아이콘을 두는 구조라 공용 아이콘 모듈로 추출하지 말 것 (§3.2/§3.3).

    `<nav>` 뒤(형제)로 `<AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />` 렌더. BottomSheet가 body portal이라 nav 안에 있어도 DOM 위치는 무관하지만, fragment로 감싸 nav와 형제로 두는 편이 읽기 쉽다.

    `moa-island.tsx`는 손대지 말 것 — 이 변경은 탭바 내부에 갇힌다.
  </action>

  <verify>
    <automated>pnpm --filter @moajoa/web typecheck && pnpm --filter @moajoa/web exec vitest run __tests__/moa-island.test.tsx __tests__/guest-surface.test.tsx</automated>
  </verify>

  <done>
    typecheck 통과. 기존 moa-island / guest-surface 테스트가 **수정 없이** 그대로 통과한다(둘 다 각각 MoaTabBar·MoaIsland를 목킹하므로 무영향). `git diff --stat`에 `moa-island.tsx`가 없다.
  </done>
</task>

<task type="auto">
  <name>Task 3: bottom-nav dev-tools 게이트 제거 (QUICK-02)</name>
  <files>apps/web/components/bottom-nav.tsx</files>

  <action>
    <!-- planner-discipline-allow: isDevToolsEnabled -->
    L22 렌더 가드에서 dev-tools 조건절을 떼어내 `if (!onTab) return null;` 만 남긴다. 그 결과 고아가 되는 L5의 `isDevToolsEnabled` import(`@/lib/env`)를 이 파일에서만 제거한다.

    `apps/web/lib/env.ts`의 헬퍼 자체와 다른 호출부는 건드리지 말 것 — 확인 결과 이 파일이 유일한 호출부지만, 헬퍼는 `NEXT_PUBLIC_ENABLE_DEV_TOOLS` 계약으로 남긴다(CLAUDE.md §5: dev-tool 폼 격리는 정식 UI로 대체될 때까지 유지). `env.ts`는 이번 diff에 등장하면 안 된다.

    L7–12 상단 주석 수정: 현재 "only when dev tools are on (the web app shell is a dev tool — the public production viewer stays chrome-free)"는 이제 거짓이다. 세 top-level 화면(모아/둘러보기/내 정보)에서만 뜬다는 사실은 유지하되, v2.1 웹 퍼스트로 웹이 실 제품 서피스가 되어 게이트를 걷었다는 이유를 적는다(*why*를 적는다 — CLAUDE.md §4.5). 주석은 이 파일의 기존 스타일대로 **영문**으로 쓴다.
    ⚠ 새 주석에 제거한 헬퍼의 이름이나 `@/lib/env` 경로를 문자열로 언급하지 말 것 — 아래 acceptance grep이 이 파일에서 해당 심볼의 완전 부재를 검사한다.

    TABS 배열·아이콘·마크업은 그대로. 렌더 조건 한 줄 + import 한 줄 + 주석 블록이 diff의 전부여야 한다.
  </action>

  <verify>
    <automated>test "$(grep -c 'isDevToolsEnabled' apps/web/components/bottom-nav.tsx || true)" = "0" && test "$(grep -c 'if (!onTab) return null;' apps/web/components/bottom-nav.tsx)" = "1" && pnpm --filter @moajoa/web typecheck && pnpm --filter @moajoa/web lint</automated>
  </verify>

  <done>
    bottom-nav.tsx에 dev-tools 심볼이 0회 등장하고 렌더 가드는 `onTab` 단독. typecheck·lint 통과(고아 import 없음). `git diff --stat`에 `apps/web/lib/env.ts`가 없다.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 브라우저 → Supabase Auth | 세션 조회(`auth.getUser`)·파기(`signOut`)가 이 경계를 넘는다 |
| URL 쿼리 → 클라이언트 리다이렉트 | `/login?next=<path>`의 `next` 값이 인증 후 이동 대상이 된다 |
| 렌더 게이트 → 프로덕션 노출 | dev-tools 게이트 제거로 앱셸 탭바가 프로덕션에 노출된다 |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hrg-01 | Tampering | AccountSheet 로그인 CTA의 `next=` | medium | mitigate | `usePathname()`이 만든 앱 내부 경로만 넘긴다(사용자 입력·`window.location.search` 미사용). 소비측 `login/page.tsx`가 이미 `/`로 시작 && `//` 아님을 재검증 → 오픈 리다이렉트 차단. |
| T-hrg-02 | Information disclosure | AccountSheet 프로필 렌더 | medium | mitigate | 익명 세션(`is_anonymous`)은 프로필 블록을 렌더하지 않는다(D-C). 게스트 서피스(`/t/[slug]`)에서 호스트 정보가 새지 않도록 시트는 **자기 세션만** 조회한다 — island prop(호스트 데이터) 미사용. |
| T-hrg-03 | Elevation of privilege | bottom-nav 게이트 제거 | low | accept | 탭바는 `/moa`·`/discover`·`/me` 링크만 노출한다. 권한 경계는 각 라우트의 RLS·`/me`의 `redirect('/login')` 서버 가드가 잡는다 — 탭바는 인가 게이트였던 적이 없다(렌더 게이트일 뿐). 새 권한 표면 0. |
| T-hrg-04 | Repudiation | 로그아웃 | low | accept | `signOut()` 후 `router.replace('/login')`로 히스토리 뒤로가기 재진입을 막는다(me-content 기존 계약 동일). 서버 세션 무효화는 Supabase 몫. |

패키지 설치 없음 → package legitimacy 게이트 해당 없음.
</threat_model>

<verification>
1. 전체 게이트: `pnpm typecheck` (모노레포 전체) + `pnpm --filter @moajoa/web test:run` — 기존 25개 테스트 파일 + 신규 account-sheet.test.tsx 전부 통과.
2. 회귀 가드: `moa-island.test.tsx`·`guest-surface.test.tsx`가 **무수정**으로 통과 (Test 12 "탭 전환은 채널을 재생성/제거하지 않음" 포함).
3. 손댄 범위 가드: `git diff --name-only`가 정확히 4개 파일 — account-sheet.tsx(신규), account-sheet.test.tsx(신규), moa-tab-bar.tsx, bottom-nav.tsx. `apps/ios/**`·`packages/**`·`supabase/**`·`apps/web/lib/env.ts`·`moa-island.tsx`는 등장하면 안 된다 (CLAUDE.md iOS 동결 + §3.3 surgical).
4. 사람 확인 (human-check, `pnpm web:dev`):
   - `/moa/<id>` → 하단 탭바에 [모으기][채팅][마이] 3개. [마이] 탭 → 계정 시트가 지도 위로 뜬다.
   - 시트를 닫으면 원래 탭 유지 (채팅 탭에서 열었으면 채팅 그대로).
   - 로그인 상태: 이름·이메일·로그아웃 노출 → 로그아웃 → confirm → `/login` 이동.
   - `/t/<slug>` 게스트로 참여 후 [마이] → 로그인 CTA(프로필 없음), `/login?next=/t/<slug>` 이동.
   - dev-tools 없이(`NEXT_PUBLIC_ENABLE_DEV_TOOLS` 미설정) `/moa` → 앱셸 탭바(모아/둘러보기/내 정보) 렌더.
</verification>

<success_criteria>
- [ ] /moa/[id]에서 [마이] 탭으로 계정 시트에 도달, 로그인 사용자는 로그아웃 가능
- [ ] 게스트(비로그인·익명)는 같은 자리에서 `/login?next=<현재경로>` CTA를 본다
- [ ] [마이]가 activeTab을 바꾸지 않는다 (시트 닫으면 원래 탭)
- [ ] dev-tools 없이도 앱셸 bottom-nav가 렌더된다
- [ ] `pnpm typecheck` + `pnpm --filter @moajoa/web test:run` 통과, 기존 테스트 파일 수정 0건
- [ ] diff는 4개 파일뿐 (iOS·packages·migrations·env.ts·moa-island.tsx 무변경)
</success_criteria>

<output>
Create `.planning/quick/260713-hrg-bottom-nav-dev-tools/260713-hrg-SUMMARY.md` when done
</output>
