'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  AlertCircle, CheckCircle2, Copy, FileImage, FileVideo,
  Loader2, Upload, X
} from 'lucide-react';
import { api } from '@/lib/api';
import { computeSHA256, formatFileSize, ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import type { UploadItem, PresignResponse } from '@/types';
import { cn } from '@/lib/utils';

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  if (status === 'hashing' || status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-gray-500" />;
  if (status === 'uploading') return <Loader2 className="h-4 w-4 animate-spin text-forest-400" />;
  if (status === 'complete') return <CheckCircle2 className="h-4 w-4 text-forest-400" />;
  if (status === 'duplicate') return <Copy className="h-4 w-4 text-amber-400" />;
  if (status === 'error') return <AlertCircle className="h-4 w-4 text-red-400" />;
  return null;
}

function StatusLabel({ status }: { status: UploadItem['status'] }) {
  const map: Record<UploadItem['status'], { label: string; variant: 'green' | 'amber' | 'red' | 'gray' }> = {
    idle: { label: 'Queued', variant: 'gray' },
    hashing: { label: 'Hashing…', variant: 'gray' },
    checking: { label: 'Checking…', variant: 'gray' },
    uploading: { label: 'Uploading…', variant: 'green' },
    complete: { label: 'Complete', variant: 'green' },
    duplicate: { label: 'Duplicate', variant: 'amber' },
    error: { label: 'Failed', variant: 'red' },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export default function UploadPage() {
  const toast = useToast();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const processItem = async (item: UploadItem) => {
    const { id, file } = item;
    try {
      // 1. Hash
      updateItem(id, { status: 'hashing' });
      const sha256 = await computeSHA256(file);
      updateItem(id, { sha256 });

      // 2. Check / presign
      updateItem(id, { status: 'checking' });
      const presign: PresignResponse = await api.presign({
        sha256,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });

      if (presign.duplicate) {
        updateItem(id, { status: 'duplicate', result: presign });
        return;
      }

      // 3. Upload to S3
      updateItem(id, { status: 'uploading', result: presign });
      await api.uploadToPresignedUrl(presign.upload_url!, file, (pct) =>
        updateItem(id, { progress: pct })
      );
      updateItem(id, { status: 'complete', progress: 100 });
      toast.success(`${file.name} uploaded successfully`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      updateItem(id, { status: 'error', error: msg });
    }
  };

  const onDrop = useCallback((accepted: File[]) => {
    const newItems: UploadItem[] = accepted.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'idle',
      progress: 0,
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    onDropRejected: (rejected) => {
      rejected.forEach(({ file, errors }) => {
        const msg = errors[0]?.code === 'file-too-large'
          ? `${file.name}: file too large (max 500 MB)`
          : `${file.name}: unsupported file type`;
        toast.error(msg);
      });
    },
    disabled: uploading,
  });

  const startUploads = async () => {
    const pending = items.filter((it) => it.status === 'idle' || it.status === 'error');
    if (!pending.length) { toast.info('No files queued for upload.'); return; }
    setUploading(true);
    await Promise.allSettled(pending.map(processItem));
    setUploading(false);
  };

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const pendingCount = items.filter((it) => it.status === 'idle').length;
  const completeCount = items.filter((it) => it.status === 'complete').length;
  const duplicateCount = items.filter((it) => it.status === 'duplicate').length;

  return (
    <div className="px-6 lg:px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50">Upload Media</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload images or videos. Duplicates are detected automatically via SHA-256.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed',
          'py-14 px-8 text-center cursor-pointer transition-all duration-200',
          isDragActive
            ? 'border-forest-400 bg-forest-500/8 scale-[0.99]'
            : 'border-dark-50 hover:border-forest-500/40 hover:bg-forest-500/4',
          uploading && 'opacity-60 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-500/10 border border-forest-500/20">
          <Upload className={cn('h-6 w-6 transition-colors', isDragActive ? 'text-forest-400' : 'text-forest-500/60')} />
        </div>
        <p className="text-base font-medium text-gray-200">
          {isDragActive ? 'Drop files here' : 'Drop files or click to browse'}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Images (JPG, PNG, GIF, WebP) and Videos (MP4, MOV, AVI, WebM) · Max 500 MB
        </p>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {items.length} file{items.length !== 1 ? 's' : ''} ·{' '}
              {completeCount} complete · {duplicateCount} duplicate · {pendingCount} queued
            </p>
            <button
              onClick={() => setItems([])}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-dark-50 bg-dark-200/60 p-4"
              >
                <div className="flex items-start gap-3">
                  {/* File icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {item.file.type.startsWith('video/') ? (
                      <FileVideo className="h-5 w-5 text-blue-400" />
                    ) : (
                      <FileImage className="h-5 w-5 text-forest-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
                        {item.file.name}
                      </p>
                      <StatusLabel status={item.status} />
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {formatFileSize(item.file.size)}
                      {item.sha256 && (
                        <span className="ml-2 font-mono opacity-60">
                          {item.sha256.slice(0, 12)}…
                        </span>
                      )}
                    </p>

                    {/* Progress bar */}
                    {item.status === 'uploading' && (
                      <div className="mt-2 h-1 w-full rounded-full bg-dark-50 overflow-hidden">
                        <div
                          className="h-full bg-forest-500 rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Duplicate info */}
                    {item.status === 'duplicate' && item.result && (
                      <div className="mt-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                        <p className="text-xs text-amber-400">
                          Already exists.{' '}
                          {item.result.existing_url && (
                            <a
                              href={item.result.existing_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-amber-300"
                            >
                              View file
                            </a>
                          )}
                          {item.result.tags && (
                            <span className="ml-2">
                              Tags: {Object.entries(item.result.tags).map(([k, v]) => `${k}(${v})`).join(', ')}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Error */}
                    {item.status === 'error' && item.error && (
                      <p className="mt-1 text-xs text-red-400">{item.error}</p>
                    )}
                  </div>

                  {/* Right: status icon + remove */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusIcon status={item.status} />
                    {(item.status === 'idle' || item.status === 'error' || item.status === 'complete' || item.status === 'duplicate') && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-700 hover:text-gray-400 transition-colors"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Upload button */}
          <div className="pt-2 flex justify-end">
            <Button
              onClick={startUploads}
              loading={uploading}
              disabled={!pendingCount && !items.some((i) => i.status === 'error')}
              leftIcon={<Upload className="h-4 w-4" />}
              size="lg"
            >
              {uploading ? 'Uploading…' : `Upload ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state hint */}
      {items.length === 0 && (
        <div className="mt-6 rounded-xl border border-dark-50 bg-dark-200/30 p-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Supported formats</p>
          <div className="flex flex-wrap gap-2">
            {['JPG/JPEG', 'PNG', 'GIF', 'WebP', 'MP4', 'MOV', 'AVI', 'WebM'].map((fmt) => (
              <span key={fmt} className="text-xs text-gray-600 bg-dark-100 rounded px-2 py-0.5">
                {fmt}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
