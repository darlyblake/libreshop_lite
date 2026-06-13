/**
 * Performance Monitoring for productService
 * Tracks RPC execution time, over-fetch ratios, query performance
 */

export interface PerformanceMetric {
  operation: string;
  duration: number; // milliseconds
  timestamp: Date;
  itemsFetched?: number;
  itemsReturned?: number;
  overFetchRatio?: number;
  cacheHit?: boolean;
  rpcUsed?: boolean;
  error?: string;
}

export interface OperationStats {
  operation: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
  rpcSuccessRate: number;
  cacheHitRate: number;
  avgOverFetchRatio: number;
  lastMetric: PerformanceMetric | null;
}

/**
 * Performance Monitoring Service
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private stats: Map<string, OperationStats> = new Map();
  private maxMetricsInMemory = 1000; // Prevent unbounded memory growth

  /**
   * Record a metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep memory bounded
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory);
    }

    // Update operation stats
    this.updateStats(metric);

    // Log if slow
    if (metric.duration > 1000) {
      console.warn('[ProductService] Slow operation detected:', {
        operation: metric.operation,
        duration: `${metric.duration}ms`,
        cacheHit: metric.cacheHit,
        rpcUsed: metric.rpcUsed,
      });
    }

    // Log if over-fetch is high
    if (metric.overFetchRatio && metric.overFetchRatio > 5) {
      console.warn('[ProductService] High over-fetch detected:', {
        operation: metric.operation,
        fetched: metric.itemsFetched,
        returned: metric.itemsReturned,
        ratio: `${metric.overFetchRatio.toFixed(2)}x`,
      });
    }
  }

  /**
   * Update operation statistics
   */
  private updateStats(metric: PerformanceMetric): void {
    const op = metric.operation;
    const current = this.stats.get(op) || {
      operation: op,
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: -Infinity,
      errorCount: 0,
      rpcSuccessRate: 0,
      cacheHitRate: 0,
      avgOverFetchRatio: 0,
      lastMetric: null,
    };

    current.count++;
    current.totalDuration += metric.duration;
    current.avgDuration = current.totalDuration / current.count;
    current.minDuration = Math.min(current.minDuration, metric.duration);
    current.maxDuration = Math.max(current.maxDuration, metric.duration);
    current.lastMetric = metric;

    if (metric.error) current.errorCount++;

    // Update cache hit rate
    if (typeof metric.cacheHit === 'boolean') {
      const prevHits = current.cacheHitRate * (current.count - 1);
      current.cacheHitRate = (prevHits + (metric.cacheHit ? 1 : 0)) / current.count;
    }

    // Update RPC success rate
    if (typeof metric.rpcUsed === 'boolean') {
      const prevSuccesses = current.rpcSuccessRate * (current.count - 1);
      current.rpcSuccessRate = (prevSuccesses + (metric.rpcUsed ? 1 : 0)) / current.count;
    }

    // Update over-fetch ratio
    if (metric.overFetchRatio) {
      const prevRatio = current.avgOverFetchRatio * (current.count - 1);
      current.avgOverFetchRatio = (prevRatio + metric.overFetchRatio) / current.count;
    }

    this.stats.set(op, current);
  }

  /**
   * Get stats for a specific operation
   */
  getStats(operation: string): OperationStats | null {
    return this.stats.get(operation) || null;
  }

  /**
   * Get all stats
   */
  getAllStats(): OperationStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get metrics from last N seconds
   */
  getRecentMetrics(seconds: number): PerformanceMetric[] {
    const cutoff = Date.now() - seconds * 1000;
    return this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getAllStats();
    const lines = [
      '=== PRODUCTSERVICE PERFORMANCE REPORT ===',
      `Generated: ${new Date().toISOString()}`,
      '',
      `Total metrics tracked: ${this.metrics.length}`,
      `Operations monitored: ${stats.length}`,
      '',
      '--- Operation Breakdown ---',
    ];

    for (const stat of stats) {
      lines.push(`\n${stat.operation}:`);
      lines.push(`  Count: ${stat.count}`);
      lines.push(`  Avg Duration: ${stat.avgDuration.toFixed(2)}ms`);
      lines.push(`  Min/Max: ${stat.minDuration.toFixed(2)}ms / ${stat.maxDuration.toFixed(2)}ms`);
      lines.push(`  Error Rate: ${((stat.errorCount / stat.count) * 100).toFixed(2)}%`);
      lines.push(`  Cache Hit Rate: ${(stat.cacheHitRate * 100).toFixed(2)}%`);
      lines.push(`  RPC Success Rate: ${(stat.rpcSuccessRate * 100).toFixed(2)}%`);
      lines.push(`  Avg Over-fetch Ratio: ${stat.avgOverFetchRatio.toFixed(2)}x`);
    }

    return lines.join('\n');
  }

  /**
   * Export metrics for analytics
   */
  exportMetrics(): {
    metrics: PerformanceMetric[];
    stats: OperationStats[];
    timestamp: Date;
  } {
    return {
      metrics: [...this.metrics],
      stats: this.getAllStats(),
      timestamp: new Date(),
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.stats.clear();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator to automatically track performance
 */
export function trackPerformance(operationName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      let error: string | undefined;

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric({
          operation: operationName,
          duration,
          timestamp: new Date(),
          error,
        });
      }
    };

    return descriptor;
  };
}
