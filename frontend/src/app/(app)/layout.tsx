'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import { PageSpinner } from '@/components/ui/Spinner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // TODO: re-enable auth guard once Cognito .env.local is configured
  // useEffect(() => {
  //   if (!isLoading && !isAuthenticated) {
  //     router.replace('/login');
  //   }
  // }, [isAuthenticated, isLoading, router]);

  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <PageSpinner />
  //     </div>
  //   );
  // }

  // if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="lg:pl-0 pl-0 pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
