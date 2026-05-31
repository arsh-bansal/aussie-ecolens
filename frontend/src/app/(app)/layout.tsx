'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import { PageSpinner } from '@/components/ui/Spinner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Auth guard (assignment requirement): unauthenticated users are blocked
  // from every (app) page and redirected to the login page.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // While auth state resolves, or while an unauthenticated user is being
  // redirected, show a spinner instead of the protected content.
  if (isLoading || !isAuthenticated) {
    return <PageSpinner />;
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
