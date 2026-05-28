'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Leaf, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const emailSchema = z.object({ email: z.string().email('Enter a valid email') });
const resetSchema = z.object({
  code: z.string().length(6, 'Must be 6 digits').regex(/^\d+$/, 'Digits only'),
  newPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'At least one uppercase letter')
    .regex(/[0-9]/, 'At least one number'),
});

type EmailForm = z.infer<typeof emailSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const { sendResetCode, resetPassword } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-400 px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-500/20 border border-forest-500/30">
            <Leaf className="h-4 w-4 text-forest-400" />
          </div>
          <p className="text-base font-semibold text-forest-300">Aussie EcoLens</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8">
          {(['email', 'reset'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${step === 'reset' ? 'bg-forest-500' : 'bg-dark-50'}`} />}
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s
                    ? 'bg-forest-500 text-black'
                    : s === 'email' && step === 'reset'
                    ? 'bg-forest-500/20 text-forest-400'
                    : 'bg-dark-50 text-gray-600'
                }`}
              >
                {i + 1}
              </div>
            </div>
          ))}
          <span className="ml-2 text-xs text-gray-600">
            {step === 'email' ? 'Enter email' : 'Reset password'}
          </span>
        </div>

        {step === 'email' ? (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-50">Forgot password?</h2>
              <p className="mt-1.5 text-sm text-gray-500">
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
                Send reset code
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-50">Set new password</h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Enter the code sent to <strong className="text-gray-300">{email}</strong>
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
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                leftAddon={<Lock className="h-4 w-4" />}
                rightAddon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                placeholder="Min. 8 chars, 1 uppercase, 1 number"
                error={resetForm.formState.errors.newPassword?.message}
                {...resetForm.register('newPassword')}
              />
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Reset password
              </Button>
            </form>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="mt-4 text-sm text-gray-600 hover:text-gray-400 transition-colors"
            >
              ← Use a different email
            </button>
          </>
        )}

        <div className="mt-6">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
