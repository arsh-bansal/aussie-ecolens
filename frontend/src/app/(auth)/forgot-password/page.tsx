'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FloatingLeaves from '@/components/FloatingLeaves';

const emailSchema = z.object({ email: z.string().email('Enter a valid email') });
const resetSchema = z.object({
  code:        z.string().length(6, 'Must be 6 digits').regex(/^\d+$/, 'Digits only'),
  newPassword: z.string()
                 .min(8, 'At least 8 characters')
                 .regex(/[A-Z]/, 'At least one uppercase letter')
                 .regex(/[0-9]/, 'At least one number'),
});

type EmailForm = z.infer<typeof emailSchema>;
type ResetForm = z.infer<typeof resetSchema>;

const STEPS = [
  { label: 'Enter email',    desc: 'We\'ll send a reset code' },
  { label: 'Reset password', desc: 'Use the code from email' },
];

export default function ForgotPasswordPage() {
  const { sendResetCode, resetPassword } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [step, setStep]         = useState<'email' | 'reset'>('email');
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onEmailSubmit = async (data: EmailForm) => {
    setLoading(true);
    try {
      await sendResetCode(data.email);
      setEmail(data.email);
      setStep('reset');
      toast.info('Reset code sent to your email.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const onResetSubmit = async (data: ResetForm) => {
    setLoading(true);
    try {
      await resetPassword(email, data.code, data.newPassword);
      toast.success('Password reset successfully! Please sign in.');
      router.push('/login');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      if (msg.includes('ExpiredCode')) {
        toast.error('Code has expired. Please start over.');
        setStep('email');
      } else if (msg.includes('CodeMismatch') || msg.includes('Invalid')) {
        toast.error('Invalid or incorrect code.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === 'email' ? 0 : 1;

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

        {/* Step progress */}
        <div className="flex items-center gap-3 mb-10 page-enter">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className="h-0.5 w-10 transition-all duration-500"
                  style={{ background: stepIndex >= i ? 'var(--primary)' : 'var(--border)' }}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                  style={i < stepIndex
                    ? { background: 'var(--primary-light)', color: '#fff' }
                    : i === stepIndex
                    ? { background: 'var(--primary)', color: '#fff' }
                    : { background: 'var(--input-bg)', color: 'var(--muted)', border: '1.5px solid var(--border)' }
                  }
                >
                  {i < stepIndex ? '✓' : i + 1}
                </div>
                {i === stepIndex && (
                  <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{s.label}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {step === 'email' ? (
          <div className="page-enter-1">
            <div className="mb-6">
              <h2 className="text-3xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
                Forgot password?
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Enter your email and we&apos;ll send a reset code.
              </p>
            </div>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                required
                leftAddon={<Mail className="h-4 w-4" />}
                placeholder="researcher@example.com"
                error={emailForm.formState.errors.email?.message}
                {...emailForm.register('email')}
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Send reset code →
              </Button>
            </form>
          </div>
        ) : (
          <div className="page-enter-1">
            <div className="mb-6">
              <h2 className="text-3xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
                Set new password
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Code sent to <strong style={{ color: 'var(--text)' }}>{email}</strong>
              </p>
            </div>
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
              <Input
                label="Reset code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                required
                placeholder="123456"
                error={resetForm.formState.errors.code?.message}
                {...resetForm.register('code')}
              />
              <Input
                label="New password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                required
                leftAddon={<Lock className="h-4 w-4" />}
                rightAddon={
                  <button type="button" onClick={() => setShowPw(!showPw)} className="hover:opacity-70 transition-opacity">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                error={resetForm.formState.errors.newPassword?.message}
                {...resetForm.register('newPassword')}
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Reset password ✓
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="mt-4 text-sm hover:opacity-70 transition-opacity"
              style={{ color: 'var(--muted)' }}
            >
              ← Use a different email
            </button>
          </div>
        )}

        <div className="mt-6 page-enter-2">
          <Link href="/login" className="text-sm hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
