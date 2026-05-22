import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function Icon({ name, className = 'w-[15px] h-[15px]' }) {
  const icons = {
    dashboard: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
    transactions: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
    budgets: <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />,
    accounts: <path d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm10 8h2" />,
    logout: <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
    sun: <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />,
    moon: <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
    chevron: <path d="M8 9l4-4 4 4m0 6l-4 4-4-4" />,
  };
  const filled = name === 'dashboard';
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'transactions' },
  { to: '/budgets', label: 'Budgets', icon: 'budgets' },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
];

function UserMenu() {
  const { email, clearToken } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  const initial = email ? email[0].toUpperCase() : '?';
  const displayEmail = email || 'Signed in';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-2 h-10 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors duration-100"
      >
        <div className="w-7 h-7 bg-accent-600 text-white flex items-center justify-center text-[12px] font-semibold flex-shrink-0">
          {initial}
        </div>
        <span className="flex-1 text-left text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate">
          {displayEmail}
        </span>
        <Icon name="chevron" className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-black/40 py-1 fade-in">
          <button
            onClick={() => {
              toggle();
            }}
            className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors duration-100"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-[14px] h-[14px]" />
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors duration-100"
          >
            <Icon name="logout" className="w-[14px] h-[14px]" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  return (
    <div className="flex h-screen bg-white dark:bg-slate-950">
      <aside className="w-[220px] bg-slate-50/60 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="h-14 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-[22px] h-[22px] bg-accent-600 text-white flex items-center justify-center text-[11px] font-bold tracking-tight">
              T
            </div>
            <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 tracking-tight">
              Tally
            </span>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 h-8 text-[13px] font-medium transition-colors duration-100 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-accent-700 dark:text-accent-300 border border-slate-200 dark:border-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
                }`
              }
            >
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-2 border-t border-slate-200 dark:border-slate-800">
          <UserMenu />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1100px] mx-auto px-10 py-10 fade-in">{children}</div>
      </main>
    </div>
  );
}
