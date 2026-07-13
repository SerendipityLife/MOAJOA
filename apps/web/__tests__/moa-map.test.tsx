import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Place } from '@moajoa/core';
import { colors } from '@moajoa/ui-tokens';
import { buildMarkerIconUrl } from '@/lib/marker-svg';

// --- google.maps 스텁 (jsdom에는 실 SDK가 없다 — 실지도는 manual UAT). ---
// 지도 생성 횟수(재init 0 계약)와 fitBounds 호출을 모듈 레벨 spy로 관찰한다.
const mapCtor = vi.fn();
const fitBounds = vi.fn();
type MarkerOpts = { icon: { url: string }; position: { lat: number; lng: number } };
type MarkerRecord = { opts: MarkerOpts; setIcon: ReturnType<typeof vi.fn>; setMap: ReturnType<typeof vi.fn> };
let markers: MarkerRecord[] = [];

class MapStub {
  constructor(el: unknown, opts: unknown) {
    mapCtor(el, opts);
  }
  fitBounds = fitBounds;
}
class MarkerStub {
  setIcon = vi.fn();
  setMap = vi.fn();
  addListener = vi.fn();
  record: MarkerRecord;
  constructor(opts: MarkerOpts) {
    this.record = { opts, setIcon: this.setIcon, setMap: this.setMap };
    markers.push(this.record);
  }
}
class BoundsStub {
  extend = vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
  markers = [];
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = 'test-key';
  (window as unknown as { google: unknown }).google = {
    maps: {
      Map: MapStub,
      Marker: MarkerStub,
      LatLngBounds: BoundsStub,
      Size: class {},
      Point: class {},
    },
  };
});

// Import AFTER the stub shape is fixed (모듈은 window.google을 렌더 시점에 읽는다).
import { MoaMap } from '@/app/moa/[id]/_components/moa-map';

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    board_id: 'b1',
    link_id: null,
    added_by: 'u1',
    google_place_id: 'gpid-1',
    name_local: '스시집',
    name_ko: null,
    name_en: null,
    lat: 35,
    lng: 139,
    category: 'restaurant',
    address: null,
    source_timestamp_sec: null,
    source_quote: null,
    summary_ko: null,
    note: null,
    hidden_at: null,
    source_kind: 'ai',
    confidence: 0.9,
    seq_no: 1,
    created_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

const p1 = makePlace({});
const p2 = makePlace({ id: 'p2', seq_no: 2, name_local: '카페', lat: 35.1, lng: 139.1 });
const p3 = makePlace({ id: 'p3', seq_no: 3, name_local: '공원', lat: 35.2, lng: 139.2 });
const colorFor = () => colors.member[0]!;
const onMarkerTap = vi.fn();

describe('MoaMap — labels + fitKey additive props (D-16 · A-14 · Pitfall 4)', () => {
  it('Map 1: labels 미전달 → 마커 아이콘 URL이 기존(추가자 색·라벨 없음)과 동일', () => {
    render(<MoaMap places={[p1]} colorFor={colorFor} onMarkerTap={onMarkerTap} />);
    expect(markers).toHaveLength(1);
    expect(markers[0]!.opts.icon.url).toBe(
      buildMarkerIconUrl({ source_kind: 'ai', confidence: 0.9, fill: colors.member[0]! }),
    );
  });

  it('Map 2: labels 전달 → 해당 place 마커가 번호 라벨 + brand 고정색(A-14)', () => {
    render(
      <MoaMap
        places={[p1, p2]}
        colorFor={colorFor}
        onMarkerTap={onMarkerTap}
        labels={{ p1: 1, p2: 2 }}
        fitKey={0}
      />,
    );
    expect(markers).toHaveLength(2);
    expect(markers[0]!.opts.icon.url).toBe(
      buildMarkerIconUrl({
        source_kind: 'ai',
        confidence: 0.9,
        fill: colors.brand[500],
        label: 1,
      }),
    );
    expect(markers[1]!.opts.icon.url).toBe(
      buildMarkerIconUrl({
        source_kind: 'ai',
        confidence: 0.9,
        fill: colors.brand[500],
        label: 2,
      }),
    );
  });

  it('Map 3: fitKey 변경 → 핀 수가 줄어도 fitBounds 강제 호출 (Day 전환)', () => {
    const { rerender } = render(
      <MoaMap
        places={[p1, p2, p3]}
        colorFor={colorFor}
        onMarkerTap={onMarkerTap}
        labels={{ p1: 1, p2: 2, p3: 3 }}
        fitKey={0}
      />,
    );
    fitBounds.mockClear();
    // Day 1(3핀) → Day 2(1핀): 핀 수 감소라 기존 "증가 시" 경로로는 재조정이 안 된다.
    rerender(
      <MoaMap
        places={[p2]}
        colorFor={colorFor}
        onMarkerTap={onMarkerTap}
        labels={{ p2: 1 }}
        fitKey={1}
      />,
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it('Map 4: fitKey 미전달 → 핀 수 감소 시 fitBounds 미호출 (기존 경로 무변경)', () => {
    const { rerender } = render(
      <MoaMap places={[p1, p2, p3]} colorFor={colorFor} onMarkerTap={onMarkerTap} />,
    );
    fitBounds.mockClear();
    rerender(<MoaMap places={[p1]} colorFor={colorFor} onMarkerTap={onMarkerTap} />);
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it('Map 5: 지도 인스턴스는 마운트당 1회만 생성 (재init 0 — 기존 계약)', () => {
    const { rerender } = render(
      <MoaMap places={[p1]} colorFor={colorFor} onMarkerTap={onMarkerTap} fitKey={0} />,
    );
    rerender(
      <MoaMap places={[p1, p2]} colorFor={colorFor} onMarkerTap={onMarkerTap} fitKey={1} />,
    );
    rerender(
      <MoaMap
        places={[p2]}
        colorFor={colorFor}
        onMarkerTap={onMarkerTap}
        labels={{ p2: 1 }}
        fitKey={2}
      />,
    );
    expect(mapCtor).toHaveBeenCalledTimes(1);
  });

  it('Map 6: 같은 place의 label만 바뀌면 기존 마커 아이콘을 갱신 (재생성 후 순서 변경)', () => {
    const { rerender } = render(
      <MoaMap
        places={[p1]}
        colorFor={colorFor}
        onMarkerTap={onMarkerTap}
        labels={{ p1: 1 }}
        fitKey={0}
      />,
    );
    expect(markers).toHaveLength(1);
    rerender(
      <MoaMap
        places={[p1]}
        colorFor={colorFor}
        onMarkerTap={onMarkerTap}
        labels={{ p1: 3 }}
        fitKey={0}
      />,
    );
    // 마커를 재생성하지 않고(깜빡임 0) 아이콘만 교체한다.
    expect(markers).toHaveLength(1);
    expect(markers[0]!.setIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        url: buildMarkerIconUrl({
          source_kind: 'ai',
          confidence: 0.9,
          fill: colors.brand[500],
          label: 3,
        }),
      }),
    );
  });
});
