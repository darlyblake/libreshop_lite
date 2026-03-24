const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = path.join(__dirname, '../src/components');

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Check if it imports from config/theme
  if (!content.includes('config/theme')) {
    return false;
  }

  const hasShadows = content.match(/import\s+{.*SHADOWS.*}\s+from\s+['"]\.\.\/config\/theme['"]/);

  // Replace import
  content = content.replace(/import\s+{([^}]*)}\s+from\s+['"]\.\.\/config\/theme['"];?/, (match, p1) => {
    let newImport = `import { useTheme } from '../hooks/useTheme';`;
    if (p1.includes('SHADOWS')) {
      newImport += `\nimport { SHADOWS } from '../config/theme';`;
    }
    return newImport;
  });

  const isStylesOutside = /^const styles = StyleSheet\.create\({/m.test(content);
  const isStylesInside = /^\s+const styles = StyleSheet\.create\({/m.test(content);

  // 2. Wrap styles if outside
  if (isStylesOutside) {
     content = content.replace(/^const styles = StyleSheet\.create\({/m, 
`const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({`);
     
     // Find the closing bracket of StyleSheet.create
     content = content.replace(/}\);(\s*)$/, '});\n};$1');
  }

  // 3. Inject hook inside the functional component
  const componentRegex = /(export\s+(?:default\s+)?(?:const\s+\w+\s*(?::\s*React\.FC(?:<[^>]+>)?\s*)?=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>\s*{|function\s+\w+\([^)]*\)\s*{))/g;
  
  let matches = [];
  let match;
  while ((match = componentRegex.exec(content)) !== null) {
      matches.push(match);
  }

  if (matches.length > 0) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      let injection = `\n  const { theme } = useTheme();\n  const COLORS = theme.getColor;\n  const SPACING = theme.spacing;\n  const RADIUS = theme.radius;\n  const FONT_SIZE = theme.fontSize;\n`;
      
      if (isStylesOutside) {
        injection += `  const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(theme) : {}, [theme]);\n`;
      }
      content = content.slice(0, m.index + m[0].length) + injection + content.slice(m.index + m[0].length);
    }
  }

  // 4. Fix React import if missing useMemo and we use it
  if (isStylesOutside && !content.includes('useMemo') && !content.includes('import React')) {
    content = `import React from 'react';\n` + content;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Migrated ${path.basename(filePath)}`);
  return true;
}

const files = fs.readdirSync(COMPONENTS_DIR);
let count = 0;
files.forEach(file => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    const fullPath = path.join(COMPONENTS_DIR, file);
    try {
      if (migrateFile(fullPath)) count++;
    } catch (e) {
      console.error(`❌ Failed migrating ${file}: ${e.message}`);
    }
  }
});
console.log(`\n🎉 Migration complete. Modified ${count} files.`);
