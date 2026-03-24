/**
 * Utilitaires de performance avancée pour les thèmes
 * Optimisation du rendu, mémoisation et monitoring
 */

import { Platform } from 'react-native';

interface PerformanceMetrics {
  renderTime: number;
  themeSwitchTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  fps: number;
}

interface PerformanceConfig {
  enableMetrics: boolean;
  enableProfiling: boolean;
  maxCacheSize: number;
  debounceDelay: number;
  batchUpdates: boolean;
}

class ThemePerformanceManager {
  private metrics: PerformanceMetrics = {
    renderTime: 0,
    themeSwitchTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    fps: 60,
  };

  private config: PerformanceConfig = {
    enableMetrics: true,
    enableProfiling: false,
    maxCacheSize: 100,
    debounceDelay: 16, // ~60fps
    batchUpdates: true,
  };

  private renderStartTime = 0;
  private themeSwitchStartTime = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private frameCount = 0;
  private lastFrameTime = Date.now();

  // Démarrer le monitoring du rendu
  startRenderMonitoring(): void {
    if (!this.config.enableMetrics) return;
    this.renderStartTime = performance.now();
  }

  // Arrêter le monitoring du rendu
  stopRenderMonitoring(): void {
    if (!this.config.enableMetrics || !this.renderStartTime) return;
    this.metrics.renderTime = performance.now() - this.renderStartTime;
    this.renderStartTime = 0;
  }

  // Démarrer le monitoring du changement de thème
  startThemeSwitchMonitoring(): void {
    if (!this.config.enableMetrics) return;
    this.themeSwitchStartTime = performance.now();
  }

  // Arrêter le monitoring du changement de thème
  stopThemeSwitchMonitoring(): void {
    if (!this.config.enableMetrics || !this.themeSwitchStartTime) return;
    this.metrics.themeSwitchTime = performance.now() - this.themeSwitchStartTime;
    this.themeSwitchStartTime = 0;
  }

  // Enregistrer un hit de cache
  recordCacheHit(): void {
    this.cacheHits++;
    this.updateCacheHitRate();
  }

  // Enregistrer un miss de cache
  recordCacheMiss(): void {
    this.cacheMisses++;
    this.updateCacheHitRate();
  }

  // Mettre à jour le taux de hit de cache
  private updateCacheHitRate(): void {
    const total = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  // Mettre à jour les FPS
  updateFPS(): void {
    const now = Date.now();
    const delta = now - this.lastFrameTime;
    
    if (delta >= 1000) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastFrameTime = now;
    } else {
      this.frameCount++;
    }
  }

  // Obtenir les métriques actuelles
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Réinitialiser les métriques
  resetMetrics(): void {
    this.metrics = {
      renderTime: 0,
      themeSwitchTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      fps: 60,
    };
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.frameCount = 0;
  }

  // Optimiser le rendu avec debounce
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number = this.config.debounceDelay
  ): T {
    let timeoutId: NodeJS.Timeout;
    
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
  }

  // Batch les mises à jour de style
  batchStyleUpdates(updates: Array<() => void>): void {
    if (!this.config.batchUpdates) {
      updates.forEach(update => update());
      return;
    }

    // Sur React Native, utiliser requestAnimationFrame
    if (Platform.OS === 'web') {
      requestAnimationFrame(() => {
        updates.forEach(update => update());
      });
    } else {
      // Pour React Native natif
      setTimeout(() => {
        updates.forEach(update => update());
      }, 0);
    }
  }

  // Optimiser la mémoire du cache
  optimizeCache<T>(cache: Map<string, T>, maxSize: number = this.config.maxCacheSize): void {
    if (cache.size <= maxSize) return;

    // Supprimer les entrées les plus anciennes (LRU simple)
    const entries = Array.from(cache.entries());
    const toDelete = entries.slice(0, entries.length - maxSize);
    
    toDelete.forEach(([key]) => cache.delete(key));
  }

  // Monitorer l'utilisation mémoire (approximatif)
  updateMemoryUsage(): void {
    if (Platform.OS === 'web' && 'memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024); // MB
    }
  }

  // Générer un rapport de performance
  generatePerformanceReport(): string {
    return `
# 📊 Rapport de Performance Thème

## 🎯 Métriques Actuelles
- **Temps de rendu**: ${this.metrics.renderTime.toFixed(2)}ms
- **Temps de changement thème**: ${this.metrics.themeSwitchTime.toFixed(2)}ms
- **Taux de hit cache**: ${this.metrics.cacheHitRate.toFixed(1)}%
- **Utilisation mémoire**: ${this.metrics.memoryUsage}MB
- **FPS**: ${this.metrics.fps}

## 📈 Statistiques du Cache
- **Hits**: ${this.cacheHits}
- **Misses**: ${this.cacheMisses}
- **Total requêtes**: ${this.cacheHits + this.cacheMisses}

## ⚡ Optimisations Actives
- **Métriques activées**: ${this.config.enableMetrics ? '✅' : '❌'}
- **Profilage activé**: ${this.config.enableProfiling ? '✅' : '❌'}
- **Taille max cache**: ${this.config.maxCacheSize}
- **Delai debounce**: ${this.config.debounceDelay}ms
- **Batch updates**: ${this.config.batchUpdates ? '✅' : '❌'}

## 🎯 Recommandations
${this.generateRecommendations()}
    `.trim();
  }

  // Générer des recommandations basées sur les métriques
  private generateRecommendations(): string {
    const recommendations: string[] = [];

    if (this.metrics.renderTime > 16) {
      recommendations.push('- ⚠️ Temps de rendu élevé (>16ms). Considérez l\'optimisation des composants.');
    }

    if (this.metrics.themeSwitchTime > 100) {
      recommendations.push('- ⚠️ Changement de thème lent. Optimisez les transitions.');
    }

    if (this.metrics.cacheHitRate < 80) {
      recommendations.push('- ⚠️ Taux de cache faible. Augmentez la taille du cache ou optimisez les clés.');
    }

    if (this.metrics.fps < 55) {
      recommendations.push('- ⚠️ FPS bas. Vérifiez les animations et les mises à jour.');
    }

    if (this.metrics.memoryUsage > 100) {
      recommendations.push('- ⚠️ Utilisation mémoire élevée. Nettoyez le cache plus fréquemment.');
    }

    if (recommendations.length === 0) {
      recommendations.push('- ✅ Performance optimale !');
    }

    return recommendations.join('\n');
  }

  // Configurer le gestionnaire de performance
  configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Instance singleton
export const themePerformanceManager = new ThemePerformanceManager();

// Hook pour utiliser les métriques de performance
export const useThemePerformance = () => {
  return {
    metrics: themePerformanceManager.getMetrics(),
    startRenderMonitoring: () => themePerformanceManager.startRenderMonitoring(),
    stopRenderMonitoring: () => themePerformanceManager.stopRenderMonitoring(),
    startThemeSwitchMonitoring: () => themePerformanceManager.startThemeSwitchMonitoring(),
    stopThemeSwitchMonitoring: () => themePerformanceManager.stopThemeSwitchMonitoring(),
    recordCacheHit: () => themePerformanceManager.recordCacheHit(),
    recordCacheMiss: () => themePerformanceManager.recordCacheMiss(),
    updateFPS: () => themePerformanceManager.updateFPS(),
    generateReport: () => themePerformanceManager.generatePerformanceReport(),
    resetMetrics: () => themePerformanceManager.resetMetrics(),
  };
};
