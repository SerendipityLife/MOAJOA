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

*Document created 2026-05-27 during dogfooding gate setup (B section discovery).*
