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
const { verifyContext } = require('../middleware/contextVerifier');
const { requireStepUp } = require('../middleware/stepUpAuth');
const { forwardToBanking } = require('../middleware/ztaProxy');
const { analyzeRisk } = require('../engine/riskEngine');
const { makeDecision } = require('../engine/policyEngine');
const { queryOne, runSql } = require('../db');

/**
 * Risk analysis middleware — runs the existing risk engine
 * and attaches result to req.ztaRiskResult
 */
function analyzeRequestRisk(req, res, next) {
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

  const riskResult = analyzeRisk(activity);

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

  const decision = makeDecision(riskResult.score, riskResult.factors);

  req.ztaRiskResult = {
    score: riskResult.score,
    decision: decision.decision,
    reason: decision.reason,
    factors: riskResult.factors
  };

  // Log the activity
  runSql(
    "INSERT INTO activities (user_id, username, role, action, amount, timestamp, hour, device, ip_address, details, metadata, risk_score, decision, reason, factors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [activity.user_id, activity.username, activity.role, activity.action, activity.amount,
     activity.timestamp, activity.hour, activity.device, activity.ip_address, activity.details,
     JSON.stringify({ zta_verified: true, context: ctx }), riskResult.score, decision.decision,
     decision.reason, JSON.stringify(riskResult.factors)]
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
  if (sessionId) {
    const tokenRow = queryOne("SELECT banking_token FROM banking_tokens WHERE session_id = ?", [sessionId]);
    if (tokenRow?.banking_token) {
      req.headers['authorization'] = `Bearer ${tokenRow.banking_token}`;
    }
  }
  next();
}

// ─── Apply middleware chain to all banking proxy routes ───
router.use(verifyContext);
router.use(analyzeRequestRisk);
router.use(requireStepUp);
router.use(injectBankingAuth);

// ─── Proxy all requests to dummy-banking ───

// Forward GET requests (read operations — no step-up needed)
router.get('/*', async (req, res) => {
  try {
    const bankingPath = `/api${req.path}`;
    const result = await forwardToBanking(bankingPath, 'GET', null, {
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
    const bankingPath = `/api${req.path}`;
    const result = await forwardToBanking(bankingPath, 'POST', req.body, {
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
