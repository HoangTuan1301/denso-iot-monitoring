const fs = require('fs');

async function dump() {
  const code = fs.readFileSync('src/features/dashboard/factoryMapConfig.ts', 'utf8');
  // Match từng zone
  const regex = /{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)'[^}]*?x:\s*([0-9.]+),\s*y:\s*([0-9.]+),\s*w:\s*([0-9.]+),\s*h:\s*([0-9.]+)/gs;
  let match;
  let count = 0;
  while ((match = regex.exec(code)) !== null) {
    count++;
    console.log(`${count}. [${match[1]}] x=${match[3]}, y=${match[4]}, w=${match[5]}, h=${match[6]} - ${match[2]}`);
  }
}

dump();
