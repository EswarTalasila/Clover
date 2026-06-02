import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { searchTransactions, aiSearchTransactions } from '../lib/api';

const CATEGORY_DOT = {
  'Food & Dining': 'bg-orange-500',
  Shopping: 'bg-pink-500',
  Transportation: 'bg-blue-500',
  Entertainment: 'bg-purple-500',
  'Bills & Utilities': 'bg-zinc-500',
  Health: 'bg-emerald-500',
  Travel: 'bg-sky-500',
  Income: 'bg-green-600',
  Other: 'bg-amber-500',
};

// Case-insensitive subsequence match. Returns a score (higher = better) or -1 for no match.
// Rewards contiguous runs and matches at word boundaries so "tx" ranks "Transactions" well.
function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;

  let score = 0;
  let cursor = 0;
  let prev = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, cursor);
    if (found === -1) return -1;
    score += found === prev + 1 ? 6 : 1;
    if (found === 0 || t[found - 1] === ' ') score += 4;
    prev = found;
    cursor = found + 1;
  }
  return score + Math.max(0, 10 - t.length / 4);
}

function fmtAmount(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(Number(n)));
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function GroupLabel({ children }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.08em]">
      {children}
    </p>
  );
}

function rowClass(isActive) {
  return `w-full flex items-center gap-3 px-3 py-2 text-left transition-colors duration-75 ${
    isActive ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
  }`;
}

function SparkIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2z" />
    </svg>
  );
}

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { toggle } = useTheme();
  const [query, setQuery] = useState('');
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const actions = useMemo(
    () => [
      { id: 'nav-dashboard', label: 'Dashboard', hint: 'Overview', run: () => navigate('/') },
      { id: 'nav-transactions', label: 'Transactions', hint: 'Activity', run: () => navigate('/transactions') },
      { id: 'nav-budgets', label: 'Budgets', hint: 'Page', run: () => navigate('/budgets') },
      { id: 'nav-goals', label: 'Goals', hint: 'Page', run: () => navigate('/goals') },
      { id: 'nav-subscriptions', label: 'Subscriptions', hint: 'Page', run: () => navigate('/subscriptions') },
      { id: 'nav-accounts', label: 'Accounts', hint: 'Page', run: () => navigate('/accounts') },
      { id: 'nav-settings', label: 'Settings', hint: 'Page', run: () => navigate('/settings') },
      { id: 'act-new-tx', label: 'New transaction', hint: 'Action', run: () => navigate('/transactions?new=1') },
      { id: 'act-new-goal', label: 'New goal', hint: 'Action', run: () => navigate('/goals?new=1') },
      { id: 'act-theme', label: 'Toggle theme', hint: 'Action', run: () => toggle() },
    ],
    [navigate, toggle]
  );

  const q = query.trim();

  const filteredActions = useMemo(() => {
    if (!q) return actions;
    return actions
      .map((a) => ({ a, s: fuzzyScore(q, a.label) }))
      .filter((x) => x.s >= 0)
      .sort((x, y) => y.s - x.s)
      .map((x) => x.a);
  }, [actions, q]);

  // Fetch matching transactions (debounced) once the query is meaningful.
  useEffect(() => {
    if (!open) return;
    if (q.length < 2) {
      setTxns([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      searchTransactions(q, 8)
        .then((data) => !cancelled && setTxns(data))
        .catch(() => !cancelled && setTxns([]))
        .finally(() => !cancelled && setLoading(false));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, open]);

  const showAiOption = q.length >= 3 && !aiResult;

  const items = useMemo(() => {
    if (aiResult) {
      return aiResult.results.map((t) => ({ type: 'tx', id: `ai-tx-${t.id}`, tx: t }));
    }
    const aiItem = showAiOption ? [{ type: 'ai', id: 'ai-ask' }] : [];
    const navItems = filteredActions.map((a) => ({ type: 'action', id: a.id, action: a }));
    const txItems = txns.map((t) => ({ type: 'tx', id: `tx-${t.id}`, tx: t }));
    return [...aiItem, ...navItems, ...txItems];
  }, [aiResult, showAiOption, filteredActions, txns]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTxns([]);
      setAiResult(null);
      setActive(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Editing the query exits AI-results mode and resets selection.
  useEffect(() => {
    setActive(0);
    setAiResult(null);
  }, [query]);
  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(items.length - 1, 0)));
  }, [items.length]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  async function runAiSearch() {
    setAiLoading(true);
    setActive(0);
    try {
      const data = await aiSearchTransactions(q);
      setAiResult(data);
    } catch {
      setAiResult({ interpretation: 'Could not run AI search. Try again.', results: [] });
    } finally {
      setAiLoading(false);
    }
  }

  function selectItem(item) {
    if (!item) return;
    if (item.type === 'ai') {
      runAiSearch();
      return;
    }
    if (item.type === 'action') {
      item.action.run();
    } else {
      const t = item.tx;
      const month = (t.date || '').slice(0, 7);
      const term = t.merchant_name || t.description || '';
      navigate(`/transactions?month=${month}&search=${encodeURIComponent(term)}`);
    }
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectItem(items[active]);
    }
  }

  if (!open) return null;

  const firstActionIdx = items.findIndex((it) => it.type === 'action');
  const firstTxIdx = items.findIndex((it) => it.type === 'tx');

  const renderAiAsk = (idx) => (
    <button
      type="button"
      data-index={idx}
      onMouseEnter={() => setActive(idx)}
      onClick={() => selectItem({ type: 'ai' })}
      className={rowClass(active === idx)}
    >
      <SparkIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      <span className="flex-1 min-w-0 text-[13px] text-zinc-800 dark:text-zinc-100 truncate">
        Ask AI<span className="text-zinc-400 dark:text-zinc-500"> · “{q}”</span>
      </span>
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Enter</span>
    </button>
  );

  const renderAction = (item, idx) => (
    <button
      type="button"
      data-index={idx}
      onMouseEnter={() => setActive(idx)}
      onClick={() => selectItem(item)}
      className={rowClass(active === idx)}
    >
      <span className="flex-1 text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
        {item.action.label}
      </span>
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{item.action.hint}</span>
    </button>
  );

  const renderTx = (item, idx) => {
    const t = item.tx;
    const isIncome = Number(t.amount) < 0;
    return (
      <button
        type="button"
        data-index={idx}
        onMouseEnter={() => setActive(idx)}
        onClick={() => selectItem(item)}
        className={rowClass(active === idx)}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CATEGORY_DOT[t.category] || 'bg-zinc-400'}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-100 truncate">
            {t.merchant_name || t.description}
          </span>
          <span className="block text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
            {fmtDate(t.date)}
            {t.category ? ` · ${t.category}` : ''}
          </span>
        </span>
        <span
          className={`text-[12px] font-semibold tabular-nums flex-shrink-0 ${
            isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-200'
          }`}
        >
          {isIncome ? '+' : '−'}
          {fmtAmount(t.amount)}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[560px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xl shadow-black/20 dark:shadow-black/50 fade-in"
      >
        <div className="flex items-center gap-2.5 px-3.5 border-b border-zinc-200 dark:border-zinc-800">
          <svg
            className="w-[15px] h-[15px] text-zinc-400 dark:text-zinc-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search, or ask in plain English…"
            className="flex-1 h-12 bg-transparent text-[14px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="hidden sm:block text-[10px] font-medium text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1.5">
          {aiLoading ? (
            <div className="px-4 py-10 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Asking AI…
              </span>
            </div>
          ) : aiResult ? (
            <>
              <div className="flex items-start gap-2 px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <SparkIcon className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <p className="flex-1 text-[12px] text-zinc-600 dark:text-zinc-300">{aiResult.interpretation}</p>
                <button
                  onClick={() => setAiResult(null)}
                  className="text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Clear
                </button>
              </div>
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                  No matching transactions.
                </div>
              ) : (
                items.map((item, idx) => <Fragment key={item.id}>{renderTx(item, idx)}</Fragment>)
              )}
            </>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-zinc-500 dark:text-zinc-400">
              {loading ? 'Searching…' : q ? 'No matches found.' : 'Type to search.'}
            </div>
          ) : (
            items.map((item, idx) => (
              <Fragment key={item.id}>
                {idx === firstActionIdx && <GroupLabel>Go to</GroupLabel>}
                {idx === firstTxIdx && <GroupLabel>Transactions</GroupLabel>}
                {item.type === 'ai'
                  ? renderAiAsk(idx)
                  : item.type === 'action'
                  ? renderAction(item, idx)
                  : renderTx(item, idx)}
              </Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
