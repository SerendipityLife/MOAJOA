import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

const mapCtor = vi.fn();
const markerAddListener = vi.fn();
const markerCtor = vi.fn(() => ({ addListener: markerAddListener }));

beforeEach(() => {
  mapCtor.mockClear();
  markerCtor.mockClear();
  markerAddListener.mockClear();
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_KEY', 'TEST_KEY');
  // 05-05: Marker icon now requires Size + Point ctors for scaledSize/anchor.
  // Stub returns plain objects — only ctor identity matters for the assertions.
  const sizeCtor = vi.fn((w: number, h: number) => ({ width: w, height: h }));
  const pointCtor = vi.fn((x: number, y: number) => ({ x, y }));
  (window as unknown as { google: unknown }).google = {
    maps: { Map: mapCtor, Marker: markerCtor, Size: sizeCtor, Point: pointCtor },
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as unknown as { google?: unknown }).google;
  vi.resetModules();
});

describe('PublicBoardMap', () => {
  it('initializes map with gestureHandling and clickableIcons options', async () => {
    const { PublicBoardMap } = await import('@/app/t/[slug]/_components/public-board-map');
    const places = [
      {
        id: 'p1',
        lat: 35.68,
        lng: 139.69,
        name_local: 'A',
        link_id: 'L1',
        source_timestamp_sec: 120,
        source_kind: 'ai',
        confidence: 0.9,
      },
    ];
    const links = [
      {
        id: 'L1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: null,
        author_name: null,
        thumbnail_url: null,
      },
    ];

    render(React.createElement(PublicBoardMap, { places: places as never, links: links as never }));

    // Wait microtask for useEffect
    await new Promise((r) => setTimeout(r, 0));

    expect(mapCtor).toHaveBeenCalledTimes(1);
    const opts = mapCtor.mock.calls[0]![1];
    expect(opts.gestureHandling).toBe('greedy');
    expect(opts.clickableIcons).toBe(false);
    expect(opts.disableDefaultUI).toBe(true);
    expect(opts.zoomControl).toBe(true);
  });

  it('registers click listener on marker with link_id', async () => {
    const { PublicBoardMap } = await import('@/app/t/[slug]/_components/public-board-map');
    const places = [
      {
        id: 'p1',
        lat: 35.68,
        lng: 139.69,
        name_local: 'A',
        link_id: 'L1',
        source_timestamp_sec: 120,
        source_kind: 'ai',
        confidence: 0.9,
      },
    ];
    const links = [
      {
        id: 'L1',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: null,
        author_name: null,
        thumbnail_url: null,
      },
    ];

    render(React.createElement(PublicBoardMap, { places: places as never, links: links as never }));
    await new Promise((r) => setTimeout(r, 0));

    expect(markerCtor).toHaveBeenCalledTimes(1);
    expect(markerAddListener).toHaveBeenCalledTimes(1);
    expect(markerAddListener.mock.calls[0]![0]).toBe('click');
  });

  it('does NOT register click listener when place has no link_id', async () => {
    const { PublicBoardMap } = await import('@/app/t/[slug]/_components/public-board-map');
    const places = [
      {
        id: 'p1',
        lat: 35.68,
        lng: 139.69,
        name_local: 'manual',
        link_id: null,
        source_timestamp_sec: null,
        source_kind: 'manual',
        confidence: null,
      },
    ];
    const links: never[] = [];

    render(React.createElement(PublicBoardMap, { places: places as never, links: links as never }));
    await new Promise((r) => setTimeout(r, 0));

    expect(markerCtor).toHaveBeenCalledTimes(1);
    expect(markerAddListener).not.toHaveBeenCalled();
  });
});
