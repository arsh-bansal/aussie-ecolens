'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  Search,
  Tag,
  Bell,
  LogOut,
  Leaf,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Upload', href: '/upload', icon: Upload },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Manage', href: '/manage', icon: Tag },
  { label: 'Notifications', href: '/notifications', icon: Bell },
];

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
      : user?.given_name ?? user?.email.split('@')[0] ?? 'User';

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-dark-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-500/15 border border-forest-500/25 flex-shrink-0">
          <Leaf className="h-4 w-4 text-forest-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-forest-300 leading-tight">EcoLens</p>
          <p className="text-[10px] text-gray-600 leading-tight">Aussie Wildlife</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-700">
          Navigation
        </p>
        <div className="space-y-0.5">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onLinkClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                  active
                    ? 'bg-forest-500/12 text-forest-300 border border-forest-500/18'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/4 border border-transparent'
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-forest-400')} />
                <span>{label}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-forest-400 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-dark-50 p-3 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-forest-500/20 border border-forest-500/25 text-forest-300 text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-200 truncate">{displayName}</p>
            <p className="text-[10px] text-gray-600 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-500/8 transition-all duration-150"
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
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col bg-dark-300 border-r border-dark-50 h-screen sticky top-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-dark-200/90 border border-dark-50 text-gray-400 hover:text-gray-200 backdrop-blur-sm"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-56 flex flex-col bg-dark-300 border-r border-dark-50 h-screen animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 p-1.5 rounded-lg text-gray-600 hover:text-gray-200 hover:bg-white/5"
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
