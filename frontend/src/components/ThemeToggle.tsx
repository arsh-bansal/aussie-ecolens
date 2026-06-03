'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('eco-theme', next ? 'dark' : 'light'); } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 ${className}`}
      style={{ color: 'var(--muted)', background: 'var(--nav-active-bg)' } as React.CSSProperties}
    >
      {dark ? <Sun className="h-4 w-4" style={{ color: 'var(--accent)' }} /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
