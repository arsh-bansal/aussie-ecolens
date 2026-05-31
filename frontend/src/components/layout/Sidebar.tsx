'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';

const NAV = [
  { label: 'Dashboard',  href: '/dashboard',     emoji: '🏠' },
  { label: 'Upload',     href: '/upload',         emoji: '📤' },
  { label: 'Search',     href: '/search',         emoji: '🔍' },
  { label: 'Manage',     href: '/manage',         emoji: '🏷️' },
  { label: 'Alerts',     href: '/notifications',  emoji: '🔔' },
];

/* ── Decorative botanical ornament ───────────────────────────────── */
function BotanicalDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', opacity: 0.45 }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M5 0C4 2.5 1.5 4 0 5C1.5 6 4 7.5 5 10C6 7.5 8.5 6 10 5C8.5 4 6 2.5 5 0Z"
          fill="var(--primary)"
        />
      </svg>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

/* ── Leaf logo mark ──────────────────────────────────────────────── */
function LeafLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 2C7 2 2 8 2 13C2 18 6 20 11 20C16 20 20 18 20 13C20 8 15 2 11 2Z"
        fill="var(--primary)" opacity="0.9"
      />
      <line x1="11" y1="3"  x2="11" y2="19" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <line x1="7"  y1="9"  x2="11" y2="8"  stroke="white" strokeWidth="0.5" opacity="0.4" />
      <line x1="7"  y1="13" x2="11" y2="12" stroke="white" strokeWidth="0.5" opacity="0.4" />
      <line x1="15" y1="9"  x2="11" y2="8"  stroke="white" strokeWidth="0.5" opacity="0.4" />
      <line x1="15" y1="13" x2="11" y2="12" stroke="white" strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}

/* ── Detailed koala illustration ─────────────────────────────────── */
function KoalaIllustration() {
  return (
    <svg viewBox="0 0 80 74" fill="none" className="koala-sway" style={{ color: 'var(--primary)' }}>
      {/* Body */}
      <ellipse cx="40" cy="53" rx="19" ry="14.5" fill="currentColor" opacity="0.30" />
      {/* Belly */}
      <ellipse cx="40" cy="53" rx="10" ry="8.5" fill="currentColor" opacity="0.11" />
      {/* Head */}
      <circle cx="40" cy="30" r="14" fill="currentColor" opacity="0.36" />
      {/* Nose */}
      <ellipse cx="40" cy="33.5" rx="5.5" ry="3.8" fill="currentColor" opacity="0.62" />
      {/* Nostril shadows */}
      <ellipse cx="38.2" cy="33.5" rx="1.1" ry="0.7" fill="white" opacity="0.22" />
      <ellipse cx="41.8" cy="33.5" rx="1.1" ry="0.7" fill="white" opacity="0.22" />
      {/* Left ear outer */}
      <circle cx="27" cy="18.5" r="8.5" fill="currentColor" opacity="0.34" />
      {/* Left ear inner */}
      <circle cx="27" cy="18.5" r="5"   fill="currentColor" opacity="0.13" />
      {/* Right ear outer */}
      <circle cx="53" cy="18.5" r="8.5" fill="currentColor" opacity="0.34" />
      {/* Right ear inner */}
      <circle cx="53" cy="18.5" r="5"   fill="currentColor" opacity="0.13" />
      {/* Eyes */}
      <circle cx="35.8" cy="27" r="2.8" fill="currentColor" opacity="0.72" />
      <circle cx="44.2" cy="27" r="2.8" fill="currentColor" opacity="0.72" />
      {/* Eye shines */}
      <circle cx="36.8" cy="26.1" r="1.0" fill="white" opacity="0.58" />
      <circle cx="45.2" cy="26.1" r="1.0" fill="white" opacity="0.58" />
      {/* Arms */}
      <path d="M22 45 Q14 50 17 58" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.25" />
      <path d="M58 45 Q66 50 63 58" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.25" />
      {/* Feet */}
      <path d="M32 65 Q27 71 22 69" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.22" />
      <path d="M48 65 Q53 71 58 69" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.22" />
      {/* Sleepy Z's */}
      <text x="57" y="22" fontSize="9"   fill="currentColor" opacity="0.42" fontFamily="Georgia, serif">z</text>
      <text x="64" y="15" fontSize="6.5" fill="currentColor" opacity="0.28" fontFamily="Georgia, serif">z</text>
    </svg>
  );
}

/* ── Nav + footer content ────────────────────────────────────────── */
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
    <div
      className="flex h-full flex-col"
      style={{ background: 'var(--sidebar-bg)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Background depth — forest clearing glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(ellipse 140% 60% at 50% 0%, rgba(45,106,79,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 100% 50% at 50% 100%, rgba(45,106,79,0.05) 0%, transparent 65%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="flex h-full flex-col" style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Brand ── */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '13px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '11px',
              background: 'var(--nav-active-bg)',
              border: '1.5px solid var(--nav-active-border)',
              flexShrink: 0,
              boxShadow: '0 1px 6px rgba(45,106,79,0.10)',
            }}>
              <LeafLogo />
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: '19px',
                fontWeight: 700,
                color: 'var(--primary)',
                lineHeight: 1,
                letterSpacing: '-0.015em',
              }}>
                EcoLens
              </p>
              <p style={{
                fontSize: '7.5px',
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                color: 'var(--muted)',
                marginTop: '3px',
                fontFamily: 'var(--font-mono)',
                opacity: 0.8,
              }}>
                Wildlife Observatory
              </p>
            </div>
          </div>

          <BotanicalDivider />

          {/* Metadata row */}
          <div style={{
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: '7px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--muted)',
              opacity: 0.55,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}>
              Multi-Cloud Platform
            </span>
            <span style={{
              fontSize: '7px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--muted)',
              opacity: 0.45,
              letterSpacing: '0.08em',
            }}>
              AWS · Azure
            </span>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: '14px 10px' }}>
          <p style={{
            fontSize: '7.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: 'var(--muted)',
            opacity: 0.6,
            padding: '0 8px',
            marginBottom: '8px',
            fontFamily: 'var(--font-mono)',
          }}>
            Navigation
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {NAV.map(({ label, href, emoji }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onLinkClick}
                  className={cn(!active && 'sidebar-nav-link')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 10px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    transition: 'background 0.15s ease, color 0.15s ease',
                    background: active ? 'var(--nav-active-bg)' : 'transparent',
                    borderLeft: `3px solid ${active ? 'var(--primary)' : 'transparent'}`,
                    paddingLeft: '9px',
                    color: active ? 'var(--primary)' : 'var(--muted)',
                    fontSize: '13.5px',
                    fontWeight: active ? 600 : 500,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ fontSize: '15px', lineHeight: 1, width: '20px', textAlign: 'center', flexShrink: 0 }}>
                    {emoji}
                  </span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {active && (
                    <span
                      className="nav-indicator"
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ── Koala specimen card ── */}
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{
            border: '1px dashed var(--border)',
            borderRadius: '12px',
            padding: '16px 12px 10px',
            position: 'relative',
            background: 'var(--nav-active-bg)',
          }}>
            {/* Specimen label */}
            <div style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--sidebar-bg)',
              padding: '0 9px',
              fontSize: '6.5px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--muted)',
              letterSpacing: '0.14em',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
            }}>
              Specimen · No.001
            </div>

            <div style={{ width: '52px', margin: '0 auto' }}>
              <KoalaIllustration />
            </div>

            <p style={{
              textAlign: 'center',
              fontSize: '7px',
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: 'var(--muted)',
              opacity: 0.6,
              marginTop: '6px',
              letterSpacing: '0.02em',
            }}>
              Phascolarctos cinereus
            </p>
          </div>
        </div>

        {/* ── User footer ── */}
        <div style={{
          padding: '12px 10px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {/* Researcher badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '10px',
            background: 'var(--nav-active-bg)',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              flexShrink: 0,
              letterSpacing: '0.03em',
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
              }}>
                {displayName}
              </p>
              <p style={{
                fontSize: '9.5px',
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                opacity: 0.75,
                marginTop: '1px',
              }}>
                {user?.email}
              </p>
            </div>
            <ThemeToggle />
          </div>

          <button
            onClick={logout}
            className="hover:opacity-80 transition-opacity"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontFamily: 'var(--font-body)',
              color: 'var(--danger)',
              background: 'rgba(193,68,14,0.06)',
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
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
