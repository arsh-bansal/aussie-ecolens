'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    warning: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<ToastType, { bg: string; border: string; text: string; Icon: React.ElementType }> = {
  success: {
    bg: 'bg-forest-950/95',
    border: 'border-forest-500/40',
    text: 'text-forest-300',
    Icon: CheckCircle2,
  },
  error: {
    bg: 'bg-red-950/95',
    border: 'border-red-500/40',
    text: 'text-red-300',
    Icon: XCircle,
  },
  warning: {
    bg: 'bg-amber-950/95',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-dark-100/95',
    border: 'border-dark-50',
    text: 'text-gray-200',
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
    warning: (msg: string) => push('warning', msg),
    info: (msg: string) => push('info', msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <p>{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const NOOP = () => {};
const TOAST_FALLBACK = { success: NOOP, error: NOOP, warning: NOOP, info: NOOP };

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx?.toast ?? TOAST_FALLBACK;
}
