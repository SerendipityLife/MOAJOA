# design-sync — repo-specific notes (MOAJOA)

> First full sync completed 2026-06-18. Project: **MOAJOA UI (Code Sync)**
> (`c3ed9446-2e0c-4a4b-bd18-99c09c8ef490`). Read this before re-running `/design-sync`.

## Source shape & how it's wired

- `shape = "package"`, but the DS is **not a built package** — it's the in-app component
  barrel `apps/web/components/index.ts` (Button, Input, Chip, Card, Dialog, BottomSheet,
  ToastProvider, + Radix-backed Select/DropdownMenu/Popover/Tooltip/Tabs). Tokens live in
  `packages/ui-tokens` (TS only, no shipped CSS).
- **Entry:** `--entry ./apps/web/components/index.ts` (the barrel). It EXISTS, so
  `resolveDistEntry` returns it → `synthEntry = false`. The PKG_DIR walk-up from the entry
  lands on `apps/web` (`@moajoa/web`). **Do NOT** point `--entry` at a non-existent dist path
  (that would force synth-entry mode and re-export every file incl. `bottom-nav.tsx`).
- **`BottomNav` is intentionally excluded** — it's not in the barrel and imports `next/link` /
  `next/navigation` (won't bundle/render standalone).
- Because there's no `.d.ts`, `exportedNames` is empty → the component list comes entirely from
  `cfg.componentSrcMap` (12 entries) and props from `cfg.dtsPropsFor` (hand-written, since the
  source interfaces aren't exported). **If you add/rename a component, update BOTH maps.**
- `--node-modules apps/web/node_modules` (pnpm, non-hoisted — react 19.2.3 + radix + lucide all
  resolve there; repo-root `node_modules` is empty of these).

## Build prerequisites (fresh clone)

- pnpm@9.12.0 via corepack: `export COREPACK_ENABLE_STRICT=0 && corepack pnpm i --frozen-lockfile`
  (pnpm isn't on PATH; corepack can't write shims without admin — invoke as `corepack pnpm`).
  Node 24 works fine for the converter even though the repo pins Node 22 (`.nvmrc`).
- Converter deps in `.ds-sync/`: `npm i esbuild ts-morph @types/react @tailwindcss/cli@4.3.0 playwright`
  then `node .ds-sync/node_modules/playwright/cli.js install chromium`.

## The hard part: headless Tailwind v4 — SOLVED via a compiled stylesheet

- Components carry NO component CSS; all styling is Tailwind v4 utility classes compiled at the
  Next.js app build. A naive run renders unstyled boxes.
- **Fix:** compile the app's real `apps/web/app/globals.css` with the Tailwind v4 CLI (it pulls in
  the ui-tokens preset via `@config`, the shadcn `@theme` semantic colors used by the Radix
  re-themes — `bg-popover`/`border-input`/`text-muted-foreground` etc. — and `tw-animate-css`).
  Output → `apps/web/.ds-sync.generated.css`; `cfg.cssEntry` points at it.
  - Compile from the **wrapper input** `apps/web/.ds-sync.input.css` (committed) — it imports the
    app globals AND adds `@source inline(...)` safelists that materialize the FULL MOAJOA token
    utility matrix (every brand/neutral shade, semantic, surface, pin, category, medal color ×
    bg/text/border, all radii/shadows/fonts/sizes). This is what lets the design agent build
    on-brand designs with the whole palette, not just classes the current app happens to use.
  - Recompile command (run from `apps/web` so `@import 'tailwindcss'` resolves):
    `node <repo>/.ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs -i ./.ds-sync.input.css -o ./.ds-sync.generated.css --optimize`
  - The CLI scans `app/` + `components/` (per the config's `content`) for real usage, plus the
    safelist. **Preview layout glue uses INLINE styles** (not Tailwind classes), so the compiled
    CSS doesn't need to re-scan `.design-sync/previews/`.
  - If you add a new token family/shade to `packages/ui-tokens`, add it to the `@source inline`
    safelist in `apps/web/.ds-sync.input.css` too, or the agent can't use it.
  - **Re-sync:** if any `apps/web/components/*.tsx` changed, RE-RUN the CSS compile before the
    converter, or new utility classes will be missing from the shipped stylesheet.

## Fonts

- Pretendard (brand font) is shipped: `apps/web/.ds-fonts/pretendard.css` declares
  `@font-face { font-family: 'Pretendard' }` → the variable woff2 (copied from the `pretendard`
  npm package). Wired via `cfg.extraFonts`. The woff2 + css are gitignored (regenerate on a fresh
  clone: copy `packages/ui-tokens/node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2`
  into `apps/web/.ds-fonts/`).
- **Known [FONT_MISSING] (accepted, non-blocking):** "Apple SD Gothic Neo" (macOS system Korean
  font — fallback only) and "JetBrains Mono" (mono fallback, unused by these components). These are
  legitimately fallback families, not shipped. Do not treat as new on re-sync.

## Overlay preview patterns (calibration learnings)

- Import previews from `'@moajoa/web'` → `window.MoajoaUI`.
- **`position: fixed` overlays (Dialog, BottomSheet, ToastProvider):** wrap in a bounded "stage" —
  `<div style={{position:'relative', width:W, height:H, transform:'translateZ(0)', overflow:'hidden'}}>`.
  The `transform` makes the wrapper the containing block so the fixed backdrop + panel render inside
  the card. Pair with `cfg.overrides.<Name> = {cardMode:'single', viewport:'WxH', primaryStory:'…'}`.
- **ToastProvider:** fire a sticky toast on mount via a child that calls `useToast()` in `useEffect`
  with `{duration: 0}`.
- **Radix PORTAL overlays (Select, DropdownMenu, Popover, Tooltip):** the transform stage does NOT
  contain a portal (it goes to `document.body`). Instead render with `defaultOpen` and add
  bottom/top padding so the portaled content fits; `cardMode:'single'` + a roomy `viewport`.
  `defaultOpen` renders + positions correctly in the static playwright capture (verified).
- Changing any `cfg.overrides` value requires a full `package-build.mjs` (preview-rebuild alone
  flags `[CONFIG_STALE]`).

## Known render warns

- None beyond the accepted [FONT_MISSING] above. All 12 components render cleanly; all authored
  previews graded `good`.

## Re-sync risks / what can go stale

- **CSS staleness:** the shipped stylesheet is a point-in-time Tailwind compile. If component class
  usage changes without re-running the CSS compile, designs/previews lose those classes silently.
- **`dtsPropsFor` drift:** props are hand-written (no `.d.ts` source of truth). If a component's real
  props change, the `.d.ts`/prompt the design agent sees won't update automatically — re-edit
  `cfg.dtsPropsFor`.
- **Generated files are gitignored** (`apps/web/.ds-sync.generated.css`, `apps/web/.ds-fonts/`,
  `.ds-sync/`, `ds-bundle/`). A fresh clone must regenerate them (CSS compile + font copy + dep
  installs) before a re-sync.
- All 12 components have authored previews — no floor cards remain.
