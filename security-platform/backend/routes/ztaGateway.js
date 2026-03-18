/**
 * ZTA Gateway Routes
 * 
 * Authentication and session management for the Zero Trust Architecture gateway.
 * 
 * Endpoints:
 *   POST /api/zta/login       — Authenticate user, issue JWT
 *   POST /api/zta/logout      — Invalidate session
 *   GET  /api/zta/session      — Get current session info / trust level
 *   POST /api/zta/step-up     — Initiate step-up auth for high-risk ops
 *   POST /api/zta/step-up/verify — Verify a step in step-up auth
 *   GET  /api/zta/health       — Health check
 */
const express = require('express');
const router = express.Router();
const { queryOne, runSql } = require('../db');
const { signLocalToken, verifyJwt, KEYCLOAK_URL, DEV_MODE } = require('../middleware/keycloak');
const { createStepUpChallenge, getStepUpChallenge, verifyStepUpStep } = require('../middleware/stepUpAuth');
const crypto = require('crypto');
const { logAuditEvent } = require('../security/auditLogger');

/**
 * POST /api/zta/login
 * 
 * In production: redirects to Keycloak OIDC login.
 * In dev mode: authenticates against dummy-banking's user table via API call,
 * then issues a local JWT.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    if (!DEV_MODE) {
      // Production: Use Keycloak OIDC token endpoint
      const tokenResponse = await fetch(`${KEYCLOAK_URL}/realms/multishield/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'zta-gateway',
          username,
          password,
          scope: 'openid profile email'
        })
      });

      if (!tokenResponse.ok) {
        const err = await tokenResponse.json();
        return res.status(401).json({ error: 'Authentication failed', message: err.error_description || 'Invalid credentials' });
      }

      const tokenData = await tokenResponse.json();
      return res.json({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: 'Bearer'
      });
    }

    // Dev mode: authenticate via dummy-banking API
    const BANKING_URL = process.env.BANKING_BACKEND_URL || 'http://localhost:3001';
    const authResponse = await fetch(`${BANKING_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!authResponse.ok) {
      const err = await authResponse.json();
      return res.status(401).json({ error: 'Authentication failed', message: err.error || 'Invalid credentials' });
    }

    const authData = await authResponse.json();
    const user = authData.user;

    // Check if account is locked
    const lock = queryOne(
      "SELECT * FROM account_locks WHERE user_id = ? AND resolved = 0 AND expires_at > datetime('now') ORDER BY locked_at DESC LIMIT 1",
      [user.id]
    );
    if (lock) {
      return res.status(403).json({
        error: 'Account locked',
        message: `Your account is temporarily locked. Lock expires at ${lock.expires_at}.`,
        locked_until: lock.expires_at
      });
    }

    // Issue local JWT
    const sessionId = crypto.randomBytes(16).toString('hex');
    const token = signLocalToken({
      sub: user.id,
      user_id: user.id,
      username: user.username,
      name: user.full_name,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      department: user.department,
      session_id: sessionId
    }, '1h');

    // Store ZTA session
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    runSql(
      "INSERT OR REPLACE INTO zta_sessions (id, user_id, trust_level, ip_address, last_verified, step_up_completed, created_at, expires_at) VALUES (?,?,?,?,datetime('now'),0,datetime('now'),?)",
      [sessionId, user.id, 'standard', req.ip, expiresAt]
    );

    // Also store the banking token for downstream proxying
    runSql(
      "INSERT OR REPLACE INTO banking_tokens (session_id, banking_token) VALUES (?,?)",
      [sessionId, authData.token]
    );

    // Audit log (blockchain-anchored)
    logAuditEvent('zta_login',
      { user_id: user.id, ip: req.ip, session_id: sessionId },
      user.id);

    res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        email: user.email
      },
      session: {
        id: sessionId,
        trust_level: 'standard'
      }
    });

  } catch (err) {
    console.error('[ZTA] Login error:', err.message);
    res.status(500).json({ error: 'Authentication service error', message: err.message });
  }
});

/**
 * POST /api/zta/logout
 */
router.post('/logout', verifyJwt, (req, res) => {
  const user = req.ztaUser;
  if (user?.session_id) {
    runSql("DELETE FROM zta_sessions WHERE id = ?", [user.session_id]);
    runSql("DELETE FROM banking_tokens WHERE session_id = ?", [user.session_id]);
  }
  logAuditEvent('zta_logout',
    { user_id: user?.user_id, session_id: user?.session_id },
    user?.user_id || 'unknown');
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/zta/session
 */
router.get('/session', verifyJwt, (req, res) => {
  const user = req.ztaUser;
  const session = queryOne("SELECT * FROM zta_sessions WHERE user_id = ?", [user.user_id]);

  res.json({
    user: {
      id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      email: user.email
    },
    session: session ? {
      id: session.id,
      trust_level: session.trust_level,
      step_up_completed: !!session.step_up_completed,
      last_verified: session.last_verified,
      created_at: session.created_at,
      expires_at: session.expires_at
    } : null
  });
});

/**
 * POST /api/zta/step-up — Initiate step-up authentication
 */
router.post('/step-up', verifyJwt, (req, res) => {
  const user = req.ztaUser;
  const { action, amount } = req.body;

  const challengeId = createStepUpChallenge(
    user.user_id, user.username, user.role,
    action || 'high-risk-operation', amount || 0, 0
  );

  res.json({
    challenge_id: challengeId,
    steps: [
      { step: 0, label: 'User ID', description: 'Verify your employee identification number' },
      { step: 1, label: 'Password', description: 'Enter your security password' },
      { step: 2, label: 'Face Authentication', description: 'Verify your identity with face scan' }
    ],
    message: 'Step-up authentication initiated. Complete all 3 steps to elevate your trust level.'
  });
});

/**
 * POST /api/zta/step-up/verify — Verify a step
 */
router.post('/step-up/verify', verifyJwt, (req, res) => {
  const { challenge_id, step, value } = req.body;

  if (!challenge_id || step == null || value == null) {
    return res.status(400).json({ error: 'challenge_id, step, and value are required' });
  }

  const result = verifyStepUpStep(challenge_id, step, value);

  if (result.account_locked) {
    return res.status(403).json(result);
  }

  if (!result.success && result.status === 'failed') {
    return res.status(403).json(result);
  }

  if (!result.success) {
    return res.status(401).json(result);
  }

  res.json(result);
});

/**
 * GET /api/zta/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'zta-gateway',
    timestamp: new Date().toISOString(),
    keycloak: DEV_MODE ? 'dev-mode (local JWT)' : KEYCLOAK_URL
  });
});

module.exports = router;
