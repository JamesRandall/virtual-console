import { useEffect } from 'react';
import { create } from 'zustand';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faExclamationTriangle, faXmark, faInfoCircle } from '@fortawesome/free-solid-svg-icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Helper functions for easy toast creation
export const toast = {
  success: (message: string, duration?: number) => useToastStore.getState().addToast('success', message, duration),
  error: (message: string, duration?: number) => useToastStore.getState().addToast('error', message, duration ?? 6000),
  warning: (message: string, duration?: number) => useToastStore.getState().addToast('warning', message, duration ?? 5000),
  info: (message: string, duration?: number) => useToastStore.getState().addToast('info', message, duration),
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    if (t.duration && t.duration > 0) {
      const timer = setTimeout(onRemove, t.duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [t.duration, onRemove]);

  const icons = {
    success: faCheck,
    error: faExclamationTriangle,
    warning: faExclamationTriangle,
    info: faInfoCircle,
  };

  const colors = {
    success: 'bg-green-600 border-green-500',
    error: 'bg-red-600 border-red-500',
    warning: 'bg-amber-600 border-amber-500',
    info: 'bg-blue-600 border-blue-500',
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border-l-4
        ${colors[t.type]} text-white
        animate-in slide-in-from-right-full duration-300
      `}
    >
      <FontAwesomeIcon icon={icons[t.type]} className="mt-0.5 flex-shrink-0" />
      <p className="flex-1 text-sm whitespace-pre-wrap">{t.message}</p>
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
