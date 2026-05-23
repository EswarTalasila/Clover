import { useState, useEffect, useCallback } from 'react';
import { getBudgets, createBudget, deleteBudget } from '../lib/api';

const CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Transportation',
  'Entertainment',
  'Bills & Utilities',
  'Health',
  'Travel',
  'Other',
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));
}

function BudgetRow({ budget, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(budget.monthly_limit));
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e?.preventDefault();
    const limit = parseFloat(value);
    if (isNaN(limit) || limit < 0) return;
    if (limit === Number(budget.monthly_limit)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await createBudget({
        category: budget.category,
        monthly_limit: limit,
        month: budget.month,
      });
      onSaved(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the ${budget.category} budget for this month?`)) return;
    await deleteBudget(budget.id);
    onDeleted(budget.id);
  }

  return (
    <tr className="group hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors duration-100">
      <td className="text-zinc-900 dark:text-zinc-100 font-medium">{budget.category}</td>
      <td className="text-right">
        {editing ? (
          <form onSubmit={handleSave} className="flex items-center justify-end gap-1.5">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]">$</span>
              <input
                autoFocus
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
                className="h-7 pl-5 pr-2 w-28 text-[13px] text-right tabular-nums bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-0 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-7 px-2 text-[12px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-800 dark:hover:bg-white"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue(String(budget.monthly_limit));
              }}
              className="h-7 px-2 text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-zinc-900 dark:text-zinc-100 font-semibold tabular-nums hover:underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-700"
          >
            {fmt(budget.monthly_limit)}
          </button>
        )}
      </td>
      <td className="text-right w-[130px]">
        {!editing && (
          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
            <button
              onClick={() => setEditing(true)}
              className="text-[12px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-100"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="text-[12px] text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-100"
            >
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    getBudgets(month).then(setBudgets).catch(() => setBudgets([]));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await createBudget({
        category,
        monthly_limit: parseFloat(limit),
        month,
      });
      setBudgets((prev) => {
        const existing = prev.findIndex((b) => b.category === updated.category);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = updated;
          return next;
        }
        return [...prev, updated];
      });
      setLimit('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  }

  function handleRowSaved(updated) {
    setBudgets((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  function handleRowDeleted(id) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  const total = budgets.reduce((acc, b) => acc + Number(b.monthly_limit), 0);

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800 flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">
            Planning
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Budgets
          </h1>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input w-auto"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="panel p-5">
            <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Add or update a budget
            </h2>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5 mb-5">
              You can also edit or delete existing budgets in the table.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Monthly limit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    className="input pl-6"
                    placeholder="0.00"
                  />
                </div>
              </div>
              {error && (
                <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
                  {error}
                </div>
              )}
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : 'Save budget'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="panel">
            <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Current budgets
              </h2>
              {budgets.length > 0 && (
                <span className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  Total {fmt(total)}
                </span>
              )}
            </div>
            {budgets.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-[13px] text-zinc-600 dark:text-zinc-300">No budgets set yet.</p>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Add one to start tracking your spending.
                </p>
              </div>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-right">Monthly limit</th>
                    <th className="w-[130px]" />
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => (
                    <BudgetRow
                      key={b.id}
                      budget={b}
                      onSaved={handleRowSaved}
                      onDeleted={handleRowDeleted}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
