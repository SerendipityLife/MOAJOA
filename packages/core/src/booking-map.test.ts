import { describe, it, expect } from 'vitest';
import { BOOKING_REGION_MAP, COMPARE_LABELS } from './booking-map';
import { CITY_KO_MAP } from './constants';

describe('BOOKING_REGION_MAP — D-09 static mapping, CITY_KO_MAP-aligned', () => {
  it('has exactly the 9 CITY_KO_MAP city codes (no more, no less)', () => {
    const keys = Object.keys(BOOKING_REGION_MAP).sort();
    expect(keys).toHaveLength(9);
    expect(keys).toEqual(Object.keys(CITY_KO_MAP).sort());
  });

  it("all 6 jp cities carry esimSlug 'japan-esim'", () => {
    for (const city of ['tokyo', 'osaka', 'kyoto', 'fukuoka', 'sapporo', 'okinawa']) {
      expect(BOOKING_REGION_MAP[city]?.country).toBe('jp');
      expect(BOOKING_REGION_MAP[city]?.esimSlug).toBe('japan-esim');
    }
  });

  it('kr cities: esimSlug null AND transport null (국내여행 억지 추천 금지 — D-09)', () => {
    for (const city of ['seoul', 'busan', 'jeju']) {
      expect(BOOKING_REGION_MAP[city]?.country).toBe('kr');
      expect(BOOKING_REGION_MAP[city]?.esimSlug).toBeNull();
      expect(BOOKING_REGION_MAP[city]?.transport).toBeNull();
    }
  });

  it('tokyo → JR 패스 via klook', () => {
    expect(BOOKING_REGION_MAP['tokyo']?.transport).toEqual({
      labelKo: 'JR 패스',
      provider: 'klook',
      searchQuery: 'JR 패스',
    });
  });

  it('osaka/kyoto → 간사이 패스 via klook', () => {
    for (const city of ['osaka', 'kyoto']) {
      expect(BOOKING_REGION_MAP[city]?.transport).toEqual({
        labelKo: '간사이 패스',
        provider: 'klook',
        searchQuery: '간사이 패스',
      });
    }
  });

  it('fukuoka/sapporo/okinawa → transport null (대표 패스 확신 없음 — 억지 추천 금지)', () => {
    for (const city of ['fukuoka', 'sapporo', 'okinawa']) {
      expect(BOOKING_REGION_MAP[city]?.transport).toBeNull();
    }
  });

  it('esimSlug values are path fragments only — never URL literals (booking.ts owns domains)', () => {
    for (const info of Object.values(BOOKING_REGION_MAP)) {
      if (info.esimSlug !== null) {
        expect(info.esimSlug).not.toMatch(/^https?:\/\//);
        expect(info.esimSlug).not.toContain('.');
      }
    }
  });
});

describe('COMPARE_LABELS — D-06 core-owned provider copy (UI must not hardcode)', () => {
  it('locks the 5 provider labels verbatim (UI-SPEC Copywriting Contract)', () => {
    expect(COMPARE_LABELS).toEqual({
      klook: '즉시확정·전세계 상품',
      kkday: '한국어 가이드 상품 강세',
      agoda: '아시아 숙소 강세',
      booking: '전 세계 숙소 폭넓게',
      airalo: 'eSIM 즉시 발급',
    });
  });
});
