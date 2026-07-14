# Deferred Items — quick-260714-kk6

## `pnpm --filter ./apps/web lint` fails (exit 1) — PRE-EXISTING, out of scope

**Discovered during:** Task 3 final verification.

**Symptom:** `next lint` exits 1 without linting anything. It drops into the interactive
setup prompt (`? How would you like to configure ESLint?`) and aborts in a non-TTY shell.

**Root cause:** `apps/web` declares `eslint@^9` + `eslint-config-next@^15` in devDependencies
but **no ESLint config file exists anywhere in the repo** — and `git log --all` shows one has
never existed (`.eslintrc*` / `eslint.config.*` → 0 commits). So `next lint` fails at
config-discovery time, before it reads a single source file. No source diff can affect this.

**Not caused by this task:** this quick task touched 6 files, none of them lint/eslint config.
Failure reproduces identically on the pre-task tree.

**Fix (needs a decision — not a trivial fix):** either
1. migrate to the ESLint CLI (`npx @next/codemod@canary next-lint-to-eslint-cli .`) and commit
   an `eslint.config.mjs`, or
2. drop the `lint` script if Prettier + `tsc --noEmit` is the intended gate.

Note: the repo is also **not** Prettier-clean at baseline (`moa-island.tsx`, `place-list.tsx`,
`moa-chat.test.tsx` all warn under `npx prettier --check`), so Prettier is not currently an
enforced gate either. Worth folding into the same decision.
