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

  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL,
    details TEXT, performed_by TEXT, created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Seed policies
  const result = db.exec('SELECT COUNT(*) as count FROM policies');
  const count = result[0]?.values[0]?.[0] || 0;

  if (count === 0) {
    const policies = [
      ['POL001', 'Max Single Transaction', 'transaction', 'max_amount', 10000000, 'Maximum amount for a single transaction (₹1 Crore)'],
      ['POL002', 'High Value Threshold', 'transaction', 'high_value', 5000000, 'Transactions above this are flagged (₹50 Lakhs)'],
      ['POL003', 'Allowed Hours Start', 'time', 'hours_start', 8, 'Operating hours start (8 AM)'],
      ['POL004', 'Allowed Hours End', 'time', 'hours_end', 20, 'Operating hours end (8 PM)'],
      ['POL005', 'Max Records Export', 'data', 'max_export', 100, 'Max records in single export'],
      ['POL006', 'Export Cooldown (min)', 'data', 'export_cooldown', 30, 'Min minutes between bulk exports'],
      ['POL007', 'Max Loan Approval', 'loan', 'max_loan', 100000000, 'Max loan without escalation (₹10 Cr)'],
      ['POL008', 'MFA Threshold', 'risk', 'mfa_threshold', 41, 'Risk score requiring MFA'],
      ['POL009', 'Block Threshold', 'risk', 'block_threshold', 71, 'Risk score that blocks action'],
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
