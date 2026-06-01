import { LOW_CONFIDENCE_THRESHOLD } from '@moajoa/core';

/**
 * Build a Google Maps Marker icon URL (SVG data URL) that visually encodes
 * pin trust per Phase 5 TRUST-01 + D-06/D-15 + UI-SPEC §Component States.
 *
 * Color/opacity matrix (web parity with iOS — D-24):
 * | source_kind | confidence              | fill      | fill-opacity | "?" badge |
 * |-------------|-------------------------|-----------|--------------|-----------|
 * | manual      | (any — null/undefined)  | #111827   | 1.0          | no        |
 * | ai          | null/undefined          | #2979FF   | 1.0          | no        |
 * | ai          | >= 0.7                  | #2979FF   | 1.0          | no        |
 * | ai          | <  0.7                  | #2979FF   | 0.45         | yes       |
 *
 * Stale-payload fallback (D-15 + plan note): undefined confidence on AI pin
 * is treated as high-confidence so Vercel ISR misses during 0006 rollout
 * don't degrade trusted markers. Only a numeric value below 0.7 triggers
 * the low-confidence visual.
 *
 * Pure function: no SVG injection surface — only static color/opacity
 * literals interpolated. Never include user-supplied strings (T-05-05-01).
 */
export function buildMarkerIconUrl(input: {
  source_kind: 'ai' | 'manual';
  confidence: number | null | undefined;
}): string {
  const isAi = input.source_kind === 'ai';
  const conf = input.confidence;
  const isLowConf =
    isAi && typeof conf === 'number' && conf < LOW_CONFIDENCE_THRESHOLD;

  const fill = isAi ? '#2979FF' : '#111827'; // brand-500 (AI) · neutral-900 (manual)
  const fillOpacity = isLowConf ? 0.45 : 1.0;
  const showQ = isLowConf;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">` +
    `<path d="M16 0C7.16 0 0 7.16 0 16c0 9.6 16 24 16 24s16-14.4 16-24C32 7.16 24.84 0 16 0z" fill="${fill}" fill-opacity="${fillOpacity}"/>` +
    (showQ
      ? `<text x="16" y="22" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#ffffff">?</text>`
      : '') +
    `</svg>`;

  return `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`;
}
