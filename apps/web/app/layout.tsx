import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MOAJOA — 여행 정보를 모아두는 지도',
  description: '유튜브·블로그·인스타 링크를 던지면 영상 속 장소를 지도에 모아주는 여행 큐레이션 도구.',
  openGraph: {
    title: 'MOAJOA',
    description: '여행 정보를 모아두는 지도',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
