const fs = require('fs');
let content = fs.readFileSync('db.js', 'utf8');
// Replace any carriage returns or other odd characters with standard space or remove them
// But be careful not to break the code structure.
// Actually, let's just replace \r with nothing.
const originalLength = content.length;
content = content.replace(/\r(?!\n)/g, ''); // \r not followed by \n
content = content.replace(/\x00/g, ''); // null chars
content = content.replace(/\x1b/g, ''); // escape chars
content = content.replace(/\x01-\x08|\x0b-\x0c|\x0e-\x1f/g, ''); // other control chars

if (content.length !== originalLength) {
  console.log(`Cleaned ${originalLength - content.length} characters.`);
  fs.writeFileSync('db.js', content);
} else {
  console.log('No hidden characters found.');
}
