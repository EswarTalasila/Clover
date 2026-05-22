import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getTransactions(month) {
  return api.get('/transactions', { params: { month } }).then((r) => r.data);
}

export function createTransaction(data) {
  return api.post('/transactions', data).then((r) => r.data);
}

export function updateTransaction(id, data) {
  return api.patch(`/transactions/${id}`, data).then((r) => r.data);
}

export function deleteTransaction(id) {
  return api.delete(`/transactions/${id}`);
}

export function getBudgets(month) {
  return api.get('/budgets', { params: { month } }).then((r) => r.data);
}

export function getBudgetSummary(month) {
  return api.get('/budgets/summary', { params: { month } }).then((r) => r.data);
}

export function createBudget(data) {
  return api.post('/budgets', data).then((r) => r.data);
}

export function createPlaidLinkToken() {
  return api.post('/plaid/link-token').then((r) => r.data);
}

export function exchangePlaidToken(publicToken) {
  return api.post('/plaid/exchange-token', { publicToken }).then((r) => r.data);
}

export function syncPlaidTransactions(accountId) {
  return api.post('/plaid/sync', { accountId }).then((r) => r.data);
}
