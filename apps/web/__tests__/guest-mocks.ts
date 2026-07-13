import type { PublicBoardView, Trip } from '@moajoa/core';

/**
 * 공유 게스트 테스트 픽스처 빌더 (guest-surface.test.tsx가 소비).
 *
 * Supabase/@moajoa/api spy는 vi.mock 팩토리 hoisting 제약상 테스트 파일에서
 * vi.hoisted로 만든다(vote-island.test.tsx 선례) — 이 파일은 순수 데이터 빌더만.
 */
export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    owner_id: 'owner-1',
    representative_id: 'owner-1',
    title: '도쿄 여행',
    description: null,
    visibility: 'shared',
    share_slug: 'slug-1',
    city_code: 'tokyo',
    start_date: null,
    end_date: null,
    cover_image_url: null,
    share_mode: 'places',
    companion: null,
    day_count: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

type GuestPlace = PublicBoardView['places'][number];

export function makePlace(overrides: Partial<GuestPlace> = {}): GuestPlace {
  return {
    id: 'p1',
    link_id: null,
    name_local: '스시집',
    name_ko: '스시집',
    name_en: null,
    lat: 35,
    lng: 139,
    category: 'restaurant',
    source_timestamp_sec: null,
    source_kind: 'ai',
    confidence: 0.9,
    summary_ko: null,
    google_place_id: 'gpid-1',
    address: null,
    ...overrides,
  };
}

export function makeBoard(
  overrides: Partial<PublicBoardView['board']> = {},
): PublicBoardView['board'] {
  return {
    id: 'trip-1',
    title: '도쿄 여행',
    description: null,
    city_code: 'tokyo',
    cover_image_url: null,
    updated_at: '2026-07-01T00:00:00Z',
    share_mode: 'places',
    ...overrides,
  };
}
