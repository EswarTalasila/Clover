const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const {
  createLinkToken,
  exchangePublicToken,
  syncTransactions,
} = require('../lib/plaid');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.post('/link-token', async (req, res) => {
  try {
    const linkToken = await createLinkToken(req.userId);
    res.json({ linkToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exchange-token', async (req, res) => {
  try {
    const { publicToken, accountName, accountType } = req.body;

    const { accessToken, itemId } = await exchangePublicToken(publicToken);

    const account = await prisma.account.create({
      data: {
        userId: req.userId,
        plaidId: itemId,
        accessToken,
        name: accountName || 'Connected Account',
        type: accountType || 'depository',
      },
    });

    res.json({ account });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { accountId } = req.body;

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: req.userId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const plaidTransactions = await syncTransactions(
      account.accessToken,
      account.cursor
    );

    const created = [];
    for (const t of plaidTransactions.added) {
      const tx = await prisma.transaction.upsert({
        where: { plaidId: t.transaction_id },
        update: {},
        create: {
          userId: req.userId,
          accountId: account.id,
          plaidId: t.transaction_id,
          amount: t.amount,
          description: t.name,
          category: t.personal_finance_category?.primary || 'Other',
          date: new Date(t.date),
          isManual: false,
        },
      });
      created.push(tx);
    }

    res.json({ synced: created.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
