// Claude-based payment extraction for forwarded booking/card mails (Phase 21 —
// LEDGER-02). Verbatim mirror of generate-plan/pipeline/claude.ts: same Anthropic
// fetch client, same temperature/JSON-fence handling, same usage fallback, same
// max_tokens truncation guard. Only the schema + prompt differ.
//
// Model: claude-sonnet-4-6 — same as extraction/planning.

import { z } from 'npm:zod@3';

const LEDGER_MODEL = 'claude-sonnet-4-6';

/**
 * LLM parse output — LOCAL re-declaration of @moajoa/core LedgerParseOutputSchema
 * (packages/core/src/schemas/ledger.ts). Deno cannot import the workspace package,
 * so this MUST mirror the canonical shape CHARACTER-FOR-CHARACTER (LEDGER-06). Every
 * field the model may omit is nullable; matched_trip_id carries only a uuid the EF
 * then intersects against the owner's trips (validateTripId, T-21-11).
 */
export const LedgerParseOutput = z.object({
  platform: z.string().nullable(),
  card_last4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  merchant: z.string().nullable(),
  amount_foreign: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  paid_at: z.string().nullable(), // ISO date/datetime as read from the mail
  krw_amount: z.number().nullable(), // KRW stated in the mail → fx_source='email' when set
  fx_rate: z.number().nullable(), // billing FX rate stated in the mail
  matched_trip_id: z.string().uuid().nullable(), // owner-trip intersection enforced in the EF
  confidence: z.enum(['high', 'low']),
});

export type LedgerParseOutputT = z.infer<typeof LedgerParseOutput>;

/** Minimal mail shape the prompt needs (from pipeline/mail.ts). */
export interface LedgerMail {
  subject: string | null;
  text: string | null;
  date: string | null;
}

/** Minimal trip shape for match disambiguation. */
export interface LedgerTrip {
  id: string;
  title: string | null;
  city_code: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface CallInputs {
  mail: LedgerMail;
  trips: LedgerTrip[];
  anthropicKey: string;
}

export interface LedgerCallResult {
  output: LedgerParseOutputT;
  usage: { input_tokens: number; output_tokens: number; model: string };
}

export async function callClaudeLedger(inputs: CallInputs): Promise<LedgerCallResult> {
  const prompt = buildLedgerPrompt(inputs.mail, inputs.trips);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': inputs.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: LEDGER_MODEL,
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
  const inputTokens = data?.usage?.input_tokens ?? 0;
  const outputTokens = data?.usage?.output_tokens ?? 0;

  if (data?.stop_reason === 'max_tokens') {
    throw new Error('anthropic output truncated at max_tokens — raise the limit');
  }

  const text = data?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('anthropic returned no text content');
  }

  return {
    output: parseLedgerOutput(text),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, model: LEDGER_MODEL },
  };
}

const SYSTEM_PROMPT =
  `너는 예약/카드 결제 알림 메일에서 결제 정보를 추출한다. ` +
  `플랫폼(Klook/Agoda/항공사/카드사 등)·카드 끝 4자리·통화(ISO 3자)·금액·결제일·` +
  `(메일에 있으면)원화 청구액·청구환율을 뽑는다. ` +
  `사용자 여행 목록이 주어지면 이 결제가 어느 여행인지 확신 있을 때만 matched_trip_id에 그 id를, 애매하면 null. ` +
  `값이 없으면 null. JSON만 출력.`;

/**
 * Build the user prompt. Exported so the test can assert the load-bearing
 * fragments (mail body injection, the trip list, the output schema).
 */
export function buildLedgerPrompt(mail: LedgerMail, trips: LedgerTrip[]): string {
  const tripLines = trips.length > 0
    ? trips
        .map((t) => {
          const title = t.title || '(제목 없음)';
          const city = t.city_code ?? 'unknown';
          const span = `${t.start_date ?? '?'}~${t.end_date ?? '?'}`;
          return `- ${t.id} | ${title} | ${city} | ${span}`;
        })
        .join('\n')
    : '  (여행 없음)';

  return `# Task
아래 전달된 예약/결제 알림 메일에서 결제 정보를 추출한다.

# Output schema
{
  "platform": "<플랫폼명 or null>",
  "card_last4": "<카드 끝 4자리 or null>",
  "merchant": "<가맹점/상품명 or null>",
  "amount_foreign": <외화 금액(숫자) or null>,
  "currency": "<ISO 4217 3자 통화 or null>",
  "paid_at": "<결제일 ISO(YYYY-MM-DD 또는 datetime) or null>",
  "krw_amount": <메일에 명시된 원화 청구액(숫자) or null>,
  "fx_rate": <메일에 명시된 청구 환율(숫자) or null>,
  "matched_trip_id": "<아래 여행 목록 중 확신 있는 uuid or null>",
  "confidence": "high" | "low"
}

# Rules
- JSON만 출력. 마크다운 펜스를 쓰면 \`\`\`json 사용.
- 값이 메일에 없으면 반드시 null. 추측 금지.
- currency는 정확히 3글자 ISO 코드(예: JPY, USD, THB).
- krw_amount/fx_rate는 메일에 실제로 명시된 경우에만 채운다(카드사 원화 청구액/청구환율).
- matched_trip_id는 아래 목록에 있는 id만, 결제일·도시가 여행 기간·지역과 명확히 맞을 때만. 애매하면 null.
- 핵심 필드(금액·통화)가 명확하면 confidence="high", 불확실하면 "low".

# 사용자 여행 목록 (${trips.length})
${tripLines}

# 메일
제목: ${mail.subject ?? '(없음)'}
날짜: ${mail.date ?? '(없음)'}
본문:
${mail.text ?? '(본문 없음)'}`;
}

/** Parse Claude's text response → validated LedgerParseOutput (fence-strip + Zod). */
export function parseLedgerOutput(text: string): LedgerParseOutputT {
  const jsonStr = extractJsonBlock(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`failed to parse LLM JSON: ${(err as Error).message}\n---\n${jsonStr.slice(0, 500)}`);
  }
  return LedgerParseOutput.parse(parsed);
}

/**
 * Defensive trip-id validation (T-21-11, validatePlanIds idiom). Mail bodies are
 * an untrusted prompt-injection surface: a hostile mail could make Claude emit a
 * matched_trip_id the forwarder does not own. We keep the id ONLY when it is in
 * the intersection of the owner's actual trip ids; otherwise null (unclassified).
 */
export function validateTripId(inputTripIds: string[], matched: string | null): string | null {
  if (matched === null) return null;
  return inputTripIds.includes(matched) ? matched : null;
}

function extractJsonBlock(text: string): string {
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fence?.[1]) return fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}
