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
  summary_ko: z.string().max(500).optional(),
  source_timestamp_sec: z.number().int().nonnegative().optional(),
  source_quote: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1).default(0.5),
  inferred_city: z.string().max(100).optional(),
});

export const LLMOutput = z.object({
  reasoning: z.string().optional(),
  places: z.array(PlaceCandidate).max(30),
  video_summary_ko: z.string().max(800).optional(),
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
  /**
   * Source of the body text. Default 'youtube' keeps the prompt byte-identical
   * (regression 0). 'blog'/'instagram' only change the body label + the
   * timestamp-guidance line; schema + grounding rules are unchanged.
   */
  sourceKind?: 'youtube' | 'blog' | 'instagram';
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

const SYSTEM_PROMPT = `You are a precise extractor of physical places (restaurants, cafes, shops, attractions) from Korean and Japanese travel YouTube content. You output ONLY a JSON object matching the provided schema. You never invent places that aren't actually mentioned. You include the timestamp where each place first appears. You also write short Korean commentary grounded strictly in the provided transcript/description; if there is no grounding, you leave it empty rather than inventing.`;

/**
 * Build the user prompt. Exported for the youtube regression-0 snapshot test.
 * Only the body-section label and the timestamp-guidance constraint line vary by
 * sourceKind; the default 'youtube' path is byte-identical to the original prompt.
 */
export function buildPrompt(inputs: ExtractInputs): string {
  const kind = inputs.sourceKind ?? 'youtube';

  // Body-section label: youtube transcripts vs. blog article body vs. IG caption.
  // Colon is part of the label so the youtube line stays byte-identical (`Transcript:`).
  const bodyLabel = kind === 'blog' ? 'Article body:' : kind === 'instagram' ? 'Caption:' : 'Transcript:';

  // Timestamp guidance only makes sense for youtube (timestamped transcripts).
  // For article/caption sources, tell the LLM there are no timestamps to rely on.
  const timestampGuidance = kind === 'youtube'
    ? `- If transcript is empty, rely on the description and title. The description often lists places with timestamps (e.g. "00:35 스시집"). Lower confidence accordingly.`
    : `- This source is a ${kind === 'blog' ? 'blog article' : 'social caption'} with no timestamps. Leave source_timestamp_sec out. If the body is sparse, rely on the description and title.`;

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
      "source_quote": "<short quote from the transcript or description supporting this extraction (max 200 chars)>",
      "confidence": <0.0-1.0, how sure you are this is a real specific place>,
      "summary_ko": "<1~2문장 한국어 해설, 자막·설명 근거 범위 내에서만. 근거 없으면 빈 문자열로 생략>",
      "inferred_city": "<city or region where this place is located, e.g. 'Tokyo', 'Osaka', 'Seoul'>"
    }
  ],
  "video_summary_ko": "<영상 전체 2~3문장 한국어 TL;DR. 자막·설명 근거 범위 내에서만>"
}

# Constraints
- Output JSON only. No markdown fence required, but if you use one, use \`\`\`json.
- Max 30 places. Pick the most distinct.
- confidence < 0.4 → skip the entry entirely (don't include it).
${timestampGuidance}
- Every place MUST include source_quote — a short excerpt from the transcript OR the description proving the place was mentioned. Omitting source_quote will cause the entry to be discarded.
- summary_ko / video_summary_ko: 반드시 한국어로. 영상이 일본어/영어여도 한국어로 작성.
- 해설은 자막·설명에 실제 근거가 있을 때만 작성. 근거 없으면 비워라(지어내지 마라). source_quote 규칙과 동일한 grounding.

# Context
City hint: ${inputs.cityHint ?? '(unknown)'}
Title: ${inputs.videoTitle}

Description:
${inputs.description.slice(0, 4000)}

${bodyLabel}
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
