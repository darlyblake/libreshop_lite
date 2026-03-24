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
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return;
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
    traverse(ast, {
      JSXText(p) {
        if (p.node.value.includes('.')) {
          let parent = p.parentPath;
          let isInsideText = false;
          while (parent) {
            if (parent.node.type === 'JSXElement') {
              const nameNode = parent.node.openingElement.name;
              let name = nameNode.name;
              if (nameNode.type === 'JSXMemberExpression') {
                 name = nameNode.object.name + '.' + nameNode.property.name;
              }
              if (name === 'Text' || name === 'Animated.Text' || name === 'TextInput' || name === 'span' || name === 'p') {
                isInsideText = true;
                break;
              }
            }
            parent = parent.parentPath;
          }
          if (!isInsideText) {
            console.log(`ROGUE DOT in ${filePath}:${p.node.loc.start.line} -> "${p.node.value}"`);
          }
        }
      },
      JSXExpressionContainer(p) {
        if (p.node.expression.type === 'StringLiteral' && p.node.expression.value.includes('.')) {
          let parent = p.parentPath;
          let isInsideText = false;
          while (parent) {
            if (parent.node.type === 'JSXElement') {
              const nameNode = parent.node.openingElement.name;
              let name = nameNode.name;
              if (nameNode.type === 'JSXMemberExpression') {
                 name = nameNode.object.name + '.' + nameNode.property.name;
              }
              if (name === 'Text' || name === 'Animated.Text' || name === 'TextInput') {
                isInsideText = true;
                break;
              }
            }
            parent = parent.parentPath;
          }
          if (!isInsideText) {
            console.log(`ROGUE STRING DOT in ${filePath}:${p.node.loc.start.line} -> "${p.node.expression.value}"`);
          }
        }
      }
    });
  } catch(e) { }
});
