# Deferred Items — Phase 4

Out-of-scope items discovered during execution. Tracked here so they're not lost.

## From Plan 04-02

### Pre-existing `deno check` errors in `supabase/functions/extract-youtube/index.ts`

Discovered during Task 3 verification. All 9 errors pre-existed my insertion (confirmed via `git stash` recheck — same 9-error count without my added block).

| Lines | Error | Root cause |
|-------|-------|-----------|
| 99, 103, 121, 140, 178, 189, 234, 272 | TS2345 SupabaseClient generic mismatch | Upstream `@supabase/supabase-js` typed `SupabaseClient<unknown, { PostgrestVersion: string; }, never, ...>` vs. `createClient` returns `<any, 'public', 'public', any, any>`. Helper signatures (`broadcastStep`, `logCost`) likely need generic widening. |
| 317 | TS2353 `link_id` not in `never[]` | `extraction_costs` insert type inference resolves to `never[]` because new typed schema isn't loading the `extraction_costs` table type. Likely needs `database.ts` regeneration after migration 0005. |

**Disposition:** Not blocking — Edge Function deploys via `supabase functions deploy` which uses Deno's runtime types, not the local `deno check`. Phase 6 (dogfooding) or a dedicated infra plan should address.

**Not fixed in 04-02** because: (a) outside task scope, (b) Edge Function still runtime-correct, (c) fixing requires regenerating `packages/api/src/types/database.ts` and adjusting helper generics — architectural change touching multiple plans.
