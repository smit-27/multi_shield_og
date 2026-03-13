/**
 * Policy Decision Engine — maps risk scores to 4-tier decisions
 * 
 * Tier 1 (0-39):  ALLOW           — No intervention
 * Tier 2 (40-59): JUSTIFY         — User must provide reason
 * Tier 3 (60-89): REQUIRE_MFA     — Multi-factor authentication required
 * Tier 4 (90-100): ADMIN_APPROVAL — Admin must approve/deny
 */
const { queryOne } = require('../db');

function makeDecision(riskScore, factors = []) {
  const justifyThreshold = queryOne("SELECT threshold FROM policies WHERE rule_type = 'justify_threshold' AND enabled = 1")?.threshold || 40;
  const mfaThreshold = queryOne("SELECT threshold FROM policies WHERE rule_type = 'mfa_threshold' AND enabled = 1")?.threshold || 60;
  const adminThreshold = queryOne("SELECT threshold FROM policies WHERE rule_type = 'admin_threshold' AND enabled = 1")?.threshold || 90;

  let decision, reason;

  if (riskScore >= adminThreshold) {
    decision = 'ADMIN_APPROVAL';
    const topFactors = factors.sort((a, b) => b.score - a.score).slice(0, 3).map(f => f.factor);
    reason = topFactors.length > 0 
      ? `Critical risk — ${topFactors.join('; ')}` 
      : `Risk score ${riskScore} requires admin approval`;
  } else if (riskScore >= mfaThreshold) {
    decision = 'REQUIRE_MFA';
    reason = `Risk score ${riskScore} requires multi-factor authentication`;
  } else if (riskScore >= justifyThreshold) {
    decision = 'JUSTIFY';
    reason = `Risk score ${riskScore} requires justification before proceeding`;
  } else {
    decision = 'ALLOW';
    reason = `Risk score ${riskScore} is within acceptable limits`;
  }

  return { decision, reason };
}

module.exports = { makeDecision };
