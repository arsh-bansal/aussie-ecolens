'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { PresignResponse, UploadStatus, FileStatusResponse } from '@/types';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const STEP_LABELS = [
  { key: 'hashing',   name: 'Ingest & SHA-256 hash',  done: 'done',    badge: 'badge-euc' },
  { key: 'checking',  name: 'Duplicate check',         done: 'done',    badge: 'badge-euc' },
  { key: 'uploading', name: 'Upload to S3',            done: 'done',    badge: 'badge-euc' },
  { key: 'complete',  name: 'MegaDetector + SpeciesNet', done: 'tagged', badge: 'badge-euc' },
];

const STATUS_ORDER: UploadStatus[] = ['idle', 'hashing', 'checking', 'uploading', 'complete', 'duplicate', 'error'];

function stepState(stepKey: string, status: UploadStatus, taggingDone = false): 'done' | 'active' | 'idle' {
  const STEPS = ['hashing', 'checking', 'uploading', 'complete'];
  const stepIdx = STEPS.indexOf(stepKey);
  const currentIdx = STATUS_ORDER.indexOf(status);

  if (status === 'complete' || status === 'duplicate') {
    if (stepIdx <= 2) return 'done';
    return taggingDone ? 'done' : 'active';  // tagging step: done once polled as tagged
  }
  if (status === 'error') {
    // Only mark steps before the one that failed as done
    const errorAt = currentIdx - 1; // last status before error
    if (stepIdx < errorAt) return 'done';
    return 'idle';
  }
  if (currentIdx > stepIdx + 1) return 'done';
  if (currentIdx === stepIdx + 1) return 'active';
  return 'idle';
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PresignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sha, setSha] = useState<string>('');
  const [tagged, setTagged] = useState<FileStatusResponse | null>(null);
  const [tagTimedOut, setTagTimedOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setStatus('idle');
    setResult(null);
    setError(null);
    setSha('');
    setTagged(null);
    setTagTimedOut(false);
    setProgress(0);
  }, []);

  // Tagging is async on the backend; poll its status until tagged (or give up).
  const pollTagging = async (fullHash: string) => {
    const deadline = Date.now() + 120_000;  // ML cold start + inference can be slow
    while (Date.now() < deadline) {
      await sleep(3000);
      try {
        const s = await api.getFileStatus(fullHash);
        if (s.status === 'tagged') { setTagged(s); return; }
      } catch { /* transient — keep polling */ }
    }
    setTagTimedOut(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const run = async () => {
    if (!file) return;
    setError(null);
    setResult(null);

    try {
      // 1. Hash
      setStatus('hashing');
      const hash = await hashFile(file);
      setSha(hash.slice(0, 6) + '…' + hash.slice(-4));

      // 2. Presign
      setStatus('checking');
      const presign = await api.presign({
        sha256: hash,
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });

      if (presign.duplicate) {
        setStatus('duplicate');
        setResult(presign);
        return;
      }

      // 3. Upload to S3
      setStatus('uploading');
      await api.uploadToPresignedUrl(presign.upload_url!, file, setProgress);

      // 4. Done uploading — tagging continues async on the backend; poll for it.
      setStatus('complete');
      setResult(presign);
      pollTagging(hash);
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  // Prefer the polled tagging result (new uploads); fall back to dedup tags.
  const detectedTags =
    tagged?.tags && Object.keys(tagged.tags).length > 0
      ? tagged.tags
      : (result?.tags ?? {});
  const topTags = Object.entries(detectedTags).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const taggingDone = status === 'duplicate' || !!tagged;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Upload media</div>
          <div className="page-sub">Images &amp; video · processed by MegaDetector + SpeciesNet</div>
        </div>
        <Link href="/notifications" className="icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round"/></svg>
          <span className="ping" />
        </Link>
      </header>

      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Drop zone */}
            <div
              style={{ border: `1.5px dashed ${file ? 'var(--euc)' : 'var(--line)'}`, borderRadius: 'var(--r-lg)', background: 'var(--paper)', padding: '14px', transition: 'border-color .2s' }}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <div
                style={{ width: '100%', height: '260px', borderRadius: '14px', background: 'var(--sand-200)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '14px', overflow: 'hidden', position: 'relative' }}
                onClick={() => !status || status === 'idle' || status === 'complete' || status === 'error' || status === 'duplicate' ? inputRef.current?.click() : null}
              >
                {file && (file.type.startsWith('image/')) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(file)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.4"><path d="M12 16V7m0 0l-3.5 3.5M12 7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 16v1.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V16"/></svg>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '15px', color: 'var(--ink-soft)', margin: 0 }}>{file ? file.name : 'Drop an image or video here'}</p>
                      <p style={{ fontSize: '13px', color: 'var(--ink-faint)', margin: '6px 0 0' }}>or click to browse · JPG, PNG, MP4, MOV</p>
                    </div>
                  </>
                )}
                <input ref={inputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              {file && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 6px 4px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-soft)', background: 'oklch(0.125 0.010 44)', border: '1px solid var(--line)', padding: '5px 10px', borderRadius: '999px' }}>{file.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-soft)', background: 'oklch(0.125 0.010 44)', border: '1px solid var(--line)', padding: '5px 10px', borderRadius: '999px' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  {status === 'complete' && <span className="badge badge-euc" style={{ marginLeft: 'auto' }}><span className="dot" style={{ background: 'var(--euc)' }} />Uploaded</span>}
                  {status === 'duplicate' && <span className="badge badge-gold" style={{ marginLeft: 'auto' }}>Duplicate</span>}
                  {status === 'error' && <span className="badge badge-clay" style={{ marginLeft: 'auto' }}>Error</span>}
                </div>
              )}
            </div>

            {/* Pipeline steps */}
            {status !== 'idle' && (
              <div className="panel">
                <div className="panel-head">
                  <h3>Inference pipeline</h3>
                  {status === 'uploading' && (
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ochre)' }}>{progress}%</span>
                  )}
                </div>
                <div className="panel-body" style={{ paddingTop: '6px', paddingBottom: '10px' }}>
                  {STEP_LABELS.map((step, i) => {
                    const state = stepState(step.key, status, taggingDone);
                    return (
                      <div key={step.key} style={{ display: 'flex', gap: '15px', padding: '15px 0', position: 'relative' }}>
                        {i < STEP_LABELS.length - 1 && <div style={{ position: 'absolute', left: '18px', top: '44px', bottom: '-6px', width: '2px', background: state === 'done' ? 'var(--euc)' : 'var(--line)' }} />}
                        <div style={{ width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0, display: 'grid', placeItems: 'center', zIndex: 1, background: state === 'done' ? 'var(--euc-tint)' : state === 'active' ? 'var(--ochre-tint)' : 'oklch(0.125 0.010 44)', border: `1px solid ${state === 'done' ? 'var(--euc-soft)' : state === 'active' ? 'var(--ochre-soft)' : 'var(--line)'}`, color: state === 'done' ? 'var(--euc)' : state === 'active' ? 'var(--ochre)' : 'var(--ink-faint)' }}>
                          {state === 'done'
                            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            : state === 'active'
                            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" strokeLinecap="round"/></svg>
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/></svg>
                          }
                        </div>
                        <div style={{ flex: 1, paddingTop: '1px' }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '9px' }}>
                            {step.name}
                            {state === 'done' && <span className={`badge ${step.badge}`}>{step.done}</span>}
                            {state === 'active' && <span className="badge badge-ochre">running…</span>}
                          </div>
                          {step.key === 'hashing' && sha && <div style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>SHA-256: {sha}</div>}
                          {step.key === 'uploading' && status === 'uploading' && (
                            <div style={{ marginTop: '8px', height: '4px', borderRadius: '999px', background: 'var(--sand-200)', overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--euc)', borderRadius: '999px', transition: 'width .2s' }} />
                            </div>
                          )}
                          {step.key === 'complete' && state === 'done' && (
                            <div style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '4px' }}>
                              {Object.keys(detectedTags).length > 0
                                ? `Detected: ${Object.entries(detectedTags).map(([t, c]) => `${t} (${c})`).join(', ')}`
                                : 'No animals detected.'}
                            </div>
                          )}
                          {step.key === 'complete' && state === 'active' && (
                            <div style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '4px' }}>
                              {tagTimedOut
                                ? 'Still processing in the background — check Search shortly.'
                                : 'Running detection… this can take up to a minute (model cold start).'}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {status === 'duplicate' && (
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--gold-soft)', color: 'var(--gold)', fontSize: '13.5px', marginTop: '8px' }}>
                      This file was already uploaded. <Link href="/search" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Find it in Search →</Link>
                    </div>
                  )}
                  {status === 'error' && error && (
                    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--clay-soft)', color: 'var(--clay)', fontSize: '13.5px', marginTop: '8px' }}>{error}</div>
                  )}
                </div>
              </div>
            )}

            {/* Upload button */}
            {file && (status === 'idle' || status === 'error') && (
              <button className="btn btn-primary btn-block btn-lg" onClick={run}>
                Upload &amp; analyse →
              </button>
            )}
            {(status === 'complete' || status === 'duplicate') && (
              <button className="btn btn-ghost btn-block" onClick={() => { setFile(null); setStatus('idle'); setResult(null); setSha(''); setProgress(0); }}>
                Upload another file
              </button>
            )}
          </div>

          {/* Right — result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {result && status === 'complete' ? (
              <div className="panel">
                <div className="panel-head"><h3>Detection record</h3></div>
                <div className="panel-body">
                  {Object.keys(detectedTags).length > 0 ? (
                    <>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{topTags[0]?.[0] ?? 'Species detected'}</div>
                      </div>
                      {[
                        { k: 'File ID', v: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{result.file_id}</span> },
                        { k: 'Top species', v: topTags.map(([tag, count]) => `${tag} (${count})`).join(', ') },
                        { k: 'SHA-256', v: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{sha}</span> },
                        { k: 'Duplicate', v: <span style={{ color: 'var(--euc)' }}>None found</span> },
                      ].map(({ k, v }) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--line-soft)', fontSize: '13.5px' }}>
                          <span style={{ color: 'var(--ink-soft)' }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--ink-soft)', fontSize: '14px' }}>
                      File uploaded — AI pipeline is processing. Check Search in a few moments.
                    </div>
                  )}
                  <Link href="/search" className="btn btn-primary btn-block" style={{ marginTop: '20px', textDecoration: 'none', textAlign: 'center' }}>View in Search →</Link>
                </div>
              </div>
            ) : result && status === 'duplicate' ? (
              <div className="panel">
                <div className="panel-head"><h3>Duplicate detected</h3><span className="badge badge-gold" style={{ marginLeft: 'auto' }}>Already exists</span></div>
                <div className="panel-body">
                  <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.6 }}>This file has already been uploaded. The SHA-256 fingerprint matched an existing record.</p>
                  {[
                    { k: 'File ID', v: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{result.file_id}</span> },
                    { k: 'SHA-256', v: <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{sha}</span> },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--line-soft)', fontSize: '13.5px' }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{k}</span><span style={{ fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                  <Link href="/search" className="btn btn-ghost btn-block" style={{ marginTop: '16px', textDecoration: 'none', textAlign: 'center' }}>Find it in Search →</Link>
                </div>
              </div>
            ) : (
              <div className="panel">
                <div className="panel-head"><h3>Detection record</h3></div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '12px' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.4"><path d="M12 16V7m0 0l-3.5 3.5M12 7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 16v1.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V16"/></svg>
                  <p style={{ color: 'var(--ink-faint)', fontSize: '13.5px', textAlign: 'center', margin: 0 }}>Upload a file to see the detection record here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
