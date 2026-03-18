/**
 * Blockchain Client — Ethereum Sepolia integration for audit log hashes
 * 
 * Connects to the deployed AuditLogStore smart contract via ethers.js.
 * Uses a free public RPC endpoint (no API keys required).
 */
require('dotenv').config();
const { ethers } = require('ethers');

// ── Contract ABI (only the functions we need) ──
const CONTRACT_ABI = [
  'function storeLog(uint256 _logId, bytes32 _hash) external',
  'function getLog(uint256 _logId) external view returns (bytes32)',
  'function totalLogs() external view returns (uint256)',
  'function owner() external view returns (address)',
  'event LogStored(uint256 indexed logId, bytes32 hash, uint256 timestamp)'
];

// ── Configuration ──
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

let provider = null;
let wallet = null;
let contract = null;
let readOnlyContract = null;
let isInitialized = false;

/**
 * Initialize the blockchain connection.
 * Silently skips if environment variables are not configured.
 */
function initBlockchain() {
  if (isInitialized) return true;

  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x_your_deployed_contract_address') {
    console.warn('⚠️  [Blockchain] CONTRACT_ADDRESS not configured — blockchain logging disabled');
    return false;
  }

  if (!PRIVATE_KEY || PRIVATE_KEY === 'your_wallet_private_key_here') {
    console.warn('⚠️  [Blockchain] WALLET_PRIVATE_KEY not configured — blockchain logging disabled');
    return false;
  }

  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    readOnlyContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    isInitialized = true;
    console.log('🔗 [Blockchain] Connected to Sepolia testnet');
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Wallet:   ${wallet.address}`);
    return true;
  } catch (err) {
    console.error('❌ [Blockchain] Init failed:', err.message);
    return false;
  }
}

/**
 * Store a log hash on the blockchain.
 * @param {number} logId    - The audit_log row ID from SQLite
 * @param {string} sha256Hash - The SHA-256 hex string (64 chars)
 * @returns {Promise<{txHash: string, blockNumber: number} | null>}
 */
async function storeLogHash(logId, sha256Hash) {
  if (!initBlockchain()) return null;

  try {
    // Convert the SHA-256 hex string to bytes32
    const hashBytes = '0x' + sha256Hash;
    
    console.log(`📤 [Blockchain] Storing hash for log #${logId}...`);
    const tx = await contract.storeLog(logId, hashBytes);
    const receipt = await tx.wait();
    
    console.log(`✅ [Blockchain] Hash stored — tx: ${receipt.hash}, block: ${receipt.blockNumber}`);
    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  } catch (err) {
    console.error(`❌ [Blockchain] Failed to store hash for log #${logId}:`, err.message);
    return null;
  }
}

/**
 * Retrieve a log hash from the blockchain.
 * @param {number} logId - The audit_log row ID
 * @returns {Promise<string | null>} - The SHA-256 hash hex string, or null
 */
async function getLogHash(logId) {
  if (!initBlockchain()) return null;

  try {
    const hashBytes = await readOnlyContract.getLog(logId);
    
    // bytes32(0) means no hash stored
    if (hashBytes === ethers.ZeroHash) {
      return null;
    }
    
    // Remove the '0x' prefix to return raw hex
    return hashBytes.slice(2);
  } catch (err) {
    console.error(`❌ [Blockchain] Failed to retrieve hash for log #${logId}:`, err.message);
    return null;
  }
}

/**
 * Verify a log's integrity by comparing local hash with on-chain hash.
 * @param {number} logId      - The audit_log row ID
 * @param {string} localHash  - The locally computed SHA-256 hash
 * @returns {Promise<{verified: boolean, localHash: string, chainHash: string | null, match: boolean}>}
 */
async function verifyLogIntegrity(logId, localHash) {
  const chainHash = await getLogHash(logId);
  
  if (!chainHash) {
    return {
      verified: false,
      localHash,
      chainHash: null,
      match: false,
      reason: 'Hash not found on blockchain'
    };
  }

  const match = localHash.toLowerCase() === chainHash.toLowerCase();
  return {
    verified: true,
    localHash: localHash.toLowerCase(),
    chainHash: chainHash.toLowerCase(),
    match,
    reason: match ? 'Log integrity verified ✓' : 'TAMPER DETECTED — hashes do not match!'
  };
}

/**
 * Get blockchain connection status.
 */
function getBlockchainStatus() {
  return {
    initialized: isInitialized,
    rpcUrl: RPC_URL,
    contractAddress: CONTRACT_ADDRESS || 'not configured',
    walletAddress: wallet?.address || 'not configured'
  };
}

module.exports = {
  initBlockchain,
  storeLogHash,
  getLogHash,
  verifyLogIntegrity,
  getBlockchainStatus
};
