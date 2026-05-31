'use client';

import { useState } from 'react';
import {
  AlertTriangle, ExternalLink, FileImage, FileVideo,
  Plus, Search, Tag, Trash2, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { AUSTRALIAN_SPECIES, slugToLabel, cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import type { SearchResult } from '@/types';
import FloatingLeaves from '@/components/FloatingLeaves';

/* Empty state: kangaroo holding a magnifying glass */
function ManageEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 rounded-3xl"
      style={{ border: '1px dashed var(--border)', background: 'var(--card)' }}
    >
      <svg viewBox="0 0 120 140" fill="none" className="w-24 h-28 empty-bounce mb-3" style={{ color: 'var(--muted)', opacity: 0.45 }}>
        <path d="M38 108 Q18 122 22 136" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round"/>
        <ellipse cx="55" cy="90" rx="22" ry="25" fill="currentColor" opacity="0.4"/>
        <path d="M44 112 L38 130 L30 136" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M58 114 L60 130 L68 134" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M62 67 L70 50" stroke="currentColor" strokeWidth="9" fill="none" strokeLinecap="round"/>
        <ellipse cx="74" cy="40" rx="13" ry="15" transform="rotate(12,74,40)" fill="currentColor" opacity="0.4"/>
        <ellipse cx="84" cy="36" rx="7.5" ry="4.5" transform="rotate(8,84,36)" fill="currentColor" opacity="0.35"/>
        <ellipse cx="65" cy="25" rx="4" ry="11" transform="rotate(-8,65,25)" fill="currentColor" opacity="0.4"/>
        <ellipse cx="75" cy="23" rx="4" ry="11" transform="rotate(4,75,23)" fill="currentColor" opacity="0.4"/>
        {/* arm holding magnifier */}
        <path d="M50 78 L36 66" stroke="currentColor" strokeWidth="5.5" fill="none" strokeLinecap="round"/>
        <circle cx="30" cy="60" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.5"/>
        <line x1="36" y1="67" x2="42" y2="73" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
        <path d="M62 76 L72 68" stroke="currentColor" strokeWidth="5.5" fill="none" strokeLinecap="round"/>
      </svg>
      <p className="text-sm font-semibold font-display" style={{ color: 'var(--text)' }}>
        Search for a species to load files
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
        Select files to edit tags or delete them.
      </p>
    </div>
  );
}

export default function ManagePage() {
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [loadedFiles, setLoadedFiles] = useState<SearchResult[]>([]);
  const [searching, setSearching]     = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());

  const [tagModal, setTagModal]         = useState(false);
  const [tagInput, setTagInput]         = useState('');
  const [tagList, setTagList]           = useState<string[]>([]);
  const [tagOperation, setTagOperation] = useState<0 | 1>(1);
  const [tagLoading, setTagLoading]     = useState(false);

  const [deleteModal, setDeleteModal]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadFiles = async () => {
    if (!searchQuery.trim()) { toast.error('Enter a species to load files.'); return; }
    setSearching(true);
    try {
      const species = searchQuery.trim().toLowerCase().replace(/\s+/g, '_');
      const res = await api.searchBySpecies({ species: [species] });
      setLoadedFiles(res.results);
      setSelected(new Set());
      if (!res.results.length) toast.info('No files found for this species.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === loadedFiles.length) setSelected(new Set());
    else setSelected(new Set(loadedFiles.map((f) => f.file_id)));
  };

  const selectedUrls = loadedFiles.filter((f) => selected.has(f.file_id)).map((f) => f.url);

  const addTag = (t: string) => {
    const c = t.trim().toLowerCase().replace(/\s+/g, '_');
    if (c && !tagList.includes(c)) setTagList((p) => [...p, c]);
    setTagInput('');
  };

  const handleTagSubmit = async () => {
    if (!tagList.length)     { toast.error('Add at least one tag.'); return; }
    if (!selectedUrls.length) { toast.error('Select at least one file.'); return; }
    setTagLoading(true);
    try {
      const res = await api.modifyTags({ urls: selectedUrls, tags: tagList, operation: tagOperation });
      toast.success(`Updated ${res.updated} file${res.updated !== 1 ? 's' : ''}.`);
      if (res.failed.length) toast.warning(`${res.failed.length} failed.`);
      setTagModal(false); setTagList([]); setTagInput('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Tag update failed');
    } finally {
      setTagLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUrls.length) return;
    setDeleteLoading(true);
    try {
      const res = await api.deleteFiles({ urls: selectedUrls });
      toast.success(`Deleted ${res.deleted} file${res.deleted !== 1 ? 's' : ''}.`);
      if (res.failed.length) toast.warning(`${res.failed.length} failed.`);
      setLoadedFiles((p) => p.filter((f) => !selected.has(f.file_id)));
      setSelected(new Set()); setDeleteModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredTagSuggestions = AUSTRALIAN_SPECIES.filter(
    (s) => s.includes(tagInput.toLowerCase().replace(/\s/g, '_')) && !tagList.includes(s)
  ).slice(0, 6);

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      <div className="relative z-10 px-6 lg:px-10 py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 page-enter">
          <h1 className="text-4xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            Manage Files 🏷️
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Search for files by species, then select to edit tags or delete.
          </p>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-6 page-enter-1">
          <div className="flex-1">
            <Input
              placeholder="Search by species (e.g. koala)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadFiles(); }}
              leftAddon={<Search className="h-4 w-4" />}
            />
          </div>
          <Button onClick={loadFiles} loading={searching} leftIcon={<Search className="h-4 w-4" />}>
            Load
          </Button>
        </div>

        {/* Bulk action bar */}
        {loadedFiles.length > 0 && (
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3 page-enter-2">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleAll}
                className="text-xs font-semibold hover:opacity-70 transition-opacity"
                style={{ color: 'var(--primary)' }}
              >
                {selected.size === loadedFiles.length ? 'Deselect all' : 'Select all'}
              </button>
              {selected.size > 0 && (
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'var(--nav-active-bg)', color: 'var(--primary)' }}
                >
                  {selected.size} selected
                </span>
              )}
            </div>

            {/* Bulk toolbar — slides up from bottom on mobile, inline on desktop */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" leftIcon={<Tag className="h-3.5 w-3.5" />} onClick={() => setTagModal(true)}>
                  Edit Tags
                </Button>
                <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteModal(true)}>
                  Delete
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Files grid */}
        {loadedFiles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {loadedFiles.map((file) => {
              const isSel = selected.has(file.file_id);
              return (
                <div
                  key={file.file_id}
                  onClick={() => toggleSelect(file.file_id)}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 card-hover"
                  style={{
                    border:     isSel ? '2px solid var(--primary)' : '1px solid var(--border)',
                    boxShadow:  isSel ? '0 0 0 3px rgba(82,183,136,0.2)' : 'none',
                    background: 'var(--card)',
                  }}
                >
                  {/* Checkbox */}
                  <div
                    className="absolute top-2 left-2 z-10 h-5 w-5 rounded-md flex items-center justify-center transition-all"
                    style={{
                      background:  isSel ? 'var(--primary)' : 'rgba(0,0,0,0.3)',
                      border:      isSel ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,0.5)',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {isSel && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  {/* Thumbnail */}
                  {file.file_type === 'image' && file.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.thumbnail_url} alt="thumbnail" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square flex items-center justify-center" style={{ background: 'var(--border)' }}>
                      {file.file_type === 'video'
                        ? <FileVideo className="h-8 w-8" style={{ color: 'var(--muted)' }} />
                        : <FileImage className="h-8 w-8" style={{ color: 'var(--muted)' }} />}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="p-2" style={{ background: 'var(--card)' }}>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {Object.entries(file.tags).slice(0, 2).map(([t, c]) => (
                        <Badge key={t} variant="green" size="xs">{slugToLabel(t)} ×{c}</Badge>
                      ))}
                    </div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] flex items-center gap-0.5 hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--muted)' }}
                    >
                      View <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !searching && <ManageEmptyState />
        )}

        {/* ── Tag Editor Modal ── */}
        <Modal
          open={tagModal}
          onClose={() => setTagModal(false)}
          title="🏷️ Edit Tags"
          description={`Apply to ${selected.size} selected file${selected.size !== 1 ? 's' : ''}`}
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTagOperation(1)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                style={tagOperation === 1
                  ? { background: 'var(--primary)', color: '#fff', border: '1.5px solid var(--primary)' }
                  : { background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--border)' }
                }
              >
                <Plus className="h-3.5 w-3.5 inline mr-1" />Add tags
              </button>
              <button
                onClick={() => setTagOperation(0)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={tagOperation === 0
                  ? { background: 'var(--danger)', color: '#fff', border: '1.5px solid var(--danger)' }
                  : { background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--border)' }
                }
              >
                <X className="h-3.5 w-3.5 inline mr-1" />Remove tags
              </button>
            </div>

            <div className="relative">
              <Input
                label="Tag name"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                placeholder="Type species or press Enter"
              />
              {tagInput && filteredTagSuggestions.length > 0 && (
                <div
                  className="absolute z-10 mt-1 w-full rounded-2xl overflow-hidden shadow-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {filteredTagSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addTag(s)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--text)' }}
                    >
                      🦘 {slugToLabel(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tagList.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTagList((p) => p.filter((x) => x !== t))}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold hover:opacity-75 transition-opacity"
                    style={{ background: 'var(--nav-active-bg)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                  >
                    {slugToLabel(t)} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setTagModal(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleTagSubmit}
                loading={tagLoading}
                variant={tagOperation === 1 ? 'primary' : 'danger'}
                className="flex-1"
              >
                {tagOperation === 1 ? 'Add tags' : 'Remove tags'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Modal ── */}
        <Modal
          open={deleteModal}
          onClose={() => setDeleteModal(false)}
          title="Delete Files"
          size="sm"
        >
          <div className="space-y-4">
            {/* Sad kangaroo */}
            <div className="flex flex-col items-center py-3">
              <svg viewBox="0 0 80 90" fill="none" className="w-16 h-20 mb-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                <path d="M25 72 Q14 80 16 88" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round"/>
                <ellipse cx="38" cy="60" rx="16" ry="18" fill="currentColor" opacity="0.35"/>
                <path d="M30 75 L26 85 L20 89" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M40 77 L42 85 L47 88" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M42 44 L48 32" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/>
                <ellipse cx="52" cy="25" rx="10" ry="12" transform="rotate(10,52,25)" fill="currentColor" opacity="0.38"/>
                <ellipse cx="59" cy="22" rx="6" ry="3.5" transform="rotate(8,59,22)" fill="currentColor" opacity="0.3"/>
                <ellipse cx="44" cy="15" rx="3.5" ry="9" transform="rotate(-8,44,15)" fill="currentColor" opacity="0.38"/>
                <ellipse cx="52" cy="13" rx="3" ry="9" transform="rotate(4,52,13)" fill="currentColor" opacity="0.38"/>
                {/* sad face */}
                <path d="M48 28 Q51 32 54 28" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.55"/>
                <circle cx="47" cy="25" r="1" fill="currentColor" opacity="0.5"/>
                <circle cx="55" cy="24" r="1" fill="currentColor" opacity="0.5"/>
              </svg>
            </div>

            <div
              className="flex items-start gap-3 rounded-2xl p-4"
              style={{ background: 'rgba(193,68,14,0.06)', border: '1px solid rgba(193,68,14,0.25)' }}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>This cannot be undone</p>
                <p className="text-xs mt-1 opacity-75" style={{ color: 'var(--danger)' }}>
                  {selected.size} file{selected.size !== 1 ? 's' : ''} will be permanently deleted from S3 and the database.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDeleteModal(false)} className="flex-1">Cancel</Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                loading={deleteLoading}
                leftIcon={<Trash2 className="h-4 w-4" />}
                className="flex-1"
              >
                Delete {selected.size} file{selected.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
