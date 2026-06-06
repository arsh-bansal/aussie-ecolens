'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import OutbackBackground from '@/components/auth/OutbackBackground';
import { useAuthFocus } from '@/components/auth/useAuthFocus';

export default function ForgotPasswordPage() {
  const { sendResetCode, resetPassword } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { focused, formFocusProps } = useAuthFocus();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendResetCode(email);
      setStep('reset');
      toast.info('Reset code sent to your email.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const onResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email, code, newPassword);
      toast.success('Password reset successfully! Please sign in.');
      router.push('/login');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      if (msg.includes('ExpiredCode')) { toast.error('Code has expired. Please start over.'); setStep('email'); }
      else if (msg.includes('CodeMismatch') || msg.includes('Invalid')) toast.error('Invalid or incorrect code.');
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`auth${focused ? ' auth--focused' : ''}`}>
      <OutbackBackground />
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
            <div className="eyebrow">Account recovery</div>
            <h2>{step === 'email' ? 'Forgot your password?' : 'Set a new password.'}</h2>
            <p>{step === 'email' ? 'Enter your email and we\'ll send a reset code to get you back in the field.' : 'Use the 6-digit code from your email to set a new password.'}</p>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        {step === 'email' ? (
          <form className="auth-form" onSubmit={onEmailSubmit} {...formFocusProps}>
            <div className="auth-icon-badge">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
            </div>
            <div className="auth-kicker">Account recovery</div>
            <h1>Forgot password?</h1>
            <p className="lede">Enter your email and we&apos;ll send a reset code.</p>
            <div className="auth-fields">
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input className="input" id="email" type="email" placeholder="ranger@ecolens.org.au" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
            </div>
            <p className="auth-sub"><Link href="/login" className="link-ochre">← Back to sign in</Link></p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={onResetSubmit} {...formFocusProps}>
            <div className="auth-kicker">Account recovery</div>
            <h1>Set new password</h1>
            <p className="lede">Code sent to <strong style={{ color: 'var(--ink)' }}>{email}</strong></p>
            <div className="auth-fields">
              <div className="field">
                <label htmlFor="code">Reset code</label>
                <input className="input" id="code" type="text" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="npw">New password</label>
                <input className="input" id="npw" type="password" placeholder="Min. 8 chars, 1 uppercase, 1 number" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              </div>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
            <p className="auth-sub">
              <button type="button" className="link-ochre" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => setStep('email')}>
                ← Use a different email
              </button>
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
