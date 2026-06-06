'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import OutbackBackground from '@/components/auth/OutbackBackground';
import { useAuthFocus } from '@/components/auth/useAuthFocus';

export default function VerifyPage() {
  const { verify, resendCode } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const { focused, formFocusProps } = useAuthFocus();

  const handleInput = (i: number, val: string) => {
    const d = [...digits];
    d[i] = val.slice(-1);
    setDigits(d);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  // Pasting a code (e.g. "123456") into any box distributes the digits across
  // the boxes from that box onward, then auto-submits if all six are filled.
  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const nums = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!nums) return;
    e.preventDefault();
    const d = [...digits];
    for (let k = 0; k < nums.length && i + k < 6; k++) d[i + k] = nums[k];
    setDigits(d);
    const lastFilled = Math.min(i + nums.length, 6) - 1;
    refs.current[Math.min(lastFilled + 1, 5)]?.focus();
    const code = d.join('');
    if (code.length === 6) verifyCode(code);
  };

  const verifyCode = async (code: string) => {
    if (code.length < 6) { toast.error('Enter the full 6-digit code.'); return; }
    setLoading(true);
    try {
      await verify(email, code);
      toast.success('Email verified! Please sign in.');
      router.push('/login');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(digits.join(''));
  };

  const handleResend = async () => {
    try {
      await resendCode(email);
      setResent(true);
      toast.info('New code sent — check your inbox.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend');
    }
  };

  return (
    <main className={`auth${focused ? ' auth--focused' : ''}`}>
      <OutbackBackground />
      <div className="auth-bg-veil" />

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
            <div className="eyebrow">Almost there</div>
            <h2>One last step before the field opens up.</h2>
            <p>Verifying your email keeps the observatory trustworthy — every observer is a real, accountable contributor.</p>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={onSubmit} {...formFocusProps}>
          <div className="auth-icon-badge">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
          </div>
          <div className="auth-kicker">Verify email</div>
          <h1>Enter your code</h1>
          <p className="lede">
            We sent a 6-digit verification code to <strong style={{ color: 'var(--ink)' }}>{email || 'your email'}</strong>. It expires in 10 minutes.
          </p>

          <div className="otp">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { refs.current[i] = el; }}
                maxLength={1}
                inputMode="numeric"
                value={d}
                onChange={e => handleInput(i, e.target.value)}
                onKeyDown={e => handleKey(i, e)}
                onPaste={e => handlePaste(i, e)}
              />
            ))}
          </div>

          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading} style={{ marginTop: '26px' }}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>

          <p className="auth-sub">
            Didn&apos;t get it?{' '}
            <button type="button" className="link-ochre" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }} onClick={handleResend}>
              Resend code
            </button>
            {' · '}
            <Link href="/signup" className="link-ochre">Change email</Link>
          </p>
          {resent && <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--euc)', marginTop: '10px' }}>New code sent — check your inbox.</p>}
        </form>
      </section>
    </main>
  );
}
