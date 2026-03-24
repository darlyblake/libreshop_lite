const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.resolve(__dirname, '..');

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', 'web-build', '.git', 'scripts'].includes(ent.name)) continue;
      walk(full, cb);
    } else if (/\.(tsx|jsx|ts|js)$/.test(ent.name)) {
      cb(full);
    }
  }
}

const matches = [];

walk(root, (file) => {
  // only scan src/
  if (!file.includes(path.join('LibreShop', 'src') ) && !file.includes(path.sep + 'src' + path.sep)) return;
  try {
    const code = fs.readFileSync(file, 'utf8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'decorators-legacy',
        'optionalChaining',
        'nullishCoalescingOperator',
      ],
      errorRecovery: true,
      ranges: false,
      tokens: false,
    });

    traverse(ast, {
      JSXText(pathNode) {
        const val = pathNode.node.value || '';
        if (val.trim() === '.') {
          matches.push({ file, loc: pathNode.node.loc && pathNode.node.loc.start, type: 'JSXText', value: val.trim() });
        }
      },
      JSXExpressionContainer(pathNode) {
        const expr = pathNode.node.expression;
        if (!expr) return;
        // {' . '} or {'.'} or {"."}
        if (expr.type === 'StringLiteral' && expr.value.trim() === '.') {
          matches.push({ file, loc: expr.loc && expr.loc.start, type: 'StringLiteral in JSXExpression', value: expr.value });
        }
        // template literal with single dot
        if (expr.type === 'TemplateLiteral' && expr.quasis && expr.quasis.length === 1) {
          const raw = expr.quasis[0].value && expr.quasis[0].value.cooked;
          if (raw && raw.trim() === '.') {
            matches.push({ file, loc: expr.loc && expr.loc.start, type: 'TemplateLiteral in JSXExpression', value: raw });
          }
        }
      }
    });
  } catch (err) {
    // parse errors ignored
  }
});

if (matches.length === 0) {
  console.log('No dot-only JSX text nodes found via AST scan.');
  process.exit(0);
}

for (const m of matches) {
  console.log(`${m.file}:${m.loc ? m.loc.line + ':' + m.loc.column : '?:?'} -> ${m.type} -> "${m.value}"`);
}

console.log(`\nFound ${matches.length} matches.`);
