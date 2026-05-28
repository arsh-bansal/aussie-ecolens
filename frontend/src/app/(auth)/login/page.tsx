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

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

const B = 'https://images.unsplash.com/photo-';
const Q = '?w=360&h=240&fit=crop&auto=format&q=80';

// Picsum fallback IDs (nature/landscape, always load)
const FALLBACKS = [10, 15, 28, 37, 43, 56, 65, 74, 91, 112, 119, 142, 157, 167, 176, 192];

const PHOTOS = [
  `${B}1459262838948-3e2de6c1ec80${Q}`,
  `${B}1529108190281-9a4f620bc2d8${Q}`,
  `${B}1559548331-f9cb98001426${Q}`,
  `${B}1589656966895-2f33e7653819${Q}`,
  `${B}1546519638-68e109498ffc${Q}`,
  `${B}1607462109225-6b64ae2dd3cb${Q}`,
  `${B}1568430462989-44163eb1752f${Q}`,
  `${B}1573408301185-9519f31a8ba5${Q}`,
  `${B}1469474968028-56623f02e42e${Q}`,
  `${B}1560807707-8cc77767d783${Q}`,
  `${B}1484406566174-9da000fda645${Q}`,
  `${B}1604507258811-b027f5c49261${Q}`,
  `${B}1501854140801-50d01698950b${Q}`,
  `${B}1474511320723-9a56873867b5${Q}`,
  `${B}1441260038675-7329ab4cc264${Q}`,
  `${B}1550853024-fae8cd4be47f${Q}`,
];

function GridPhoto({ src, fallbackId }: { src: string; fallbackId: number }) {
  const [imgSrc, setImgSrc] = useState(src);
  return (
    <div className="relative overflow-hidden rounded-xl bg-dark-200 group" style={{ aspectRatio: '3/2' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc}
        alt=""
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
        onError={() => setImgSrc(`https://picsum.photos/id/${fallbackId}/360/240`)}
      />
      <div className="absolute inset-0 bg-forest-900/20 mix-blend-multiply pointer-events-none" />
    </div>
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

  return (
    <div className="min-h-screen flex bg-dark-400">

      {/* ── Left: Form ── */}
      <div className="flex w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 flex-col justify-center px-10 py-12 z-10">

        <div className="flex items-center gap-2.5 mb-12">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-500/15 border border-forest-500/25">
            <Leaf className="h-4 w-4 text-forest-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-forest-300 leading-tight">Aussie EcoLens</p>
            <p className="text-[10px] text-gray-700 leading-tight">Wildlife Observatory</p>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-50 mb-2">Welcome back</h1>
          <p className="text-sm text-gray-500">Sign in to your EcoLens account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
              <input
                type="email"
                autoComplete="email"
                placeholder="researcher@example.com"
                className="w-full bg-dark-200 border border-dark-50 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-100 placeholder:text-gray-700 focus:outline-none focus:border-forest-500/50 focus:ring-1 focus:ring-forest-500/20 transition-all"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-dark-200 border border-dark-50 rounded-xl pl-10 pr-11 py-3 text-sm text-gray-100 placeholder:text-gray-700 focus:outline-none focus:border-forest-500/50 focus:ring-1 focus:ring-forest-500/20 transition-all"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-forest-400/70 hover:text-forest-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-forest-500 hover:bg-forest-400 active:bg-forest-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-3 text-sm transition-all duration-200 shadow-glow-sm hover:shadow-glow"
          >
            {loading
              ? <span className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              : 'Sign In →'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-forest-400 hover:text-forest-300 font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>

      {/* ── Right: Static 4×4 photo grid ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center overflow-hidden relative px-8 py-10">

        {/* Fade left into form */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-dark-400 to-transparent z-10 pointer-events-none" />

        {/* Heading */}
        <div className="mb-5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forest-500/12 border border-forest-500/20 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-forest-400 animate-pulse" />
            <span className="text-xs text-forest-400 font-medium">AI-Powered Wildlife Detection</span>
          </div>
          <h2 className="text-2xl font-bold text-white leading-snug">
            Upload a photo and<br />
            <span className="text-forest-400">identify it instantly ✦</span>
          </h2>
          <p className="mt-1.5 text-xs text-gray-500 max-w-xs">
            MegaDetector + SpeciesNet detects 45+ Australian species across images and videos.
          </p>
        </div>

        {/* 4×4 static grid */}
        <div className="relative z-10 grid grid-cols-4 gap-2.5">
          {PHOTOS.map((src, i) => (
            <GridPhoto key={i} src={src} fallbackId={FALLBACKS[i]} />
          ))}
        </div>
      </div>

    </div>
  );
}
