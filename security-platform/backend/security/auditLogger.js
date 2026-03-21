/**
 * Audit Logger — Centralized tamper-proof audit log system
 * 
 * Replaces raw `INSERT INTO audit_log` calls across the codebase.
 * Each log entry is:
 *   1. Formatted with event_type, details, performed_by, timestamp
 *   2. SHA-256 hashed
 *   3. Stored in SQLite (with hash)
 *   4. Hash sent to Ethereum Sepolia (async, non-blocking)
 */
const crypto = require('crypto');
const { runSql, queryOne } = require('../db');
const { storeLogHash, verifyLogIntegrity } = require('./blockchainClient');

/**
 * Generate a SHA-256 hash of a log entry.
 * The hash is deterministic — same inputs always produce the same hash.
 * 
 * @param {string} eventType   - e.g. 'risk_analysis', 'zta_login'
 * @param {string} details     - JSON string of log details
 * @param {string} performedBy - user ID or 'system'
 * @param {string} timestamp   - ISO timestamp
 * @returns {string} SHA-256 hex hash (64 characters)
 */
function generateLogHash(eventType, details, performedBy, timestamp) {
  const payload = JSON.stringify({
    event_type: eventType,
    details: details,
    performed_by: performedBy,
    timestamp: timestamp
  });
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Create an audit log entry with blockchain anchoring.
 * 
 * This is the main function that replaces all raw `INSERT INTO audit_log` calls.
 * The blockchain transaction is non-blocking — it happens in the background.
 * 
 * @param {string} eventType   - Event type (e.g. 'risk_analysis', 'zta_login')
 * @param {object|string} details - Log details (object will be JSON.stringify'd)
 * @param {string} performedBy - Who performed the action (user ID or 'system')
 * @returns {{ logId: number, hash: string }} - The log ID and its SHA-256 hash
 */
function logAuditEvent(eventType, details, performedBy) {
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
  const timestamp = new Date().toISOString();
  
  // Generate SHA-256 hash
  const hash = generateLogHash(eventType, detailsStr, performedBy, timestamp);
  
  // Store in SQLite (synchronous)
  const result = runSql(
    "INSERT INTO audit_log (event_type, details, performed_by, sha256_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    [eventType, detailsStr, performedBy, hash, timestamp]
  );
  
  const logId = result.lastInsertRowid;
  
  // Send hash to blockchain (async, non-blocking — fire and forget)
  storeLogHash(logId, hash)
    .then(txResult => {
      if (txResult) {
        // Update the DB with the blockchain transaction hash
        runSql(
          "UPDATE audit_log SET blockchain_tx_hash = ? WHERE id = ?",
          [txResult.txHash, logId]
        );
        console.log(`🔗 [Audit] Log #${logId} anchored to blockchain — tx: ${txResult.txHash}`);
      }
    })
    .catch(err => {
      console.error(`⚠️  [Audit] Blockchain anchoring failed for log #${logId}:`, err.message);
      // Log is still safely stored in SQLite — blockchain is a secondary guarantee
    });
  
  return { logId, hash };
}

/**
 * Verify the integrity of an audit log entry.
 * 
 * 1. Fetches the log from SQLite
 * 2. Recomputes its SHA-256 hash from raw data
 * 3. Compares with the stored hash
 * 4. Compares with the on-chain hash (if available)
 * 
 * @param {number} logId - The audit_log row ID
 * @returns {Promise<object>} Verification result
 */
async function verifyAuditLog(logId) {
  // Fetch from database
  const log = queryOne('SELECT * FROM audit_log WHERE id = ?', [logId]);
  if (!log) {
    return { verified: false, error: 'Log entry not found', logId };
  }
  
  // Recompute hash from raw data
  const recomputedHash = generateLogHash(
    log.event_type,
    log.details,
    log.performed_by,
    log.created_at
  );
  
  // Check if stored hash matches recomputed hash (local integrity)
  const localMatch = recomputedHash === log.sha256_hash;
  
  // Check against blockchain (if available)
  let blockchainResult = null;
  if (log.sha256_hash) {
    blockchainResult = await verifyLogIntegrity(logId, log.sha256_hash);
  }
  
  return {
    logId,
    verified: true,
    event_type: log.event_type,
    performed_by: log.performed_by,
    created_at: log.created_at,
    local_integrity: {
      stored_hash: log.sha256_hash,
      recomputed_hash: recomputedHash,
      match: localMatch,
      status: localMatch ? 'INTACT' : 'TAMPERED'
    },
    blockchain_integrity: blockchainResult ? {
      chain_hash: blockchainResult.chainHash,
      match: blockchainResult.match,
      status: blockchainResult.match ? 'VERIFIED ON-CHAIN' : (blockchainResult.chainHash ? 'CHAIN MISMATCH' : 'NOT ON CHAIN YET'),
      tx_hash: log.blockchain_tx_hash || null
    } : {
      status: 'BLOCKCHAIN NOT CONFIGURED',
      chain_hash: null,
      match: null,
      tx_hash: null
    },
    overall_status: !localMatch ? 'INTEGRITY_COMPROMISED' :
      (blockchainResult?.match === false && blockchainResult?.chainHash) ? 'INTEGRITY_COMPROMISED' :
      blockchainResult?.match === true ? 'FULLY_VERIFIED' :
      'LOCAL_ONLY_VERIFIED'
  };
}

module.exports = {
  logAuditEvent,
  verifyAuditLog,
  generateLogHash
};
