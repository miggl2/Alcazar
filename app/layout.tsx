import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') ?? '';
const SITE_NAME = 'Alcazar';
const SITE_DESCRIPTION = '격자 안의 모든 칸을 한 번씩 지나는 유일한 길을 찾는 퍼즐 게임.';
const OG_IMAGE_PATH = '/play-store/feature-graphic-1024x500.png';

function assetPath(path: string) {
  return `${BASE_PATH}${path}`;
}

function absoluteUrl(path: string) {
  return `${SITE_URL.replace(/\/$/, '')}${path}`;
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: absoluteUrl(OG_IMAGE_PATH),
        width: 1024,
        height: 500,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl(OG_IMAGE_PATH)],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: assetPath('/app-icon.svg'),
  },
  manifest: assetPath('/manifest.webmanifest'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="no-scroll-x">
      <body className="min-h-screen-safe">{children}</body>
    </html>
  );
}
