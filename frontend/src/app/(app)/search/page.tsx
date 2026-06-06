'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import type { SearchResult } from '@/types';

type SearchMode = 'species' | 'tags' | 'thumbnail' | 'file';

const SPECIES_OPTIONS = [
  'Agile Antechinus', 'Australian Brushturkey', 'Australian Magpie',
  'Bar-shouldered Dove', 'Black Rat', 'Bush Rat', 'Bush Stone-curlew',
  'Cattle', 'Chowchilla', 'Common Brushtail Possum', 'Common Wombat', 'Dingo',
  'Domestic Cat', 'Domestic Dog', 'Eastern Grey Kangaroo', 'Eastern Yellow Robin',
  'European Hare', 'European Rabbit', 'Fallow Deer', 'Giant White-tailed Rat',
  'Goat', 'Grey Shrikethrush', 'Grey-headed Robin', 'House Mouse', 'Human',
  'Lace Monitor', 'Laughing Kookaburra', 'Long-nosed Bandicoot',
  'Mountain Brushtail Possum', 'Musky Rat-kangaroo', 'Noisy Pitta',
  'Northern Brown Bandicoot', 'Orange-footed Scrubfowl', 'Pacific Emerald Dove',
  'Pied Currawong', 'Rat (genus)', 'Red Fox', 'Red-legged Pademelon',
  'Red-necked Wallaby', 'Short-beaked Echidna', 'Southern Cassowary',
  'Superb Lyrebird', 'Swamp Wallaby', 'White-winged Chough', 'Wild Pig',
];

const MODE_LABELS: Record<SearchMode, string> = {
  species: 'By species',
  tags: 'By tags',
  thumbnail: 'By thumbnail',
  file: 'By image',
};

function ResultCard({
  r,
  onOpen,
  onCopyThumbnail,
}: {
  r: SearchResult;
  onOpen: () => void;
  onCopyThumbnail?: () => void;
}) {
  const topTag = Object.entries(r.tags ?? {}).sort((a, b) => b[1] - a[1])[0];
  const species = topTag?.[0] ?? 'Unknown species';
  const conf = topTag?.[1] ?? 0;

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      title="Click to view full-size"
      style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'transform .16s ease, box-shadow .16s ease' }}
    >
      <div style={{ position: 'relative', height: '158px', overflow: 'hidden', background: 'var(--sand-200)' }}>
        {r.thumbnail_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.thumbnail_url} alt={species} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.4"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-4 4 3 3-3 6 5"/></svg>
            </div>
        }
        <span style={{ position: 'absolute', bottom: '10px', right: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'oklch(0.08 0.02 50 / 0.7)', color: '#fff' }}>
          {conf}×
        </span>
        {r.thumbnail_url && onCopyThumbnail && (
          <button
            type="button"
            title="Copy thumbnail URL for lookup"
            onClick={e => { e.stopPropagation(); onCopyThumbnail(); }}
            style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px', borderRadius: '6px', border: 'none', background: 'oklch(0.08 0.02 50 / 0.75)', color: '#fff', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
          >
            Copy URL
          </button>
        )}
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>{species}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-faint)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.file_id}
        </div>
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {Object.keys(r.tags ?? {}).map(t => (
            <span key={t} className="tag" style={{ fontSize: '10px' }}>{t}</span>
          ))}
          <span className={`badge ${r.file_type === 'video' ? 'badge-sky' : 'badge-mute'}`}>{r.file_type}</span>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [mode, setMode] = useState<SearchMode>('species');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetResults = () => {
    setResults(null);
    setFullImageUrl(null);
    setError(null);
    setCopied(false);
  };

  const switchMode = (m: SearchMode) => {
    setMode(m);
    resetResults();
    setQuery('');
  };

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setFullImageUrl(null);
    setResults(null);
    try {
      const terms = query.split(',').map(s => s.trim()).filter(Boolean);
      if (mode === 'species') {
        const res = await api.searchBySpecies({ species: terms });
        setResults(res.results);
      } else if (mode === 'tags') {
        const tagMap = Object.fromEntries(terms.map(t => [t, 1]));
        const res = await api.searchByTags({ tags: tagMap });
        setResults(res.results);
      } else if (mode === 'thumbnail') {
        const res = await api.searchByThumbnail({ thumbnail_url: query.trim() });
        setFullImageUrl(res.url);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const searchByFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setFullImageUrl(null);
    try {
      const res = await api.searchByFile(file);
      setResults(res.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const copyThumbnailUrl = async (url: string, openThumbnailTab = false) => {
    try {
      await navigator.clipboard.writeText(url);
      if (openThumbnailTab) {
        setMode('thumbnail');
        setQuery(url);
        setResults(null);
        setFullImageUrl(null);
        setError(null);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <div className="page-title">Search detections</div>
          <div className="page-sub">Query the wildlife observatory across AWS &amp; Azure</div>
        </div>
        <Link href="/notifications" className="icon-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round"/></svg>
          <span className="ping" />
        </Link>
      </header>

      <div className="page">
        <div className="panel" style={{ marginBottom: '22px' }}>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="tag-toggle">
              {(['species', 'tags', 'thumbnail', 'file'] as SearchMode[]).map(m => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => switchMode(m)}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            {mode === 'file' ? (
              <div
                style={{
                  border: `2px dashed ${dragOver ? 'var(--ochre)' : 'var(--line)'}`,
                  borderRadius: 'var(--r-lg)',
                  background: dragOver ? 'var(--ochre-tint)' : 'var(--sand-50)',
                  padding: '28px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                }}
                onClick={() => !loading && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f && f.type.startsWith('image/')) searchByFile(f);
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragOver ? 'var(--ochre)' : 'var(--ink-faint)'} strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block' }}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-4 4 3 3-3 6 5"/></svg>
                <p style={{ margin: 0, fontSize: '14.5px', color: dragOver ? 'var(--ochre)' : 'var(--ink-soft)', fontWeight: dragOver ? 700 : 400 }}>
                  {loading ? 'Searching…' : dragOver ? 'Release to search' : 'Drop an image here, or click to browse'}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--ink-faint)' }}>JPG, PNG, WEBP · finds similar detections in the observatory</p>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) searchByFile(e.target.files[0]); }} />
              </div>
            ) : (
              <form onSubmit={search} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="topbar-search" style={{ flex: 1, minWidth: 0, margin: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" strokeLinecap="round"/></svg>
                    <input
                      placeholder={
                        mode === 'species'
                          ? 'e.g. Red Fox, Southern Cassowary'
                          : mode === 'tags'
                          ? 'e.g. Domestic Cat, demoooo'
                          : 'Paste thumbnail URL (https://… or s3://…)'
                      }
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      list={mode === 'species' ? 'species-options' : undefined}
                    />
                    {mode === 'species' && (
                      <datalist id="species-options">
                        {SPECIES_OPTIONS.map(s => <option key={s} value={s} />)}
                      </datalist>
                    )}
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading || !query.trim()}>
                    {loading ? 'Searching…' : mode === 'thumbnail' ? 'Resolve' : 'Search'}
                  </button>
                </div>
                {mode === 'thumbnail' && (
                  <p style={{ fontSize: '12.5px', color: 'var(--ink-faint)', margin: 0 }}>
                    Paste a thumbnail URL from search results (use <strong>Copy URL</strong> on a result card), or an <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>s3://</code> URI. Returns the full-size image.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {copied && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--euc-tint)', color: 'var(--euc-deep)', fontSize: '13px', marginBottom: '16px' }}>
            Thumbnail URL copied{mode === 'thumbnail' ? ' — click Resolve to load the full-size image.' : '.'}
          </div>
        )}

        {error && (
          <div style={{ padding: '14px 18px', borderRadius: 'var(--r-md)', background: 'var(--clay-soft)', color: 'var(--clay)', fontSize: '14px', marginBottom: '20px' }}>{error}</div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--line)', borderTopColor: 'var(--ochre)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {fullImageUrl && !loading && mode === 'thumbnail' && (
          <div className="panel">
            <div className="panel-head">
              <h3>Full-size image</h3>
              <span style={{ fontSize: '12.5px', color: 'var(--euc-deep)' }}>Thumbnail lookup succeeded</span>
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fullImageUrl} alt="Full-size from thumbnail lookup" style={{ width: '100%', maxHeight: '520px', objectFit: 'contain', borderRadius: 'var(--r-md)', background: 'var(--sand-200)' }} />
              <a href={fullImageUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
                Open original in new tab
              </a>
            </div>
          </div>
        )}

        {results && !loading && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{ fontSize: '14px', color: 'var(--ink-soft)' }}>
                <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{results.length}</b> detection{results.length !== 1 ? 's' : ''} found
              </div>
            </div>

            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-faint)', fontSize: '15px' }}>
                No detections found. Try a different search term.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
                {results.map(r => (
                  <ResultCard
                    key={r.file_id}
                    r={r}
                    onOpen={() => setSelected(r)}
                    onCopyThumbnail={r.thumbnail_url ? () => copyThumbnailUrl(r.thumbnail_url!, true) : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!results && !fullImageUrl && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-faint)', fontSize: '15px' }}>
            {mode === 'thumbnail'
              ? 'Paste a thumbnail URL to resolve the full-size image.'
              : 'Enter a species name, tag, or upload an image to search the observatory.'}
          </div>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="xl"
        title={selected ? Object.entries(selected.tags ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Detection' : undefined}
        description={selected?.file_type === 'video' ? 'Full-size video' : 'Full-size image'}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selected.file_type === 'video' ? (
              <video src={selected.url} controls style={{ width: '100%', borderRadius: 'var(--r-md)', background: '#000' }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt="Full-size detection" style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-md)' }} />
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href={selected.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                Open original in new tab
              </a>
              {selected.thumbnail_url && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyThumbnailUrl(selected.thumbnail_url!, true)}>
                  Copy thumbnail URL
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
