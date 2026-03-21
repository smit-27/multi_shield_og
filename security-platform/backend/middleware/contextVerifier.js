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
const { logToDashboard } = require('./dashboardLogger');

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
  const isWeekday = day >= 0 && day <= 6; // Include Saturday and Sunday

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
 * Location Kill Switch (System-Wide Master Fuse)
 * 
 * Determines if the system should run based on the user's origin country.
 */
const locationKillSwitch = (req, res, next) => {
  const allowedCountry = 'IN'; // Example: System only runs in India
  
  // Real deployment would use x-user-geo-location set by edge proxy (e.g., Cloudflare)
  // For demo, we evaluate based on local IP geo.
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  const location = getLocationContext(ip);
  const userIPLocation = req.headers['x-user-geo-location'] || location.country; 

  // Skip local requests for demo purposes
  if (ip !== '127.0.0.1' && ip !== '::1' && userIPLocation !== allowedCountry && userIPLocation !== 'UNKNOWN') {
      console.error(`[ZTA CRITICAL] Access attempt from unauthorized region: ${userIPLocation}. System Inaccessible.`);
      
      logToDashboard(
        { ztaUser: { user_id: 'Blocked-Guest', role: 'none' }, ip, headers: req.headers, ztaContext: { location } },
        100,
        'BLOCKED',
        `Kill-Switch Triggered: Access from ${userIPLocation} is blocked globally.`
      );

      return res.status(403).send("Service Unavailable in your region.");
  }
  
  // Attach location context
  req.ztaContext = req.ztaContext || {};
  req.ztaContext.location = location;
  req.ztaContext.ip = ip;
  next();
};

/**
 * Time-Constraint Middleware (Temporal Access Control)
 * 
 * Uses Server System Time to decide if the user is acting during a "High Risk" hour.
 * Applies Micro-segmentation: Forces traffic into a Sandbox for off-hour activity.
 */
const timeConstraintMiddleware = (req, res, next) => {
  const now = new Date();
  
  // Check for temporal override from predictive dashboard
  let currentHour = now.getHours(); // Uses the server's real system time
  const overrideTime = req.headers['x-zta-override-time'];
  if (overrideTime != null && !isNaN(parseInt(overrideTime))) {
      currentHour = parseInt(overrideTime);
  }

  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Fetch policies from DB for dynamic control
  const hoursStart = queryOne("SELECT threshold FROM policies WHERE rule_type = 'hours_start' AND enabled = 1")?.threshold || 8;
  const hoursEnd = queryOne("SELECT threshold FROM policies WHERE rule_type = 'hours_end' AND enabled = 1")?.threshold || 20;

  // Define Policy: Allow full access if within business hours. 
  // We'll broaden this for the demo to include weekends if they are within hours, or just allow it.
  const isBusinessHours = (currentHour >= hoursStart && currentHour < hoursEnd);
  const isWeekday = (currentDay >= 1 && currentDay <= 5);
  
  // For ZTA demo, we sandbox if it's outside business hours OR if it's a weekend (higher risk)
  // But we'll make it so "Business Hours" still apply on weekends but with a sandbox.
  const isOfficeHours = isWeekday && isBusinessHours;

  // Attach time context
  req.ztaContext = req.ztaContext || {};
  req.ztaContext.time = {
    hour: currentHour,
    day: currentDay,
    isBusinessHours: isOfficeHours,
    isWeekday: isWeekday,
    timestamp: now.toISOString(),
    riskContribution: isOfficeHours ? 0 : 15,
    isSimulated: !!overrideTime
  };

  req.ztaContext.contextRisk = req.ztaContext.time.riskContribution;
  req.ztaContext.device = req.headers['x-device'] || req.headers['user-agent'] || 'unknown';
  req.ztaContext.verified = true;

  if (!isOfficeHours) {
      // Apply Micro-segmentation: Force into Sandbox for off-hour activity
      req.isSandboxed = true;
      // POINT TO LOCAL BACKEND so data is still visible in this demo environment!
      req.targetSystem = process.env.BANKING_BACKEND_URL || 'http://127.0.0.1:3001';
      console.log(`[ZTA ALERT] Off-hours access detected at ${now.toISOString()}. Segmenting traffic to Sandbox at ${req.targetSystem}`);
      
      logToDashboard(
        req,
        50,
        'SANDBOXED',
        `Temporal Access Control: Off-hours detected. Redirecting to Sandbox.`
      );
  }

  next();
};

module.exports = { locationKillSwitch, timeConstraintMiddleware, getLocationContext, getTimeContext, isIpAllowed };
