const { initDb, queryAll } = require('./db');

async function check() {
  await initDb();
  const accounts = queryAll('SELECT * FROM accounts');
  console.log('--- ACCOUNTS ---');
  accounts.forEach(a => {
    console.log(`${a.id}: ${a.account_name} | Balance: ${a.balance} (${typeof a.balance}) | Status: ${a.status}`);
  });
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
