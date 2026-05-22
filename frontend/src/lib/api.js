import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
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

export function recategorizeOther() {
  return api.post('/transactions/recategorize').then((r) => r.data);
}

export function getBudgets(month) {
  return api.get('/budgets', { params: { month } }).then((r) => r.data);
}

export function getBudgetSummary(month) {
  return api.get('/budgets/summary', { params: { month } }).then((r) => r.data);
}

export function getSpendingTrend(months = 6) {
  return api.get('/budgets/trend', { params: { months } }).then((r) => r.data);
}

export function createBudget(data) {
  return api.post('/budgets', data).then((r) => r.data);
}

export function register(data) {
  return api.post('/auth/register', data).then((r) => r.data);
}

export function login(data) {
  return api.post('/auth/login', data).then((r) => r.data);
}

export function getMe() {
  return api.get('/auth/me').then((r) => r.data);
}

export function createPlaidLinkToken() {
  return api.post('/plaid/link-token').then((r) => r.data);
}

export function exchangePlaidToken(publicToken, institutionName) {
  return api
    .post('/plaid/exchange-token', { public_token: publicToken, institution_name: institutionName })
    .then((r) => r.data);
}

export function syncPlaidTransactions() {
  return api.post('/plaid/sync').then((r) => r.data);
}

export function getPlaidAccounts() {
  return api.get('/plaid/accounts').then((r) => r.data);
}

export function deletePlaidAccount(id) {
  return api.delete(`/plaid/accounts/${id}`);
}
