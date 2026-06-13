import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { getBaseUrl } from '@/lib/env';
import { ToastProvider } from '@/components/toast';
import { BottomNav } from '@/components/bottom-nav';
import './globals.css';

// MOAJOA primary typeface — Pretendard, matching the iOS app (lib/fonts.ts there).
// One variable woff2 covers every weight (100–900), so font-extrabold (800) renders
// a true cut on web. CSS var name kept as --font-sans-kr (consumed in globals.css).
const pretendard = localFont({
  src: '../public/fonts/PretendardVariable.woff2',
  weight: '100 900',
  variable: '--font-sans-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: 'MOAJOA — 여행 정보를 모아두는 지도',
  description:
    '유튜브·블로그·인스타 링크를 던지면 영상 속 장소를 지도에 모아주는 여행 큐레이션 도구.',
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
      <body>
        <ToastProvider>
          {children}
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
