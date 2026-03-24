const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx') && !filePath.endsWith('.js') && !filePath.endsWith('.ts')) return;
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
    traverse(ast, {
      JSXText(p) {
        if (p.node.value.trim() === '.') {
          console.log(`Found dot in ${filePath}:${p.node.loc.start.line} -> "${p.node.value}"`);
        }
      },
      JSXExpressionContainer(p) {
        if (p.node.expression.type === 'StringLiteral' && p.node.expression.value.trim() === '.') {
           console.log(`Found string dot in ${filePath}:${p.node.loc.start.line}`);
        }
      }
    });
  } catch(e) { }
});
