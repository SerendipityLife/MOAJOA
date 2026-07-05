// MIME parsing for the forwarded-mail ledger pipeline (Phase 21 — LEDGER-02).
//
// postal-mime (npm:postal-mime@2) is the browser/serverless/Workers-supported
// parser RESEARCH selected. We keep normalization MINIMAL: a forwarded card /
// booking mail wraps the original inside quoting/headers, and we deliberately
// pass that wrapper straight to Claude rather than trying to unwrap it here —
// the LLM absorbs the forwarded framing better than a brittle regex would.

import PostalMime from 'postal-mime';

export interface ParsedMail {
  subject: string | null;
  from: string | null;
  text: string | null;
  html: string | null;
  /** ISO date/datetime string from the mail's Date header, or null. */
  date: string | null;
}

/**
 * Parse a raw MIME string into the fields Claude needs. `text` is preferred;
 * when a mail is HTML-only we derive a plaintext-ish body by stripping tags
 * (no full HTML→text engine — the LLM tolerates loose whitespace).
 */
export async function parseMime(raw: string): Promise<ParsedMail> {
  const email = await PostalMime.parse(raw);

  const text = typeof email.text === 'string' && email.text.length > 0 ? email.text : null;
  const html = typeof email.html === 'string' && email.html.length > 0 ? email.html : null;

  // from is an Address object ({ address, name }); fall back to the raw string.
  let from: string | null = null;
  if (email.from) {
    from = email.from.address ?? email.from.name ?? null;
  }

  return {
    subject: email.subject ?? null,
    from,
    text: text ?? (html ? stripHtml(html) : null),
    html,
    date: email.date ?? null,
  };
}

/** Minimal HTML→text: drop script/style, tags→space, collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
