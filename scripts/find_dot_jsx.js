const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'web-build' || ent.name === '.git' || ent.name === 'scripts') continue;
      walk(full, cb);
    } else if (/\.(tsx|jsx|ts|js)$/.test(ent.name)) {
      cb(full);
    }
  }
}

const results = [];

walk(root, (file) => {
  try {
    const content = fs.readFileSync(file, 'utf8');

    const re1 = />\s*\.\s*</g; // > . <
    const re2 = /\{\s*'\.+'\s*\}/g; // {'...'}
    const re3 = /<Text[^>]*>\s*\.\s*<\/Text>/g; // <Text>.</Text>
    const re4 = />\s*\{\s*"\."\s*\}\s*</g; // >{"."}<

    const matches = [];
    if (re1.test(content)) matches.push('> . < pattern');
    if (re2.test(content)) matches.push('{\'.\'} pattern');
    if (re3.test(content)) matches.push('<Text>.</Text> pattern');
    if (re4.test(content)) matches.push('>{"."}< pattern');

    if (matches.length > 0) {
      results.push({ file, matches });
    }
  } catch (e) {
    // ignore
  }
});

if (results.length === 0) {
  console.log('No dot-only JSX text nodes found by heuristic checks.');
  process.exit(0);
}

for (const r of results) {
  console.log('File:', r.file);
  for (const m of r.matches) console.log('  -', m);
}

console.log('\nHeuristic scan complete. If nothing found, consider running an AST-based search.');
