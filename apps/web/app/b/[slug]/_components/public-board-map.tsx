'use client';

import { useEffect, useRef } from 'react';
import type { PublicBoardView } from '@moajoa/core';
import { buildYouTubeWatchUrl } from '@/lib/youtube';

interface Props {
  places: PublicBoardView['places'];
  links: PublicBoardView['links'];
}

export function PublicBoardMap({ places, links }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) {
      ref.current.innerHTML =
        '<div class="text-sm text-neutral-500 p-4">지도를 불러올 수 없어요</div>';
      return;
    }

    const winAny = window as unknown as { google?: { maps?: unknown } };

    const init = () => {
      const g = winAny.google?.maps as typeof google.maps | undefined;
      if (!g || !ref.current) return;

      const center = places[0]
        ? { lat: places[0].lat, lng: places[0].lng }
        : { lat: 35.68, lng: 139.69 };

      // Map options per CONTEXT D-12:
      // - gestureHandling 'greedy' — single-finger panning on mobile (no scroll conflict)
      // - clickableIcons false — POIs not interactive, our pins only
      const map = new g.Map(ref.current, {
        center,
        zoom: places.length > 0 ? 13 : 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      });

      // Build link_id → link lookup once (D-16)
      const linksById = new Map(links.map((l) => [l.id, l]));

      for (const p of places) {
        const marker = new g.Marker({
          map,
          position: { lat: p.lat, lng: p.lng },
          title: p.name_local,
        });

        // Pin click → YouTube new tab (D-14, D-15)
        if (p.link_id) {
          const link = linksById.get(p.link_id);
          if (link?.url) {
            const youtubeUrl = buildYouTubeWatchUrl(link.url, p.source_timestamp_sec);
            if (youtubeUrl) {
              marker.addListener('click', () => {
                window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
              });
            }
          }
        }
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
  }, [places, links]);

  return <div ref={ref} className="w-full h-full" />;
}
