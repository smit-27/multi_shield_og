/**
 * Transaction Risk Engine — hardcoded risk scoring for financial transactions
 * 
 * Evaluates transaction-specific risk factors:
 *   Factor 1: Amount anomaly (0-75)
 *   Factor 2: Time-of-day anomaly (0-20)
 *   Factor 3: Unknown device (0-15)
 *   Factor 4: Bulk data operation (0-15)
 *   Factor 5: Role-action mismatch (0-10)
 *   Factor 6: Frequency anomaly (0-10)
 * 
 * Max possible score: 145, capped at 100
 */
const { queryAll, queryOne } = require('../db');

/**
 * Detect Structuring / Repetitive Transaction Fraud patterns
 * (Soft / Hard / Block Escalation parameters handled downstream)
 */
async function detectStructuringPattern(userId, amount, destinationAccount) {
  // Query last 24 hours of transactions from ZTA telemetry database
  const priorTxns = queryAll("SELECT * FROM transactions WHERE userId = ? AND timestamp > datetime('now', '-24 hours')", [userId]);
  
  let matchCount = 0;
  let patternType = null;
  const matchedTransactions = [];

  for (const priorTxn of priorTxns) {
    const isCloseAmount = Math.abs(priorTxn.amount - amount) / amount <= 0.02;
    const destMatches = !destinationAccount || priorTxn.destinationAccount === destinationAccount;

    if (isCloseAmount && destMatches) {
      matchCount++;
      matchedTransactions.push(priorTxn);
    }
  }

  if (matchCount > 0) {
    if (destinationAccount) {
      let mixedTypes = matchedTransactions.some(t => t.type !== 'transfer');
      patternType = mixedTypes ? 'same_amount_and_destination' : 'same_destination';
    } else {
      patternType = 'same_amount';
    }
  }

  return { matchCount, patternType, matchedTransactions };
}

function getPolicies() {
  const rows = queryAll('SELECT * FROM policies WHERE enabled = 1');
  const map = {};
  rows.forEach(r => { map[r.rule_type] = r.threshold; });
  return map;
}

/**
 * Analyze financial transaction risk using hardcoded rules.
 * 
 * @param {Object} activity - Transaction activity context
 * @param {Object} overrides - Optional threshold overrides (for demo)
 * @returns {{ score: number, factors: Array }}
 */
function analyzeTransactionRisk(activity, overrides = {}) {
  const policies = getPolicies();
  const factors = [];
  let totalScore = 0;

  // Factor 1: Amount anomaly (0-75)
  if (activity.amount > 0) {
    const maxAmount = overrides.amountLimit != null ? overrides.amountLimit : (policies.max_amount || 500000);
    const highValue = overrides.amountLimit != null ? Math.floor(overrides.amountLimit * 0.2) : (policies.high_value || 100000);

    if (activity.amount > maxAmount) {
      totalScore += 65;
      factors.push({ factor: 'Transaction Amount Exceeds Limit', detail: `₹${Number(activity.amount).toLocaleString('en-IN')} exceeds maximum limit of ₹${maxAmount.toLocaleString('en-IN')}`, score: 65, maxScore: 75 });
    } else if (activity.amount > highValue) {
      const ratio = (activity.amount - highValue) / (maxAmount - highValue);
      const pts = Math.round(40 + ratio * 20);
      totalScore += pts;
      factors.push({ factor: 'High-Value Transaction', detail: `₹${Number(activity.amount).toLocaleString('en-IN')} exceeds high-value threshold`, score: pts, maxScore: 75 });
    } else if (activity.amount > highValue * 0.5) {
      const pts = Math.round((activity.amount / highValue) * 20);
      totalScore += pts;
      factors.push({ factor: 'Moderate Transaction Amount', detail: `₹${Number(activity.amount).toLocaleString('en-IN')} is a notable amount`, score: pts, maxScore: 75 });
    }
  }

  // Factor 2: Time-of-day anomaly (0-20)
  const hour = activity.hour != null ? activity.hour : new Date().getHours();
  const hoursStart = policies.hours_start || 7;
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

  // Factor 5: Role-action mismatch & Insider Threat (0-90)
  const rolePerms = {
    'Treasury Operator': ['withdraw', 'transfer', 'view_balance', 'approve_transaction'],
    'Loan Officer': ['loan_approval', 'loan_rejection', 'view_loans'],
    'Database Admin': ['bulk_data_export', 'view_customers', 'export']
  };
  const allowed = rolePerms[activity.role] || [];
  
  if (['Database Admin', 'Customer Support', 'IT'].includes(activity.role)) {
    // Insider Threat: Financial Fraud
    if (['withdraw', 'transfer'].includes(activity.action)) {
      totalScore += 75;
      factors.push({ factor: 'Insider Threat: Financial Abuse', detail: `"${activity.role}" attempting unauthorized financial transfer`, score: 75, maxScore: 75 });
    }
    // Insider Threat: Account Takeover
    else if (activity.action === 'modify_contact') {
      totalScore += 80;
      factors.push({ factor: 'Insider Threat: Account Takeover', detail: `Privileged user attempting silent contact modification`, score: 80, maxScore: 80 });
    }
    // Insider Threat: Physical Fraud
    else if (activity.action === 'issue_card') {
      totalScore += 95; // Instant Admin Approval required
      factors.push({ factor: 'Insider Threat: Physical Card Fraud', detail: `Privileged user attempting unauthorized card issuance`, score: 95, maxScore: 95 });
    }
    // General mismatch
    else if (activity.role && !allowed.includes(activity.action)) {
      totalScore += 10;
      factors.push({ factor: 'Role-Action Mismatch', detail: `"${activity.role}" performing "${activity.action}" is outside scope`, score: 10, maxScore: 10 });
    }
  } else if (activity.role && !allowed.includes(activity.action)) {
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

module.exports = { analyzeTransactionRisk, detectStructuringPattern };
