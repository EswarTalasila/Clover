import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
}

function fmtFull(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));
}

function monthLabel(ym, long = false) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('default', {
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : undefined,
  });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-[12px] shadow-md">
      <div className="font-medium text-zinc-900 dark:text-zinc-100">{item.fullLabel}</div>
      <div className="text-zinc-500 dark:text-zinc-400 tabular-nums">{fmtFull(item.spent)}</div>
    </div>
  );
}

export default function MonthlyTrend({ points, selectedMonth, currentMonth, onSelectMonth }) {
  const { theme } = useTheme();

  const data = points.map((p) => {
    const [y, m] = p.month.split('-').map(Number);
    const fullLabel = new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    return {
      month: p.month,
      label: monthLabel(p.month),
      spent: Number(p.spent),
      fullLabel,
      isCurrent: p.month === currentMonth,
    };
  });

  const maxSpent = Math.max(...data.map((d) => d.spent), 1);
  const avg = data.reduce((s, d) => s + d.spent, 0) / Math.max(data.length, 1);

  const baseBarColor = theme === 'dark' ? '#3f3f46' : '#e4e4e7';
  const activeBarColor = theme === 'dark' ? '#f4f4f5' : '#18181b';
  const dimmedBarColor = theme === 'dark' ? '#27272a' : '#f4f4f5';
  const axisColor = theme === 'dark' ? '#71717a' : '#a1a1aa';

  const hasNonCurrentSelection = selectedMonth && selectedMonth !== currentMonth;

  function colorFor(d) {
    if (hasNonCurrentSelection) {
      return d.month === selectedMonth ? activeBarColor : dimmedBarColor;
    }
    return d.isCurrent ? activeBarColor : baseBarColor;
  }

  const selected = hasNonCurrentSelection ? data.find((d) => d.month === selectedMonth) : null;

  function handleBarClick(payload) {
    if (!payload?.month) return;
    if (payload.month === selectedMonth) {
      onSelectMonth(currentMonth);
    } else {
      onSelectMonth(payload.month);
    }
  }

  return (
    <div className="panel p-5 h-full flex flex-col">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
            {selected ? 'Viewing' : `Last ${data.length} months`}
          </p>
          <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-0.5 truncate">
            {selected ? selected.fullLabel : 'Spending trend'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">
            {selected ? 'Spent' : 'Avg / mo'}
          </p>
          <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight tabular-nums mt-0.5">
            {fmt(selected ? selected.spent : avg)}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: axisColor, fontSize: 11 }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: axisColor, fontSize: 11 }}
              tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
              width={40}
              domain={[0, Math.ceil(maxSpent * 1.1)]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="spent" radius={[2, 2, 0, 0]} onClick={(d) => handleBarClick(d?.payload)} style={{ cursor: 'pointer' }}>
              {data.map((d) => (
                <Cell key={d.month} fill={colorFor(d)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selected && (
        <button
          onClick={() => onSelectMonth(currentMonth)}
          className="mt-2 self-start text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-100"
        >
          Back to current month
        </button>
      )}
    </div>
  );
}
