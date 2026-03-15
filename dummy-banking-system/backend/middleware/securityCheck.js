/**
 * Security Check Middleware — calls Security Platform API before sensitive actions
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

      if (result.decision === 'BLOCK') {
        return res.status(403).json({
          blocked: true, risk_score: result.risk_score, decision: result.decision,
          reason: result.reason, factors: result.factors || [],
          message: 'Suspicious activity detected. Transaction blocked pending admin approval.'
        });
      }
      // MFA: allow the transaction to proceed but attach warning to response
      // The transaction will complete, but the MFA flag is included in the response
      req.securityResult = {
        ...result,
        mfa_required: result.decision === 'REQUIRE_MFA',
        mfa_message: result.decision === 'REQUIRE_MFA' ? 'Additional verification recommended for this transaction.' : null
      };
      next();
    } catch (error) {
      console.error('Security platform unreachable:', error.message);
      req.securityResult = { risk_score: 0, decision: 'ALLOW', reason: 'Security platform unreachable — fail-open mode' };
      next();
    }
  };
}

module.exports = { createSecurityCheck };
