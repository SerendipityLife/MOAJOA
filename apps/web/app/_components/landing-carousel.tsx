'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';

/**
 * Landing carousel — the web twin of the iOS welcome screen (apps/ios/app/welcome.tsx).
 *
 * Three edge-to-edge travel photos with a dark scrim; the brand wordmark and the
 * per-slide copy sit together as one vertically-centered group in white over the
 * scrim. Only the dots + CTA float as fixed chrome pinned to the bottom.
 *
 * Paging is CSS scroll-snap rather than a JS transform track: swipe, trackpad and
 * keyboard scrolling all come for free from the platform, and the only JS left is
 * reading back the active index.
 */

interface Slide {
  key: string;
  src: string;
  title: string;
  /**
   * Portrait photo inside a landscape frame → the width fills and the *height*
   * gets cropped, so only the Y anchor matters on desktop. At 1440×900 the visible
   * vertical band is `f = (900/1440) ÷ (H/W)` of the original.
   *
   * On mobile (390×844) the ratio flips — the height fits and the width crops —
   * so X is what matters there. All three photos frame their subject near the
   * horizontal center, hence X=50% everywhere, which lets one value serve both
   * viewports.
   */
  objectPosition: string;
}

const SLIDES: Slide[] = [
  {
    key: 'vote',
    src: '/onboarding/fuji-photo.jpg',
    title: '친구랑 투표로\n어디 갈지 정해요',
    // 2:3 → desktop shows ~42% of the height. Y=50% (center) puts the snow-capped
    // summit (43%) at the 33% line of the frame — textbook placement. The crop only
    // eats flat sky and dark foreground rock, so desktop actually improves on the original.
    objectPosition: 'object-[50%_50%]',
  },
  {
    key: 'share',
    src: '/onboarding/lake-photo.jpg',
    title: '완성된 여행 지도를\n친구와 공유하세요',
    // 9:16 → the tallest crop: desktop shows only ~35% of the height. Y=40% (band
    // 25.9–61.1%) keeps the cherry-blossom canopy and the misty horizon + island (45%),
    // i.e. the photo's identity. The kayak (68–72%) cannot survive alongside the canopy
    // in a 35% band — we chose the canopy (see SUMMARY: honest limitation).
    objectPosition: 'object-[50%_40%]',
  },
  {
    key: 'link',
    src: '/onboarding/travel-photo.jpg',
    title: '유튜브 링크 하나로\n여행 지도 완성',
    // 4:5 → desktop shows only ~50% of the height. Y=45% keeps the visible band at
    // 22.5–72.5%, which holds the glasses (14–31%), the dense middle of the Rome map
    // (30–75%) and the pencils (38–78%). What gets cropped is the empty desk up top
    // (no information) and the writing hand at the bottom (buried under the scrim anyway).
    objectPosition: 'object-[50%_45%]',
  },
];

/**
 * Scrim. White copy over these photos only clears WCAG AA because of this — the
 * flat 0.55 band behind the text yields ≥5.1:1 on all three (worst case is the white
 * desktop in travel-photo, 5.42:1). The iOS scrim peaks at 0.12 where the text sits,
 * which measures 1.4–1.6:1 against the web crop — so this is a deliberate divergence,
 * not a porting mistake. Text shadows are not a WCAG-recognised contrast mechanism;
 * the scrim is the whole argument. Do not lighten it without re-measuring.
 *
 * Black alpha is the one hard-coded color allowed here (a scrim has no brand token).
 */
const SCRIM =
  'bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.55)_28%,rgba(0,0,0,0.55)_72%,rgba(0,0,0,0.78)_100%)]';

export default function LandingCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  }

  function goTo(i: number) {
    const el = trackRef.current;
    if (!el) return;
    // Respect reduced-motion: jump instead of animating the scroll.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  }

  return (
    <main className="relative h-[100svh] overflow-hidden">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((slide, i) => (
          <section key={slide.key} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={slide.src}
              alt=""
              fill
              sizes="100vw"
              // Slide 1 is the LCP element. Slides 2–3 are eager too: they sit off to the
              // side rather than below the fold, so lazy loading would leave a blank frame
              // for the first moments of a swipe. (priority already implies eager — setting
              // both on one image warns.)
              {...(i === 0 ? { priority: true } : { loading: 'eager' as const })}
              className={`object-cover ${slide.objectPosition}`}
            />
            <div aria-hidden className={`absolute inset-0 ${SCRIM}`} />

            <div className="relative flex h-full flex-col justify-center pb-44">
              <div className="mx-auto w-full max-w-lg px-8">
                <p className="text-4xl font-extrabold tracking-wider text-white">MOAJOA</p>
                <h1 className="mt-5 whitespace-pre-line text-3xl font-extrabold leading-tight text-white">
                  {slide.title}
                </h1>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Fixed chrome — dots + CTA. */}
      <div className="absolute inset-x-0 bottom-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg px-8">
          <div className="flex items-center justify-center gap-2 py-4">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                aria-label={`슬라이드 ${i + 1}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className={`rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  i === index ? 'h-2 w-5 bg-white' : 'h-2 w-2 bg-white/40'
                }`}
              />
            ))}
          </div>

          <div className="mt-4 flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-fab transition-colors duration-150 ease-out hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
            >
              시작하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
