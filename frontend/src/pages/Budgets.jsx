import { useState, useEffect, useCallback, useMemo } from 'react';
import { getBudgets, createBudget, deleteBudget } from '../lib/api';
import ConfirmDialog from '../components/ConfirmDialog';

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    await deleteBudget(budget.id);
    onDeleted(budget.id);
    setConfirmingDelete(false);
  }

  return (
    <>
    <ConfirmDialog
      open={confirmingDelete}
      title={`Delete ${budget.category} budget`}
      description="This budget will be removed from the current month. Transactions are not affected."
      confirmText="Delete budget"
      variant="danger"
      onConfirm={handleDelete}
      onCancel={() => setConfirmingDelete(false)}
    />
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
          <div className="flex justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-100">
            <button
              onClick={() => setEditing(true)}
              className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity duration-100"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-[12px] font-medium text-red-600 dark:text-red-400 hover:opacity-70 transition-opacity duration-100"
            >
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
    </>
  );
}

function AddRow({ availableCategories, month, onAdded, onCancel }) {
  const [category, setCategory] = useState(availableCategories[0] || '');
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createBudget({
        category,
        monthly_limit: parseFloat(limit),
        month,
      });
      onAdded(created);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (availableCategories.length === 0) {
    return (
      <tr className="bg-zinc-50/60 dark:bg-zinc-900/40">
        <td colSpan={3} className="px-5 py-4 text-[13px] text-zinc-500 dark:text-zinc-400 text-center">
          All categories already have budgets for this month.{' '}
          <button onClick={onCancel} className="text-zinc-900 dark:text-zinc-100 hover:underline">
            Close
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-zinc-50/60 dark:bg-zinc-900/40">
      <td>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input w-auto h-8 text-[13px]"
        >
          {availableCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </td>
      <td className="text-right">
        <form onSubmit={handleSubmit} className="flex items-center justify-end gap-1.5">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]">$</span>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0"
              required
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onCancel()}
              placeholder="0.00"
              className="h-8 pl-5 pr-2 w-28 text-[13px] text-right tabular-nums bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-0 text-zinc-900 dark:text-zinc-100"
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
            onClick={onCancel}
            className="h-8 px-2 text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
        </form>
      </td>
      <td className="w-[130px]">
        {error && (
          <p className="text-[11px] text-red-700 dark:text-red-300 text-right">{error}</p>
        )}
      </td>
    </tr>
  );
}

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    getBudgets(month).then(setBudgets).catch(() => setBudgets([]));
  }, [month]);

  useEffect(() => {
    load();
    setAdding(false);
  }, [load]);

  const availableCategories = useMemo(() => {
    const taken = new Set(budgets.map((b) => b.category));
    return CATEGORIES.filter((c) => !taken.has(c));
  }, [budgets]);

  function handleAdded(created) {
    setBudgets((prev) => [...prev, created]);
    setAdding(false);
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
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
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

      <div className="panel">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Current budgets
            </h2>
            {budgets.length > 0 && (
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                Total {fmt(total)}
              </span>
            )}
          </div>
          <button
            onClick={() => setAdding(true)}
            disabled={adding || availableCategories.length === 0}
            className="btn-primary h-8 text-[12px]"
          >
            + Budget
          </button>
        </div>

        {budgets.length === 0 && !adding ? (
          <div className="p-16 text-center">
            <p className="text-[13px] text-zinc-600 dark:text-zinc-300">No budgets set yet.</p>
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
              Click "+ Budget" to set your first spending limit.
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
              {adding && (
                <AddRow
                  availableCategories={availableCategories}
                  month={month}
                  onAdded={handleAdded}
                  onCancel={() => setAdding(false)}
                />
              )}
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
  );
}
