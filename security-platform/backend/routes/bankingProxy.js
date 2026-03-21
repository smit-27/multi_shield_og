/**
 * Banking Proxy Routes
 * 
 * Proxies all /api/banking/* requests to the dummy-banking-system
 * after applying the full ZTA middleware chain:
 *   1. JWT verification (already applied globally)
 *   2. Context verification (IP, time)
 *   3. Risk analysis (existing risk engine)
 *   4. Step-up authentication (if risk score >= 60)
 *   5. Forward to dummy-banking
 */
const express = require('express');
const router = express.Router();
const { locationKillSwitch, timeConstraintMiddleware } = require('../middleware/contextVerifier');
const { requireStepUp } = require('../middleware/stepUpAuth');
const { forwardToBanking } = require('../middleware/ztaProxy');
const { analyzeTransactionRisk } = require('../engine/transactionRiskEngine');
const { analyzeLoginBehaviorRisk } = require('../engine/riskEngine');
const { makeDecision } = require('../engine/policyEngine');
const { queryOne, runSql } = require('../db');
const { logToDashboard } = require('../middleware/dashboardLogger');

// Default Backend Thresholds (hardcoded fallback)
const ZTA_DEFAULTS = {
    amountLimit: 500000,
    criticalRiskScore: 90,
    sandboxRiskScore: 60
};

/**
 * Risk analysis middleware — runs the existing risk engine
 * and attaches result to req.ztaRiskResult
 */
async function analyzeRequestRisk(req, res, next) {
  const user = req.ztaUser;
  const ctx = req.ztaContext || {};
  const now = new Date();

  const activity = {
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    action: extractAction(req),
    amount: req.body?.amount || 0,
    timestamp: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    hour: ctx.time?.hour ?? now.getHours(),
    device: ctx.device || 'unknown',
    ip_address: ctx.ip || req.ip,
    details: req.body?.description || ''
  };

  const isOverrideActive = !!(req.headers['x-zta-override-amount'] || req.headers['x-zta-override-risk-block'] || req.headers['x-zta-override-risk-sandbox']);

  // Extract Demo Overrides
  const activePolicies = {
    amountLimit: req.headers['x-zta-override-amount'] 
        ? parseInt(req.headers['x-zta-override-amount']) 
        : ZTA_DEFAULTS.amountLimit,
    criticalRiskScore: req.headers['x-zta-override-risk-block']
        ? parseInt(req.headers['x-zta-override-risk-block'])
        : ZTA_DEFAULTS.criticalRiskScore,
    sandboxRiskScore: req.headers['x-zta-override-risk-sandbox']
        ? parseInt(req.headers['x-zta-override-risk-sandbox'])
        : ZTA_DEFAULTS.sandboxRiskScore
  };

  // ─── Run both risk engines independently ───
  // 1. Transaction Risk (hardcoded rules)
  const txnResult = analyzeTransactionRisk(activity, activePolicies);

  // 2. Login Behavior Risk (ML-based)
  let loginResult;
  try {
    loginResult = await analyzeLoginBehaviorRisk(activity);
  } catch (err) {
    console.warn('[Risk Engine] ML login behavior analysis failed, using neutral fallback:', err.message);
    loginResult = { score: 50, factors: [{ factor: 'ML Login Behavior (Fallback)', detail: 'ML service unavailable — using neutral score', score: 50, maxScore: 100 }], ml_score: 50, ml_explanation: ['fallback'] };
  }

  // 3. Blend scores: 50% Transaction + 50% Login Behavior
  const blendedScore = Math.min(100, Math.round(0.5 * txnResult.score + 0.5 * loginResult.score));
  const riskResult = {
    score: blendedScore,
    factors: [...txnResult.factors, ...loginResult.factors],
    transaction_score: txnResult.score,
    login_behavior_score: loginResult.score,
    ml_score: loginResult.ml_score,
    ml_explanation: loginResult.ml_explanation,
  };

  // Add context risk contribution
  riskResult.score = Math.min(100, riskResult.score + (ctx.contextRisk || 0));
  if (ctx.contextRisk > 0) {
    riskResult.factors.push({
      factor: 'ZTA Context Risk',
      detail: `Additional risk from context signals (time: ${ctx.time?.riskContribution || 0}, location: ${ctx.contextRisk - (ctx.time?.riskContribution || 0)})`,
      score: ctx.contextRisk,
      maxScore: 25
    });
  }

  let decisionResult = 'ALLOW';
  let decisionReason = 'Risk score is within acceptable limits';

  // Override mapping and policy evaluations 
  // Normally we call makeDecision() but the user requested explicit sandbox/block bounds for demo
  if (isOverrideActive) {
    if (riskResult.score >= activePolicies.criticalRiskScore) {
       decisionResult = 'DENY';
       decisionReason = `Risk score ${riskResult.score} exceeds Dynamic Block Threshold ${activePolicies.criticalRiskScore}`;
    } else if (riskResult.score >= activePolicies.sandboxRiskScore) {
       decisionResult = 'SANDBOX';
       decisionReason = `Risk score ${riskResult.score} exceeds Dynamic Sandbox Threshold ${activePolicies.sandboxRiskScore}`;
    }
  } else {
    const rawDecision = makeDecision(riskResult.score, riskResult.factors);
    decisionResult = rawDecision.decision;
    decisionReason = rawDecision.reason;
  }

  req.ztaRiskResult = {
    score: riskResult.score,
    decision: decisionResult,
    reason: decisionReason,
    factors: riskResult.factors
  };

  // Log the activity to DB
  runSql(
    "INSERT INTO activities (user_id, username, role, action, amount, timestamp, hour, device, ip_address, details, metadata, risk_score, decision, reason, factors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [activity.user_id, activity.username, activity.role, activity.action, activity.amount,
     activity.timestamp, activity.hour, activity.device, activity.ip_address, activity.details,
     JSON.stringify({ zta_verified: true, context: ctx }), riskResult.score, decisionResult,
     decisionReason, JSON.stringify(riskResult.factors)]
  );

  // Determine ZTA gateway action
  let gatewayAction = 'FORWARDED';
  if (decisionResult === 'DENY') gatewayAction = 'BLOCKED';
  else if (decisionResult === 'SANDBOX' || decisionResult === 'FLAG' || decisionResult === 'REQUIRE_MFA') {
    // If we require MFA from standard DB logic, it's not strictly a sandbox route, but we'll mark as sandboxed contextually here for demo UI
    gatewayAction = 'SANDBOXED'; 
    if (decisionResult === 'SANDBOX') {
       req.isSandboxed = true;
       req.targetSystem = 'http://sandbox-banking-system:5000';
    }
  }

  // Emit real-time log to Dashboard with dynamic info
  logToDashboard(
    req,
    riskResult.score,
    gatewayAction,
    `Action: ${activity.action} via ${gatewayAction === 'SANDBOXED' ? 'Micro-segmentation' : 'Core Router'}`,
    { thresholds: activePolicies, isOverrideActive, factors: riskResult.factors }
  );

  next();
}

/**
 * Extract action type from the request path
 */
function extractAction(req) {
  const path = req.path.replace(/^\//, '');
  const parts = path.split('/');

  // /treasury/withdraw → withdraw
  // /treasury/transfer → transfer
  // /loans/approve → loan_approval
  // /customers → view_customers
  if (parts.length >= 2) {
    const resource = parts[0];
    const action = parts[1];
    if (resource === 'loans' && action === 'approve') return 'loan_approval';
    if (resource === 'loans' && action === 'reject') return 'loan_rejection';
    return action;
  }

  if (parts[0] === 'customers') return 'view_customers';
  if (parts[0] === 'treasury') return 'view_balance';
  return parts[0] || 'unknown';
}

/**
 * Inject banking auth token for downstream proxy calls
 */
function injectBankingAuth(req, res, next) {
  const sessionId = req.ztaUser?.session_id;
  console.log(`[ZTA Proxy] injecting auth for session_id: ${sessionId}`);
  if (sessionId) {
    const tokenRow = queryOne("SELECT banking_token FROM banking_tokens WHERE session_id = ?", [sessionId]);
    if (tokenRow?.banking_token) {
      console.log(`[ZTA Proxy] Found banking token: ${tokenRow.banking_token.substring(0, 15)}...`);
      req.headers['authorization'] = `Bearer ${tokenRow.banking_token}`;
    } else {
      console.warn(`[ZTA Proxy] NO banking token found for session: ${sessionId}`);
    }
  }
  next();
}

// ─── Apply middleware chain to all banking proxy routes ───
router.use(locationKillSwitch);
router.use(timeConstraintMiddleware);
router.use(analyzeRequestRisk);
router.use(requireStepUp);
router.use(injectBankingAuth);

// ─── Proxy all requests to dummy-banking or sandbox ───

// Helper to determine target URL
const getTargetUrl = (req, defaultPath) => {
  if (req.isSandboxed && req.targetSystem) {
    return `${req.targetSystem}${defaultPath}`;
  }
  return `/api${defaultPath}`; // Default banking backend handles this via http-proxy-middleware URL logic or local mapped URL
};

// Forward GET requests (read operations — no step-up needed)
router.get('/*', async (req, res) => {
  try {
    const targetUrl = getTargetUrl(req, req.path);
    const result = await forwardToBanking(targetUrl, 'GET', null, {
      'Authorization': req.headers['authorization'] || '',
      'X-ZTA-Verified': 'true',
      'X-ZTA-User-Id': req.ztaUser?.user_id || '',
      'X-ZTA-Risk-Score': String(req.ztaRiskResult?.score || 0)
    });

    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[ZTA Proxy] GET error:', err.message);
    res.status(502).json({ error: 'Banking service unavailable', message: err.message });
  }
});

// Forward POST requests (write operations — step-up may apply)
router.post('/*', async (req, res) => {
  try {
    const targetUrl = getTargetUrl(req, req.path);
    const result = await forwardToBanking(targetUrl, 'POST', req.body, {
      'Authorization': req.headers['authorization'] || '',
      'X-ZTA-Verified': 'true',
      'X-ZTA-User-Id': req.ztaUser?.user_id || '',
      'X-ZTA-Risk-Score': String(req.ztaRiskResult?.score || 0),
      'X-Device': req.ztaContext?.device || 'unknown'
    });

    res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[ZTA Proxy] POST error:', err.message);
    res.status(502).json({ error: 'Banking service unavailable', message: err.message });
  }
});

module.exports = router;
