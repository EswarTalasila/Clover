import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBudgetSummary,
  createBudget,
  syncPlaidTransactions,
  getPlaidAccounts,
  getSpendingTrend,
} from '../lib/api';
import CategoryDonut from '../components/CategoryDonut';
import MonthlyTrend from '../components/MonthlyTrend';
import Toast from '../components/Toast';

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
      <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
        {label}
      </p>
      <p className={`mt-3 text-[26px] font-semibold tracking-tight tabular-nums ${accent || 'text-zinc-900 dark:text-zinc-50'}`}>
        {value}
      </p>
    </div>
  );
}

function BudgetRow({ item, month, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.monthly_limit ?? '');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

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

  function goToTransactions() {
    if (editing) return;
    navigate(`/transactions?month=${month}&category=${encodeURIComponent(item.category)}`);
  }

  return (
    <div
      onClick={goToTransactions}
      className="px-5 py-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors duration-100 group cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 group-hover:underline underline-offset-4 decoration-zinc-300 dark:decoration-zinc-700">{item.category}</span>
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">
            {limit !== null ? `${fmtCents(spent)} / ${fmtCents(limit)}` : `${fmtCents(spent)} spent`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {limit !== null ? (
            <span
              className={`text-[12px] font-medium tabular-nums ${
                over ? 'text-red-700 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {over ? `${fmtCents(spent - limit)} over` : `${fmtCents(remaining)} left`}
            </span>
          ) : editing ? (
            <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]">$</span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="h-7 pl-5 pr-2 w-24 text-[12px] bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-0 text-zinc-900 dark:text-zinc-100"
                  placeholder="0.00"
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
                onClick={() => setEditing(false)}
                className="h-7 px-2 text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-100"
            >
              + Set budget
            </button>
          )}
        </div>
      </div>
      <div className="h-[3px] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`h-full transition-[width] duration-500 ease-out ${
            limit === null
              ? 'bg-zinc-300 dark:bg-zinc-700'
              : over
              ? 'bg-red-500'
              : pct > 80
              ? 'bg-amber-500'
              : 'bg-zinc-900 dark:bg-zinc-100'
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
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    return Promise.all([
      getBudgetSummary(month).then(setSummary),
      getSpendingTrend(6).then(setTrend),
    ]).catch((err) => setError(err.response?.data?.detail || err.message));
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const accounts = await getPlaidAccounts();
        if (accounts.length > 0 && !cancelled) {
          setSyncing(true);
          try {
            await syncPlaidTransactions();
          } catch (err) {
            if (!cancelled) {
              setToast({
                message:
                  'Background sync failed. Try Sync transactions on the Accounts page.',
                type: 'error',
              });
            }
          }
          if (!cancelled) setSyncing(false);
        }
      } catch {
        /* getPlaidAccounts can fail if user has no accounts yet; load() will still run */
      }
      if (cancelled) return;
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">
          Overview
        </p>
        <div className="mt-1.5 flex items-baseline justify-between gap-4">
          <h1 className="text-[28px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {formattedMonth}
          </h1>
          <div className="flex items-center gap-3">
            {syncing && (
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-zinc-500 dark:bg-zinc-400 animate-pulse" />
                Syncing…
              </span>
            )}
            {totalLimit > 0 && (
              <span className="text-[13px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                {overallPct.toFixed(0)}% of budget used
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Stat label="Budgeted" value={fmt(totalLimit)} />
        <Stat label="Spent" value={fmt(totalSpent)} />
        <Stat
          label="Remaining"
          value={totalLimit > 0 ? fmt(totalRemaining) : '—'}
          accent={totalLimit > 0 && totalRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-50'}
        />
      </div>

      {!loading && summary.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-10">
          <CategoryDonut items={summary} />
          <MonthlyTrend points={trend} />
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">By category</h2>
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
          {summary.length} {summary.length === 1 ? 'category' : 'categories'}
        </span>
      </div>

      {loading && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Loading…</p>}
      {error && (
        <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="panel">
          {summary.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[13px] text-zinc-600 dark:text-zinc-300">No activity this month yet.</p>
              <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
                Connect a bank or add a transaction to see spending here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {summary.map((item) => (
                <BudgetRow key={item.category} item={item} month={month} onSaved={load} />
              ))}
            </div>
          )}
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
    </div>
  );
}
