import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register, demoLogin } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

function friendlyError(err, mode) {
  const status = err.response?.status;
  const detail = err.response?.data?.detail;

  if (!err.response) {
    return { message: "Can't reach the server. Check your connection and try again." };
  }

  if (status === 429) {
    return { message: 'Too many attempts. Wait a minute and try again.' };
  }

  if (mode === 'register') {
    if (typeof detail === 'string' && detail.toLowerCase().includes('already registered')) {
      return {
        message: 'An account with that email already exists.',
        action: { label: 'Sign in instead', target: 'login' },
      };
    }
    if (status === 422) {
      return { message: 'Please enter a valid email and a password with at least 8 characters.' };
    }
  }

  if (mode === 'login') {
    if (status === 401) {
      return { message: 'Email or password is incorrect.' };
    }
    if (status === 422) {
      return { message: 'Please enter a valid email and password.' };
    }
  }

  return { message: typeof detail === 'string' ? detail : 'Something went wrong. Please try again.' };
}

function ModeTabs({ mode, onChange }) {
  const tabs = [
    { value: 'login', label: 'Sign in' },
    { value: 'register', label: 'Create account' },
  ];
  return (
    <div className="grid grid-cols-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 mb-6">
      {tabs.map((t) => {
        const active = mode === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`h-9 text-[13px] font-medium rounded-md transition-colors duration-100 ${
              active
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const { saveToken } = useAuth();
  const navigate = useNavigate();

  async function handleDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      const data = await demoLogin();
      saveToken(data.access_token, 'Demo user', true);
      navigate('/');
    } catch (err) {
      setError(friendlyError(err, mode));
      setDemoLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'register' && password !== confirmPassword) {
      setError({ message: "Passwords don't match." });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fn = mode === 'login' ? login : register;
      const data = await fn({ email, password });
      saveToken(data.access_token, email);
      navigate('/');
    } catch (err) {
      setError(friendlyError(err, mode));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] fade-in">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-10 h-10 mb-4" />
          <h1 className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Welcome to Clover
          </h1>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
            Personal budgeting, your way.
          </p>
        </div>

        <ModeTabs mode={mode} onChange={switchMode} />

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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
                At least 8 characters.
              </p>
            )}
          </div>

          {mode === 'register' && (
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5">
                  Passwords don't match.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="text-[13px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              <p>{error.message}</p>
              {error.action && (
                <button
                  type="button"
                  onClick={() => switchMode(error.action.target)}
                  className="mt-1 underline underline-offset-2 font-medium"
                >
                  {error.action.label}
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || demoLoading || (mode === 'register' && password !== confirmPassword)}
            className="btn-primary w-full"
          >
            {loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
            <span className="mx-3 text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              or
            </span>
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading || demoLoading}
            className="btn-secondary w-full mt-6"
          >
            {demoLoading ? 'Setting up your demo…' : 'Explore the demo'}
          </button>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 text-center">
            Jump in with sample data — no account needed.
          </p>
        </div>
      </div>
    </div>
  );
}
