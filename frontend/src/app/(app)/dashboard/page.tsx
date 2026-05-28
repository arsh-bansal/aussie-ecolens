'use client';

import Link from 'next/link';
import { Bell, Search, Tag, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const QUICK_ACTIONS = [
  {
    label: 'Upload Files',
    description: 'Add images or videos for AI tagging',
    href: '/upload',
    icon: Upload,
    color: 'text-forest-400',
    bg: 'bg-forest-500/10 border-forest-500/20 hover:border-forest-500/40',
  },
  {
    label: 'Search Media',
    description: 'Find files by species, tags, or image',
    href: '/search',
    icon: Search,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40',
  },
  {
    label: 'Manage Tags',
    description: 'Edit tags and delete files',
    href: '/manage',
    icon: Tag,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40',
  },
  {
    label: 'Notifications',
    description: 'Subscribe to species alerts',
    href: '/notifications',
    icon: Bell,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Upload',
    desc: 'Drop an image or video. The frontend computes a SHA-256 hash to prevent duplicates.',
  },
  {
    step: '2',
    title: 'AI Tags',
    desc: 'AWS Lambda runs MegaDetector + SpeciesNet to detect and classify Australian wildlife.',
  },
  {
    step: '3',
    title: 'Query',
    desc: 'Search the Azure Cosmos read-model by species, tag counts, thumbnail URL, or image content.',
  },
  {
    step: '4',
    title: 'Notify',
    desc: 'Subscribe via AWS SNS to receive email alerts when new files with your species are uploaded.',
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.given_name ?? user?.email.split('@')[0] ?? 'Researcher';

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl mx-auto">
      {/* Welcome */}
      <div className="mb-8 animate-slide-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest-500/10 border border-forest-500/20 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-400 animate-pulse-slow" />
          <span className="text-xs text-forest-400 font-medium">Multi-Cloud Wildlife Platform</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-50">
          Welcome back,{' '}
          <span className="text-forest-400">{firstName}</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-lg">
          Upload wildlife media and let our serverless AI pipeline automatically detect
          Australian species across AWS and Azure.
        </p>
      </div>

      {/* Quick actions */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_ACTIONS.map(({ label, description, href, icon: Icon, color, bg }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-start gap-4 rounded-xl border p-4 transition-all duration-200 ${bg}`}
            >
              <div className={`mt-0.5 flex-shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                  {label}
                </p>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Architecture callout */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4">
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div
              key={step}
              className="flex gap-4 rounded-xl border border-dark-50 bg-dark-200/50 p-4"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-forest-500/15 text-forest-400 text-xs font-bold border border-forest-500/20">
                {step}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">{title}</p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture info */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4">
          Platform Architecture
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-dark-50 bg-dark-200/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <p className="text-sm font-medium text-gray-300">AWS — Write Path</p>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Cognito (auth) · S3 (storage) · Lambda (ML inference, thumbnails, video frames) ·
              DynamoDB (source of truth) · API Gateway · SNS (notifications)
            </p>
          </div>
          <div className="rounded-xl border border-dark-50 bg-dark-200/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <p className="text-sm font-medium text-gray-300">Azure — Read Path</p>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Function App (query API) · Cosmos DB (read model, replicated via DynamoDB Streams) ·
              Blob Storage (ephemeral query uploads)
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
