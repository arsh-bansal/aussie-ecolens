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
      <body suppressHydrationWarning>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
