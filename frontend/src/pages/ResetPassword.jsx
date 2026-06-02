import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../lib/api';
import Logo from '../components/Logo';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const status = err.response?.status;
      if (status === 400) setError('This reset link is invalid or has expired. Request a new one.');
      else if (status === 429) setError('Too many attempts. Wait a bit and try again.');
      else setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] fade-in">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-10 h-10 mb-4" />
          <h1 className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {done ? 'Password reset' : 'Set a new password'}
          </h1>
        </div>

        {!token ? (
          <div className="text-center">
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              This reset link is missing its token. Request a new one from the sign-in page.
            </p>
            <button onClick={() => navigate('/login')} className="btn-secondary w-full mt-6">
              Back to sign in
            </button>
          </div>
        ) : done ? (
          <div className="text-center">
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button onClick={() => navigate('/login')} className="btn-primary w-full mt-6">
              Go to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">At least 8 characters.</p>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {confirm && confirm !== password && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5">Passwords don't match.</p>
              )}
            </div>
            {error && (
              <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || (confirm && password !== confirm)}
              className="btn-primary w-full"
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
            <button type="button" onClick={() => navigate('/login')} className="btn-ghost w-full">
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
