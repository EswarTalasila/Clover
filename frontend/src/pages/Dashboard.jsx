import { useState, useEffect } from 'react';
import { getBudgetSummary } from '../lib/api';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function ProgressBar({ spent, limit }) {
  if (!limit) return null;
  const pct = Math.min((spent / limit) * 100, 100);
  const overBudget = spent > limit;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>${spent.toFixed(2)} spent</span>
        <span>${limit.toFixed(2)} limit</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            overBudget ? 'bg-red-500' : pct > 80 ? 'bg-yellow-400' : 'bg-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const month = currentMonth();
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getBudgetSummary(month)
      .then(setSummary)
      .catch((err) => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [month]);

  const formattedMonth = new Date(`${month}-01`).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading...</p>;
  }

  if (error) {
    return <p className="text-red-500 text-sm">Error: {error}</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">{formattedMonth}</p>

      {summary.length === 0 ? (
        <p className="text-gray-400 text-sm">No budget data for this month yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map((item) => (
            <div
              key={item.category}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">
                  {item.category}
                </span>
                {item.monthlyLimit && item.spent > item.monthlyLimit && (
                  <span className="text-xs text-red-500 font-medium">Over budget</span>
                )}
              </div>
              <ProgressBar spent={item.spent} limit={item.monthlyLimit} />
              {!item.monthlyLimit && (
                <p className="text-xs text-gray-400 mt-2">
                  ${item.spent.toFixed(2)} spent, no limit set
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
