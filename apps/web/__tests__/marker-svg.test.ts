import { describe, expect, it } from 'vitest';
import { buildMarkerIconUrl } from '@/lib/marker-svg';

/**
 * Pure-function tests for the SVG data URL builder consumed by
 * Google Maps Marker icons (Phase 5 TRUST-01). Catches the color/opacity
 * matrix at unit-test speed without booting a map.
 *
 * Visual matrix per Plan 05-05 + UI-SPEC §Component States:
 * | source_kind | confidence    | fill      | fill-opacity | "?" badge |
 * | manual      | any           | #0F172A   | 1.0          | no        |
 * | ai          | null/undef    | #F97316   | 1.0          | no        |
 * | ai          | >= 0.7        | #F97316   | 1.0          | no        |
 * | ai          | <  0.7        | #F97316   | 0.45         | yes       |
 */
describe('buildMarkerIconUrl', () => {
  function decode(url: string): string {
    expect(url.startsWith('data:image/svg+xml;utf-8,')).toBe(true);
    return decodeURIComponent(url.slice('data:image/svg+xml;utf-8,'.length));
  }

  it('AI high confidence (>= 0.7) — brand fill, full opacity, no "?"', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.92 }));
    expect(svg).toContain('fill="#F97316"');
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).not.toContain('>?<');
  });

  it('AI exactly at threshold (0.7) — NOT low confidence (strict <)', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.7 }));
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).not.toContain('>?<');
  });

  it('AI low confidence (< 0.7) — brand fill at 0.45 opacity + "?" badge', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.4 }));
    expect(svg).toContain('fill="#F97316"');
    expect(svg).toContain('fill-opacity="0.45"');
    expect(svg).toContain('>?<');
    // Badge must be white over translucent brand for contrast (UI-SPEC §States)
    expect(svg).toContain('fill="#ffffff"');
  });

  it('AI with null confidence — treated as high (D-15: null != low)', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: null }));
    expect(svg).toContain('fill="#F97316"');
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).not.toContain('>?<');
  });

  it('AI with undefined confidence — stale-payload safe fallback (high)', () => {
    // Vercel ISR may serve a cached RPC payload from before migration 0006.
    // Treat missing field as high-conf so trusted pins do not appear degraded.
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: undefined }));
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).not.toContain('>?<');
  });

  it('manual pin — neutral fill, full opacity, no "?" regardless of confidence', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'manual', confidence: null }));
    expect(svg).toContain('fill="#0F172A"');
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).not.toContain('>?<');
  });

  it('manual pin with a stray numeric confidence — still neutral, no badge', () => {
    // Defensive: low-conf branch must only fire on AI pins.
    const svg = decode(buildMarkerIconUrl({ source_kind: 'manual', confidence: 0.2 }));
    expect(svg).toContain('fill="#0F172A"');
    expect(svg).not.toContain('>?<');
  });

  it('produces a 32x40 viewBox SVG anchored as a teardrop', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.9 }));
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="40"');
    expect(svg).toContain('viewBox="0 0 32 40"');
  });
});
