/**
 * Script pour convertir les couleurs hexadécimales restantes
 * Phase 2 de la standardisation des couleurs
 */

const fs = require('fs');
const path = require('path');

// Mapping des couleurs hexadécimales vers les constantes COLORS
const hexToColors = {
  // Couleurs de statut
  '#10b981': 'COLORS.success',
  '#059669': 'COLORS.success',
  '#ef4444': 'COLORS.danger',
  '#dc2626': 'COLORS.danger',
  '#f59e0b': 'COLORS.warning',
  '#d97706': 'COLORS.warning',
  '#3b82f6': 'COLORS.info',
  '#1e40af': 'COLORS.info',
  
  // Couleurs d'accent
  '#8b5cf6': 'COLORS.accent',
  '#7c3aed': 'COLORS.accentDark',
  '#06b6d4': 'COLORS.accent2',
  
  // Couleurs de texte
  '#ffffff': 'COLORS.text',
  '#f8fafc': 'COLORS.textBright',
  '#000000': 'COLORS.bg',
  '#1a1a1a': 'COLORS.dark',
  
  // Couleurs de bordure
  '#e2e8f0': 'COLORS.border',
  '#f1f5f9': 'COLORS.borderLight',
  '#64748b': 'COLORS.textMuted',
  '#94a3b8': 'COLORS.textMuted',
  '#6b7280': 'COLORS.gray',
  '#9ca3af': 'COLORS.mediumGray',
  
  // Couleurs de fond
  '#f8fafc': 'COLORS.card',
  '#f3f4f6': 'COLORS.lightGray',
  '#0f172a': 'COLORS.darkBlue',
  '#0a0c12': 'COLORS.bg',
  
  // Couleurs sociales
  '#1877f2': 'COLORS.facebook',
  '#e4405f': 'COLORS.instagram',
  '#1da1f2': 'COLORS.twitter',
  '#25D366': 'COLORS.whatsapp',
  
  // Couleurs de ranking
  '#FFD700': 'COLORS.gold',
  '#C0C0C0': 'COLORS.silver',
  '#CD7F32': 'COLORS.bronze',
  '#FFB800': 'COLORS.star',
  
  // Couleurs de catégories
  '#ec4899': 'COLORS.categoryColors[1]',
  '#f97316': 'COLORS.categoryColors[9]',
  '#d946ef': 'COLORS.categoryColors[7]',
  '#14b8a6': 'COLORS.categoryColors[8]',
  '#6366f1': 'COLORS.categoryColors[5]',
};

// Fonction pour convertir les couleurs hexadécimales dans un fichier
function convertHexColors(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const conversions = [];
    
    for (const [hex, colorConstant] of Object.entries(hexToColors)) {
      const pattern = new RegExp(hex.replace('#', '#'), 'g');
      const matches = content.match(pattern);
      
      if (matches) {
        content = content.replace(pattern, colorConstant);
        modified = true;
        conversions.push({
          from: hex,
          to: colorConstant,
          count: matches.length
        });
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return conversions;
    }
    
    return [];
  } catch (error) {
    console.error(`Erreur en traitant ${filePath}:`, error.message);
    return [];
  }
}

// Fonction principale
function main() {
  console.log('🎨 CONVERSION DES COULEURS HEXADÉCIMALES RESTANTES');
  console.log('='.repeat(60));
  
  const srcPath = path.join(__dirname, 'src');
  const results = {};
  let totalConversions = 0;
  
  // Parcourir tous les fichiers TypeScript/JavaScript
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
          if (['.tsx', '.ts', '.js', '.jsx'].includes(ext)) {
            const conversions = convertHexColors(fullPath);
            if (conversions.length > 0) {
              const relativePath = path.relative(srcPath, fullPath);
              results[relativePath] = conversions;
              
              conversions.forEach(c => {
                totalConversions += c.count;
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erreur en parcourant ${currentPath}:`, error.message);
    }
  }
  
  walkDir(srcPath);
  
  console.log(`\n📊 RÉSULTATS DE LA CONVERSION:`);
  console.log(`• Fichiers modifiés: ${Object.keys(results).length}`);
  console.log(`• Total des conversions: ${totalConversions}`);
  
  if (Object.keys(results).length > 0) {
    console.log('\n📝 DÉTAIL DES CONVERSIONS:');
    
    // Afficher les 10 fichiers avec le plus de conversions
    const sortedFiles = Object.entries(results)
      .sort((a, b) => b[1].reduce((sum, c) => sum + c.count, 0) - a[1].reduce((sum, c) => sum + c.count, 0))
      .slice(0, 10);
    
    sortedFiles.forEach(([filePath, conversions]) => {
      const total = conversions.reduce((sum, c) => sum + c.count, 0);
      console.log(`\n📁 ${filePath} (${total} conversions):`);
      
      conversions.forEach(c => {
        console.log(`   🔄 ${c.from} → ${c.to} (${c.count} fois)`);
      });
    });
  }
  
  console.log('\n🎯 CONVERSIONS LES PLUS FRÉQUENTES:');
  
  // Calculer les statistiques de conversion
  const conversionStats = {};
  for (const conversions of Object.values(results)) {
    conversions.forEach(c => {
      if (!conversionStats[c.from]) {
        conversionStats[c.from] = { to: c.to, count: 0 };
      }
      conversionStats[c.from].count += c.count;
    });
  }
  
  const sortedStats = Object.entries(conversionStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  sortedStats.forEach(([hex, stats]) => {
    console.log(`• ${hex} → ${stats.to} (${stats.count} fois)`);
  });
  
  console.log(`\n🎉 ${totalConversions} couleurs hexadécimales converties avec succès !`);
  
  if (totalConversions > 0) {
    console.log('\n✨ BÉNÉFICES:');
    console.log('• Standardisation complète des couleurs');
    console.log('• Maintenance facilitée du thème');
    console.log('• Cohérence visuelle parfaite');
    console.log('• Support du mode sombre amélioré');
  } else {
    console.log('\n📝 Toutes les couleurs hexadécimales ont déjà été converties !');
  }
  
  return totalConversions;
}

// Exécuter la conversion
main();
