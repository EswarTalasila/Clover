import { useState, useEffect, useCallback } from 'react';
import { getPlaidAccounts, deletePlaidAccount, syncPlaidTransactions } from '../lib/api';
import ConnectBank from '../components/ConnectBank';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getPlaidAccounts()
      .then(setAccounts)
      .catch((err) => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await syncPlaidTransactions();
      setMessage(
        `Synced: ${result.added} added, ${result.modified} updated, ${result.removed} removed.`
      );
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect(id) {
    if (!confirm('Disconnect this bank? All synced transactions will be deleted.')) return;
    await deletePlaidAccount(id);
    load();
  }

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-slate-200 dark:border-slate-800 flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em]">
            Connections
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
            Accounts
          </h1>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <button onClick={handleSync} disabled={syncing} className="btn-secondary">
              {syncing ? 'Syncing…' : 'Sync transactions'}
            </button>
          )}
          <ConnectBank onSuccess={load} />
        </div>
      </div>

      {message && (
        <div className="mb-4 text-[13px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Loading…</p>
      ) : (
        <div className="panel">
          {accounts.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-[13px] text-slate-600 dark:text-slate-300">No banks connected yet.</p>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">
                Connect a bank via Plaid to automatically sync transactions.
              </p>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th className="w-[160px]">Status</th>
                  <th className="w-[100px]" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="group hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors duration-100">
                    <td className="text-slate-900 dark:text-slate-100 font-medium">
                      {a.institution_name || 'Unknown bank'}
                    </td>
                    <td className="text-[12px] text-slate-500 dark:text-slate-400">
                      {a.last_cursor ? 'Synced' : 'Awaiting first sync'}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDisconnect(a.id)}
                        className="text-[12px] text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 transition-all duration-100"
                      >
                        Disconnect
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
