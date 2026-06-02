import { useState } from 'react';

function pct(spent, limit) {
  if (!limit || Number(limit) <= 0) return 0;
  return (Number(spent) / Number(limit)) * 100;
}

export default function BudgetAlerts({ summary }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const alerts = summary
    .filter((item) => item.monthly_limit !== null)
    .map((item) => ({ ...item, pct: pct(item.spent, item.monthly_limit) }))
    .filter((item) => item.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  if (alerts.length === 0) return null;

  const over = alerts.filter((a) => a.pct >= 100);
  const nearing = alerts.filter((a) => a.pct < 100);

  return (
    <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-[0.06em]">
            {over.length > 0 ? 'Budgets exceeded' : 'Budgets near limit'}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {over.map((a) => (
              <li key={a.category} className="text-[13px] text-amber-900 dark:text-amber-100">
                <span className="font-medium">{a.category}</span> is{' '}
                <span className="font-semibold">{a.pct.toFixed(0)}% spent</span> — over by{' '}
                <span className="tabular-nums">
                  ${Math.abs(Number(a.spent) - Number(a.monthly_limit)).toFixed(0)}
                </span>
              </li>
            ))}
            {nearing.map((a) => (
              <li key={a.category} className="text-[13px] text-amber-900/80 dark:text-amber-100/80">
                <span className="font-medium">{a.category}</span> at{' '}
                <span className="font-semibold">{a.pct.toFixed(0)}%</span> of budget
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 text-[16px] leading-none -mt-0.5"
          aria-label="Dismiss alerts"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
