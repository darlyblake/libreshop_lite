const fs = require('fs');
const glob = require('glob');

const files = [
  ...glob.sync('src/**/*.tsx', { absolute: true }),
  ...glob.sync('src/**/*.ts', { absolute: true })
];

let count = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('../lib/notificationService')) {
    content = content.replace(/\.\.\/lib\/notificationService/g, '../services/notificationService');
    changed = true;
  }
  
  if (content.includes('../lib/cloudinaryService')) {
    content = content.replace(/\.\.\/lib\/cloudinaryService/g, '../services/cloudinaryService');
    changed = true;
  }

  if (content.includes('../lib/storeStatsService')) {
    content = content.replace(/\.\.\/lib\/storeStatsService/g, '../services/storeStatsService');
    changed = true;
  }

  if (content.includes('../lib/reviewService')) {
    content = content.replace(/\.\.\/lib\/reviewService/g, '../services/reviewService');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    count++;
    console.log(`Updated imports in ${file}`);
  }
}
console.log(`Updated ${count} files.`);
