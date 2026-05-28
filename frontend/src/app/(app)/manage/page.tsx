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

export default function ManagePage() {
  const toast = useToast();

  // Search results loaded into this page
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedFiles, setLoadedFiles] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Tag editor modal
  const [tagModal, setTagModal] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [tagOperation, setTagOperation] = useState<0 | 1>(1);
  const [tagLoading, setTagLoading] = useState(false);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState(false);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === loadedFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(loadedFiles.map((f) => f.file_id)));
    }
  };

  const selectedUrls = loadedFiles
    .filter((f) => selected.has(f.file_id))
    .map((f) => f.url);

  const addTag = (t: string) => {
    const cleaned = t.trim().toLowerCase().replace(/\s+/g, '_');
    if (cleaned && !tagList.includes(cleaned)) setTagList((prev) => [...prev, cleaned]);
    setTagInput('');
  };

  const handleTagSubmit = async () => {
    if (!tagList.length) { toast.error('Add at least one tag.'); return; }
    if (!selectedUrls.length) { toast.error('Select at least one file.'); return; }
    setTagLoading(true);
    try {
      const res = await api.modifyTags({ urls: selectedUrls, tags: tagList, operation: tagOperation });
      toast.success(`Updated ${res.updated} file${res.updated !== 1 ? 's' : ''}.`);
      if (res.failed.length) toast.warning(`${res.failed.length} failed.`);
      setTagModal(false);
      setTagList([]);
      setTagInput('');
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
      setLoadedFiles((prev) => prev.filter((f) => !selected.has(f.file_id)));
      setSelected(new Set());
      setDeleteModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredSpeciesSuggestions = AUSTRALIAN_SPECIES.filter((s) =>
    s.includes(tagInput.toLowerCase().replace(/\s/g, '_')) && !tagList.includes(s)
  ).slice(0, 6);

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50">Manage Files</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search for files by species, then select them to edit tags or delete.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
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
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
            >
              {selected.size === loadedFiles.length ? 'Deselect all' : 'Select all'}
            </button>
            {selected.size > 0 && (
              <span className="text-xs text-forest-400">
                {selected.size} selected
              </span>
            )}
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Tag className="h-3.5 w-3.5" />}
                onClick={() => setTagModal(true)}
              >
                Edit Tags
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setDeleteModal(true)}
              >
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
            const isSelected = selected.has(file.file_id);
            return (
              <div
                key={file.file_id}
                onClick={() => toggleSelect(file.file_id)}
                className={cn(
                  'group relative rounded-xl border overflow-hidden cursor-pointer transition-all duration-200',
                  isSelected
                    ? 'border-forest-400 ring-2 ring-forest-400/30'
                    : 'border-dark-50 hover:border-forest-500/30'
                )}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    'absolute top-2 left-2 z-10 h-5 w-5 rounded-md border flex items-center justify-center transition-all',
                    isSelected
                      ? 'bg-forest-500 border-forest-500'
                      : 'bg-dark-300/80 border-dark-50 group-hover:border-forest-500/40'
                  )}
                >
                  {isSelected && (
                    <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-black">
                      <path d="M1 4l3 3 5-6" stroke="black" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Thumbnail */}
                {file.file_type === 'image' && file.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.thumbnail_url}
                    alt="thumbnail"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="aspect-square bg-dark-200 flex items-center justify-center">
                    {file.file_type === 'video' ? (
                      <FileVideo className="h-8 w-8 text-gray-700" />
                    ) : (
                      <FileImage className="h-8 w-8 text-gray-700" />
                    )}
                  </div>
                )}

                {/* Info footer */}
                <div className="p-2 bg-dark-200">
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
                    className="text-[10px] text-gray-600 hover:text-forest-400 flex items-center gap-0.5"
                  >
                    View <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !searching && (
          <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dark-50 bg-dark-200/30">
            <Tag className="h-10 w-10 text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">Search for a species to load files.</p>
            <p className="text-xs text-gray-700 mt-1">You can then select files to edit tags or delete.</p>
          </div>
        )
      )}

      {/* ── Tag Editor Modal ── */}
      <Modal
        open={tagModal}
        onClose={() => setTagModal(false)}
        title="Edit Tags"
        description={`Apply to ${selected.size} selected file${selected.size !== 1 ? 's' : ''}`}
      >
        <div className="space-y-4">
          {/* Operation toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setTagOperation(1)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                tagOperation === 1
                  ? 'bg-forest-500/15 border-forest-500/30 text-forest-300'
                  : 'border-dark-50 text-gray-500 hover:text-gray-300'
              )}
            >
              <Plus className="h-3.5 w-3.5 inline mr-1" />
              Add tags
            </button>
            <button
              onClick={() => setTagOperation(0)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                tagOperation === 0
                  ? 'bg-red-500/15 border-red-500/30 text-red-300'
                  : 'border-dark-50 text-gray-500 hover:text-gray-300'
              )}
            >
              <X className="h-3.5 w-3.5 inline mr-1" />
              Remove tags
            </button>
          </div>

          {/* Tag input */}
          <div className="relative">
            <Input
              label="Tag name"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
              placeholder="Type species or press Enter"
            />
            {tagInput && filteredSpeciesSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-dark-50 bg-dark-200 shadow-xl overflow-hidden">
                {filteredSpeciesSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-forest-500/10 hover:text-forest-300 transition-colors"
                  >
                    {slugToLabel(s)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tag chips */}
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagList.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagList((prev) => prev.filter((x) => x !== t))}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-500/15 border border-forest-500/25 text-forest-300 text-xs hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                  {slugToLabel(t)}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTagModal(false)} className="flex-1">
              Cancel
            </Button>
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

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Files"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-red-500/5 border border-red-500/20 p-4">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">This action cannot be undone</p>
              <p className="text-xs text-red-400/70 mt-1">
                {selected.size} file{selected.size !== 1 ? 's' : ''} will be permanently deleted from
                S3 storage and removed from the database.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDeleteModal(false)} className="flex-1">
              Cancel
            </Button>
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
  );
}
