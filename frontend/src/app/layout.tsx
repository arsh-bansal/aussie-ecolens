import type { Metadata } from 'next';
import './globals.css';
import ClientRoot from '@/components/ClientRoot';

export const metadata: Metadata = {
  title: 'Aussie EcoLens — Wildlife Observatory',
  description: 'Multi-cloud serverless platform for automated Australian wildlife tagging.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Asap:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
