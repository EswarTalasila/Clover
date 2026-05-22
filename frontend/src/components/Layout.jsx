import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Icon({ name, className = 'w-[15px] h-[15px]' }) {
  const icons = {
    dashboard: <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />,
    transactions: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
    budgets: <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />,
    accounts: <path d="M3 10h18M5 6h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm10 8h2" />,
    logout: <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
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

export default function Layout({ children }) {
  const { clearToken } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-[220px] bg-slate-50/60 border-r border-slate-200 flex flex-col">
        <div className="h-14 px-5 flex items-center border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-[22px] h-[22px] bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold tracking-tight">
              B
            </div>
            <span className="text-[13px] font-semibold text-slate-900 tracking-tight">Budget</span>
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
                    ? 'bg-white text-slate-900 border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
                    : 'text-slate-600 hover:text-slate-900 border border-transparent'
                }`
              }
            >
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 h-8 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors duration-100"
          >
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1100px] mx-auto px-10 py-10 fade-in">{children}</div>
      </main>
    </div>
  );
}
