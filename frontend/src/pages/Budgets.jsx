import { useState, useEffect } from 'react';
import { getBudgets, createBudget } from '../lib/api';

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

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBudgets(month).then(setBudgets).catch(() => setBudgets([]));
  }, [month]);

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

  const total = budgets.reduce((acc, b) => acc + Number(b.monthly_limit), 0);

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-800 flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">
            Planning
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
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
            <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Set a budget
            </h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 mb-5">
              Save again to update an existing category.
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[13px]">$</span>
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
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                Current budgets
              </h2>
              {budgets.length > 0 && (
                <span className="text-[12px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Total {fmt(total)}
                </span>
              )}
            </div>
            {budgets.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-[13px] text-slate-600 dark:text-slate-300">No budgets set yet.</p>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
                  Add one to start tracking your spending.
                </p>
              </div>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="text-right">Monthly limit</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-100">
                      <td className="text-slate-900 dark:text-slate-100 font-medium">{b.category}</td>
                      <td className="text-right text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
                        {fmt(b.monthly_limit)}
                      </td>
                    </tr>
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
