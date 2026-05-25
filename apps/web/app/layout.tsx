import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { getBaseUrl } from '@/lib/env';
import './globals.css';

const pretendard = localFont({
  src: [
    { path: '../public/fonts/Pretendard-Regular.otf', weight: '400', style: 'normal' },
    { path: '../public/fonts/Pretendard-Medium.otf', weight: '500', style: 'normal' },
    { path: '../public/fonts/Pretendard-SemiBold.otf', weight: '600', style: 'normal' },
    { path: '../public/fonts/Pretendard-Bold.otf', weight: '700', style: 'normal' },
  ],
  variable: '--font-pretendard',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: 'MOAJOA — 여행 정보를 모아두는 지도',
  description: '유튜브·블로그·인스타 링크를 던지면 영상 속 장소를 지도에 모아주는 여행 큐레이션 도구.',
  openGraph: {
    title: 'MOAJOA',
    description: '여행 정보를 모아두는 지도',
    type: 'website',
  },
};

// Per Phase 4 CONTEXT D-13 — maximumScale:5 preserves WCAG 1.4.4 zoom accessibility.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
