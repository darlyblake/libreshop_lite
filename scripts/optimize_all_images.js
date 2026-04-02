const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = [
  ...glob.sync('src/screens/**/*.tsx', { absolute: true }),
  ...glob.sync('src/components/**/*.tsx', { absolute: true })
];

let updatedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // We are only interested in files that have <Image
  if (!content.includes('<Image')) continue;

  const regex = /source=\{\{\s*uri:\s*([^}]+)\s*\}\}/g;
  
  content = content.replace(regex, (match, uriExpression) => {
    // If it's already optimized, skip
    if (uriExpression.includes('cloudinaryService.getOptimizedUrl')) {
      return match;
    }
    
    changed = true;
    return `source={{ uri: cloudinaryService.getOptimizedUrl(${uriExpression.trim()}, 800) }}`;
  });

  if (changed) {
    // Ensure the import exists
    if (!content.includes('import { cloudinaryService }')) {
      // Find the last import statement
      const importRegex = /^import .+ from '.+';?$/gm;
      let lastIndex = 0;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastIndex = match.index + match[0].length;
      }
      
      const isScreen = file.includes('/screens/');
      const importPath = isScreen ? '../services/cloudinaryService' : '../services/cloudinaryService'; // both components and screens are 1 level deep from src, so ../services is correct for both. Wait! Navigation might be different. Let's just calculate relative path.
      
      // Calculate relative path to src/services/cloudinaryService
      const fileDir = path.dirname(file);
      const servicesDir = path.resolve('src/services');
      let relPath = path.relative(fileDir, servicesDir);
      if (!relPath.startsWith('.')) relPath = './' + relPath;
      
      const importStmt = `\nimport { cloudinaryService } from '${relPath}/cloudinaryService';`;
      
      if (lastIndex > 0) {
        content = content.slice(0, lastIndex) + importStmt + content.slice(lastIndex);
      } else {
        content = importStmt + '\n' + content;
      }
    }
    
    fs.writeFileSync(file, content);
    updatedFiles++;
    console.log(`Updated images in ${path.basename(file)}`);
  }
}

console.log(`Successfully optimized images in ${updatedFiles} files.`);
