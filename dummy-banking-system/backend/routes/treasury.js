const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { createSecurityCheck } = require('../middleware/securityCheck');
const { v4: uuidv4 } = require('uuid');

// GET /api/treasury/balances
router.get('/balances', (req, res) => {
  const accounts = queryAll('SELECT * FROM accounts ORDER BY account_type');
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  res.json({ accounts, totalBalance });
});

// GET /api/treasury/transactions
router.get('/transactions', (req, res) => {
  const { limit = 50, status, type } = req.query;
  let query = 'SELECT t.*, a.account_name FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id WHERE 1=1';
  const params = [];

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (type) { query += ' AND t.type = ?'; params.push(type); }

  query += ' ORDER BY t.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const transactions = queryAll(query, params);
  res.json({ transactions });
});

// GET /api/treasury/stats
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const totalBalance = queryOne('SELECT SUM(balance) as total FROM accounts')?.total || 0;
  const dailyVolume = queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE date(created_at) = ?', [today])?.total || 0;
  const pendingTx = queryOne("SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'")?.count || 0;
  const blockedTx = queryOne("SELECT COUNT(*) as count FROM transactions WHERE status = 'blocked'")?.count || 0;
  const totalAccounts = queryOne('SELECT COUNT(*) as count FROM accounts')?.count || 0;

  res.json({ totalBalance, dailyVolume, pendingApprovals: pendingTx, blockedTransactions: blockedTx, totalAccounts });
});

// POST /api/treasury/withdraw
router.post('/withdraw', createSecurityCheck('withdraw'), (req, res) => {
  const { account_id, amount, description } = req.body;
  if (!account_id || !amount) return res.status(400).json({ error: 'account_id and amount are required' });

  const account = queryOne('SELECT * FROM accounts WHERE id = ?', [account_id]);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  
  console.log(`[DEBUG] Withdraw attempt: Account ${account_id}, Balance ${account.balance}, Amount ${amount}, Type of amount: ${typeof amount}`);
  // Removed balance check for testing

  const txId = `TX${uuidv4().slice(0, 8).toUpperCase()}`;

  runSql('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, account_id]);
  runSql("INSERT INTO transactions (id, account_id, type, amount, description, status, performed_by, created_at) VALUES (?, ?, 'withdrawal', ?, ?, 'completed', ?, datetime('now'))",
    [txId, account_id, amount, description || 'Withdrawal', req.user.id]);

  res.json({ success: true, transaction_id: txId, message: `₹${Number(amount).toLocaleString('en-IN')} withdrawn successfully`, security: req.securityResult });
});

// POST /api/treasury/transfer
router.post('/transfer', createSecurityCheck('transfer'), (req, res) => {
  const { from_account_id, to_account_id, amount, description } = req.body;
  if (!from_account_id || !to_account_id || !amount) return res.status(400).json({ error: 'from_account_id, to_account_id, and amount are required' });

  const fromAccount = queryOne('SELECT * FROM accounts WHERE id = ?', [from_account_id]);
  const toAccount = queryOne('SELECT * FROM accounts WHERE id = ?', [to_account_id]);
  if (!fromAccount || !toAccount) return res.status(404).json({ error: 'Account not found' });
  
  console.log(`[DEBUG] Transfer attempt: From ${from_account_id} (Bal: ${fromAccount.balance}) to ${to_account_id}, Amount ${amount}, Type of amount: ${typeof amount}`);
  // Removed balance check for testing

  const txId = `TX${uuidv4().slice(0, 8).toUpperCase()}`;

  runSql('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, from_account_id]);
  runSql('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, to_account_id]);
  runSql("INSERT INTO transactions (id, account_id, type, amount, description, status, performed_by, created_at) VALUES (?, ?, 'transfer', ?, ?, 'completed', ?, datetime('now'))",
    [txId, from_account_id, amount, description || `Transfer to ${toAccount.account_name}`, req.user.id]);

  res.json({ success: true, transaction_id: txId, message: `₹${Number(amount).toLocaleString('en-IN')} transferred successfully`, security: req.securityResult });
});

module.exports = router;
