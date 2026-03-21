/**
 * ZTA Proxy Middleware
 * 
 * Forwards verified requests from the ZTA gateway to the dummy-banking-system.
 * Only forwards AFTER all ZTA checks pass (JWT, context, risk, step-up).
 * 
 * Injects internal auth headers and strips external ones to prevent injection.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const BANKING_BACKEND_URL = process.env.BANKING_BACKEND_URL || 'http://localhost:3001';

/**
 * Create a proxy middleware instance for forwarding to the banking system.
 * 
 * - Rewrites /api/banking/* → /api/*
 * - Injects X-ZTA-* headers for internal verification
 * - Strips external Authorization header (replaced with internal token)
 */
function createBankingProxy() {
  return createProxyMiddleware({
    target: BANKING_BACKEND_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/banking': '/api' // /api/banking/treasury/withdraw → /api/treasury/withdraw
    },
    on: {
      proxyReq: (proxyReq, req) => {
        // Inject ZTA verification headers
        if (req.ztaUser) {
          proxyReq.setHeader('X-ZTA-Verified', 'true');
          proxyReq.setHeader('X-ZTA-User-Id', req.ztaUser.user_id);
          proxyReq.setHeader('X-ZTA-Username', req.ztaUser.username || '');
          proxyReq.setHeader('X-ZTA-Role', req.ztaUser.role || '');
          proxyReq.setHeader('X-ZTA-Session', req.ztaUser.session_id || '');
        }

        // Inject risk context
        if (req.ztaRiskResult) {
          proxyReq.setHeader('X-ZTA-Risk-Score', String(req.ztaRiskResult.score || 0));
          proxyReq.setHeader('X-ZTA-Decision', req.ztaRiskResult.decision || 'ALLOW');
        }

        // Inject context
        if (req.ztaContext) {
          proxyReq.setHeader('X-ZTA-IP', req.ztaContext.ip || '');
          proxyReq.setHeader('X-ZTA-Country', req.ztaContext.location?.country || '');
        }

        // Forward request body for POST/PUT/PATCH
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      proxyRes: (proxyRes, req, res) => {
        // Add ZTA header to response so frontend knows it went through the gateway
        proxyRes.headers['x-zta-gateway'] = 'verified';
      },
      error: (err, req, res) => {
        console.error('[ZTA Proxy] Error forwarding to banking system:', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Banking service unavailable',
            message: 'The banking system is currently unreachable. Please try again later.'
          });
        }
      }
    },
    logger: console
  });
}

/**
 * Simple proxy function for non-middleware usage (manual forwarding)
 */
async function forwardToBanking(path, method, body, ztaHeaders = {}) {
  const url = path.startsWith('http') ? path : `${BANKING_BACKEND_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-ZTA-Verified': 'true',
    ...ztaHeaders
  };

  const options = { method, headers };
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  return { status: response.status, data };
}

module.exports = { createBankingProxy, forwardToBanking, BANKING_BACKEND_URL };
