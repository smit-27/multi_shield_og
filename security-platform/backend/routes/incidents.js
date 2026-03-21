const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { logAuditEvent } = require('../security/auditLogger');

router.get('/', (req, res) => {
  const { status, limit = 50 } = req.query;
  
  let query = `
    SELECT 
      i.*,
      a.status as approval_status,
      a.user_message as approvalReason,
      a.id as approval_request_id
    FROM incidents i
    LEFT JOIN approval_requests a ON i.id = a.incident_id
    ORDER BY i.created_at DESC
  `;
  
  const rawIncidents = queryAll(query);
  
  let incidents = rawIncidents.map(row => {
    let unifiedStatus = row.status; // defaults to 'open' or 'resolved'
    if (row.approval_status === 'pending') unifiedStatus = 'pending_approval';
    else if (row.approval_status === 'approved') unifiedStatus = 'approved';
    else if (row.approval_status === 'denied') unifiedStatus = 'rejected';

    let factors = [];
    try { factors = JSON.parse(row.factors); } catch { factors = []; }

    return {
      id: row.id,
      title: `${row.action} Flagged (${row.decision})`,
      description: row.reason || `Risk score of ${row.risk_score} triggered policy check.`,
      severity: row.risk_score >= 80 ? 'high' : row.risk_score >= 40 ? 'medium' : 'low',
      status: unifiedStatus,
      requestedBy: row.user_id,
      assignedTo: 'Admin Team',
      createdAt: row.created_at,
      updatedAt: row.resolved_at || row.created_at,
      approvalReason: row.approvalReason || null,
      requestedAction: row.action,
      riskScore: row.risk_score,
      factors: factors
    };
  });

  if (status) {
    incidents = incidents.filter(i => i.status === status);
  }
  
  res.json({ incidents: incidents.slice(0, parseInt(limit)) });
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
  runSql("UPDATE approval_requests SET status='approved',admin_response='Approved by admin override',resolved_by=?,resolved_at=datetime('now') WHERE incident_id=?", 
    [approved_by, req.params.id]);
  logAuditEvent('incident_approved',
    { incident_id: req.params.id },
    approved_by);
  res.json({ success: true, message: 'Action approved' });
});

router.post('/:id/reject', (req, res) => {
  const { rejected_by = 'admin', reason = 'Rejected by admin' } = req.body;
  const incident = queryOne('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
  if (!incident) return res.status(404).json({ error: 'Not found' });
  
  runSql("UPDATE incidents SET status='rejected',resolution=?,resolved_by=?,resolved_at=datetime('now') WHERE id=?", [reason, rejected_by, req.params.id]);
  runSql("UPDATE approval_requests SET status='denied',admin_response=?,resolved_by=?,resolved_at=datetime('now') WHERE incident_id=?", [reason, rejected_by, req.params.id]);
  runSql("INSERT INTO audit_log (event_type,details,performed_by) VALUES ('incident_rejected',?,?)", [JSON.stringify({ incident_id: req.params.id }), rejected_by]);
  
  res.json({ success: true, message: 'Action rejected' });
});

module.exports = router;
