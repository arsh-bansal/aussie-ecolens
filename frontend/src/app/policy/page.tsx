'use client';

import Link from 'next/link';

const SECTIONS = [
  {
    title: 'What data we collect',
    content: [
      'Account information: your name, email address, and password (stored as a salted hash — never in plain text).',
      'Wildlife media: images and videos you upload, along with file metadata (size, capture timestamp, SHA-256 fingerprint).',
      'Detection records: AI-generated species classifications, confidence scores, bounding-box coordinates, and thumbnail crops produced by MegaDetector and SpeciesNet.',
      'Station identifiers: camera-trap location labels you attach to uploads (e.g. "CT-114 · Daintree NP"). We do not collect GPS coordinates unless you explicitly provide them.',
      'Usage logs: page visits and API calls, retained for 30 days for debugging. No advertising or cross-site tracking.',
    ],
  },
  {
    title: 'How we use your data',
    content: [
      'To run the AI inference pipeline (MegaDetector → SpeciesNet) on your uploads and return classification results.',
      'To store and replicate detection records between AWS (DynamoDB, S3) and Azure (Cosmos DB) so the platform remains resilient.',
      'To send SNS email alerts you have explicitly subscribed to — never unsolicited marketing.',
      'To prevent duplicate uploads via SHA-256 hashing. The hash is compared against a fingerprint index; raw file content is not re-read after the initial inference run.',
      'To improve model accuracy through aggregate, de-identified detection statistics. Individual records are never shared with third parties for this purpose.',
    ],
  },
  {
    title: 'Data ethics & wildlife safety',
    content: [
      'Precise location data for threatened or vulnerable species (e.g. koalas, cassowaries) is never published publicly. Station identifiers are kept at the regional level.',
      'Detection records flagged as invasive species (e.g. red fox, feral cat) are shared with relevant state wildlife agencies under a data-sharing agreement — you consent to this when uploading.',
      'You retain ownership of all media you upload. Aussie EcoLens holds a limited licence to process and store it for the purposes described in this policy.',
      'We do not sell, rent, or trade your personal data or your wildlife observations to commercial third parties.',
      'AI classifications are probabilistic, not definitive. High-confidence results (≥ 90%) are flagged for researcher review before being used in any conservation reporting.',
    ],
  },
  {
    title: 'Storage & security',
    content: [
      'Media files are stored in AWS S3 with server-side encryption (SSE-S3). Access is restricted to the inference pipeline and your own account.',
      'Detection records are replicated from AWS DynamoDB to Azure Cosmos DB via DynamoDB Streams. Both stores are encrypted at rest.',
      'Authentication is handled by AWS Cognito. Tokens are short-lived (1-hour ID tokens, 30-day refresh tokens with server-side revocation enabled).',
      'All API communication is over HTTPS/TLS 1.2+. There is no unencrypted data path.',
      'In the event of a data breach that affects personal information, we will notify affected users within 72 hours in accordance with the Australian Privacy Act 1988.',
    ],
  },
  {
    title: 'Your rights',
    content: [
      'Access: you can download all detection records associated with your account at any time from the Manage page.',
      'Deletion: you can delete individual records or your entire account. Deletion removes your media from S3 and your records from both DynamoDB and Cosmos DB within 30 days.',
      'Correction: if an AI classification is wrong, you can re-tag it. Corrections are written back to both data stores.',
      'Portability: detection records can be exported as CSV from the Manage page.',
      'Objection: you may opt out of aggregate statistics reporting by contacting us. This does not affect your ability to use the platform.',
    ],
  },
  {
    title: 'Contact',
    content: [
      'For privacy enquiries, data deletion requests, or to report a concern about how your data is being used, email privacy@aussie-ecolens.org.au.',
      'This policy was last updated June 2026. We will notify registered observers by email if material changes are made.',
    ],
  },
];

export default function PolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0608', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--line)', padding: '20px 40px', display: 'flex', alignItems: 'center', gap: '16px', backdropFilter: 'blur(10px)', background: 'oklch(0.088 0.010 42 / 0.9)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'linear-gradient(150deg, var(--ochre) 0%, var(--ochre-deep) 100%)', display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" strokeLinecap="round"/></svg>
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: 'var(--cream)' }}>Aussie EcoLens</span>
        </Link>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>LEGAL · PRIVACY</span>
      </header>

      {/* Hero */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '64px 40px 0' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--ochre)', marginBottom: '16px' }}>
          Data &amp; Ethics Policy
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(36px, 5vw, 58px)', lineHeight: 1.02, color: 'var(--ink)', margin: '0 0 20px' }}>
          How we handle your data and the wildlife you help protect.
        </h1>
        <p style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--ink-soft)', borderLeft: '3px solid var(--ochre)', paddingLeft: '18px', margin: '0 0 56px' }}>
          Aussie EcoLens processes wildlife media to support conservation research. We take both data privacy and ecological responsibility seriously — this policy explains exactly what we collect, why, and how we keep it safe.
        </p>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--line)', marginBottom: '56px' }} />

        {/* Sections */}
        {SECTIONS.map((section, i) => (
          <section key={section.title} style={{ marginBottom: '52px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '20px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-ghost)', minWidth: '24px' }}>0{i + 1}</span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '26px', color: 'var(--ink)', margin: 0 }}>{section.title}</h2>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: '38px' }}>
              {section.content.map((item, j) => (
                <li key={j} style={{ display: 'flex', gap: '12px', fontSize: '15px', lineHeight: 1.65, color: 'var(--ink-soft)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ochre)', flexShrink: 0, marginTop: '9px' }} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--line)', padding: '32px 0 64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--ink-ghost)', fontFamily: 'var(--font-mono)' }}>© 2026 Aussie EcoLens · Last updated June 2026</span>
          <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ochre)', fontFamily: 'var(--font-body)' }}>
            Back to sign up →
          </Link>
        </div>
      </div>
    </div>
  );
}
