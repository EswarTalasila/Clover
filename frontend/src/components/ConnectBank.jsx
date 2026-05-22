import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { createPlaidLinkToken, exchangePlaidToken, syncPlaidTransactions } from '../lib/api';

export default function ConnectBank({ onSuccess, className = '' }) {
  const [linkToken, setLinkToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    createPlaidLinkToken()
      .then((d) => setLinkToken(d.link_token))
      .catch((err) => setError(err.response?.data?.detail || err.message));
  }, []);

  const handleSuccess = useCallback(
    async (publicToken, metadata) => {
      setBusy(true);
      setError(null);
      try {
        await exchangePlaidToken(publicToken, metadata?.institution?.name);
        await syncPlaidTransactions();
        onSuccess?.();
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to connect bank');
      } finally {
        setBusy(false);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
  });

  return (
    <div className={className}>
      <button
        onClick={() => open()}
        disabled={!ready || busy}
        className="btn-primary"
      >
        {busy ? 'Connecting…' : 'Connect a bank'}
      </button>
      {error && (
        <div className="mt-3 text-[13px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
