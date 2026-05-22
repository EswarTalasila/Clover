import { useState, useEffect, useCallback } from 'react';
import { getBudgetSummary, createBudget, syncPlaidTransactions, getPlaidAccounts } from '../lib/api';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
}

function fmtCents(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));
}

function Stat({ label, value, accent }) {
  return (
    <div className="panel p-5">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.06em]">
        {label}
      </p>
      <p className={`mt-3 text-[26px] font-semibold tracking-tight tabular-nums ${accent || 'text-slate-900 dark:text-slate-50'}`}>
        {value}
      </p>
    </div>
  );
}

function BudgetRow({ item, month, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.monthly_limit ?? '');
  const [saving, setSaving] = useState(false);

  const limit = item.monthly_limit !== null ? Number(item.monthly_limit) : null;
  const spent = Number(item.spent);
  const remaining = item.remaining !== null ? Number(item.remaining) : null;
  const pct = limit && limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const over = limit !== null && spent > limit;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createBudget({
        category: item.category,
        monthly_limit: parseFloat(value),
        month,
      });
      setEditing(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors duration-100 group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{item.category}</span>
          <span className="text-[12px] text-slate-500 dark:text-slate-400 tabular-nums">
            {limit !== null ? `${fmtCents(spent)} / ${fmtCents(limit)}` : `${fmtCents(spent)} spent`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {limit !== null ? (
            <span
              className={`text-[12px] font-medium tabular-nums ${
                over ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {over ? `${fmtCents(spent - limit)} over` : `${fmtCents(remaining)} left`}
            </span>
          ) : editing ? (
            <form onSubmit={handleSave} className="flex items-center gap-1.5">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">$</span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="h-7 pl-5 pr-2 w-24 text-[12px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-accent-600 dark:focus:border-accent-500 focus:ring-0 text-slate-900 dark:text-slate-100"
                  placeholder="0.00"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="h-7 px-2 text-[12px] font-medium bg-accent-600 text-white border border-accent-600 hover:bg-accent-700"
              >
                {saving ? '…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-7 px-2 text-[12px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-[12px] text-slate-500 dark:text-slate-400 hover:text-accent-600 dark:hover:text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
            >
              + Set budget
            </button>
          )}
        </div>
      </div>
      <div className="h-[3px] bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-[width] duration-500 ease-out ${
            limit === null
              ? 'bg-slate-300 dark:bg-slate-700'
              : over
              ? 'bg-red-500'
              : pct > 80
              ? 'bg-amber-500'
              : 'bg-accent-600'
          }`}
          style={{ width: limit !== null ? `${pct}%` : '100%', opacity: limit === null ? 0.5 : 1 }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const month = currentMonth();
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    return getBudgetSummary(month)
      .then(setSummary)
      .catch((err) => setError(err.response?.data?.detail || err.message));
  }, [month]);

  useEffect(() => {
    (async () => {
      try {
        const accounts = await getPlaidAccounts();
        if (accounts.length > 0) {
          setSyncing(true);
          await syncPlaidTransactions().catch(() => {});
          setSyncing(false);
        }
      } catch {}
      await load();
      setLoading(false);
    })();
  }, [load]);

  const budgeted = summary.filter((s) => s.monthly_limit !== null);
  const totalLimit = budgeted.reduce((acc, s) => acc + Number(s.monthly_limit), 0);
  const totalSpent = summary.reduce((acc, s) => acc + Number(s.spent), 0);
  const totalRemaining = totalLimit - totalSpent;
  const overallPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

  const formattedMonth = new Date(`${month}-01T00:00:00`).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">
          Overview
        </p>
        <div className="mt-1.5 flex items-baseline justify-between gap-4">
          <h1 className="text-[28px] font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
            {formattedMonth}
          </h1>
          <div className="flex items-center gap-3">
            {syncing && (
              <span className="text-[12px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-accent-500 animate-pulse" />
                Syncing…
              </span>
            )}
            {totalLimit > 0 && (
              <span className="text-[13px] text-slate-500 dark:text-slate-400 tabular-nums">
                {overallPct.toFixed(0)}% of budget used
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        <Stat label="Budgeted" value={fmt(totalLimit)} />
        <Stat label="Spent" value={fmt(totalSpent)} />
        <Stat
          label="Remaining"
          value={totalLimit > 0 ? fmt(totalRemaining) : '—'}
          accent={totalLimit > 0 && totalRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-50'}
        />
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">By category</h2>
        <span className="text-[12px] text-slate-500 dark:text-slate-400">
          {summary.length} {summary.length === 1 ? 'category' : 'categories'}
        </span>
      </div>

      {loading && <p className="text-[13px] text-slate-500 dark:text-slate-400">Loading…</p>}
      {error && (
        <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="panel">
          {summary.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[13px] text-slate-600 dark:text-slate-300">No activity this month yet.</p>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
                Connect a bank or add a transaction to see spending here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {summary.map((item) => (
                <BudgetRow key={item.category} item={item} month={month} onSaved={load} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
