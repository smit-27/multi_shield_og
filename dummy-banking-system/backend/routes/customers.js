const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { createSecurityCheck } = require('../middleware/securityCheck');

// GET /api/customers
router.get('/', (req, res) => {
  const { search, risk_category } = req.query;
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (full_name LIKE ? OR email LIKE ? OR pan LIKE ? OR phone LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (risk_category) { query += ' AND risk_category = ?'; params.push(risk_category); }
  query += ' ORDER BY id ASC';
  res.json({ customers: queryAll(query, params) });
});

// GET /api/customers/stats
router.get('/stats', (req, res) => {
  const total = queryOne('SELECT COUNT(*) as count FROM customers')?.count || 0;
  const active = queryOne("SELECT COUNT(*) as count FROM customers WHERE status = 'active'")?.count || 0;
  const highRisk = queryOne("SELECT COUNT(*) as count FROM customers WHERE risk_category = 'high'")?.count || 0;
  const totalBalance = queryOne('SELECT COALESCE(SUM(balance), 0) as total FROM customers')?.total || 0;
  res.json({ total, active, highRisk, totalBalance });
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  const customer = queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer });
});

// POST /api/customers/export
router.post('/export', createSecurityCheck('bulk_data_export'), (req, res) => {
  const { format = 'json', filters = {} } = req.body;
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];
  if (filters.risk_category) { query += ' AND risk_category = ?'; params.push(filters.risk_category); }
  const customers = queryAll(query, params);

  runSql("INSERT INTO activity_logs (user_id, action, details, device, created_at) VALUES (?, 'bulk_data_export', ?, 'internal workstation', datetime('now'))",
    [req.user.id, JSON.stringify({ record_count: customers.length, format })]);

  res.json({ success: true, format, record_count: customers.length, data: customers, security: req.securityResult });
});

// GET /api/customers/:id/activity
router.get('/:id/activity', (req, res) => {
  const activities = queryAll('SELECT * FROM activity_logs WHERE details LIKE ? ORDER BY created_at DESC LIMIT 50', [`%${req.params.id}%`]);
  res.json({ activities });
});

module.exports = router;
