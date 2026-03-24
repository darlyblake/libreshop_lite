/**
 * Assistant de migration automatique vers le système de thème
 * Analyse, conversion et rapport de migration
 */

import * as fs from 'fs';
import * as path from 'path';

interface MigrationReport {
  totalFiles: number;
  migratedFiles: number;
  remainingFiles: number;
  estimatedTime: string;
  issues: string[];
  recommendations: string[];
}

interface ColorMapping {
  [oldColor: string]: string;
}

export class ThemeMigrator {
  private colorMappings: ColorMapping = {
    // Couleurs claires vers thème
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
    
    // Couleurs existantes dans le projet
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
  };

  // Analyser un projet pour les couleurs statiques
  analyzeProject(projectPath: string): MigrationReport {
    const files = this.getAllFiles(projectPath);
    const report: MigrationReport = {
      totalFiles: files.length,
      migratedFiles: 0,
      remainingFiles: 0,
      estimatedTime: '0 minutes',
      issues: [],
      recommendations: [],
    };

    let totalColors = 0;
    let staticColors = 0;

    files.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const colors = this.extractColors(content);
        totalColors += colors.length;
        
        const staticColorCount = colors.filter(color => 
          Object.keys(this.colorMappings).includes(color)
        ).length;
        
        staticColors += staticColorCount;
        
        if (staticColorCount > 0) {
          report.remainingFiles++;
        } else {
          report.migratedFiles++;
        }
      } catch (error) {
        report.issues.push(`Erreur lecture fichier ${file}: ${error}`);
      }
    });

    // Estimation du temps
    const avgTimePerFile = 2; // minutes
    report.estimatedTime = `${Math.ceil(report.remainingFiles * avgTimePerFile)} minutes`;

    // Recommandations
    if (staticColors > 0) {
      report.recommendations.push(
        `${staticColors} couleurs statiques trouvées à migrer`,
        'Commencer par les composants les plus utilisés',
        'Tester chaque migration individuellement'
      );
    }

    return report;
  }

  // Migrer automatiquement un fichier
  migrateFile(filePath: string): string {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Ajouter l'import du thème si nécessaire
      if (!content.includes('useThemeContext') && !content.includes('useTheme')) {
        const importStatement = this.generateImportStatement(filePath);
        if (importStatement) {
          content = importStatement + '\n' + content;
          modified = true;
        }
      }

      // Remplacer les couleurs statiques
      Object.entries(this.colorMappings).forEach(([oldColor, newColor]) => {
        const regex = new RegExp(`'${oldColor}'|"${oldColor}"|\\b${oldColor}\\b`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, newColor);
          modified = true;
        }
      });

      // Ajouter le hook si nécessaire
      if (modified && !content.includes('const { theme } =')) {
        content = this.addThemeHook(content);
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
      }

      return content;
    } catch (error) {
      throw new Error(`Erreur migration ${filePath}: ${error}`);
    }
  }

  // Générer le rapport de migration
  generateMigrationReport(projectPath: string): string {
    const report = this.analyzeProject(projectPath);
    
    return `
# 📊 Rapport de Migration Thème LibreShop

## 📈 Statistiques
- **Fichiers totaux**: ${report.totalFiles}
- **Fichiers migrés**: ${report.migratedFiles}
- **Fichiers restants**: ${report.remainingFiles}
- **Temps estimé**: ${report.estimatedTime}

## ✅ Recommandations
${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## ⚠️ Problèmes détectés
${report.issues.map(issue => `- ${issue}`).join('\n')}

## 🚀 Prochaines étapes
1. ${report.remainingFiles > 0 ? 'Migrer les fichiers restants' : 'Migration terminée!'}
2. Tester les composants migrés
3. Valider les contrastes WCAG
4. Optimiser les performances

## 📝 Fichiers à migrer
${this.getFilesToMigrate(projectPath).join('\n')}
    `.trim();
  }

  // Méthodes privées
  private getAllFiles(dir: string, extensions = ['.tsx', '.ts', '.js', '.jsx']): string[] {
    const files: string[] = [];
    
    const scan = (currentDir: string) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scan(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    scan(dir);
    return files;
  }

  private extractColors(content: string): string[] {
    const colorPatterns = [
      /#[0-9a-fA-F]{6}/g,           // Hex colors
      /COLORS\.[a-zA-Z]+/g,         // COLORS object properties
      /rgba?\([^)]+\)/g,           // RGB/RGBA colors
    ];
    
    let colors: string[] = [];
    colorPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      colors = colors.concat(matches);
    });
    
    return [...new Set(colors)]; // Remove duplicates
  }

  private generateImportStatement(filePath: string): string {
    if (filePath.includes('components/')) {
      return "import { useThemeContext } from '../context/ThemeContext';";
    } else if (filePath.includes('screens/')) {
      return "import { useThemeContext } from '../context/ThemeContext';";
    } else if (filePath.includes('navigation/')) {
      return "import { useThemeContext } from '../context/ThemeContext';";
    }
    return '';
  }

  private addThemeHook(content: string): string {
    const lines = content.split('\n');
    const componentIndex = lines.findIndex(line => 
      line.includes('export const') || line.includes('const ') || line.includes('function ')
    );
    
    if (componentIndex !== -1) {
      lines.splice(componentIndex + 1, 0, '  const { theme } = useThemeContext();');
      return lines.join('\n');
    }
    
    return content;
  }

  private getFilesToMigrate(projectPath: string): string[] {
    const files = this.getAllFiles(projectPath);
    return files.filter(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const colors = this.extractColors(content);
        return colors.some(color => Object.keys(this.colorMappings).includes(color));
      } catch {
        return false;
      }
    });
  }
}

export const themeMigrator = new ThemeMigrator();
