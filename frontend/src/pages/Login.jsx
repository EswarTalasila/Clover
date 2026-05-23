import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { saveToken } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fn = mode === 'login' ? login : register;
      const data = await fn({ email, password });
      saveToken(data.access_token, email);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] fade-in">
        <div className="flex flex-col items-center mb-10">
          <Logo className="w-10 h-10 mb-5" />
          <h1 className="text-[22px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            {mode === 'login' ? 'Sign in to Clover' : 'Create your Clover account'}
          </h1>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1.5">
            {mode === 'login' ? 'Enter your email to continue.' : 'Start tracking your finances.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="text-zinc-900 dark:text-zinc-100 font-medium hover:underline underline-offset-2"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
