import { z } from 'zod';

// Phase 21 — travel ledger contract (LEDGER-02/03/06). This is the single seam every
// downstream consumer imports: parse-email EF (21-04), @moajoa/api (21-03), iOS (21-05).
// Enum values are locked CHARACTER-FOR-CHARACTER to the 0022 ledger_entries CHECK
// constraints — any drift breaks the pipeline at runtime.

/**
 * Ledger pipeline status. Matches 0022 CHECK:
 *   status in ('pending','processing','ready','needs_review','failed').
 * pending/processing = claim scan (0022 partial index); needs_review = low-confidence
 * parse the owner must fix (needsReview predicate); failed = unrecoverable parse.
 */
export const LedgerStatus = [
  'pending',
  'processing',
  'ready',
  'needs_review',
  'failed',
] as const;
export type LedgerStatusType = (typeof LedgerStatus)[number];

/**
 * Origin of the applied FX rate. Matches 0022 CHECK:
 *   fx_source in ('email','frankfurter','unavailable').
 * email = rate/KRW stated in the forwarded mail; frankfurter = Frankfurter lookup at
 * paid_at (fx_as_of = response date, may be prior business day); unavailable = no rate.
 */
export const FxSource = ['email', 'frankfurter', 'unavailable'] as const;
export type FxSourceType = (typeof FxSource)[number];

/** 3-letter ISO 4217 currency (open set — not enumerated). Mirrors 0022 char_length(currency)=3. */
export const CurrencySchema = z.string().length(3);

/**
 * A ledger row (0022 ledger_entries). The 5-element FX record — amount_foreign ①
 * currency ② fx_rate ③ fx_source ④ fx_as_of ⑤ — is stored atomically; amount_krw is a
 * DERIVED display value (deriveAmountKrw), never a source of truth (Pitfall 4). trip_id
 * is NULLABLE: an unclassified entry is owner-private until assigned a trip (D-05).
 */
export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  owner_user_id: z.string().uuid(),
  trip_id: z.string().uuid().nullable(),
  status: z.enum(LedgerStatus),
  platform: z.string().nullable(),
  merchant: z.string().nullable(),
  card_last4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  amount_foreign: z.number().nullable(),
  currency: CurrencySchema.nullable(),
  fx_rate: z.number().nullable(),
  fx_source: z.enum(FxSource).nullable(),
  fx_as_of: z.string().nullable(), // ISO date (Frankfurter response date)
  amount_krw: z.number().nullable(), // derived (deriveAmountKrw), not a source column
  paid_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

/**
 * LLM parse output contract (LEDGER-06). This is the DEFINITIVE shape — parse-email's
 * pipeline/claude.ts (21-04) re-declares it locally but MUST match this. Every field the
 * model may omit is nullable; matched_trip_id carries only a uuid the EF then intersects
 * against the owner's trips (T-21-07 defense lives in the EF, not here).
 */
export const LedgerParseOutputSchema = z.object({
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
  matched_trip_id: z.string().uuid().nullable(), // owner-trip intersection is enforced in the EF
  confidence: z.enum(['high', 'low']),
});
export type LedgerParseOutput = z.infer<typeof LedgerParseOutputSchema>;

/**
 * KRW display value = amount_foreign × fx_rate (Pitfall 4: KRW is derived, never a source).
 * Returns null when either input is null so an FX-unavailable row survives without a KRW.
 * Rounded to the won (KRW has no minor unit).
 */
export function deriveAmountKrw(
  amount_foreign: number | null,
  fx_rate: number | null,
): number | null {
  if (amount_foreign === null || fx_rate === null) return null;
  return Math.round(amount_foreign * fx_rate);
}

/** Render/route predicate — a row the owner must manually fix (D-05, low-confidence parse). */
export function needsReview(status: LedgerStatusType): boolean {
  return status === 'needs_review';
}
