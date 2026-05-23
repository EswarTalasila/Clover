import { useState, useEffect, useCallback } from 'react';
import {
  getPlaidAccounts,
  deletePlaidAccount,
  syncPlaidTransactions,
  resetPlaidAccount,
} from '../lib/api';
import ConnectBank from '../components/ConnectBank';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

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

  async function handleDisconnect() {
    await deletePlaidAccount(disconnectTarget.id);
    setDisconnectTarget(null);
    load();
  }

  async function handleReset() {
    const target = resetTarget;
    setResetTarget(null);
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      await resetPlaidAccount(target.id);
      const result = await syncPlaidTransactions();
      setMessage(`Re-synced: ${result.added} added, ${result.modified} updated.`);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em]">
            Connections
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
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
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : (
        <div className="panel">
          {accounts.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-[13px] text-zinc-600 dark:text-zinc-300">No banks connected yet.</p>
              <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1">
                Connect a bank via Plaid to automatically sync transactions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto"><table className="table-base">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th className="hidden sm:table-cell w-[160px]">Status</th>
                  <th className="text-right w-[150px] sm:w-[140px]" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="group hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors duration-100">
                    <td>
                      <p className="text-zinc-900 dark:text-zinc-100 font-medium">
                        {a.institution_name || 'Unknown bank'}
                      </p>
                      <p className="sm:hidden text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                        {a.last_cursor ? 'Synced' : 'Awaiting first sync'}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell text-[12px] text-zinc-500 dark:text-zinc-400">
                      {a.last_cursor ? 'Synced' : 'Awaiting first sync'}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-100">
                        <button
                          onClick={() => setResetTarget(a)}
                          className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity duration-100"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setDisconnectTarget(a)}
                          className="text-[12px] font-medium text-red-600 dark:text-red-400 hover:opacity-70 transition-opacity duration-100"
                        >
                          Disconnect
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!disconnectTarget}
        title={`Disconnect ${disconnectTarget?.institution_name || 'this bank'}?`}
        description="All transactions synced from this bank will be permanently deleted. You can reconnect later."
        confirmText="Disconnect bank"
        variant="danger"
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectTarget(null)}
      />

      <ConfirmDialog
        open={!!resetTarget}
        title={`Reset ${resetTarget?.institution_name || 'this bank'}?`}
        description="Clears the sync cursor and re-pulls every available transaction from Plaid. Existing transactions are preserved; previously missing ones get added back."
        confirmText="Reset and re-sync"
        onConfirm={handleReset}
        onCancel={() => setResetTarget(null)}
      />
    </div>
  );
}
