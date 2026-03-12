const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { analyzeRisk } = require('../engine/riskEngine');
const { makeDecision } = require('../engine/policyEngine');

router.post('/', (req, res) => {
  const activity = req.body;
  if (!activity.user_id || !activity.action) {
    return res.status(400).json({ error: 'user_id and action are required' });
  }

  const riskResult = analyzeRisk(activity);
  const policyResult = makeDecision(riskResult.score, riskResult.factors);

  const insertResult = runSql(
    "INSERT INTO activities (user_id, username, role, action, amount, timestamp, hour, device, ip_address, details, metadata, risk_score, decision, reason, factors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [activity.user_id, activity.username || '', activity.role || '', activity.action, activity.amount || 0,
     activity.timestamp || new Date().toISOString(), activity.hour != null ? activity.hour : new Date().getHours(),
     activity.device || '', activity.ip_address || '', activity.details || '',
     JSON.stringify(activity.metadata || {}), riskResult.score, policyResult.decision,
     policyResult.reason, JSON.stringify(riskResult.factors)]
  );

  if (policyResult.decision === 'BLOCK' || policyResult.decision === 'REQUIRE_MFA') {
    runSql(
      "INSERT INTO incidents (activity_id, user_id, role, action, amount, risk_score, decision, reason, factors, status) VALUES (?,?,?,?,?,?,?,?,?,'open')",
      [insertResult.lastInsertRowid, activity.user_id, activity.role || '', activity.action,
       activity.amount || 0, riskResult.score, policyResult.decision, policyResult.reason,
       JSON.stringify(riskResult.factors)]
    );
  }

  runSql("INSERT INTO audit_log (event_type, details, performed_by) VALUES ('risk_analysis', ?, 'system')",
    [JSON.stringify({ user_id: activity.user_id, action: activity.action, risk_score: riskResult.score, decision: policyResult.decision })]);

  res.json({ risk_score: riskResult.score, decision: policyResult.decision, reason: policyResult.reason, factors: riskResult.factors });
});

module.exports = router;
