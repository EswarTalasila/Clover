const express = require('express');
const cors = require('cors');
require('dotenv').config();

const transactionsRouter = require('./src/routes/transactions');
const budgetsRouter = require('./src/routes/budgets');
const plaidRouter = require('./src/routes/plaid');
const authRouter = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/transactions', transactionsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/plaid', plaidRouter);
app.use('/api/auth', authRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
