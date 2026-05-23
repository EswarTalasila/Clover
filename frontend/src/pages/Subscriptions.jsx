import { useState, useEffect } from 'react';
import { getRecurring } from '../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(Number(n)));
}

function prettyFrequency(freq) {
  if (!freq) return 'Unknown';
  return freq
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status, isActive }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
        Inactive
      </span>
    );
  }
  if (status === 'EARLY_DETECTION') {
    return (
      <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
        Detecting
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
      Active
    </span>
  );
}

function monthlyEquivalent(avgAmount, frequency) {
  const a = Math.abs(Number(avgAmount));
  switch (frequency) {
    case 'WEEKLY':
      return a * 4.33;
    case 'BIWEEKLY':
      return a * 2.17;
    case 'SEMI_MONTHLY':
      return a * 2;
    case 'MONTHLY':
      return a;
    case 'ANNUALLY':
      return a / 12;
    default:
      return a;
  }
}

export default function Subscriptions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ outflow_streams: [], inflow_streams: [] });

  useEffect(() => {
    getRecurring()
      .then(setData)
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, []);

  const outflow = data.outflow_streams || [];
  const inflow = data.inflow_streams || [];

  const totalMonthly = outflow
    .filter((s) => s.is_active)
    .reduce((acc, s) => acc + monthlyEquivalent(s.average_amount?.amount ?? s.average_amount, s.frequency), 0);

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">
          Recurring
        </p>
        <div className="mt-1.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <h1 className="text-[28px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Subscriptions
          </h1>
          {outflow.length > 0 && (
            <div className="text-right">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
                Estimated monthly
              </p>
              <p className="text-[20px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 tracking-tight">
                {fmt(totalMonthly)}
              </p>
            </div>
          )}
        </div>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
          Detected automatically by Plaid from your transaction history.
        </p>
      </div>

      {loading && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Detecting recurring transactions…</p>}
      {error && (
        <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Outgoing
            </h2>
            <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
              {outflow.length} {outflow.length === 1 ? 'stream' : 'streams'}
            </span>
          </div>

          <div className="panel mb-8">
            {outflow.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
                  No subscriptions detected yet.
                </p>
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
                  Plaid needs a few months of transactions to detect recurring patterns reliably.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto"><table className="table-base">
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th className="hidden sm:table-cell w-[140px]">Frequency</th>
                    <th className="hidden md:table-cell w-[120px]">Last charge</th>
                    <th className="hidden md:table-cell w-[120px]">Next predicted</th>
                    <th className="hidden md:table-cell text-right w-[110px]">Last amount</th>
                    <th className="text-right w-[100px] sm:w-[110px]">Monthly eq.</th>
                  </tr>
                </thead>
                <tbody>
                  {outflow.map((s) => {
                    const avg = s.average_amount?.amount ?? s.average_amount;
                    const last = s.last_amount?.amount ?? s.last_amount;
                    const monthly = monthlyEquivalent(avg, s.frequency);
                    return (
                      <tr key={s.stream_id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors duration-100">
                        <td>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {s.merchant_name || s.description}
                            </span>
                            <StatusBadge status={s.status} isActive={s.is_active} />
                          </div>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                            <span className="sm:hidden">{prettyFrequency(s.frequency)}</span>
                            {s.institution_name && (
                              <>
                                <span className="sm:hidden"> · </span>
                                {s.institution_name}
                              </>
                            )}
                          </p>
                        </td>
                        <td className="hidden sm:table-cell text-zinc-700 dark:text-zinc-300 text-[12px]">
                          {prettyFrequency(s.frequency)}
                        </td>
                        <td className="hidden md:table-cell text-zinc-500 dark:text-zinc-400 text-[12px] tabular-nums">
                          {fmtDate(s.last_date)}
                        </td>
                        <td className="hidden md:table-cell text-zinc-500 dark:text-zinc-400 text-[12px] tabular-nums">
                          {fmtDate(s.predicted_next_date)}
                        </td>
                        <td className="hidden md:table-cell text-right text-zinc-900 dark:text-zinc-100 font-semibold tabular-nums">
                          {fmt(last)}
                        </td>
                        <td className="text-right text-zinc-700 dark:text-zinc-300 tabular-nums">
                          {fmt(monthly)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>

          {inflow.length > 0 && (
            <>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Incoming
                </h2>
                <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  {inflow.length} {inflow.length === 1 ? 'stream' : 'streams'}
                </span>
              </div>
              <div className="panel">
                <div className="overflow-x-auto"><table className="table-base">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th className="hidden sm:table-cell w-[140px]">Frequency</th>
                      <th className="hidden md:table-cell w-[120px]">Last received</th>
                      <th className="hidden md:table-cell w-[120px]">Next predicted</th>
                      <th className="text-right w-[100px] sm:w-[110px]">Last amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflow.map((s) => {
                      const last = s.last_amount?.amount ?? s.last_amount;
                      return (
                        <tr key={s.stream_id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors duration-100">
                          <td>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {s.merchant_name || s.description}
                            </p>
                            <p className="sm:hidden text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                              {prettyFrequency(s.frequency)}
                            </p>
                          </td>
                          <td className="hidden sm:table-cell text-zinc-700 dark:text-zinc-300 text-[12px]">
                            {prettyFrequency(s.frequency)}
                          </td>
                          <td className="hidden md:table-cell text-zinc-500 dark:text-zinc-400 text-[12px] tabular-nums">
                            {fmtDate(s.last_date)}
                          </td>
                          <td className="hidden md:table-cell text-zinc-500 dark:text-zinc-400 text-[12px] tabular-nums">
                            {fmtDate(s.predicted_next_date)}
                          </td>
                          <td className="text-right text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                            +{fmt(last)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
