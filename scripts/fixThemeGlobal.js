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

  // Pattern detection: destructuring { theme } followed by accessing theme properties
  // This version is more generic than the previous one.
  
  // 1. Identify files using useTheme and accessing theme properties incorrectly
  if (content.includes('useTheme()') && content.includes('theme.getColor')) {
    
    // Replace the destructuring line
    content = content.replace(/const\s+\{\s*theme\s*\}\s*=\s*useTheme\(\);/g, 'const themeContext = useTheme();\n  const { theme } = themeContext;');
    content = content.replace(/const\s+\{\s*theme,\s*isLoading\s*\}\s*=\s*useTheme\(\);/g, 'const themeContext = useTheme();\n  const { theme, isLoading } = themeContext;');
    
    // Replace subsequent definitions that used 'theme.prop'
    content = content.replace(/const\s+COLORS\s*=\s*theme\.getColor;/g, 'const COLORS = themeContext.getColor;');
    content = content.replace(/const\s+SPACING\s*=\s*theme\.spacing;/g, 'const SPACING = themeContext.spacing;');
    content = content.replace(/const\s+RADIUS\s*=\s*theme\.radius;/g, 'const RADIUS = themeContext.radius;');
    content = content.replace(/const\s+FONT_SIZE\s*=\s*theme\.fontSize;/g, 'const FONT_SIZE = themeContext.fontSize;');
    
    // Fix useMemo dependencies if they were using [theme] but now have themeContext
    content = content.replace(/getStyles\(theme\)/g, 'getStyles(themeContext)');
    content = content.replace(/\[\s*theme\s*\]\s*\);/g, '[themeContext]);');

    // Special case for files that used themeContext in useMemo but didn't define it
    if (content.includes('themeContext') && !content.includes('const themeContext = useTheme()')) {
        content = content.replace(/const\s+\{\s*theme\s*\}\s*=\s*useTheme\(\);/g, 'const themeContext = useTheme();\n  const { theme } = themeContext;');
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    count++;
    console.log(`✅ Fixed: ${path.relative(SRC_DIR, filePath)}`);
  }
});

console.log(`\n🎉 Automation complete. Fixed ${count} files.`);
