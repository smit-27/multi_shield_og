const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { createSecurityCheck } = require('../middleware/securityCheck');

// GET /api/loans
router.get('/', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM loans';
  const params = [];
  if (status) { query += ' WHERE status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC';
  res.json({ loans: queryAll(query, params) });
});

// GET /api/loans/stats
router.get('/stats', (req, res) => {
  const total = queryOne('SELECT COUNT(*) as count FROM loans')?.count || 0;
  const pending = queryOne("SELECT COUNT(*) as count FROM loans WHERE status = 'pending'")?.count || 0;
  const approved = queryOne("SELECT COUNT(*) as count FROM loans WHERE status = 'approved'")?.count || 0;
  const rejected = queryOne("SELECT COUNT(*) as count FROM loans WHERE status = 'rejected'")?.count || 0;
  const totalAmount = queryOne('SELECT COALESCE(SUM(amount), 0) as total FROM loans')?.total || 0;
  const approvedAmount = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status = 'approved'")?.total || 0;
  res.json({ total, pending, approved, rejected, totalAmount, approvedAmount });
});

// GET /api/loans/:id
router.get('/:id', (req, res) => {
  const loan = queryOne('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  res.json({ loan });
});

// POST /api/loans/:id/approve
router.post('/:id/approve', createSecurityCheck('loan_approval'), (req, res) => {
  const loan = queryOne('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (loan.status !== 'pending') return res.status(400).json({ error: 'Loan is not pending' });

  runSql("UPDATE loans SET status = 'approved', reviewed_by = ?, risk_score = ?, updated_at = datetime('now') WHERE id = ?",
    [req.user.id, req.securityResult?.risk_score || 0, req.params.id]);

  res.json({ success: true, message: `Loan ${req.params.id} approved`, security: req.securityResult });
});

// POST /api/loans/:id/reject
router.post('/:id/reject', (req, res) => {
  const loan = queryOne('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  runSql("UPDATE loans SET status = 'rejected', reviewed_by = ?, updated_at = datetime('now') WHERE id = ?",
    [req.user?.id || 'system', req.params.id]);

  res.json({ success: true, message: `Loan ${req.params.id} rejected` });
});

module.exports = router;
