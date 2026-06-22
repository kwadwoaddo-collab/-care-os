const fs = require('fs');
const files = [
  'scripts/add-company-ctx.js',
  'scripts/add-company-scope.js',
  'scripts/audit-company-scope.js',
  'scripts/migrate-auth.js',
  'test-db.js'
];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes('eslint-disable')) {
    fs.writeFileSync(f, '/* eslint-disable @typescript-eslint/no-require-imports */\n' + content);
  }
});
