// Gestion centralisée des erreurs pour LibreShop
// Remplace tous les console.error et console.warn par un système structuré

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  DATABASE = 'database',
  PERMISSION = 'permission',
  SYSTEM = 'system',
  USER_INPUT = 'user_input'
}

export interface AppError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: string;
  timestamp: Date;
  stack?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

class ErrorHandler {
  private errors: AppError[] = [];
  private maxErrors = 100; // Limite pour éviter les memory leaks

  /**
   * Crée et gère une erreur de manière centralisée
   */
  handle(
    error: Error | string,
    context: string,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    metadata?: Record<string, any>
  ): AppError {
    const appError: AppError = {
      id: this.generateId(),
      message: typeof error === 'string' ? error : error.message,
      category,
      severity,
      context,
      timestamp: new Date(),
      stack: typeof error === 'object' ? error.stack : undefined,
      metadata,
    };

    // Ajouter à l'historique
    this.addToHistory(appError);

    // Logging structuré
    this.logError(appError);

    // Reporting optionnel (envoyer à un service externe)
    this.reportError(appError);

    return appError;
  }

  /**
   * Gestion des erreurs réseau
   */
  handleNetworkError(error: Error, context: string, metadata?: Record<string, any>): AppError {
    return this.handle(
      error,
      context,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      { ...metadata, type: 'network' }
    );
  }

  /**
   * Gestion des erreurs d'authentification
   */
  handleAuthError(error: Error, context: string): AppError {
    return this.handle(
      error,
      context,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      { type: 'auth' }
    );
  }

  /**
   * Gestion des erreurs de validation
   */
  handleValidationError(message: string, context: string, field?: string): AppError {
    return this.handle(
      message,
      context,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      { type: 'validation', field }
    );
  }

  /**
   * Gestion des erreurs de base de données
   */
  handleDatabaseError(error: Error, context: string, query?: string): AppError {
    return this.handle(
      error,
      context,
      ErrorCategory.DATABASE,
      ErrorSeverity.HIGH,
      { type: 'database', query }
    );
  }

  /**
   * Génère un ID unique pour l'erreur
   */
  private generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ajoute l'erreur à l'historique avec limite
   */
  private addToHistory(error: AppError): void {
    this.errors.push(error);
    
    // Garder seulement les N dernières erreurs
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  /**
   * Logging structuré en développement
   */
  private logError(error: AppError): void {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      const emoji = this.getEmojiForSeverity(error.severity);
      console.error(
        `${emoji} [${error.category.toUpperCase()}] ${error.context}: ${error.message}`,
        {
          id: error.id,
          timestamp: error.timestamp.toISOString(),
          metadata: error.metadata,
        }
      );
    }
  }

  /**
   * Reporting à un service externe (optionnel)
   */
  private reportError(error: AppError): void {
    // Implémenter ici l'envoi vers Sentry, LogRocket, etc.
    // Pour l'instant, juste en développement
    if (error.severity === ErrorSeverity.CRITICAL) {
      errorHandler.handle(error, '🚨 Erreur critique détectée:', ErrorCategory.SYSTEM, ErrorSeverity.LOW);
    }
  }

  /**
   * Retourne un emoji selon la sévérité
   */
  private getEmojiForSeverity(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW: return 'ℹ️';
      case ErrorSeverity.MEDIUM: return '⚠️';
      case ErrorSeverity.HIGH: return '🔴';
      case ErrorSeverity.CRITICAL: return '🚨';
      default: return '❓';
    }
  }

  /**
   * Récupère l'historique des erreurs
   */
  getErrors(limit?: number): AppError[] {
    return limit ? this.errors.slice(-limit) : [...this.errors];
  }

  /**
   * Efface l'historique des erreurs
   */
  clearHistory(): void {
    this.errors = [];
  }

  /**
   * Formate un message d'erreur pour l'utilisateur
   */
  getUserMessage(error: AppError): string {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'Problème de connexion. Vérifiez votre internet et réessayez.';
      case ErrorCategory.AUTHENTICATION:
        return 'Erreur d\'authentification. Veuillez vous reconnecter.';
      case ErrorCategory.VALIDATION:
        return error.message; // Messages de validation sont déjà user-friendly
      case ErrorCategory.DATABASE:
        return 'Erreur technique. Nos équipes sont informées.';
      case ErrorCategory.PERMISSION:
        return 'Vous n\'avez pas les permissions pour cette action.';
      default:
        return 'Une erreur est survenue. Veuillez réessayer.';
    }
  }
}

// Singleton pour l'application
export const errorHandler = new ErrorHandler();

// Fonctions utilitaires pour une utilisation rapide
export const handleNetworkError = (error: Error, context: string, metadata?: Record<string, any>) =>
  errorHandler.handleNetworkError(error, context, metadata);

export const handleAuthError = (error: Error, context: string) =>
  errorHandler.handleAuthError(error, context);

export const handleValidationError = (message: string, context: string, field?: string) =>
  errorHandler.handleValidationError(message, context, field);

export const handleDatabaseError = (error: Error, context: string, query?: string) =>
  errorHandler.handleDatabaseError(error, context, query);

export default errorHandler;
