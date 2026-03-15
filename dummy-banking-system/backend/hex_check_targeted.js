const fs = require('fs');
const content = fs.readFileSync('db.js', 'utf8');
const search = 'Treasury Main';
const index = content.indexOf(search);
if (index !== -1) {
  const slice = content.slice(index - 20, index + 40);
  console.log('Context:', slice.replace(/[\r\n]/g, '\\n'));
  console.log('Hex:', Buffer.from(slice).toString('hex'));
} else {
  console.log('Not found');
}
