const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../db');

router.get('/', (req, res) => {
  const { limit = 100, user_id, action, decision, since } = req.query;
  let query = 'SELECT * FROM activities WHERE 1=1';
  const params = [];
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (action) { query += ' AND action = ?'; params.push(action); }
  if (decision) { query += ' AND decision = ?'; params.push(decision); }
  if (since) { query += ' AND created_at > ?'; params.push(since); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const activities = queryAll(query, params);
  activities.forEach(a => {
    try { a.factors = JSON.parse(a.factors); } catch { a.factors = []; }
    try { a.metadata = JSON.parse(a.metadata); } catch { a.metadata = {}; }
  });
  res.json({ activities });
});

router.get('/stats', (req, res) => {
  res.json({
    total: queryOne('SELECT COUNT(*) as count FROM activities')?.count || 0,
    allowed: queryOne("SELECT COUNT(*) as count FROM activities WHERE decision = 'ALLOW'")?.count || 0,
    mfa: queryOne("SELECT COUNT(*) as count FROM activities WHERE decision = 'REQUIRE_MFA'")?.count || 0,
    blocked: queryOne("SELECT COUNT(*) as count FROM activities WHERE decision = 'BLOCK'")?.count || 0,
    avgRisk: Math.round(queryOne('SELECT COALESCE(AVG(risk_score), 0) as avg FROM activities')?.avg || 0),
    byHour: queryAll('SELECT hour, COUNT(*) as count, AVG(risk_score) as avg_risk FROM activities GROUP BY hour ORDER BY hour'),
    byAction: queryAll('SELECT action, COUNT(*) as count, AVG(risk_score) as avg_risk FROM activities GROUP BY action ORDER BY count DESC')
  });
});

module.exports = router;
