'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import { PageSpinner } from '@/components/ui/Spinner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const showVideo = pathname !== '/dashboard';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return <PageSpinner />;

  return (
    <div className="app">
      {showVideo && (
        <>
          <video autoPlay muted loop playsInline style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, opacity: 0.28, pointerEvents: 'none' }}>
            <source src="/upload-bg.mp4" type="video/mp4" />
          </video>
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 40%, oklch(0.12 0.03 158 / 0.25) 0%, transparent 70%)' }} />
        </>
      )}
      <Sidebar />
      <main className="content" style={{ position: 'relative', zIndex: 2 }}>{children}</main>
    </div>
  );
}
