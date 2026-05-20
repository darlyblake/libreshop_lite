const fs = require('fs');
const file = 'src/screens/ProductDetailScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/color="#111"/g, 'color={COLORS.text}');
content = content.replace(/color="#333"/g, 'color={COLORS.text}');

fs.writeFileSync(file, content);
console.log('Icons fixed');
