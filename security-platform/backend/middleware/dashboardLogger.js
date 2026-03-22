const os = require('os');

let io = null;

const initDashboardLogger = (socketIo) => {
  io = socketIo;
};

/**
 * Log activity to the real-time admin dashboard
 * @param {Object} req - Express request object
 * @param {Number} riskScore - Calculated risk score
 * @param {String} action - 'FORWARDED', 'SANDBOXED', 'BLOCKED', 'AUTH_LOCKED', etc.
 * @param {String} details - Optional descriptive text
 * @param {Object} extraPayload - Optional extra metrics (like active thresholds)
 */
const logToDashboard = (req, riskScore, action, details = '', extraPayload = {}) => {
  if (!io) return; // Logger not initialized
  
  const user = req.ztaUser || {};
  const ctx = req.ztaContext || {};
  const ip = ctx.ip || req.ip || req.headers['x-forwarded-for']?.split(',')[0] || '127.0.0.1';
  
  // Determine segment based on action
  let segment = 'Production-Core';
  if (action === 'SANDBOXED') segment = 'Sandbox-VLAN';
  if (action === 'BLOCKED' || action === 'AUTH_LOCKED') segment = 'Edge-Firewall';

  const activity = {
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    user: user.user_id || 'Anonymous',
    role: user.role || 'unknown',
    location: ip,
    country: ctx.location?.country || 'Unknown',
    score: riskScore || 0,
    action: action, 
    segment: segment,
    details: details || req.method + ' ' + req.originalUrl,
    ...extraPayload
  };

  io.emit('zta-activity', activity);
};

module.exports = { initDashboardLogger, logToDashboard, getIo: () => io };
