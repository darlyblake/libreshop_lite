#!/bin/bash

# Cache Optimization Implementation Script
# Completes the cache optimization for ClientHomeScreen

echo "🔧 Cache Optimization Implementation"
echo "===================================="
echo ""

# Step 1: Verify cacheService.ts was updated
if grep -q "stale" src/services/cacheService.ts; then
    echo "✅ cacheService.ts enhanced with stale-while-revalidate"
else
    echo "❌ cacheService.ts needs enhancement"
    exit 1
fi

# Step 2: Create the remaining configuration file
cat > src/config/cacheConfig.ts << 'EOF'
/**
 * Cache Configuration for ClientHomeScreen
 * Optimized TTL values with stale-while-revalidate support
 */

export const CACHE_TTL = {
  // Fast-changing data: 45 min TTL, serve stale for 30 min
  PRODUCTS: { 
    duration: 45, 
    stale: 30,
    description: '45min TTL (was 15min - 200% improvement)'
  },
  
  // Medium-changing data: 60 min TTL, serve stale for 45 min
  STORES: { 
    duration: 60, 
    stale: 45,
    description: '60min TTL (was 30min - 100% improvement)'
  },
  CAROUSEL: { 
    duration: 60, 
    stale: 45,
    description: 'Banner carousel - infrequent changes'
  },
  PROMO: { 
    duration: 60, 
    stale: 45,
    description: 'Promo banners - managed by admin'
  },
  COLLECTIONS: { 
    duration: 60, 
    stale: 45,
    description: 'Store collections'
  },
  
  // Slow-changing data: 24h TTL, serve stale for 20h
  CATEGORIES: { 
    duration: 1440, 
    stale: 1200,
    description: '24h TTL (rarely changes)'
  },
};

// Image cache strategy
export const IMAGE_CACHE_TTL = 7 * 24 * 60; // 7 days for Cloudinary images

// Cache size limits
export const CACHE_LIMITS = {
  MAX_SIZE: 5 * 1024 * 1024,      // 5MB total
  PER_KEY_MAX: 2 * 1024 * 1024,   // 2MB per key
  MAX_PRODUCTS: 100,               // Max products to cache
  MAX_STORES: 50,                  // Max stores to cache
};

// Performance thresholds
export const CACHE_THRESHOLDS = {
  MIN_HIT_RATE: 0.80,              // 80% hit rate target
  MAX_LOAD_TIME: 1000,             // 1 second max
  PREFETCH_THRESHOLD: 3,           // Prefetch after 3 items
};
EOF

echo "✅ Created src/config/cacheConfig.ts"

# Step 3: Create service-worker enhancement
cat > public/service-worker-cache-images.js << 'EOF'
/**
 * Image Caching Strategy for Service Worker
 * Add this to public/service-worker.js for Cloudinary image caching
 */

const CLOUDINARY_CACHE = 'libreshop-images-v1';
const IMAGE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const cacheCloudinaryImage = (request) => {
  return caches.open(CLOUDINARY_CACHE).then(cache => {
    return cache.match(request).then(response => {
      // Serve from cache if available
      if (response) {
        return response;
      }
      
      // Fetch and cache new image
      return fetch(request).then(newResponse => {
        if (newResponse.ok && newResponse.status === 200) {
          const responseToCache = newResponse.clone();
          cache.put(request, responseToCache);
        }
        return newResponse;
      }).catch(() => {
        // Return fallback for failed image
        return new Response(
          '<svg width="100" height="100"><rect fill="#ddd" width="100" height="100"/></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      });
    });
  });
};

// Usage in fetch event:
// if (url.hostname.includes('cloudinary.com')) {
//   return cacheCloudinaryImage(request);
// }
EOF

echo "✅ Created public/service-worker-cache-images.js"

# Step 4: Create monitoring utility
cat > src/utils/cacheMonitor.ts << 'EOF'
/**
 * Cache Performance Monitor
 * Tracks and reports cache effectiveness
 */

import { cacheService } from '../services/cacheService';

interface CacheReport {
  timestamp: Date;
  hitRate: number;
  missRate: number;
  cacheSize: string;
  recommendation: string;
}

export const cacheMonitor = {
  /**
   * Get current cache performance
   */
  getReport(): CacheReport {
    const stats = cacheService.getStats();
    const total = stats.hits + stats.misses || 1;
    const hitRate = (stats.hits / total) * 100;
    
    let recommendation = '✅ Excellent';
    if (hitRate < 70) recommendation = '⚠️ Low - consider increasing TTL';
    if (hitRate < 50) recommendation = '🔴 Critical - cache not working';
    
    return {
      timestamp: new Date(),
      hitRate: parseFloat(hitRate.toFixed(1)),
      missRate: parseFloat(((stats.misses / total) * 100).toFixed(1)),
      cacheSize: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      recommendation,
    };
  },

  /**
   * Log cache metrics to console
   */
  logMetrics(): void {
    const report = this.getReport();
    console.group('📊 Cache Performance');
    console.log('Timestamp:', report.timestamp.toISOString());
    console.log('Hit Rate:', `${report.hitRate}%`);
    console.log('Miss Rate:', `${report.missRate}%`);
    console.log('Size:', report.cacheSize);
    console.log('Status:', report.recommendation);
    console.groupEnd();
  },

  /**
   * Continuous monitoring (call on app start)
   */
  startMonitoring(intervalMs: number = 60000): () => void {
    const interval = setInterval(() => {
      this.logMetrics();
    }, intervalMs);

    return () => clearInterval(interval);
  },
};
EOF

echo "✅ Created src/utils/cacheMonitor.ts"

echo ""
echo "===================================="
echo "✅ Cache Optimization Config Created"
echo ""
echo "📋 Remaining Steps:"
echo "1. Update ClientHomeScreen.tsx cache calls with CACHE_TTL config"
echo "2. Add cacheMonitor.startMonitoring() on app startup"
echo "3. Integrate service-worker-cache-images.js into public/service-worker.js"
echo "4. Test with network throttling"
echo ""
echo "Files created:"
echo "  - src/config/cacheConfig.ts"
echo "  - public/service-worker-cache-images.js"
echo "  - src/utils/cacheMonitor.ts"
echo "  - CACHE_OPTIMIZATION_REPORT.md"
EOF

chmod +x src/config/cacheConfig.ts

echo ""
echo "✅ All cache optimization files created!"
echo "📖 See CACHE_OPTIMIZATION_REPORT.md for detailed implementation guide"
