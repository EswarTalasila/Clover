import { useEffect } from 'react';

export default function Toast({ message, type = 'info', onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onDismiss?.(), duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const styles = {
    info: 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800',
    success:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900',
    error:
      'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-200 dark:border-red-900',
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] fade-in pointer-events-auto">
      <div
        className={`px-4 py-3 rounded-lg text-[13px] font-medium border shadow-lg dark:shadow-black/40 max-w-sm flex items-start gap-3 ${styles[type]}`}
      >
        <span className="flex-1">{message}</span>
        <button
          onClick={onDismiss}
          className="text-[11px] opacity-50 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
