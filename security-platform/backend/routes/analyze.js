const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { analyzeRisk } = require('../engine/riskEngine');
const { makeDecision } = require('../engine/policyEngine');
const { logAuditEvent } = require('../security/auditLogger');
const crypto = require('crypto');

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

  // Create incident for non-ALLOW decisions
  let incidentId = null;
  if (policyResult.decision !== 'ALLOW') {
    const incResult = runSql(
      "INSERT INTO incidents (activity_id, user_id, role, action, amount, risk_score, decision, reason, factors, status) VALUES (?,?,?,?,?,?,?,?,?,'open')",
      [insertResult.lastInsertRowid, activity.user_id, activity.role || '', activity.action,
       activity.amount || 0, riskResult.score, policyResult.decision, policyResult.reason,
       JSON.stringify(riskResult.factors)]
    );
    incidentId = incResult.lastInsertRowid;
  }

  // Build response
  const response = {
    risk_score: riskResult.score,
    decision: policyResult.decision,
    reason: policyResult.reason,
    factors: riskResult.factors
  };

  // Tier 3: Create MFA challenge
  if (policyResult.decision === 'REQUIRE_MFA') {
    const challengeId = `MFA-${crypto.randomBytes(8).toString('hex')}`;
    const otpCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    runSql(
      "INSERT INTO mfa_challenges (id, incident_id, user_id, username, role, action, amount, risk_score, status, step, otp_code) VALUES (?,?,?,?,?,?,?,?,'pending',0,?)",
      [challengeId, incidentId, activity.user_id, activity.username || '', activity.role || '',
       activity.action, activity.amount || 0, riskResult.score, otpCode]
    );
    response.challenge_id = challengeId;
  }

  // Tier 4: Create approval request
  if (policyResult.decision === 'ADMIN_APPROVAL') {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const approvalResult = runSql(
      "INSERT INTO approval_requests (incident_id, user_id, username, role, action, amount, risk_score, status, expires_at) VALUES (?,?,?,?,?,?,?,'pending',?)",
      [incidentId, activity.user_id, activity.username || '', activity.role || '',
       activity.action, activity.amount || 0, riskResult.score, expiresAt]
    );
    response.request_id = approvalResult.lastInsertRowid;
  }

  logAuditEvent('risk_analysis',
    { user_id: activity.user_id, action: activity.action, risk_score: riskResult.score, decision: policyResult.decision },
    'system');

  res.json(response);
});

module.exports = router;
