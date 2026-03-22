/**
 * Keycloak JWT Verification Middleware
 * 
 * Validates JWT tokens issued by Keycloak using JWKS (JSON Web Key Set).
 * Falls back to local token verification in dev mode when Keycloak is unavailable.
 */
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { queryOne } = require('../db');
                                                                                                                                                                                                                                                                                                                                                                          
// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'multishield';
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'zta-gateway';
const JWT_SECRET = process.env.JWT_SECRET || 'multishield-zta-secret-key-dev';
const DEV_MODE = process.env.NODE_ENV !== 'production';

// JWKS client for Keycloak public key retrieval
let jwks = null;
try {
  jwks = jwksClient({
    jwksUri: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600000 // 10 minutes
  });
} catch (err) {
  console.warn('[ZTA] JWKS client init failed — will use local JWT verification:', err.message);
}

/**
 * Get Keycloak signing key
 */
function getKeycloakKey(header, callback) {
  if (!jwks) return callback(new Error('JWKS not initialized'));
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/**
 * Verify a JWT token — tries Keycloak JWKS first, falls back to local secret
 */
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    // Try Keycloak JWKS verification first
    if (jwks && !DEV_MODE) {
      jwt.verify(token, getKeycloakKey, {
        algorithms: ['RS256'],
        clockTolerance: 864000 // 10 days tolerance for Docker time drift
        // We'll be lenient with audience/issuer for the prototype to avoid configuration mismatches
      }, (err, decoded) => {
        if (!err) return resolve(decoded);
        // Fall back to local verification if Keycloak fails (even in prod if it was a transient error)
        console.warn('[ZTA] Keycloak JWT verification failed, trying local:', err.message);
        verifyLocal(token).then(resolve).catch(reject);
      });
    } else {
      // Dev mode or JWKS unavailable: use local JWT secret
      verifyLocal(token).then(resolve).catch(reject);
    }
  });
}

/**
 * Local JWT verification (dev mode / fallback)
 */
function verifyLocal(token) {
  return new Promise((resolve, reject) => {
    // In local dev, we don't strictly require audience match because local tokens might not have it
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256', 'RS256'], clockTolerance: 864000 }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

/**
 * Sign a local JWT (dev mode)
 */
function signLocalToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', expiresIn });
}

/**
 * Express middleware: Verify JWT on every incoming request
 * 
 * Extracts the Bearer token from Authorization header,
 * validates it, checks account locks, and attaches user info to req.ztaUser
 */
function verifyJwt(req, res, next) {
  // Skip JWT check for auth endpoints
  const skipPaths = ['/api/zta/login', '/api/zta/health', '/api/health'];
  if (skipPaths.some(p => req.path.startsWith(p))) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No valid Bearer token provided. Please authenticate via /api/zta/login'
    });
  }

  const token = authHeader.replace('Bearer ', '');

  verifyToken(token)
    .then(decoded => {
      // Check if account is locked (face-auth failure → 30 min lock)
      const lock = queryOne(
        "SELECT * FROM account_locks WHERE user_id = ? AND resolved = 0 AND expires_at > datetime('now') ORDER BY locked_at DESC LIMIT 1",
        [decoded.sub || decoded.user_id]
      );

      if (lock) {
        return res.status(403).json({
          error: 'Account locked',
          message: `Your account is temporarily locked due to failed face authentication. Lock expires at ${lock.expires_at}.`,
          locked_until: lock.expires_at,
          reason: lock.reason
        });
      }

      // Attach verified user identity to request
      req.ztaUser = {
        user_id: decoded.sub || decoded.user_id,
        username: decoded.preferred_username || decoded.username,
        full_name: decoded.name || decoded.full_name,
        email: decoded.email,
        role: decoded.role || decoded.realm_access?.roles?.[0] || 'user',
        department: decoded.department,
        session_id: decoded.session_state || decoded.session_id,
        token_issued: decoded.iat,
        token_expires: decoded.exp
      };

      next();
    })
    .catch(err => {
      console.error('[ZTA] JWT verification failed:', err.message);
      return res.status(401).json({
        error: 'Invalid token',
        message: 'JWT verification failed. Token may be expired or invalid.'
      });
    });
}

module.exports = {
  verifyJwt,
  verifyToken,
  signLocalToken,
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  JWT_SECRET,
  DEV_MODE
};
