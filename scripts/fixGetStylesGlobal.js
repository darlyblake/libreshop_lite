const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const SRC_DIR = path.join(__dirname, '../src');
let count = 0;

walkDir(SRC_DIR, (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // We want to find the getStyles function and fix themeContext -> theme inside its body
  // Example: const getStyles = (theme: any) => { ... themeContext.getColor ... }
  
  if (content.includes('const getStyles = (theme: any)')) {
    const parts = content.split('const getStyles = (theme: any)');
    for (let i = 1; i < parts.length; i++) {
        // Find the block of the function
        let rest = parts[i];
        let braceCount = 0;
        let started = false;
        let bodyEnd = -1;
        
        for (let j = 0; j < rest.length; j++) {
            if (rest[j] === '{') {
                braceCount++;
                started = true;
            } else if (rest[j] === '}') {
                braceCount--;
            }
            if (started && braceCount === 0) {
                bodyEnd = j;
                break;
            }
        }
        
        if (bodyEnd !== -1) {
            let body = rest.substring(0, bodyEnd + 1);
            let newBody = body.replace(/themeContext\./g, 'theme.');
            if (newBody !== body) {
                parts[i] = newBody + rest.substring(bodyEnd + 1);
            }
        }
    }
    content = parts.join('const getStyles = (theme: any)');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    count++;
    console.log(`✅ Fixed: ${path.relative(SRC_DIR, filePath)}`);
  }
});

console.log(`\n🎉 Corrective automation complete. Fixed ${count} files.`);
