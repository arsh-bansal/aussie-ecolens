'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ExternalLink, FileSearch, Hash, Image as ImageIcon,
  Loader2, Plus, Search, Tag, Trash2, Video, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { AUSTRALIAN_SPECIES, ACCEPTED_MIME_TYPES, slugToLabel, cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import type { SearchResult } from '@/types';
import FloatingLeaves from '@/components/FloatingLeaves';

type SearchMode = 'tags' | 'species' | 'file' | 'thumbnail';

const MODES: { id: SearchMode; label: string; emoji: string; desc: string }[] = [
  { id: 'tags',      label: 'By Tags',      emoji: '🏷️', desc: 'Find files where tag counts meet thresholds' },
  { id: 'species',   label: 'By Species',   emoji: '🦘', desc: 'Find files containing specific species' },
  { id: 'file',      label: 'By File',      emoji: '🔎', desc: 'Upload a file to find visually similar content' },
  { id: 'thumbnail', label: 'By Thumbnail', emoji: '#️⃣', desc: 'Resolve a thumbnail URL to full-size media' },
];

interface TagEntry { species: string; minCount: number }

/* Kangaroo shrug for empty results */
function KangarooShrug() {
  return (
    <svg viewBox="0 0 120 140" fill="none" className="w-24 h-28 empty-bounce" style={{ color: 'var(--muted)', opacity: 0.45 }}>
      {/* tail */}
      <path d="M38 108 Q18 122 22 136" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round"/>
      {/* body */}
      <ellipse cx="55" cy="90" rx="22" ry="25" fill="currentColor" opacity="0.4"/>
      {/* back legs */}
      <path d="M44 112 L38 130 L30 136" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M58 114 L60 130 L68 134" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {/* neck */}
      <path d="M62 67 L70 50" stroke="currentColor" strokeWidth="9" fill="none" strokeLinecap="round"/>
      {/* head */}
      <ellipse cx="74" cy="40" rx="13" ry="15" transform="rotate(12,74,40)" fill="currentColor" opacity="0.4"/>
      {/* snout */}
      <ellipse cx="84" cy="36" rx="7.5" ry="4.5" transform="rotate(8,84,36)" fill="currentColor" opacity="0.35"/>
      {/* ears */}
      <ellipse cx="65" cy="25" rx="4" ry="11" transform="rotate(-8,65,25)" fill="currentColor" opacity="0.4"/>
      <ellipse cx="75" cy="23" rx="4" ry="11" transform="rotate(4,75,23)" fill="currentColor" opacity="0.4"/>
      {/* arms raised — shrug */}
      <path d="M50 78 L38 65 L34 55" stroke="currentColor" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M62 76 L72 64 L76 54" stroke="currentColor" strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {/* question marks */}
      <text x="24" y="50" fontSize="12" fill="currentColor" opacity="0.45" fontFamily="serif">?</text>
      <text x="78" y="48" fontSize="12" fill="currentColor" opacity="0.45" fontFamily="serif">?</text>
    </svg>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="group rounded-2xl overflow-hidden transition-all duration-200 card-hover"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {result.file_type === 'image' && result.thumbnail_url && !imgError ? (
        <div className="relative aspect-square overflow-hidden" style={{ background: 'var(--border)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.thumbnail_url}
            alt="Wildlife"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-400"
            onError={() => setImgError(true)}
          />
          <div className="media-overlay absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <ExternalLink className="h-3 w-3" /> Full size
            </a>
          </div>
        </div>
      ) : (
        <div className="aspect-square flex items-center justify-center" style={{ background: 'var(--border)' }}>
          <Video className="h-8 w-8" style={{ color: 'var(--muted)' }} />
        </div>
      )}

      <div className="p-3">
        <div className="flex flex-wrap gap-1 mb-2">
          {Object.entries(result.tags)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([tag, count]) => (
              <Badge key={tag} variant="green" size="xs">
                {slugToLabel(tag)} ×{count}
              </Badge>
            ))}
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="gray" size="xs">
            {result.file_type === 'image'
              ? <><ImageIcon className="h-3 w-3 mr-1 inline" />Image</>
              : <><Video className="h-3 w-3 mr-1 inline" />Video</>}
          </Badge>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] flex items-center gap-0.5 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--primary)' }}
          >
            Open <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const toast = useToast();
  const [mode, setMode]         = useState<SearchMode>('tags');
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<SearchResult[] | null>(null);

  const [tagEntries, setTagEntries]       = useState<TagEntry[]>([{ species: 'koala', minCount: 1 }]);
  const [speciesInput, setSpeciesInput]   = useState('');
  const [selectedSpecies, setSelected]   = useState<string[]>([]);
  const [queryFile, setQueryFile]         = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl]   = useState('');
  const [thumbnailResult, setThumbRes]   = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => setQueryFile(files[0] ?? null),
    accept: ACCEPTED_MIME_TYPES,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const addTagEntry    = () => setTagEntries((p) => [...p, { species: '', minCount: 1 }]);
  const removeTagEntry = (i: number) => setTagEntries((p) => p.filter((_, j) => j !== i));
  const updateTagEntry = (i: number, patch: Partial<TagEntry>) =>
    setTagEntries((p) => p.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const addSpecies = (s: string) => {
    const c = s.trim().toLowerCase().replace(/\s+/g, '_');
    if (c && !selectedSpecies.includes(c)) setSelected((p) => [...p, c]);
    setSpeciesInput('');
  };

  const runSearch = async () => {
    setLoading(true); setResults(null); setThumbRes(null);
    try {
      if (mode === 'tags') {
        const tags: Record<string, number> = {};
        for (const { species, minCount } of tagEntries) {
          if (species.trim()) tags[species.trim().toLowerCase()] = Math.max(1, minCount);
        }
        if (!Object.keys(tags).length) { toast.error('Add at least one tag.'); return; }
        const res = await api.searchByTags({ tags });
        setResults(res.results);
        toast.success(`Found ${res.results.length} result${res.results.length !== 1 ? 's' : ''}`);
      } else if (mode === 'species') {
        if (!selectedSpecies.length) { toast.error('Add at least one species.'); return; }
        const res = await api.searchBySpecies({ species: selectedSpecies });
        setResults(res.results);
        toast.success(`Found ${res.results.length} result${res.results.length !== 1 ? 's' : ''}`);
      } else if (mode === 'file') {
        if (!queryFile) { toast.error('Please select a file first.'); return; }
        const res = await api.searchByFile(queryFile);
        setResults(res.results);
        toast.success(`Found ${res.results.length} result${res.results.length !== 1 ? 's' : ''}`);
      } else if (mode === 'thumbnail') {
        if (!thumbnailUrl.trim()) { toast.error('Enter a thumbnail URL.'); return; }
        const res = await api.searchByThumbnail({ thumbnail_url: thumbnailUrl.trim() });
        setThumbRes(res.url);
        toast.success('Full-size URL retrieved.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredSuggestions = AUSTRALIAN_SPECIES.filter(
    (s) => s.includes(speciesInput.toLowerCase().replace(/\s/g, '_')) && !selectedSpecies.includes(s)
  ).slice(0, 8);

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      <div className="relative z-10 px-6 lg:px-10 py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 page-enter">
          <h1 className="text-4xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            Search Media 🔍
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Query via Azure Cosmos DB — multiple search strategies for wildlife files.
          </p>
        </div>

        {/* Notebook-tab mode selector */}
        <div
          className="mb-6 flex gap-0 rounded-2xl overflow-hidden page-enter-1"
          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
        >
          {MODES.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => { setMode(id); setResults(null); setThumbRes(null); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-all duration-200 whitespace-nowrap"
              style={mode === id
                ? { background: 'var(--primary)', color: '#fff', borderBottom: '2px solid var(--accent)' }
                : { color: 'var(--muted)', borderBottom: '2px solid transparent' }
              }
            >
              <span>{emoji}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <p className="mb-5 text-xs page-enter-2" style={{ color: 'var(--muted)' }}>
          {MODES.find((m) => m.id === mode)?.desc}
        </p>

        {/* ── By Tags ── */}
        {mode === 'tags' && (
          <div className="space-y-3 page-enter-2">
            {tagEntries.map((entry, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  {i === 0 && <label className="text-xs font-semibold mb-1.5 block uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Species</label>}
                  <select
                    value={entry.species}
                    onChange={(e) => updateTagEntry(i, { species: e.target.value })}
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text)' }}
                  >
                    <option value="">— Select species —</option>
                    {AUSTRALIAN_SPECIES.map((s) => (
                      <option key={s} value={s}>{slugToLabel(s)}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  {i === 0 && <label className="text-xs font-semibold mb-1.5 block uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Min.</label>}
                  <Input
                    type="number" min={1} max={99}
                    value={entry.minCount}
                    onChange={(e) => updateTagEntry(i, { minCount: parseInt(e.target.value) || 1 })}
                    placeholder="1"
                  />
                </div>
                <button
                  onClick={() => removeTagEntry(i)}
                  className="mb-0.5 p-2 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--danger)' }}
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addTagEntry}
              className="flex items-center gap-2 text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'var(--primary)' }}
            >
              <Plus className="h-3.5 w-3.5" /> Add tag
            </button>
          </div>
        )}

        {/* ── By Species ── */}
        {mode === 'species' && (
          <div className="space-y-3 page-enter-2">
            <div className="relative">
              <Input
                label="Add species"
                value={speciesInput}
                onChange={(e) => setSpeciesInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecies(speciesInput); } }}
                placeholder="Type to search species…"
                hint="Press Enter to add"
              />
              {speciesInput && filteredSuggestions.length > 0 && (
                <div
                  className="absolute z-10 mt-1 w-full rounded-2xl overflow-hidden shadow-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSpecies(s)}
                      className="w-full px-4 py-2.5 text-left text-sm transition-opacity hover:opacity-70"
                      style={{ color: 'var(--text)' }}
                    >
                      🦘 {slugToLabel(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedSpecies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedSpecies.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelected((p) => p.filter((x) => x !== s))}
                    className="group flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: 'var(--nav-active-bg)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                  >
                    {slugToLabel(s)} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── By File ── */}
        {mode === 'file' && (
          <div className="space-y-3 page-enter-2">
            <div
              {...getRootProps()}
              className={cn(
                'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10 px-6 text-center cursor-pointer transition-all duration-200',
                isDragActive ? 'drop-active' : ''
              )}
              style={{
                background:  isDragActive ? 'rgba(82,183,136,0.06)' : 'var(--card)',
                borderColor: isDragActive ? 'var(--primary)'         : 'var(--border)',
              }}
            >
              <input {...getInputProps()} />
              <FileSearch className="h-8 w-8 mb-3" style={{ color: isDragActive ? 'var(--primary)' : 'var(--muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {queryFile ? queryFile.name : 'Drop a file here or click to browse'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>The file will NOT be stored permanently</p>
            </div>
            {queryFile && (
              <div className="flex items-center gap-2">
                <Badge variant="green" dot>{queryFile.name}</Badge>
                <button onClick={() => setQueryFile(null)} className="hover:opacity-70 transition-opacity" style={{ color: 'var(--muted)' }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── By Thumbnail URL ── */}
        {mode === 'thumbnail' && (
          <div className="space-y-3 page-enter-2">
            <Input
              label="Thumbnail URL"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://…s3.amazonaws.com/…"
              hint="Paste the S3 thumbnail URL to look up the full-size image"
            />
            {thumbnailResult && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Full-size URL:</p>
                <a
                  href={thumbnailResult}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm break-all flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--primary)' }}
                >
                  {thumbnailResult} <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Search button */}
        <div className="mt-6 page-enter-3">
          <Button
            onClick={runSearch}
            loading={loading}
            size="lg"
            leftIcon={loading ? undefined : <Search className="h-4 w-4" />}
          >
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </div>

        {/* Results */}
        {results !== null && mode !== 'thumbnail' && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold font-display" style={{ color: 'var(--text)' }}>
                Results{' '}
                <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>
                  {results.length} file{results.length !== 1 ? 's' : ''} found
                </span>
              </h2>
            </div>

            {results.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16 rounded-3xl"
                style={{ border: '1px dashed var(--border)', background: 'var(--card)' }}
              >
                <KangarooShrug />
                <p className="text-sm font-semibold mt-3 font-display" style={{ color: 'var(--text)' }}>
                  No wildlife found matching your query
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  Try different species or lower the minimum count.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {results.map((r) => <ResultCard key={r.file_id} result={r} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
