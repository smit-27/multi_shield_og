/**
 * Context Verification Middleware
 * 
 * Enforces Zero Trust contextual security checks:
 * 1. IP-based location validation — checks against allowed CIDRs/ranges
 * 2. Time-based access policies — enforces business-hours from policies table
 * 
 * Attaches req.ztaContext with risk signals for downstream middleware.
 */
const geoip = require('geoip-lite');
const { queryOne } = require('../db');

// Allowed IP ranges (configurable via env)
const ALLOWED_IP_RANGES = (process.env.ALLOWED_IPS || '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::ffff:127.0.0.1').split(',');

// Allowed countries (ISO codes)
const ALLOWED_COUNTRIES = (process.env.ALLOWED_COUNTRIES || 'IN,US,GB').split(',');

/**
 * Check if an IP falls within a CIDR range
 */
function ipInCidr(ip, cidr) {
  if (ip === cidr) return true;
  const parts = cidr.split('/');
  if (parts.length !== 2) return ip === cidr;

  const cidrIp = parts[0];
  const mask = parseInt(parts[1]);

  // Simple IPv4 check
  const ipParts = ip.replace('::ffff:', '').split('.').map(Number);
  const cidrParts = cidrIp.split('.').map(Number);

  if (ipParts.length !== 4 || cidrParts.length !== 4) return false;

  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const cidrNum = (cidrParts[0] << 24) | (cidrParts[1] << 16) | (cidrParts[2] << 8) | cidrParts[3];
  const maskBits = ~((1 << (32 - mask)) - 1);

  return (ipNum & maskBits) === (cidrNum & maskBits);
}

/**
 * Check if IP is in allowed ranges
 */
function isIpAllowed(ip) {
  const cleanIp = ip.replace('::ffff:', '');
  // Always allow localhost
  if (['127.0.0.1', '::1', 'localhost'].includes(cleanIp)) return true;
  return ALLOWED_IP_RANGES.some(range => ipInCidr(cleanIp, range));
}

/**
 * Get location context from IP
 */
function getLocationContext(ip) {
  const cleanIp = ip.replace('::ffff:', '');

  // Localhost = trusted internal
  if (['127.0.0.1', '::1', 'localhost'].includes(cleanIp) || cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.')) {
    return { country: 'IN', region: 'Internal', city: 'Office', trusted: true };
  }

  const geo = geoip.lookup(cleanIp);
  if (!geo) return { country: 'UNKNOWN', region: 'Unknown', city: 'Unknown', trusted: false };

  return {
    country: geo.country,
    region: geo.region,
    city: geo.city,
    ll: geo.ll,
    trusted: ALLOWED_COUNTRIES.includes(geo.country)
  };
}

/**
 * Get time-based access policy
 */
function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sunday

  const hoursStart = queryOne("SELECT threshold FROM policies WHERE rule_type = 'hours_start' AND enabled = 1")?.threshold || 8;
  const hoursEnd = queryOne("SELECT threshold FROM policies WHERE rule_type = 'hours_end' AND enabled = 1")?.threshold || 20;

  const isBusinessHours = hour >= hoursStart && hour < hoursEnd;
  const isWeekday = day >= 1 && day <= 5;

  let riskContribution = 0;
  if (!isBusinessHours) riskContribution += 15;
  if (!isWeekday) riskContribution += 10;

  return {
    hour,
    day,
    isBusinessHours,
    isWeekday,
    hoursStart,
    hoursEnd,
    riskContribution,
    timestamp: now.toISOString()
  };
}

/**
 * Express middleware: Verify request context (IP, time, location)
 * 
 * Does NOT block requests outright — instead attaches risk signals
 * to req.ztaContext for the risk engine to incorporate.
 * Only blocks if IP is from a sanctioned/blocked country.
 */
function verifyContext(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  const location = getLocationContext(ip);
  const time = getTimeContext();

  // Hard block: unknown country not in allowlist (unless internal)
  if (!location.trusted && location.country !== 'UNKNOWN') {
    console.warn(`[ZTA] Blocked request from untrusted location: ${location.country} (${ip})`);
    return res.status(403).json({
      error: 'Access denied',
      message: `Access from ${location.country} is not permitted by security policy.`,
      location: { country: location.country, city: location.city }
    });
  }

  // Calculate context risk score contribution
  let contextRisk = 0;
  contextRisk += time.riskContribution;
  if (!location.trusted && location.country === 'UNKNOWN') contextRisk += 5;

  // Attach context to request for downstream middleware
  req.ztaContext = {
    ip,
    location,
    time,
    contextRisk,
    device: req.headers['x-device'] || req.headers['user-agent'] || 'unknown',
    verified: true
  };

  next();
}

module.exports = { verifyContext, getLocationContext, getTimeContext, isIpAllowed };
