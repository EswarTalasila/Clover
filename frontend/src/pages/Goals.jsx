import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  return diff;
}

function GoalCard({ goal, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [progressValue, setProgressValue] = useState(String(goal.current_amount));
  const [saving, setSaving] = useState(false);

  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const complete = current >= target;
  const remaining = Math.max(target - current, 0);
  const days = daysUntil(goal.target_date);

  async function saveProgress(e) {
    e?.preventDefault();
    const newAmount = parseFloat(progressValue);
    if (isNaN(newAmount) || newAmount < 0) return;
    setSaving(true);
    try {
      const updated = await updateGoal(goal.id, { current_amount: newAmount });
      onSaved(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteGoal(goal.id);
    onDeleted(goal.id);
    setConfirmingDelete(false);
  }

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {goal.name}
          </p>
          {goal.note && (
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">{goal.note}</p>
          )}
        </div>
        {complete && (
          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
            Reached
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <p className="text-[20px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {fmt(current)}
          </p>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            of {fmt(target)}
          </p>
        </div>
        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full transition-[width] duration-500 ease-out ${
              complete ? 'bg-emerald-500' : 'bg-zinc-900 dark:bg-zinc-100'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
          <span>{pct.toFixed(0)}%</span>
          {!complete && (
            <span className="tabular-nums">{fmt(remaining)} to go</span>
          )}
        </div>
      </div>

      {goal.target_date && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">
          Target {fmtDate(goal.target_date)}
          {days !== null && (
            <span className="ml-1">
              ({days > 0 ? `${days} days left` : days === 0 ? 'today' : `${-days} days overdue`})
            </span>
          )}
        </p>
      )}

      <div className="flex items-center gap-2">
        {editing ? (
          <form onSubmit={saveProgress} className="flex items-center gap-1.5 flex-1">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]">$</span>
              <input
                autoFocus
                type="number"
                step="0.01"
                min="0"
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                className="h-8 pl-5 pr-2 w-full text-[12px] tabular-nums bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-0 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-8 px-2.5 text-[12px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-800 dark:hover:bg-white"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setProgressValue(String(goal.current_amount));
              }}
              className="h-8 px-2 text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="btn-secondary text-[12px] h-8 px-3">
              Update progress
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-[12px] font-medium text-red-600 dark:text-red-400 hover:opacity-70 ml-auto"
            >
              Delete
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete "${goal.name}"?`}
        description="This goal will be permanently removed."
        confirmText="Delete goal"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

function AddGoalForm({ onAdded, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    target_amount: '',
    current_amount: '',
    target_date: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        target_date: form.target_date || null,
        note: form.note || null,
      };
      const created = await createGoal(payload);
      onAdded(created);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-5 mb-6 fade-in">
      <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-4">
        New goal
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input"
            placeholder="Emergency fund"
          />
        </div>
        <div>
          <label className="label">Target amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">$</span>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.target_amount}
              onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))}
              className="input pl-6"
              placeholder="5000"
            />
          </div>
        </div>
        <div>
          <label className="label">Starting amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.current_amount}
              onChange={(e) => setForm((f) => ({ ...f, current_amount: e.target.value }))}
              className="input pl-6"
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label className="label">Target date (optional)</label>
          <input
            type="date"
            value={form.target_date}
            onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Note (optional)</label>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="input"
            placeholder="Trip to Japan"
          />
        </div>
      </div>
      {error && (
        <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 mt-4">
          {error}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Create goal'}
        </button>
      </div>
    </form>
  );
}

export default function Goals() {
  const [searchParams] = useSearchParams();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(searchParams.get('new') === '1');
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getGoals()
      .then(setGoals)
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // "New goal" from the command palette opens the form.
  useEffect(() => {
    if (searchParams.get('new') === '1') setAdding(true);
  }, [searchParams]);

  function handleAdded(g) {
    setGoals((prev) => [g, ...prev]);
    setAdding(false);
  }

  function handleSaved(updated) {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  function handleDeleted(id) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  const totalTarget = goals.reduce((acc, g) => acc + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((acc, g) => acc + Number(g.current_amount), 0);

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">
            Saving for
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Goals
          </h1>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={adding}
          className="btn-primary self-start sm:self-end"
        >
          + New goal
        </button>
      </div>

      {goals.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="panel p-4">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
              Total saved
            </p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {fmt(totalSaved)}
            </p>
          </div>
          <div className="panel p-4">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
              Total target
            </p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {fmt(totalTarget)}
            </p>
          </div>
        </div>
      )}

      {adding && <AddGoalForm onAdded={handleAdded} onCancel={() => setAdding(false)} />}

      {loading ? (
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : error ? (
        <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </div>
      ) : goals.length === 0 && !adding ? (
        <div className="panel p-16 text-center">
          <p className="text-[13px] text-zinc-600 dark:text-zinc-300">No goals yet.</p>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
            Click "New goal" to set your first savings target.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onSaved={handleSaved} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}
