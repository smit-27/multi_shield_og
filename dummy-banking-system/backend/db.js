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
    db.run("INSERT INTO accounts VALUES ('ACC001','Treasury Main','treasury',250000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC002','Treasury Reserve','treasury',180000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC003','Loan Disbursement','operational',75000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC004','Inter-Bank Settlement','settlement',120000000,'INR','active',datetime('now'))");
    db.run("INSERT INTO accounts VALUES ('ACC005','Customer Deposits Pool','deposits',500000000,'INR','active',datetime('now'))");

    // Transactions
    db.run("INSERT INTO transactions VALUES ('TX001','ACC001','withdrawal',5000000,'Cash withdrawal — Branch 42','completed','treasury_01','2026-03-12 09:15:00')");
    db.run("INSERT INTO transactions VALUES ('TX002','ACC001','transfer',12000000,'Internal transfer to Reserve','completed','treasury_01','2026-03-12 10:30:00')");
    db.run("INSERT INTO transactions VALUES ('TX003','ACC002','deposit',25000000,'RBI settlement credit','completed','treasury_01','2026-03-12 11:00:00')");
    db.run("INSERT INTO transactions VALUES ('TX004','ACC003','withdrawal',8000000,'Loan disbursement batch','completed','loan_01','2026-03-11 14:20:00')");
    db.run("INSERT INTO transactions VALUES ('TX005','ACC004','transfer',45000000,'NEFT batch settlement','completed','treasury_01','2026-03-11 16:00:00')");
    db.run("INSERT INTO transactions VALUES ('TX006','ACC001','withdrawal',2000000,'Emergency cash withdrawal','blocked','treasury_01','2026-03-11 02:00:00')");
    db.run("INSERT INTO transactions VALUES ('TX007','ACC005','deposit',15000000,'Bulk deposit processing','completed','treasury_01','2026-03-10 12:45:00')");
    db.run("INSERT INTO transactions VALUES ('TX008','ACC002','transfer',30000000,'Inter-bank transfer','pending','treasury_01','2026-03-12 13:00:00')");

    // Loans
    db.run("INSERT INTO loans VALUES ('LN001','Vikram Industries Pvt Ltd','CUST001','business',50000000,10.5,60,'pending',NULL,NULL,'2026-03-10 10:00:00','2026-03-10 10:00:00')");
    db.run("INSERT INTO loans VALUES ('LN002','Sunita Reddy','CUST002','home',8500000,8.5,240,'pending',NULL,NULL,'2026-03-09 14:30:00','2026-03-09 14:30:00')");
    db.run("INSERT INTO loans VALUES ('LN003','TechCorp Solutions','CUST003','business',120000000,11.0,36,'approved',25,'loan_01','2026-03-08 09:00:00','2026-03-08 09:00:00')");
    db.run("INSERT INTO loans VALUES ('LN004','Anita Desai','CUST004','personal',500000,14.0,24,'approved',15,'loan_01','2026-03-07 11:20:00','2026-03-07 11:20:00')");
    db.run("INSERT INTO loans VALUES ('LN005','Global Exports Ltd','CUST005','business',200000000,9.5,48,'pending',NULL,NULL,'2026-03-11 16:00:00','2026-03-11 16:00:00')");
    db.run("INSERT INTO loans VALUES ('LN006','Ramesh Gupta','CUST006','home',3500000,8.75,180,'rejected',72,'loan_01','2026-03-06 10:00:00','2026-03-06 10:00:00')");

    // Customers
    db.run("INSERT INTO customers VALUES ('CUST001','Vikram Industries Pvt Ltd','info@vikram.co.in','9876543210','AABCV1234F','123456789012','Mumbai, Maharashtra','current',12500000,'medium',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST002','Sunita Reddy','sunita.r@email.com','9876543211','BRSPS5678G','234567890123','Hyderabad, Telangana','savings',850000,'low',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST003','TechCorp Solutions','contact@techcorp.in','9876543212','AABCT9012H','345678901234','Bengaluru, Karnataka','current',45000000,'low',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST004','Anita Desai','anita.d@email.com','9876543213','CRDPA3456J','456789012345','Delhi, NCR','savings',320000,'low',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST005','Global Exports Ltd','ops@globalexports.com','9876543214','AABCG7890K','567890123456','Chennai, Tamil Nadu','current',78000000,'high',datetime('now'),'active')");
    db.run("INSERT INTO customers VALUES ('CUST006','Ramesh Gupta','ramesh.g@email.com','9876543215','ERPGR1234L','678901234567','Pune, Maharashtra','savings',150000,'medium',datetime('now'),'active')");

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
