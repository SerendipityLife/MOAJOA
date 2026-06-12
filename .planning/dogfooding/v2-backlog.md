# v2-backlog — items rolled forward from dogfooding gate

> Per `pre-dogfooding-checklist.md` Sign-off rule D-02:
> "P1 이하 발견 시 `.planning/dogfooding/v2-backlog.md`에 1행 등록 (close 안 해도 dogfooding 시작 가능)"
>
> Items here are NOT blockers for the 7-day dogfooding. They are tracked for the
> next milestone (v2 collaboration board or v0.2) to address.

---

## 1. Pre-dogfooding checklist B-4 env names are inaccurate (P2)

**Discovered:** Dogfooding day 1 setup (2026-05-27, B section start).

**Symptom:** `pre-dogfooding-checklist.md` B-4 lists Vercel env vars as
`SUPABASE_URL`, `WEB_BASE_URL` (or `REVALIDATE_BASE_URL`). Source code actually
reads different names:

- Web/Next.js (Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`,
  `REVALIDATE_SECRET`.
- Edge Function (Supabase secrets): `REVALIDATE_SECRET`, `WEB_BASE_URL`,
  plus the standard `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` /
  `ANTHROPIC_API_KEY` / `GOOGLE_PLACES_SERVER_KEY` / `YOUTUBE_API_KEY`.

`WEB_BASE_URL` is an Edge Function secret (used by the revalidate webhook
fetch), not a Vercel env. Checklist conflates the two sides.

**Impact during dogfooding:** None — we proceeded with the actual code names.
Item flagged so the next milestone's checklist (or future contributor onboarding)
matches reality.

**Suggested fix in v2:** Rewrite checklist B-1~B-7 against actual source code env
names, with side-of-system labeling (Vercel vs Supabase Edge).

---

## 2. `pnpm supabase:types` script hardcodes `--local` (P3)

**Discovered:** Dogfooding day 1 setup (2026-05-27, A-4).

**Symptom:** Root `package.json` has:
```json
"supabase:types": "supabase gen types typescript --local > packages/api/src/types/database.ts"
```

The `--local` flag requires a running local Supabase docker stack. For dogfooding
(remote-linked project only), this script fails / generates 0 bytes. We had to
invoke `supabase gen types typescript --linked > ...` directly.

**Impact during dogfooding:** None — manual workaround applied. Future contributors
without docker will hit the same failure.

**Suggested fix in v2:** Either add a `supabase:types:linked` variant or change the
default to `--linked` and document the trade-off (slower, hits real DB).

---

## 3. `.gitignore` missing `.vercel/` entry (P3)

**Discovered:** Dogfooding day 1 setup (2026-05-27, B section start).

**Symptom:** First Vercel link will create `.vercel/project.json` (contains
project id + org id — not strictly secret but convention is to gitignore).
Current `.gitignore` doesn't include `.vercel/`.

**Impact during dogfooding:** None — easy to ignore the file manually or add
a 1-line gitignore entry before `vercel link`.

**Suggested fix in v2:** Append `.vercel/` to `.gitignore`. Trivial one-liner.

---

## 4. ~~Web `/login` → `/boards` silent dead-end (P1 UX)~~ ✅ RESOLVED 2026-06-12 (commit 08cb410 — /login?next= + /boards 안내 페이지)

**Discovered:** Dogfooding day 1, 2026-06-01.

**Symptom:** User reached `https://moajoa-web.vercel.app/login`, entered
valid credentials (`test@test.com / 123123`), pressed 로그인. Server-side
login succeeded (REST `POST /auth/v1/token` returned HTTP 200 +
`access_token`; `auth.users.last_sign_in_at` updated). Client called
`router.replace('/boards')`. But `apps/web/app/boards/page.tsx:11` has
`if (!isDevToolsEnabled()) redirect('/login')` — a deliberate gate
because the convention (CLAUDE.md §5) says web is share-only and board
management lives on iOS. With `NEXT_PUBLIC_ENABLE_DEV_TOOLS` unset in
production env, every authenticated user is bounced right back to the
login screen. From the user's perspective: "I pressed login and nothing
happened" — silent loop.

**Impact during dogfooding:** Confusing. User concluded login was broken
and wasted ~10 min debugging credentials. Design intent itself is fine
(web read-only, iOS-only management) — but the dead-end UX is not.

**Suggested fix in v2 (two options, pick one):**

1. **Hide the `/login` route entirely on web** unless dev tools are on.
   The web app's public surface should be `/b/[slug]` only. Friend
   visitors don't need an account — they just open the share link.
   If someone lands on `/login` by typing it, redirect to `/` with a
   banner "MOAJOA는 iOS 앱에서 보드를 만들어요. App Store 링크".

2. **Replace the `/boards` dev-tool gate with a friendly post-login
   page** that says "Web에서는 친구 공유 보드만 열람할 수 있어요 — 보드를
   만들고 싶다면 iOS 앱을 이용해주세요" + Apple Store deeplink.
   Auth state persists, so the user who really wants the dev tools
   can flip the env flag.

Either way, the silent redirect from `/login` to `/boards` to `/login`
must end. (Detected by dogfooding D-1 attempt.)

---

## 5. `samples.json` URLs not filled (P2 — Plan 06-02 산출물 미작성)

**Discovered:** Dogfooding day 1, 2026-05-29.

**Symptom:** `.planning/dogfooding/samples.json` has 12 sample entries
with `"url": ""` — Plan 06-02 산출물이 채워지지 않았다. Day 1 자동 검증
중 D-2 (URL 추가 → 30s 핀) / E-2 (timestamp deep link) 시뮬레이션 시작이
보류됐다 — autonomous extraction에는 실제 YouTube URL이 필요.

**Impact during dogfooding:** D-2, E-2 시나리오는 본인 직접 채워서 실행
필요. 다른 자동 검증은 정상 진행됨.

**Suggested fix:** Day 1 시작 직전 본인 자주 보는 vlog 12개 URL을
samples.json에 paste. category/city/length_bucket/transcript_lang/
transcript_source는 본인 best guess로 채움 (extraction-baseline은
실제 추출 후 ground-truth와 비교 — 본인의 정성 평가 입력).

---

## 6. ~~OG image route 500 (P0 — incidents.md #5 mirror)~~ ✅ RESOLVED 2026-06-12 (Satori woff2 미지원 + 핀{n}개 multi-child div — TTF 변환 + 단일 문자열. 라이브 200 확인)

**Discovered:** Dogfooding day 1, 2026-05-29.

See `incidents.md` row #5. Diag commits `1922961` + `9a75754` added but
neither console.error fired in Vercel runtime logs — the throw happens
before `loadPretendardFonts` and before the `Promise.all` wrapper. Likely
candidates remaining: `ImageResponse` construction itself (Satori font
buffer decoding), or a module-level import (`@/lib/og/static-maps`
hidden init code). Next diag step: add `console.log` at the very top of
the file (before any imports run side-effects) by gating with a top-level
`try` around the default export's first line, plus checking
`process.env.PRETENDARD_REGULAR_DEBUG` to side-load via base64 inline as
a fallback experiment.

**Impact during dogfooding:** Friend share preview (E-3 카톡 OG) will
show fallback or broken card. Public board page itself renders fine.

---

*Document created 2026-05-27. Updated 2026-05-29 / 2026-06-01.*

---

## 7. 확정(confirmed)을 주인 수동 마킹으로 재설계 (v2 — 2026-06-12 결정)

**Background:** 수식 확정(❤️ ≥ 멤버 절반)은 멤버가 공유링크로 수시 합류하는
구조에서 분모가 불안정 — 2명일 때 확정된 곳이 3번째 합류로 해제되는 출렁임.
2026-06-12 사용자 결정으로 웹에서 수식 확정 제거, ❤️ 개수 + "많은 순" 정렬로
대체 (commit c90dadc).

**v2 idea:** 확정은 수식이 아니라 의사결정 — 보드 주인이(또는 멤버 합의로)
장소에 직접 '확정' 마킹. isPlaceConfirmed/accepted_member_count는 core/api에
보존돼 있어 재사용 가능. 확정 마킹 시 핀 색상 전환(colors.pin.confirmed)과
iOS 동기화까지 함께 설계.
