const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'banking.db');

async function debugHexOnly() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DB_PATH)) return;
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);
  
  const result = db.exec(`SELECT * FROM accounts LIMIT 2`);
  if (result.length > 0) {
    const cols = result[0].columns;
    result[0].values.forEach((row, rowIndex) => {
      console.log(`\n--- Row ${rowIndex} ---`);
      cols.forEach((col, i) => {
        const val = String(row[i]);
        const hex = Buffer.from(val).toString('hex');
        console.log(`${col} (hex): ${hex}`);
      });
    });
  }
}

debugHexOnly().catch(console.error);
