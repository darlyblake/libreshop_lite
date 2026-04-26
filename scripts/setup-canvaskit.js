const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'node_modules', 'canvaskit-wasm', 'bin', 'full');
const destDir = path.resolve(__dirname, '..', 'public', 'canvaskit', 'bin', 'full');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error('Source directory does not exist:', src);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  const files = fs.readdirSync(src);
  files.forEach((f) => {
    const s = path.join(src, f);
    const d = path.join(dest, f);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
      console.log('Copied', s, '->', d);
    }
  });
}

try {
  copyDir(srcDir, destDir);
  console.log('CanvasKit files copied to public/canvaskit/bin/full');
} catch (e) {
  console.error('Failed to copy CanvasKit files:', e);
  process.exit(1);
}
