/**
 * Fix CommonJS build by adding package.json with type: commonjs
 * and converting .js imports to not use .js extension
 */

import { writeFileSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const distCjs = './dist/cjs';

// Add package.json to mark as CommonJS
writeFileSync(
  join(distCjs, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2)
);

// Fix .js imports in require statements
function fixImports(dir) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      fixImports(filePath);
    } else if (file.endsWith('.js')) {
      let content = readFileSync(filePath, 'utf8');
      // Replace require("./xxx.js") with require("./xxx")
      content = content.replace(/require\("(\.\/[^"]+)\.js"\)/g, 'require("$1")');
      writeFileSync(filePath, content);
    }
  }
}

fixImports(distCjs);

console.log('Fixed CJS build');
