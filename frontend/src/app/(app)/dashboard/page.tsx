'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import FloatingLeaves from '@/components/FloatingLeaves';

const QUICK_ACTIONS = [
  { label: 'Upload Files',    desc: 'Add images or videos for AI tagging',        href: '/upload',        emoji: '📤', badge: 'AWS' },
  { label: 'Search Media',    desc: 'Find files by species, tags, or image',       href: '/search',        emoji: '🔍', badge: 'Azure' },
  { label: 'Manage Tags',     desc: 'Edit tags and delete wildlife files',          href: '/manage',        emoji: '🏷️', badge: 'AWS' },
  { label: 'Species Alerts',  desc: 'Subscribe to email alerts via AWS SNS',       href: '/notifications', emoji: '🔔', badge: 'SNS' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Upload 📤',  desc: 'Drop an image or video. SHA-256 hash prevents duplicates before upload.' },
  { step: '2', title: 'AI Tags 🤖', desc: 'AWS Lambda runs MegaDetector + SpeciesNet to classify Australian wildlife.' },
  { step: '3', title: 'Query 🔍',   desc: 'Search Azure Cosmos DB by species, tag counts, thumbnail URL, or image content.' },
  { step: '4', title: 'Notify 🔔',  desc: 'Subscribe via AWS SNS to receive email alerts when species are spotted.' },
];

const ARCHITECTURE = [
  {
    cloud: 'AWS',
    color: '#e9c46a',
    emoji: '🟡',
    path: 'Write Path',
    services: 'Cognito (auth) · S3 (storage) · Lambda (ML inference, thumbnails) · DynamoDB (source of truth) · API Gateway · SNS (notifications)',
  },
  {
    cloud: 'Azure',
    color: '#52b3d9',
    emoji: '🔵',
    path: 'Read Path',
    services: 'Function App (query API) · Cosmos DB (read model, synced via DynamoDB Streams) · Blob Storage (ephemeral query uploads)',
  },
];

function getGreeting(name: string) {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return `Good morning! The bush is waking up 🌅`;
  if (h >= 12 && h < 18) return `G'day, ${name}! Perfect arvo for a discovery 🦘`;
  return `Evening, ${name}! The nocturnal crew is out 🦇`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.given_name ?? user?.email.split('@')[0] ?? 'Researcher';
  const greeting  = getGreeting(firstName);

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      <div className="relative z-10 px-6 lg:px-10 py-8 max-w-4xl mx-auto">

        {/* ── Hero greeting ── */}
        <div className="mb-10 page-enter">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
            style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
              Multi-Cloud Wildlife Platform
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold font-display leading-tight mb-3" style={{ color: 'var(--text)' }}>
            {greeting}
          </h1>
          <p className="text-base max-w-xl" style={{ color: 'var(--muted)' }}>
            Upload wildlife media and let the serverless AI pipeline automatically detect
            Australian species across AWS and Azure.
          </p>
        </div>

        {/* ── Wavy divider ── */}
        <div className="wavy-divider mb-8 opacity-30">
          <svg viewBox="0 0 1200 30" preserveAspectRatio="none" fill="var(--border)">
            <path d="M0,15 C200,30 400,0 600,15 C800,30 1000,0 1200,15 L1200,30 L0,30 Z"/>
          </svg>
        </div>

        {/* ── Quick actions ── */}
        <section className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-5 page-enter-1 flex items-center gap-2"
            style={{ color: 'var(--muted)' }}>
            🦘 Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUICK_ACTIONS.map(({ label, desc, href, emoji, badge }, idx) => (
              <Link
                key={href}
                href={href}
                className={`group flex items-start gap-4 rounded-2xl p-5 card-hover transition-all duration-200 page-enter-${idx + 1}`}
                style={{
                  background: 'var(--card)',
                  border:     '1px solid var(--border)',
                  boxShadow:  'var(--shadow-card)',
                }}
              >
                <div
                  className="mt-0.5 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}
                >
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold group-hover:opacity-80 transition-opacity" style={{ color: 'var(--text)' }}>
                      {label}
                    </p>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--accent)', color: '#1a1a0f', opacity: 0.85 }}
                    >
                      {badge}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
                <span className="text-lg opacity-30 group-hover:opacity-70 transition-opacity mt-1">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-widest mb-5 flex items-center gap-2"
            style={{ color: 'var(--muted)' }}>
            🐨 How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {HOW_IT_WORKS.map(({ step, title, desc }, idx) => (
              <div
                key={step}
                className={`flex gap-4 rounded-2xl p-5 page-enter-${idx + 1}`}
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                  style={{ background: 'var(--primary)', color: '#fff' }}
                >
                  {step}
                </div>
                <div>
                  <p className="text-sm font-bold mb-1 font-display" style={{ color: 'var(--text)' }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Wavy divider ── */}
        <div className="wavy-divider mb-8 opacity-30">
          <svg viewBox="0 0 1200 30" preserveAspectRatio="none" fill="var(--border)">
            <path d="M0,15 C200,0 400,30 600,15 C800,0 1000,30 1200,15 L1200,30 L0,30 Z"/>
          </svg>
        </div>

        {/* ── Platform architecture ── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-5 flex items-center gap-2"
            style={{ color: 'var(--muted)' }}>
            🦎 Platform Architecture
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ARCHITECTURE.map(({ cloud, color, emoji, path, services }) => (
              <div
                key={cloud}
                className="rounded-2xl p-5"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${color}` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{emoji}</span>
                  <p className="text-sm font-bold font-display" style={{ color: 'var(--text)' }}>{cloud} — {path}</p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{services}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
