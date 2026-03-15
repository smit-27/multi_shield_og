const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'banking.db');

async function debugDb() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DB_PATH)) {
    console.log('Database file not found');
    return;
  }
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);
  
  const tables = ['users', 'accounts', 'customers'];
  
  for (const table of tables) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    const result = db.exec(`SELECT * FROM ${table}`);
    if (result.length > 0) {
      const cols = result[0].columns;
      result[0].values.forEach(row => {
        const obj = {};
        cols.forEach((col, i) => {
          let val = row[i];
          if (typeof val === 'string') {
            // Escape special characters for visibility
            val = val.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
          }
          obj[col] = val;
        });
        console.log(JSON.stringify(obj));
      });
    }
  }
}

debugDb().catch(console.error);
