/**
 * Script de correction automatique des couleurs codées en dur
 * Remplace les problèmes critiques de contraste
 */

const fs = require('fs');
const path = require('path');

// Mapping des corrections à appliquer
const corrections = [
  {
    pattern: /backgroundColor\s*:\s*['"]white['"]/g,
    replacement: 'backgroundColor: COLORS.card',
    description: 'white background → COLORS.card'
  },
  {
    pattern: /backgroundColor\s*:\s*['"]black['"]/g,
    replacement: 'backgroundColor: COLORS.bg',
    description: 'black background → COLORS.bg'
  },
  {
    pattern: /color\s*:\s*['"]white['"]/g,
    replacement: 'color: COLORS.text',
    description: 'white text → COLORS.text'
  },
  {
    pattern: /color\s*:\s*['"]black['"]/g,
    replacement: 'color: COLORS.textSoft',
    description: 'black text → COLORS.textSoft'
  },
  {
    pattern: /borderColor\s*:\s*['"]white['"]/g,
    replacement: 'borderColor: COLORS.border',
    description: 'white border → COLORS.border'
  },
  {
    pattern: /borderColor\s*:\s*['"]black['"]/g,
    replacement: 'borderColor: COLORS.border',
    description: 'black border → COLORS.border'
  },
  {
    pattern: /COLORS\.white/g,
    replacement: 'COLORS.text',
    description: 'COLORS.white → COLORS.text'
  },
  {
    pattern: /COLORS\.black/g,
    replacement: 'COLORS.bg',
    description: 'COLORS.black → COLORS.bg'
  }
];

// Fonction pour corriger un fichier
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const appliedCorrections = [];
    
    for (const correction of corrections) {
      const matches = content.match(correction.pattern);
      if (matches) {
        content = content.replace(correction.pattern, correction.replacement);
        modified = true;
        appliedCorrections.push({
          correction: correction.description,
          count: matches.length
        });
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return appliedCorrections;
    }
    
    return [];
  } catch (error) {
    console.error(`Erreur en traitant ${filePath}:`, error.message);
    return [];
  }
}

// Fonction pour traiter tous les fichiers TypeScript/JavaScript
function fixAllFiles(dirPath, extensions = ['.tsx', '.ts', '.js', '.jsx']) {
  const results = {};
  let totalCorrections = 0;
  
  function walkDir(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          walkDir(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            const corrections = fixFile(fullPath);
            if (corrections.length > 0) {
              const relativePath = path.relative(dirPath, fullPath);
              results[relativePath] = corrections;
              
              corrections.forEach(c => {
                totalCorrections += c.count;
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erreur en parcourant ${currentPath}:`, error.message);
    }
  }
  
  walkDir(dirPath);
  return { results, totalCorrections };
}

// Fonction principale
function main() {
  console.log('🔧 DÉMARRAGE DE LA CORRECTION AUTOMATIQUE DES COULEURS');
  console.log('='.repeat(60));
  
  const srcPath = path.join(__dirname, 'src');
  const { results, totalCorrections } = fixAllFiles(srcPath);
  
  console.log(`\n📊 RÉSULTATS DE LA CORRECTION:`);
  console.log(`• Fichiers modifiés: ${Object.keys(results).length}`);
  console.log(`• Total des corrections: ${totalCorrections}`);
  
  if (Object.keys(results).length > 0) {
    console.log('\n📝 DÉTAIL DES CORRECTIONS:');
    
    for (const [filePath, corrections] of Object.entries(results)) {
      console.log(`\n📁 ${filePath}:`);
      corrections.forEach(c => {
        console.log(`   ✅ ${c.correction} (${c.count} fois)`);
      });
    }
  }
  
  console.log('\n🎯 CORRECTIONS PRIORITAIRES APPLIQUÉES:');
  console.log('✅ backgroundColor: "white" → COLORS.card');
  console.log('✅ backgroundColor: "black" → COLORS.bg');
  console.log('✅ color: "white" → COLORS.text');
  console.log('✅ color: "black" → COLORS.textSoft');
  console.log('✅ COLORS.white → COLORS.text');
  console.log('✅ COLORS.black → COLORS.bg');
  
  console.log('\n📈 IMPACT ATTENDU:');
  console.log('• Élimination des problèmes de contraste critiques');
  console.log('• Standardisation des couleurs via thème COLORS');
  console.log('• Amélioration de l\'accessibilité WCAG');
  console.log('• Cohérence visuelle accrue');
  
  console.log(`\n🎉 ${totalCorrections} corrections appliquées avec succès !`);
  
  if (totalCorrections > 0) {
    console.log('\n🔄 ÉTAPES SUIVANTES RECOMMANDÉES:');
    console.log('1. Tester visuellement les corrections');
    console.log('2. Valider les contrastes avec les outils WCAG');
    console.log('3. Corriger manuellement les couleurs hexadécimales restantes');
    console.log('4. Mettre à jour la documentation des couleurs');
  }
  
  return totalCorrections;
}

// Exécuter la correction
main();
