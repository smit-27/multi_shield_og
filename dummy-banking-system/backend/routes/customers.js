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
  query += ' ORDER BY full_name';
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

// GET /api/customers/:id/details
router.get('/:id/details', (req, res) => {
  const customerId = req.params.id;
  const customer = queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  let accounts = queryAll(`
    SELECT a.* FROM accounts a 
    JOIN customer_accounts ca ON a.id = ca.account_id 
    WHERE ca.customer_id = ?
  `, [customerId]);

  if (accounts.length === 0) {
    // Dynamically create an account
    const newAccId = `ACC-${customerId}`;
    runSql("INSERT OR IGNORE INTO accounts (id, account_name, account_type, balance, currency, status) VALUES (?, ?, ?, ?, 'INR', 'active')", 
      [newAccId, customer.full_name + ' Account', customer.account_type || 'savings', customer.balance || 100000]);
    runSql("INSERT OR IGNORE INTO customer_accounts (customer_id, account_id) VALUES (?, ?)", [customerId, newAccId]);
    
    accounts = queryAll(`
      SELECT a.* FROM accounts a 
      JOIN customer_accounts ca ON a.id = ca.account_id 
      WHERE ca.customer_id = ?
    `, [customerId]);
  }

  let cards = queryAll('SELECT * FROM cards WHERE customer_id = ?', [customerId]);

  if (cards.length === 0) {
    // Dynamically create a card
    const newCardId = `CRD-${customerId}`;
    runSql("INSERT OR IGNORE INTO cards (id, customer_id, account_id, card_number, type, issue_address, status) VALUES (?, ?, ?, ?, 'Debit', ?, 'active')",
      [newCardId, customerId, accounts[0].id, `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`, customer.address || 'Registered Address']);
    
    cards = queryAll('SELECT * FROM cards WHERE customer_id = ?', [customerId]);
  }

  // Generate mock interactions
  const interactions = [
    { date: '2023-10-12 18:20', duration: '3:37', source: 'Phone', reason: 'Chequebook Requested' },
    { date: '2023-10-10 10:30', duration: '10:30', source: 'Phone', reason: 'Phone Number Update' },
    { date: '2023-10-05 14:40', duration: '6:40', source: 'Branch', reason: 'Balance Enquiry' },
    { date: '2023-09-28 09:52', duration: '9:52', source: 'Phone', reason: 'A/C Transaction Dispute' }
  ];

  // Generate mock expenses
  const expenses = {
    labels: ['Home & Utilities', 'Insurance', 'Savings', 'Groceries'],
    values: [40, 20, 25, 15]
  };

  res.json({ customer, accounts, cards, interactions, expenses });
});

// PUT /api/customers/:id/contact (Account Takeover Fraud Vector)
router.put('/:id/contact', createSecurityCheck('modify_contact'), (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.status(400).json({ error: 'Email and phone are required' });

  runSql('UPDATE customers SET email = ?, phone = ? WHERE id = ?', [email, phone, req.params.id]);
  runSql("INSERT INTO activity_logs (user_id, action, details, device, created_at) VALUES (?, 'modify_contact', ?, 'internal workstation', datetime('now'))",
    [req.user.id, JSON.stringify({ customer_id: req.params.id, email, phone })]);

  res.json({ success: true, message: 'Contact details updated successfully', security: req.securityResult });
});

// POST /api/customers/:id/cards/replace (Physical Fraud Vector)
router.post('/:id/cards/replace', createSecurityCheck('issue_card'), (req, res) => {
  const { card_id, new_address } = req.body;
  if (!card_id || !new_address) return res.status(400).json({ error: 'card_id and new_address are required' });

  runSql('UPDATE cards SET issue_address = ? WHERE id = ? AND customer_id = ?', [new_address, card_id, req.params.id]);
  runSql("INSERT INTO activity_logs (user_id, action, details, device, created_at) VALUES (?, 'issue_card', ?, 'internal workstation', datetime('now'))",
    [req.user.id, JSON.stringify({ customer_id: req.params.id, card_id, new_address })]);

  res.json({ success: true, message: 'Replacement card issued to new address', security: req.securityResult });
});

module.exports = router;
