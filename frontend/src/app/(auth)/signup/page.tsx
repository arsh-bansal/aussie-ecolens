'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Leaf, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
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

export default function SignupPage() {
  const { register: authRegister } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await authRegister({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
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

  return (
    <div className="min-h-screen flex bg-[#0a0c09]">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden bg-[#0a0c09]">
        <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-forest-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-16 h-64 w-64 rounded-full bg-forest-600/5 blur-3xl" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-500/20 border border-forest-500/30">
            <Leaf className="h-5 w-5 text-forest-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-forest-300">Aussie EcoLens</p>
            <p className="text-xs text-gray-600">Wildlife Observatory</p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-50 leading-snug mb-4">
            Join the<br />
            <span className="text-forest-400">EcoLens</span> community
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed max-w-xs mb-8">
            Contribute to citizen science by uploading and tagging wildlife media.
            Every image helps protect Australia&apos;s unique biodiversity.
          </p>

          {/* Feature checklist */}
          <div className="space-y-3">
            {[
              'Automatic species detection with AI',
              'Multi-cloud storage (AWS + Azure)',
              'Email notifications for new sightings',
              'Search by species, tags, or image',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div className="h-5 w-5 flex-shrink-0 rounded-full bg-forest-500/20 border border-forest-500/30 flex items-center justify-center">
                  <svg viewBox="0 0 12 12" className="h-3 w-3 text-forest-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-xs text-gray-500">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-gray-700">
          FIT5225 · Multi-Cloud Serverless Platform
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-500/20 border border-forest-500/30">
            <Leaf className="h-4 w-4 text-forest-400" />
          </div>
          <p className="text-base font-semibold text-forest-300">Aussie EcoLens</p>
        </div>

        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-50">Create your account</h2>
            <p className="mt-1.5 text-sm text-gray-500">
              Join the wildlife observation network
            </p>
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
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:text-gray-300 transition-colors"
                >
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
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-forest-400 hover:text-forest-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
