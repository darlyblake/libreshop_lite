/**
 * Script d'analyse de migration pour les thèmes
 * Analyse tous les fichiers et génère un rapport détaillé
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = __dirname;
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const REPORT_FILE = path.join(PROJECT_ROOT, 'MIGRATION_REPORT.md');

// Couleurs à migrer
const COLOR_MAPPINGS = {
  // Anciennes couleurs
  'COLORS.bg': 'theme.getColor.background',
  'COLORS.text': 'theme.getColor.text',
  'COLORS.card': 'theme.getColor.card',
  'COLORS.accent': 'theme.getColor.primary',
  'COLORS.accent2': 'theme.getColor.accent',
  'COLORS.accentDark': 'theme.getColor.primaryDark',
  'COLORS.success': 'theme.getColor.success',
  'COLORS.warning': 'theme.getColor.warning',
  'COLORS.danger': 'theme.getColor.error',
  'COLORS.info': 'theme.getColor.info',
  'COLORS.white': 'theme.getColor.text',
  'COLORS.black': 'theme.getColor.background',
  'COLORS.border': 'theme.getColor.border',
  'COLORS.textMuted': 'theme.getColor.textTertiary',
  'COLORS.textSoft': 'theme.getColor.textSecondary',
  
  // Couleurs hexadécimales
  '#ffffff': 'theme.getColor.background',
  '#000000': 'theme.getColor.text',
  '#f8fafc': 'theme.getColor.card',
  '#e2e8f0': 'theme.getColor.borderLight',
  '#cbd5e1': 'theme.getColor.border',
  '#94a3b8': 'theme.getColor.textTertiary',
  '#64748b': 'theme.getColor.textSecondary',
  '#475569': 'theme.getColor.textSecondary',
  '#0f172a': 'theme.getColor.text',
  
  // Couleurs de statut
  '#10b981': 'theme.getColor.success',
  '#22c55e': 'theme.getColor.success',
  '#f59e0b': 'theme.getColor.warning',
  '#fbbf24': 'theme.getColor.warning',
  '#ef4444': 'theme.getColor.error',
  '#f87171': 'theme.getColor.error',
  '#3b82f6': 'theme.getColor.info',
  '#60a5fa': 'theme.getColor.info',
  
  // Couleurs primaires
  '#0ea5e9': 'theme.getColor.primary',
  '#0284c7': 'theme.getColor.primaryDark',
  '#0369a1': 'theme.getColor.primaryDark',
  '#8b5cf6': 'theme.getColor.accent',
  '#a78bfa': 'theme.getColor.accent',
};

// Extensions de fichiers à analyser
const FILE_EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx'];

// Fonction pour scanner les fichiers
function scanDirectory(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      scanDirectory(fullPath, files);
    } else if (stat.isFile() && FILE_EXTENSIONS.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Fonction pour extraire les couleurs d'un fichier
function extractColors(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const foundColors = new Set();
    
    // Chercher les patterns de couleurs
    Object.keys(COLOR_MAPPINGS).forEach(color => {
      if (content.includes(color)) {
        foundColors.add(color);
      }
    });
    
    return Array.from(foundColors);
  } catch (error) {
    console.error(`Erreur lecture fichier ${filePath}:`, error);
    return [];
  }
}

// Fonction principale d'analyse
function analyzeProject() {
  console.log('🔍 Analyse du projet pour la migration des thèmes...');
  
  // Scanner tous les fichiers
  const allFiles = scanDirectory(SRC_DIR);
  const componentFiles = allFiles.filter(file => 
    file.includes('/components/') || file.includes('/screens/') || file.includes('/navigation/')
  );
  
  console.log(`📁 ${allFiles.length} fichiers trouvés`);
  console.log(`🎨 ${componentFiles.length} fichiers de composants/écrans`);
  
  // Analyser les fichiers
  const analysis = {
    totalFiles: componentFiles.length,
    filesWithColors: [],
    filesWithoutColors: [],
    colorFrequency: {},
    summary: {
      totalColors: 0,
      uniqueColors: 0,
      estimatedTime: '0 minutes',
    }
  };
  
  componentFiles.forEach(filePath => {
    const colors = extractColors(filePath);
    
    if (colors.length > 0) {
      analysis.filesWithColors.push({
        path: path.relative(PROJECT_ROOT, filePath),
        colors: colors,
        count: colors.length,
      });
      
      // Compter la fréquence des couleurs
      colors.forEach(color => {
        analysis.colorFrequency[color] = (analysis.colorFrequency[color] || 0) + 1;
        analysis.summary.totalColors++;
      });
    } else {
      analysis.filesWithoutColors.push(path.relative(PROJECT_ROOT, filePath));
    }
  });
  
  analysis.summary.uniqueColors = Object.keys(analysis.colorFrequency).length;
  analysis.summary.estimatedTime = `${Math.ceil(analysis.filesWithColors.length * 2)} minutes`;
  
  // Trier par nombre de couleurs
  analysis.filesWithColors.sort((a, b) => b.count - a.count);
  
  // Trier les couleurs par fréquence
  const sortedColors = Object.entries(analysis.colorFrequency)
    .sort(([,a], [,b]) => b - a)
    .reduce((acc, [color, freq]) => {
      acc[color] = freq;
      return acc;
    }, {});
  analysis.colorFrequency = sortedColors;
  
  return analysis;
}

// Fonction pour générer le rapport
function generateReport(analysis) {
  const report = `
# 📊 Rapport de Migration Thème LibreShop

## 🎯 Vue d'ensemble

- **Fichiers totaux**: ${analysis.totalFiles}
- **Fichiers avec couleurs**: ${analysis.filesWithColors.length}
- **Fichiers sans couleurs**: ${analysis.filesWithoutColors.length}
- **Total couleurs**: ${analysis.summary.totalColors}
- **Couleurs uniques**: ${analysis.summary.uniqueColors}
- **Temps estimé**: ${analysis.summary.estimatedTime}

## 📈 Statistiques

### 🎨 Couleurs les plus fréquentes
${Object.entries(analysis.colorFrequency)
  .slice(0, 10)
  .map(([color, freq]) => `- \`${color}\`: ${freq} occurrences`)
  .join('\n')}

### 📁 Fichiers nécessitant le plus de migrations
${analysis.filesWithColors
  .slice(0, 10)
  .map(file => `- **${file.path}**: ${file.count} couleurs`)
  .join('\n')}

## 🔄 Mapping des couleurs

${Object.entries(COLOR_MAPPINGS)
  .slice(0, 20)
  .map(([old, newColor]) => `- \`${old}\` → \`${newColor}\``)
  .join('\n')}

## ✅ Fichiers déjà migrés
${analysis.filesWithoutColors.length > 0 
  ? analysis.filesWithoutColors.slice(0, 10).map(file => `- ${file}`).join('\n')
  : 'Aucun fichier déjà migré complètement'}

## 🚀 Recommandations

1. **Commencer par les fichiers avec le plus de couleurs**
   ${analysis.filesWithColors.slice(0, 5).map(file => `- ${file.path}`).join('\n')}

2. **Prioriser les couleurs les plus utilisées**
   ${Object.entries(analysis.colorFrequency)
     .slice(0, 5)
     .map(([color]) => `- \`${color}\``)
     .join('\n')}

3. **Tester chaque migration individuellement**

4. **Valider les contrastes WCAG après migration**

## 📋 Étapes de migration

1. **Phase 1**: Ajouter \`useThemeContext\` dans chaque composant
2. **Phase 2**: Remplacer les couleurs statiques
3. **Phase 3**: Mettre à jour les styles
4. **Phase 4**: Tester sur les thèmes clair/sombre
5. **Phase 5**: Validation WCAG

---

*Généré le ${new Date().toLocaleString('fr-FR')}*
  `.trim();
  
  return report;
}

// Exécuter l'analyse
try {
  const analysis = analyzeProject();
  const report = generateReport(analysis);
  
  // Sauvegarder le rapport
  fs.writeFileSync(REPORT_FILE, report);
  
  console.log('✅ Analyse terminée!');
  console.log(`📄 Rapport généré: ${REPORT_FILE}`);
  console.log(`🎨 ${analysis.filesWithColors.length} fichiers à migrer`);
  console.log(`⏱️  Temps estimé: ${analysis.summary.estimatedTime}`);
  
} catch (error) {
  console.error('❌ Erreur lors de l\'analyse:', error);
  process.exit(1);
}
