'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import OutbackBackground from '@/components/auth/OutbackBackground';
import { useAuthFocus } from '@/components/auth/useAuthFocus';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { focused, formFocusProps } = useAuthFocus();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('User is not confirmed')) {
        toast.warning('Please verify your email first.');
        router.push(`/verify?email=${encodeURIComponent(email)}`);
      } else if (msg.includes('Incorrect username or password') || msg.includes('User does not exist')) {
        toast.error('Incorrect email or password.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`auth${focused ? ' auth--focused' : ''}`}>
      <OutbackBackground />
      <div className="auth-bg-veil" />

      {/* Left — visual */}
      <section className="auth-visual">
        <div className="visual-inner">
          <Link href="/" className="auth-brand auth-brand--link" aria-label="Aussie EcoLens — home">
            <span className="auth-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" strokeLinecap="round"/></svg>
            </span>
            <div>
              <div className="auth-brand-name">Aussie EcoLens</div>
              <div className="auth-brand-sub">Wildlife Observatory</div>
            </div>
          </Link>
          <div className="visual-quote">
            <div className="eyebrow">AI-powered field intelligence</div>
            <h2>See every creature the bush keeps hidden.</h2>
            <p>MegaDetector finds the animal. SpeciesNet names it. You get verified Australian wildlife observations — from camera traps to drone footage.</p>
            <div className="visual-meta">
              <div className="vm"><div className="vm-val">1.4M+</div><div className="vm-lab">Detections logged</div></div>
              <div className="vm"><div className="vm-val">312</div><div className="vm-lab">Native species</div></div>
              <div className="vm"><div className="vm-val">98.2%</div><div className="vm-lab">Mean confidence</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Right — form */}
      <section className="auth-panel">
        <form className="auth-form" onSubmit={onSubmit} {...formFocusProps}>
          <div className="auth-kicker">Welcome back</div>
          <h1>Sign in to the observatory</h1>
          <p className="lede">Pick up where you left off — your detections, alerts and review queue are waiting.</p>

          <div className="auth-fields">
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input className="input" id="email" type="email" placeholder="ranger@ecolens.org.au" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input className="input" id="pw" type="password" placeholder="••••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="auth-aux">
              <label className="checkbox"><input type="checkbox" defaultChecked /> Keep me signed in</label>
              <Link href="/forgot-password" className="link-ochre">Forgot password?</Link>
            </div>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading} style={{ marginTop: '6px' }}>
              {loading ? 'Signing in…' : 'Enter the observatory'}
            </button>
          </div>

          <p className="auth-sub">New to EcoLens? <Link href="/signup" className="link-ochre">Request field access</Link></p>
        </form>
      </section>
    </main>
  );
}
