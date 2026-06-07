import { assertEquals, assertStringIncludes, assertThrows } from 'jsr:@std/assert';
import { buildPrompt, LLMOutput } from './claude.ts';

// Fixed inputs for the prompt snapshot tests.
const FIXTURE = {
  anthropicKey: 'k',
  videoTitle: 'T',
  description: 'D',
  transcript: 'X',
  cityHint: 'tokyo' as string | null,
};

// The exact YouTube prompt for FIXTURE inputs, captured BEFORE the sourceKind
// change. If this assertion ever fails, the youtube prompt drifted (regression).
const YOUTUBE_PROMPT_REGRESSION_0 = `# Task
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
- If transcript is empty, rely on the description and title. The description often lists places with timestamps (e.g. "00:35 스시집"). Lower confidence accordingly.
- Every place MUST include source_quote — a short excerpt from the transcript OR the description proving the place was mentioned. Omitting source_quote will cause the entry to be discarded.
- summary_ko / video_summary_ko: 반드시 한국어로. 영상이 일본어/영어여도 한국어로 작성.
- 해설은 자막·설명에 실제 근거가 있을 때만 작성. 근거 없으면 비워라(지어내지 마라). source_quote 규칙과 동일한 grounding.

# Context
City hint: tokyo
Title: T

Description:
D

Transcript:
X`;

Deno.test('buildPrompt — youtube regression 0 (omitted sourceKind, byte-identical)', () => {
  assertEquals(buildPrompt(FIXTURE), YOUTUBE_PROMPT_REGRESSION_0);
});

Deno.test('buildPrompt — explicit sourceKind=youtube matches the regression snapshot', () => {
  assertEquals(buildPrompt({ ...FIXTURE, sourceKind: 'youtube' }), YOUTUBE_PROMPT_REGRESSION_0);
});

Deno.test('buildPrompt — blog uses "Article body:" label and drops timestamp guidance', () => {
  const out = buildPrompt({ ...FIXTURE, sourceKind: 'blog' });
  assertStringIncludes(out, 'Article body:');
  // timestamp guidance sentence must be gone for blog
  assertEquals(out.includes('lists places with timestamps'), false);
});

Deno.test('buildPrompt — instagram uses "Caption:" label', () => {
  const out = buildPrompt({ ...FIXTURE, sourceKind: 'instagram' });
  assertStringIncludes(out, 'Caption:');
  assertEquals(out.includes('lists places with timestamps'), false);
});

Deno.test('LLMOutput accepts place WITH summary_ko', () => {
  const result = LLMOutput.parse({
    places: [{ name_local: '스시O', source_quote: 'q', summary_ko: '1~2문장' }],
  });
  assertEquals(result.places[0].summary_ko, '1~2문장');
});

Deno.test('LLMOutput accepts place WITHOUT summary_ko (optional)', () => {
  const result = LLMOutput.parse({
    places: [{ name_local: '스시O', source_quote: 'q' }],
  });
  assertEquals(result.places[0].summary_ko, undefined);
});

Deno.test('LLMOutput accepts video_summary_ko', () => {
  const result = LLMOutput.parse({ places: [], video_summary_ko: '영상 TL;DR' });
  assertEquals(result.video_summary_ko, '영상 TL;DR');
});

Deno.test('LLMOutput accepts omitted video_summary_ko', () => {
  const result = LLMOutput.parse({ places: [] });
  assertEquals(result.video_summary_ko, undefined);
});

Deno.test('LLMOutput rejects non-string summary_ko', () => {
  assertThrows(() =>
    LLMOutput.parse({
      places: [{ name_local: 'x', source_quote: 'q', summary_ko: 123 }],
    })
  );
});
