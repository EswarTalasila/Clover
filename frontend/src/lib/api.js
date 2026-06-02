import axios from 'axios';

function deriveApiBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:8000/api';
  const host = window.location.hostname;
  return `http://${host}:8000/api`;
}

const api = axios.create({
  baseURL: deriveApiBase(),
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

export function searchTransactions(q, limit = 8) {
  return api.get('/transactions/search', { params: { q, limit } }).then((r) => r.data);
}

export function updateTransaction(id, data) {
  return api.patch(`/transactions/${id}`, data).then((r) => r.data);
}

export function updateTransactionNotes(id, notes) {
  return api.patch(`/transactions/${id}`, { notes }).then((r) => r.data);
}

export function setTransactionExcluded(id, excluded) {
  return api.patch(`/transactions/${id}`, { excluded }).then((r) => r.data);
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

export function deleteBudget(id) {
  return api.delete(`/budgets/${id}`);
}

export function register(data) {
  return api.post('/auth/register', data).then((r) => r.data);
}

export function login(data) {
  return api.post('/auth/login', data).then((r) => r.data);
}

export function demoLogin() {
  return api.post('/auth/demo').then((r) => r.data);
}

export function getMe() {
  return api.get('/auth/me').then((r) => r.data);
}

export function changePassword(current_password, new_password) {
  return api.patch('/auth/password', { current_password, new_password });
}

export function exportData() {
  return api.get('/auth/export').then((r) => r.data);
}

export function deleteAccount() {
  return api.delete('/auth/me');
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

export function resetPlaidAccount(id) {
  return api.post(`/plaid/accounts/${id}/reset`);
}

export function getRecurring() {
  return api.get('/plaid/recurring').then((r) => r.data);
}

export function getNetWorth() {
  return api.get('/plaid/balances').then((r) => r.data);
}

export function getTopMerchants(month, limit = 5) {
  return api.get('/transactions/top-merchants', { params: { month, limit } }).then((r) => r.data);
}

export function getGoals() {
  return api.get('/goals').then((r) => r.data);
}

export function createGoal(data) {
  return api.post('/goals', data).then((r) => r.data);
}

export function updateGoal(id, data) {
  return api.patch(`/goals/${id}`, data).then((r) => r.data);
}

export function deleteGoal(id) {
  return api.delete(`/goals/${id}`);
}
