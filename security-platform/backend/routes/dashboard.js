const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../db');
const { verifyJwt } = require('../middleware/keycloak');

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const highRiskEvents = queryOne("SELECT COUNT(*) as count FROM activities WHERE risk_score >= 80 OR decision = 'BLOCKED'")?.count || 0;
  const activeSessions = queryOne("SELECT COUNT(*) as count FROM zta_sessions WHERE expires_at > datetime('now')")?.count || 0;
  const eventsToday = queryOne("SELECT COUNT(*) as count FROM activities WHERE date(created_at) = date('now')")?.count || 0;
  
  res.json({
    highRiskEvents,
    activeSessions,
    eventsToday
  });
});

// GET /api/dashboard/activity
router.get('/activity', (req, res) => {
  const { sortBy = 'timestamp', user, riskLevel } = req.query;
  
  let sql = "SELECT * FROM activities WHERE 1=1";
  const params = [];
  
  if (user) {
    sql += " AND username = ?";
    params.push(user);
  }
  
  if (riskLevel) {
    const levels = riskLevel.split(',').map(l => l.trim().toLowerCase());
    const conditions = [];
    if (levels.includes('high')) conditions.push("risk_score >= 80");
    if (levels.includes('medium')) conditions.push("(risk_score >= 40 AND risk_score < 80)");
    if (levels.includes('low')) conditions.push("risk_score < 40");
    
    if (conditions.length > 0) {
      sql += ` AND (${conditions.join(' OR ')})`;
    }
  }
  
  const sortDirection = sortBy === 'riskScore' ? 'risk_score DESC' : 'timestamp DESC';
  sql += ` ORDER BY ${sortDirection} LIMIT 50`;

  const results = queryAll(sql, params);
  
  const feed = results.map(row => {
    let meta = {};
    try { meta = JSON.parse(row.metadata || '{}'); } catch(e){}
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username || row.user_id,
      action: row.action,
      riskLevel: row.risk_score >= 80 ? 'high' : row.risk_score >= 40 ? 'medium' : 'low',
      riskScore: row.risk_score || 0,
      timestamp: row.timestamp || row.created_at,
      ipAddress: row.ip_address,
      details: row.details,
      structuringFlag: meta.structuringFlag || false,
      structuringDelta: meta.structuringDelta || 0,
      mlScore: meta.mlScore || 0
    };
  });
  
  res.json(feed);
});

// GET /api/dashboard/threats
router.get('/threats', (req, res) => {
  const sql = "SELECT action as category, COUNT(*) as count FROM activities GROUP BY action ORDER BY count DESC LIMIT 5";
  const results = queryAll(sql);
  
  const structCount = queryOne("SELECT COUNT(*) as count FROM transactions WHERE structuringFlag = 1")?.count || 0;
  if (structCount > 0) {
    results.push({ category: 'Structuring / Repetitive Txn', count: structCount });
  }

  results.sort((a, b) => b.count - a.count);
  const top = results.slice(0, 5);

  const max = top.length > 0 ? Math.max(...top.map(r => r.count)) : 100;
  
  const threats = top.map(row => ({
    category: row.category,
    count: row.count,
    max: max > 0 ? max : 100
  }));
  
  res.json(threats);
});

module.exports = router;
