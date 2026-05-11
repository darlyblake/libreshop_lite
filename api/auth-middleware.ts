/**
 * Middleware d'authentification et de sécurité pour les API endpoints
 */

// Rate limiting simple en mémoire (en production, utiliser Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // 100 requêtes par fenêtre

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// Nettoyer les anciennes entrées de rate limit toutes les heures
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 60 * 1000);

// Headers de sécurité
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
