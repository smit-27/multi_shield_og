/**
 * Policy Decision Engine — maps risk scores to decisions
 */
const { queryOne } = require('../db');

function makeDecision(riskScore, factors = []) {
  const mfaThreshold = queryOne("SELECT threshold FROM policies WHERE rule_type = 'mfa_threshold' AND enabled = 1")?.threshold || 41;
  const blockThreshold = queryOne("SELECT threshold FROM policies WHERE rule_type = 'block_threshold' AND enabled = 1")?.threshold || 71;

  let decision, reason;

  if (riskScore >= blockThreshold) {
    decision = 'BLOCK';
    const topFactors = factors.sort((a, b) => b.score - a.score).slice(0, 3).map(f => f.factor);
    reason = topFactors.length > 0 ? topFactors.join('; ') : `Risk score ${riskScore} exceeds block threshold`;
  } else if (riskScore >= mfaThreshold) {
    decision = 'REQUIRE_MFA';
    reason = `Risk score ${riskScore} requires additional verification`;
  } else {
    decision = 'ALLOW';
    reason = `Risk score ${riskScore} is within acceptable limits`;
  }

  return { decision, reason };
}

module.exports = { makeDecision };
