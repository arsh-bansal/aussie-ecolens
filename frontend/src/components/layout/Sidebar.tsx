'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV: { href: string; label: string; icon: React.ReactNode; count?: number }[] = [
  {
    href: '/dashboard', label: 'Dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  },
  {
    href: '/upload', label: 'Upload',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 16V7m0 0l-3.5 3.5M12 7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 16v1.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V16"/></svg>,
  },
  {
    href: '/search', label: 'Search',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" strokeLinecap="round"/></svg>,
  },
  {
    href: '/manage', label: 'Manage',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>,
  },
  {
    href: '/notifications', label: 'Alerts',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round"/></svg>,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const initials = user
    ? `${user.given_name?.[0] ?? ''}${user.family_name?.[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
    : '?';

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <span className="sb-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
            <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>
            <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" strokeLinecap="round"/>
          </svg>
        </span>
        <div>
          <div className="sb-brand-name">Aussie EcoLens</div>
          <div className="sb-brand-sub">Observatory</div>
        </div>
      </div>

      <div className="sb-section">Observatory</div>

      <nav className="sb-nav">
        {NAV.map(({ href, label, icon, count }) => (
          <Link key={href} href={href} className={`sb-link${pathname === href || pathname.startsWith(href + '/') ? ' active' : ''}`}>
            {icon}
            {label}
            {count !== undefined && <span className="sb-count">{count}</span>}
          </Link>
        ))}
      </nav>

      <div className={`sb-foot${open ? ' open' : ''}`}>
        <div className="sb-menu">
          <Link href="/profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round"/></svg>
            Profile
          </Link>
          <div className="sb-sep" />
          <a className="danger" href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 17l5-5-5-5M20 12H9M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Sign out
          </a>
        </div>
        <button
          className="sb-user"
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        >
          <span className="sb-avatar">{initials}</span>
          <div>
            <div className="sb-user-name">{user?.given_name ?? user?.email.split('@')[0] ?? 'User'}</div>
            <div className="sb-user-role">Observer</div>
          </div>
          <span className="sb-chev">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>
    </aside>
  );
}
