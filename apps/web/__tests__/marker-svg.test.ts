import { describe, expect, it } from 'vitest';
import { buildMarkerIconUrl } from '@/lib/marker-svg';
import { colors } from '@moajoa/ui-tokens';

/**
 * Pure-function tests for the SVG data URL builder consumed by
 * Google Maps Marker icons (Phase 5 TRUST-01). Catches the color/opacity
 * matrix at unit-test speed without booting a map.
 *
 * Visual matrix per Plan 05-05 + UI-SPEC §Component States:
 * | source_kind | confidence    | fill      | fill-opacity | "?" badge |
 * | manual      | any           | neutral-900 | 1.0        | no        |
 * | ai          | null/undef    | brand-500 | 1.0          | no        |
 * | ai          | >= 0.7        | brand-500 | 1.0          | no        |
 * | ai          | <  0.7        | brand-500 | 0.45         | yes       |
 */
describe('buildMarkerIconUrl', () => {
  function decode(url: string): string {
    expect(url.startsWith('data:image/svg+xml;utf-8,')).toBe(true);
    return decodeURIComponent(url.slice('data:image/svg+xml;utf-8,'.length));
  }

  it('AI high confidence (>= 0.7) — brand fill, full opacity, no "?"', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.92 }));
    expect(svg).toContain(`fill="${colors.brand[500]}"`);
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
    expect(svg).toContain(`fill="${colors.brand[500]}"`);
    expect(svg).toContain('fill-opacity="0.45"');
    expect(svg).toContain('>?<');
    // Badge must be white over translucent brand for contrast (UI-SPEC §States)
    expect(svg).toContain('fill="#ffffff"');
  });

  it('AI with null confidence — treated as high (D-15: null != low)', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: null }));
    expect(svg).toContain(`fill="${colors.brand[500]}"`);
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
    expect(svg).toContain(`fill="${colors.neutral[900]}"`);
    expect(svg).toContain('fill-opacity="1"');
    expect(svg).not.toContain('>?<');
  });

  it('manual pin with a stray numeric confidence — still neutral, no badge', () => {
    // Defensive: low-conf branch must only fire on AI pins.
    const svg = decode(buildMarkerIconUrl({ source_kind: 'manual', confidence: 0.2 }));
    expect(svg).toContain(`fill="${colors.neutral[900]}"`);
    expect(svg).not.toContain('>?<');
  });

  it('produces a 32x40 viewBox SVG anchored as a teardrop', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.9 }));
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="40"');
    expect(svg).toContain('viewBox="0 0 32 40"');
  });

  it('explicit fill (ui-tokens member color) overrides the source_kind fill', () => {
    const svg = decode(
      buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.9, fill: colors.member[0] }),
    );
    expect(svg).toContain(`fill="${colors.member[0]}"`); // '#FF7043'
    expect(svg).not.toContain(`fill="${colors.brand[500]}"`);
  });

  it('omitting fill keeps the existing source_kind output byte-for-byte', () => {
    const withUndef = buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.9, fill: undefined });
    const without = buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.9 });
    expect(withUndef).toBe(without);
  });

  /**
   * Phase 28 D-16 — Day 번호 핀. `label?: number`는 additive 확장이며
   * 미전달 시 기존 출력이 바이트 단위로 동일하다(24-02 `fill` 확장 선례 미러).
   * 삽입값은 String(number)만 — 사용자 문자열은 SVG에 절대 넣지 않는다(HC-6 / T-24-04).
   */
  it('label: 3 — 흰색 숫자 text 요소로 렌더된다', () => {
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.9, label: 3 }));
    expect(svg).toContain('>3<');
    expect(svg).toContain('<text');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('label과 물음표 배지 조건이 동시면 label이 우선하고 "?"는 렌더되지 않는다', () => {
    // confidence 0.4 = 저신뢰(원래 "?" 배지 조건)인데 label이 있으면 번호가 이긴다.
    const svg = decode(buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.4, label: 2 }));
    expect(svg).toContain('>2<');
    expect(svg).not.toContain('>?<');
    // 저신뢰 투명도 자체는 유지 — label은 배지만 대체한다.
    expect(svg).toContain('fill-opacity="0.45"');
  });

  it('omitting label keeps the existing output byte-for-byte', () => {
    const withUndef = buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.4, label: undefined });
    const without = buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.4 });
    expect(withUndef).toBe(without);

    // 저신뢰 "?" 배지 경로(가장 복잡한 기존 분기)도 미전달 시 그대로다.
    expect(without).toBe(
      buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.4, fill: undefined }),
    );
  });
});
