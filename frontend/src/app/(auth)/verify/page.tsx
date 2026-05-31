'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import FloatingLeaves from '@/components/FloatingLeaves';

export default function VerifyPage() {
  const { verify, resendCode } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') ?? '';

  const [digits, setDigits]         = useState(['', '', '', '', '', '']);
  const [email, setEmail]           = useState(emailParam);
  const [loading, setLoading]       = useState(false);
  const [resendCooldown, setResend] = useState(0);
  const [verified, setVerified]     = useState(false);

  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResend((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const handleDigit = (i: number, val: string) => {
    const ch = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    if (ch && i < 5) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs[i - 1].current?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs[i + 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...digits];
    text.split('').forEach((ch, j) => { next[j] = ch; });
    setDigits(next);
    const last = Math.min(text.length, 5);
    refs[last].current?.focus();
  };

  const onSubmit = async () => {
    const code = digits.join('');
    if (code.length < 6) { toast.error('Enter the full 6-digit code.'); return; }
    if (!email) { toast.error('Email is required.'); return; }
    setLoading(true);
    try {
      await verify(email, code);
      setVerified(true);
      toast.success('Email verified! Redirecting to sign in…');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      if (msg.includes('ExpiredCode')) toast.error('Code has expired. Request a new one.');
      else if (msg.includes('CodeMismatch') || msg.includes('Invalid')) toast.error('Invalid code. Check your email.');
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) { toast.error('Please enter your email.'); return; }
    try {
      await resendCode(email);
      toast.success('New code sent!');
      setResend(60);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend');
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <FloatingLeaves />
        <div className="text-center animate-slide-up relative z-10">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(82,183,136,0.15)', border: '2px solid var(--primary-light)' }}
          >
            <CheckCircle2 className="h-10 w-10" style={{ color: 'var(--primary)' }} />
          </div>
          <h2 className="text-3xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            Email verified! 🦘
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      <div className="w-full max-w-sm relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-10 animate-slide-up">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <path d="M11 2C7 2 2 8 2 13C2 18 6 20 11 20C16 20 20 18 20 13C20 8 15 2 11 2Z" fill="var(--primary)" opacity="0.9"/>
            <line x1="11" y1="3" x2="11" y2="19" stroke="white" strokeWidth="0.8" opacity="0.5"/>
          </svg>
          <p className="text-sm font-bold font-display" style={{ color: 'var(--primary)' }}>Aussie EcoLens</p>
        </div>

        {/* Animated mail icon */}
        <div className="mb-8 page-enter">
          <div
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-6 mail-bob"
            style={{ background: 'var(--nav-active-bg)', border: '1.5px solid var(--border)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </div>
          <h2 className="text-3xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            Verify your email
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Enter the 6-digit code sent to{' '}
            {emailParam
              ? <strong style={{ color: 'var(--text)' }}>{emailParam}</strong>
              : 'your email'}
          </p>
        </div>

        {/* Email input (if not provided via URL) */}
        {!emailParam && (
          <div className="mb-4 page-enter-1">
            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--muted)' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="researcher@example.com"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
              style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text)' }}
            />
          </div>
        )}

        {/* OTP boxes */}
        <div className="flex gap-2 justify-center mb-6 page-enter-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`otp-digit ${d ? 'filled' : ''}`}
              autoFocus={i === 0}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
            />
          ))}
        </div>

        <div className="space-y-3 page-enter-3">
          <Button
            type="button"
            onClick={onSubmit}
            loading={loading}
            className="w-full"
            size="lg"
          >
            Verify email ✓
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="w-full text-sm py-2 transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--primary)' }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend code"}
          </button>

          <div className="text-center">
            <Link href="/login" className="text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
