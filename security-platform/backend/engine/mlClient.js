/**
 * ML Risk Scoring Client
 * 
 * Calls the ML microservice (multishield-ml) for behavioral risk scoring.
 * Falls back gracefully to a neutral score if the service is unavailable.
 */

// In Docker: container name 'multishield-ml' resolves via Docker DNS
// Locally: fallback to localhost:8000
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://multishield-ml:8000';
const ML_FALLBACK_URL = 'http://localhost:8000';

/**
 * Get ML-based behavioral risk score from the microservice.
 * 
 * @param {Object} features - Behavioral feature vector
 * @returns {Object} { risk_score: number, explanation: string[] }
 */
async function getMLRiskScore(features) {
  const fallbackResult = {
    risk_score: 50,
    explanation: ['ML service unavailable — using neutral fallback score'],
  };

  try {
    let response;
    try {
      response = await fetch(`${ML_SERVICE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(3000), // 3s timeout
      });
    } catch (primaryErr) {
      // Docker DNS may not resolve locally — try localhost fallback
      response = await fetch(`${ML_FALLBACK_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
        signal: AbortSignal.timeout(3000),
      });
    }

    if (!response.ok) {
      console.warn(`[ML Client] Service returned ${response.status}`);
      return fallbackResult;
    }

    const data = await response.json();
    return {
      risk_score: data.risk_score ?? 50,
      explanation: data.explanation ?? data.top_features ?? ['No explanation provided'],
    };
  } catch (err) {
    console.warn('[ML Client] Service unavailable, using fallback:', err.message);
    return fallbackResult;
  }
}

module.exports = { getMLRiskScore };
