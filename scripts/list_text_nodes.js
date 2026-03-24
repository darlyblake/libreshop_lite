const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const filePath = 'src/screens/StoreDetailScreen.tsx';
const code = fs.readFileSync(filePath, 'utf-8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  JSXText(p) {
    if (p.node.value.trim() !== '') {
      console.log(`Line ${p.node.loc.start.line}: "${p.node.value}"`);
    }
  }
});
