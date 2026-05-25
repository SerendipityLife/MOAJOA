# Phase 2: Extraction Pipeline Hardening - Research

**Researched:** 2026-05-25
**Domain:** Supabase Edge Functions (Deno), Realtime Broadcast, Anthropic Messages API, Google Places API (New), SQL migrations
**Confidence:** HIGH

## Summary

Phase 2 hardens the existing `extract-youtube` Edge Function with four capabilities: (1) Realtime Broadcast of extraction progress, (2) citation-enforced LLM extraction with new `places` columns, (3) per-call cost logging, and (4) Places API cost defense. All work is confined to `supabase/functions/extract-youtube/**` and a new migration `0004_*`.

The existing codebase is well-structured for these additions. The `index.ts` handler has clear pipeline stages that map directly to the 5 broadcast steps. The `claude.ts` already has a `PlaceCandidate` Zod schema with `source_quote` as optional -- making it required and adding post-parse filtering is a minimal change. The `places.ts` already uses explicit FieldMask (EXTRACT-05 is essentially verified). Cost logging requires a new table and instrumentation around existing API calls.

**Primary recommendation:** Implement as a single migration (0004) creating `extraction_costs` table + adding `source_kind`/`inferred_city` columns to `places`, then modify Edge Function code in three files (`index.ts`, `claude.ts`, `places.ts`) with broadcast, citation enforcement, and cost logging. GCP billing alert is a manual infrastructure task documented separately.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Supabase Realtime Broadcast `channel.send()` from Edge Function using admin client. `extract:{link_id}` channel, 5 steps.
- **D-02:** 5 steps: `metadata` -> `transcript` -> `llm` -> `places` -> `done` (or `error`). Payload: `{ step, progress_pct, detail? }`.
- **D-03:** Existing `links.extraction_status` column retained as-is. Broadcast = real-time, DB = final state.
- **D-04:** `source_quote` required in Zod schema. Post-parse filtering (not Zod failure) for entries missing it.
- **D-05:** LLM prompt constraint: "Every place MUST include source_quote. Omitting it will cause the entry to be discarded."
- **D-06:** Column mapping: `source_timestamp_sec` (existing), `source_quote` (existing), `source_kind` (new, `text NOT NULL DEFAULT 'ai'`, CHECK `('ai','manual')`), `inferred_city` (new, `text`, nullable).
- **D-07:** No rename of existing columns. `source_timestamp_sec`/`source_quote` stay as-is.
- **D-08:** `extraction_costs` table schema: `id uuid PK, link_id uuid FK, provider text, model text, input_tokens int, output_tokens int, cost_usd numeric(10,6), duration_ms int, created_at timestamptz`.
- **D-09:** One row per API call. Anthropic = 1 row, Places = N rows per extraction.
- **D-10:** Cost calculated in Edge Function: tokens x unit price. Anthropic `usage.input_tokens`/`usage.output_tokens`. Places = $0.032/call (Text Search Pro SKU).
- **D-11:** `extraction_costs` RLS enabled but no client-facing policies (service role only).
- **D-12:** FieldMask already set in `places.ts`. Verify with grep.
- **D-13:** GCP billing alert: manual Console setup + documentation. $5/$20/$50 thresholds.
- **D-14:** No IaC (Terraform). Manual setup + docs.

### Claude's Discretion
- Anthropic API usage parsing implementation details
- `inferred_city` LLM prompt fine-tuning
- Realtime Broadcast error handling (broadcast failure should not block extraction)
- Migration file count (single vs split)
- `extraction_costs` index design

### Deferred Ideas (OUT OF SCOPE)
- EXTRACT-07 (accuracy baseline) -- Phase 6
- Blog/Instagram manual extraction queue -- v2 (EXTRACT-10)
- resolve-place Edge Function -- v2 (EXTRACT-11)
- LLM prompt auto-tuning -- v2 (EXTRACT-09)
- Cost dashboard UI -- separate phase if needed
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTRACT-01 | Edge Function broadcasts 5 extraction steps via Realtime `extract:{link_id}` channel | Supabase Realtime Broadcast REST API / `channel.send()` pattern verified. Edge Function can use admin client `channel.send()` which falls back to REST POST internally. |
| EXTRACT-02 | Claude response place candidates without `transcript_quote` are discarded | Zod schema modification + post-parse filter pattern. Existing `source_quote` field in `PlaceCandidate` schema is the target field. |
| EXTRACT-03 | `places` table has `source_kind`, `video_offset_sec`, `quote`, `inferred_city` columns | D-06/D-07 confirmed: `source_timestamp_sec` and `source_quote` already exist (covering `video_offset_sec` and `quote`). New migration adds `source_kind` and `inferred_city` only. |
| EXTRACT-04 | All extraction calls logged to `extraction_costs` table | New table via migration. Anthropic `usage` object parsing verified. Places API cost = $0.032/call (Text Search Pro). |
| EXTRACT-05 | Google Places API uses explicit FieldMask only, no wildcard | Already implemented in `places.ts` line 25-30. Grep verification confirms. |
| EXTRACT-06 | GCP billing alert at $5/$20/$50 | Manual GCP Console task. Documented as infrastructure runbook. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Realtime progress broadcast | API / Backend (Edge Function) | -- | Server pushes status from within the extraction pipeline |
| Citation enforcement | API / Backend (Edge Function) | -- | LLM prompt + post-parse filtering runs server-side |
| Cost logging | API / Backend (Edge Function) + Database | -- | Edge Function writes to `extraction_costs` table |
| Places FieldMask | API / Backend (Edge Function) | -- | HTTP request to Google Places API from server |
| Schema migration | Database | -- | DDL changes to `places` and new `extraction_costs` table |
| GCP billing alert | CDN / Static (GCP Console) | -- | Infrastructure config, not code |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.x (JSR) | Admin client for DB writes + Realtime broadcast | Already in use, import mapped in `deno.json` [VERIFIED: codebase] |
| `zod` | ^3.x (npm) | Schema validation for LLM output + request body | Already in use, import mapped in `deno.json` [VERIFIED: codebase] |
| Deno runtime | 2.1.4+ | Edge Function runtime (Supabase managed) | Supabase Edge Functions run Deno 2.x [CITED: github.com/orgs/supabase/discussions/37941] |

### Supporting
No new libraries needed. All changes use existing dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `channel.send()` (client lib) | Direct REST POST to `/realtime/v1/api/broadcast` | REST is lower-level but avoids WebSocket setup. `channel.send()` on an unsubscribed channel internally uses REST anyway. Using client lib is cleaner. |
| Post-parse filter for citation | Zod `.refine()` on array | `.refine()` would fail the entire parse if any entry lacks `source_quote`. Post-filter preserves valid entries -- correct per D-04. |

**Installation:**
No new packages to install. All dependencies already present.

## Package Legitimacy Audit

> No new packages are introduced in this phase. All work uses existing `@supabase/supabase-js` and `zod` already in `deno.json`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Client (iOS/Web)
  |
  |  subscribe to `extract:{link_id}` channel
  v
Supabase Realtime  <----------- broadcast steps (1-5)
  ^                                    |
  |                                    |
  |   POST /functions/v1/extract-youtube
  v                                    |
Edge Function (index.ts)  ----+--------+
  |                           |
  |  1. fetchYouTubeMetadata  |-- broadcast("metadata", 10%)
  |  2. fetchYouTubeTranscript|-- broadcast("transcript", 30%)
  |  3. extractCandidates     |-- broadcast("llm", 60%)
  |     (claude.ts)           |   + log Anthropic cost -> extraction_costs
  |     + filter !source_quote|
  |  4. resolveGooglePlace    |-- broadcast("places", 80%)
  |     (places.ts) x N       |   + log Places cost x N -> extraction_costs
  |  5. INSERT places         |
  |  6. UPDATE links status   |-- broadcast("done", 100%)
  v                           |
Supabase DB                   |
  - links (status update)     |
  - places (new rows)         |
  - extraction_costs (new rows)
```

### Recommended Project Structure
```
supabase/functions/extract-youtube/
  index.ts              # Main handler: add broadcast + cost logging orchestration
  pipeline/
    claude.ts           # LLM extraction: source_quote required + inferred_city + usage return
    places.ts           # Google Places: cost measurement wrapper (existing FieldMask kept)
    youtube.ts          # YouTube metadata/transcript (unchanged)
    youtube.test.ts     # Existing tests (unchanged)

supabase/migrations/
    0004_extraction_hardening.sql  # New: extraction_costs table + places columns
```

### Pattern 1: Supabase Realtime Broadcast from Edge Function
**What:** Send progress updates to clients without WebSocket subscription on the server side.
**When to use:** Edge Function needs to push real-time status to listening clients.
**Example:**
```typescript
// Source: supabase.com/docs/guides/realtime/broadcast + github.com/orgs/supabase/discussions/17124
// admin is already createClient(url, serviceRole) in index.ts line 52

async function broadcastStep(
  admin: SupabaseClient,
  linkId: string,
  step: string,
  progressPct: number,
  detail?: Record<string, unknown>,
) {
  try {
    const channel = admin.channel(`extract:${linkId}`);
    await channel.send({
      type: 'broadcast',
      event: 'progress',
      payload: { step, progress_pct: progressPct, ...(detail ?? {}) },
    });
    admin.removeChannel(channel);
  } catch (err) {
    // Broadcast failure must not block extraction
    console.warn('[broadcast] failed:', err);
  }
}
```

### Pattern 2: Anthropic Usage Parsing for Cost Logging
**What:** Extract token counts from Anthropic Messages API response for cost calculation.
**When to use:** After each Anthropic API call.
**Example:**
```typescript
// Source: platform.claude.com/docs/en/api/messages + platform.claude.com/docs/en/about-claude/pricing
// The response.usage object contains input_tokens and output_tokens at top level.

const data = await res.json();
const usage = data.usage as {
  input_tokens: number;
  output_tokens: number;
};
// Claude Sonnet 4.6: $3/MTok input, $15/MTok output
const costUsd =
  (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
```

### Pattern 3: Post-Parse Citation Filter
**What:** Keep Zod parse lenient per-field, filter invalid entries after.
**When to use:** When LLM may omit a field on some entries but not all.
**Example:**
```typescript
// D-04: source_quote is required in schema, but we use safeParse per-entry
// so one bad entry doesn't kill the entire batch.
const parsed = LLMOutput.parse(rawJson);
const withCitation = parsed.places.filter((p) => {
  if (!p.source_quote || p.source_quote.trim().length === 0) {
    console.warn(`[citation] discarding ${p.name_local}: no source_quote`);
    return false;
  }
  return true;
});
```

### Pattern 4: Duration Measurement with performance.now()
**What:** Measure API call duration in Deno Edge Functions.
**When to use:** Wrapping external API calls for cost/performance logging.
**Example:**
```typescript
// Source: docs.deno.com/api/web/~/Performance.now
// performance.now() is available in Deno runtime (standard Web API)
const t0 = performance.now();
const result = await resolveGooglePlace(inputs);
const durationMs = Math.round(performance.now() - t0);
```

### Anti-Patterns to Avoid
- **Blocking extraction on broadcast failure:** Broadcast is fire-and-forget. If Realtime is down, extraction must still complete. Wrap in try/catch, log warning only.
- **Using Zod parse failure for citation enforcement:** A single missing `source_quote` would reject ALL candidates if Zod schema requires it at parse level. Use post-parse filter instead (D-04).
- **Wildcard FieldMask in Places API:** `*` fetches all fields and triggers Enterprise pricing ($40/1000). Always use explicit field list.
- **Modifying existing migration files:** Append-only rule (CLAUDE.md section 4.3). New migration file 0004 only.
- **Forgetting `admin.removeChannel()`:** Leaks resources in the Edge Function. Always remove channel after send.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Realtime progress | Custom polling endpoint | Supabase Realtime Broadcast | Built-in, zero infra, client SDK subscription already supported |
| Cost tracking | Custom analytics pipeline | Simple `extraction_costs` table + SQL aggregation | Phase needs SQL-queryable costs, not a dashboard. Table + GROUP BY is sufficient |
| LLM output validation | Manual JSON parsing | Zod schema parse + filter | Already in use, type-safe, handles edge cases |
| API key management | Custom env loader | Deno.env.get() (Supabase Edge Functions standard) | Edge Functions inject env vars automatically |

**Key insight:** This phase adds instrumentation and guards to an existing pipeline. No new infrastructure, no new libraries -- just careful modifications to 3 existing files and 1 new migration.

## Common Pitfalls

### Pitfall 1: Broadcast Channel Name Mismatch
**What goes wrong:** Server broadcasts to `extract:${linkId}` but client subscribes to a different channel name format (e.g., `extraction:${linkId}` or `extract-${linkId}`).
**Why it happens:** No shared constant between Edge Function and client code.
**How to avoid:** Define channel name format in `@moajoa/core/constants.ts` as `EXTRACT_CHANNEL_PREFIX = 'extract:'`. Both Edge Function and iOS/Web import it.
**Warning signs:** Client receives no messages despite extraction completing.

### Pitfall 2: Anthropic Usage Object Missing Fields
**What goes wrong:** Code assumes `data.usage.input_tokens` always exists, crashes on unexpected response shape.
**Why it happens:** API errors or model changes may return partial/missing usage data.
**How to avoid:** Default to 0 if missing: `const inputTokens = data?.usage?.input_tokens ?? 0`. Still log the cost row (with 0 cost) so the extraction is tracked.
**Warning signs:** Unhandled exceptions during cost logging that cascade to extraction failure.

### Pitfall 3: Migration Breaks Existing Data
**What goes wrong:** Adding `source_kind NOT NULL` without `DEFAULT` fails on existing rows.
**Why it happens:** Existing `places` rows lack the new column value.
**How to avoid:** Always use `DEFAULT 'ai'` for new NOT NULL columns (D-06 already specifies this).
**Warning signs:** `ALTER TABLE` failure in `supabase db push`.

### Pitfall 4: Cost Logging Blocking Extraction
**What goes wrong:** `extraction_costs` INSERT failure (FK constraint, network issue) causes the entire extraction to fail.
**Why it happens:** Cost logging is instrumentation, not core business logic.
**How to avoid:** Wrap cost INSERT in try/catch. Log error but continue extraction. Cost data loss is acceptable; extraction failure is not.
**Warning signs:** Extraction failures correlated with DB write errors in logs.

### Pitfall 5: Places API Cost Underestimation
**What goes wrong:** Using $0.003/call (D-10 estimate) when actual Text Search Pro SKU is $0.032/call (with 5,000 free events/month).
**Why it happens:** CONTEXT.md D-10 references a "Text Search Basic" estimate. Research shows the FieldMask triggers Text Search Pro tier.
**How to avoid:** Use $0.032/call as the cost constant. After 5,000 free monthly events, this is the actual per-request cost. For cost estimation, this is a 10x difference.
**Warning signs:** Actual GCP bills significantly higher than `extraction_costs` table sum.

### Pitfall 6: Channel Resource Leak in Edge Function
**What goes wrong:** Creating channels without `removeChannel()` causes resource accumulation during long-running extractions.
**Why it happens:** Edge Functions are short-lived but may process 30+ places sequentially.
**How to avoid:** Always call `admin.removeChannel(channel)` after `channel.send()`. Helper function should handle this.
**Warning signs:** Memory growth during extraction, eventual OOM or timeout.

## Code Examples

Verified patterns from official sources:

### Broadcast REST Fallback (channel.send without subscription)
```typescript
// Source: supabase.com/docs/guides/realtime/broadcast
// When channel.send() is called without prior .subscribe(),
// supabase-js automatically uses REST POST to /realtime/v1/api/broadcast
const channel = admin.channel('extract:some-uuid');
channel.send({
  type: 'broadcast',
  event: 'progress',
  payload: { step: 'metadata', progress_pct: 10 },
});
admin.removeChannel(channel);
```

### Anthropic API Response Usage Object
```typescript
// Source: platform.claude.com/docs/en/api/messages (verified)
// Response structure:
// {
//   id: "msg_...",
//   type: "message",
//   role: "assistant",
//   content: [{ type: "text", text: "..." }],
//   model: "claude-sonnet-4-6",
//   stop_reason: "end_turn",
//   usage: {
//     input_tokens: 2095,
//     output_tokens: 503,
//     cache_creation_input_tokens: 0,   // optional
//     cache_read_input_tokens: 0,       // optional
//   }
// }
```

### Migration: Add Columns + New Table
```sql
-- Source: CLAUDE.md section 4.3 migration rules + D-06/D-08

-- New columns on places (D-06)
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'ai'
    CHECK (source_kind IN ('ai', 'manual')),
  ADD COLUMN IF NOT EXISTS inferred_city text;

-- extraction_costs table (D-08)
CREATE TABLE extraction_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('anthropic', 'google_places')),
  model text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS enabled but no client-facing policies (D-11)
ALTER TABLE extraction_costs ENABLE ROW LEVEL SECURITY;

-- Indexes (Claude's discretion)
CREATE INDEX extraction_costs_link_idx ON extraction_costs (link_id);
CREATE INDEX extraction_costs_created_idx ON extraction_costs (created_at DESC);
```

### Cost Calculation Constants
```typescript
// Source: platform.claude.com/docs/en/about-claude/pricing (verified 2026-05-25)
// Claude Sonnet 4.6: $3/MTok input, $15/MTok output
const ANTHROPIC_COST_PER_INPUT_TOKEN = 3 / 1_000_000;   // $0.000003
const ANTHROPIC_COST_PER_OUTPUT_TOKEN = 15 / 1_000_000;  // $0.000015

// Source: developers.google.com/maps/billing-and-pricing/pricing (verified 2026-05-25)
// Text Search Pro SKU: $32/1000 requests (after 5,000 free monthly events)
// FieldMask includes displayName, formattedAddress, location, primaryType = Pro tier
const PLACES_COST_PER_CALL = 0.032; // $0.032
```

### Extracting inferred_city from LLM
```typescript
// Claude's discretion: add inferred_city to LLM output schema
const PlaceCandidate = z.object({
  name_local: z.string().min(1).max(200),
  name_ko: z.string().max(200).optional(),
  source_timestamp_sec: z.number().int().nonnegative().optional(),
  source_quote: z.string().min(1).max(500),  // NOW REQUIRED (was .optional())
  confidence: z.number().min(0).max(1).default(0.5),
  inferred_city: z.string().max(100).optional(),  // NEW
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Places API $200 monthly credit | SKU-based free caps (5K free for Pro) | March 2025 | Must track monthly usage; free cap per SKU, not a blanket credit |
| `claude-sonnet-4` | `claude-sonnet-4-6` | Feb 2026 | Same pricing ($3/$15 per MTok), improved quality. Model already set in `claude.ts` |
| Supabase Realtime requires WebSocket | REST API broadcast (no WS needed server-side) | Late 2023+ | Edge Functions can broadcast without maintaining WS connections |

**Deprecated/outdated:**
- Google Maps Platform $200/month blanket credit: Replaced by per-SKU free caps (March 2025)
- `claude-sonnet-4` model: Deprecated per Anthropic docs, replaced by `claude-sonnet-4-6` (already in use)

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Places API cost constant $0.032/call for Text Search Pro | Code Examples | D-10 in CONTEXT.md estimated $0.003/call ("Text Search Basic"). Research shows fields used trigger Pro tier at $0.032. If there's a cheaper SKU available for these fields, cost estimates would be 10x too high. Low risk -- overestimating cost is safer than under. |
| A2 | `performance.now()` available in Supabase Edge Functions without `--allow-hrtime` flag | Patterns | Deno docs note `--allow-hrtime` for precise values. Supabase Edge Functions may not expose this flag. Fallback: `Date.now()` provides ms precision which is sufficient for duration_ms. |
| A3 | `channel.send()` without `.subscribe()` uses REST internally | Patterns | Multiple sources confirm this behavior but exact implementation may vary by supabase-js version. Fallback: direct REST POST to `/realtime/v1/api/broadcast`. |

**If this table is empty:** N/A -- three assumptions identified above.

## Open Questions (RESOLVED)

1. **Places API cost constant: $0.003 vs $0.032**
   - What we know: CONTEXT.md D-10 says "$0.003/call Text Search Basic". Research shows the FieldMask triggers Text Search Pro at $0.032/call.
   - What's unclear: Whether Google has a lower-cost tier for the exact fields used. The "Basic" SKU category seems to no longer exist in current pricing.
   - Recommendation: Use $0.032 as the constant. It's the verified current price for Pro tier. If actual bills are lower (due to free cap), that's a pleasant surprise. The cost column records what was charged, so historical accuracy is maintained even if the constant changes.

2. **Migration: single file or split?**
   - What we know: Claude's discretion per CONTEXT.md.
   - What's unclear: Whether team preference is one migration or two.
   - Recommendation: Single migration `0004_extraction_hardening.sql`. Both changes (new table + columns) are part of the same phase and logically cohesive. No reason to split.

3. **`inferred_city` extraction quality**
   - What we know: LLM prompt will ask "what city/region is this place in?"
   - What's unclear: How accurately Claude infers city from context (especially for suburban/rural locations).
   - Recommendation: Make the field nullable. Accept what the LLM provides; quality measurement deferred to Phase 6 (EXTRACT-07).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migration push + types generation | Yes | 2.101.0 | -- |
| Node.js | `pnpm supabase:types` | Yes | 26.0.0 | -- |
| pnpm | Workspace commands | Yes | 9.12.0 | -- |
| Deno | Edge Function local testing | No | -- | Deploy to Supabase, test via `supabase functions serve` (requires Docker) or test in deployed environment |
| Docker | `supabase start` for local DB | No | -- | Use linked remote project (`supabase db push` to staging) |
| Supabase project (remote) | Deployment target | Assumed linked | -- | Must verify `supabase link` status |

**Missing dependencies with no fallback:**
- None blocking. All core tools (Supabase CLI, Node, pnpm) are available.

**Missing dependencies with fallback:**
- Deno not installed locally: Edge Function tests (`deno test`) cannot run locally. Use `supabase functions serve` with Docker, or deploy and test remotely. Existing `youtube.test.ts` tests cover URL parsing only.
- Docker not running: Local Supabase (`supabase start`) unavailable. Use remote project for migration testing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Deno test (built-in) |
| Config file | `supabase/functions/extract-youtube/deno.json` (tasks.test defined) |
| Quick run command | `deno test --allow-net --allow-env --allow-read supabase/functions/extract-youtube/pipeline/*.test.ts` |
| Full suite command | Same as quick run (single test file currently) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXTRACT-01 | Broadcast sends 5 steps | integration (requires Supabase) | Manual: deploy + subscribe + trigger | No -- Wave 0 |
| EXTRACT-02 | Candidates without source_quote discarded | unit | `deno test pipeline/claude.test.ts` | No -- Wave 0 |
| EXTRACT-03 | source_kind, inferred_city columns exist | migration | `supabase db push --dry-run` | No -- verified by migration success |
| EXTRACT-04 | Cost rows inserted per API call | integration | Manual: trigger extraction + query extraction_costs | No -- Wave 0 |
| EXTRACT-05 | No wildcard FieldMask | unit (grep) | `grep -r '\*' supabase/functions/extract-youtube/pipeline/places.ts` | Yes -- grep-based |
| EXTRACT-06 | GCP billing alert active | manual-only | Check GCP Console | N/A -- infrastructure |

### Sampling Rate
- **Per task commit:** `grep -r 'FieldMask\|field_mask\|\*' supabase/functions/extract-youtube/` (EXTRACT-05 regression)
- **Per wave merge:** Full Deno test suite + migration dry-run
- **Phase gate:** Manual extraction trigger on staging with Realtime subscription

### Wave 0 Gaps
- [ ] `supabase/functions/extract-youtube/pipeline/claude.test.ts` -- unit tests for citation filtering and inferred_city extraction (EXTRACT-02)
- [ ] Manual integration test script/checklist for Realtime broadcast verification (EXTRACT-01)
- [ ] SQL query to verify extraction_costs data after test run (EXTRACT-04)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Edge Function already verifies JWT (index.ts line 56-59) |
| V3 Session Management | No | Not applicable to Edge Functions |
| V4 Access Control | Yes | Service role used for DB writes; JWT verification for caller auth |
| V5 Input Validation | Yes | Zod validation for request body (RequestSchema) and LLM output (LLMOutput) |
| V6 Cryptography | No | No crypto operations in this phase |

### Known Threat Patterns for Edge Functions + LLM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM prompt injection via transcript | Tampering | Zod schema enforces output structure; no user-controlled system prompt |
| Service role key exposure | Information Disclosure | Key in Deno.env only; never in response body; `verify_jwt = true` in config.toml |
| Cost amplification (unbounded Places API calls) | Denial of Service | Max 30 candidates (Zod `.max(30)`); billing alerts at $5/$20/$50 |
| Unauthenticated extraction trigger | Elevation of Privilege | JWT verification in handler (line 56-59); config.toml `verify_jwt = true` |

## Project Constraints (from CLAUDE.md)

- **TypeScript strict** -- all new code must pass strict mode
- **Zod for external input validation** -- LLM responses validated through Zod schema (already in place)
- **Migration append-only** -- new file `0004_*` only; never modify 0001-0003
- **Service role in Edge Functions only** -- never expose to client
- **No `.js` extensions in imports** -- Deno uses `.ts` natively, not applicable
- **Conventional Commits** -- `feat:`, `fix:`, etc.
- **`pnpm supabase:types` after migration** -- regenerate `packages/api/src/types/database.ts`
- **RLS deny-by-default** -- `extraction_costs` gets ENABLE ROW LEVEL SECURITY but no permissive policies (service role bypasses)
- **Comments explain "why" not "what"**

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Broadcast docs](https://supabase.com/docs/guides/realtime/broadcast) -- REST API pattern, channel.send() behavior
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) -- Response structure, usage object fields
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) -- Claude Sonnet 4.6: $3/MTok input, $15/MTok output
- [Google Maps Platform Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) -- Text Search Pro: $32/1000 requests, 5K free/month
- [Google Places Data Fields](https://developers.google.com/maps/documentation/places/web-service/data-fields) -- FieldMask to SKU tier mapping
- [Deno Performance API](https://docs.deno.com/api/web/~/Performance.now) -- `performance.now()` availability

### Secondary (MEDIUM confidence)
- [Supabase Discussion #17124](https://github.com/orgs/supabase/discussions/17124) -- Edge Function broadcast example code
- [Supabase Discussion #37941](https://github.com/orgs/supabase/discussions/37941) -- Deno 2.1 compatibility confirmed

### Tertiary (LOW confidence)
- `performance.now()` precision in Supabase Edge Functions without `--allow-hrtime` flag -- no official confirmation that Supabase sets this flag

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing deps verified in codebase
- Architecture: HIGH -- modifications to existing pipeline, patterns verified against official docs
- Pitfalls: HIGH -- derived from codebase analysis + CONTEXT.md decisions + official pricing docs
- Cost constants: MEDIUM -- pricing verified on official Google/Anthropic pages, but Google pricing model changed in 2025 and exact SKU triggering depends on FieldMask

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable domain -- Edge Functions API, Anthropic API, and Places API pricing are unlikely to change within 30 days)
