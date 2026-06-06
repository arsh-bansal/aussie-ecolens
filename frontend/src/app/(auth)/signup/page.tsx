'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export default function SignupPage() {
  const { register } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const pwHasUpper = /[A-Z]/.test(form.password);
  const pwHasNumber = /[0-9]/.test(form.password);
  const pwHasSpecial = /[!@#$%^&*]/.test(form.password);
  const pwLongEnough = form.password.length >= 8;
  const pwValid = pwLongEnough && pwHasUpper && pwHasNumber;
  const strength = pwValid && pwHasSpecial && form.password.length >= 10 ? 3 : pwValid ? 2 : pwLongEnough ? 1 : form.password.length >= 4 ? 1 : 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName });
      router.push(`/verify?email=${encodeURIComponent(form.email)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth">
      <video className="auth-video" autoPlay muted loop playsInline preload="auto">
        <source src="/into-the-wild-unseen.mp4" type="video/mp4" />
      </video>
      <div className="auth-bg-veil" />

      <section className="auth-visual">
        <div className="visual-inner">
          <div className="auth-brand">
            <span className="auth-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" strokeLinecap="round"/></svg>
            </span>
            <div>
              <div className="auth-brand-name">Aussie EcoLens</div>
              <div className="auth-brand-sub">Wildlife Observatory</div>
            </div>
          </div>
          <div className="visual-quote">
            <div className="eyebrow">Join the field network</div>
            <h2>Turn your camera traps into living data.</h2>
            <p>Researchers, rangers and citizen scientists across Australia use EcoLens to identify, verify and track species at continental scale.</p>
            <div className="visual-meta">
              <div className="vm"><div className="vm-val">240+</div><div className="vm-lab">Field stations</div></div>
              <div className="vm"><div className="vm-val">19</div><div className="vm-lab">Conservation orgs</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-kicker">Create account</div>
          <h1>Request field access</h1>
          <p className="lede">Set up your observer profile. We&apos;ll send a verification code to confirm your email.</p>

          <div className="auth-fields">
            <div className="auth-row">
              <div className="field">
                <label htmlFor="fn">First name</label>
                <input className="input" id="fn" type="text" placeholder="Thandi" value={form.firstName} onChange={set('firstName')} required />
              </div>
              <div className="field">
                <label htmlFor="ln">Last name</label>
                <input className="input" id="ln" type="text" placeholder="Naidu" value={form.lastName} onChange={set('lastName')} required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input className="input" id="email" type="email" placeholder="ranger@ecolens.org.au" value={form.email} onChange={set('email')} required />
            </div>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input className="input" id="pw" type="password" placeholder="Create a strong password" value={form.password} onChange={set('password')} required />
              <div className="pw-strength">
                {[0,1,2].map(i => <span key={i} className={i < strength ? 'on' : ''} />)}
              </div>
              <div className="pw-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Use 8+ characters with an uppercase letter and number
              </div>
            </div>
            <label className="checkbox" style={{ marginTop: '4px' }}>
              <input type="checkbox" required /> I agree to the <Link href="/policy" className="link-ochre" target="_blank">data &amp; ethics policy</Link>
            </label>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading} style={{ marginTop: '6px' }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </div>

          <p className="auth-sub">Already have access? <Link href="/login" className="link-ochre">Sign in</Link></p>
        </form>
      </section>
    </main>
  );
}
