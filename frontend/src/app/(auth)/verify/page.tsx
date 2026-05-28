'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Leaf, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d+$/, 'Code must contain digits only'),
});
type FormData = z.infer<typeof schema>;

export default function VerifyPage() {
  const { verify, resendCode } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') ?? '';

  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: emailParam },
  });

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await verify(data.email, data.code);
      setVerified(true);
      toast.success('Email verified! You can now sign in.');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      if (msg.includes('ExpiredCodeException')) {
        toast.error('Code has expired. Please request a new one.');
      } else if (msg.includes('CodeMismatchException') || msg.includes('Invalid')) {
        toast.error('Invalid verification code. Check your email and try again.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const emailVal = (document.getElementById('email') as HTMLInputElement)?.value;
    if (!emailVal) { toast.error('Please enter your email first.'); return; }
    try {
      await resendCode(emailVal);
      toast.success('New verification code sent!');
      setResendCooldown(60);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend code');
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-400">
        <div className="text-center animate-slide-up">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-forest-500/20 border border-forest-500/30">
            <CheckCircle2 className="h-8 w-8 text-forest-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-50 mb-2">Email verified!</h2>
          <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-400 px-4">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-500/20 border border-forest-500/30">
            <Leaf className="h-4 w-4 text-forest-400" />
          </div>
          <p className="text-base font-semibold text-forest-300">Aussie EcoLens</p>
        </div>

        {/* Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-500/15 border border-forest-500/25">
          <Mail className="h-7 w-7 text-forest-400" />
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-50">Verify your email</h2>
          <p className="mt-1.5 text-sm text-gray-500">
            Enter the 6-digit code sent to{' '}
            {emailParam ? <strong className="text-gray-300">{emailParam}</strong> : 'your email'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!emailParam && (
            <Input
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              required
              placeholder="researcher@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
          )}

          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="123456"
            hint="Check your inbox (and spam folder)"
            error={errors.code?.message}
            {...register('code')}
          />

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Verify email
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="text-sm text-forest-400/80 hover:text-forest-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend code"}
          </button>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
