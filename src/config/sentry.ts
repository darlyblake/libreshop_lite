/**
 * Configuration Sentry pour le monitoring de sécurité et d'erreurs
 */

import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN, ENVIRONMENT } from '@env';

// Initialisation de Sentry
export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured - skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT || 'development',
    
    // Performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0.5,
    
    // Session replay
    replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0,
    
    // Profiling
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0.5,
    
    // Security features
    beforeSend(event: any, hint: any) {
      // Filtrer les données sensibles
      if (event.request) {
        // Supprimer les headers sensibles
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }
        
        // Supprimer les paramètres sensibles de l'URL
        if (event.request.url) {
          event.request.url = event.request.url.replace(/token=[^&]+/g, 'token=***');
          event.request.url = event.request.url.replace(/password=[^&]+/g, 'password=***');
          event.request.url = event.request.url.replace(/secret=[^&]+/g, 'secret=***');
        }
      }
      
      // Filtrer les données sensibles dans le contexte
      if (event.contexts) {
        Object.keys(event.contexts).forEach(key => {
          const context = event.contexts[key];
          if (typeof context === 'object') {
            event.contexts[key] = sanitizeContext(context);
          }
        });
      }
      
      return event;
    },
    
    // Intégration avec React Native
    integrations: [
      new Sentry.ReactNativeIntegrations.ReactNavigationV5Integration(),
    ],
    
    // Before breadcrumb
    beforeBreadcrumb(breadcrumb: any, hint: any) {
      // Filtrer les breadcrumbs sensibles
      if (breadcrumb.category === 'http') {
        if (breadcrumb.data) {
          delete breadcrumb.data['authorization'];
          delete breadcrumb.data['cookie'];
        }
      }
      return breadcrumb;
    },
  });
}

/**
 * Sanitize les données de contexte pour supprimer les infos sensibles
 */
function sanitizeContext(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'authorization', 'cookie'];
  const sanitized = { ...data };
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeContext(sanitized[key]);
    }
  });
  
  return sanitized;
}

/**
 * Capture une erreur avec contexte de sécurité
 */
export function captureSecurityError(error: Error, context: Record<string, any> = {}) {
  Sentry.captureException(error, {
    tags: {
      category: 'security',
    },
    extra: {
      ...context,
    },
  });
}

/**
 * Capture un message de sécurité
 */
export function captureSecurityMessage(message: string, level: 'info' | 'warning' | 'error' = 'warning') {
  Sentry.captureMessage(message, {
    level,
    tags: {
      category: 'security',
    },
  });
}

/**
 * Définir l'utilisateur actuel pour Sentry
 */
export function setSentryUser(user: { id: string; email?: string; role?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

/**
 * Réinitialiser l'utilisateur Sentry
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Ajouter un breadcrumb de sécurité
 */
export function addSecurityBreadcrumb(message: string, category: string = 'security', data: Record<string, any> = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data: sanitizeContext(data),
  });
}
