/**
 * Analyse complète des couleurs codées en dur dans LibreShop
 * Identifie tous les problèmes de contraste potentiels
 */

const fs = require('fs');
const path = require('path');

// Fonction pour analyser un fichier
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const issues = [];
    let lineNum = 0;
    
    for (const line of lines) {
      lineNum++;
      
      // Rechercher les couleurs codées en dur
      const hexColors = line.match(/#[0-9a-fA-F]{6}/g) || [];
      const rgbaColors = line.match(/rgba?\([^)]+\)/g) || [];
      const namedColors = line.match(/(white|black|red|blue|green|yellow|orange|purple|pink|gray|grey)/g) || [];
      
      // Rechercher les problèmes potentiels de contraste
      const whiteOnWhite = line.includes('white') && (line.includes('backgroundColor') || line.includes('background'));
      const blackOnBlack = line.includes('black') && (line.includes('color') || line.includes('text'));
      const sameColorBgText = line.includes('color') && line.includes('backgroundColor') && 
        (hexColors.length > 1 || rgbaColors.length > 1);
      
      if (hexColors.length > 0 || rgbaColors.length > 0 || namedColors.length > 0) {
        issues.push({
          line: lineNum,
          content: line.trim(),
          hexColors,
          rgbaColors,
          namedColors,
          whiteOnWhite,
          blackOnBlack,
          sameColorBgText
        });
      }
    }
    
    return issues;
  } catch (error) {
    console.error(`Erreur en lisant ${filePath}:`, error.message);
    return [];
  }
}

// Fonction pour analyser récursivement les fichiers
function analyzeDirectory(dirPath, extensions = ['.tsx', '.ts', '.js', '.jsx']) {
  const results = {};
  
  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walkDir(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          const relativePath = path.relative(dirPath, fullPath);
          const issues = analyzeFile(fullPath);
          
          if (issues.length > 0) {
            results[relativePath] = issues;
          }
        }
      }
    }
  }
  
  walkDir(dirPath);
  return results;
}

// Fonction pour générer le rapport
function generateReport(results) {
  console.log('🔍 ANALYSE COMPLÈTE DES COULEURS CODÉES EN DUR');
  console.log('='.repeat(60));
  
  let totalFiles = 0;
  let totalIssues = 0;
  let criticalIssues = 0;
  let problematicFiles = [];
  
  // Statistiques par type de problème
  const problemTypes = {
    hexColors: 0,
    rgbaColors: 0,
    namedColors: 0,
    whiteOnWhite: 0,
    blackOnBlack: 0,
    sameColorBgText: 0
  };
  
  for (const [filePath, issues] of Object.entries(results)) {
    totalFiles++;
    totalIssues += issues.length;
    
    let hasCriticalIssue = false;
    
    for (const issue of issues) {
      problemTypes.hexColors += issue.hexColors.length;
      problemTypes.rgbaColors += issue.rgbaColors.length;
      problemTypes.namedColors += issue.namedColors.length;
      
      if (issue.whiteOnWhite) {
        problemTypes.whiteOnWhite++;
        criticalIssues++;
        hasCriticalIssue = true;
      }
      
      if (issue.blackOnBlack) {
        problemTypes.blackOnBlack++;
        criticalIssues++;
        hasCriticalIssue = true;
      }
      
      if (issue.sameColorBgText) {
        problemTypes.sameColorBgText++;
        criticalIssues++;
        hasCriticalIssue = true;
      }
    }
    
    if (hasCriticalIssue) {
      problematicFiles.push({
        path: filePath,
        issues: issues.filter(i => i.whiteOnWhite || i.blackOnBlack || i.sameColorBgText)
      });
    }
  }
  
  // Résumé général
  console.log('\n📊 RÉSUMÉ GÉNÉRAL:');
  console.log(`• Fichiers analysés: ${totalFiles}`);
  console.log(`• Fichiers avec problèmes: ${Object.keys(results).length}`);
  console.log(`• Total des problèmes: ${totalIssues}`);
  console.log(`• Problèmes critiques: ${criticalIssues}`);
  
  console.log('\n🎨 TYPES DE PROBLÈMES:');
  console.log(`• Couleurs hexadécimales: ${problemTypes.hexColors}`);
  console.log(`• Couleurs RGBA: ${problemTypes.rgbaColors}`);
  console.log(`• Couleurs nommées: ${problemTypes.namedColors}`);
  console.log(`• Texte blanc sur fond blanc: ${problemTypes.whiteOnWhite} ⚠️`);
  console.log(`• Texte noir sur fond noir: ${problemTypes.blackOnBlack} ⚠️`);
  console.log(`• Même couleur pour texte/fond: ${problemTypes.sameColorBgText} 🚨`);
  
  // Fichiers les plus problématiques
  if (problematicFiles.length > 0) {
    console.log('\n🚨 FICHIERS AVEC PROBLÈMES CRITIQUES:');
    problematicFiles.forEach(file => {
      console.log(`\n📁 ${file.path}:`);
      file.issues.forEach(issue => {
        console.log(`   Ligne ${issue.line}: ${issue.content.substring(0, 100)}...`);
        
        if (issue.whiteOnWhite) console.log('      ⚠️  Texte blanc sur fond blanc détecté');
        if (issue.blackOnBlack) console.log('      ⚠️  Texte noir sur fond noir détecté');
        if (issue.sameColorBgText) console.log('      🚨 Même couleur pour texte et fond détecté');
      });
    });
  }
  
  // Top 10 des fichiers avec le plus de problèmes
  const sortedFiles = Object.entries(results)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);
  
  if (sortedFiles.length > 0) {
    console.log('\n🔝 TOP 10 DES FICHIERS AVEC LE PLUS DE PROBLÈMES:');
    sortedFiles.forEach(([filePath, issues], index) => {
      console.log(`${index + 1}. ${filePath} (${issues.length} problèmes)`);
    });
  }
  
  // Recommandations
  console.log('\n💡 RECOMMANDATIONS:');
  console.log('1. 🎨 Standardiser TOUTES les couleurs dans src/config/theme.ts');
  console.log('2. 🔍 Utiliser uniquement les constantes COLORS.*');
  console.log('3. ⚠️  Éviter "white", "black", "#ffffff" dans les styles');
  console.log('4. 🧪 Tester chaque composant pour le contraste');
  console.log('5. 📝 Créer des hooks pour les couleurs dynamiques');
  
  // Plan d'action prioritaire
  if (criticalIssues > 0) {
    console.log('\n🚀 PLAN D\'ACTION PRIORITAIRE:');
    console.log('URGENT - Corriger les problèmes critiques:');
    
    problematicFiles.slice(0, 5).forEach(file => {
      console.log(`• ${file.path}`);
    });
    
    console.log('\nÉTAPES SUGGÉRÉES:');
    console.log('1. Corriger les problèmes de contraste critiques (texte invisible)');
    console.log('2. Remplacer les couleurs "white" et "black" par COLORS.text/COLORS.bg');
    console.log('3. Remplacer les hexadécimaux par les constantes COLORS');
    console.log('4. Tester chaque correction visuellement');
  }
  
  return {
    totalFiles,
    filesWithIssues: Object.keys(results).length,
    totalIssues,
    criticalIssues,
    problematicFiles,
    problemTypes
  };
}

// Exécuter l'analyse
const srcPath = path.join(__dirname, 'src');
console.log('🔍 Démarrage de l\'analyse complète des couleurs...\n');

const results = analyzeDirectory(srcPath);
const report = generateReport(results);

console.log('\n📈 CONCLUSION:');
if (report.criticalIssues > 0) {
  console.log('🚨 DES CORRECTIONS URGENTES SONT NÉCESSAIRES !');
  console.log('Des problèmes de contraste critiques ont été identifiés.');
} else {
  console.log('✅ Aucun problème critique de contraste détecté.');
  console.log('Seule la standardisation des couleurs est recommandée.');
}

console.log(`\n🎯 Score de santé des couleurs: ${Math.max(0, 100 - (report.criticalIssues * 10))}/100`);
