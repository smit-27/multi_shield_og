/**
 * AI Risk Engine — scores activity 0-100 using weighted factors
 */
const { queryAll, queryOne } = require('../db');

function getPolicies() {
  const rows = queryAll('SELECT * FROM policies WHERE enabled = 1');
  const map = {};
  rows.forEach(r => { map[r.rule_type] = r.threshold; });
  return map;
}

function analyzeRisk(activity) {
  const policies = getPolicies();
  const factors = [];
  let totalScore = 0;

  // Factor 1: Amount anomaly (0-75)
  if (activity.amount > 0) {
    const maxAmount = policies.max_amount || 500000;
    const highValue = policies.high_value || 100000;

    if (activity.amount > maxAmount) {
      // Exceeding max limit guarantees at least MFA (65 points)
      totalScore += 65;
      factors.push({ factor: 'Transaction Amount Exceeds Limit', detail: `₹${Number(activity.amount).toLocaleString('en-IN')} exceeds maximum limit of ₹${maxAmount.toLocaleString('en-IN')}`, score: 65, maxScore: 75 });
    } else if (activity.amount > highValue) {
      // High value guarantees at least Justification (40-60 points)
      const ratio = (activity.amount - highValue) / (maxAmount - highValue);
      const pts = Math.round(40 + ratio * 20); // 40 to 60 points
      totalScore += pts;
      factors.push({ factor: 'High-Value Transaction', detail: `₹${Number(activity.amount).toLocaleString('en-IN')} exceeds high-value threshold`, score: pts, maxScore: 75 });
    } else if (activity.amount > highValue * 0.5) {
      const pts = Math.round((activity.amount / highValue) * 20); // up to 20 points
      totalScore += pts;
      factors.push({ factor: 'Moderate Transaction Amount', detail: `₹${Number(activity.amount).toLocaleString('en-IN')} is a notable amount`, score: pts, maxScore: 75 });
    }
  }

  // Factor 2: Time-of-day anomaly (0-20)
  const hour = activity.hour != null ? activity.hour : new Date().getHours();
  const hoursStart = policies.hours_start || 8;
  const hoursEnd = policies.hours_end || 20;

  if (hour < hoursStart || hour >= hoursEnd) {
    totalScore += 20;
    factors.push({ factor: 'Activity Outside Business Hours', detail: `Activity at ${hour}:00 is outside allowed hours (${hoursStart}:00-${hoursEnd}:00)`, score: 20, maxScore: 20 });
  } else if (hour < hoursStart + 1 || hour >= hoursEnd - 1) {
    totalScore += 8;
    factors.push({ factor: 'Activity Near Business Hours Boundary', detail: `Activity at ${hour}:00 is near boundary`, score: 8, maxScore: 20 });
  }

  // Factor 3: Unknown device (0-15)
  const knownDevices = ['internal workstation', 'office terminal', 'branch terminal'];
  const device = (activity.device || '').toLowerCase();
  if (!knownDevices.some(d => device.includes(d)) && device) {
    totalScore += 15;
    factors.push({ factor: 'Unknown Device Detected', detail: `Device "${activity.device}" is not authorized`, score: 15, maxScore: 15 });
  }

  // Factor 4: Bulk data operation (0-15)
  if (['bulk_data_export', 'export', 'bulk_download'].includes(activity.action)) {
    totalScore += 15;
    factors.push({ factor: 'Bulk Data Export Detected', detail: `${activity.action} triggers data exfiltration monitoring`, score: 15, maxScore: 15 });
  }

  // Factor 5: Role-action mismatch (0-10)
  const rolePerms = {
    'Treasury Operator': ['withdraw', 'transfer', 'view_balance', 'approve_transaction'],
    'Loan Officer': ['loan_approval', 'loan_rejection', 'view_loans'],
    'Database Admin': ['bulk_data_export', 'view_customers', 'export']
  };
  const allowed = rolePerms[activity.role] || [];
  if (activity.role && !allowed.includes(activity.action)) {
    totalScore += 10;
    factors.push({ factor: 'Role-Action Mismatch', detail: `"${activity.role}" performing "${activity.action}" is outside normal scope`, score: 10, maxScore: 10 });
  }

  // Factor 6: Frequency anomaly (0-10)
  const recentCount = queryOne("SELECT COUNT(*) as count FROM activities WHERE user_id = ? AND action = ? AND created_at > datetime('now', '-1 hour')", [activity.user_id, activity.action])?.count || 0;
  if (recentCount > 5) {
    totalScore += 10;
    factors.push({ factor: 'High Frequency Activity', detail: `${recentCount} similar actions in last hour`, score: 10, maxScore: 10 });
  } else if (recentCount > 3) {
    totalScore += 5;
    factors.push({ factor: 'Elevated Activity Frequency', detail: `${recentCount} similar actions in last hour`, score: 5, maxScore: 10 });
  }

  return { score: Math.min(100, totalScore), factors };
}

module.exports = { analyzeRisk };
