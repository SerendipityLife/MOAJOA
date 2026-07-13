'use client';

import { useEffect, useRef } from 'react';
import type { Place } from '@moajoa/core';
import { colors } from '@moajoa/ui-tokens';
import { buildMarkerIconUrl } from '@/lib/marker-svg';

export interface MoaMapProps {
  places: Place[];
  /** userId → 추가자 색 (MOA-06) — island이 memberColor를 바인딩해 전달. */
  colorFor: (userId: string) => string;
  /** 마커 탭 → 해당 행 열기 (MOA-05). */
  onMarkerTap: (placeId: string) => void;
  /**
   * place_id → 그날 방문 순서(sort_order+1). Day 뷰에서만 전달한다(D-16).
   * 라벨이 있는 핀은 **brand 고정색**이다(A-14) — 추가자 색 위에 번호를 얹으면 대비가
   * 무너져 번호가 안 읽힌다. 미전달 시 기존 추가자 색 핀과 **바이트 동일**.
   */
  labels?: Record<string, number>;
  /**
   * 값이 바뀌면 **강제로 fitBounds**한다(D-16). 기존 재조정은 "장소 수가 **증가**했을 때만"
   * 발동하므로 Day 1(5핀) → Day 2(3핀)처럼 핀이 **줄면** 재프레이밍이 안 되고 그날 핀이
   * 화면 밖에 남는다(RESEARCH Pitfall 4). 이 prop은 그 갭만 메우고, 기존 증가 경로는
   * 무변경이다. 미전달 시 기존 동작과 동일.
   */
  fitKey?: string | number;
}

/**
 * MoaMap — /moa/[id] 지도탭의 지속(persistent) 지도 (D-16).
 *
 * public-board-map.tsx의 스크립트 로딩·맵 옵션·마커 생성 idiom은 계승하되,
 * places 의존 useEffect가 지도를 **재생성**하던 구조(RESEARCH Pitfall 4)는 버린다:
 * 지도 인스턴스는 마운트당 1회만 생성(mapRef)하고, places 변경 시에는 markersRef를
 * 대조해 **추가/삭제된 마커만 diff**한다. realtime 이벤트마다 지도가 깜빡이거나
 * 사용자 팬이 리셋되지 않는다. fitBounds는 장소 수가 **증가**했을 때만 재조정.
 */
export function MoaMap({ places, colorFor, onMarkerTap, labels, fitKey }: MoaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  // 마커별 현재 아이콘 URL — 라벨(번호)이 바뀌면 마커를 재생성하지 않고 아이콘만 교체한다.
  const iconUrlsRef = useRef<Map<string, string>>(new Map());
  // 직전 장소 수 — 증가했을 때만 fitBounds(사용자 팬 강제 리셋 금지, D-16).
  const prevCountRef = useRef(0);
  // 직전 fitKey — 값이 바뀌면 핀 수와 무관하게 강제 재조정(Pitfall 4).
  const prevFitKeyRef = useRef<string | number | undefined>(undefined);
  // 최신 places/콜백/색을 ref로 유지해 지도 재init 없이 diff가 읽는다.
  const placesRef = useRef<Place[]>(places);
  const colorForRef = useRef(colorFor);
  const onMarkerTapRef = useRef(onMarkerTap);
  const labelsRef = useRef(labels);
  const fitKeyRef = useRef(fitKey);
  placesRef.current = places;
  colorForRef.current = colorFor;
  onMarkerTapRef.current = onMarkerTap;
  labelsRef.current = labels;
  fitKeyRef.current = fitKey;

  // 마커 아이콘 URL. 라벨이 있으면 brand 고정색 + 번호(A-14), 없으면 기존 추가자 색.
  // labels 미전달 시 인자가 기존과 동일해 결과 URL이 바이트 동일하다(무회귀).
  function iconUrlFor(p: Place): string {
    const label = labelsRef.current?.[p.id];
    return buildMarkerIconUrl({
      source_kind: p.source_kind,
      confidence: p.confidence,
      fill: label != null ? colors.brand[500] : colorForRef.current(p.added_by),
      ...(label != null && { label }),
    });
  }

  // 마커 diff — 지도 인스턴스는 절대 재생성하지 않는다.
  function syncMarkers() {
    const g = (window as unknown as { google?: { maps?: typeof google.maps } }).google?.maps;
    const map = mapRef.current;
    if (!g || !map) return;

    const markers = markersRef.current;
    const iconUrls = iconUrlsRef.current;
    const current = placesRef.current;
    const nextIds = new Set(current.map((p) => p.id));

    // 사라진 place의 마커 제거.
    for (const [id, marker] of markers) {
      if (!nextIds.has(id)) {
        marker.setMap(null);
        markers.delete(id);
        iconUrls.delete(id);
      }
    }
    // 새로 등장한 place만 마커 생성(기존 마커는 그대로 — 깜빡임 0).
    for (const p of current) {
      const url = iconUrlFor(p);
      const existing = markers.get(p.id);
      if (existing) {
        // 재생성 후 방문 순서가 바뀌면 같은 place의 번호만 달라진다 — 아이콘만 교체.
        if (iconUrls.get(p.id) !== url) {
          existing.setIcon({
            url,
            scaledSize: new g.Size(32, 40),
            anchor: new g.Point(16, 40),
          });
          iconUrls.set(p.id, url);
        }
        continue;
      }
      const marker = new g.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        title: p.name_local,
        icon: {
          url,
          scaledSize: new g.Size(32, 40),
          anchor: new g.Point(16, 40),
        },
      });
      marker.addListener('click', () => onMarkerTapRef.current(p.id));
      markers.set(p.id, marker);
      iconUrls.set(p.id, url);
    }

    // fitBounds (D-16): 장소 수가 증가했을 때만 — 0→N 초기 로드도 이 경로. **무변경.**
    // 추가로 fitKey가 바뀌면 핀 수가 줄거나 같아도 강제 재조정한다(Day 전환, Pitfall 4).
    const key = fitKeyRef.current;
    const fitKeyChanged = key !== undefined && key !== prevFitKeyRef.current;
    if ((current.length > prevCountRef.current || fitKeyChanged) && current.length > 0) {
      const bounds = new g.LatLngBounds();
      for (const p of current) bounds.extend({ lat: p.lat, lng: p.lng });
      map.fitBounds(bounds);
    }
    prevCountRef.current = current.length;
    prevFitKeyRef.current = key;
  }

  // 지도 1회 생성(스크립트 로딩 + init). places 의존 없음 → 재init 0 (D-16).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) {
      // 정적 리터럴만 — user 문자열 삽입 금지(public-board-map 패턴).
      el.innerHTML = '<div class="text-sm text-neutral-500 p-4">지도를 불러올 수 없어요</div>';
      return;
    }

    const winAny = window as unknown as { google?: { maps?: unknown } };
    const init = () => {
      const g = winAny.google?.maps as typeof google.maps | undefined;
      if (!g || !containerRef.current || mapRef.current) return;
      const first = placesRef.current[0];
      const center = first ? { lat: first.lat, lng: first.lng } : { lat: 35.68, lng: 139.69 };
      const map = new g.Map(containerRef.current, {
        center,
        zoom: placesRef.current.length > 0 ? 13 : 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      });
      mapRef.current = map;
      syncMarkers(); // 초기 핀 + fitBounds
    };

    if (winAny.google?.maps) {
      init();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-moajoa-gmaps]');
    if (existing) {
      existing.addEventListener('load', init, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.dataset.moajoaGmaps = '1';
    script.addEventListener('load', init, { once: true });
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // places/labels/fitKey 변경 → 마커 diff만(지도 재생성 없음).
  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, labels, fitKey]);

  // 레이아웃(높이·중앙 컬럼)은 island 몫 — 여기선 풀 채움.
  return <div ref={containerRef} className="h-full w-full" />;
}
