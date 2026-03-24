const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modified = 0;

walkDir(path.join(__dirname, '../src'), (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Fix the top-level destructuring from useTheme()
  // Replace:
  // const { theme } = useTheme();
  // const COLORS = theme.getColor; ...
  // With:
  // const themeContext = useTheme();
  // const theme = themeContext.theme;
  // const COLORS = themeContext.getColor; ...
  const regexDestruct = /const { theme } = useTheme\(\);\s+const COLORS = theme\.getColor;\s+const SPACING = theme\.spacing;\s+const RADIUS = theme\.radius;\s+const FONT_SIZE = theme\.fontSize;/g;
  
  content = content.replace(regexDestruct, 
`const themeContext = useTheme();
  const theme = themeContext.theme;
  const COLORS = themeContext.getColor;
  const SPACING = themeContext.spacing;
  const RADIUS = themeContext.radius;
  const FONT_SIZE = themeContext.fontSize;`);

  // 2. Fix the getStyles call to pass themeContext instead of theme
  // Replace: getStyles(theme) : {} (or {} as any), [theme]
  // With: getStyles(themeContext) : ... , [themeContext]
  const regexStyles = /const styles = React\.useMemo\(\(\) => typeof getStyles === 'function' \? getStyles\(theme\) : (.*?)\, \[theme\]\);/g;
  content = content.replace(regexStyles, 
    `const styles = React.useMemo(() => typeof getStyles === 'function' ? getStyles(themeContext) : $1, [themeContext]);`);

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    modified++;
    console.log(`Fixed: ${path.basename(filePath)}`);
  }
});

console.log(`Finished fixing ${modified} files.`);
