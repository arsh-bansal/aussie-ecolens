'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';

const NAV = [
  { label: 'Dashboard',     href: '/dashboard',     emoji: '🏠' },
  { label: 'Upload',        href: '/upload',         emoji: '📤' },
  { label: 'Search',        href: '/search',         emoji: '🔍' },
  { label: 'Manage',        href: '/manage',         emoji: '🏷️' },
  { label: 'Alerts',        href: '/notifications',  emoji: '🔔' },
];

/* ── Inline SVG: tiny koala sitting ─────────────────────────────── */
function KoalaIllustration() {
  return (
    <svg viewBox="0 0 80 72" fill="none" className="koala-sway" style={{ color: 'var(--muted)' }}>
      <ellipse cx="40" cy="50" rx="20" ry="16" fill="currentColor" opacity="0.45" />
      <circle cx="40" cy="30" r="14" fill="currentColor" opacity="0.45" />
      <ellipse cx="40" cy="33" rx="5" ry="3.5" fill="currentColor" opacity="0.7" />
      <circle cx="27" cy="19" r="8" fill="currentColor" opacity="0.4" />
      <circle cx="27" cy="19" r="4.5" fill="currentColor" opacity="0.18" />
      <circle cx="53" cy="19" r="8" fill="currentColor" opacity="0.4" />
      <circle cx="53" cy="19" r="4.5" fill="currentColor" opacity="0.18" />
      <path d="M33 28 Q35.5 25.5 38 28" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M42 28 Q44.5 25.5 47 28" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M24 50 Q18 58 20 65" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      <path d="M56 50 Q62 58 60 65" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      <text x="56" y="22" fontSize="8" fill="currentColor" opacity="0.5" fontFamily="serif">z</text>
      <text x="62" y="16" fontSize="6" fill="currentColor" opacity="0.35" fontFamily="serif">z</text>
    </svg>
  );
}

/* ── Leaf logo mark ─────────────────────────────────────────────── */
function LeafLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 2C7 2 2 8 2 13C2 18 6 20 11 20C16 20 20 18 20 13C20 8 15 2 11 2Z"
        fill="var(--primary)" opacity="0.9"
      />
      <line x1="11" y1="3" x2="11" y2="19" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <line x1="7"  y1="9"  x2="11" y2="8"  stroke="white" strokeWidth="0.5" opacity="0.4" />
      <line x1="7"  y1="13" x2="11" y2="12" stroke="white" strokeWidth="0.5" opacity="0.4" />
      <line x1="15" y1="9"  x2="11" y2="8"  stroke="white" strokeWidth="0.5" opacity="0.4" />
      <line x1="15" y1="13" x2="11" y2="12" stroke="white" strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}

function NavContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.given_name?.[0] ?? ''}${user.family_name?.[0] ?? ''}`.toUpperCase() ||
      user.email[0].toUpperCase()
    : '?';

  const displayName =
    user?.given_name && user?.family_name
      ? `${user.given_name} ${user.family_name}`
      : user?.given_name ?? user?.email.split('@')[0] ?? 'Researcher';

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--sidebar-bg)' }}>

      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5 h-[68px] flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}
        >
          <LeafLogo />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight font-display" style={{ color: 'var(--primary)' }}>
            EcoLens
          </p>
          <p className="text-[9.5px] uppercase tracking-widest leading-tight" style={{ color: 'var(--muted)' }}>
            Aussie Wildlife Observatory
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p
          className="px-3 mb-3 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--muted)', opacity: 0.7 }}
        >
          Navigation
        </p>
        <div className="space-y-0.5">
          {NAV.map(({ label, href, emoji }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onLinkClick}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                )}
                style={
                  active
                    ? {
                        background:   'var(--nav-active-bg)',
                        borderLeft:   '3px solid var(--accent)',
                        paddingLeft:  '9px',
                        color:        'var(--primary)',
                      }
                    : {
                        color:        'var(--muted)',
                        borderLeft:   '3px solid transparent',
                        paddingLeft:  '9px',
                      }
                }
              >
                <span className="text-base leading-none w-5 text-center">{emoji}</span>
                <span className="flex-1">{label}</span>
                {active && (
                  <span
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Koala decoration */}
      <div className="px-5 pb-1 opacity-60">
        <div className="w-14 mx-auto">
          <KoalaIllustration />
        </div>
      </div>

      {/* User footer */}
      <div className="px-3 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl" style={{ background: 'var(--nav-active-bg)' }}>
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{displayName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 hover:opacity-80"
          style={{ color: 'var(--danger)', background: 'rgba(193,68,14,0.06)' }}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden lg:flex w-60 flex-shrink-0 flex-col h-screen sticky top-0 z-30"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        <NavContent />
      </aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-xl backdrop-blur-sm"
        style={{
          background: 'var(--surface)',
          border:     '1px solid var(--border)',
          color:      'var(--muted)',
          boxShadow:  'var(--shadow-card)',
        }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative z-10 w-60 flex flex-col h-screen animate-slide-in"
            style={{ borderRight: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 p-1.5 rounded-lg"
              style={{ color: 'var(--muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
            <NavContent onLinkClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
