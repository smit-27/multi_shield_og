const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { createSecurityCheck } = require('../middleware/securityCheck');
const { v4: uuidv4 } = require('uuid');

// GET /api/withdrawals - Recent withdrawal transactions
router.get('/', (req, res) => {
  const { limit = 20 } = req.query;
  const withdrawals = queryAll(
    `SELECT t.*, a.account_name 
     FROM transactions t 
     LEFT JOIN accounts a ON t.account_id = a.id 
     WHERE t.type = 'withdrawal' 
     ORDER BY t.created_at DESC 
     LIMIT ?`,
    [parseInt(limit)]
  );
  res.json(withdrawals);
});

// GET /api/withdrawals/stats - KPI data for the Cash Management page
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const disbursedToday = queryOne(
    "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'withdrawal' AND date(created_at) = ?",
    [today]
  )?.total || 0;

  const pendingCount = queryOne(
    "SELECT COUNT(*) as count FROM transactions WHERE type = 'withdrawal' AND status = 'pending'"
  )?.count || 0;

  const complianceHolds = queryOne(
    "SELECT COUNT(*) as count FROM transactions WHERE type = 'withdrawal' AND status = 'blocked'"
  )?.count || 0;

  const clearedLimit = queryOne(
    "SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE status = 'active'"
  )?.total || 0;

  res.json({
    disbursedToday,
    pendingCount,
    complianceHolds,
    clearedLimit
  });
});

// POST /api/withdrawals - Process a new withdrawal/disbursement
router.post('/', createSecurityCheck('withdraw'), (req, res) => {
  const { account_id, amount, description } = req.body;

  if (!account_id || !amount) {
    return res.status(400).json({ error: 'account_id and amount are required' });
  }
  if (amount < 1000) {
    return res.status(400).json({ error: 'Minimum disbursement amount is ₹1,000' });
  }

  const account = queryOne('SELECT * FROM accounts WHERE id = ?', [account_id]);
  if (!account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (account.balance < amount) {
    return res.status(400).json({
      error: 'Insufficient funds',
      message: `Account balance ₹${Number(account.balance).toLocaleString('en-IN')} is less than disbursement amount ₹${Number(amount).toLocaleString('en-IN')}`
    });
  }

  const txId = `WD${uuidv4().slice(0, 8).toUpperCase()}`;

  runSql('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, account_id]);
  runSql(
    "INSERT INTO transactions (id, account_id, type, amount, description, status, performed_by, created_at) VALUES (?, ?, 'withdrawal', ?, ?, 'completed', ?, datetime('now'))",
    [txId, account_id, amount, description || 'Fund Disbursement', req.user.id]
  );

  res.json({
    success: true,
    transaction_id: txId,
    message: `₹${Number(amount).toLocaleString('en-IN')} disbursed successfully from ${account.account_name}`,
    security: req.securityResult
  });
});

module.exports = router;
