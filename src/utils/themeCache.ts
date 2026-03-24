/**
 * Cache intelligent pour les thèmes et styles
 * Optimisation des performances avec mémoisation
 */

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
}

class ThemeCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, value: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  memoize<T extends (...args: any[]) => any>(fn: T, ttl?: number): T {
    return ((...args: any[]) => {
      const key = `${fn.name}_${JSON.stringify(args)}`;
      const cached = this.get(key);
      
      if (cached !== null) {
        return cached;
      }

      const result = fn(...args);
      this.set(key, result, ttl);
      return result;
    }) as T;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const themeCache = new ThemeCache();

// Cache des styles pré-calculés
export const getStyles = (component: string, themeName: string, width?: number) => {
  const cacheKey = `${component}_${themeName}_${width || 'default'}`;
  
  return themeCache.memoize((theme: string, screenWidth?: number) => {
    // Calcul des styles avec responsive
    const responsiveSpacing = screenWidth ? getResponsiveSpacing(screenWidth) : null;
    const responsiveFontSize = screenWidth ? getResponsiveFontSize(screenWidth) : null;
    
    return {
      // Styles pré-calculés
      container: {
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        padding: responsiveSpacing?.md || 16,
      },
      text: {
        color: theme === 'dark' ? '#f8fafc' : '#0f172a',
        fontSize: responsiveFontSize?.md || 16,
      },
      // ... autres styles
    };
  })(themeName, width);
};

// Cache des couleurs calculées
export const getComputedColors = themeCache.memoize((baseTheme: any, adjustments: any) => {
  return {
    ...baseTheme,
    // Couleurs calculées avec ajustements
    primary: adjustments.brightness ? adjustColor(baseTheme.primary, adjustments.brightness) : baseTheme.primary,
    text: adjustments.contrast ? getAccessibleColors(baseTheme).highContrast.text : baseTheme.text,
  };
});

// Importations temporaires (seront remplacées par les vrais imports)
const getResponsiveSpacing = (width: number) => ({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 });
const getResponsiveFontSize = (width: number) => ({ xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24 });
const adjustColor = (color: string, amount: number) => color;
const getAccessibleColors = (theme: any) => ({ highContrast: { text: '#000000' } });
