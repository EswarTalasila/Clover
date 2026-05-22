import { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { createTransaction, deleteTransaction } from '../lib/api';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(Number(n)));
}

const CATEGORY_DOT = {
  'Food & Dining': 'bg-orange-500',
  Shopping: 'bg-pink-500',
  Transportation: 'bg-blue-500',
  Entertainment: 'bg-accent-500',
  'Bills & Utilities': 'bg-slate-500',
  Health: 'bg-emerald-500',
  Travel: 'bg-sky-500',
  Income: 'bg-green-600',
  Other: 'bg-amber-500',
};

function CategoryTag({ category }) {
  if (!category) return <span className="text-[12px] text-slate-400 dark:text-slate-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 dark:text-slate-300">
      <span className={`w-1.5 h-1.5 ${CATEGORY_DOT[category] || 'bg-slate-400'}`} />
      {category}
    </span>
  );
}

export default function Transactions() {
  const [month, setMonth] = useState(currentMonth());
  const { transactions, loading, error, refetch } = useTransactions(month);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createTransaction({ ...form, amount: parseFloat(form.amount) });
      setForm({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
      setShowForm(false);
      refetch();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    await deleteTransaction(id);
    refetch();
  }

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-800 flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">
            Activity
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
            Transactions
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input w-auto"
          />
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            {showForm ? 'Cancel' : 'New transaction'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="panel p-5 mb-6 fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input
                required
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input"
                placeholder="Coffee at Starbucks"
              />
            </div>
            <div>
              <label className="label">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[13px]">$</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="input pl-6"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          {formError && (
            <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 mt-4">
              {formError}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between">
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Category is auto-assigned by AI based on the description.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && <p className="text-[13px] text-slate-500 dark:text-slate-400">Loading…</p>}
      {error && (
        <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="panel">
          {transactions.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-[13px] text-slate-600 dark:text-slate-300">No transactions for this month.</p>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
                Click "New transaction" to add one manually.
              </p>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-[90px]">Date</th>
                  <th>Description</th>
                  <th className="w-[180px]">Category</th>
                  <th className="text-right w-[120px]">Amount</th>
                  <th className="w-[60px]" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="group hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-100">
                    <td className="text-slate-500 dark:text-slate-400 text-[12px] whitespace-nowrap tabular-nums">
                      {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="text-slate-900 dark:text-slate-100 font-medium truncate max-w-[320px]">
                      {t.description}
                    </td>
                    <td>
                      <CategoryTag category={t.category} />
                    </td>
                    <td
                      className={`text-right font-semibold tabular-nums ${
                        t.amount < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {t.amount < 0 ? '+' : '−'}
                      {fmt(t.amount)}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-[12px] text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 transition-all duration-100"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
