'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export default function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-sm animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={cn('relative w-full rounded-2xl shadow-2xl animate-slide-up', sizes[size], className)}
        style={{
          background: 'var(--surface)',
          border:     '1px solid var(--border)',
          boxShadow:  'var(--shadow)',
        }}
      >
        {(title || description) && (
          <div
            className="flex items-start justify-between px-6 pt-5 pb-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              {title && (
                <h3 id="modal-title" className="text-base font-bold font-display" style={{ color: 'var(--text)' }}>
                  {title}
                </h3>
              )}
              {description && <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="ml-4 mt-0.5 flex-shrink-0 rounded-lg p-1.5 transition-opacity hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
