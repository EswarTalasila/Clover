import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  confirmInput = null,
  onConfirm,
  onCancel,
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setInput('');
      setBusy(false);
      setError(null);
      return;
    }
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const canConfirm = !confirmInput || input === confirmInput;
  const buttonClass =
    variant === 'danger'
      ? 'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-[13px] font-medium border border-red-600 dark:border-red-700 bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed'
      : 'btn-primary';

  async function handleConfirm() {
    if (!canConfirm || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm?.();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong');
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[2px] fade-in"
      onClick={() => !busy && onCancel?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xl dark:shadow-black/60 w-full max-w-[420px]"
      >
        <div className="px-6 pt-6 pb-5">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              {description}
            </p>
          )}

          {confirmInput && (
            <div className="mt-4">
              <label className="label">
                Type{' '}
                <span className="font-mono text-zinc-900 dark:text-zinc-100 tracking-wide">
                  {confirmInput}
                </span>{' '}
                to confirm
              </label>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="input"
                disabled={busy}
              />
            </div>
          )}

          {error && (
            <div className="mt-4 text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="btn-secondary">
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
            className={buttonClass}
          >
            {busy ? 'Working…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
