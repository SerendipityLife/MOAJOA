import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { getBaseUrl } from '@/lib/env';
import { ToastProvider } from '@/components/toast';
import './globals.css';

// MOAJOA Design System primary typeface — IBM Plex Sans KR (Korean-first).
const ibmPlexSansKr = localFont({
  src: [
    { path: '../public/fonts/IBMPlexSansKR-w400.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/IBMPlexSansKR-w500.ttf', weight: '500', style: 'normal' },
    { path: '../public/fonts/IBMPlexSansKR-w600.ttf', weight: '600', style: 'normal' },
    { path: '../public/fonts/IBMPlexSansKR-w700.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans-kr',
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
    <html lang="ko" className={ibmPlexSansKr.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
