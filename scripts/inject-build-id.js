#!/usr/bin/env node
/**
 * scripts/inject-build-id.js
 *
 * Injecte un BUILD_ID unique (horodatage + hash git court) dans le service worker
 * avant chaque déploiement. Appelé automatiquement par le script "predeploy".
 *
 * Usage:
 *   node scripts/inject-build-id.js
 *
 * Le script remplace BUILD_VERSION_PLACEHOLDER dans service-worker.js
 * par un identifiant de version unique ex: "20260518-a3f7b2c"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SW_PATH = path.join(__dirname, '..', 'public', 'service-worker.js');
const INDEX_PATH = path.join(__dirname, '..', 'public', 'index.html');

// Generate unique build version: date + short git hash
function getBuildVersion() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  let hash = 'local';
  try {
    hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    // Not a git repo or git not installed
    hash = Date.now().toString(36);
  }
  return `${date}-${hash}`;
}

const version = getBuildVersion();
console.log(`[inject-build-id] Build version: ${version}`);

// 1. Update service-worker.js
let swContent = fs.readFileSync(SW_PATH, 'utf8');
// Replace placeholder OR any existing version string
swContent = swContent.replace(/BUILD_VERSION_PLACEHOLDER|'\d{8}-[a-f0-9]+'(?=\s*;?\s*\/\/ auto)/g, `'${version}'`);
// Also handle the const line specifically
swContent = swContent.replace(
  /const BUILD_VERSION = '.*?';/,
  `const BUILD_VERSION = '${version}';`
);
fs.writeFileSync(SW_PATH, swContent, 'utf8');
console.log(`[inject-build-id] ✓ service-worker.js updated`);

// 2. Update cache-busting version in index.html meta tag if present
if (fs.existsSync(INDEX_PATH)) {
  let htmlContent = fs.readFileSync(INDEX_PATH, 'utf8');
  // Update the meta build version tag if it exists
  if (htmlContent.includes('data-build-version')) {
    htmlContent = htmlContent.replace(
      /data-build-version="[^"]*"/,
      `data-build-version="${version}"`
    );
    fs.writeFileSync(INDEX_PATH, htmlContent, 'utf8');
    console.log(`[inject-build-id] ✓ index.html data-build-version updated`);
  }
}

console.log(`[inject-build-id] ✓ Done — version ${version} injected`);
