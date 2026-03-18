const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { logAuditEvent } = require('../security/auditLogger');

router.get('/', (req, res) => {
  const { status, limit = 50 } = req.query;
  let query = 'SELECT * FROM incidents WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const incidents = queryAll(query, params);
  incidents.forEach(i => { try { i.factors = JSON.parse(i.factors); } catch { i.factors = []; } });
  res.json({ incidents });
});

router.get('/stats', (req, res) => {
  res.json({
    total: queryOne('SELECT COUNT(*) as count FROM incidents')?.count || 0,
    open: queryOne("SELECT COUNT(*) as count FROM incidents WHERE status = 'open'")?.count || 0,
    resolved: queryOne("SELECT COUNT(*) as count FROM incidents WHERE status = 'resolved'")?.count || 0,
    blocked: queryOne("SELECT COUNT(*) as count FROM incidents WHERE decision = 'BLOCK'")?.count || 0,
    mfa: queryOne("SELECT COUNT(*) as count FROM incidents WHERE decision = 'REQUIRE_MFA'")?.count || 0,
    avgRisk: Math.round(queryOne('SELECT COALESCE(AVG(risk_score), 0) as avg FROM incidents')?.avg || 0)
  });
});

router.get('/:id', (req, res) => {
  const incident = queryOne('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
  if (!incident) return res.status(404).json({ error: 'Not found' });
  try { incident.factors = JSON.parse(incident.factors); } catch { incident.factors = []; }
  res.json({ incident });
});

router.post('/:id/resolve', (req, res) => {
  const { resolution, resolved_by = 'admin' } = req.body;
  if (!queryOne('SELECT * FROM incidents WHERE id = ?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  runSql("UPDATE incidents SET status='resolved',resolution=?,resolved_by=?,resolved_at=datetime('now') WHERE id=?",
    [resolution || 'Resolved by admin', resolved_by, req.params.id]);
  logAuditEvent('incident_resolved',
    { incident_id: req.params.id, resolution },
    resolved_by);
  res.json({ success: true });
});

router.post('/:id/approve', (req, res) => {
  const { approved_by = 'admin' } = req.body;
  if (!queryOne('SELECT * FROM incidents WHERE id = ?', [req.params.id])) return res.status(404).json({ error: 'Not found' });
  runSql("UPDATE incidents SET status='approved',resolution='Approved by admin override',resolved_by=?,resolved_at=datetime('now') WHERE id=?",
    [approved_by, req.params.id]);
  logAuditEvent('incident_approved',
    { incident_id: req.params.id },
    approved_by);
  res.json({ success: true, message: 'Action approved' });
});

module.exports = router;
