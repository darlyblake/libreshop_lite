const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return;
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
    traverse(ast, {
      JSXText(p) {
        if (p.node.value.trim() === '.') {
          const parent = p.parentPath.node;
          let parentName = 'unknown';
          if (parent.type === 'JSXElement') {
            const nameNode = parent.openingElement.name;
            if (nameNode.type === 'JSXIdentifier') parentName = nameNode.name;
            else if (nameNode.type === 'JSXMemberExpression') parentName = nameNode.object.name + '.' + nameNode.property.name;
          }
          console.log(`EXACT DOT in ${filePath}:${p.node.loc.start.line} Parent: <${parentName}>`);
        }
      }
    });
  } catch(e) {}
});
