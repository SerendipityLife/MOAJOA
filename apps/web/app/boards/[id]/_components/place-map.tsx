'use client';

import { useEffect, useRef } from 'react';
import type { Place } from '@moajoa/core';

/**
 * Minimal Google Maps preview. Loads the Maps JS API lazily and drops a pin
 * for each place. Centers on the first place or Tokyo (35.68, 139.69) if empty.
 *
 * MVP-level — we'll swap in proper clustering and pin styling in Phase 2.
 */
export function PlaceMap({ places }: { places: Place[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) {
      ref.current.innerHTML =
        '<div class="text-sm text-neutral-500 p-4">Google Maps API 키가 설정되지 않았어요. <code>NEXT_PUBLIC_GOOGLE_MAPS_KEY</code>를 .env.local에 추가하세요.</div>';
      return;
    }

    const winAny = window as unknown as { google?: { maps?: unknown } };

    const init = () => {
      const g = winAny.google?.maps as typeof google.maps | undefined;
      if (!g || !ref.current) return;

      const center =
        places[0]
          ? { lat: places[0].lat, lng: places[0].lng }
          : { lat: 35.68, lng: 139.69 };

      const map = new g.Map(ref.current, {
        center,
        zoom: places.length > 0 ? 13 : 11,
        disableDefaultUI: true,
        zoomControl: true,
        // greedy: 한 손가락 드래그로 패닝 (cooperative 기본값은 "두 손가락" 오버레이를 띄움)
        gestureHandling: 'greedy',
        clickableIcons: false,
      });

      for (const p of places) {
        new g.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          title: p.name_local,
        });
      }

      // 컨테이너가 리사이즈되면 지도가 잘리므로(Maps JS는 자동 reflow 안 함)
      // 중심을 유지한 채 다시 그려준다.
      const ro = new ResizeObserver(() => {
        const c = map.getCenter();
        g.event.trigger(map, 'resize');
        if (c) map.setCenter(c);
      });
      ro.observe(ref.current);
      cleanupRef.current = () => ro.disconnect();
    };

    if (winAny.google?.maps) {
      init();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-moajoa-gmaps]');
      if (existing) {
        existing.addEventListener('load', init, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker`;
        script.async = true;
        script.defer = true;
        script.dataset.moajoaGmaps = '1';
        script.addEventListener('load', init, { once: true });
        document.head.appendChild(script);
      }
    }

    return () => cleanupRef.current?.();
  }, [places]);

  return (
    <div
      ref={ref}
      className="w-full h-full min-h-0 rounded-lg border border-neutral-200 bg-neutral-50"
    />
  );
}
