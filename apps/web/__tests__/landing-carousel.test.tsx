import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// --- Mocks ---------------------------------------------------------------
// next/image → passthrough <img>. `fill`/`priority` are next-only booleans that
// React would warn about on a raw <img>, so we surface them as data-* instead.
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    priority,
  }: {
    src: string;
    alt: string;
    className?: string;
    priority?: boolean;
    fill?: boolean;
    sizes?: string;
    loading?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-testid="slide-img"
      src={src}
      alt={alt}
      className={className}
      data-priority={priority ? 'true' : 'false'}
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Import AFTER mocks so the component picks them up.
import LandingCarousel from '@/app/_components/landing-carousel';

const SLIDE_WIDTH = 390;
const scrollTo = vi.fn();

beforeEach(() => {
  scrollTo.mockClear();
  // jsdom has no layout: clientWidth is always 0 and scrollTo is undefined.
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get: () => SLIDE_WIDTH,
  });
  Element.prototype.scrollTo = scrollTo as unknown as Element['scrollTo'];
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('LandingCarousel', () => {
  it('renders the three onboarding photos in order', () => {
    render(<LandingCarousel />);
    const imgs = screen.getAllByTestId('slide-img');
    expect(imgs).toHaveLength(3);
    expect(imgs[0]).toHaveAttribute('src', '/onboarding/fuji-photo.jpg');
    expect(imgs[1]).toHaveAttribute('src', '/onboarding/lake-photo.jpg');
    expect(imgs[2]).toHaveAttribute('src', '/onboarding/travel-photo.jpg');
  });

  it('marks only the first photo as priority (LCP)', () => {
    render(<LandingCarousel />);
    const imgs = screen.getAllByTestId('slide-img');
    expect(imgs[0]).toHaveAttribute('data-priority', 'true');
    expect(imgs[1]).toHaveAttribute('data-priority', 'false');
    expect(imgs[2]).toHaveAttribute('data-priority', 'false');
  });

  it('treats every photo as decorative (empty alt)', () => {
    render(<LandingCarousel />);
    for (const img of screen.getAllByTestId('slide-img')) {
      expect(img).toHaveAttribute('alt', '');
    }
  });

  it('renders the iOS wordmark + per-slide copy on all three slides', () => {
    render(<LandingCarousel />);
    expect(screen.getAllByText('MOAJOA')).toHaveLength(3);
    const body = document.body.textContent ?? '';
    for (const copy of [
      '유튜브 링크 하나로',
      '여행 지도 완성',
      '완성된 여행 지도를',
      '친구와 공유하세요',
      '친구랑 투표로',
      '어디 갈지 정해요',
    ]) {
      expect(body).toContain(copy);
    }
  });

  it('drops the old landing copy (badge + headline + subcopy)', () => {
    render(<LandingCarousel />);
    const body = document.body.textContent ?? '';
    for (const dead of ['여행 큐레이션 도구', '여행 정보를 모아두는', '유튜브 링크를 던지면']) {
      expect(body).not.toContain(dead);
    }
  });

  it('exposes three accessible dots and scrolls to the picked slide', () => {
    render(<LandingCarousel />);
    const dots = screen.getAllByRole('button');
    expect(dots).toHaveLength(3);
    for (const [i, dot] of dots.entries()) {
      expect(dot).toHaveAttribute('aria-label', `슬라이드 ${i + 1}`);
    }
    expect(dots[0]).toHaveAttribute('aria-current', 'true');

    fireEvent.click(dots[1]!);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ left: SLIDE_WIDTH, behavior: 'smooth' });
  });

  it('points the 시작하기 CTA at /login', () => {
    render(<LandingCarousel />);
    expect(screen.getByRole('link', { name: '시작하기' })).toHaveAttribute('href', '/login');
  });
});
