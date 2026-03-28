const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'security.db');
let db = null;

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

setInterval(saveDb, 5000);

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    rule_type TEXT NOT NULL, threshold REAL, value TEXT, enabled INTEGER DEFAULT 1,
    description TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT, role TEXT,
    action TEXT NOT NULL, amount REAL DEFAULT 0, timestamp TEXT, hour INTEGER,
    device TEXT, ip_address TEXT, details TEXT, metadata TEXT,
    risk_score REAL, decision TEXT, reason TEXT, factors TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER, user_id TEXT NOT NULL,
    role TEXT, action TEXT NOT NULL, amount REAL DEFAULT 0, risk_score REAL NOT NULL,
    decision TEXT NOT NULL, reason TEXT, factors TEXT, status TEXT DEFAULT 'open',
    resolution TEXT, resolved_by TEXT, resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    destinationAccount TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    status TEXT NOT NULL,
    mlScore REAL,
    structuringDelta REAL,
    finalRiskScore REAL,
    structuringFlag INTEGER DEFAULT 0,
    matchCount INTEGER DEFAULT 0,
    patternType TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL,
    details TEXT, performed_by TEXT,
    sha256_hash TEXT,
    blockchain_tx_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS mfa_challenges (
    id TEXT PRIMARY KEY,
    incident_id INTEGER,
    user_id TEXT NOT NULL,
    username TEXT,
    role TEXT,
    action TEXT NOT NULL,
    amount REAL DEFAULT 0,
    risk_score REAL,
    status TEXT DEFAULT 'pending',
    step INTEGER DEFAULT 0,
    otp_code TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER,
    user_id TEXT NOT NULL,
    username TEXT,
    role TEXT,
    action TEXT NOT NULL,
    amount REAL DEFAULT 0,
    risk_score REAL,
    user_message TEXT,
    admin_response TEXT,
    status TEXT DEFAULT 'pending',
    expires_at TEXT,
    resolved_by TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // ─── ZTA Tables ───

  db.run(`CREATE TABLE IF NOT EXISTS account_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    reason TEXT,
    locked_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    resolved INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS zta_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trust_level TEXT DEFAULT 'standard',
    ip_address TEXT,
    last_verified TEXT,
    step_up_completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS zta_step_up_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT,
    role TEXT,
    action TEXT NOT NULL,
    amount REAL DEFAULT 0,
    risk_score REAL,
    status TEXT DEFAULT 'pending',
    current_step INTEGER DEFAULT 0,
    otp_code TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    expires_at TEXT
  )`);
  
  // Migration for existing databases
  try { db.run("ALTER TABLE zta_step_up_challenges ADD COLUMN otp_code TEXT"); } catch (e) { /* ignore if already exists */ }


  db.run(`CREATE TABLE IF NOT EXISTS banking_tokens (
    session_id TEXT PRIMARY KEY,
    banking_token TEXT NOT NULL
  )`);

  // Seed policies
  const result = db.exec('SELECT COUNT(*) as count FROM policies');
  const count = result[0]?.values[0]?.[0] || 0;

  if (count === 0) {
    const policies = [
      ['POL001', 'Max Single Transaction', 'transaction', 'max_amount', 500000, 'Maximum amount for a single transaction (₹5 Lakhs)'],
      ['POL002', 'High Value Threshold', 'transaction', 'high_value', 100000, 'Transactions above this are flagged (₹1 Lakh)'],
      ['POL003', 'Allowed Hours Start', 'time', 'hours_start', 8, 'Operating hours start (8 AM)'],
      ['POL004', 'Allowed Hours End', 'time', 'hours_end', 20, 'Operating hours end (8 PM)'],
      ['POL005', 'Max Records Export', 'data', 'max_export', 100, 'Max records in single export'],
      ['POL006', 'Export Cooldown (min)', 'data', 'export_cooldown', 30, 'Min minutes between bulk exports'],
      ['POL007', 'Max Loan Approval', 'loan', 'max_loan', 100000000, 'Max loan without escalation (₹10 Cr)'],
      ['POL008', 'Justify Threshold', 'risk', 'justify_threshold', 40, 'Risk score requiring justification (Tier 2)'],
      ['POL009', 'MFA Threshold', 'risk', 'mfa_threshold', 60, 'Risk score requiring MFA (Tier 3)'],
      ['POL010', 'Admin Approval Threshold', 'risk', 'admin_threshold', 90, 'Risk score requiring admin approval (Tier 4)'],
    ];
    policies.forEach(([id, name, cat, rule, thresh, desc]) => {
      db.run("INSERT INTO policies VALUES (?,?,?,?,?,NULL,1,?,datetime('now'),datetime('now'))", [id, name, cat, rule, thresh, desc]);
    });
    saveDb();
    console.log('✅ Security policies seeded');
  }

  return db;
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  } catch (e) {
    console.error('Query error:', sql, e.message);
    return [];
  }
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function runSql(sql, params = []) {
  try {
    db.run(sql, params);
    const lastId = db.exec('SELECT last_insert_rowid()');
    const changes = db.getRowsModified();
    saveDb();
    return { lastInsertRowid: lastId[0]?.values[0]?.[0] || 0, changes };
  } catch (e) {
    console.error('Run error:', sql, e.message);
    return { lastInsertRowid: 0, changes: 0 };
  }
}

module.exports = { initDb, queryAll, queryOne, runSql, getDb: () => db };
