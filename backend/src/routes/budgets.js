const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;

    const where = { userId: req.userId };
    if (month) where.month = month;

    const budgets = await prisma.budget.findMany({ where });

    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { category, monthlyLimit, month } = req.body;

    const budget = await prisma.budget.upsert({
      where: {
        userId_category_month: {
          userId: req.userId,
          category,
          month,
        },
      },
      update: { monthlyLimit },
      create: {
        userId: req.userId,
        category,
        monthlyLimit,
        month,
      },
    });

    res.status(201).json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const start = new Date(`${month}-01`);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

    const [budgets, transactions] = await Promise.all([
      prisma.budget.findMany({
        where: { userId: req.userId, month },
      }),
      prisma.transaction.findMany({
        where: {
          userId: req.userId,
          date: { gte: start, lt: end },
        },
      }),
    ]);

    const spendingByCategory = transactions.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = 0;
      acc[t.category] += t.amount;
      return acc;
    }, {});

    const summary = budgets.map((budget) => ({
      category: budget.category,
      monthlyLimit: budget.monthlyLimit,
      spent: spendingByCategory[budget.category] || 0,
    }));

    const budgetedCategories = new Set(budgets.map((b) => b.category));
    for (const [category, spent] of Object.entries(spendingByCategory)) {
      if (!budgetedCategories.has(category)) {
        summary.push({ category, monthlyLimit: null, spent });
      }
    }

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
