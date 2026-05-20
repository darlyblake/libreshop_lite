const fs = require('fs');
const file = 'src/screens/ProductDetailScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/background:#fff/g, 'background:${COLORS.card}');
content = content.replace(/background:#f3f4f6/g, 'background:${isDarkTheme ? "rgba(255,255,255,0.1)" : "#f3f4f6"}');
content = content.replace(/background:#f4f4f4/g, 'background:${isDarkTheme ? "rgba(255,255,255,0.1)" : "#f4f4f4"}');
content = content.replace(/color:#111/g, 'color:${COLORS.text}');
content = content.replace(/color:#333/g, 'color:${COLORS.text}');
content = content.replace(/color:#666/g, 'color:${COLORS.textMuted}');
content = content.replace(/color:#4c1d95/g, 'color:${COLORS.primary}');
content = content.replace(/border-bottom:3px solid #6b21a8/g, 'border-bottom:3px solid ${COLORS.primary}');
content = content.replace(/background:#6b21a8/g, 'background:${COLORS.primary}');
content = content.replace(/border:1px solid #e6d9ff/g, 'border:1px solid ${COLORS.primary}');
content = content.replace(/border:1px solid #eee/g, 'border:1px solid ${COLORS.borderLight}');
content = content.replace(/border-top:1px solid #f4f4f4/g, 'border-top:1px solid ${COLORS.borderLight}');
content = content.replace(/border:1px dashed #c7b3ff/g, 'border:1px dashed ${COLORS.primary}');

// specific for title
content = content.replace(/\.web-title\{font-size:26px;font-weight:800;margin:6px 0\}/g, '.web-title{font-size:26px;font-weight:800;margin:6px 0;color:${COLORS.text}}');

fs.writeFileSync(file, content);
console.log('CSS fixed');
