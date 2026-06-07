import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PublicBoardView } from '@moajoa/core';
import { PlaceSummaryList } from '@/app/b/[slug]/_components/place-summary-list';

type ViewPlace = PublicBoardView['places'][number];

/**
 * VIEW-08: place commentary on the public board renders conditionally on summary_ko.
 * Legacy rows (summary_ko null) must render NO summary block (layout intact), and
 * the text is escaped by React default (no XSS — no dangerouslySetInnerHTML).
 */
function makePlace(overrides: Partial<ViewPlace>): ViewPlace {
  return {
    id: 'p1',
    link_id: 'l1',
    name_local: '스시집',
    name_ko: null,
    name_en: null,
    lat: 35.0,
    lng: 139.0,
    category: 'restaurant',
    source_timestamp_sec: null,
    source_kind: 'ai',
    confidence: 0.9,
    summary_ko: null,
    ...overrides,
  };
}

describe('PlaceSummaryList', () => {
  it('renders commentary when summary_ko present', () => {
    render(
      <PlaceSummaryList
        places={[makePlace({ name_local: '스시집', summary_ko: '여기 라멘이 유명해요' })]}
      />,
    );
    expect(screen.getByText('여기 라멘이 유명해요')).toBeInTheDocument();
  });

  it('hides summary block when summary_ko is null (legacy row)', () => {
    render(
      <PlaceSummaryList places={[makePlace({ name_local: '스시집', summary_ko: null })]} />,
    );
    expect(screen.getByText('스시집')).toBeInTheDocument();
    expect(screen.queryByTestId('place-summary')).toBeNull();
  });

  it('renders name_ko over name_local when present', () => {
    render(
      <PlaceSummaryList
        places={[makePlace({ name_ko: '스시야', name_local: '寿司屋', summary_ko: null })]}
      />,
    );
    expect(screen.getByText('스시야')).toBeInTheDocument();
    expect(screen.queryByText('寿司屋')).toBeNull();
  });

  it('escapes HTML in summary_ko (no XSS)', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const { container } = render(
      <PlaceSummaryList places={[makePlace({ summary_ko: payload })]} />,
    );
    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
