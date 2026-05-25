import { describe, expect, it } from 'vitest';
import { buildStaticMapsUrl, OG_GRAYSCALE_STYLE } from '@/lib/og/static-maps';

const places3 = [
  { lat: 35.681, lng: 139.692 },
  { lat: 35.658, lng: 139.701 },
  { lat: 35.71, lng: 139.811 },
];

describe('buildStaticMapsUrl', () => {
  it('throws on empty places', () => {
    expect(() =>
      buildStaticMapsUrl({
        places: [],
        size: { width: 600, height: 630 },
        apiKey: 'KEY',
      }),
    ).toThrow(/at least 1 place/i);
  });

  it('builds URL with size, scale, maptype, key, markers', () => {
    const url = buildStaticMapsUrl({
      places: places3,
      size: { width: 600, height: 630 },
      scale: 2,
      apiKey: 'KEY',
    });
    expect(url).toMatch(/^https:\/\/maps\.googleapis\.com\/maps\/api\/staticmap\?/);
    expect(url).toContain('size=600x630');
    expect(url).toContain('scale=2');
    expect(url).toContain('maptype=roadmap');
    expect(url).toContain('key=KEY');
    // markers param contains brand color
    expect(url).toMatch(/markers=[^&]*0xF97316/);
    // URLSearchParams encodes ',' as %2C
    expect(url).toContain('35.681000%2C139.692000');
  });

  it('truncates places to max 10 (D-07)', () => {
    const places15 = Array.from({ length: 15 }, (_, i) => ({
      lat: 35 + i * 0.01,
      lng: 139 + i * 0.01,
    }));
    const url = buildStaticMapsUrl({
      places: places15,
      size: { width: 600, height: 630 },
      apiKey: 'KEY',
    });
    // Count lat,lng pairs in markers — pattern `35.xxx%2C` (URL-encoded comma)
    const matches = url.match(/3[5-6]\.\d{6}%2C/g) ?? [];
    expect(matches.length).toBe(10);
  });

  it('appends styleParams as &style= entries', () => {
    const url = buildStaticMapsUrl({
      places: places3,
      size: { width: 600, height: 630 },
      apiKey: 'KEY',
      styleParams: ['feature:poi|element:labels|visibility:off'],
    });
    expect(url).toMatch(/[?&]style=feature%3Apoi/);
  });

  it('defaults scale=2 when not provided', () => {
    const url = buildStaticMapsUrl({
      places: places3,
      size: { width: 600, height: 630 },
      apiKey: 'KEY',
    });
    expect(url).toContain('scale=2');
  });
});

describe('OG_GRAYSCALE_STYLE', () => {
  it('exports ≥3 style entries each starting with feature:', () => {
    expect(OG_GRAYSCALE_STYLE.length).toBeGreaterThanOrEqual(3);
    OG_GRAYSCALE_STYLE.forEach((s) => expect(s).toMatch(/^feature:/));
  });
});
