// FX resolution for the ledger's 5-element FX record (Phase 21 — LEDGER-03).
//
// Mirrors generate-plan/pipeline/routes.ts null-on-failure idiom (try/catch→null,
// !ok→null, optional chaining). Source precedence (D-06):
//   1. mail states KRW/rate  → fx_source='email'      (the real billed amount = truth)
//   2. Frankfurter at paid_at → fx_source='frankfurter' (ECB; weekend → prior biz day)
//   3. both fail              → fx_source='unavailable'  (row survives with null rate)
//
// fx_as_of is the Frankfurter RESPONSE date (data.date), NOT the requested date —
// a weekend paid_at returns the prior business day's rate (RESEARCH, Pitfall — fx_as_of).

// FxSource mirrors @moajoa/core FxSource (packages/core/src/schemas/ledger.ts) —
// kept local so fx.ts is self-contained (Deno cannot import the workspace package).
export type FxSource = 'email' | 'frankfurter' | 'unavailable';

export interface FxResult {
  fx_rate: number | null;
  fx_source: FxSource;
  fx_as_of: string | null; // ISO date (YYYY-MM-DD)
  amount_krw: number | null;
}

/**
 * Resolve the applied FX rate + derived KRW.
 * @param currency ISO 4217 (or null → unavailable)
 * @param paidDate ISO date/datetime as read from the mail (or null)
 * @param amountForeign the foreign-currency amount (needed to derive KRW / back-compute rate)
 * @param mailKrw KRW billed amount stated in the mail (→ fx_source='email' when set)
 * @param mailRate billing FX rate stated in the mail
 */
export async function resolveFx(
  currency: string | null,
  paidDate: string | null,
  amountForeign: number | null,
  mailKrw: number | null,
  mailRate: number | null,
): Promise<FxResult> {
  const dateOnly = toDateOnly(paidDate);

  // ---- KRW currency short-circuit: no foreign conversion, rate is 1. --------
  if (currency === 'KRW') {
    return {
      fx_rate: 1,
      fx_source: 'email',
      fx_as_of: dateOnly,
      amount_krw: mailKrw ?? amountForeign ?? null,
    };
  }

  // ---- 1. Mail-stated values win (real billed amount = truth). --------------
  if (mailKrw !== null || mailRate !== null) {
    const rate =
      mailRate ??
      (mailKrw !== null && amountForeign !== null && amountForeign !== 0
        ? mailKrw / amountForeign
        : null);
    return {
      fx_rate: rate,
      fx_source: 'email',
      fx_as_of: dateOnly,
      amount_krw: mailKrw ?? (rate !== null && amountForeign !== null ? Math.round(amountForeign * rate) : null),
    };
  }

  // ---- 2. Frankfurter historical fallback (null-on-failure). ----------------
  if (currency !== null && dateOnly !== null) {
    const looked = await fetchFrankfurter(currency, dateOnly);
    if (looked !== null) {
      return {
        fx_rate: looked.rate,
        fx_source: 'frankfurter',
        fx_as_of: looked.date, // RESPONSE date (may be prior business day)
        amount_krw: amountForeign !== null ? Math.round(amountForeign * looked.rate) : null,
      };
    }
  }

  // ---- 3. Nothing available — row survives without a rate. ------------------
  return { fx_rate: null, fx_source: 'unavailable', fx_as_of: null, amount_krw: null };
}

/** Frankfurter lookup → { rate, date } or null on any failure (routes.ts idiom). */
async function fetchFrankfurter(
  currency: string,
  dateOnly: string,
): Promise<{ rate: number; date: string } | null> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.frankfurter.dev/v1/${dateOnly}?base=${currency}&symbols=KRW`,
    );
  } catch {
    return null; // network failure → best-effort null
  }
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const rate = data?.rates?.KRW;
  const date = data?.date;
  if (typeof rate !== 'number' || typeof date !== 'string') return null;
  return { rate, date };
}

/** Normalize an ISO date/datetime to YYYY-MM-DD, or null. */
export function toDateOnly(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
