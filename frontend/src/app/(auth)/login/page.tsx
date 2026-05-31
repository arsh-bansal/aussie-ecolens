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
import FloatingLeaves from '@/components/FloatingLeaves';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

const PHOTO_COLS = [
  { animals: ['koala','kangaroo','wombat','echidna','quokka','platypus'],        dir: 'up',   duration: 26, offset: 0   },
  { animals: ['cassowary','cockatoo','flying-fox','bilby','numbat','dingo'],     dir: 'down', duration: 34, offset: -9  },
  { animals: ['possum','wallaby','emu','kookaburra','echidna','koala'],          dir: 'up',   duration: 22, offset: -16 },
];

function GridPhoto({ name }: { name: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-xl group" style={{ aspectRatio: '4/3', background: 'var(--border)', flexShrink: 0 }}>
      {broken ? (
        <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: 'var(--card)' }}>
          <span className="text-2xl mb-1">🐾</span>
          <span className="text-[9px] capitalize" style={{ color: 'var(--muted)' }}>{name.replace('-', ' ')}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/wildlife/${name}.jpg`}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

/* Google "G" logo */
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

export default function LoginPage() {
  const { login } = useAuth();
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
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('User is not confirmed')) {
        toast.warning('Please verify your email first.');
        router.push(`/verify?email=${encodeURIComponent(data.email)}`);
      } else if (msg.includes('Incorrect username or password')) {
        toast.error('Incorrect email or password.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    /* Stub — wired to Cognito Google IdP when configured */
    toast.info('Google sign-in coming soon!');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      {/* ── Left: Form ── */}
      <div
        className="flex w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex-col px-10 py-12 relative z-10"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
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
            <p className="text-sm font-bold font-display leading-tight" style={{ color: 'var(--primary)' }}>
              Aussie EcoLens
            </p>
            <p className="text-[10px] uppercase tracking-widest leading-tight" style={{ color: 'var(--muted)' }}>
              Wildlife Observatory
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
        <div className="mb-8 page-enter">
          <h1 className="text-4xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            Welcome back
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Sign in to your EcoLens account
          </p>
        </div>

        {/* Google sign-in */}
        <div className="page-enter-1">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-80 active:scale-[0.98]"
            style={{
              background: 'var(--surface)',
              border:     '1.5px solid var(--border)',
              color:      'var(--text)',
              boxShadow:  'var(--shadow-card)',
            }}
          >
            <GoogleLogo />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>or continue with email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 page-enter-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--muted)' }} />
              <input
                type="email"
                autoComplete="email"
                placeholder="researcher@example.com"
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  background:    'var(--input-bg)',
                  border:        errors.email ? '1.5px solid var(--danger)' : '1.5px solid var(--input-border)',
                  color:         'var(--text)',
                }}
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl pl-10 pr-11 py-3 text-sm transition-all focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--input-bg)',
                  border:     errors.password ? '1.5px solid var(--danger)' : '1.5px solid var(--input-border)',
                  color:      'var(--text)',
                }}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                style={{ color: 'var(--muted)' }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs" style={{ color: 'var(--danger)' }}>{errors.password.message}</p>}
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--primary)' }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Sign In button with kangaroo hop */}
          <button
            type="submit"
            disabled={loading}
            className="roo-hop-btn w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            <span className="roo-hop-sprite">🦘</span>
            {loading
              ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Sign In →'
            }
          </button>
        </form>

        <p className="mt-8 text-center text-sm page-enter-3" style={{ color: 'var(--muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }}>
            Create one
          </Link>
        </p>
        </div>
      </div>

      {/* ── Right: Animated wildlife columns ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">

        {/* Gradient fades — left, top, bottom */}
        <div className="absolute left-0 top-0 bottom-0 w-24 z-20 pointer-events-none"
             style={{ background: 'linear-gradient(to right, var(--bg), transparent)' }} />
        <div className="absolute inset-x-0 top-0 h-28 z-20 pointer-events-none"
             style={{ background: 'linear-gradient(to bottom, var(--bg), transparent)' }} />
        <div className="absolute inset-x-0 bottom-0 h-44 z-20 pointer-events-none"
             style={{ background: 'linear-gradient(to top, var(--bg) 20%, transparent)' }} />

        {/* Scrolling photo columns */}
        <div className="absolute inset-0 flex gap-3 px-6 py-4">
          {PHOTO_COLS.map(({ animals, dir, duration, offset }, colIdx) => (
            <div key={colIdx} className="photo-col flex-1 overflow-hidden">
              <div
                className="photo-col-inner flex flex-col gap-3"
                style={{
                  animation: `${dir === 'up' ? 'scroll-up' : 'scroll-down'} ${duration}s linear infinite`,
                  animationDelay: `${offset}s`,
                }}
              >
                {[...animals, ...animals].map((name, i) => (
                  <GridPhoto key={`${name}-${i}`} name={name} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Heading — bottom overlay */}
        <div className="absolute bottom-9 left-10 right-8 z-30 page-enter">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3"
            style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
              AI-Powered Wildlife Detection
            </span>
          </div>
          <h2 className="text-2xl font-bold font-display leading-snug" style={{ color: 'var(--text)' }}>
            Upload a photo and<br />
            <span style={{ color: 'var(--primary)' }}>identify it instantly 🦘</span>
          </h2>
          <p className="mt-2 text-sm max-w-xs" style={{ color: 'var(--muted)' }}>
            MegaDetector + SpeciesNet detects 45+ Australian species across images and videos.
          </p>
        </div>
      </div>
    </div>
  );
}
