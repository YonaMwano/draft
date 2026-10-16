import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Online Drafts — 10×10 International',
  description: 'Premium mobile-first International Draughts arena. Real-time multiplayer, flying kings, majority capture.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Drafts',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0B0F14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
