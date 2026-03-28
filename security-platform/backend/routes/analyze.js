const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db');
const { analyzeTransactionRisk, detectStructuringPattern } = require('../engine/transactionRiskEngine');
const { analyzeLoginBehaviorRisk } = require('../engine/riskEngine');
const { makeDecision } = require('../engine/policyEngine');
const { logAuditEvent } = require('../security/auditLogger');
const crypto = require('crypto');

router.post('/', async (req, res) => {
  const activity = req.body;
  if (!activity.user_id || !activity.action) {
    return res.status(400).json({ error: 'user_id and action are required' });
  }

  // ─── Run both risk engines independently ───
  // 1. Transaction Risk (hardcoded rules)
  const txnResult = analyzeTransactionRisk(activity);

  // 2. Login Behavior Risk (ML-based)
  let loginResult;
  try {
    loginResult = await analyzeLoginBehaviorRisk(activity);
  } catch (err) {
    console.warn('[Analyze] ML login behavior analysis failed, using neutral fallback:', err.message);
    loginResult = { score: 50, factors: [{ factor: 'ML Login Behavior (Fallback)', detail: 'ML service unavailable — using neutral score', score: 50, maxScore: 100 }], ml_score: 50, ml_explanation: ['fallback'] };
  }

  // 3. Blend scores: 50% Transaction + 50% Login Behavior
  let blendedScore = Math.min(100, txnResult.score);
  blendedScore = Math.max(blendedScore, loginResult.score % 101);
  const allFactors = [...txnResult.factors, ...loginResult.factors];

  // 4. Structuring / Repetitive Transaction Detection
  let structuringFlag = loginResult.structuringFlag || false;
  let structuringDelta = loginResult.structuringDelta || 0;
  let blockFlag = loginResult.blockFlag || false;
  let matchCount = loginResult.matchCount || 0;
  let patternType = loginResult.patternType || null;

  // Also run structuring detection directly for the analyze path
  if (activity.amount > 0) {
    try {
      const structResult = await detectStructuringPattern(activity.user_id, activity.amount, activity.destinationAccount || activity.metadata?.account_id);
      if (structResult.matchCount > matchCount) {
        matchCount = structResult.matchCount;
        patternType = structResult.patternType;
        if (matchCount === 1) { structuringDelta = Math.max(structuringDelta, 25); structuringFlag = true; }
        else if (matchCount === 2) { structuringDelta = Math.max(structuringDelta, 40); structuringFlag = true; }
        else if (matchCount >= 3) { structuringDelta = 100 - blendedScore; structuringFlag = true; blockFlag = true; }

        blendedScore = Math.min(100, blendedScore + structuringDelta);
        if (blockFlag) blendedScore = 100;

        if (structuringFlag) {
          allFactors.push({
            factor: 'Structuring / Repetitive Pattern Detected',
            detail: `${matchCount} identical transaction(s) found in trailing 24h. Delta applied: +${structuringDelta}.`,
            score: structuringDelta,
            maxScore: 100
          });
        }
      }
    } catch (err) {
      console.error('[Analyze] Structuring detection failed:', err);
    }
  }

  const policyResult = makeDecision(blendedScore, allFactors, {
    blockFlag,
    structuringFlag,
    matchCount
  });

  const insertResult = runSql(
    "INSERT INTO activities (user_id, username, role, action, amount, timestamp, hour, device, ip_address, details, metadata, risk_score, decision, reason, factors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [activity.user_id, activity.username || '', activity.role || '', activity.action, activity.amount || 0,
    activity.timestamp || new Date().toISOString(), activity.hour != null ? activity.hour : new Date().getHours(),
    activity.device || '', activity.ip_address || '', activity.details || '',
    JSON.stringify(activity.metadata || {}), blendedScore, policyResult.decision,
    policyResult.reason, JSON.stringify(allFactors)]
  );

  // Log to transactions table so structuring detection accumulates
  if (activity.amount > 0) {
    runSql(
      "INSERT INTO transactions (userId, type, amount, destinationAccount, status, mlScore, structuringDelta, finalRiskScore, structuringFlag, matchCount, patternType) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [activity.user_id, activity.action === 'withdraw' ? 'withdrawal' : 'transfer', activity.amount,
       activity.destinationAccount || activity.metadata?.account_id || null,
       blockFlag ? 'rejected' : (matchCount === 2 ? 'flagged' : 'completed'),
       loginResult.ml_score || 0, structuringDelta, blendedScore,
       structuringFlag ? 1 : 0, matchCount, patternType]
    );
  }

  // Create structuring-specific incidents & suspension
  if (blockFlag) {
    runSql("INSERT INTO account_locks (user_id, reason, expires_at) VALUES (?, ?, datetime('now', '+100 minutes'))",
      [activity.user_id, 'Repetitive transaction structuring detected']);
  }

  // Create incident for non-ALLOW decisions
  let incidentId = null;
  if (policyResult.decision !== 'ALLOW') {
    const incResult = runSql(
      "INSERT INTO incidents (activity_id, user_id, role, action, amount, risk_score, decision, reason, factors, status) VALUES (?,?,?,?,?,?,?,?,?,'open')",
      [insertResult.lastInsertRowid, activity.user_id, activity.role || '', activity.action,
      activity.amount || 0, blendedScore, policyResult.decision, policyResult.reason,
      JSON.stringify(allFactors)]
    );
    incidentId = incResult.lastInsertRowid;
  }

  // Build response with separate scores
  const response = {
    risk_score: blendedScore,
    transaction_score: txnResult.score,
    login_behavior_score: loginResult.score,
    decision: policyResult.decision,
    reason: policyResult.reason,
    factors: allFactors,
    ml_score: loginResult.ml_score,
    ml_explanation: loginResult.ml_explanation,
  };

  // Tier 3: Create MFA challenge
  if (policyResult.decision === 'REQUIRE_MFA') {
    const challengeId = `MFA-${crypto.randomBytes(8).toString('hex')}`;
    const otpCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    runSql(
      "INSERT INTO mfa_challenges (id, incident_id, user_id, username, role, action, amount, risk_score, status, step, otp_code) VALUES (?,?,?,?,?,?,?,?,'pending',0,?)",
      [challengeId, incidentId, activity.user_id, activity.username || '', activity.role || '',
        activity.action, activity.amount || 0, blendedScore, otpCode]
    );
    response.challenge_id = challengeId;
  }

  // Tier 4: Create approval request
  if (policyResult.decision === 'ADMIN_APPROVAL') {
    const mlExplanationMsg = loginResult.ml_explanation?.length > 0
      ? `Action blocked due to: ${loginResult.ml_explanation.join(', ')}`
      : '';
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const approvalResult = runSql(
      "INSERT INTO approval_requests (incident_id, user_id, username, role, action, amount, risk_score, status, expires_at, user_message) VALUES (?,?,?,?,?,?,?,'pending',?,?)",
      [incidentId, activity.user_id, activity.username || '', activity.role || '',
        activity.action, activity.amount || 0, blendedScore, expiresAt, mlExplanationMsg]
    );
    response.request_id = approvalResult.lastInsertRowid;
  }

  // DENY decision: create approval request so admin can see it on dashboard
  if (policyResult.decision === 'DENY') {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const approvalResult = runSql(
      "INSERT INTO approval_requests (incident_id, user_id, username, role, action, amount, risk_score, status, expires_at, user_message) VALUES (?,?,?,?,?,?,?,'pending',?,?)",
      [incidentId, activity.user_id, activity.username || '', activity.role || '',
        activity.action, activity.amount || 0, blendedScore, expiresAt, 'Account suspended: repetitive transaction structuring detected']
    );
    response.request_id = approvalResult.lastInsertRowid;
    response.admin_approval_required = true;
  }

  // Integrate blockchain auditing
  logAuditEvent('risk_analysis', 
    { 
      user_id: activity.user_id, 
      action: activity.action, 
      risk_score: blendedScore, 
      transaction_score: txnResult.score, 
      login_behavior_score: loginResult.score, 
      decision: policyResult.decision, 
      ml_score: loginResult.ml_score 
    }, 
    'system'
  );

  res.json(response);
});

module.exports = router;
