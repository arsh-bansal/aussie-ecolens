'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import type { SearchResult } from '@/types';

type SearchMode = 'species' | 'tags' | 'file';

// Canonical species names recognised by the backend (mirrors the Tagger
// taxonomy via species_catalog). Offered as autocomplete so searches use names
// that can actually match stored tags. The API also resolves common synonyms.
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

function ResultCard({ r, onOpen }: { r: SearchResult; onOpen: () => void }) {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let res;
      const terms = query.split(',').map(s => s.trim()).filter(Boolean);
      if (mode === 'species') {
        res = await api.searchBySpecies({ species: terms });
      } else {
        const tagMap = Object.fromEntries(terms.map(t => [t, 1]));
        res = await api.searchByTags({ tags: tagMap });
      }
      setResults(res.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const searchByFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchByFile(file);
      setResults(res.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
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
        {/* Search bar */}
        <div className="panel" style={{ marginBottom: '22px' }}>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Mode toggle */}
            <div className="tag-toggle">
              {(['species', 'tags', 'file'] as SearchMode[]).map(m => (
                <button key={m} className={mode === m ? 'on' : ''} onClick={() => { setMode(m); setResults(null); setError(null); }}>
                  {m === 'species' ? 'By species' : m === 'tags' ? 'By tags' : 'By image'}
                </button>
              ))}
            </div>

            {mode !== 'file' ? (
              <form onSubmit={search} style={{ display: 'flex', gap: '12px' }}>
                <div className="topbar-search" style={{ flex: 1, minWidth: 0, margin: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" strokeLinecap="round"/></svg>
                  <input
                    placeholder={mode === 'species' ? 'e.g. Red Fox, Southern Cassowary' : 'e.g. Cattle, Dingo'}
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
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </form>
            ) : (
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
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '14px 18px', borderRadius: 'var(--r-md)', background: 'var(--clay-soft)', color: 'var(--clay)', fontSize: '14px', marginBottom: '20px' }}>{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--line)', borderTopColor: 'var(--ochre)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Results */}
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
                {results.map(r => <ResultCard key={r.file_id} r={r} onOpen={() => setSelected(r)} />)}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!results && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-faint)', fontSize: '15px' }}>
            Enter a species name or tag to search the observatory.
          </div>
        )}
      </div>

      {/* Full-size lightbox: clicking a result requests the full-size media
          (rubric 4.3 — thumbnails preview, click for full-size). */}
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
            <a href={selected.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
              Open original in new tab
            </a>
          </div>
        )}
      </Modal>
    </>
  );
}
