import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const CATEGORY_COLORS = {
  'Food & Dining': '#f97316',
  Shopping: '#ec4899',
  Transportation: '#3b82f6',
  Entertainment: '#a855f7',
  'Bills & Utilities': '#71717a',
  Health: '#10b981',
  Travel: '#0ea5e9',
  Other: '#f59e0b',
};

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
}

export default function CategoryDonut({ items }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const data = items
    .filter((i) => Number(i.spent) > 0 && i.category !== 'Income')
    .map((i) => ({ category: i.category, spent: Number(i.spent) }));

  const total = data.reduce((s, d) => s + d.spent, 0);
  const enriched = data.map((d) => ({ ...d, pct: total > 0 ? (d.spent / total) * 100 : 0 }));

  if (enriched.length === 0) {
    return (
      <div className="panel p-5 h-full flex items-center justify-center min-h-[280px]">
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No spending data this month.</p>
      </div>
    );
  }

  const active = activeIndex !== null ? enriched[activeIndex] : null;

  return (
    <div className="panel p-5 h-full flex flex-col">
      <div className="mb-3">
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
          Where it went
        </p>
        <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-0.5">
          By category
        </p>
      </div>

      <div className="flex-1 flex items-center gap-6 min-h-[200px]">
        <div
          className="relative w-[180px] h-[180px] flex-shrink-0"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={enriched}
                dataKey="spent"
                nameKey="category"
                innerRadius={56}
                outerRadius={86}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
              >
                {enriched.map((entry, idx) => (
                  <Cell
                    key={entry.category}
                    fill={CATEGORY_COLORS[entry.category] || '#a1a1aa'}
                    style={{
                      opacity: activeIndex === null || activeIndex === idx ? 1 : 0.35,
                      transition: 'opacity 120ms ease',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.08em] transition-opacity duration-150">
              {active ? active.category : 'Total'}
            </p>
            <p className="text-[18px] font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100 transition-opacity duration-150">
              {fmt(active ? active.spent : total)}
            </p>
            {active && (
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                {active.pct.toFixed(0)}% of total
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          {enriched.map((d, idx) => (
            <button
              key={d.category}
              type="button"
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              className={`w-full flex items-center gap-2.5 text-[12px] py-0.5 transition-opacity duration-100 ${
                activeIndex !== null && activeIndex !== idx ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <span
                className="w-2 h-2 flex-shrink-0"
                style={{ background: CATEGORY_COLORS[d.category] || '#a1a1aa' }}
              />
              <span className="flex-1 truncate text-left text-zinc-700 dark:text-zinc-300">
                {d.category}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                {d.pct.toFixed(0)}%
              </span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium tabular-nums w-16 text-right">
                {fmt(d.spent)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
