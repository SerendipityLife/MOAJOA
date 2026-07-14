import { LOW_CONFIDENCE_THRESHOLD } from '@moajoa/core';
import { palette } from './palette';

/**
 * Build a Google Maps Marker icon URL (SVG data URL) that visually encodes
 * pin trust per Phase 5 TRUST-01 + D-06/D-15 + UI-SPEC §Component States.
 *
 * Color/opacity matrix (web parity with iOS — D-24):
 * | source_kind | confidence              | fill      | fill-opacity | "?" badge |
 * |-------------|-------------------------|-----------|--------------|-----------|
 * | manual      | (any — null/undefined)  | #111827   | 1.0          | no        |
 * | ai          | null/undefined          | #2A6ACB   | 1.0          | no        |
 * | ai          | >= 0.7                  | #2A6ACB   | 1.0          | no        |
 * | ai          | <  0.7                  | #2A6ACB   | 0.45         | yes       |
 *
 * Stale-payload fallback (D-15 + plan note): undefined confidence on AI pin
 * is treated as high-confidence so Vercel ISR misses during 0006 rollout
 * don't degrade trusted markers. Only a numeric value below 0.7 triggers
 * the low-confidence visual.
 *
 * Pure function: no SVG injection surface — only static color/opacity
 * literals interpolated. Never include user-supplied strings (T-05-05-01).
 *
 * `fill` (optional, Phase 24 D-20) overrides the source_kind fill so member
 * pins can carry their memberColor. It MUST be a palette literal (e.g. a
 * palette.member[…] value) — never a user string, preserving the no-injection
 * contract (T-24-04). When omitted, output is identical to before.
 *
 * `label` (optional, Phase 28 D-16) draws the Day visit order on the pin so the
 * map numbers match the timeline badges. Its type is `number` — that IS the
 * injection contract (T-28-05 / HC-6): only String(number) is ever interpolated,
 * so place names and other user strings can never reach the SVG. A label wins
 * over the low-confidence "?" badge (they share the same slot). When omitted,
 * output is identical to before, byte for byte.
 */
export function buildMarkerIconUrl(input: {
  source_kind: 'ai' | 'manual';
  confidence: number | null | undefined;
  fill?: string;
  label?: number;
}): string {
  const isAi = input.source_kind === 'ai';
  const conf = input.confidence;
  const isLowConf = isAi && typeof conf === 'number' && conf < LOW_CONFIDENCE_THRESHOLD;

  // Single source: lib/palette — palette changes propagate without touching this file.
  // Explicit fill (palette literal only) wins over the source_kind default.
  const fill = input.fill ?? (isAi ? palette.brand[600] : palette.neutral[900]); // brand-600 (AI) · neutral-900 (manual)
  const fillOpacity = isLowConf ? 0.45 : 1.0;
  const hasLabel = typeof input.label === 'number';
  // A number label owns the badge slot; the "?" only shows when there is none.
  const showQ = isLowConf && !hasLabel;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">` +
    `<path d="M16 0C7.16 0 0 7.16 0 16c0 9.6 16 24 16 24s16-14.4 16-24C32 7.16 24.84 0 16 0z" fill="${fill}" fill-opacity="${fillOpacity}"/>` +
    (hasLabel
      ? `<text x="16" y="22" text-anchor="middle" font-size="15" font-weight="600" font-family="sans-serif" fill="#ffffff">${String(input.label)}</text>`
      : '') +
    (showQ
      ? `<text x="16" y="22" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#ffffff">?</text>`
      : '') +
    `</svg>`;

  return `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`;
}
