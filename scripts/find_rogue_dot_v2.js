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

const textComponents = ['Text', 'Animated.Text', 'TextInput', 'span', 'p'];

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
          while (parent && parent.node.type !== 'JSXElement' && parent.node.type !== 'JSXFragment') {
            parent = parent.parentPath;
          }
          if (parent && parent.node.type === 'JSXElement') {
            const nameNode = parent.node.openingElement.name;
            let name = '';
            if (nameNode.type === 'JSXIdentifier') name = nameNode.name;
            else if (nameNode.type === 'JSXMemberExpression') name = nameNode.object.name + '.' + nameNode.property.name;
            
            if (textComponents.includes(name)) {
              isInsideText = true;
            }
          }
          if (!isInsideText && p.node.value.trim().length > 0) {
             // Check if it's just whitespace and a dot
             if (p.node.value.match(/[^\s]/) && p.node.value.includes('.')) {
                console.log(`ROGUE DOT in ${filePath}:${p.node.loc.start.line} Context: "${p.node.value}" Parent: <${parent ? 'unknown' : 'none'}>`);
             }
          }
        }
      }
    });
  } catch(e) {}
});
