import { useState } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { createTransaction, deleteTransaction } from '../lib/api';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const CATEGORY_COLORS = {
  'Food & Dining': 'bg-orange-100 text-orange-700',
  Shopping: 'bg-pink-100 text-pink-700',
  Transportation: 'bg-blue-100 text-blue-700',
  Entertainment: 'bg-purple-100 text-purple-700',
  'Bills & Utilities': 'bg-gray-100 text-gray-700',
  Health: 'bg-green-100 text-green-700',
  Travel: 'bg-sky-100 text-sky-700',
  Income: 'bg-emerald-100 text-emerald-700',
  Other: 'bg-yellow-100 text-yellow-700',
};

function CategoryBadge({ category }) {
  const color = CATEGORY_COLORS[category] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {category || 'Uncategorized'}
    </span>
  );
}

export default function Transactions() {
  const [month, setMonth] = useState(currentMonth());
  const { transactions, loading, error, refetch } = useTransactions(month);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-indigo-600 text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5 flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end gap-2">
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No transactions for this month.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(t.date + 'T00:00:00').toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-gray-800 max-w-xs truncate">{t.description}</td>
                    <td className="px-5 py-3">
                      <CategoryBadge category={t.category} />
                    </td>
                    <td className={`px-5 py-3 text-right font-medium tabular-nums ${t.amount < 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {t.amount < 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
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
