/**
 * Login Behavior Risk Engine — ML-based behavioral risk scoring
 * 
 * Uses the ML microservice to evaluate user login behavior patterns.
 * The ML model expects these 9 features:
 *   - avg_login_hour, num_devices, file_access_count, usb_activity,
 *     email_count, late_login, multi_device, large_file_activity, high_usb_usage
 * 
 * This engine is SEPARATE from the Transaction Risk Engine (transactionRiskEngine.js).
 * - Login Behavior → ML model (this file)
 * - Financial Transactions → Hardcoded rules (transactionRiskEngine.js)
 */
const { getMLRiskScore } = require('./mlClient');
const { detectStructuringPattern } = require('./transactionRiskEngine');

/**
 * Derive ML behavioral features from activity/login context.
 * In production these would come from a user behavior analytics store;
 * here we derive them from the available activity data.
 * 
 * @param {Object} activity - Activity context from request
 * @returns {Object} 9-feature vector for the ML model
 */
function deriveMLFeatures(activity) {
  const hour = activity.hour != null ? activity.hour : new Date().getHours();
  const device = (activity.device || '').toLowerCase();
  const amount = activity.amount || 0;

  return {
    avg_login_hour: hour,
    num_devices: device ? 2 : 1,
    file_access_count: ['bulk_data_export', 'export', 'bulk_download'].includes(activity.action) ? 15 : 3,
    usb_activity: amount > 500000 ? 8 : (amount > 100000 ? 4 : 1),
    email_count: 5,
    late_login: (hour < 8 || hour >= 20) ? 1 : 0,
    multi_device: device && !['internal workstation', 'office terminal', 'branch terminal'].some(d => device.includes(d)) ? 1 : 0,
    large_file_activity: ['bulk_data_export', 'export'].includes(activity.action) ? 1 : 0,
    high_usb_usage: amount > 500000 ? 1 : 0,
  };
}

/**
 * Analyze login behavior risk using the ML microservice.
 * Returns the ML behavioral risk score and explanation.
 * 
 * @param {Object} activity - Activity context
 * @returns {Promise<{ score: number, factors: Array, ml_score: number, ml_explanation: string[] }>}
 */
async function analyzeLoginBehaviorRisk(activity) {
  const mlFeatures = deriveMLFeatures(activity);
  
  let mlResult;
  try {
    mlResult = await getMLRiskScore(mlFeatures);
  } catch(err) {
    mlResult = { risk_score: 50, explanation: ['fallback - ML unavailable'] };
  }
  const mlScore = mlResult.risk_score;

  let structuringFlag = false;
  let structuringDelta = 0;
  let blockFlag = false;
  let finalRiskScore = mlScore;
  let matchCount = 0;
  let patternType = null;

  try {
    if (activity.amount > 0) {
      // destinationAccount could be passed explicitly from bankingProxy or parsed from details.
      const structResult = await detectStructuringPattern(activity.user_id, activity.amount, activity.destinationAccount);
      matchCount = structResult.matchCount;
      patternType = structResult.patternType;

      if (matchCount === 1) { structuringDelta = 25; structuringFlag = true; }
      else if (matchCount === 2) { structuringDelta = 40; structuringFlag = true; }
      else if (matchCount >= 3) { structuringDelta = 100 - mlScore; structuringFlag = true; blockFlag = true; }

      finalRiskScore = Math.min(100, Math.max(0, mlScore + structuringDelta));
      if (blockFlag) finalRiskScore = 100;
    }
  } catch (err) {
    console.error('[ZTA] Structuring detection failed:', err);
  }

  const mlExplanationText = mlResult.explanation.join(', ');
  const factors = [
    {
      factor: 'ML Login Behavior Analysis',
      detail: `ML model scored ${mlScore}/100 — key factors: ${mlExplanationText}`,
      score: mlScore,
      maxScore: 100,
    },
  ];

  if (structuringFlag) {
    factors.push({
      factor: 'Structuring / Repetitive Pattern Detected',
      detail: `${matchCount} identical transaction(s) found in trailing 24h. Delta applied: +${structuringDelta}.`,
      score: structuringDelta,
      maxScore: 100
    });
  }

  return {
    score: finalRiskScore,
    factors,
    ml_score: mlScore,
    ml_explanation: mlResult.explanation,
    structuringDelta,
    finalRiskScore,
    structuringFlag,
    matchCount,
    patternType,
    blockFlag
  };
}

module.exports = { analyzeLoginBehaviorRisk, deriveMLFeatures };
