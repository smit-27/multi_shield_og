/**
 * Security Check Middleware — calls Security Platform API before sensitive actions
 * Handles 4-tier risk decisions: ALLOW, JUSTIFY, REQUIRE_MFA, ADMIN_APPROVAL
 */
const SECURITY_PLATFORM_URL = process.env.SECURITY_PLATFORM_URL || 'http://localhost:3002';

function createSecurityCheck(actionType) {
  return async (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const payload = {
      user_id: user.id,
      username: user.username,
      role: user.role,
      action: actionType,
      amount: req.body.amount || 0,
      timestamp: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      hour: now.getHours(),
      device: req.headers['x-device'] || 'internal workstation',
      ip_address: req.ip || '10.0.0.1',
      details: req.body.description || req.body.details || '',
      metadata: { account_id: req.body.account_id || req.params.id, ...(req.body.metadata || {}) }
    };

    try {
      const response = await fetch(`${SECURITY_PLATFORM_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      // Log locally
      const { runSql } = require('../db');
      runSql("INSERT INTO activity_logs (user_id, action, details, ip_address, device, risk_score, decision, created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))",
        [user.id, actionType, JSON.stringify(payload), payload.ip_address, payload.device, result.risk_score, result.decision]);

      // Tier 4: Admin approval required (score 90-100)
      if (result.decision === 'ADMIN_APPROVAL') {
        return res.status(403).json({
          admin_approval_required: true,
          request_id: result.request_id,
          decision: result.decision,
          reason: result.reason,
          message: 'This action has been temporarily blocked due to security verification. Your session will be locked pending admin approval.'
        });
      }

      // Tier 3: MFA required (score 60-89)
      if (result.decision === 'REQUIRE_MFA') {
        return res.status(202).json({
          mfa_required: true,
          challenge_id: result.challenge_id,
          decision: result.decision,
          reason: result.reason,
          message: 'Additional security verification required. Please complete multi-factor authentication on the Security Platform to proceed.'
        });
      }

      // Tier 2: Justification required (score 40-59)
      if (result.decision === 'JUSTIFY') {
        return res.status(200).json({
          justify_required: true,
          decision: result.decision,
          reason: result.reason,
          message: 'This action requires additional verification. Please provide a business justification before proceeding.'
        });
      }

      // Tier 1: Allow (score 0-39)
      req.securityResult = result;
      next();
    } catch (error) {
      console.error('Security platform unreachable:', error.message);
      req.securityResult = { risk_score: 0, decision: 'ALLOW', reason: 'Security platform unreachable — fail-open mode' };
      next();
    }
  };
}

module.exports = { createSecurityCheck, SECURITY_PLATFORM_URL };
