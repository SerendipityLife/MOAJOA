// Claude-based itinerary clustering (Phase 18).
//
// Near-clone of extract-youtube/pipeline/claude.ts: same Anthropic fetch client,
// same temperature/JSON-fence handling, same usage fallback. Only the schema +
// prompt differ. Output is just an id→day→order mapping (far smaller than the
// extraction place objects), so max_tokens is 4096.
//
// Model: claude-sonnet-4-6 — same as extraction.

import { z } from 'npm:zod@3';

const PLAN_MODEL = 'claude-sonnet-4-6';

/** Claude's plan output: days (each an ordered list of input place ids) +
 * an unplaced pool. place_ids MUST be UUIDs drawn from the input set; the
 * caller's validatePlanIds enforces the intersection (Pitfall 6). */
export const PlanLLMOutput = z.object({
  reasoning: z.string().optional(),
  days: z.array(
    z.object({
      day_index: z.number().int().min(0),
      items: z.array(
        z.object({
          place_id: z.string().uuid(),
          sort_order: z.number().int().min(0),
        }),
      ),
    }),
  ),
  unplaced: z.array(z.string().uuid()),
});

export type PlanLLMOutputT = z.infer<typeof PlanLLMOutput>;

/** Minimal place shape the prompt needs for geo-clustering. */
export interface PlanPlace {
  id: string;
  name_ko: string | null;
  name_local: string | null;
  lat: number;
  lng: number;
  category: string | null;
  summary_ko: string | null;
}

/** "이 장소는 반드시 이 Day에" — 사용자가 손으로 배치한 항목 (D-21). */
export interface PinnedPlacement {
  place_id: string;
  day_index: number;
}

export interface PlanInputs {
  /** N = trips.day_count, else the inclusive count from start_date..end_date (D-09). */
  dayCount: number;
  /** Placeable places (already filtered: hidden + (0,0) excluded). */
  places: PlanPlace[];
  /** 필수 ids — must appear in a day, recluster around them (D-10). */
  anchorIds: string[];
  /** ids the user explicitly removed — must NOT appear (D-11). */
  removedIds: string[];
  /**
   * 수동 배치 Day 고정 힌트 (D-21). The prompt asks Claude to respect these, but the
   * prompt is only the polite path — enforcePinnedPlacements force-holds them after
   * the fact, because an LLM constraint is not a guarantee.
   */
  pinnedPlacements: PinnedPlacement[];
}

export interface CallInputs extends PlanInputs {
  anthropicKey: string;
}

export interface PlanCallResult {
  output: PlanLLMOutputT;
  usage: { input_tokens: number; output_tokens: number; model: string };
}

export async function callClaudePlan(inputs: CallInputs): Promise<PlanCallResult> {
  const prompt = buildPlanPrompt(inputs);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': inputs.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: PLAN_MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`anthropic api error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const inputTokens = data?.usage?.input_tokens ?? 0;
  const outputTokens = data?.usage?.output_tokens ?? 0;

  if (data?.stop_reason === 'max_tokens') {
    throw new Error('anthropic output truncated at max_tokens — raise the limit or reduce place count');
  }

  const text = data?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('anthropic returned no text content');
  }

  const jsonStr = extractJsonBlock(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`failed to parse LLM JSON: ${(err as Error).message}\n---\n${jsonStr.slice(0, 500)}`);
  }

  return {
    output: PlanLLMOutput.parse(parsed),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, model: PLAN_MODEL },
  };
}

const SYSTEM_PROMPT =
  `You are a precise itinerary planner for 일본 도시 자유여행 (Japanese-city free travel). ` +
  `You receive a fixed set of saved places (each with a UUID, name, coordinates, category) and a number of days. ` +
  `You geo-cluster them into a day-by-day route and select an unplaced pool. ` +
  `You output ONLY a JSON object matching the provided schema — no prose outside the JSON. ` +
  `You never invent place ids: every place_id you emit MUST be copied verbatim from the input list.`;

/**
 * Build the user prompt. Exported so the test can assert the load-bearing
 * fragments (N-day count, soft cap, geo-cluster rule, anchor ids).
 */
export function buildPlanPrompt(inputs: PlanInputs): string {
  const anchorSet = new Set(inputs.anchorIds);

  // place_id → pinned day (1-based for the prompt; the contract is 0-based).
  const pinnedDayById = new Map<string, number>();
  for (const p of inputs.pinnedPlacements) pinnedDayById.set(p.place_id, p.day_index);

  const placeLines = inputs.places
    .map((p) => {
      const name = p.name_ko || p.name_local || '(이름 없음)';
      const anchorTag = anchorSet.has(p.id) ? ' [필수/ANCHOR]' : '';
      const pinnedDay = pinnedDayById.get(p.id);
      const pinnedTag = pinnedDay === undefined ? '' : ` [${pinnedDay + 1}일차 고정/PINNED]`;
      const summary = p.summary_ko ? ` — ${p.summary_ko}` : '';
      return `- ${p.id} | ${name} | (${p.lat},${p.lng}) | ${p.category ?? 'other'}${anchorTag}${pinnedTag}${summary}`;
    })
    .join('\n');

  const anchorLine = inputs.anchorIds.length > 0
    ? inputs.anchorIds.map((id) => `  - ${id}`).join('\n')
    : '  (none)';

  // Empty pinned → the whole block is omitted, so the prompt is byte-identical to
  // the pre-D-21 one (the existing prompt tests are the 무회귀 anchor).
  const pinnedConstraint = inputs.pinnedPlacements.length > 0
    ? `\n- 사용자가 직접 배치한 [PINNED] 장소는 지정된 day_index에 **고정**이다. 다른 day로 옮기지 말고, unplaced 풀에도 넣지 마라. 나머지 장소를 이 고정 장소들 주변으로 다시 클러스터링하라 (D-21). 고정 목록 (place_id → day_index):\n` +
      inputs.pinnedPlacements
        .map((p) => `  - ${p.place_id} → day_index ${p.day_index} (${p.day_index + 1}일차 고정)`)
        .join('\n')
    : '';

  return `# Task
Cluster these saved places into a ${inputs.dayCount}-day itinerary for a 일본 도시 자유여행 trip.
Group places that are near each other into the same day, order each day as an efficient route, and move any leftover places into the unplaced pool.

# Output schema
{
  "reasoning": "<short note on how you clustered>",
  "days": [
    { "day_index": <0-based day number, 0..${inputs.dayCount - 1}>,
      "items": [ { "place_id": "<uuid copied verbatim from the place list>", "sort_order": <0-based visit order within the day> } ] }
  ],
  "unplaced": [ "<uuid>", ... ]
}

# Constraints
- Output JSON only. No markdown fence required, but if you use one, use \`\`\`json.
- There are exactly ${inputs.dayCount} day(s). day_index ranges 0..${inputs.dayCount - 1}. Never exceed ${inputs.dayCount} days.
- Soft cap 4–5 places per day. If a cluster overflows, push the overflow to the next day (still within ${inputs.dayCount} days); only when no day has room does a place go to the unplaced pool (D-04).
- Geo-cluster first: places in the same neighborhood/area belong to the same day. Use the (lat,lng) coordinates — a same-day route should not zig-zag across the city (D-03).
- Light category mix: avoid all-food or all-culture days where the cluster allows variety; do not force it across neighborhoods (D-06).
- Anchor (필수) places MUST be placed into a day — never the unplaced pool — and the day should be reclustered around them (D-10). Anchor ids:
${anchorLine}
- Every place_id MUST be one of the ids in the place list below — copy it verbatim. Never invent or alter an id.
- Every input place must appear EXACTLY once across days ∪ unplaced. Do not drop or duplicate a place.${pinnedConstraint}

# Places (${inputs.places.length})
${placeLines}`;
}

/**
 * Defensive id-validation (Pitfall 6 / FK safety). Claude output is untrusted:
 * - strip any place_id not in the input set (hallucinated → FK violation);
 * - dedup: a place placed twice keeps its FIRST placement; a place that is both
 *   placed and pooled stays placed only;
 * - never drop a user's place: any input id absent from days ∪ unplaced is
 *   auto-appended to the unplaced pool.
 */
export function validatePlanIds(inputPlaceIds: string[], out: PlanLLMOutputT): PlanLLMOutputT {
  const inputSet = new Set(inputPlaceIds);
  const seen = new Set<string>();

  const days = out.days.map((day) => {
    const items = day.items.filter((item) => {
      if (!inputSet.has(item.place_id)) return false; // hallucinated / unknown id
      if (seen.has(item.place_id)) return false; // duplicate placement
      seen.add(item.place_id);
      return true;
    });
    return { day_index: day.day_index, items };
  });

  const placed = seen; // every id now in a day
  const unplaced: string[] = [];
  for (const id of out.unplaced) {
    if (!inputSet.has(id)) continue; // unknown
    if (placed.has(id)) continue; // already placed → not also pooled
    if (unplaced.includes(id)) continue; // dedup pool
    unplaced.push(id);
  }

  // Never drop: any input place absent from both days and unplaced → pool.
  for (const id of inputPlaceIds) {
    if (!placed.has(id) && !unplaced.includes(id)) unplaced.push(id);
  }

  return { reasoning: out.reasoning, days, unplaced };
}

/**
 * Force-hold user-pinned placements (D-21). The prompt *asks* Claude to keep a
 * hand-placed place on its day; this *guarantees* it. Same layer as validatePlanIds
 * (T-18-12): LLM output is untrusted, so the invariant is re-established in code.
 *
 * Also the security boundary for the pinned hint itself — `pinned_placements` crosses
 * the browser→EF trust boundary and is untrusted input:
 *  1. intersect with `inputPlaceIds` (this trip's placeable set) — another trip's place
 *     or a hallucinated uuid is dropped, never injected (T-28-09 / FK safety);
 *  2. clamp day_index into [0, dayCount-1] — no negative or out-of-range day (T-28-10);
 *  3. remove each pinned id from every day AND the pool first, then append it to its day —
 *     so a pinned place ends up exactly once (never dropped, never duplicated).
 *
 * MUST be called AFTER validatePlanIds (hallucinated ids stripped → then pins forced).
 * sort_order is not re-numbered here: index.ts renumbers by array index on insert.
 */
export function enforcePinnedPlacements(
  inputPlaceIds: string[],
  pinned: PinnedPlacement[],
  dayCount: number,
  out: PlanLLMOutputT,
): PlanLLMOutputT {
  if (pinned.length === 0) return out; // no-op — byte-identical output (무회귀)

  const inputSet = new Set(inputPlaceIds);
  const maxDay = Math.max(0, dayCount - 1);

  // (1) intersect + (2) clamp. Duplicate place_id in the hint → last one wins.
  const targetDayById = new Map<string, number>();
  for (const p of pinned) {
    if (!inputSet.has(p.place_id)) continue; // T-28-09: foreign / hallucinated id
    targetDayById.set(p.place_id, Math.min(maxDay, Math.max(0, p.day_index))); // T-28-10
  }
  if (targetDayById.size === 0) return out;

  // (3) strip the pinned ids from wherever the LLM put them.
  const days = out.days.map((day) => ({
    day_index: day.day_index,
    items: day.items.filter((item) => !targetDayById.has(item.place_id)),
  }));
  const unplaced = out.unplaced.filter((id) => !targetDayById.has(id));

  // (4) append each to its designated day, creating the day if the LLM omitted it.
  const dayByIndex = new Map<number, (typeof days)[number]>();
  for (const day of days) dayByIndex.set(day.day_index, day);

  for (const [placeId, dayIndex] of targetDayById) {
    let day = dayByIndex.get(dayIndex);
    if (!day) {
      day = { day_index: dayIndex, items: [] };
      dayByIndex.set(dayIndex, day);
      days.push(day);
    }
    day.items.push({ place_id: placeId, sort_order: day.items.length });
  }

  days.sort((a, b) => a.day_index - b.day_index);
  return { reasoning: out.reasoning, days, unplaced };
}

function extractJsonBlock(text: string): string {
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence?.[1]) return fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}
