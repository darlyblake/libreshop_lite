const fs = require('fs');
const file = 'src/screens/ProductDetailScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace rgba(22, 25, 34, 0.72) with COLORS.card
content = content.replace(/"rgba\(22,\s*25,\s*34,\s*0\.72\)"/g, 'COLORS.card');

// Replace rgba(255,255,255,X) with dynamic value
content = content.replace(/"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)"/g, 'isDarkTheme ? "rgba(255,255,255,$1)" : "rgba(0,0,0,$1)"');

fs.writeFileSync(file, content);
console.log('Done replacing styles!');
