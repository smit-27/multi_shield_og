const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'banking.db');

async function checkBalances() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DB_PATH)) {
    console.log('Database file not found');
    return;
  }
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);
  
  const accounts = db.exec('SELECT * FROM accounts');
  if (accounts.length > 0) {
    console.log('=== Accounts ===');
    const cols = accounts[0].columns;
    accounts[0].values.forEach(row => {
      const obj = {};
      cols.forEach((col, i) => obj[col] = row[i]);
      console.log(JSON.stringify(obj, null, 2));
    });
  } else {
    console.log('No accounts found');
  }
}

checkBalances().catch(console.error);
