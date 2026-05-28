'use client';

import { useRef, useState } from 'react';
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

type SearchMode = 'tags' | 'species' | 'file' | 'thumbnail';

const MODES: { id: SearchMode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'tags', label: 'By Tags', icon: Tag, desc: 'Find files where tag counts meet thresholds' },
  { id: 'species', label: 'By Species', icon: Search, desc: 'Find files containing specific species' },
  { id: 'file', label: 'By File', icon: FileSearch, desc: 'Upload a file to find similar content' },
  { id: 'thumbnail', label: 'By Thumbnail', icon: Hash, desc: 'Resolve a thumbnail URL to full-size' },
];

interface TagEntry { species: string; minCount: number }

function ResultCard({ result }: { result: SearchResult }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group rounded-xl border border-dark-50 bg-dark-200/60 overflow-hidden hover:border-forest-500/30 transition-all duration-200 hover:shadow-card-hover">
      {result.file_type === 'image' && result.thumbnail_url && !imgError ? (
        <div className="relative aspect-square bg-dark-300 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.thumbnail_url}
            alt="Wildlife thumbnail"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
          <div className="media-overlay absolute inset-0 bg-black/0 group-hover:bg-black/40 opacity-0 transition-all duration-200 flex items-end justify-center pb-3">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-lg bg-forest-500 text-black text-xs font-semibold flex items-center gap-1.5"
            >
              <ExternalLink className="h-3 w-3" /> Full size
            </a>
          </div>
        </div>
      ) : (
        <div className="aspect-square bg-dark-300 flex items-center justify-center">
          <Video className="h-8 w-8 text-gray-600" />
        </div>
      )}

      <div className="p-3">
        {/* Tags */}
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
            {result.file_type === 'image' ? (
              <><ImageIcon className="h-3 w-3 mr-1 inline" />Image</>
            ) : (
              <><Video className="h-3 w-3 mr-1 inline" />Video</>
            )}
          </Badge>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-forest-400/70 hover:text-forest-300 flex items-center gap-1"
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
  const [mode, setMode] = useState<SearchMode>('tags');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  // Tags mode state
  const [tagEntries, setTagEntries] = useState<TagEntry[]>([{ species: 'koala', minCount: 1 }]);

  // Species mode state
  const [speciesInput, setSpeciesInput] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);

  // File mode state
  const [queryFile, setQueryFile] = useState<File | null>(null);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => setQueryFile(files[0] ?? null),
    accept: ACCEPTED_MIME_TYPES,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  // Thumbnail mode
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailResult, setThumbnailResult] = useState<string | null>(null);

  const addTagEntry = () =>
    setTagEntries((prev) => [...prev, { species: '', minCount: 1 }]);

  const removeTagEntry = (i: number) =>
    setTagEntries((prev) => prev.filter((_, idx) => idx !== i));

  const updateTagEntry = (i: number, patch: Partial<TagEntry>) =>
    setTagEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const addSpecies = (s: string) => {
    const cleaned = s.trim().toLowerCase().replace(/\s+/g, '_');
    if (cleaned && !selectedSpecies.includes(cleaned)) {
      setSelectedSpecies((prev) => [...prev, cleaned]);
    }
    setSpeciesInput('');
  };

  const runSearch = async () => {
    setLoading(true);
    setResults(null);
    setThumbnailResult(null);
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
        setThumbnailResult(res.url);
        toast.success('Full-size URL retrieved.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredSpecies = AUSTRALIAN_SPECIES.filter(
    (s) => s.includes(speciesInput.toLowerCase().replace(/\s/g, '_')) && !selectedSpecies.includes(s)
  ).slice(0, 8);

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50">Search Media</h1>
        <p className="mt-1 text-sm text-gray-500">
          Query via Azure Cosmos DB — find wildlife files using multiple search strategies.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-6 flex gap-1 p-1 rounded-xl bg-dark-200 border border-dark-50 overflow-x-auto">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setResults(null); setThumbnailResult(null); }}
            className={cn(
              'flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
              mode === id
                ? 'bg-forest-500/15 text-forest-300 border border-forest-500/25'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/4'
            )}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Mode description */}
      <p className="mb-5 text-xs text-gray-600">
        {MODES.find((m) => m.id === mode)?.desc}
      </p>

      {/* ── By Tags ── */}
      {mode === 'tags' && (
        <div className="space-y-3">
          {tagEntries.map((entry, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                {i === 0 && <label className="text-xs text-gray-500 mb-1.5 block">Species</label>}
                <select
                  value={entry.species}
                  onChange={(e) => updateTagEntry(i, { species: e.target.value })}
                  className="w-full bg-dark-300 border border-dark-50 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-forest-500/30 focus:border-forest-500/50"
                >
                  <option value="">-- Select species --</option>
                  {AUSTRALIAN_SPECIES.map((s) => (
                    <option key={s} value={s}>{slugToLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                {i === 0 && <label className="text-xs text-gray-500 mb-1.5 block">Min. count</label>}
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={entry.minCount}
                  onChange={(e) => updateTagEntry(i, { minCount: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                />
              </div>
              <button
                onClick={() => removeTagEntry(i)}
                className="mb-0.5 p-2 text-gray-600 hover:text-red-400 transition-colors"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={addTagEntry}
            className="flex items-center gap-2 text-xs text-forest-400/80 hover:text-forest-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add another tag
          </button>
        </div>
      )}

      {/* ── By Species ── */}
      {mode === 'species' && (
        <div className="space-y-3">
          <div className="relative">
            <Input
              label="Add species"
              value={speciesInput}
              onChange={(e) => setSpeciesInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecies(speciesInput); } }}
              placeholder="Type to search species…"
              hint="Press Enter to add"
            />
            {speciesInput && filteredSpecies.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-dark-50 bg-dark-200 shadow-xl overflow-hidden">
                {filteredSpecies.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSpecies(s)}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-forest-500/10 hover:text-forest-300 transition-colors"
                  >
                    {slugToLabel(s)}
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
                  onClick={() => setSelectedSpecies((prev) => prev.filter((x) => x !== s))}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-500/15 border border-forest-500/25 text-forest-300 text-xs hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-all"
                >
                  {slugToLabel(s)}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── By File ── */}
      {mode === 'file' && (
        <div className="space-y-3">
          <div
            {...getRootProps()}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 px-6 text-center cursor-pointer transition-all duration-200',
              isDragActive
                ? 'border-forest-400 bg-forest-500/8'
                : 'border-dark-50 hover:border-forest-500/40 hover:bg-forest-500/4'
            )}
          >
            <input {...getInputProps()} />
            <FileSearch className={cn('h-8 w-8 mb-3', isDragActive ? 'text-forest-400' : 'text-gray-600')} />
            <p className="text-sm text-gray-400">
              {queryFile ? queryFile.name : 'Drop a file here or click to browse'}
            </p>
            <p className="text-xs text-gray-600 mt-1">The file will NOT be stored permanently</p>
          </div>
          {queryFile && (
            <div className="flex items-center gap-2">
              <Badge variant="green" dot>{queryFile.name}</Badge>
              <button onClick={() => setQueryFile(null)} className="text-gray-600 hover:text-red-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── By Thumbnail URL ── */}
      {mode === 'thumbnail' && (
        <div className="space-y-3">
          <Input
            label="Thumbnail URL"
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://aussie-ecolens-thumbnails.s3.amazonaws.com/…"
            hint="Paste the S3 thumbnail URL to look up the full-size image"
          />
          {thumbnailResult && (
            <div className="rounded-xl border border-forest-500/20 bg-forest-500/5 p-4">
              <p className="text-xs text-gray-600 mb-1">Full-size URL:</p>
              <a
                href={thumbnailResult}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-forest-400 hover:text-forest-300 break-all flex items-center gap-1"
              >
                {thumbnailResult}
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Search button */}
      <div className="mt-6">
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
            <h2 className="text-sm font-semibold text-gray-300">
              Results
              <span className="ml-2 text-xs text-gray-600 font-normal">
                {results.length} file{results.length !== 1 ? 's' : ''} found
              </span>
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dark-50 bg-dark-200/30">
              <Search className="h-10 w-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">No files match your query.</p>
              <p className="text-xs text-gray-700 mt-1">Try different species or lower the min count.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {results.map((r) => (
                <ResultCard key={r.file_id} result={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
