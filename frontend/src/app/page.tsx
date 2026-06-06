'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import UluruScroll from '@/components/landing/UluruScroll';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  // Fade the page out via the #page-exit overlay, then navigate.
  const navTo = (href: string) => {
    const el = document.getElementById('page-exit');
    if (el) { el.style.opacity = '1'; el.style.pointerEvents = 'all'; }
    setTimeout(() => router.push(href), 500);
  };

  if (isLoading) return null;

  return (
    <>
      <UluruScroll onPrimary={() => navTo('/signup')} onSecondary={() => navTo('/login')} />
      <div id="page-exit" />
    </>
  );
}
