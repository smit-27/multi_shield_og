const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'banking.db');
let db = null;

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// Auto-save every 5 seconds
setInterval(saveDb, 5000);

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      email TEXT,
      last_login TEXT,
      status TEXT DEFAULT 'active'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'completed',
      performed_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      applicant_name TEXT NOT NULL,
      applicant_id TEXT NOT NULL,
      loan_type TEXT NOT NULL,
      amount REAL NOT NULL,
      interest_rate REAL,
      tenure_months INTEGER,
      status TEXT DEFAULT 'pending',
      risk_score REAL,
      reviewed_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      pan TEXT,
      aadhar TEXT,
      address TEXT,
      account_type TEXT,
      balance REAL DEFAULT 0,
      risk_category TEXT DEFAULT 'low',
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'active'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      device TEXT,
      risk_score REAL,
      decision TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ─── Seed Data ───
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  const userCount = result[0]?.values[0]?.[0] || 0;

  if (userCount === 0) {
    // Users
    db.run("INSERT INTO users VALUES ('treasury_01','rajesh.kumar','pass123','Rajesh Kumar','Treasury Operator','Treasury','rajesh.kumar@bank.com',NULL,'active')");
    db.run("INSERT INTO users VALUES ('loan_01','priya.sharma','pass123','Priya Sharma','Loan Officer','Loans','priya.sharma@bank.com',NULL,'active')");
    db.run("INSERT INTO users VALUES ('db_admin_01','amit.patel','pass123','Amit Patel','Database Admin','IT','amit.patel@bank.com',NULL,'active')");

    // Accounts
    db.run("INSERT INTO accounts VALUES ('ACC001','Treasury Main','treasury',5000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC002','Treasury Reserve','treasury',4000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC003','Loan Disbursement','operational',3000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC004','Inter-Bank Settlement','settlement',2000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC005','Customer Deposits Pool','deposits',5000000,'INR','active',datetime('now'))");

    // Transactions (No dummy data)
    // Loans (No dummy data)

    // Customers
    db.run("INSERT INTO customers VALUES ('CUST001','Vikram Industries Pvt Ltd','info@vikram.co.in','9876543210','AABCV1234F','123456789012','Mumbai, Maharashtra','current',500000,'medium',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST002','Sunita Reddy','sunita.r@email.com','9876543211','BRSPS5678G','234567890123','Hyderabad, Telangana','savings',150000,'low',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST003','TechCorp Solutions','contact@techcorp.in','9876543212','AABCT9012H','345678901234','Bengaluru, Karnataka','current',800000,'low',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST004','Anita Desai','anita.d@email.com','9876543213','CRDPA3456J','456789012345','Delhi, NCR','savings',250000,'low',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST005','Global Exports Ltd','ops@globalexports.com','9876543214','AABCG7890K','567890123456','Chennai, Tamil Nadu','current',900000,'high',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST006','Ramesh Gupta','ramesh.g@email.com','9876543215','ERPGR1234L','678901234567','Pune, Maharashtra','savings',100000,'medium',datetime('now'),'active')");

    saveDb();
    console.log('✅ Database seeded with demo data');
  }

  return db;
}

// Helper to convert sql.js results to objects
function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (e) {
    console.error('Query error:', sql, e.message);
    return [];
  }
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results[0] || null;
}

function runSql(sql, params = []) {
  try {
    db.run(sql, params);
    const lastId = db.exec('SELECT last_insert_rowid()');
    const changes = db.getRowsModified();
    saveDb();
    return {
      lastInsertRowid: lastId[0]?.values[0]?.[0] || 0,
      changes
    };
  } catch (e) {
    console.error('Run error:', sql, e.message);
    return { lastInsertRowid: 0, changes: 0 };
  }
}

module.exports = { initDb, queryAll, queryOne, runSql, getDb: () => db };
