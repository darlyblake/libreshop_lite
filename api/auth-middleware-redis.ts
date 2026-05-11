/**
 * Middleware d'authentification et de sécurité avec Redis pour production
 * Utilise Redis pour le rate limiting distribué
 */

import { createClient } from '@redis/client';

// Configuration Redis
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });

// Connexion Redis
async function getRedisClient() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
  return redisClient;
}

// Configuration Rate Limiting
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // 100 requêtes par fenêtre

/**
 * Vérifie le rate limiting avec Redis
 * @param ip - Adresse IP du client
 * @returns true si autorisé, false si limité
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const key = `ratelimit:${ip}`;
    const now = Date.now();

    // Obtenir le compteur actuel
    const count = await redis.get(key);

    if (!count) {
      // Premier accès - créer l'entrée
      await redis.setEx(key, RATE_LIMIT_WINDOW / 1000, '1');
      return true;
    }

    const currentCount = parseInt(count, 10);

    if (currentCount >= RATE_LIMIT_MAX) {
      return false; // Limite atteinte
    }

    // Incrémenter le compteur
    await redis.incr(key);
    return true;
  } catch (error) {
    // En cas d'erreur Redis, autoriser la requête (fail-open)
    console.error('Redis rate limit error:', error);
    return true;
  }
}

/**
 * Réinitialise le rate limiting pour une IP (admin)
 * @param ip - Adresse IP du client
 */
export async function resetRateLimit(ip: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.del(`ratelimit:${ip}`);
  } catch (error) {
    console.error('Redis reset error:', error);
  }
}

/**
 * Obtient les statistiques de rate limiting
 * @returns Statistiques actuelles
 */
export async function getRateLimitStats(): Promise<{ total: number; active: number }> {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys('ratelimit:*');
    return {
      total: keys.length,
      active: keys.length,
    };
  } catch (error) {
    console.error('Redis stats error:', error);
    return { total: 0, active: 0 };
  }
}

// Headers de sécurité (même version que l'original)
export function setSecurityHeaders(res: any): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "img-src 'self' https: data:; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; " +
    "connect-src 'self' https://*.supabase.co; " +
    "frame-ancestors 'none';"
  );
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

// Validation d'adresse IP
export function getClientIP(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
}

// Sanitization des logs d'erreurs
export function sanitizeError(error: any): string {
  const message = error?.message || String(error);
  // Supprimer les informations sensibles potentielles
  return message
    .replace(/password/i, '***')
    .replace(/secret/i, '***')
    .replace(/token/i, '***')
    .replace(/key/i, '***')
    .substring(0, 200);
}

// Fermeture propre de Redis (pour le shutdown)
export async function closeRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}
