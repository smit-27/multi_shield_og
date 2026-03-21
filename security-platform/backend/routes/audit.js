/**
 * Blockchain Audit API Routes
 * 
 * POST /api/audit/log           — Create a manual audit log entry (blockchain-anchored)
 * GET  /api/audit/verify/:logId — Verify a log's integrity against blockchain
 * GET  /api/audit/logs          — List recent audit logs with blockchain status
 * GET  /api/audit/status        — Get blockchain connection status
 */
const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../db');
const { logAuditEvent, verifyAuditLog } = require('../security/auditLogger');
const { getBlockchainStatus } = require('../security/blockchainClient');

/**
 * POST /api/audit/log — Create a new audit log entry
 * Body: { event_type, details, performed_by }
 */
router.post('/log', (req, res) => {
  const { event_type, details, performed_by } = req.body;

  if (!event_type) {
    return res.status(400).json({ error: 'event_type is required' });
  }

  const result = logAuditEvent(
    event_type,
    details || {},
    performed_by || 'api'
  );

  res.json({
    success: true,
    log_id: result.logId,
    sha256_hash: result.hash,
    message: 'Audit log created. Blockchain anchoring in progress (async).'
  });
});

/**
 * GET /api/audit/verify/:logId — Verify a log's integrity
 * Returns local + blockchain verification results
 */
router.get('/verify/:logId', async (req, res) => {
  const logId = parseInt(req.params.logId);
  if (isNaN(logId)) {
    return res.status(400).json({ error: 'Invalid log ID' });
  }

  try {
    const result = await verifyAuditLog(logId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Verification failed', message: err.message });
  }
});

/**
 * GET /api/audit/logs — List recent audit logs with blockchain status
 * Query: ?limit=50&event_type=risk_analysis
 */
router.get('/logs', (req, res) => {
  const { limit = 50, event_type } = req.query;
  let query = 'SELECT id, event_type, details, performed_by, sha256_hash, blockchain_tx_hash, created_at FROM audit_log WHERE 1=1';
  const params = [];

  if (event_type) {
    query += ' AND event_type = ?';
    params.push(event_type);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const logs = queryAll(query, params);

  // Parse details JSON and add blockchain status
  logs.forEach(log => {
    try { log.details = JSON.parse(log.details); } catch { /* keep as string */ }
    log.blockchain_status = log.blockchain_tx_hash ? 'ANCHORED' : (log.sha256_hash ? 'PENDING' : 'NO_HASH');
  });

  res.json({
    total: logs.length,
    logs
  });
});

/**
 * GET /api/audit/status — Get blockchain connection info
 */
router.get('/status', (req, res) => {
  res.json({
    blockchain: getBlockchainStatus(),
    audit_log_count: queryOne('SELECT COUNT(*) as count FROM audit_log')?.count || 0,
    anchored_count: queryOne("SELECT COUNT(*) as count FROM audit_log WHERE blockchain_tx_hash IS NOT NULL")?.count || 0
  });
});

module.exports = router;
