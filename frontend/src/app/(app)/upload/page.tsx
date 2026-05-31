'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  AlertCircle, CheckCircle2, Copy, FileImage,
  FileVideo, Loader2, Upload, X
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  computeSHA256, formatFileSize,
  ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, cn
} from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import type { UploadItem, PresignResponse } from '@/types';
import FloatingLeaves from '@/components/FloatingLeaves';

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  if (status === 'hashing' || status === 'checking') return <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--muted)' }} />;
  if (status === 'uploading') return <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--primary)' }} />;
  if (status === 'complete')  return <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />;
  if (status === 'duplicate') return <Copy className="h-4 w-4" style={{ color: 'var(--accent)' }} />;
  if (status === 'error')     return <AlertCircle className="h-4 w-4" style={{ color: 'var(--danger)' }} />;
  return null;
}

const STATUS_LABELS: Record<UploadItem['status'], { label: string; variant: 'green' | 'amber' | 'red' | 'gray' }> = {
  idle:      { label: 'Queued',      variant: 'gray'  },
  hashing:   { label: 'Hashing…',   variant: 'gray'  },
  checking:  { label: 'Checking…',  variant: 'gray'  },
  uploading: { label: 'Uploading…', variant: 'green' },
  complete:  { label: 'Complete',   variant: 'green' },
  duplicate: { label: 'Duplicate',  variant: 'amber' },
  error:     { label: 'Failed',     variant: 'red'   },
};

/* Sleeping koala SVG for empty state */
function SleepingKoala() {
  return (
    <svg viewBox="0 0 120 100" fill="none" className="w-28 h-24 empty-bounce" style={{ color: 'var(--muted)', opacity: 0.5 }}>
      <ellipse cx="60" cy="65" rx="32" ry="24" fill="currentColor" opacity="0.4"/>
      <circle cx="60" cy="36" r="20" fill="currentColor" opacity="0.4"/>
      <ellipse cx="60" cy="40" rx="6.5" ry="4.5" fill="currentColor" opacity="0.7"/>
      <circle cx="44" cy="21" r="10" fill="currentColor" opacity="0.38"/>
      <circle cx="44" cy="21" r="5.5" fill="currentColor" opacity="0.16"/>
      <circle cx="76" cy="21" r="10" fill="currentColor" opacity="0.38"/>
      <circle cx="76" cy="21" r="5.5" fill="currentColor" opacity="0.16"/>
      <path d="M51 34 Q54 31 57 34" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55"/>
      <path d="M63 34 Q66 31 69 34" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.55"/>
      <text x="76" y="22" fontSize="9" fill="currentColor" opacity="0.45" fontFamily="serif">z</text>
      <text x="83" y="15" fontSize="6.5" fill="currentColor" opacity="0.3" fontFamily="serif">z</text>
      <text x="88" y="10" fontSize="5" fill="currentColor" opacity="0.2" fontFamily="serif">z</text>
    </svg>
  );
}

export default function UploadPage() {
  const toast = useToast();
  const [items, setItems]       = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const processItem = async (item: UploadItem) => {
    const { id, file } = item;
    try {
      updateItem(id, { status: 'hashing' });
      const sha256 = await computeSHA256(file);
      updateItem(id, { sha256 });

      updateItem(id, { status: 'checking' });
      const presign: PresignResponse = await api.presign({
        sha256,
        filename:  file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });

      if (presign.duplicate) {
        updateItem(id, { status: 'duplicate', result: presign });
        return;
      }

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
      id:       `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file:     f,
      status:   'idle',
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
          ? `${file.name}: too large (max 500 MB)`
          : `${file.name}: unsupported type`;
        toast.error(msg);
      });
    },
    disabled: uploading,
  });

  const startUploads = async () => {
    const pending = items.filter((it) => it.status === 'idle' || it.status === 'error');
    if (!pending.length) { toast.info('No files queued.'); return; }
    setUploading(true);
    await Promise.allSettled(pending.map(processItem));
    setUploading(false);
  };

  const removeItem    = (id: string)  => setItems((prev) => prev.filter((it) => it.id !== id));
  const pendingCount  = items.filter((it) => it.status === 'idle').length;
  const completeCount = items.filter((it) => it.status === 'complete').length;
  const dupCount      = items.filter((it) => it.status === 'duplicate').length;

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)' }}>
      <FloatingLeaves />

      <div className="relative z-10 px-6 lg:px-10 py-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 page-enter">
          <h1 className="text-4xl font-bold font-display mb-2" style={{ color: 'var(--text)' }}>
            Upload Media 📤
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Images or videos are processed by AWS Lambda — SHA-256 deduplication runs automatically.
          </p>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed',
            'py-16 px-8 text-center cursor-pointer transition-all duration-300 page-enter-1',
            isDragActive ? 'drop-active' : '',
            uploading && 'opacity-50 cursor-not-allowed'
          )}
          style={{
            background:   isDragActive ? 'rgba(82,183,136,0.06)' : 'var(--card)',
            borderColor:  isDragActive ? 'var(--primary)'        : 'var(--border)',
          }}
        >
          <input {...getInputProps()} />

          {items.length === 0 ? (
            /* Sleeping koala empty state */
            <>
              <SleepingKoala />
              <p className="text-base font-semibold mt-3 font-display" style={{ color: 'var(--text)' }}>
                {isDragActive ? 'Drop it and wake me up! 👀' : 'Drop a file and wake me up!'}
              </p>
              <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
                Or click to browse — Images & Videos · Max 500 MB
              </p>
            </>
          ) : (
            <>
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl mb-3"
                style={{ background: 'var(--nav-active-bg)', border: '1px solid var(--border)' }}
              >
                <Upload className="h-6 w-6" style={{ color: isDragActive ? 'var(--primary)' : 'var(--muted)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {isDragActive ? 'Drop to add more' : 'Drop more files or click to browse'}
              </p>
            </>
          )}
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="mt-6 space-y-3 page-enter-2">
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {items.length} file{items.length !== 1 ? 's' : ''} ·{' '}
                <span style={{ color: 'var(--primary)' }}>{completeCount} complete</span>
                {dupCount > 0 && <> · <span style={{ color: 'var(--accent)' }}>{dupCount} duplicate</span></>}
                {pendingCount > 0 && <> · {pendingCount} queued</>}
              </p>
              <button
                onClick={() => setItems([])}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: 'var(--muted)' }}
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item) => {
                const isUploading = item.status === 'uploading';
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl p-4 transition-all duration-200"
                    style={{
                      background: 'var(--card)',
                      border: item.status === 'complete'
                        ? '1px solid rgba(82,183,136,0.4)'
                        : item.status === 'error'
                        ? '1px solid rgba(193,68,14,0.3)'
                        : '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {item.file.type.startsWith('video/')
                          ? <FileVideo className="h-5 w-5" style={{ color: '#52b3d9' }} />
                          : <FileImage className="h-5 w-5" style={{ color: 'var(--primary)' }} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate max-w-[200px]" style={{ color: 'var(--text)' }}>
                            {item.file.name}
                          </p>
                          <Badge variant={STATUS_LABELS[item.status].variant}>
                            {STATUS_LABELS[item.status].label}
                          </Badge>
                        </div>
                        <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>
                          {formatFileSize(item.file.size)}
                          {item.sha256 && (
                            <span className="ml-2 opacity-60">{item.sha256.slice(0, 14)}…</span>
                          )}
                        </p>

                        {/* Bushfire progress bar */}
                        {isUploading && (
                          <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                            <div
                              className="h-full rounded-full bushfire-bar transition-all duration-300"
                              style={{ width: `${item.progress ?? 0}%` }}
                            />
                          </div>
                        )}

                        {/* Duplicate info */}
                        {item.status === 'duplicate' && item.result && (
                          <div
                            className="mt-2 rounded-xl px-3 py-2"
                            style={{ background: 'rgba(233,196,106,0.1)', border: '1px solid rgba(233,196,106,0.3)' }}
                          >
                            <p className="text-xs" style={{ color: 'var(--accent)' }}>
                              ✓ Already catalogued.{' '}
                              {item.result.existing_url && (
                                <a href={item.result.existing_url} target="_blank" rel="noopener noreferrer"
                                  className="underline hover:opacity-70">View file</a>
                              )}
                              {item.result.tags && (
                                <span className="ml-1 opacity-80">
                                  Tags: {Object.entries(item.result.tags).map(([k, v]) => `${k}(${v})`).join(', ')}
                                </span>
                              )}
                            </p>
                          </div>
                        )}

                        {item.status === 'error' && item.error && (
                          <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{item.error}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusIcon status={item.status} />
                        {(['idle', 'error', 'complete', 'duplicate'] as const).includes(item.status as 'idle') && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="hover:opacity-70 transition-opacity"
                            style={{ color: 'var(--muted)' }}
                            aria-label="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

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

        {/* Supported formats */}
        {items.length === 0 && (
          <div
            className="mt-5 rounded-2xl p-4 page-enter-2"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Supported formats</p>
            <div className="flex flex-wrap gap-2">
              {['JPG/JPEG', 'PNG', 'GIF', 'WebP', 'MP4', 'MOV', 'AVI', 'WebM'].map((fmt) => (
                <span
                  key={fmt}
                  className="text-xs px-2.5 py-1 rounded-lg font-mono"
                  style={{ background: 'var(--nav-active-bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
