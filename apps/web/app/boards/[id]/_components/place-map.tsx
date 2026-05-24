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
      });

      for (const p of places) {
        new g.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          title: p.name_local,
        });
      }
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.dataset.moajoaGmaps = '1';
    script.addEventListener('load', init, { once: true });
    document.head.appendChild(script);
  }, [places]);

  return (
    <div
      ref={ref}
      className="w-full aspect-square md:aspect-auto md:h-[480px] rounded-lg border border-neutral-200 bg-neutral-50"
    />
  );
}
