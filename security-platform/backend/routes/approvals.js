/**
 * Approval Request Routes — admin approval workflow for Tier 4 (high-risk) actions
 */
const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');

// GET /api/approvals — List all approval requests
router.get('/', (req, res) => {
  const { status, limit = 50 } = req.query;
  let query = 'SELECT * FROM approval_requests WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json({ approvals: queryAll(query, params) });
});

// GET /api/approvals/stats — Approval stats
router.get('/stats', (req, res) => {
  res.json({
    total: queryOne('SELECT COUNT(*) as count FROM approval_requests')?.count || 0,
    pending: queryOne("SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'")?.count || 0,
    approved: queryOne("SELECT COUNT(*) as count FROM approval_requests WHERE status = 'approved'")?.count || 0,
    denied: queryOne("SELECT COUNT(*) as count FROM approval_requests WHERE status = 'denied'")?.count || 0
  });
});

// GET /api/approvals/check/:id — Banking system polls this to check status
router.get('/check/:id', (req, res) => {
  const request = queryOne('SELECT id, status, admin_response, resolved_by, resolved_at FROM approval_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Approval request not found' });
  res.json(request);
});

// GET /api/approvals/:id — Get single approval detail
router.get('/:id', (req, res) => {
  const request = queryOne('SELECT * FROM approval_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Approval request not found' });
  res.json({ approval: request });
});

// POST /api/approvals/:id/message — Banking user sends a message/justification
router.post('/:id/message', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  
  const request = queryOne('SELECT * FROM approval_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Approval request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request is no longer pending' });

  // Append message (or overwrite if first message)
  const existingMsg = request.user_message || '';
  const fullMessage = existingMsg ? `${existingMsg}\n---\n${message}` : message;
  
  runSql("UPDATE approval_requests SET user_message=? WHERE id=?", [fullMessage, req.params.id]);
  
  runSql("INSERT INTO audit_log (event_type, details, performed_by) VALUES ('approval_message', ?, ?)",
    [JSON.stringify({ request_id: req.params.id, message }), request.user_id]);

  res.json({ success: true, message: 'Message sent to admin' });
});

// POST /api/approvals/:id/decide — Admin approves or denies
router.post('/:id/decide', (req, res) => {
  const { decision, response: adminResponse } = req.body;
  if (!decision || !['approved', 'denied'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be "approved" or "denied"' });
  }

  const request = queryOne('SELECT * FROM approval_requests WHERE id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ error: 'Approval request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request already resolved' });

  runSql(
    "UPDATE approval_requests SET status=?, admin_response=?, resolved_by='admin', resolved_at=datetime('now') WHERE id=?",
    [decision, adminResponse || `Action ${decision} by admin`, req.params.id]
  );

  // Update linked incident
  if (request.incident_id) {
    const incidentStatus = decision === 'approved' ? 'approved' : 'resolved';
    const incidentResolution = decision === 'approved'
      ? 'Approved by admin override'
      : `Denied by admin: ${adminResponse || 'No reason provided'}`;
    runSql("UPDATE incidents SET status=?, resolution=?, resolved_by='admin', resolved_at=datetime('now') WHERE id=?",
      [incidentStatus, incidentResolution, request.incident_id]);
  }

  runSql("INSERT INTO audit_log (event_type, details, performed_by) VALUES ('approval_decision', ?, 'admin')",
    [JSON.stringify({ request_id: req.params.id, decision, response: adminResponse })]);

  res.json({ success: true, message: `Request ${decision}` });
});

module.exports = router;
