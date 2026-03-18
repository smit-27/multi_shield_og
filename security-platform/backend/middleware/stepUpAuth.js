/**
 * Step-Up Authentication Middleware
 * 
 * For high-risk operations, enforces additional verification:
 *   Step 1: User ID verification
 *   Step 2: Password verification
 *   Step 3: Face authentication
 * 
 * If face authentication fails → account locked for 30 minutes.
 * Uses the existing mfa_challenges table schema (does NOT modify mfa.js).
 */
const crypto = require('crypto');
const { queryOne, runSql } = require('../db');
const { logToDashboard } = require('./dashboardLogger');

// Step-up challenge status constants
const STEP_UP_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

/**
 * Create a new step-up authentication challenge
 */
function createStepUpChallenge(userId, username, role, action, amount, riskScore) {
  const challengeId = `STEPUP-${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  runSql(
    `INSERT INTO zta_step_up_challenges 
     (id, user_id, username, role, action, amount, risk_score, status, current_step, attempts, created_at, expires_at) 
     VALUES (?,?,?,?,?,?,?,'pending',0,0,?,?)`,
    [challengeId, userId, username, role, action, amount || 0, riskScore, now, expires]
  );

  return challengeId;
}

/**
 * Get a step-up challenge by ID
 */
function getStepUpChallenge(challengeId) {
  return queryOne('SELECT * FROM zta_step_up_challenges WHERE id = ?', [challengeId]);
}

/**
 * Verify a step in the step-up authentication flow
 * 
 * Steps: 0=user_id, 1=password, 2=face
 */
function verifyStepUpStep(challengeId, step, value) {
  const challenge = getStepUpChallenge(challengeId);
  if (!challenge) return { success: false, error: 'Challenge not found' };
  if (challenge.status === 'completed') return { success: true, status: 'completed', message: 'Already verified' };
  if (challenge.status === 'failed') return { success: false, error: 'Challenge failed. Account may be locked.' };

  // Check expiry
  if (new Date(challenge.expires_at) < new Date()) {
    runSql("UPDATE zta_step_up_challenges SET status='failed' WHERE id=?", [challengeId]);
    return { success: false, error: 'Challenge expired. Please initiate a new step-up authentication.' };
  }

  if (challenge.current_step !== step) {
    return { success: false, error: `Expected step ${challenge.current_step}, got step ${step}` };
  }

  let verified = false;

  switch (step) {
    case 0: // User ID verification
      verified = value && value === challenge.user_id;
      break;

    case 1: // Password verification — same mock logic as existing MFA
      verified = value === 'pass123' || value === 'mfa_verify';
      break;

    case 2: // Face authentication
      verified = value === 'face_verified';

      if (!verified) {
        // Face auth failed → lock account for 30 minutes
        const newAttempts = challenge.attempts + 1;
        runSql("UPDATE zta_step_up_challenges SET status='failed', attempts=? WHERE id=?", [newAttempts, challengeId]);

        // Create account lock
        const lockExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        runSql(
          "INSERT INTO account_locks (user_id, reason, locked_at, expires_at, resolved) VALUES (?,?,datetime('now'),?,0)",
          [challenge.user_id, 'Face authentication failed during step-up verification', lockExpiry]
        );

        // Log the lockout to the DB
        runSql(
          "INSERT INTO audit_log (event_type, details, performed_by) VALUES ('account_locked', ?, 'system')",
          [JSON.stringify({
            user_id: challenge.user_id,
            challenge_id: challengeId,
            reason: 'Face authentication failure',
            lock_duration: '30 minutes',
            expires_at: lockExpiry
          })]
        );

        // Emit real-time log to Dashboard
        logToDashboard(
          { ztaUser: { user_id: challenge.user_id, role: challenge.role }, method: 'POST', originalUrl: '/api/zta/step-up/verify' },
          challenge.risk_score || 80,
          'AUTH_LOCKED',
          `User ${challenge.user_id} failed Face Auth; Account Locked for 30 min.`
        );

        return {
          success: false,
          status: 'failed',
          account_locked: true,
          locked_until: lockExpiry,
          message: 'Face authentication failed. Your account has been locked for 30 minutes for security purposes.'
        };
      }
      break;

    default:
      return { success: false, error: 'Invalid step' };
  }

  if (verified) {
    const nextStep = step + 1;

    if (nextStep >= 3) {
      // All steps completed successfully
      runSql("UPDATE zta_step_up_challenges SET status='completed', current_step=?, completed_at=datetime('now') WHERE id=?",
        [nextStep, challengeId]);

      // Update ZTA session to reflect step-up completion
      runSql("UPDATE zta_sessions SET step_up_completed=1, trust_level='elevated', last_verified=datetime('now') WHERE user_id=?",
        [challenge.user_id]);

      // Log success
      runSql("INSERT INTO audit_log (event_type, details, performed_by) VALUES ('step_up_completed', ?, ?)",
        [JSON.stringify({ challenge_id: challengeId, user_id: challenge.user_id, action: challenge.action }), challenge.user_id]);

      return {
        success: true,
        status: 'completed',
        step: nextStep,
        message: 'Step-up authentication completed successfully. Your request will now be processed.'
      };
    }

    // Move to next step
    runSql("UPDATE zta_step_up_challenges SET current_step=? WHERE id=?", [nextStep, challengeId]);
    return {
      success: true,
      status: 'pending',
      step: nextStep,
      message: `Step ${step + 1} verified. Please complete step ${nextStep + 1}.`
    };
  }

  // Generic failure (user_id or password wrong)
  const newAttempts = challenge.attempts + 1;
  if (newAttempts >= 5) {
    runSql("UPDATE zta_step_up_challenges SET status='failed', attempts=? WHERE id=?", [newAttempts, challengeId]);
    return { success: false, status: 'failed', message: 'Too many failed attempts. Please try again later.' };
  }

  runSql("UPDATE zta_step_up_challenges SET attempts=? WHERE id=?", [newAttempts, challengeId]);
  return {
    success: false,
    status: 'pending',
    step,
    attempts: newAttempts,
    remaining: 5 - newAttempts,
    message: `Verification failed. ${5 - newAttempts} attempt(s) remaining.`
  };
}

/**
 * Express middleware: Check if step-up auth is required for this request
 * 
 * Runs AFTER risk analysis. If risk score >= step-up threshold (60),
 * checks if user has a valid completed step-up challenge for this session.
 */
function requireStepUp(req, res, next) {
  // Only enforce step-up for write operations on sensitive endpoints
  if (req.method === 'GET') return next();

  const riskResult = req.ztaRiskResult;
  const decision = riskResult?.decision || 'ALLOW';
  const riskScore = riskResult?.score || 0;

  if (decision === 'ALLOW') return next();

  const user = req.ztaUser;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // Handle JUSTIFY
  if (decision === 'JUSTIFY') {
    // If it's already justified (X-Device header or similar), allow through
    if (req.headers['x-device'] === 'internal workstation' || req.body?.details?.startsWith('Justified:')) {
      return next();
    }
    return res.status(202).json({
      justify_required: true,
      risk_score: riskScore,
      message: riskResult.reason || 'Justification required for this action.'
    });
  }

  // Handle REQUIRE_MFA
  if (decision === 'REQUIRE_MFA') {
    // Check if user already completed step-up recently (within last 10 minutes)
    const session = queryOne(
      "SELECT * FROM zta_sessions WHERE user_id = ? AND step_up_completed = 1 AND last_verified > datetime('now', '-10 minutes')",
      [user.user_id]
    );

    if (session) return next();

    // Step-up required — create challenge and return 202 with legacy-compatible keys
    const challengeId = createStepUpChallenge(
      user.user_id,
      user.username,
      user.role,
      req.body?.action || req.path,
      req.body?.amount || 0,
      riskScore
    );

    return res.status(202).json({
      mfa_required: true, // Legacy compatible key
      step_up_required: true, // ZTA key
      challenge_id: challengeId,
      risk_score: riskScore,
      message: riskResult.reason || `Risk score ${riskScore} requires multi-factor authentication.`
    });
  }

  // Handle ADMIN_APPROVAL
  if (decision === 'ADMIN_APPROVAL') {
    // Create an approval request in the legacy table so the existing admin dashboard sees it
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const approvalResult = runSql(
      "INSERT INTO approval_requests (user_id, username, role, action, amount, risk_score, status, expires_at, user_message) VALUES (?,?,?,?,?,?,'pending',?,?)",
      [user.user_id, user.username, user.role, req.body?.action || req.path, req.body?.amount || 0, riskScore, expiresAt, 'ZTA Escalation: High risk activity detected']
    );

    return res.status(202).json({
      admin_approval_required: true,
      request_id: approvalResult.lastInsertRowid,
      risk_score: riskScore,
      message: riskResult.reason || `Critial risk score ${riskScore} requires admin approval.`
    });
  }

  next();
}

module.exports = {
  createStepUpChallenge,
  getStepUpChallenge,
  verifyStepUpStep,
  requireStepUp,
  STEP_UP_STATUS
};
