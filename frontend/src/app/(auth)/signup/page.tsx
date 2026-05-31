'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FloatingLeaves from '@/components/FloatingLeaves';

const schema = z
  .object({
    firstName:       z.string().min(1, 'First name is required').max(50),
    lastName:        z.string().min(1, 'Last name is required').max(50),
    email:           z.string().email('Enter a valid email address'),
    password:        z.string()
                       .min(8, 'At least 8 characters')
                       .regex(/[A-Z]/, 'At least one uppercase letter')
                       .regex(/[0-9]/, 'At least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type FormData = z.infer<typeof schema>;

const STEPS = ['Account', 'Security', 'Verify'] as const;

const FEATURES = [
  { emoji: '🤖', text: 'Automatic species detection with AI' },
  { emoji: '☁️', text: 'Multi-cloud storage (AWS + Azure)' },
  { emoji: '🔔', text: 'Email alerts for new sightings' },
  { emoji: '🔍', text: 'Search by species, tags, or image' },
];

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export default function SignupPage() {
  const { register: authRegister } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authRegister({
        email:     data.email,
        password:  data.password,
        firstName: data.firstName,
        lastName:  data.lastName,
      });
      toast.success('Account created! Check your email for a verification code.');
      router.push(`/verify?email=${encodeURIComponent(data.email)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed';
      if (msg.includes('UsernameExistsException') || msg.includes('already exists')) {
        toast.error('An account with this email already exists.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    toast.info('Google sign-up coming soon!');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      {/* ── Left decorative panel ── */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
      >
        {/* Subtle radial glow */}
        <div
          className="absolute -top-20 -left-20 h-80 w-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(82,183,136,0.08) 0%, transparent 70%)' }}
        />

        {/* Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}
          >
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <path d="M11 2C7 2 2 8 2 13C2 18 6 20 11 20C16 20 20 18 20 13C20 8 15 2 11 2Z" fill="var(--primary)" opacity="0.9"/>
              <line x1="11" y1="3" x2="11" y2="19" stroke="white" strokeWidth="0.8" opacity="0.5"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold font-display" style={{ color: 'var(--primary)' }}>Aussie EcoLens</p>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Wildlife Observatory</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <h1 className="text-3xl font-bold font-display leading-snug mb-3" style={{ color: 'var(--text)' }}>
            Join the<br />
            <span style={{ color: 'var(--primary)' }}>EcoLens</span> community 🌿
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--muted)', maxWidth: '280px' }}>
            Contribute to citizen science by uploading and tagging wildlife media.
            Every image helps protect Australia&apos;s unique biodiversity.
          </p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6" style={{ background: 'var(--border)' }} />}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={i === 0
                    ? { background: 'var(--primary)', color: '#fff' }
                    : { background: 'var(--nav-active-bg)', color: 'var(--muted)', border: '1px solid var(--border)' }
                  }
                >
                  <span>{i + 1}</span>
                  <span>{s}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div className="space-y-3">
            {FEATURES.map(({ emoji, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div
                  className="h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}
                >
                  {emoji}
                </div>
                <span className="text-sm" style={{ color: 'var(--muted)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs" style={{ color: 'var(--muted)', opacity: 0.5 }}>
          FIT5225 · Multi-Cloud Serverless Platform
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto relative z-10">
        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <path d="M11 2C7 2 2 8 2 13C2 18 6 20 11 20C16 20 20 18 20 13C20 8 15 2 11 2Z" fill="var(--primary)" opacity="0.9"/>
            <line x1="11" y1="3" x2="11" y2="19" stroke="white" strokeWidth="0.8" opacity="0.5"/>
          </svg>
          <p className="text-sm font-bold font-display" style={{ color: 'var(--primary)' }}>Aussie EcoLens</p>
        </div>

        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8">
            <h2 className="text-3xl font-bold font-display" style={{ color: 'var(--text)' }}>Create account</h2>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>Join the wildlife observation network</p>
          </div>

          {/* Google signup */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-80 mb-5"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-card)' }}
          >
            <GoogleLogo />
            Sign up with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>or with email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                type="text"
                autoComplete="given-name"
                required
                leftAddon={<User className="h-4 w-4" />}
                placeholder="Jane"
                error={errors.firstName?.message}
                {...register('firstName')}
              />
              <Input
                label="Last name"
                type="text"
                autoComplete="family-name"
                required
                placeholder="Doe"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              leftAddon={<Mail className="h-4 w-4" />}
              placeholder="researcher@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              leftAddon={<Lock className="h-4 w-4" />}
              rightAddon={
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:opacity-70 transition-opacity">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              placeholder="Min. 8 chars, 1 uppercase, 1 number"
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              leftAddon={<Lock className="h-4 w-4" />}
              placeholder="Re-enter password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
              Create account 🦘
            </Button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
