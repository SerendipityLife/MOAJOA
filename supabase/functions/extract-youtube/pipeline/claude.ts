// Claude-based place extraction.
//
// Why Claude (vs GPT/Gemini): we already use Anthropic SDK in other tooling,
// and Claude is strong at structured output with stop_sequences + JSON mode.
// Model: claude-sonnet-4-6 — best price/quality for extraction tasks.

import { z } from 'npm:zod@3';

const EXTRACTION_MODEL = 'claude-sonnet-4-6';

const PlaceCandidate = z.object({
  name_local: z.string().min(1).max(200),
  name_ko: z.string().max(200).optional(),
  source_timestamp_sec: z.number().int().nonnegative().optional(),
  source_quote: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1).default(0.5),
  inferred_city: z.string().max(100).optional(),
});

const LLMOutput = z.object({
  reasoning: z.string().optional(),
  places: z.array(PlaceCandidate).max(30),
});

export type ExtractedCandidates = z.infer<typeof LLMOutput>;

export interface ExtractResult {
  candidates: ExtractedCandidates;
  usage: { input_tokens: number; output_tokens: number; model: string };
}

export interface ExtractInputs {
  anthropicKey: string;
  videoTitle: string;
  description: string;
  transcript: string;
  /** ISO-ish city hint, e.g. "tokyo", "osaka". Helps LLM disambiguate. */
  cityHint: string | null;
}

export async function extractCandidatesFromContext(
  inputs: ExtractInputs,
): Promise<ExtractResult> {
  const prompt = buildPrompt(inputs);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': inputs.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      max_tokens: 2048,
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

  // Extract usage with fallback to 0 if missing (Pitfall 2)
  const inputTokens = data?.usage?.input_tokens ?? 0;
  const outputTokens = data?.usage?.output_tokens ?? 0;

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
    candidates: LLMOutput.parse(parsed),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, model: EXTRACTION_MODEL },
  };
}

const SYSTEM_PROMPT = `You are a precise extractor of physical places (restaurants, cafes, shops, attractions) from Korean and Japanese travel YouTube content. You output ONLY a JSON object matching the provided schema. You never invent places that aren't actually mentioned. You include the timestamp where each place first appears.`;

function buildPrompt(inputs: ExtractInputs): string {
  return `# Task
Extract physical places visited or recommended in this YouTube video. Skip generic mentions ("일본 음식", "in Japan") — only specific named places.

# Output schema
{
  "reasoning": "<short note on how you decided>",
  "places": [
    {
      "name_local": "<canonical name in original script — Japanese kanji/hiragana for Japan, Korean for Korea>",
      "name_ko": "<Korean reading or translation if mentioned in subtitles>",
      "source_timestamp_sec": <integer seconds from video start when place is first shown/mentioned>,
      "source_quote": "<short quote from transcript supporting this extraction (max 200 chars)>",
      "confidence": <0.0-1.0, how sure you are this is a real specific place>,
      "inferred_city": "<city or region where this place is located, e.g. 'Tokyo', 'Osaka', 'Seoul'>"
    }
  ]
}

# Constraints
- Output JSON only. No markdown fence required, but if you use one, use \`\`\`json.
- Max 30 places. Pick the most distinct.
- confidence < 0.4 → skip the entry entirely (don't include it).
- If transcript is empty, rely on description and title. Lower confidence accordingly.
- Every place MUST include source_quote — a short excerpt from the transcript proving the place was mentioned. Omitting source_quote will cause the entry to be discarded.

# Context
City hint: ${inputs.cityHint ?? '(unknown)'}
Title: ${inputs.videoTitle}

Description:
${inputs.description.slice(0, 4000)}

Transcript:
${inputs.transcript.slice(0, 12000)}`;
}

function extractJsonBlock(text: string): string {
  // Strip markdown fence if present.
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence?.[1]) return fence[1].trim();
  // Else find first { and matching closing }.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}
