const { initDb, queryAll } = require('./db');

async function dump() {
  await initDb();
  console.log('=== ACCOUNTS ===');
  const accounts = queryAll('SELECT * FROM accounts');
  accounts.forEach(a => console.log(`${a.id}: ${a.account_name} | Balance: ${a.balance}`));
  
  console.log('\n=== CUSTOMERS ===');
  const customers = queryAll('SELECT * FROM customers');
  customers.forEach(c => console.log(`${c.id}: ${c.full_name} | Balance: ${c.balance}`));
  
  process.exit(0);
}

dump().catch(console.error);
