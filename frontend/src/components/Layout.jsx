import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import CommandPalette from './CommandPalette';

function Icon({ name, className = 'w-[15px] h-[15px]' }) {
  const icons = {
    dashboard: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
    transactions: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
    budgets: <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />,
    subscriptions: <path d="M4 4v6h6M20 20v-6h-6M20 4l-7 7M4 20l7-7" />,
    goals: <path d="M12 2l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5L12 2z" />,
    accounts: <path d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm10 8h2" />,
    settings: (
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
    logout: (
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    ),
    chevron: <path d="M8 9l4-4 4 4m0 6l-4 4-4-4" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="M6 18L18 6M6 6l12 12" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </>
    ),
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
  { to: '/goals', label: 'Goals', icon: 'goals' },
  { to: '/subscriptions', label: 'Subscriptions', icon: 'subscriptions' },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
];

function UserMenu() {
  const { email, clearToken } = useAuth();
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
        className="flex items-center gap-2 pl-1.5 pr-2 h-8 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors duration-100"
      >
        <div className="w-6 h-6 bg-emerald-700 dark:bg-emerald-500 text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
          {initial}
        </div>
        <span className="hidden sm:inline text-[12px] font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-[180px]">
          {displayEmail}
        </span>
        <Icon name="chevron" className="w-3 h-3 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-[220px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg dark:shadow-black/40 py-1 fade-in">
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Signed in as</p>
            <p className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {displayEmail}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors duration-100"
          >
            <Icon name="logout" className="w-[14px] h-[14px]" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }) {
  return (
    <>
      <div className="h-14 px-5 flex items-center border-b border-zinc-200 dark:border-zinc-800 justify-between">
        <NavLink
          to="/"
          end
          onClick={onNavigate}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity duration-100"
        >
          <Logo className="w-[22px] h-[22px]" />
          <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Clover
          </span>
        </NavLink>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 h-9 md:h-8 text-[13px] font-medium transition-colors duration-100 ${
                isActive
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
              }`
            }
          >
            <Icon name={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-zinc-200 dark:border-zinc-800">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2.5 h-9 md:h-8 text-[13px] font-medium transition-colors duration-100 ${
              isActive
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
            }`
          }
        >
          <Icon name="settings" />
          <span>Settings</span>
        </NavLink>
      </div>
    </>
  );
}

function DemoBanner() {
  const { clearToken } = useAuth();
  const navigate = useNavigate();

  function leaveDemo() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-[12px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/50">
      <span className="text-center">You're exploring a demo with sample data.</span>
      <button
        onClick={leaveDemo}
        className="font-medium underline underline-offset-2 hover:text-emerald-900 dark:hover:text-emerald-200 whitespace-nowrap"
      >
        Create your account
      </button>
    </div>
  );
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const { isDemo } = useAuth();

  // Auto-close drawer on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // ⌘K / Ctrl+K toggles the command palette from anywhere
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[260px] md:relative md:w-[220px] bg-zinc-50/95 dark:bg-zinc-950/95 md:bg-zinc-50/60 md:dark:bg-zinc-900/40 backdrop-blur md:backdrop-blur-none border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-200 ease-out pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-[env(safe-area-inset-bottom)]">
        {isDemo && (
          <div className="flex-shrink-0">
            <DemoBanner />
          </div>
        )}
        <header className="px-4 md:px-8 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0 pt-[env(safe-area-inset-top)] h-[calc(3.5rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 -ml-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100"
              aria-label="Open menu"
            >
              <Icon name="menu" className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 h-8 w-[260px] pl-2.5 pr-1.5 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-100"
            >
              <Icon name="search" className="w-[14px] h-[14px]" />
              <span className="text-[12px] flex-1 text-left">Search…</span>
              <kbd className="text-[10px] font-medium border border-zinc-200 dark:border-zinc-700 px-1 py-0.5">
                ⌘K
              </kbd>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100"
              aria-label="Search"
            >
              <Icon name="search" className="w-5 h-5" />
            </button>
          </div>
          <UserMenu />
        </header>
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1100px] mx-auto px-4 md:px-10 py-6 md:py-10 fade-in">
            {children}
          </div>
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
