import { useState, useMemo, Fragment } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import {
  createTransaction,
  deleteTransaction,
  recategorizeOther,
  updateTransactionNotes,
  setTransactionExcluded,
} from '../lib/api';
import Toast from '../components/Toast';

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
  Entertainment: 'bg-purple-500',
  'Bills & Utilities': 'bg-zinc-500',
  Health: 'bg-emerald-500',
  Travel: 'bg-sky-500',
  Income: 'bg-green-600',
  Other: 'bg-amber-500',
};

function SortHeader({ label, sortKey, current, dir, onClick, className = '', align = 'left' }) {
  const active = current === sortKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-100 ${
          active ? 'text-zinc-900 dark:text-zinc-100' : ''
        } ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <span className={`text-[9px] leading-none ${active ? 'opacity-100' : 'opacity-30'}`}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '▾'}
        </span>
      </button>
    </th>
  );
}

function CategoryTag({ category }) {
  if (!category) return <span className="text-[12px] text-zinc-400 dark:text-zinc-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-zinc-700 dark:text-zinc-300">
      <span className={`w-1.5 h-1.5 ${CATEGORY_DOT[category] || 'bg-zinc-400'}`} />
      {category}
    </span>
  );
}

function prettyChannel(c) {
  if (!c) return null;
  return c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function prettyDetailed(c) {
  if (!c) return null;
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

function DetailField({ label, value, href, mono }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] text-zinc-900 dark:text-zinc-100 mt-0.5 hover:underline underline-offset-2 inline-flex items-center gap-1"
        >
          {value}
          <span className="text-[10px] text-zinc-400">↗</span>
        </a>
      ) : (
        <p className={`text-[13px] text-zinc-900 dark:text-zinc-100 mt-0.5 ${mono ? 'font-mono tabular-nums' : ''}`}>
          {value}
        </p>
      )}
    </div>
  );
}

function fmtFullCurrency(n, code = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Math.abs(Number(n)));
  } catch {
    return `$${Math.abs(Number(n)).toFixed(2)}`;
  }
}

function fmtLongDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ExpandedRow({ tx, onSaveNotes, onToggleExclude }) {
  const [notes, setNotes] = useState(tx.notes || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (notes === (tx.notes || '')) return;
    setSaving(true);
    try {
      await onSaveNotes(tx.id, notes);
    } finally {
      setSaving(false);
    }
  }

  const location = [tx.location_city, tx.location_region].filter(Boolean).join(', ');
  const isIncome = Number(tx.amount) < 0;
  const currency = tx.iso_currency_code || 'USD';
  const websiteUrl = tx.merchant_website
    ? tx.merchant_website.startsWith('http')
      ? tx.merchant_website
      : `https://${tx.merchant_website}`
    : null;

  return (
    <tr className="bg-zinc-50/60 dark:bg-zinc-900/40">
      <td colSpan={6} className="border-b border-zinc-100 dark:border-zinc-800/60 p-0">
        <div className="px-8 py-5">
          <div className="flex items-start justify-between gap-6 mb-5 pb-5 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 min-w-0">
              {tx.merchant_logo_url ? (
                <img
                  src={tx.merchant_logo_url}
                  alt=""
                  className="w-10 h-10 object-contain bg-white border border-zinc-200 dark:border-zinc-800 flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[14px] font-bold flex-shrink-0">
                  {(tx.merchant_name || tx.description)[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {tx.merchant_name || tx.description}
                </p>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
                  {fmtLongDate(tx.date)}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p
                className={`text-[22px] font-semibold tabular-nums tracking-tight ${
                  isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {isIncome ? '+' : '−'}
                {fmtFullCurrency(tx.amount, currency)}
              </p>
              {currency !== 'USD' && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{currency}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4 mb-5">
            <DetailField
              label="Source"
              value={tx.is_manual ? 'Manual entry' : tx.account_institution || 'Bank'}
            />
            <DetailField
              label="Status"
              value={tx.pending ? 'Pending' : 'Posted'}
            />
            <DetailField label="Category" value={tx.category} />
            <DetailField label="Plaid sub-category" value={prettyDetailed(tx.category_detailed)} />
            <DetailField label="Payment channel" value={prettyChannel(tx.payment_channel)} />
            <DetailField label="Location" value={location} />
            <DetailField
              label="Authorized"
              value={tx.authorized_date ? fmtLongDate(tx.authorized_date) : null}
            />
            <DetailField label="Website" value={tx.merchant_website} href={websiteUrl} />
          </div>

          <div>
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em] mb-1.5">
              Notes
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                placeholder="Add a note for yourself…"
                className="input flex-1"
              />
              {saving && <span className="self-center text-[11px] text-zinc-400">Saving…</span>}
            </div>
          </div>

          {!tx.is_manual && (
            <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                  {tx.excluded ? 'Excluded from budget' : 'Included in budget'}
                </p>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  Excluded transactions don't affect spending totals or charts.
                </p>
              </div>
              <button
                onClick={() => onToggleExclude(tx.id, !tx.excluded)}
                className="btn-secondary"
              >
                {tx.excluded ? 'Include' : 'Exclude'}
              </button>
            </div>
          )}

          <p className="mt-4 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
            ID: {tx.id}
          </p>
        </div>
      </td>
    </tr>
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
  const [recategorizing, setRecategorizing] = useState(false);
  const [recategorizeMsg, setRecategorizeMsg] = useState(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState(null);
  const [toast, setToast] = useState(null);

  async function handleSaveNotes(id, notes) {
    await updateTransactionNotes(id, notes);
    refetch();
  }

  async function handleToggleExclude(id, excluded) {
    await setTransactionExcluded(id, excluded);
    refetch();
  }

  async function handleDelete(id) {
    try {
      await deleteTransaction(id);
      refetch();
    } catch (err) {
      setToast({
        message: err.response?.data?.detail || 'Failed to delete',
        type: 'error',
      });
    }
  }

  const sorted = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      let av, bv;
      if (sortKey === 'date') {
        av = a.date;
        bv = b.date;
      } else if (sortKey === 'amount') {
        av = Number(a.amount);
        bv = Number(b.amount);
      } else if (sortKey === 'description') {
        av = (a.description || '').toLowerCase();
        bv = (b.description || '').toLowerCase();
      } else if (sortKey === 'category') {
        av = (a.category || '').toLowerCase();
        bv = (b.category || '').toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [transactions, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc');
    }
  }

  async function handleRecategorize() {
    setRecategorizing(true);
    setRecategorizeMsg(null);
    try {
      const result = await recategorizeOther();
      setRecategorizeMsg(
        result.total === 0
          ? 'Nothing to recategorize.'
          : `Updated ${result.updated} of ${result.total} "Other" transactions.`
      );
      refetch();
    } catch (err) {
      setRecategorizeMsg(err.response?.data?.detail || 'Failed to recategorize');
    } finally {
      setRecategorizing(false);
    }
  }

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


  return (
    <div>
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">
            Activity
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
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
          <button
            onClick={handleRecategorize}
            disabled={recategorizing}
            className="btn-secondary"
            title="Re-run AI on transactions categorized as Other"
          >
            {recategorizing ? 'Working…' : 'AI recategorize'}
          </button>
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            {showForm ? 'Cancel' : 'New transaction'}
          </button>
        </div>
      </div>

      {recategorizeMsg && (
        <div className="mb-4 text-[13px] text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 px-3 py-2">
          {recategorizeMsg}
        </div>
      )}

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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px]">$</span>
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
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
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

      {loading && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Loading…</p>}
      {error && (
        <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="panel">
          {transactions.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-[13px] text-zinc-600 dark:text-zinc-300">No transactions for this month.</p>
              <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
                Click "New transaction" to add one manually.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="table-base">
              <thead>
                <tr>
                  <SortHeader label="Date" sortKey="date" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-[70px] sm:w-[90px]" />
                  <SortHeader label="Description" sortKey="description" current={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Category" sortKey="category" current={sortKey} dir={sortDir} onClick={toggleSort} className="hidden md:table-cell w-[180px]" />
                  <SortHeader label="Amount" sortKey="amount" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right w-[100px] sm:w-[120px]" align="right" />
                  <th className="hidden md:table-cell w-[60px]" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const isOpen = expanded === t.id;
                  const source = t.is_manual ? 'Manual' : t.account_institution;
                  return (
                    <Fragment key={t.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : t.id)}
                        className={`group cursor-pointer hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors duration-100 ${
                          t.excluded ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="text-zinc-500 dark:text-zinc-400 text-[12px] whitespace-nowrap tabular-nums">
                          {new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="max-w-[340px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block text-[10px] text-zinc-400 dark:text-zinc-500 transition-transform duration-100 ${
                                isOpen ? 'rotate-90' : ''
                              }`}
                            >
                              ▸
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate">
                                  {t.description}
                                </span>
                                {t.pending && (
                                  <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                                    Pending
                                  </span>
                                )}
                                {t.excluded && (
                                  <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                    Excluded
                                  </span>
                                )}
                                {t.notes && (
                                  <span title={t.notes} className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                    ●
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="md:hidden">
                                  <CategoryTag category={t.category} />
                                </span>
                                {source && (
                                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                                    <span className="md:hidden">· </span>
                                    {source}
                                    {t.location_city && ` · ${t.location_city}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <CategoryTag category={t.category} />
                        </td>
                        <td
                          className={`text-right font-semibold tabular-nums ${
                            t.amount < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {t.amount < 0 ? '+' : '−'}
                          {fmt(t.amount)}
                        </td>
                        <td className="hidden md:table-cell text-right" onClick={(e) => e.stopPropagation()}>
                          {t.is_manual ? (
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="text-[12px] text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 transition-all duration-100"
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleExclude(t.id, !t.excluded)}
                              className="text-[12px] text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all duration-100 whitespace-nowrap"
                            >
                              {t.excluded ? 'Include' : 'Exclude'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <ExpandedRow
                          tx={t}
                          onSaveNotes={handleSaveNotes}
                          onToggleExclude={handleToggleExclude}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
    </div>
  );
}
