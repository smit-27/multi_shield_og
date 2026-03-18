// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * AuditLogStore — Tamper-proof audit log hash storage
 * 
 * Stores SHA-256 hashes of audit log entries on Ethereum Sepolia testnet.
 * Only the contract owner can store hashes; anyone can read/verify them.
 * 
 * Deploy via Remix IDE (https://remix.ethereum.org):
 * 1. Paste this file → Compile with Solidity 0.8.19+
 * 2. Switch to "Deploy & Run" → Environment = "Injected Provider (MetaMask)"
 * 3. Make sure MetaMask is on Sepolia network
 * 4. Click "Deploy" → confirm the transaction
 * 5. Copy the deployed contract address → paste into .env as CONTRACT_ADDRESS
 */
contract AuditLogStore {
    mapping(uint256 => bytes32) private logHashes;
    address public owner;
    uint256 public totalLogs;

    event LogStored(uint256 indexed logId, bytes32 hash, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can store logs");
        _;
    }

    constructor() {
        owner = msg.sender;
        totalLogs = 0;
    }

    /**
     * Store a log hash on-chain.
     * @param _logId  The audit_log row ID from SQLite
     * @param _hash   The SHA-256 hash of the log entry (as bytes32)
     */
    function storeLog(uint256 _logId, bytes32 _hash) external onlyOwner {
        require(_hash != bytes32(0), "Hash cannot be empty");
        logHashes[_logId] = _hash;
        totalLogs++;
        emit LogStored(_logId, _hash, block.timestamp);
    }

    /**
     * Retrieve a stored log hash.
     * @param _logId  The audit_log row ID
     * @return The stored SHA-256 hash (bytes32), or 0x0 if not found
     */
    function getLog(uint256 _logId) external view returns (bytes32) {
        return logHashes[_logId];
    }
}
