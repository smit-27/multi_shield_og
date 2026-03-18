const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { analyzeRiskWithML } = require('../engine/riskEngine');
const { makeDecision } = require('../engine/policyEngine');
const crypto = require('crypto');

router.post('/', async (req, res) => {
  const activity = req.body;
  if (!activity.user_id || !activity.action) {
    return res.status(400).json({ error: 'user_id and action are required' });
  }

  // ML-enhanced risk analysis (async — calls Python microservice)
  const riskResult = await analyzeRiskWithML(activity);
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

  // Build response with ML explanation
  const response = {
    risk_score: riskResult.score,
    decision: policyResult.decision,
    reason: policyResult.reason,
    factors: riskResult.factors,
    ml_score: riskResult.ml_score,
    ml_explanation: riskResult.ml_explanation,
    rule_score: riskResult.rule_score,
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
    const mlExplanationMsg = riskResult.ml_explanation?.length > 0
      ? `Action blocked due to: ${riskResult.ml_explanation.join(', ')}`
      : '';
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const approvalResult = runSql(
      "INSERT INTO approval_requests (incident_id, user_id, username, role, action, amount, risk_score, status, expires_at, user_message) VALUES (?,?,?,?,?,?,?,'pending',?,?)",
      [incidentId, activity.user_id, activity.username || '', activity.role || '',
       activity.action, activity.amount || 0, riskResult.score, expiresAt, mlExplanationMsg]
    );
    response.request_id = approvalResult.lastInsertRowid;
  }

  runSql("INSERT INTO audit_log (event_type, details, performed_by) VALUES ('risk_analysis', ?, 'system')",
    [JSON.stringify({ user_id: activity.user_id, action: activity.action, risk_score: riskResult.score, decision: policyResult.decision, ml_score: riskResult.ml_score, ml_explanation: riskResult.ml_explanation })]);

  res.json(response);
});

module.exports = router;
