'use client';

import dynamic from 'next/dynamic';

const Providers = dynamic(() => import('./Providers'), { ssr: false });

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
