/**
 * Cache Performance Monitor for LibreShop
 * Tracks and reports cache effectiveness in real-time
 */

import { cacheService } from '../services/cacheService';

interface CacheReport {
  timestamp: Date;
  hitRate: number;
  missRate: number;
  cacheSize: string;
  recommendation: string;
  saves: {
    bandwidth: string;
    battery: string;
    latency: string;
  };
}

class CacheMonitor {
  private stopMonitoring: (() => void) | null = null;
  private baselineLoads = 0;
  private optimizedLoads = 0;

  /**
   * Get current cache performance report
   */
  getReport(): CacheReport {
    const stats = cacheService.getStats();
    const total = stats.hits + stats.misses || 1;
    const hitRate = (stats.hits / total) * 100;
    
    let recommendation = '✅ Excellent';
    if (hitRate < 70) recommendation = '⚠️ Low - consider increasing TTL';
    if (hitRate < 50) recommendation = '🔴 Critical - cache not working';
    
    // Estimate savings
    const estimatedRequests = (stats.misses + stats.hits);
    const estimatedSaved = estimatedRequests - stats.misses;
    const avgDataPerRequest = 2.5; // MB
    const bandwidth = (estimatedSaved * avgDataPerRequest).toFixed(1);
    const battery = (estimatedSaved * 0.45).toFixed(0);
    const latency = (estimatedSaved * 1.8).toFixed(0);
    
    return {
      timestamp: new Date(),
      hitRate: parseFloat(hitRate.toFixed(1)),
      missRate: parseFloat(((stats.misses / total) * 100).toFixed(1)),
      cacheSize: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      recommendation,
      saves: {
        bandwidth: `${bandwidth}MB`,
        battery: `${battery}min/month`,
        latency: `${latency}ms`,
      },
    };
  }

  /**
   * Log cache metrics to console in a readable format
   */
  logMetrics(): void {
    const report = this.getReport();
    console.group('📊 LibreShop Cache Performance');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏰ Timestamp:', report.timestamp.toLocaleTimeString());
    console.log('');
    console.log('📈 Hit Rate:', `${report.hitRate}% ✨`);
    console.log('📉 Miss Rate:', `${report.missRate}%`);
    console.log('💾 Cache Size:', report.cacheSize);
    console.log('');
    console.log('💡 Status:', report.recommendation);
    console.log('');
    console.log('🎯 Estimated Savings:');
    console.log('  • Bandwidth:', report.saves.bandwidth);
    console.log('  • Battery:', report.saves.battery);
    console.log('  • Latency:', report.saves.latency + 'ms saved');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.groupEnd();
  }

  /**
   * Start continuous monitoring
   * @param intervalMs - Monitoring interval in milliseconds (default: 60 seconds)
   * @returns Function to stop monitoring
   */
  start(intervalMs: number = 60000): () => void {
    if (this.stopMonitoring) {
      console.warn('[cacheMonitor] Already monitoring. Call stop() first.');
      return this.stopMonitoring;
    }

    console.log(`[cacheMonitor] 🚀 Started with ${intervalMs}ms interval`);
    
    const interval = setInterval(() => {
      this.logMetrics();
    }, intervalMs);

    this.stopMonitoring = () => {
      clearInterval(interval);
      console.log('[cacheMonitor] ⏹️ Stopped monitoring');
      this.stopMonitoring = null;
    };

    return this.stopMonitoring;
  }

  /**
   * Stop continuous monitoring
   */
  stop(): void {
    if (this.stopMonitoring) {
      this.stopMonitoring();
    }
  }

  /**
   * Reset and get baseline metrics
   */
  resetBaseline(): void {
    cacheService.resetStats();
    this.baselineLoads = 0;
    this.optimizedLoads = 0;
    console.log('[cacheMonitor] 📍 Baseline reset');
  }

  /**
   * Get performance comparison
   */
  getComparison(): {
    improvement: number;
    message: string;
  } {
    const report = this.getReport();
    const improvement = report.hitRate - 60; // Baseline was ~60%
    
    let message = '✅ Cache optimization working!';
    if (improvement < 0) message = '⚠️ Cache performance degraded';
    if (improvement < -10) message = '🔴 Significant cache issues';
    
    return { improvement, message };
  }

  /**
   * Export cache stats for analytics
   */
  exportStats(): object {
    const stats = cacheService.getStats();
    const report = this.getReport();
    
    return {
      timestamp: new Date().toISOString(),
      cache: {
        ...stats,
        hitRate: report.hitRate,
        missRate: report.missRate,
        sizeInMB: parseFloat(report.cacheSize),
      },
      savings: report.saves,
      recommendation: report.recommendation,
    };
  }
}

export const cacheMonitor = new CacheMonitor();

// Auto-stop monitoring on app background (for React Native)
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    cacheMonitor.stop();
  });
}
