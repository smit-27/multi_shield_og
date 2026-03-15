const fs = require('fs');
const content = fs.readFileSync('db.js', 'utf8');
const hex = Buffer.from(content).toString('hex');
console.log(hex.match(/.{1,64}/g).join('\n'));
